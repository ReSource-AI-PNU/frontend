/**
 * 화면용 진단 뷰의 모양. 백엔드 docs/v3/CONTRACT.md 7장과 실제 출력(devserver)에 맞춘 정본이다.
 * 화면 타입(types.ts)은 여기서 끌어낸다. 모르는 필드가 오면 검사가 실패하도록 엄격하게 적는다.
 * 검사: node --test tests/v3-view.test.ts (tests/v3-view.test.ts가 실제 백엔드 출력 두 건을 이 스키마로 읽는다)
 */
import { z } from "zod";

const obj = z.strictObject;

export const claimSchema = obj({
  id: z.string(),
  kind: z.enum(["number", "clause"]),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  evidence: z.array(z.string()),
});
const claimOrNull = claimSchema.nullable();

export const orgRoleSchema = z.enum(["emitter", "vendor", "admin"]);
export const triStatusSchema = z.enum(["calculated", "conditional", "needs_information"]);
export const edgeStatusSchema = z.enum(["met", "conditional", "unmet"]);
export const stageStatusSchema = z.enum(["waiting", "running", "done", "needs_check"]);
export const sessionStatusSchema = z.enum([
  "idle",
  "running",
  "awaiting_answers",
  "awaiting_approval",
  "confirmed",
]);
export const sessionPhaseSchema = z.enum([
  "identify",
  "discover",
  "converse",
  "propose",
  "approval",
  "done",
]);
export const threadStatusSchema = z.enum([
  "not_opened",
  "open",
  "agreed",
  "declined",
  "handoff",
  "confirmed",
]);
export const messageTypeSchema = z.enum([
  "inquiry",
  "question",
  "answer",
  "offer",
  "counter",
  "conditional",
  "decline",
  "handoff",
  "confirm",
]);

/** 실제로 답을 쓴 구현. rule은 모델이 아니라 규칙 정책(모델 미연결)이다. */
export const modelRefSchema = obj({
  provider: z.enum(["foundry", "ollama", "rule"]),
  name: z.string(),
});
export const vendorModelSchema = obj({
  provider: z.enum(["foundry", "ollama", "rule"]),
  name: z.string(),
  /** 업체가 고른 설정. 실제로 쓴 구현(provider, name)과 다를 수 있다. */
  configured: obj({ provider: z.enum(["foundry", "ollama"]), name: z.string() })
    .nullable()
    .optional(),
  used: z.boolean().optional(),
});

export const rejectionSchema = obj({
  code: z.string(),
  message: z.string(),
  claimId: z.string().nullable().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export const validationSchema = obj({
  ok: z.boolean(),
  attempts: z.number().optional(),
  rejections: z.array(rejectionSchema).optional(),
  /** 받은 쪽이 다시 검증했으면 그 조직 */
  recheckedBy: z.string().optional(),
});

export const messageMetaSchema = obj({
  asks: z.array(obj({ streamId: z.string(), field: z.string() })),
  excluded: z.array(obj({ streamId: z.string(), reason: z.string() })),
  reason: z.string().nullable(),
  terms: obj({
    items: z.array(obj({ streamId: z.string(), claimId: z.string() })),
    days: z.array(z.string()),
    conditions: z.array(z.string()),
  }).nullable(),
});

export const threadMessageSchema = obj({
  id: z.string(),
  seq: z.number(),
  from: z.string(),
  to: z.string(),
  type: messageTypeSchema,
  stage: z.number(),
  streamIds: z.array(z.string()),
  text: z.string(),
  claims: z.array(claimSchema),
  validation: validationSchema,
  createdAt: z.string(),
  model: modelRefSchema.nullable().optional(),
  meta: messageMetaSchema.optional(),
});

export const threadSchema = obj({
  id: z.string(),
  emitterOrgId: z.string(),
  vendorOrgId: z.string(),
  vendorName: z.string(),
  vendorModel: vendorModelSchema,
  status: threadStatusSchema,
  statusReason: z.string().nullable(),
  reasonEvidence: z.array(z.string()),
  streamIds: z.array(z.string()),
  /** 최적안에서 이 업체에 배정된 흐름 */
  assignedStreamIds: z.array(z.string()),
  turns: z.number(),
  maxTurns: z.number(),
  agreedSeq: z.number().nullable(),
  messages: z.array(threadMessageSchema),
});

export const stageSchema = obj({
  stage: z.number(),
  key: z.string(),
  label: z.string(),
  status: stageStatusSchema,
});

export const viewStreamSchema = obj({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  process: z.string().nullable(),
  wasteItem: z.string().nullable(),
  material: z.string().nullable(),
  origin: z.string().nullable(),
  form: z.string().nullable(),
  lot: z.string().nullable(),
  contaminants: z.array(z.string()),
  monthlyKg: claimOrNull,
  monthlyKgBasis: z.enum(["measured", "estimated"]).nullable(),
  /** 측정값의 오염도 */
  contamination: claimOrNull,
  /** 탐지 모델이 사진에서 추정한 오염 비율 */
  photoContamination: claimOrNull,
  moisture: claimOrNull,
  /** 담당자가 "모름"으로 답한 값 */
  unknownFields: z.array(z.string()),
  grade: obj({
    value: z.string().nullable(),
    basis: z.enum(["measured", "photo_estimate"]).nullable(),
    label: z.string(),
    evidence: z.array(z.string()),
  }),
  /** 업체가 보는 뷰에서는 null이다 */
  currentTreatment: obj({
    method: z.string(),
    unitCost: claimOrNull,
    assumed: z.boolean(),
  }).nullable(),
});

export const graphNodeSchema = obj({
  id: z.string(),
  type: z.enum(["stream", "criterion", "vendor", "evidence"]),
  label: z.string(),
});
export const graphEdgeSchema = obj({
  from: z.string(),
  to: z.string(),
  status: edgeStatusSchema,
  label: z.string(),
  evidence: z.array(z.string()),
  kind: z.enum(["permit", "criterion", "assignment", "excluded", "regulation", "document"]),
});

export const checkSchema = obj({
  key: z.string(),
  status: edgeStatusSchema,
  text: z.string(),
  evidence: z.array(z.string()),
  /** 업체가 내건 조건이면 text의 자리표시자를 이 claims로 그린다 */
  claims: z.array(claimSchema).optional(),
});

export const alternativeSchema = obj({
  vendorOrgId: z.string().nullable(),
  vendorName: z.string().nullable(),
  route: z.string(),
  unitPrice: claimOrNull,
  monthlyAfter: claimOrNull,
  note: z.string(),
});

export const assignmentSchema = obj({
  streamId: z.string(),
  vendorOrgId: z.string().nullable(),
  vendorName: z.string().nullable(),
  threadId: z.string().nullable(),
  route: z.string().nullable(),
  status: triStatusSchema,
  /** 배출 기업이 받으면 양수(매입), 내면 음수(처리비) */
  unitPrice: claimOrNull,
  monthlyAfter: claimOrNull,
  monthlyNow: claimOrNull,
  difference: claimOrNull,
  carbon: claimOrNull,
  /** 탄소 감축량을 KAU 시세로 환산한 금액 */
  carbonValue: claimOrNull,
  currentAssumed: z.boolean(),
  checks: z.array(checkSchema),
  alternatives: z.array(alternativeSchema),
});

export const referencePriceSchema = obj({
  key: z.string(),
  material: z.string(),
  form: z.string().nullable(),
  label: z.string(),
  asOf: z.string(),
  price: claimOrNull,
  note: z.string(),
});

export const resultSchema = obj({
  status: triStatusSchema,
  assignments: z.array(assignmentSchema),
  totals: obj({
    monthlyNow: claimOrNull,
    monthlyAfter: claimOrNull,
    difference: claimOrNull,
    carbon: claimOrNull,
  }),
  assumptions: z.array(z.string()),
  sensitivity: z.array(
    obj({ label: z.string(), streamId: z.string().nullable().optional(), difference: claimOrNull }),
  ),
  /** 가격조사 참고 시세. 손익 계산에는 쓰지 않는다 */
  referencePrices: z.array(referencePriceSchema),
  /** 아래 둘은 배출 기업이 보는 뷰에만 온다 */
  carbonInObjective: z.boolean().optional(),
  evidence: z.array(z.string()).optional(),
});

export const questionSchema = obj({
  id: z.string(),
  batch: z.number(),
  streamId: z.string(),
  field: z.string(),
  text: z.string(),
  answered: z.boolean(),
  /** 답하기 전에는 null, "모름"으로 답했으면 true */
  unknown: z.boolean().nullable(),
  answerType: z.enum(["number", "choice", "text"]),
  unit: z.string().nullable(),
  choices: z.array(z.string()).nullable(),
});

export const approvalSchema = obj({
  threadId: z.string(),
  emitter: z.boolean(),
  vendor: z.boolean(),
  blocked: z.boolean(),
  blockedReason: z.string().nullable(),
  streamIds: z.array(z.string()),
});

export const viewDocumentSchema = obj({
  id: z.string(),
  kind: z.enum(["request", "plan"]),
  threadId: z.string(),
  streamIds: z.array(z.string()),
  title: z.string(),
  text: z.string(),
  claims: z.array(claimSchema),
  validation: validationSchema,
  /** 자리표시자를 값으로 바꾼 글 */
  rendered: z.string(),
  createdAt: z.string(),
});

export const runEventSchema = obj({
  seq: z.number(),
  at: z.string(),
  actor: z.enum(["company_agent", "vendor_agent", "validator", "tool", "system"]),
  kind: z.enum([
    "message",
    "tool_call",
    "validation",
    "handoff",
    "approval",
    "thread",
    "question",
    "document",
    "stage",
  ]),
  threadId: z.string().nullable(),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()),
});

export const diagnosisViewSchema = obj({
  session: obj({
    id: z.string(),
    emitterOrgId: z.string(),
    status: sessionStatusSchema,
    phase: sessionPhaseSchema,
    version: z.number(),
    today: z.string(),
  }),
  viewer: obj({ orgId: z.string(), role: orgRoleSchema }),
  stages: z.array(stageSchema),
  streams: z.array(viewStreamSchema),
  threads: z.array(threadSchema),
  graph: obj({ nodes: z.array(graphNodeSchema), edges: z.array(graphEdgeSchema) }),
  result: resultSchema.nullable(),
  questions: z.array(questionSchema),
  /** 질문 한도를 다 쓰고도 모르는 값 */
  unresolved: z.array(obj({ streamId: z.string(), field: z.string() })),
  approvals: z.array(approvalSchema),
  documents: z.array(viewDocumentSchema),
  events: z.array(runEventSchema),
});

export const evidenceSchema = obj({
  id: z.string(),
  kind: z.enum(["law", "ref", "doc", "measure", "model", "human", "calc", "assumption"]),
  kindLabel: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  excerpt: z.string(),
  source: z.string(),
  asOf: z.string(),
  validUntil: z.string().nullable(),
  access: z.array(z.string()),
  version: z.number(),
  meta: z.record(z.string(), z.unknown()),
  /** 계산 사슬 안에서의 깊이(사슬 항목에만 붙는다) */
  depth: z.number().optional(),
});
