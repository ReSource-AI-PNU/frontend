/**
 * 계약 8장 API 클라이언트.
 * 운영에서는 NEXT_PUBLIC_API_BASE=/api/v3(프런트 서버의 통로, src/app/api/v3)이고, 회사는 세션의 활성 회사로 서버가 정한다.
 * 체험하기(/demo 아래 화면)는 /api/v3-demo 통로를 부르고 GET만 지나간다.
 * 백엔드 주소를 직접 적으면(로컬 개발) X-Org-Id 머리글로 회사를 밝힌다.
 * 오류 문구는 사용자 말로 바꿔 던지고(src/lib/v3/errors.ts), 원인은 ApiError.code에 남긴다.
 */
import { syncMemberships } from "@/lib/server/company-actions";
import { UNAVAILABLE, userMessage } from "./errors";
import type {
  AdminStatus,
  CorrectionInput,
  CorrectionResult,
  CriteriaRowInput,
  CsvUploadResult,
  DiagnosisView,
  DocumentConfirmResult,
  DocumentKind,
  DocumentUploadResult,
  PermitCheckInput,
  EvalResult,
  EvidenceDetail,
  EvidenceHit,
  ExtractedField,
  MediaUploadResult,
  Org,
  OutcomeCorrection,
  OutcomeInput,
  OutcomeResult,
  QuoteRequest,
  Report,
  ScanList,
  ScanView,
  RetrainExport,
  RunStarted,
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

/** 화면을 새로 여는 중이면 그 까닭이 된 오류. 그동안 보내는 요청은 서버에 보내지 않고 같은 오류로 끝낸다(403을 거듭 받지 않게) */
let recovering: ApiError | null = null;

/**
 * 세션과 화면이 어긋났을 때 바로잡는다.
 *  - ORG_CHANGED: 다른 창에서 회사를 바꿨다 → 지금 세션의 회사로 다시 그린다
 *  - NOT_A_MEMBER: 회사에서 빠졌다 → 소속을 다시 읽고(서버 액션, 다음 화면에 안내를 적어 둔다) 찾기 화면으로 간다
 *    (남은 회사가 있으면 그 회사, 없으면 회사 등록)
 */
function recover(error: ApiError) {
  if (recovering || typeof window === "undefined" || inDemo()) return;
  if (error.code === "ORG_CHANGED") {
    recovering = error;
    window.location.reload();
  } else if (error.code === "NOT_A_MEMBER") {
    recovering = error;
    void syncMemberships()
      .catch(() => undefined)
      // 세션이 바뀌었으므로 화면 전체를 새로 받는다(클라이언트 이동으로는 서버가 세션을 다시 읽지 않는다)
      .finally(() => window.location.assign(new URL("/app", window.location.origin).href));
  }
}

/**
 * 회사를 밝히는 머리글. 통로를 거치면 서버가 세션으로 회사를 정하고, 화면이 보는 회사는 X-Expected-Org로 알려
 * 어긋나면 409를 받는다. 바로 부를 때(로컬 개발)만 X-Org-Id로 회사를 밝힌다.
 */
export function scopeHeaders(orgId: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (orgId) headers[VIA_PROXY ? "X-Expected-Org" : "X-Org-Id"] = orgId;
  if (inDemo()) headers["X-Demo-View"] = "1";
  return headers;
}

async function request<T>(path: string, orgId: string | null, init: RequestInit = {}): Promise<T> {
  if (recovering) throw new ApiError(recovering.status, recovering.code, recovering.message);
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(scopeHeaders(orgId))) headers.set(name, value);
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
    const error = new ApiError(response.status, code, userMessage(response.status, code, serverMessage));
    recover(error);
    throw error;
  }
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("json") ? await response.json() : await response.text()) as T;
}

/** 바이트로 받는 GET(보관장 3D 스캔의 점군). 오류는 request와 같은 방식으로 사용자 말로 바꾼다 */
async function requestBytes(path: string, orgId: string | null): Promise<ArrayBuffer> {
  if (recovering) throw new ApiError(recovering.status, recovering.code, recovering.message);
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { headers: scopeHeaders(orgId), cache: "no-store" });
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
    const error = new ApiError(response.status, code, userMessage(response.status, code, serverMessage));
    recover(error);
    throw error;
  }
  return response.arrayBuffer();
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

  /** 재활용·탄소 실적 리포트(배출 기업 본인만). 기간(YYYY-MM-DD)을 주지 않으면 모든 검수 기록이다. 읽기라서 체험하기에서도 열린다 */
  getReport: (orgId: string, from?: string | null, to?: string | null) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const tail = query.size > 0 ? `?${query.toString()}` : "";
    return request<Report>(`/orgs/${enc(orgId)}/report${tail}`, orgId);
  },

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
  /** 가입하지 않은 업체에 보낼 견적 요청서 초안. 읽기라서 체험하기에서도 열린다 */
  quoteRequest: (sessionId: string, orgId: string, streamId: string, vendorId: string) =>
    request<QuoteRequest>(
      `/sessions/${enc(sessionId)}/quote-request?streamId=${enc(streamId)}&vendorId=${enc(vendorId)}`,
      orgId,
    ),
  run: (sessionId: string, orgId: string) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}/run`, orgId, { method: "POST" }),
  /**
   * 실행을 뒤에서 돌린다(202 {sessionId, status, runId, after}). 진행은 streamUrl을 읽어 본다.
   * 이 방식을 모르는 서버는 쿼리를 무시하고 끝까지 돌린 진단 뷰를 돌려준다(그대로 쓴다).
   * 이미 돌고 있으면 409 RUN_IN_PROGRESS다.
   */
  runAsync: (sessionId: string, orgId: string) =>
    request<RunStarted | DiagnosisView>(`/sessions/${enc(sessionId)}/run?mode=async`, orgId, { method: "POST" }),
  /** 실시간 진행(SSE). 이어 받을 지점은 클라이언트가 ?after=와 Last-Event-ID로 붙인다 */
  streamUrl: (sessionId: string) => `${apiBase()}/sessions/${enc(sessionId)}/stream`,
  /** value는 답(숫자·고른 값·글)이거나 "unknown"(모름)이다. */
  answer: (sessionId: string, orgId: string, questionId: string, value: string | number) =>
    request<DiagnosisView>(
      `/sessions/${enc(sessionId)}/answers`,
      orgId,
      json({ questionId, value }),
    ),
  approve: (sessionId: string, orgId: string, threadId: string) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}/approvals`, orgId, json({ threadId })),
  /** 배출 기업 담당자가 업체가 올린 허가증 원문에서 품목과 처리 방법을 대조한 기록. 응답은 진단 뷰다 */
  recordPermitCheck: (sessionId: string, orgId: string, body: PermitCheckInput) =>
    request<DiagnosisView>(`/sessions/${enc(sessionId)}/permit-checks`, orgId, json(body)),

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
  /** 매입 기준표 검토 화면에서 담당자가 확인·고친 행을 저장한다. 틀린 줄이 있으면 422(몇 번째 줄의 무엇인지). */
  /** draftId는 올릴 때 받은 draft.id다. 직접 적은 줄만 저장하면 없다 */
  confirmCriteria: (orgId: string, documentName: string, rows: CriteriaRowInput[], draftId?: string) =>
    request<DocumentConfirmResult>("/intake/criteria/confirm", orgId, json({ orgId, documentName, rows, ...(draftId ? { draftId } : {}) })),

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

  /**
   * 보관장 3D 스캔(~/rs-work/scan/CONTRACT.md 3장). 브라우저가 영상에서 고른 장면 사진(frames 여러 개)을 올린다.
   * 진행 중인 ScanView가 온다(운영 202, 로컬 devserver 200. 둘 다 성공). 화면은 getScan으로 2초마다 다시 읽는다.
   * 재구성 서버에 닿지 않으면 503 SCAN_UNAVAILABLE, 장면이 모자라면 422 TOO_FEW_FRAMES.
   */
  uploadScan: (orgId: string, frames: Blob[], source: "video" | "photos", durationSec: number | null) => {
    const form = new FormData();
    form.set("orgId", orgId);
    form.set("source", source);
    if (durationSec !== null) form.set("durationSec", String(durationSec));
    frames.forEach((frame, index) => form.append("frames", frame, `f${String(index).padStart(3, "0")}.jpg`));
    return request<ScanView>("/intake/scan", orgId, { method: "POST", body: form });
  },
  /** 스캔 목록(최근 것이 먼저)과 지금 분석을 받을 수 있는지. 읽기라서 체험하기에서도 열린다 */
  listScans: (orgId: string) => request<ScanList>(`/orgs/${enc(orgId)}/scans`, orgId),
  /** 스캔 하나. 진행 중이면 서버가 이때 진행을 갱신한다 */
  getScan: (orgId: string, scanId: string) => request<ScanView>(`/orgs/${enc(orgId)}/scans/${enc(scanId)}`, orgId),
  /** 점군 바이트(RSPC). 진행 중이면 409 SCAN_NOT_READY */
  getScanPoints: (orgId: string, scanId: string) => requestBytes(`/orgs/${enc(orgId)}/scans/${enc(scanId)}/points`, orgId),
  /** 더미의 폐기물(streamId, null이면 지정 해제)이나 계량한 무게(weighedKg, null이면 지움)를 바꾼다. 계량값은 폐기물을 먼저 골라야 한다(422 STREAM_REQUIRED) */
  putScanPile: (orgId: string, scanId: string, pileId: string, body: { streamId?: string | null; weighedKg?: number | null }) =>
    request<ScanView>(`/orgs/${enc(orgId)}/scans/${enc(scanId)}/piles/${enc(pileId)}`, orgId, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  /** 상차 지점(바닥 좌표, m). null이면 영상을 찍기 시작한 곳으로 되돌린다 */
  putScanLayout: (orgId: string, scanId: string, pickup: { x: number; y: number } | null) =>
    request<ScanView>(`/orgs/${enc(orgId)}/scans/${enc(scanId)}/layout`, orgId, {
      method: "PUT",
      body: JSON.stringify({ pickup }),
    }),

  /** 배출 기업 담당자가 고친 값을 기록한다. 기록만 남고 흐름의 값은 바뀌지 않는다. */
  recordCorrection: (sessionId: string, orgId: string, body: CorrectionInput) =>
    request<CorrectionResult>(`/sessions/${enc(sessionId)}/corrections`, orgId, json(body)),
  /** 업체가 확정된 대화의 실제 결과(등급·단가·중량·검수일)를 기록한다. */
  /** 새 반입 한 건. 같은 requestId로 다시 보내면 서버가 한 건으로 묶는다 */
  recordOutcome: (sessionId: string, orgId: string, body: OutcomeInput) =>
    request<OutcomeResult>(`/sessions/${enc(sessionId)}/outcomes`, orgId, json(body)),
  /** 이미 기록한 검수 한 건의 정정(새 판). 앞 판은 이력으로 남는다 */
  correctOutcome: (sessionId: string, orgId: string, inspectionId: string, body: OutcomeCorrection) =>
    request<OutcomeResult>(`/sessions/${enc(sessionId)}/outcomes/${enc(inspectionId)}`, orgId, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  /** 공개 평가 결과(로그인 없이 읽는다). 모양은 src/lib/trust.ts가 읽는다 */
  trust: () => request<unknown>("/trust", null),

  /** 아래 /admin/*은 관리자 조직(role이 admin)으로만 부른다. 다른 조직은 403 FORBIDDEN을 받는다. */
  adminStatus: (orgId: string) => request<AdminStatus>("/admin/status", orgId),
  adminEval: (orgId: string) => request<EvalResult>("/admin/eval", orgId, { method: "POST" }),
  retrainExport: (orgId: string) => request<RetrainExport>("/admin/retrain/export", orgId),
};
