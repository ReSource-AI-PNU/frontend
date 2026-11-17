/**
 * 프런트 서버에서만 백엔드(/api/v3)를 부르는 도우미. 계정·회사·초대처럼 브라우저 통로로 넘기지 않는 호출에 쓴다.
 * 서버 키(V3_BFF_KEY)는 여기서만 읽고 브라우저로 가지 않는다(NEXT_PUBLIC_이 아니므로 클라이언트 번들에는 비어 있다).
 * auth.ts가 불러 쓰고 auth.ts는 proxy.ts에서도 읽히므로 "server-only"는 붙이지 않는다.
 */
import { backendHeaders, errorCodeOf, readBackendConfig, type Caller } from "@/lib/v3/backend-plan";

/** 백엔드가 오류로 답했거나 닿지 못한 경우. message는 기록용이고 화면에는 쓰지 않는다. */
export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 백엔드 설정. V3_BACKEND_URL이 없고 NEXT_PUBLIC_API_BASE가 백엔드 주소(http…)면 로컬 개발로 보고 그 주소를 쓴다.
 */
export function backendConfig() {
  const publicBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return readBackendConfig({
    V3_BACKEND_URL: process.env.V3_BACKEND_URL || (/^https?:\/\//.test(publicBase) ? publicBase : undefined),
    V3_AUTH: process.env.V3_AUTH,
    V3_BFF_KEY: process.env.V3_BFF_KEY,
    V3_ORG_TOKENS: process.env.V3_ORG_TOKENS,
  });
}

export async function callBackend<T>(
  path: string,
  options: Caller & { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const config = backendConfig();
  if (!config.ok) throw new BackendError(503, config.code, `backend config: ${config.code}`);
  const built = backendHeaders(config, options);
  if (!built.ok) throw new BackendError(built.status, built.code, built.code);
  const headers = new Headers(built.headers);
  headers.set("Accept", "application/json");
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
  } catch (cause) {
    console.error("[backend] unreachable", path, cause instanceof Error ? cause.message : cause);
    throw new BackendError(503, "BACKEND_UNREACHABLE", "backend unreachable");
  }
  const type = response.headers.get("content-type") ?? "";
  const parsed: unknown = type.includes("json") ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const code = errorCodeOf(parsed) ?? String(response.status);
    if (response.status >= 500) console.error("[backend] error", path, response.status, code);
    throw new BackendError(response.status, code, `backend ${response.status} ${code}`);
  }
  return parsed as T;
}

export function isBackendError(error: unknown, status?: number): error is BackendError {
  return error instanceof BackendError && (status === undefined || error.status === status);
}
