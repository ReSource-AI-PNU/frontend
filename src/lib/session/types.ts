/**
 * 세션 데이터 계약. 백엔드 be#1(app/schemas.py)의 6단계 Result 모델과 같은 모양으로 맞춘다.
 * 지금은 src/lib/server/mock/*가 이 타입을 만들어 낸다.
 */
import type { CompanyRole, WasteItem } from "@/lib/domain";

export type FlowStep = "classify" | "feasibility" | "regulation" | "matching" | "cost-carbon" | "proposal";

export const FLOW_STEPS: { slug: FlowStep; no: number; label: string; agent: string }[] = [
  { slug: "classify", no: 2, label: "식별 결과", agent: "① 식별·분류" },
  { slug: "feasibility", no: 3, label: "판정", agent: "② 가능성 판단" },
  { slug: "regulation", no: 4, label: "규정 검토", agent: "③ 규정 검토" },
  { slug: "matching", no: 5, label: "묶음 수거 매칭", agent: "④ 기업 탐색·묶음" },
  { slug: "cost-carbon", no: 6, label: "비용·탄소 비교", agent: "⑤ 비용·탄소" },
  { slug: "proposal", no: 7, label: "최적안·승인", agent: "⑥ 최적안 제안" },
];

export type SessionStatus = "analyzing" | "in-progress" | "awaiting-approval" | "sent" | "completed";

/** 좌표는 사진 크기에 대한 비율(0~1): [x, y, w, h] */
export type Box = [number, number, number, number];

export type Media = {
  id: string;
  kind: "image" | "video" | "pdf" | "sample";
  name: string;
  url: string;
  size?: number;
};

export type Detection = {
  id: string;
  label: string;
  kind: "item" | "contaminant";
  confidence: number;
  box: Box;
  /** 형광펜(ai) / 먹(human). DESIGN.md "사람과 AI의 표시 구분" */
  source: "ai" | "human";
  /** 사람이 고쳤으면 AI 원래 값 */
  original?: { label: string; box: Box; ratio?: number };
  ratio?: number;
  removed?: boolean;
};

export type Question = {
  id: string;
  step: FlowStep;
  text: string;
  why: string;
  kind: "number" | "choice";
  unit?: string;
  options?: string[];
  suggested?: string;
  answer?: string;
};

export type ClassifyResult = {
  item: WasteItem;
  detail: string;
  confidence: number;
  estimatedKg: number;
  frames: number;
  detections: Detection[];
  model: { name: string; version: string };
  durationMs: number;
};

export type Verdict = "reuse" | "recycle" | "dispose";

export type Reason = { text: string; source: string; knowledgeCardId?: string };

export type FeasibilityResult = {
  verdict: Verdict;
  currentPerKg: number;
  afterPerKg: number;
  /** 작업 단계별 kg당 손익 (차트) */
  ladder: { label: string; perKg: number }[];
  action: { title: string; laborHours: number; laborCost: number; benefit: number; net: number };
  note: string;
  reasons: Reason[];
};

export type RegulationItem = {
  id: string;
  label: string;
  status: "ok" | "no" | "ask";
  result: string;
  citation: string;
  excerpt: string;
};

export type RegulationResult = {
  items: RegulationItem[];
  conclusion: { tone: "gain" | "warn" | "loss"; text: string };
};

export type MatchingMember = { companyId: string; name: string; kg: number; distanceM: number; isSelf?: boolean };

export type MatchingResult = {
  complexId: string;
  selfLocation: [number, number];
  minKg: number;
  soloFeasible: boolean;
  group: MatchingMember[];
  totalKg: number;
  collector: { companyId: string; name: string; distanceM: number; permits: WasteItem[] };
  excluded: { companyId: string; name: string; reason: string }[];
  schedule: string;
  costShare: { companyId: string; name: string; sharePct: number }[];
};

export type Route = {
  id: "A" | "B" | "C" | "D";
  name: string;
  description: string;
  monthlyKrw: number;
  carbonT: number;
  kauKrw: number;
  condition: string;
  recommended?: boolean;
};

export type CostCarbonResult = {
  routes: Route[];
  assumptions: { label: string; value: string }[];
  baseline: "신재 대비" | "매립 대비";
};

export type DocumentDraft = {
  id: string;
  kind: "quote" | "handover" | "joint";
  title: string;
  to: string;
  fields: { label: string; value: string }[];
  body: string;
};

export type ProposalResult = {
  recommended: Route["id"];
  alternatives: Route["id"][];
  summary: string;
  documents: DocumentDraft[];
};

export type Approval = {
  approvedBy: string;
  approvedAt: string;
  routeId: Route["id"];
  sentTo: { name: string; kind: string }[];
};

export type Outcome = {
  recordedAt: string;
  recordedBy: string;
  recorderRole: CompanyRole | "담당자";
  accepted: boolean;
  actualGrade: string;
  actualPerKg: number;
  actualKg: number;
  reason?: string;
};

export type Correction = {
  id: string;
  at: string;
  by: string;
  step: FlowStep;
  field: string;
  before: string;
  after: string;
  /** 판단이 갈린 이유. 현장 지식 카드로 승격될 수 있다 */
  rationale?: string;
  knowledgeCardId?: string;
};

export type Session = {
  id: string;
  orgId: string;
  ownerId: string;
  complexId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  /** 사용자가 마지막으로 연 단계 */
  step: FlowStep;
  media: Media[];
  questions: Question[];
  classify: ClassifyResult;
  feasibility?: FeasibilityResult;
  regulation?: RegulationResult;
  matching?: MatchingResult;
  costCarbon?: CostCarbonResult;
  proposal?: ProposalResult;
  selectedRoute?: Route["id"];
  approval?: Approval;
  outcome?: Outcome;
  corrections: Correction[];
};

export type KnowledgeStatus = "proposed" | "reviewing" | "adopted" | "rejected";

/** 암묵지: 현장 숙련자의 판단 기준. 조건 → 판단 → 근거 */
export type KnowledgeCard = {
  id: string;
  item: WasteItem;
  condition: string;
  judgment: string;
  rationale: string;
  step: FlowStep;
  author: string;
  orgName: string;
  createdAt: string;
  status: KnowledgeStatus;
  agrees: string[];
  sourceSessionId?: string;
  /** 이 카드가 근거로 쓰인 판정 수 */
  citedCount: number;
};

export type LabelTask = {
  id: string;
  sessionId: string;
  kind: "box" | "ratio" | "grade" | "outcome";
  title: string;
  before: string;
  after: string;
  source: "현장 수정" | "업체 실제 결과";
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
  reviewer?: string;
};

export type ModelVersion = {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  datasetVersion: string;
  status: "production" | "candidate" | "archived" | "training";
  metrics: { mAP50: number; contaminationMae: number; verdictAgreement: number; latencyMs: number };
};

export type TrainingRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  datasetVersion: string;
  baseModel: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  resultModelId?: string;
  triggeredBy: string;
};

export type DatasetVersion = {
  id: string;
  createdAt: string;
  images: number;
  newLabels: number;
  fromCorrections: number;
  fromOutcomes: number;
  note: string;
};

export type Member = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: "관리자" | "승인권자" | "담당자";
  status: "active" | "invited";
  invitedAt: string;
};

export type OutboxMessage = {
  id: string;
  sessionId: string;
  orgId: string;
  fromOrg: string;
  toCompanyId: string;
  toName: string;
  kind: "quote" | "bundle-invite";
  subject: string;
  sentAt: string;
  status: "sent" | "read" | "replied" | "completed";
};
