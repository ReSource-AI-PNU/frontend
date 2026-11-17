/**
 * 설계안 v3 화면 타입. 진단 뷰와 근거는 schema.ts(실제 백엔드 출력으로 검사한다)에서 끌어내고,
 * 도메인 레코드와 그 밖의 API 응답은 백엔드 docs/v3/CONTRACT.md 6·8장과 devserver의 실제 응답에 맞춰 적는다.
 */
import type { z } from "zod";
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
export type Question = z.infer<typeof s.questionSchema>;
export type Approval = z.infer<typeof s.approvalSchema>;
export type ViewDocument = z.infer<typeof s.viewDocumentSchema>;
export type RunEvent = z.infer<typeof s.runEventSchema>;
export type DiagnosisView = z.infer<typeof s.diagnosisViewSchema>;

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
    evidence: string[];
  }[];
  fleet: {
    depot: [number, number];
    capacityKg: number;
    capacityM3: number;
    costPerKm: number;
    evidence: string[];
  } | null;
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
  needsReview?: boolean;
  note?: string;
};

/** POST /intake/documents/confirm */
export type DocumentConfirmResult = { evidence: string[] };

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
  auth?: { mode: "header" | "token"; demoOnly: boolean };
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
