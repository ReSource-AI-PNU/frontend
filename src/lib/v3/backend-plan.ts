/**
 * 프런트 서버가 백엔드(/api/v3)를 부를 때 붙일 머리글과, 브라우저 요청을 넘길지 막을지를 정하는 순수 함수.
 * 네트워크도 Next.js도 부르지 않으므로 node --test로 바로 검사한다(tests/backend-plan.test.ts).
 *
 * 인증 모드(V3_AUTH)
 *   bff     운영. Authorization: Bearer <V3_BFF_KEY>와 X-User-Id(로그인한 사람), X-Org-Id(세션의 활성 회사)를 보낸다.
 *           체험하기는 X-Demo-View: 1과 시연 회사의 X-Org-Id만 보내고 X-User-Id는 보내지 않는다.
 *   token   예전 방식. 회사별 토큰(V3_ORG_TOKENS)을 Authorization에 싣는다.
 *   header  로컬 개발. X-Org-Id만 보낸다(백엔드가 그대로 믿는다).
 * V3_AUTH가 없으면 V3_BFF_KEY → bff, V3_ORG_TOKENS → token, 둘 다 없으면 header로 정한다.
 *
 * 응답 문구는 사용자에게 그대로 보일 수 있으므로 쉬운 말로 쓰고, 원인은 code에만 남긴다(기록용).
 */

export type BackendEnv = {
  V3_BACKEND_URL?: string;
  V3_AUTH?: string;
  V3_BFF_KEY?: string;
  V3_ORG_TOKENS?: string;
};

export type BackendConfig =
  | { ok: true; url: string; mode: "bff"; key: string }
  | { ok: true; url: string; mode: "token"; tokens: Record<string, string> }
  | { ok: true; url: string; mode: "header" }
  | { ok: false; code: "BACKEND_NOT_SET" | "BFF_KEY_NOT_SET" | "TOKENS_INVALID" | "AUTH_MODE_INVALID" };

/** 사용자에게 보이는 문구. 원인(설정 누락, 서버 꺼짐)은 말하지 않는다. */
export const USER_MESSAGE = {
  unavailable: "잠시 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
  login: "로그인이 필요합니다. 다시 로그인해 주세요.",
  noCompany: "회사를 먼저 등록해 주세요.",
  otherCompany: "다른 회사의 자료는 볼 수 없습니다.",
  demoReadOnly: "체험 중에는 둘러보기만 할 수 있습니다. 가입하면 내 회사로 시작할 수 있습니다.",
  demoUnavailable: "지금은 체험 화면을 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
  notAllowed: "이 화면에서는 할 수 없는 요청입니다.",
  orgChanged: "다른 창에서 회사를 바꿨습니다. 화면을 새로 고쳐 주세요.",
} as const;

export const ORG_ID = /^[A-Za-z0-9_-]{1,64}$/;

function parseTokens(raw: string): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    // 값은 토큰 하나이거나 목록이다(백엔드는 바꾸는 동안 옛 토큰과 새 토큰을 함께 받는다). 목록이면 첫 번째를 쓴다
    const table: Record<string, string> = {};
    for (const [orgId, value] of Object.entries(parsed)) {
      const token = Array.isArray(value) ? value.find((item) => typeof item === "string" && item) : value;
      if (typeof token === "string" && token) table[orgId] = token;
    }
    return table;
  } catch {
    return null;
  }
}

export function readBackendConfig(env: BackendEnv): BackendConfig {
  const url = (env.V3_BACKEND_URL ?? "").trim().replace(/\/+$/, "");
  if (!url) return { ok: false, code: "BACKEND_NOT_SET" };
  const explicit = (env.V3_AUTH ?? "").trim().toLowerCase();
  const mode = explicit || (env.V3_BFF_KEY ? "bff" : env.V3_ORG_TOKENS ? "token" : "header");
  if (mode === "bff") {
    const key = (env.V3_BFF_KEY ?? "").trim();
    return key ? { ok: true, url, mode, key } : { ok: false, code: "BFF_KEY_NOT_SET" };
  }
  if (mode === "token") {
    const tokens = env.V3_ORG_TOKENS ? parseTokens(env.V3_ORG_TOKENS) : null;
    return tokens ? { ok: true, url, mode, tokens } : { ok: false, code: "TOKENS_INVALID" };
  }
  if (mode === "header") return { ok: true, url, mode };
  return { ok: false, code: "AUTH_MODE_INVALID" };
}

/** 누구로서 부르는가. demo면 체험하기(시연 회사 읽기 전용)다. */
export type Caller = { userId?: string | null; orgId?: string | null; demo?: boolean };

export type Refusal = { ok: false; status: number; code: string; message: string };

export function refuse(status: number, code: string, message: string): Refusal {
  return { ok: false, status, code, message };
}

/** 인증 모드에 맞춰 백엔드로 보낼 머리글을 만든다. */
export function backendHeaders(
  config: Extract<BackendConfig, { ok: true }>,
  caller: Caller,
): { ok: true; headers: Record<string, string> } | Refusal {
  const headers: Record<string, string> = {};
  const orgId = caller.orgId ?? null;
  if (orgId !== null && !ORG_ID.test(orgId)) return refuse(400, "INVALID_ORG", USER_MESSAGE.notAllowed);
  if (caller.demo) {
    headers["X-Demo-View"] = "1";
  } else if (caller.userId) {
    headers["X-User-Id"] = caller.userId;
  }
  if (orgId) headers["X-Org-Id"] = orgId;
  if (config.mode === "bff") {
    headers.Authorization = `Bearer ${config.key}`;
  } else if (config.mode === "token" && orgId) {
    const token = config.tokens[orgId];
    if (!token) return refuse(403, "ORG_NOT_ALLOWED", USER_MESSAGE.notAllowed);
    headers.Authorization = `Bearer ${token}`;
  }
  return { ok: true, headers };
}

/** 브라우저가 부른 요청을 누구의 것으로 넘기는가. public은 로그인 없이 여는 읽기(/health, /trust)만 넘긴다 */
export type ProxyScope =
  | { kind: "member"; userId: string | null; orgId: string | null }
  | { kind: "demo"; orgId: string | null }
  | { kind: "public" };

export type ProxyPlan = { ok: true; url: string; headers: Record<string, string> } | Refusal;

const READ = new Set(["GET", "HEAD"]);
/** 로그인 없이 읽는 경로: 서버 상태와 공개 평가 결과(AI 신뢰도 화면) */
const PUBLIC_READ = new Set(["health", "trust"]);
/** 계정·초대는 서버 액션이 부른다. 브라우저 통로로는 넘기지 않는다. */
const SERVER_ONLY = new Set(["accounts", "invites"]);

/**
 * 브라우저 요청 하나를 백엔드로 넘길 계획. 조직은 브라우저가 보낸 X-Org-Id가 아니라 세션(또는 체험 회사)에서만 정한다.
 *  - 체험하기는 GET만 넘긴다. 쓰기는 백엔드에 닿기 전에 403 DEMO_READ_ONLY로 막는다.
 *  - 주소에 회사 ID가 들어가는 경로(/orgs/{id}/…, 쓰기 /vendors/{id})는 세션의 회사와 같을 때만 넘긴다.
 */
export function planProxy(input: {
  method: string;
  path: string[];
  search?: string;
  config: BackendConfig;
  scope: ProxyScope;
  /** 화면이 보고 있는 회사(X-Expected-Org). 다른 창에서 회사를 바꿔 세션과 어긋나면 409로 막는다 */
  expectedOrg?: string | null;
}): ProxyPlan {
  const { config, scope, path } = input;
  const method = input.method.toUpperCase();
  if (!config.ok) return refuse(503, config.code, USER_MESSAGE.unavailable);
  if (path.length === 0 || path.some(badSegment)) return refuse(404, "NOT_FOUND", USER_MESSAGE.notAllowed);
  const open = path.length === 1 && PUBLIC_READ.has(path[0]) && READ.has(method);
  const url = `${config.url}/${path.map(encodeURIComponent).join("/")}${input.search ?? ""}`;
  if (open) {
    const built = backendHeaders(config, {});
    return built.ok ? { ok: true, url, headers: built.headers } : built;
  }
  if (scope.kind === "public") return refuse(404, "NOT_FOUND", USER_MESSAGE.notAllowed);
  if (SERVER_ONLY.has(path[0])) return refuse(403, "SERVER_ONLY", USER_MESSAGE.notAllowed);

  if (scope.kind === "demo") {
    if (!READ.has(method)) return refuse(403, "DEMO_READ_ONLY", USER_MESSAGE.demoReadOnly);
    if (!scope.orgId) return refuse(503, "DEMO_UNAVAILABLE", USER_MESSAGE.demoUnavailable);
    const built = backendHeaders(config, { orgId: scope.orgId, demo: true });
    return built.ok ? { ok: true, url, headers: built.headers } : built;
  }

  if (!scope.userId) return refuse(401, "LOGIN_REQUIRED", USER_MESSAGE.login);
  if (!scope.orgId) return refuse(403, "ORG_REQUIRED", USER_MESSAGE.noCompany);
  if (input.expectedOrg && input.expectedOrg !== scope.orgId) return refuse(409, "ORG_CHANGED", USER_MESSAGE.orgChanged);
  // 주소에 적힌 회사가 세션의 회사와 다르면 넘기지 않는다(조직 목록 GET /orgs는 회사 ID가 없다)
  const pathOrg =
    path[0] === "orgs" && path.length >= 2
      ? path[1]
      : path[0] === "vendors" && path.length >= 2 && !READ.has(method)
        ? path[1]
        : null;
  if (pathOrg !== null && pathOrg !== scope.orgId) return refuse(403, "ORG_MISMATCH", USER_MESSAGE.otherCompany);
  const built = backendHeaders(config, { userId: scope.userId, orgId: scope.orgId });
  return built.ok ? { ok: true, url, headers: built.headers } : built;
}

/**
 * 경로 조각 하나가 위험한지. 조각 안의 "/"·"\"(%2F 등으로 들어온 것 포함)는 백엔드가 경로를 다시 나눠
 * 계정·회사 검사를 비켜 갈 수 있으므로 받지 않는다.
 */
function badSegment(part: string): boolean {
  let decoded = part;
  try {
    decoded = decodeURIComponent(part);
  } catch {
    return true;
  }
  return [part, decoded].some((value) => value === "" || value === "." || value === ".." || /[/\\]/.test(value));
}

/** 백엔드 오류 본문 {"error": {"code", "message"}}에서 code를 읽는다. */
export function errorCodeOf(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
