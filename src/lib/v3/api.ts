/** 계약 8장 API 클라이언트. 요청하는 조직은 X-Org-Id 헤더로 밝힌다(시연용). */
import type {
  DiagnosisView,
  Evidence,
  EvidenceDetail,
  Org,
  StreamRecord,
  VendorProfile,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v3"
).replace(/\/$/, "");

/** 서버가 오류 응답을 돌려준 경우 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 서버에 닿지 못한 경우(꺼져 있음, 주소 틀림, CORS) */
export class ApiUnreachable extends Error {}

async function request<T>(path: string, orgId: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (orgId) headers.set("X-Org-Id", orgId);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiUnreachable(`${API_BASE}에 연결하지 못했습니다.`);
  }
  if (!response.ok) {
    let code = String(response.status);
    let message = `요청이 실패했습니다 (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // 본문이 JSON이 아니면 기본 문구를 쓴다
    }
    throw new ApiError(response.status, code, message);
  }
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("json") ? await response.json() : await response.text()) as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const api = {
  listOrgs: () => request<Org[]>("/orgs", null),
  resetDemo: (orgId: string) => request<unknown>("/demo/reset", orgId, { method: "POST" }),

  listStreams: (orgId: string) => request<StreamRecord[]>(`/orgs/${enc(orgId)}/streams`, orgId),
  putStream: (orgId: string, stream: StreamRecord) =>
    request<StreamRecord>(`/orgs/${enc(orgId)}/streams/${enc(stream.id)}`, orgId, {
      method: "PUT",
      body: JSON.stringify(stream),
    }),

  getVendor: (orgId: string) => request<VendorProfile>(`/vendors/${enc(orgId)}`, orgId),
  putVendor: (orgId: string, profile: VendorProfile) =>
    request<VendorProfile>(`/vendors/${enc(orgId)}`, orgId, {
      method: "PUT",
      body: JSON.stringify(profile),
    }),

  createSession: (emitterOrgId: string) =>
    request<DiagnosisView>("/sessions", emitterOrgId, json({ emitterOrgId })),
  getView: (sessionId: string, orgId: string) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}`, orgId),
  run: (sessionId: string, orgId: string) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}/run`, orgId, { method: "POST" }),
  answer: (sessionId: string, orgId: string, questionId: string, value: string) =>
    request<DiagnosisView>(
      `/sessions/${enc(sessionId)}/answers`,
      orgId,
      json({ questionId, value }),
    ),
  approve: (sessionId: string, orgId: string, threadId: string) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}/approvals`, orgId, json({ threadId })),

  getEvidence: (id: string, orgId: string) =>
    request<EvidenceDetail>(`/evidence/${enc(id)}`, orgId),
  searchEvidence: (orgId: string, q: string, kind?: string) =>
    request<Evidence[]>(`/evidence?q=${enc(q)}${kind ? `&kind=${enc(kind)}` : ""}`, orgId),

  csvTemplateUrl: () => `${API_BASE}/intake/csv/template`,
  /** 본문 형식은 계약에 없다. multipart(file, orgId, streamId)로 보낸다. */
  uploadCsv: (orgId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("orgId", orgId);
    return request<unknown>("/intake/csv", orgId, { method: "POST", body: form });
  },
  uploadDocument: (orgId: string, file: File, documentKind: string, streamId?: string) => {
    const form = new FormData();
    form.set("file", file);
    form.set("orgId", orgId);
    form.set("kind", documentKind);
    if (streamId) form.set("streamId", streamId);
    return request<unknown>("/intake/documents", orgId, { method: "POST", body: form });
  },

  adminStatus: (orgId: string) => request<unknown>("/admin/status", orgId),
  adminEval: (orgId: string) => request<unknown>("/admin/eval", orgId, { method: "POST" }),
};
