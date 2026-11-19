/**
 * 설계안 v3 화면 타입. 진단 뷰와 근거는 schema.ts(실제 백엔드 출력으로 검사한다)에서 끌어내고,
 * 도메인 레코드와 그 밖의 API 응답은 백엔드 docs/v3/CONTRACT.md 6·8장과 devserver의 실제 응답에 맞춰 적는다.
 */
import type { z } from "zod";
import type { FleetRecord } from "./fleet";
import type * as s from "./schema";

export type Evidence = z.infer<typeof s.evidenceSchema>;
export type EvidenceKind = Evidence["kind"];
export type EvidenceDetail = { evidence: Evidence; chain: Evidence[] };
export type EvidenceHit = { evidence: Evidence; score: number };

/** 숫자나 조항 하나. 값이 null이면 화면은 "확인 필요"를 보여 준다. */
export type Claim = z.infer<typeof s.claimSchema>;

export type OrgRole = z.infer<typeof s.orgRoleSchema>;
/** 시연용 가상 데이터면 synthetic이 true다. 운영 조직(org_admin)은 region·location이 null이다. */
export type Org = z.infer<typeof s.orgSchema>;
export type ClaimRole = z.infer<typeof s.claimRoleSchema>;

export type TriStatus = z.infer<typeof s.triStatusSchema>;
export type EdgeStatus = z.infer<typeof s.edgeStatusSchema>;
export type CheckStatus = z.infer<typeof s.checkStatusSchema>;
export type StageStatus = z.infer<typeof s.stageStatusSchema>;
export type SessionStatus = z.infer<typeof s.sessionStatusSchema>;
export type SessionPhase = z.infer<typeof s.sessionPhaseSchema>;
export type ThreadStatus = z.infer<typeof s.threadStatusSchema>;
export type ThreadOutcome = z.infer<typeof s.threadOutcomeSchema>;
export type MessageType = z.infer<typeof s.messageTypeSchema>;

export type Rejection = z.infer<typeof s.rejectionSchema>;
export type Validation = z.infer<typeof s.validationSchema>;
export type ModelRef = z.infer<typeof s.modelRefSchema>;
export type VendorModel = z.infer<typeof s.vendorModelSchema>;
export type ThreadMessage = z.infer<typeof s.threadMessageSchema>;
export type Thread = z.infer<typeof s.threadSchema>;
export type Stage = z.infer<typeof s.stageSchema>;
export type ViewStream = z.infer<typeof s.viewStreamSchema>;
export type GraphNode = z.infer<typeof s.graphNodeSchema>;
export type GraphEdge = z.infer<typeof s.graphEdgeSchema>;
export type Check = z.infer<typeof s.checkSchema>;
export type CheckKey = z.infer<typeof s.checkKeySchema>;
export type Assumption = Result["assumptions"][number];
export type CorrectionField = z.infer<typeof s.correctionFieldSchema>;
export type Correction = z.infer<typeof s.correctionSchema>;
export type Outcome = z.infer<typeof s.outcomeSchema>;
export type Assignment = z.infer<typeof s.assignmentSchema>;
export type ReferencePrice = z.infer<typeof s.referencePriceSchema>;
export type Result = z.infer<typeof s.resultSchema>;
export type OutsideVendors = z.infer<typeof s.outsideVendorsSchema>;
export type OutsideCandidate = z.infer<typeof s.outsideCandidateSchema>;
export type Billing = z.infer<typeof s.billingSchema>;
export type Regulation = z.infer<typeof s.regulationSchema>;
export type Improvement = z.infer<typeof s.improvementSchema>;
export type ImprovementActionKey = z.infer<typeof s.improvementActionKeySchema>;
export type Report = z.infer<typeof s.reportSchema>;
export type ReportRecord = z.infer<typeof s.reportRecordSchema>;
export type ReportPlanned = z.infer<typeof s.reportPlannedSchema>;
export type Question = z.infer<typeof s.questionSchema>;
export type Approval = z.infer<typeof s.approvalSchema>;
export type ViewDocument = z.infer<typeof s.viewDocumentSchema>;
export type RunEvent = z.infer<typeof s.runEventSchema>;
export type DiagnosisView = z.infer<typeof s.diagnosisViewSchema>;

/** GET /sessions: 내가 당사자인 찾기의 목록(최근 것이 앞) */
export type SessionSummary = {
  id: string;
  emitterOrgId: string;
  emitterName: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  as: "emitter" | "vendor" | "admin";
};

/** POST /sessions/{id}/run?mode=async (202). after는 이 실행이 남길 첫 진행 기록 바로 앞의 seq다 */
export type RunStarted = { sessionId: string; status: "running"; runId: string; after?: number };

/** 계약 6장 도메인 레코드 (GET/PUT /orgs/{id}/streams) */
export type StreamRecord = {
  id: string;
  orgId: string;
  name: string;
  process?: string | null;
  wasteItem?: string | null;
  material: string;
  origin: "PIR" | "PCR" | null;
  form: string | null;
  lot?: string | null;
  monthlyKg: number | null;
  monthlyKgBasis?: "measured" | "estimated" | null;
  monthlyKgEvidence?: string[];
  bulkDensityKgPerM3?: number | null;
  contaminants?: { name: string; ratio: number | null }[];
  measure?: {
    contaminationPct: number | null;
    moisturePct: number | null;
    measuredOn: string;
    evidence: string[];
  } | null;
  photo?: {
    contaminationPct: number | null;
    evidence: string[];
    /** 탐지 모델의 재질 추정. 수지 종류는 가르지 못해 흐름의 material은 바꾸지 않는다 */
    materialEstimate?: MaterialEstimate | null;
  } | null;
  currentTreatment?: {
    method: string;
    unitCostKrwPerKg: number | null;
    /** 지금 재활용 업체에 팔고 돈을 받는다. 그때 받는 kg당 금액이 salePriceKrwPerKg다 */
    sale?: boolean;
    salePriceKrwPerKg?: number | null;
    /** 회당·월 정액으로 적은 계약. 보내면 백엔드가 월 발생량으로 kg당 처리비를 다시 계산한다(unitCostKrwPerKg는 무시) */
    billing?: Billing | null;
    evidence: string[];
  } | null;
  /** 순비용 계산에 넣는 배출 기업만의 값. 업체에는 가지 않는다 */
  pretreatHoursPerMonth?: number | null;
  laborCostKrwPerHour?: number | null;
  reuse?: {
    virginPriceKrwPerKg: number;
    reusableKgPerMonth: number;
    regrindCostKrwPerKg?: number | null;
    evidence?: string[];
  } | null;
  synthetic?: boolean;
};

export type MaterialEstimate = {
  class: string;
  label: string;
  wasteItem: string | null;
  confidence: number | null;
  evidence: string[];
};

/**
 * POST /intake/media. 탐지 모델이 연결되지 않았으면 detectorUnavailable이 true이고 근거는 하나도 등록되지 않는다.
 * 연결된 경우의 모양은 계약 8장 "사진·영상"을 따른다(엔드포인트가 배포되지 않아 실제 응답으로는 확인하지 못했다).
 */
export type MediaUploadResult = {
  detectorUnavailable: boolean;
  message?: string;
  streamId: string;
  evidence: string[];
  filename?: string;
  mode?: string;
  framesAnalyzed?: number;
  tracksTotal?: number;
  model?: { name: string; version: string };
  material?: MaterialEstimate | null;
  contamination?: { claim: Claim | null; reliable: boolean; note?: string } | null;
  detections?: {
    id: string | number;
    label: string;
    kind: "item" | "contaminant";
    confidence: number | null;
    box?: number[];
    ratio?: number | null;
  }[];
  stream?: StreamRecord;
  note?: string;
};

/** POST /sessions/{id}/corrections */
export type CorrectionInput = {
  streamId: string;
  field: CorrectionField;
  before: string | number | null;
  after: string | number | null;
  note?: string;
};
export type CorrectionResult = { correction: Correction; evidence: string[] };

/** POST /sessions/{id}/outcomes. 실제 등급이나 실제 단가 가운데 하나는 있어야 한다 */
export type OutcomeInput = {
  threadId: string;
  streamId: string;
  actualGrade: string | null;
  actualUnitPriceKrwPerKg: number | null;
  actualKg: number | null;
  inspectedOn: string;
  note?: string;
};
export type OutcomeResult = { outcome: Outcome; evidence: string[] };

/** 업체가 고르는 모델 설정. 실제로 어떤 구현이 답했는지는 진단 뷰의 vendorModel에 따로 온다. */
export type ConfiguredModel = { provider: "foundry" | "ollama"; name: string };

export type VendorProfile = {
  orgId: string;
  name?: string;
  permits: { wasteItem: string; materials: string[]; evidence: string[] }[];
  criteria: {
    id: string;
    material: string;
    grade: string;
    form: string | null;
    maxContaminationPct: number | null;
    maxMoisturePct: number | null;
    /** 배출 기업이 받으면 양수(매입), 내면 음수(처리비) */
    unitPriceKrwPerKg: number | null;
    minMonthlyKg: number | null;
    /** 수거비: 단가에 포함 | 따로 받음. 매입 기준표 검토 화면에서 저장한 값이다 */
    collectionFee?: "included" | "separate" | null;
    evidence: string[];
  }[];
  /** 운반 조건. 업체 부담(수거 포함)이면 vendor, 배출 기업이 1회 운반비를 따로 내면 emitter */
  transport?: { paidBy: "vendor" | "emitter"; feePerPickupKrw?: number | null; evidence: string[] } | null;
  /** 노선·차량. 새 업체는 {}로 시작하고 칸마다 따로 채우므로 일부만 있을 수 있다(src/lib/v3/fleet.ts) */
  fleet: FleetRecord | null;
  guardrails: {
    floorPriceKrwPerKg: number | null;
    ceilingPriceKrwPerKg?: number | null;
    days: string[];
    minPickupsPerMonth: number | null;
    autoDecline: string[];
  };
  model: ConfiguredModel;
  synthetic?: boolean;
};

/** POST /intake/csv */
export type CsvUploadResult = {
  filename: string;
  encoding: string;
  accepted: number;
  errors: { row?: number; column?: string; message: string }[];
  /** 이름이 맞는 흐름이 없는 행 */
  unmatched: unknown[];
  evidence: string[];
  streamIds: string[];
};

export type DocumentKind = "permit" | "purchase_criteria" | "material_spec" | "msds" | "contract";

/** 문서에서 뽑은 값 하나. 담당자가 confirmed를 켠 것만 doc 근거로 등록된다. */
export type ExtractedField = {
  field: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  raw?: string | null;
  needsReview?: boolean;
  reviewReasons?: string[];
  confirmed: boolean;
  /** 어느 허가 품목·매입 기준의 값인지(백엔드가 정한다). 확인할 때 받은 그대로 돌려보낸다 */
  target?: Record<string, unknown> | null;
};

/** POST /intake/documents */
export type DocumentUploadResult = {
  kind: DocumentKind;
  filename: string;
  /** text_only면 Document Intelligence 없이 글 파일만 읽은 것이다 */
  extraction: string;
  shield?: { attackDetected: boolean; shieldUnavailable: boolean; note?: string } & Record<string, unknown>;
  shieldUnavailable: boolean;
  blocked: boolean;
  handoff: boolean;
  threadIds: string[];
  fields: ExtractedField[];
  extracted?: Record<string, unknown>;
  /** 매입 기준표를 AI가 읽은 행 단위 초안(POST /intake/criteria/confirm으로 저장하기 전에는 근거가 아니다) */
  draft?: CriteriaDraft;
  needsReview?: boolean;
  note?: string;
};

/** 초안의 칸 하나. raw는 문서에 적힌 글자, quote는 칸 밖(각주·문장)에서 왔을 때의 그 글, review는 확인 사유 */
type DraftCell = { raw: string | null; quote?: string | null; page?: number | null; common?: number | null; review: string[] };

export type CriteriaDraftRow = {
  id: string;
  /** 문서에 적힌 그 행(칸은 " | "로 나눔) */
  quote: string | null;
  page: number | null;
  material: { raw: string | null; value: string | null; review: string[] };
  form: { raw: string | null; value: string | null; review: string[] };
  grade: { raw: string | null; value: string | null; review: string[] };
  price: DraftCell & {
    /** kg당 원(양수). 범위·협의·단위 미상이면 null */
    amount: number | null;
    direction: "buy" | "fee" | null;
    unitRaw: string | null;
    unitQuote: string | null;
    unitPage: number | null;
    directionQuote: string | null;
    candidates: number[] | null;
    note: string | null;
  };
  minMonthlyKg: DraftCell & { value: number | null; unitRaw: string | null; per: string | null; note: string | null; perPickupKg?: number };
  maxContaminationPct: DraftCell & { value: number | null; note?: string | null };
  maxMoisturePct: DraftCell & { value: number | null; note?: string | null };
  collectionFee: DraftCell & { value: "included" | "separate" | null; feeText: string | null; feePerPickupKrw: number | null };
  review: string[];
  needsReview: boolean;
  ready: boolean;
};

export type CriteriaDraft = {
  /** ready 모두 읽음 | needs_review 일부 값이 애매함 | not_found 매입 조건 없음 | model_failed AI가 읽지 못함 */
  outcome: "ready" | "needs_review" | "not_found" | "model_failed";
  description?: string | null;
  rows: CriteriaDraftRow[];
  /** 표 밖에서 여러 행에 걸리는 조건(각주 등)과 적용되는 행 ID */
  common: { number: number | null; field: string | null; quote: string | null; page: number | null; rows: string[]; scope: string | null }[];
  notes: string[];
  reviewCount: number;
  reader?: { by: string; input?: string; pages?: number; pagesRead?: number };
  /** 화면 문장: 무엇이 안 됐는지와 다음 행동 */
  failure?: { code: string; message: string; action: string } | null;
};

/** POST /intake/criteria/confirm의 행 하나(단가는 매입 +, 처리비 −) */
export type CriteriaRowInput = {
  material: string;
  grade: string | null;
  form: string | null;
  unitPriceKrwPerKg: number;
  minMonthlyKg: number | null;
  maxContaminationPct: number | null;
  maxMoisturePct: number | null;
  collectionFee: "included" | "separate" | null;
  collectionFeePerPickupKrw: number | null;
  source: { quote: string | null; page: number | null; quotes: Record<string, string> };
  edited: string[];
  manual: boolean;
};

/** 업체가 확인한 허가증·매입 기준표 값이 업체 프로필에 들어간 요약(업체가 아니면 null) */
export type DocumentProfileSummary = {
  permitsAdded: number;
  permitsUpdated: number;
  criteriaAdded: number;
  criteriaUpdated: number;
  permits: VendorProfile["permits"];
  criteria: VendorProfile["criteria"];
  /** 넣지 못한 것과 까닭(예: 단가를 확인하지 않아 매입 기준을 만들지 않았습니다) */
  skipped: string[];
  /** 매입 기준표 검토 화면에서 저장할 때만: 수거비 조건으로 운반 조건을 바꿨는지 */
  transportUpdated?: boolean;
};

/** POST /intake/documents/confirm */
export type DocumentConfirmResult = { evidence: string[]; profile?: DocumentProfileSummary | null };

/** 배포 게이트 판정. 실제 등급 행으로 지금 기준값 규칙을 평가한 결과다 */
export type RetrainGate = {
  allowed: boolean;
  reason: string;
  minRealLabels: number;
  minAccuracy: number;
  realLabelCount: number;
  evaluated: { model: string; n: number; accuracy: number | null; label: string } | null;
};

/** GET /admin/status의 retrain(재학습 표) */
export type RetrainTable = {
  gradeLabels: { count: number; usable: number; incomplete: number; note: string };
  outcomes: { count: number };
  corrections: { count: number; byField: Record<string, number>; detectorCandidates: number };
  gate: RetrainGate;
  calibration: {
    count: number;
    autoApply: boolean;
    note: string;
    groups: {
      streamId: string;
      vendorOrgId: string;
      criterionId: string | null;
      count: number;
      items: {
        inspectedOn: string;
        sessionId: string;
        tablePrice: Claim | null;
        actualPrice: Claim | null;
        difference: Claim | null;
      }[];
    }[];
  };
  /** POST /admin/retrain/runs로 등록된 실행만. 없으면 빈 목록 */
  modelVersions: {
    model: string;
    version: string;
    runId?: string | null;
    trainedOn?: string | null;
    dataBasis?: string | null;
    realLabelCount?: number | null;
    syntheticCount?: number | null;
    metrics?: Record<string, unknown>;
    baseline?: Record<string, unknown>;
    gate?: { allowed: boolean; reason: string } | null;
    deployed?: boolean;
    registeredOn?: string | null;
  }[];
};

/** GET /admin/retrain/export */
export type RetrainExport = {
  gradeLabels: Record<string, unknown>[];
  detectionCorrections: Record<string, unknown>[];
  gate: RetrainGate;
};

/** GET /admin/status. 관리자 조직(org_admin)만 부를 수 있다 */
export type AdminStatus = {
  today: string;
  /** 요청한 조직을 정하는 방법. header는 X-Org-Id를 그대로 믿는 시연 전용 모드다(계약 8장 "요청한 조직") */
  auth?: { mode: "header" | "token" | "bff" | (string & {}); demoOnly: boolean };
  evidence: { visible: number; byKind: Record<string, number> };
  laws: { count: number; latestAsOf: string | null };
  references: { id: string; label: string; asOf: string }[];
  missingBasis: string[];
  models: { company: ModelRef; llmFactory: boolean };
  promptShields: { configured: boolean };
  documentIntelligence: { configured: boolean };
  gradeEndpoint: { configured: boolean };
  /** 탐지 모델(Azure ML 엔드포인트) 연결 여부 */
  detector?: { configured: boolean };
  distance: { provider: boolean };
  vendorGateway: string;
  store: string;
  retrain?: RetrainTable;
} & Record<string, unknown>;

/** 사례 세트 한 건의 결과 */
export type EvalCaseResult = {
  id: string;
  title: string;
  review: string;
  open: boolean;
  openNote?: string | null;
  tags?: string[];
  error?: string | null;
  verdictMatch: boolean;
  mismatches: unknown[];
  forbiddenViolations: unknown[];
  validator: { checked: number; passed: number; rewritten: number; handedOff: number; failed: Record<string, unknown> };
};

/** POST /admin/eval. 맨 위는 시연 시나리오 한 건, cases가 사례 세트(50건)의 결과다 */
export type EvalResult = {
  scenario: string;
  model: ModelRef;
  sessionStatus: SessionStatus;
  resultStatus: TriStatus | null;
  checked: number;
  passed: number;
  validatorPassRate: number | null;
  rewritten: number;
  threads: { vendorOrgId: string; vendorModel: VendorModel; status: ThreadStatus; types: MessageType[] }[];
  cases?: {
    model: ModelRef;
    summary: {
      caseCount: number;
      draftCount: number;
      reviewCounts: Record<string, number>;
      verdictMatched: number;
      verdictMatchRate: number | null;
      openCount: number;
      openCases: string[];
      validatorChecked: number;
      validatorPassed: number;
      validatorPassRate: number | null;
      rewritten?: number;
      handedOff?: number;
      forbiddenViolationCount: number;
      forbiddenClean: boolean;
      errorCount?: number;
    } & Record<string, unknown>;
    results: EvalCaseResult[];
  };
} & Record<string, unknown>;

/** 견적 요청서에 적은 값 하나와 그 출처. status: known(잰 값·담당자가 적은 값) · estimated(사진 추정·추정) · unknown(미확인) */
export type QuoteFact = {
  key: string;
  label: string;
  /** 본문에 들어간 글. 숫자는 {{claimId}} 자리표시자다. 모르면 null */
  value: string | null;
  basis: string;
  status: "known" | "estimated" | "unknown";
};

/** 후보를 찾은 뒤 바뀐 폐기물 칸 */
export type OutsideChange = { field: string; label: string; before: string; after: string };

/** 미리보기 조각(서버 split_text). 글자 조각과 claim의 display를 이으면 rendered와 같다 */
export type QuotePart =
  | { type: "text"; text: string }
  | { type: "claim"; claimId: string; display: string; evidence?: string[]; missing: boolean; kind?: string; value?: unknown; unit?: string | null };

/**
 * GET /sessions/{id}/quote-request: 가입하지 않은 업체에 보낼 견적 요청서 초안(저장하지 않음).
 * 업체에 연락하거나 견적을 확정하거나 한 달 손익을 바꾸지 않는다. 지금 자료로 그 업체가 후보가 아니면 409 OUTSIDE_STALE이다.
 */
export type QuoteRequest = {
  kind: "quote_request";
  title: string;
  streamId: string;
  vendorId: string;
  /** 시연 회사의 가상 자료. 본문 첫 줄에도 시연 표시가 있다 */
  demo: boolean;
  item: { name: string; material: string | null; form: string | null; monthlyKg: Claim | null };
  facts: QuoteFact[];
  /** 후보를 찾은 뒤 바뀌었지만 지금 자료로도 후보가 맞는 칸(요청서는 지금 자료로 만들었다) */
  changes: OutsideChange[];
  recipient: {
    id: string;
    name: string;
    business: string;
    address: string;
    phone: string | null;
    agency: string | null;
    asOf: string | null;
    evidence: string[];
  };
  text: string;
  claims: Claim[];
  rendered: string;
  parts: QuotePart[];
  validation: Validation;
};
