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
export type OutcomeRevision = z.infer<typeof s.outcomeRevisionSchema>;
export type Assignment = z.infer<typeof s.assignmentSchema>;
export type PermitLevel = z.infer<typeof s.permitLevelSchema>;
export type PermitCheck = z.infer<typeof s.permitCheckSchema>;
export type PermitDocument = z.infer<typeof s.permitDocumentSchema>;
export type BlockedRoute = z.infer<typeof s.blockedRouteSchema>;
/** 결과 한 줄의 수거 상태와 운반비 조건(2026-11-19) */
export type Pickup = z.infer<typeof s.pickupSchema>;
export type ReferencePrice = z.infer<typeof s.referencePriceSchema>;
export type Result = z.infer<typeof s.resultSchema>;
export type OutsideVendors = z.infer<typeof s.outsideVendorsSchema>;
export type OutsideCandidate = z.infer<typeof s.outsideCandidateSchema>;
export type ComplexPartners = z.infer<typeof s.complexPartnersSchema>;
export type ComplexCandidate = z.infer<typeof s.complexCandidateSchema>;
export type ComplexPlan = z.infer<typeof s.complexPlanSchema>;
export type Billing = z.infer<typeof s.billingSchema>;
export type Regulation = z.infer<typeof s.regulationSchema>;
export type Circular = z.infer<typeof s.circularSchema>;
export type CircularScenario = z.infer<typeof s.circularScenarioSchema>;
export type CircularRow = CircularScenario["rows"][number];
export type CircularMetric = CircularRow["ghg"];
export type CircularTotal = NonNullable<CircularScenario["totals"]["ghg"]>;
export type CircularRoute = z.infer<typeof s.circularRouteSchema>;
export type CircularSource = z.infer<typeof s.circularSourceSchema>;
export type Improvement = z.infer<typeof s.improvementSchema>;
export type ImprovementActionKey = z.infer<typeof s.improvementActionKeySchema>;
export type Report = z.infer<typeof s.reportSchema>;
export type OrgMemory = z.infer<typeof s.orgMemorySchema>;
export type MemoryStream = OrgMemory["streams"][number];
export type MemoryInspection = z.infer<typeof s.memoryInspectionSchema>;
export type ReportRecord = z.infer<typeof s.reportRecordSchema>;
export type ReportPlanned = z.infer<typeof s.reportPlannedSchema>;
export type CarbonBasis = z.infer<typeof s.carbonBasisSchema>;
export type CarbonScope = z.infer<typeof s.carbonScopeSchema>;
export type Question = z.infer<typeof s.questionSchema>;
export type Approval = z.infer<typeof s.approvalSchema>;
export type ContractReview = z.infer<typeof s.contractReviewSchema>;
export type ReviewItem = z.infer<typeof s.reviewItemSchema>;
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
    contaminationPct?: number | null;
    evidence?: string[];
    /** 탐지 모델이 검증 안 된 참고값이라고 표시했으면 false */
    reliable?: boolean;
    /** 탐지 모델의 재질 추정. 수지 종류는 가르지 못해 흐름의 material은 바꾸지 않는다 */
    materialEstimate?: MaterialEstimate | null;
    /** 사진 속 재질 표기(포대 라벨, 분리배출 표시)를 읽은 것. 담당자가 등록해야 재질이 된다 */
    labelMaterials?: LabelReading | null;
  } | null;
  /** 재질의 출처. label은 사진 속 표기를 담당자가 등록한 것이다 */
  materialBasis?: "label" | "estimated" | null;
  materialEvidence?: string[];
  /** PUT에만 쓴다. "label"이면 사진에서 읽은 표기의 재질로 등록하고 그 근거를 남긴다 */
  materialSource?: "label";
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
    recoveryYieldPct?: number | null;
    recoveryResidueCostKrwPerKg?: number | null;
    virginSubstitutionPct?: number | null;
    recoveryApplication?: string;
    recoveryEvidence?: string[];
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

/** 사진 속 재질 표기 하나. together는 같은 줄에 함께 적힌 다른 재질(복합 재질 표기)이다 */
export type LabelFound = {
  material: string;
  text: string;
  confidence: number | null;
  lowConfidence: boolean;
  together: string[];
};
/** 사진 속 재질 표기 읽기. suggestion은 재질 하나로 좁혀질 때만 온다. 글자를 읽지 못했으면 error가 온다 */
export type LabelReading = {
  found: LabelFound[];
  suggestion: string | null;
  evidence: string[];
  file?: string;
  error?: string;
};

/**
 * POST /intake/media. 탐지 서버(H100)가 연결되지 않았거나 꺼져 있으면 detectorUnavailable이 true이고(꺼져 있으면
 * detectorOffline도 true) 탐지 근거는 등록되지 않는다. 사진이면 재질 표기는 탐지와 따로 읽어 label에 온다.
 */
export type MediaUploadResult = {
  detectorUnavailable: boolean;
  /** 탐지 서버가 꺼져 있다(서비스하지 않을 때 끈다). 이 기능 전 응답에는 없다 */
  detectorOffline?: boolean;
  /** 사진 속 재질 표기. 영상이거나 읽을 수 없는 형식이면 null이다 */
  label?: LabelReading | null;
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

/** 검수 한 건의 값. 실제 등급이나 실제 단가 가운데 하나는 있어야 한다 */
export type OutcomeValues = {
  actualGrade: string | null;
  actualUnitPriceKrwPerKg: number | null;
  actualKg: number | null;
  inspectedOn: string;
  weighTicket?: string | null;
  note?: string;
  /** 업체가 실제로 적용한 처리 방식(재활용·열분해·소각·매립). null이면 처음 기록은 업체 정보대로, 정정은 앞 판대로 */
  actualProcess?: string | null;
};
/**
 * POST /sessions/{id}/outcomes: 새 반입 한 건. requestId는 등록 한 번마다 만들고, 응답을 받기 전에 다시 보낼 때는
 * 같은 번호를 쓴다(서버가 한 건으로 묶는다).
 */
export type OutcomeInput = OutcomeValues & { requestId: string; threadId: string; streamId: string };
/** PUT /sessions/{id}/outcomes/{inspectionId}: 이미 기록한 검수의 정정. baseRevision은 보고 고친 판 번호 */
export type OutcomeCorrection = OutcomeValues & { requestId: string; baseRevision: number; reason: string };
/** replayed가 참이면 같은 요청이 다시 간 것이라 서버가 새로 만들지 않고 이미 있는 기록을 돌려줬다 */
export type OutcomeResult = { outcome: Outcome; evidence: string[]; replayed: boolean };

/** 업체가 고르는 모델 설정. 실제로 어떤 구현이 답했는지는 진단 뷰의 vendorModel에 따로 온다. */
export type ConfiguredModel = { provider: "foundry" | "ollama"; name: string };

export type PermitCatalogItem = { code: string; name: string; wasteItem: string | null };
export type ManualPermitInput = { code?: string; wasteItem?: string; materials: string[] };
export type CriterionPriceMode = "fixed" | "negotiated";

export type VendorProfile = {
  process?: string | null;
  processEvidence?: string[];
  inspectionFallbackCriterionId?: string | null;
  orgId: string;
  name?: string;
  permits: { wasteItem: string; materials: string[]; evidence: string[]; entrySource?: "manual"; code?: string }[];
  criteria: {
    id: string;
    material: string;
    grade: string | null;
    form: string | null;
    priceMode?: CriterionPriceMode;
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
  /** 업체가 허가증을 올리면 "검토 대기" 문서로 남는다(배출 기업 담당자가 원문을 대조하기 전) */
  permitDocument?: PermitDocument;
};

/** POST /sessions/{id}/permit-checks 본문. 그 업체가 올린 허가증(documentId)의 원문 쪽에서 대조한 결과 */
export type PermitCheckInput = {
  streamId: string;
  vendorOrgId: string;
  documentId: string;
  page: number;
  itemFound: boolean;
  processFits: boolean;
  itemQuote?: string;
  processQuote?: string;
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
  /** 서버가 보관한 초안 ID(읽은 줄이 있을 때). 저장할 때 보내면 서버가 읽은 값·원문과 대조한다 */
  id?: string;
  /** ready 모두 읽음 | needs_review 일부 값이 애매함 | not_found 매입 조건 없음 | model_failed AI가 읽지 못함 */
  outcome: "ready" | "needs_review" | "not_found" | "model_failed";
  description?: string | null;
  rows: CriteriaDraftRow[];
  /** 표 밖에서 여러 행에 걸리는 조건(각주 등)과 적용되는 행 ID */
  common: { number: number | null; field: string | null; quote: string | null; page: number | null; rows: string[]; scope: string | null }[];
  notes: string[];
  reviewCount: number;
  /** by: ai(AI가 쪽 그림과 표 구조로 읽음) | rules(AI 없이 표 머리글로 읽음) */
  reader?: { by: string; input?: string; pages?: number; pagesRead?: number };
  /** 화면 문장: 무엇이 안 됐는지와 다음 행동 */
  failure?: { code: string; message: string; action: string } | null;
};

/** POST /intake/criteria/confirm의 행 하나(단가는 매입 +, 처리비 −) */
export type CriteriaRowInput = {
  /** 초안의 행 ID(r1…). 직접 더한 줄은 null. 서버는 이 행을 보관한 초안과 대조해 고친 값과 근거 원문을 정한다 */
  draftRow: string | null;
  material: string;
  grade: string | null;
  form: string | null;
  priceMode: CriterionPriceMode;
  unitPriceKrwPerKg: number | null;
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
  /** 시연(가상) 회사 사이의 등급 행. 게이트 판정과 평가에는 넣지 않는다 */
  demoLabelCount?: number;
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
  /** 시연(가상) 회사 사이에서 쌓인 기록. 수집 과정을 보이려고 세기만 하고 위 건수와 게이트에는 넣지 않는다 */
  demo?: { outcomes: number; gradeLabels: number; corrections: number; note: string };
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
  /** 실제 회사의 기록만. 재학습 작업은 이 둘만 읽는다 */
  gradeLabels: Record<string, unknown>[];
  detectionCorrections: Record<string, unknown>[];
  gate: RetrainGate;
  /** 시연(가상) 회사의 기록(synthetic=true, data_origin=demo). 학습에 쓰지 않는다 */
  demo?: { gradeLabels: Record<string, unknown>[]; detectionCorrections: Record<string, unknown>[]; note: string };
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

// 보관장 3D 스캔 (2026-11-20)
export type ScanView = z.infer<typeof s.scanViewSchema>;
export type ScanList = z.infer<typeof s.scanListSchema>;
export type ScanPile = z.infer<typeof s.scanPileSchema>;
export type ScanLayout = z.infer<typeof s.scanLayoutSchema>;
export type ScanLayoutMetrics = z.infer<typeof s.scanLayoutMetricsSchema>;
export type ScanStage = z.infer<typeof s.scanStageSchema>;

// 업체 정보 AI 도우미 (2026-11-22). 업체 측 AI가 공공 허가 명부와 담당자 대화로 업체 정보 초안을 채운다.
// 초안은 담당자가 고른 항목만 저장된다(POST /vendors/{orgId}/onboarding/confirm).
export type OnboardingSection = "permits" | "criteria" | "fleet" | "guardrails" | "process";
export type OnboardingMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  at: string | null;
  /** 이 답을 쓰며 AI가 한 일(예: 공공 허가 명부 조회). summary만 화면에 보인다 */
  tools: { name: string; summary: string }[];
};
export type OnboardingDraftItem = {
  key: string;
  section: OnboardingSection;
  label: string;
  value: unknown;
  /** 화면에 보일 값 한 줄 */
  text: string;
  /** registry: 공공 허가 명부, conversation: 담당자 답변, agent: 외부에 연결한 에이전트가 제출 */
  source: { kind: "registry" | "conversation" | "agent"; label: string; quote: string | null };
};
export type OnboardingCheck = { key: string; label: string; done: boolean; note: string };
export type OnboardingState = {
  orgId: string;
  /** 이 대화를 답한 구현. rule이면 모델 없이 정해 둔 안내 문장이다 */
  model: { provider: "ollama" | "foundry" | "anthropic" | "rule"; name: string } | null;
  messages: OnboardingMessage[];
  draft: OnboardingDraftItem[];
  checks: OnboardingCheck[];
  discoverable: boolean;
};
export type OnboardingConfirmResult = { profile: VendorProfile; onboarding: OnboardingState; keys?: string[] };
/** 외부 AI 에이전트 연결 키. 키 원문은 만든 응답(token)에만 한 번 온다 */
export type McpKey = { id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null };
export type McpKeyList = { path: string; limit: number; keys: McpKey[] };
export type McpKeyCreated = { path: string; key: McpKey; token: string };
