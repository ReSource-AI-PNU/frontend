/**
 * 계약 8장 API 클라이언트. 요청하는 조직은 X-Org-Id 헤더로 밝힌다.
 * NEXT_PUBLIC_API_BASE가 /api/v3(프런트 서버의 통로, src/app/api/v3)면 로그인한 사용자만 부를 수 있고
 * 조직 토큰은 서버가 붙인다. 백엔드 주소를 직접 적으면 X-Org-Id만 가는 시연용 연결이다.
 */
import type {
  AdminStatus,
  CorrectionInput,
  CorrectionResult,
  CsvUploadResult,
  DiagnosisView,
  DocumentConfirmResult,
  DocumentKind,
  DocumentUploadResult,
  EvalResult,
  EvidenceDetail,
  EvidenceHit,
  ExtractedField,
  MediaUploadResult,
  Org,
  OutcomeInput,
  OutcomeResult,
  RetrainExport,
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
  /** 서버가 살아 있는지. 화면은 이것으로 "백엔드 연결"과 "예시 데이터"를 가른다. */
  health: () => request<{ ok: boolean }>("/health", null),
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
  /** value는 답(숫자·고른 값·글)이거나 "unknown"(모름)이다. */
  answer: (sessionId: string, orgId: string, questionId: string, value: string | number) =>
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
    request<EvidenceHit[]>(`/evidence?q=${enc(q)}${kind ? `&kind=${enc(kind)}` : ""}`, orgId),

  csvTemplateUrl: () => `${API_BASE}/intake/csv/template`,
  /** multipart(file, orgId). 흐름 이름이 같은 흐름에 측정값이 붙는다. */
  uploadCsv: (orgId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("orgId", orgId);
    return request<CsvUploadResult>("/intake/csv", orgId, { method: "POST", body: form });
  },
  /** multipart(file, orgId, kind). 뽑은 값은 confirmDocument로 확인한 것만 근거가 된다. */
  uploadDocument: (orgId: string, file: File, kind: DocumentKind) => {
    const form = new FormData();
    form.set("file", file);
    form.set("orgId", orgId);
    form.set("kind", kind);
    return request<DocumentUploadResult>("/intake/documents", orgId, { method: "POST", body: form });
  },
  /** 담당자가 확인한 추출값(confirmed: true)만 doc 근거로 등록된다. */
  confirmDocument: (orgId: string, documentName: string, fields: ExtractedField[]) =>
    request<DocumentConfirmResult>(
      "/intake/documents/confirm",
      orgId,
      json({ orgId, documentName, fields }),
    ),

  /**
   * multipart(file, orgId, streamId). 탐지 모델이 연결되지 않았으면 200으로 detectorUnavailable: true가 오고
   * 근거는 등록되지 않는다. 화면은 그 문장을 그대로 보여 주고 탐지 결과를 그리지 않는다.
   */
  uploadMedia: (orgId: string, streamId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("orgId", orgId);
    form.set("streamId", streamId);
    return request<MediaUploadResult>("/intake/media", orgId, { method: "POST", body: form });
  },

  /** 배출 기업 담당자가 고친 값을 기록한다. 기록만 남고 흐름의 값은 바뀌지 않는다. */
  recordCorrection: (sessionId: string, orgId: string, body: CorrectionInput) =>
    request<CorrectionResult>(`/sessions/${enc(sessionId)}/corrections`, orgId, json(body)),
  /** 업체가 확정된 대화의 실제 결과(등급·단가·중량·검수일)를 기록한다. */
  recordOutcome: (sessionId: string, orgId: string, body: OutcomeInput) =>
    request<OutcomeResult>(`/sessions/${enc(sessionId)}/outcomes`, orgId, json(body)),

  /** 아래 /admin/*은 관리자 조직(role이 admin)으로만 부른다. 다른 조직은 403 FORBIDDEN을 받는다. */
  adminStatus: (orgId: string) => request<AdminStatus>("/admin/status", orgId),
  adminEval: (orgId: string) => request<EvalResult>("/admin/eval", orgId, { method: "POST" }),
  retrainExport: (orgId: string) => request<RetrainExport>("/admin/retrain/export", orgId),
};
