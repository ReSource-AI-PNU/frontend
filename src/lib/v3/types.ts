/** 설계안 v3 화면 타입. 백엔드 docs/v3/CONTRACT.md 6~8장과 같아야 한다. */

export type EvidenceKind =
  | "law"
  | "ref"
  | "doc"
  | "measure"
  | "model"
  | "human"
  | "calc"
  | "assumption";

export type Evidence = {
  id: string;
  kind: EvidenceKind;
  kindLabel: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  excerpt: string;
  source: string;
  asOf: string;
  validUntil: string | null;
  access: string[];
  version: number;
  meta: Record<string, unknown>;
};

export type EvidenceDetail = { evidence: Evidence; chain: Evidence[] };

/** 숫자나 조항 하나. 값이 null이면 화면은 "확인 필요"를 보여 준다. */
export type Claim = {
  id: string;
  kind: "number" | "clause";
  value: number | string | null;
  unit: string | null;
  evidence: string[];
};

export type OrgRole = "emitter" | "vendor" | "admin";
export type Org = {
  id: string;
  name: string;
  role: OrgRole;
  region?: string;
  location?: [number, number];
};

export type TriStatus = "calculated" | "conditional" | "needs_information";
export type EdgeStatus = "met" | "conditional" | "unmet";
export type StageStatus = "waiting" | "running" | "done" | "needs_check";
export type SessionStatus =
  | "idle"
  | "running"
  | "awaiting_answers"
  | "awaiting_approval"
  | "confirmed";
export type ThreadStatus = "not_opened" | "open" | "agreed" | "declined" | "handoff" | "confirmed";
export type MessageType =
  | "inquiry"
  | "question"
  | "answer"
  | "offer"
  | "counter"
  | "conditional"
  | "decline"
  | "handoff"
  | "confirm";

export type Rejection = { code: string; message: string; claimId?: string | null };
export type Validation = { ok: boolean; attempts?: number; rejections?: Rejection[] };

export type ThreadMessage = {
  id: string;
  seq: number;
  from: string;
  to: string;
  type: MessageType;
  stage: number;
  streamIds: string[];
  text: string;
  claims: Claim[];
  validation: Validation;
  createdAt: string;
};

export type VendorModel = { provider: "foundry" | "ollama"; name: string };

export type Thread = {
  id: string;
  vendorOrgId: string;
  vendorName: string;
  vendorModel: VendorModel;
  status: ThreadStatus;
  statusReason: string | null;
  reasonEvidence: string[];
  streamIds: string[];
  turns: number;
  maxTurns: number;
  messages: ThreadMessage[];
};

export type Stage = { stage: number; key: string; label: string; status: StageStatus };

export type ViewStream = {
  id: string;
  name: string;
  material: string;
  origin: "PIR" | "PCR" | null;
  form: string | null;
  monthlyKg: Claim | null;
  grade: { value: string; basis: "measured" | "photo_estimate"; evidence: string[] } | null;
  currentTreatment: { method: string; unitCost: Claim | null; assumed: boolean } | null;
};

export type GraphNode = {
  id: string;
  type: "stream" | "criterion" | "vendor" | "evidence";
  label: string;
};
export type GraphEdge = {
  from: string;
  to: string;
  status: EdgeStatus;
  label: string;
  evidence: string[];
};

export type Check = {
  key: string;
  status: EdgeStatus;
  text: string;
  ask: string | null;
  evidence: string[];
};

export type Assignment = {
  streamId: string;
  vendorOrgId: string | null;
  route: string | null;
  status: TriStatus;
  unitPrice: Claim | null;
  monthlyAfter: Claim | null;
  monthlyNow: Claim | null;
  difference: Claim | null;
  carbon: Claim | null;
  checks: Check[];
  alternatives: {
    vendorOrgId: string | null;
    route: string;
    monthlyAfter: Claim | null;
    note: string;
  }[];
};

export type Result = {
  status: TriStatus;
  assignments: Assignment[];
  totals: {
    monthlyNow: Claim | null;
    monthlyAfter: Claim | null;
    difference: Claim | null;
    carbon: Claim | null;
  };
  assumptions: string[];
  sensitivity: { label: string; difference: Claim | null }[];
};

export type Question = {
  id: string;
  batch: number;
  streamId: string;
  field: string;
  text: string;
  answered: boolean;
};

export type Approval = {
  threadId: string;
  emitter: boolean;
  vendor: boolean;
  blocked: boolean;
  blockedReason: string | null;
};

export type ViewDocument = {
  id: string;
  kind: "request" | "plan";
  title: string;
  text: string;
  claims: Claim[];
  validation: Validation;
};

export type RunEvent = {
  seq: number;
  at: string;
  actor: "company_agent" | "vendor_agent" | "validator" | "tool" | "system";
  kind: "message" | "tool_call" | "validation" | "handoff" | "approval";
  threadId: string | null;
  summary: string;
  detail: Record<string, unknown>;
};

export type DiagnosisView = {
  session: { id: string; emitterOrgId: string; status: SessionStatus; version: number };
  viewer: { orgId: string; role: OrgRole };
  stages: Stage[];
  streams: ViewStream[];
  threads: Thread[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  result: Result | null;
  questions: Question[];
  approvals: Approval[];
  documents: ViewDocument[];
  events: RunEvent[];
};

/** 계약 6장 도메인 레코드 */
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
  bulkDensityKgPerM3?: number | null;
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
};

export type VendorProfile = {
  orgId: string;
  permits: { wasteItem: string; materials: string[]; evidence: string[] }[];
  criteria: {
    id: string;
    material: string;
    grade: string;
    form: string | null;
    maxContaminationPct: number | null;
    maxMoisturePct: number | null;
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
    days: string[];
    minPickupsPerMonth: number | null;
    autoDecline: string[];
  };
  model: VendorModel;
};
