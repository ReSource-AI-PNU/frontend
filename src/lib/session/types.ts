/**
 * 진단 세션 데이터 계약. 백엔드 be#1(app/schemas.py)의 6단계 Result 모델과 같은 모양으로 맞춘다.
 * 문제 정의 v2: 단위는 "사진 한 장"이 아니라 "공장의 폐플라스틱 흐름(Stream) 여러 개"다.
 * 지금은 src/lib/server/mock/*가 이 타입을 만들어 낸다.
 */
import type { CompanyRole, WasteItem } from "@/lib/domain";

export type FlowStep = "classify" | "feasibility" | "regulation" | "matching" | "cost-carbon" | "proposal";

export const FLOW_STEPS: { slug: FlowStep; no: number; label: string; agent: string }[] = [
  { slug: "classify", no: 2, label: "흐름 식별", agent: "① 식별·분류" },
  { slug: "feasibility", no: 3, label: "경로 판정", agent: "② 가능성 판단" },
  { slug: "regulation", no: 4, label: "규정 검토", agent: "③ 규정 검토" },
  { slug: "matching", no: 5, label: "업체·묶음 매칭", agent: "④ 업종·기업 탐색" },
  { slug: "cost-carbon", no: 6, label: "비용·탄소 비교", agent: "⑤ 비용·탄소" },
  { slug: "proposal", no: 7, label: "이행안·승인", agent: "⑥ 최적안 제안" },
];

export type SessionStatus = "analyzing" | "in-progress" | "awaiting-approval" | "sent" | "completed";

/** 좌표는 사진 크기에 대한 비율(0~1): [x, y, w, h] */
export type Box = [number, number, number, number];

export type Media = {
  id: string;
  /** sample이면 url은 "sample:<variant>" (시연용 일러스트) */
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
  /** 흐름별 질문이면 흐름 id */
  streamId?: string;
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
  /** 예: "PP 사출 스프루·러너" */
  detail: string;
  /** 예: "PP", "PP+ABS", "LDPE" */
  material: string;
  singleMaterial: boolean;
  confidence: number;
  estimatedKg: number;
  frames: number;
  detections: Detection[];
  model: { name: string; version: string };
  durationMs: number;
};

/**
 * 흐름의 출처. PIR = 공정 부산물(스프루, 불량품, 퍼지), PCR = 공장이 쓰고 버린 포장재(스트레치 필름, 마대).
 * 재생원료 사용 의무(국내 페트 고시, EU PPWR·ELV)는 PCR만 인정한다. 공장 포장재의 PCR 인정은 해석 확인이 필요하다.
 */
export type StreamOrigin = "PIR" | "PCR";

export type Stream = {
  id: string;
  /** 예: "스프루·러너" */
  name: string;
  /** 예: "사출 2라인" */
  process: string;
  media: Media[];
  classify: ClassifyResult;
  origin: StreamOrigin;
  originSource: "ai" | "human";
  monthlyKg: number;
  monthlyKgConfirmed: boolean;
};

/** 흐름별 갈 곳: 공정 재투입 / 매각 / 단지 내 묶음 매각 / 열분해 / 소각 불가피 */
export type StreamRoute = "reuse" | "sell" | "bundle" | "pyrolysis" | "incinerate";

export const STREAM_ROUTE_LABEL: Record<StreamRoute, string> = {
  reuse: "공정 재투입",
  sell: "매각",
  bundle: "단지 묶음 매각",
  pyrolysis: "열분해",
  incinerate: "소각",
};

export type Reason = { text: string; source: string; knowledgeCardId?: string };

export type StreamDecision = {
  streamId: string;
  route: StreamRoute;
  /** 이 경로를 고른 이유 한 문장 */
  reason: string;
  /** 현행(혼합 소각) kg당 손익. 처리비라 음수 */
  currentPerKg: number;
  /** 추천 경로 kg당 손익. 재투입이면 신재 대체 가치 */
  afterPerKg: number;
  monthlyNow: number;
  monthlyAfter: number;
  carbonNowT: number;
  carbonAfterT: number;
  /** 경로에 필요한 현장 작업 (없으면 생략) */
  action?: { title: string; laborHours: number; laborCost: number };
  /** 작업 단계별 kg당 손익 (차트) */
  ladder: { label: string; perKg: number }[];
  /** 고르지 않은 다른 경로와 그 이유 */
  alternatives: { route: StreamRoute; perKg: number; note: string }[];
  /** 경로를 사람이 바꿨으면 AI 원래 경로 */
  aiRoute?: StreamRoute;
};

export type FeasibilityResult = {
  decisions: StreamDecision[];
  /** 공장 월 손익: 현행 전부 소각 → 흐름별 최적안 */
  totalNow: number;
  totalAfter: number;
  carbonNowT: number;
  carbonAfterT: number;
  reasons: Reason[];
  note: string;
};

export type RegulationItem = {
  id: string;
  /** 특정 흐름에 대한 항목이면 흐름 id */
  streamId?: string;
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

/** 묶음 매각 흐름 하나에 대한 순회 수거 그룹 */
export type BundleGroup = {
  streamId: string;
  /** 기본값 순회 수거: 각 회사가 같은 허가 업체와 따로 계약하고, 업체가 사업장을 차례로 돈다(공동 보관 금지) */
  mode: "순회 수거" | "공동처리";
  item: WasteItem;
  /** 업체가 한 번 출장할 만한 물량(품목별 가정값) */
  minKg: number;
  /** 수거 차량 적재량(kg) */
  truckKg: number;
  /** 묶음 합계 / 트럭 적재량 */
  fillRate: number;
  soloFillRate: number;
  group: MatchingMember[];
  totalKg: number;
  collector: { companyId: string; name: string; distanceM: number; permits: WasteItem[] };
  excluded: { companyId: string; name: string; reason: string }[];
  schedule: string;
  costShare: { companyId: string; name: string; sharePct: number }[];
  /** 수거 업체가 출발해 도는 사업장 순서(그룹 기업 id). 업체 위치에서 시작해 가장 가까운 곳부터 돈다 */
  visitOrder?: string[];
  /** 수거 업체 출발 → 순회 → 복귀까지의 거리(m). 직선거리에 도로 계수 1.3을 곱한 가정값 */
  routeM?: number;
};

/** 묶음이 아닌 흐름의 거래처(매각처·열분해 업체). 재투입·소각은 거래처가 없다 */
export type StreamPartner = {
  streamId: string;
  route: StreamRoute;
  companyId?: string;
  name: string;
  distanceM: number;
  /** 단지 밖 업체면 위치 설명 */
  location: string;
  note: string;
};

export type MatchingResult = {
  complexId: string;
  selfLocation: [number, number];
  bundles: BundleGroup[];
  partners: StreamPartner[];
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
  /** 흐름별 내역 */
  breakdown: { streamId: string; route: StreamRoute; monthlyKrw: number; carbonT: number }[];
};

export type CostCarbonResult = {
  routes: Route[];
  assumptions: { label: string; value: string }[];
  baseline: "신재 대비" | "매립 대비";
};

/**
 * plan = 공장 이행 계획서, grant = 정부 지원사업 신청 초안, pickup = 순회 수거 요청서,
 * quote = 매각 견적 요청서, joint = 공동처리 신고서 초안(선택)
 */
export type DocumentKind = "plan" | "grant" | "pickup" | "quote" | "joint";

export type DocumentDraft = {
  id: string;
  kind: DocumentKind;
  title: string;
  to: string;
  fields: { label: string; value: string }[];
  body: string;
  /** 외부로 보내는 서류인가(승인 게이트 대상) */
  external: boolean;
  optional?: boolean;
  streamId?: string;
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
  /** 어느 흐름의 실제 결과인가 (주로 묶음·매각 흐름) */
  streamId?: string;
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
  streamId?: string;
  field: string;
  before: string;
  after: string;
  /** 판단이 갈린 이유. 현장 지식 카드로 승격될 수 있다 */
  rationale?: string;
  knowledgeCardId?: string;
};

/**
 * 재생원료 여권. 수거한 원료 한 묶음(흐름 하나의 한 번 수거)의 출처·재질·중량·근거를 서명된 이력으로 남긴다.
 * 마대 라벨의 QR로 열어, 매입처나 원청이 재생원료 사용 실적에 넣을 수 있는 원료인지 확인한다.
 * hash는 여권 내용과 앞 여권의 hash를 이어 붙여 만든 SHA-256이다(위·변조 확인). 실제 서비스에서는 위·변조 방지 원장에 둔다.
 */
export type MaterialPassport = {
  id: string;
  sessionId: string;
  streamId: string;
  issuedAt: string;
  issuer: string;
  company: string;
  complex: string;
  stream: string;
  material: string;
  detail: string;
  origin: StreamOrigin;
  /** 출처를 무엇으로 확정했는가. 예: "담당자 확인 · 원자재 입고 기록 있음" */
  originBasis: string;
  /** 재생원료 사용 실적에 넣을 수 있는가에 대한 판단 */
  creditable: "pcr" | "pcr-unverified" | "pir";
  evidence: { label: string; value: string }[];
  weightKg: number;
  grade: string;
  collectedBy: string;
  collectedAt: string;
  route: StreamRoute;
  prevHash: string | null;
  hash: string;
};

/** 순회 수거 조건 한 벌: 요일·시간대·kg당 단가(원, 수거 업체가 배출 기업에 주는 값)·월 수거 횟수 */
export type PickupTerms = { day: string; slot: "오전" | "오후"; perKg: number; perMonth: number };

/** 사람이 정한 협상 범위. 에이전트는 이 안에서만 양보하고, 벗어나면 사람에게 넘긴다 */
export type Guardrails = { minPerKg: number; days: string[]; minPerMonth: number; maxRounds: number };

export type NegotiationRound = {
  by: "ours" | "theirs";
  at: string;
  terms: PickupTerms;
  message: string;
  /** 이 제안이 우리 가드레일 안에 있는가 */
  within: boolean;
  /** 상대 제안을 받아들인 차례 */
  accept?: boolean;
};

/**
 * 에이전트 간 협상(A2A). 우리 에이전트와 수거 업체 에이전트가 순회 수거 조건을 주고받고, 합의안은 사람이 승인해야 확정된다.
 * 시연에서는 수거 업체 쪽 에이전트를 모의로 돌린다.
 */
export type Negotiation = {
  id: string;
  streamId: string;
  counterparty: { companyId: string; name: string };
  guardrails: Guardrails;
  /** 처음 요청한 조건(순회 수거 요청서) */
  requested: PickupTerms;
  rounds: NegotiationRound[];
  status: "agreed" | "failed" | "approved";
  agreed?: PickupTerms;
  /** 합의 실패 이유 또는 사람에게 넘기는 이유 */
  note?: string;
  startedAt: string;
  approvedBy?: string;
  approvedAt?: string;
};

/** 실행 기록을 남기는 에이전트. orchestrator는 6단계를 나눠 맡기는 조정 에이전트다 */
export type AgentName = "orchestrator" | "classify" | "feasibility" | "regulation" | "matching" | "cost-carbon" | "proposal" | "negotiation" | "passport" | "walkthrough";

/**
 * 에이전트 실행 기록 한 줄. 화면 오른쪽 실행 콘솔에 시간순으로 쌓인다.
 * actor가 human이면 사람이 한 일(확정, 수정, 승인, 명령, 회신)이고 먹색으로, ai면 형광펜으로 표시한다.
 * 실제 서비스에서는 Agent Framework 실행 추적(OpenTelemetry)에서 만든다.
 */
export type RunEvent = {
  id: string;
  at: string;
  agent: AgentName;
  actor: "ai" | "human";
  kind: "start" | "tool" | "result" | "ask" | "decision" | "command";
  /** 한 줄 요약 */
  title: string;
  /** 펼치면 보이는 설명 */
  detail?: string;
  /** 부른 도구. 예: "Azure AI Search · 법령 색인" */
  tool?: string;
  /** 근거(인용 조항, 데이터 출처, 현장 지식 카드) */
  refs?: string[];
  durationMs?: number;
  step?: FlowStep;
  streamId?: string;
};

export type Session = {
  id: string;
  orgId: string;
  ownerId: string;
  complexId: string;
  /** 예: "(주)한빛정밀 폐플라스틱 진단 · 4개 흐름" */
  title: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  /** 사용자가 마지막으로 연 단계 */
  step: FlowStep;
  streams: Stream[];
  questions: Question[];
  feasibility?: FeasibilityResult;
  regulation?: RegulationResult;
  matching?: MatchingResult;
  costCarbon?: CostCarbonResult;
  proposal?: ProposalResult;
  selectedRoute?: Route["id"];
  approval?: Approval;
  /** 가장 최근에 기록한 실제 결과 (하위 호환). 흐름별 결과는 outcomes */
  outcome?: Outcome;
  /** 흐름별 실제 결과. 같은 흐름은 최신 기록 하나만 남긴다 */
  outcomes?: Outcome[];
  corrections: Correction[];
  /** 에이전트 실행 기록(오래된 것부터) */
  runLog?: RunEvent[];
  /** 수거 조건 협상(묶음 흐름마다 하나) */
  negotiations?: Negotiation[];
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
  kind: "box" | "ratio" | "grade" | "outcome" | "origin" | "route";
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

/** 요청서에 대한 받는 쪽의 회신. 묶음 참여 제안이면 참여 여부다 */
export type MessageReply = {
  decision: "accepted" | "declined";
  at: string;
  by: string;
  reason?: string;
};

export type OutboxMessage = {
  id: string;
  sessionId: string;
  orgId: string;
  fromOrg: string;
  toCompanyId: string;
  toName: string;
  kind: "quote" | "bundle-invite" | "pickup";
  /** 어느 흐름에 대한 요청인가 */
  streamId?: string;
  subject: string;
  sentAt: string;
  status: "sent" | "read" | "replied" | "completed";
  reply?: MessageReply;
};
