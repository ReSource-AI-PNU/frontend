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
export type Org = {
  id: string;
  name: string;
  role: OrgRole;
  region?: string;
  location?: [number, number];
  /** 시연용 가상 데이터면 true */
  synthetic?: boolean;
  note?: string;
};

export type TriStatus = z.infer<typeof s.triStatusSchema>;
export type EdgeStatus = z.infer<typeof s.edgeStatusSchema>;
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
  photo?: { contaminationPct: number | null; evidence: string[] } | null;
  currentTreatment?: {
    method: string;
    unitCostKrwPerKg: number | null;
    evidence: string[];
  } | null;
  synthetic?: boolean;
};

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

/** GET /admin/status */
export type AdminStatus = {
  today: string;
  evidence: { visible: number; byKind: Record<string, number> };
  laws: { count: number; latestAsOf: string | null };
  references: { id: string; label: string; asOf: string }[];
  missingBasis: string[];
  models: { company: ModelRef; llmFactory: boolean };
  promptShields: { configured: boolean };
  documentIntelligence: { configured: boolean };
  gradeEndpoint: { configured: boolean };
  distance: { provider: boolean };
  vendorGateway: string;
  store: string;
} & Record<string, unknown>;

/** POST /admin/eval */
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
} & Record<string, unknown>;
