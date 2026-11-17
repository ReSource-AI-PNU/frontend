/**
 * 계약 8장 API 클라이언트.
 * 운영에서는 NEXT_PUBLIC_API_BASE=/api/v3(프런트 서버의 통로, src/app/api/v3)이고, 회사는 세션의 활성 회사로 서버가 정한다.
 * 체험하기(/demo 아래 화면)는 /api/v3-demo 통로를 부르고 GET만 지나간다.
 * 백엔드 주소를 직접 적으면(로컬 개발) X-Org-Id 머리글로 회사를 밝힌다.
 * 오류 문구는 사용자 말로 바꿔 던지고(src/lib/v3/errors.ts), 원인은 ApiError.code에 남긴다.
 */
import { refreshMemberships } from "@/lib/server/company-actions";
import { UNAVAILABLE, userMessage } from "./errors";
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
  SessionSummary,
  StreamRecord,
  VendorProfile,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v3"
).replace(/\/$/, "");

/** 프런트 서버의 통로를 거치는지(상대 주소). 아니면 브라우저가 백엔드를 바로 부르는 로컬 개발이다. */
const VIA_PROXY = API_BASE.startsWith("/");

/** 체험하기 화면(/demo 아래)인지. 주소로만 정하므로 화면과 통로가 어긋나지 않는다. */
export function inDemo(): boolean {
  return typeof window !== "undefined" && /^\/demo(\/|$)/.test(window.location.pathname);
}

/** 지금 화면이 부를 주소. 체험하기는 읽기 전용 통로(/api/v3-demo)를 쓴다. */
export function apiBase(): string {
  return inDemo() && VIA_PROXY ? "/api/v3-demo" : API_BASE;
}

/** 서버가 오류 응답을 돌려준 경우. message는 화면에 그대로 보여도 되는 문장이다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 서버에 닿지 못한 경우(꺼져 있음, 주소 틀림, 네트워크) */
export class ApiUnreachable extends Error {}

let recovering = false;

/**
 * 세션과 화면이 어긋났을 때 바로잡는다.
 *  - ORG_CHANGED: 다른 창에서 회사를 바꿨다 → 지금 세션의 회사로 다시 그린다
 *  - NOT_A_MEMBER: 회사에서 빠졌다 → 소속을 다시 읽고(서버 액션) 찾기 화면으로 간다(소속이 없으면 회사 등록)
 */
function recover(code: string) {
  if (recovering || typeof window === "undefined" || inDemo()) return;
  if (code === "ORG_CHANGED") {
    recovering = true;
    window.location.reload();
  } else if (code === "NOT_A_MEMBER") {
    recovering = true;
    void refreshMemberships()
      .catch(() => undefined)
      // 세션이 바뀌었으므로 화면 전체를 새로 받는다(클라이언트 이동으로는 서버가 세션을 다시 읽지 않는다)
      .finally(() => window.location.assign(new URL("/app", window.location.origin).href));
  }
}

async function request<T>(path: string, orgId: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // 통로를 거치면 서버가 세션으로 회사를 정한다. 화면이 보는 회사는 X-Expected-Org로 알려 어긋나면 409를 받는다.
  // 바로 부를 때(로컬 개발)만 X-Org-Id로 회사를 밝힌다
  if (orgId) headers.set(VIA_PROXY ? "X-Expected-Org" : "X-Org-Id", orgId);
  if (inDemo()) headers.set("X-Demo-View", "1");
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiUnreachable(UNAVAILABLE);
  }
  if (!response.ok) {
    let code = String(response.status);
    let serverMessage: string | null = null;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) serverMessage = body.error.message;
    } catch {
      // 본문이 JSON이 아니면 상태 코드로만 문구를 고른다
    }
    recover(code);
    throw new ApiError(response.status, code, userMessage(response.status, code, serverMessage));
  }
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("json") ? await response.json() : await response.text()) as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const api = {
  /** 서버가 살아 있는지 */
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

  /** 내가 당사자인 찾기 목록. 다른 기기에서 들어와도 이어 볼 수 있게 한다. */
  listSessions: (orgId: string) => request<SessionSummary[]>("/sessions", orgId),
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

  csvTemplateUrl: () => `${apiBase()}/intake/csv/template`,
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
