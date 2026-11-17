import "server-only";
import { planProxy, USER_MESSAGE, type ProxyScope } from "@/lib/v3/backend-plan";
import { isEventStream, relayEventStream, wantsEventStream } from "@/lib/v3/relay";
import { backendConfig } from "./backend";

/** last-event-id: 실시간 진행(SSE)을 끊긴 곳부터 이어 받는다 */
const PASS_REQUEST = ["content-type", "accept", "last-event-id"];
const PASS_RESPONSE = ["content-type", "content-disposition", "cache-control"];

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * 브라우저 요청 하나를 백엔드로 넘긴다. 조직·사람·체험 머리글은 scope(세션 또는 체험 회사)에서만 만들고,
 * 브라우저가 보낸 X-Org-Id·Authorization 같은 머리글은 넘기지 않는다(content-type, accept, last-event-id만).
 *
 * 실시간 진행(GET /sessions/{id}/stream)은 본문을 모으지 않고 조각마다 흘려보낸다(src/lib/v3/relay.ts).
 * 브라우저가 끊으면 백엔드 요청도 끊는다. 시간 제한은 두지 않는다(백엔드가 15초마다 빈 줄을 보낸다).
 */
export async function forwardToBackend(request: Request, path: string[], scope: ProxyScope): Promise<Response> {
  const plan = planProxy({
    method: request.method,
    path,
    search: new URL(request.url).search,
    config: backendConfig(),
    scope,
    expectedOrg: request.headers.get("x-expected-org"),
  });
  if (!plan.ok) {
    if (plan.status >= 500) console.error("[v3 proxy] refused", plan.code, path.join("/"));
    return fail(plan.status, plan.code, plan.message);
  }
  const headers = new Headers(plan.headers);
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const streaming = wantsEventStream(request.method, path, request.headers.get("accept"));
  // 실시간 진행은 브라우저가 떠나면 백엔드 요청도 끊는다(읽기만 하므로 끊어도 남는 일이 없다)
  const upstream = new AbortController();
  if (streaming) {
    if (request.signal.aborted) upstream.abort();
    else request.signal.addEventListener("abort", () => upstream.abort(), { once: true });
  }
  let response: Response;
  try {
    // 본문은 다 읽어서 길이(Content-Length)와 함께 보낸다. 조각 전송(chunked)을 읽지 못하는 서버도 받게 한다.
    // 올리는 파일 크기는 next.config의 proxyClientMaxBodySize와 백엔드의 상한이 막는다.
    const body = hasBody ? await request.arrayBuffer() : undefined;
    response = await fetch(plan.url, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: streaming ? upstream.signal : undefined,
    });
  } catch (cause) {
    if (upstream.signal.aborted) return new Response(null, { status: 499 });
    console.error("[v3 proxy] unreachable", path.join("/"), cause instanceof Error ? cause.message : cause);
    return fail(502, "BACKEND_UNREACHABLE", USER_MESSAGE.unavailable);
  }
  if (response.status >= 500) console.error("[v3 proxy] backend error", response.status, path.join("/"));
  if (response.ok && isEventStream(response.headers.get("content-type"))) {
    return relayEventStream(response.body, () => upstream.abort(), response.status);
  }
  const out = new Headers();
  for (const name of PASS_RESPONSE) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers: out });
}
