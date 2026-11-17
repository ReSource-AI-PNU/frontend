/**
 * v3 백엔드로 넘기는 서버 쪽 통로. 브라우저는 이 주소(/api/v3/*)만 부르고, 백엔드 주소와 조직 토큰은 서버에만 둔다.
 *
 *   NEXT_PUBLIC_API_BASE=/api/v3            브라우저가 부를 주소(이 통로)
 *   V3_BACKEND_URL=https://.../api/v3       실제 백엔드. 접두어 /api/v3까지 적는다
 *   V3_ORG_TOKENS={"org_hanbit":"..."}      백엔드가 V3_AUTH=token일 때 조직별 토큰(JSON). 없으면 X-Org-Id만 넘긴다
 *
 * - /health 말고는 로그인한 사용자만 지나간다.
 * - 토큰 표가 있으면 표에 있는 조직으로만 부를 수 있고, 토큰은 응답이나 기록에 싣지 않는다.
 * - 로그인한 사용자가 어느 조직 사람인지는 아직 묶지 않는다(시연 회사 고르기). 실제 운영 전에 계정과 조직을 묶어야 한다.
 */
import { auth } from "@/auth";

const ORG_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PASS_REQUEST = ["content-type", "accept"];
const PASS_RESPONSE = ["content-type", "content-disposition", "cache-control"];

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function orgTokens(): Record<string, string> | null | "invalid" {
  const raw = process.env.V3_ORG_TOKENS;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
    // 값은 토큰 하나이거나 목록이다(백엔드는 바꾸는 동안 옛 토큰과 새 토큰을 함께 받는다). 목록이면 첫 번째를 쓴다
    const table: Record<string, string> = {};
    for (const [orgId, value] of Object.entries(parsed)) {
      const token = Array.isArray(value) ? value.find((item) => typeof item === "string" && item) : value;
      if (typeof token === "string" && token) table[orgId] = token;
    }
    return table;
  } catch {
    return "invalid";
  }
}

async function forward(request: Request, context: RouteContext<"/api/v3/[...path]">) {
  const backend = (process.env.V3_BACKEND_URL ?? "").replace(/\/$/, "");
  if (!backend) return fail(503, "BACKEND_NOT_SET", "서버에 백엔드 주소(V3_BACKEND_URL)가 설정되지 않았습니다.");
  const { path } = await context.params;
  const open = path.length === 1 && path[0] === "health";
  if (!open) {
    const session = await auth();
    if (!session?.user) return fail(401, "LOGIN_REQUIRED", "로그인이 필요합니다.");
  }

  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const orgId = request.headers.get("x-org-id");
  if (orgId) {
    if (!ORG_ID.test(orgId)) return fail(400, "INVALID_ORG", "조직 ID가 올바르지 않습니다.");
    headers.set("X-Org-Id", orgId);
    const tokens = orgTokens();
    if (tokens === "invalid") return fail(503, "TOKENS_INVALID", "서버의 조직 토큰 설정(V3_ORG_TOKENS)을 읽지 못했습니다.");
    if (tokens) {
      const token = tokens[orgId];
      if (!token) return fail(403, "ORG_NOT_ALLOWED", "이 조직으로는 부를 수 없습니다.");
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // 양식 파일은 조직과 상관없는 내용이고 화면에서는 링크로 받는다(머리글을 붙일 수 없다). 표의 아무 토큰으로 받아 준다.
  if (!orgId && request.method === "GET" && path.join("/") === "intake/csv/template") {
    const tokens = orgTokens();
    const any = tokens && tokens !== "invalid" ? Object.values(tokens)[0] : null;
    if (any) headers.set("Authorization", `Bearer ${any}`);
  }

  const target = `${backend}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let response: Response;
  try {
    // 본문은 다 읽어서 길이(Content-Length)와 함께 보낸다. 조각 전송(chunked)을 읽지 못하는 서버도 받게 한다.
    // 올리는 파일 크기는 next.config의 proxyClientMaxBodySize와 백엔드의 상한이 막는다.
    const body = hasBody ? await request.arrayBuffer() : undefined;
    response = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return fail(502, "BACKEND_UNREACHABLE", "백엔드에 연결하지 못했습니다.");
  }
  const out = new Headers();
  for (const name of PASS_RESPONSE) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
