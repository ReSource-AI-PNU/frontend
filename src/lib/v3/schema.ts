/**
 * 화면용 진단 뷰의 모양. 백엔드 docs/v3/CONTRACT.md 7장과 실제 출력(devserver)에 맞춘 정본이다.
 * 화면 타입(types.ts)은 여기서 끌어낸다. 모르는 필드가 오면 검사가 실패하도록 엄격하게 적는다.
 * 검사: node --test tests/v3-view.test.ts (tests/v3-view.test.ts가 실제 백엔드 출력 두 건을 이 스키마로 읽는다)
 */
import { z } from "zod";

const obj = z.strictObject;

/** claim이 무엇을 가리키는지(계약 7장 "사람이 읽는 이름"). 화면은 ID 끝말이 아니라 이것으로 값을 가린다. */
export const claimRoleSchema = z.enum([
  "unitPrice",
  "treatmentFee",
  "currentUnitCost",
  "referencePrice",
  "monthlyKg",
  "totalKg",
  "totalM3",
  "monthlyRevenue",
  "monthlyAfter",
  "monthlyNow",
  "difference",
  "sensitivity",
  "carbon",
  "carbonValue",
  "transport",
  "extraCost",
  "distance",
  "trips",
  "pickups",
  "perPickup",
  "capacity",
  "threshold",
  "contamination",
  "moisture",
  "priceDeviation",
  "clause",
]);

export const claimSchema = obj({
  id: z.string(),
  kind: z.enum(["number", "clause"]),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  evidence: z.array(z.string()),
  /** 사람이 읽는 이름. 이름을 정하지 못한 claim에는 없다 */
  label: z.string().optional(),
  /** 처리비(treatmentFee)는 값이 음수 그대로 오고 화면은 크기로 그린다 */
  role: claimRoleSchema.optional(),
});
const claimOrNull = claimSchema.nullable();

export const orgRoleSchema = z.enum(["emitter", "vendor", "admin"]);
export const triStatusSchema = z.enum(["calculated", "conditional", "needs_information"]);
export const edgeStatusSchema = z.enum(["met", "conditional", "unmet"]);
/**
 * 결과 한 장 확인 항목의 판정. 계약 7장의 값은 met·conditional·unmet이다.
 * 배정이 빠진 흐름의 사유 줄에 행 판정과 같은 needs_information이 오면 "확인 필요"로 그대로 적도록 받아 둔다.
 */
export const checkStatusSchema = z.enum(["met", "conditional", "unmet", "needs_information"]);
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

/**
 * 실제로 답을 쓴 구현(계약 7장 "메시지를 쓴 구현"). rule은 모델이 아니라 규칙 정책(모델 미연결)이다.
 * code는 진행기(코드)가 정해 둔 문장으로 쓴 메시지이고 숫자와 claim이 없다: 담당자 인계(handoff), 허가 품목이 맞는
 * 흐름이 남지 않은 거절(decline), 일부 흐름만 뺀 answer·question(meta.excluded), 합의 뒤 조건 변경으로 다시 여는 counter.
 * vendorModel에는 code가 오지 않는다(메시지에만 붙는다).
 */
export const modelRefSchema = obj({
  provider: z.enum(["foundry", "ollama", "anthropic", "rule", "code"]),
  name: z.string(),
});
export const vendorModelSchema = obj({
  provider: z.enum(["foundry", "ollama", "anthropic", "rule"]),
  name: z.string(),
  /** 업체가 고른 설정. 실제로 쓴 구현(provider, name)과 다를 수 있다. */
  configured: obj({ provider: z.enum(["foundry", "ollama"]), name: z.string() })
    .nullable()
    .optional(),
  used: z.boolean().optional(),
});

/**
 * 거부 기록. 코드와 코드별 일반 문장만 온다(계약 4장 "거부 기록에는 값이 없다"): claimId는 null, detail은 빈 객체다.
 * 거부된 초안의 숫자·조항·가드레일 수치는 실리지 않는다. 코드 목록은 계약 8장 "초안 거부 코드"이고
 * 화면 풀이는 format.ts의 rejectionLabel이다(UNBACKED_TERM 포함).
 */
export const rejectionSchema = obj({
  code: z.string(),
  message: z.string(),
  claimId: z.string().nullable().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  /** 몇 번째 초안이 거부됐는지 */
  attempt: z.number().optional(),
});
export const validationSchema = obj({
  ok: z.boolean(),
  attempts: z.number().optional(),
  rejections: z.array(rejectionSchema).optional(),
  /** 받은 쪽이 다시 검증했으면 그 조직 */
  recheckedBy: z.string().optional(),
});

/** 업체가 배출 기업에 묻는 흐름 항목 일곱 가지와, 회사 측이 업체에 조건을 달라고 할 때의 terms */
export const askFieldSchema = z.enum([
  "material",
  "origin",
  "form",
  "contaminationPct",
  "moisturePct",
  "lotSame",
  "monthlyKg",
  "terms",
]);

export const messageMetaSchema = obj({
  asks: z.array(obj({ streamId: z.string(), field: askFieldSchema })),
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

/**
 * 업체가 보는 뷰의 그래프에는 자기 매입 기준 노드(type criterion)와 흐름을 그 기준과 대조한 엣지(kind criterion),
 * 최적안 배정 엣지(kind assignment)가 온다. 규정 엣지(regulation)와 다른 업체의 기준은 오지 않는다.
 * excluded 엣지의 evidence에는 허가 품목 때문에 뺀 경우 허가증 근거가 실린다.
 */
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

/** 결과 한 장 배정의 확인 항목 종류(계약 7장). 화면 이름은 format.ts의 CHECK_KEY_LABEL */
export const checkKeySchema = z.enum([
  "contaminationPct",
  "moisturePct",
  "contamination_basis",
  "moisture_basis",
  "form",
  "monthly_kg_basis",
  "material_basis",
  "mixture",
  "permit",
  "current_assumed",
  "transport",
  "carbon",
  "vendor_condition",
  "price_differs",
  "unresolved",
  "skipped",
  "handoff",
  "min_volume",
  "loading",
  "loading_volume",
]);

export const checkSchema = obj({
  key: checkKeySchema,
  status: checkStatusSchema,
  text: z.string(),
  evidence: z.array(z.string()),
  /** 업체가 내건 조건과 적재 검사는 text의 자리표시자나 곁들인 값을 이 claims로 그린다 */
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
  /** 이 결과에 쓴 가정값. id는 근거 ID다. 값 하나로 적을 수 없는 가정(등급 기준표)은 value·unit이 null */
  assumptions: z.array(
    obj({
      id: z.string(),
      label: z.string(),
      value: z.union([z.number(), z.string()]).nullable(),
      unit: z.string().nullable(),
    }),
  ),
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
  /** 한국어 문장. 화면은 이 문장을 뜯어 읽지 않고 blockedCodes를 본다 */
  blockedReason: z.string().nullable(),
  /**
   * 막힌 사유 코드(계약 8장 "승인을 막는 사유 코드"). 막히지 않았으면 빈 배열이다.
   * EVIDENCE_CHANGED, STREAM_CHANGED, VENDOR_TERMS_CHANGED와 근거 검증기의 거부 코드가 온다.
   * 모르는 코드가 와도 화면이 깨지지 않도록 글자 그대로 받는다(풀이는 format.ts의 blockCodeLabel).
   */
  blockedCodes: z.array(z.string()),
  /** 허가 품목이 일부만 맞지 않으면(409 PERMIT_MISMATCH) 그 흐름이 빠져 줄어든다 */
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
    "feedback",
  ]),
  threadId: z.string().nullable(),
  summary: z.string(),
  /**
   * 종류마다 항목이 다르다. 화면이 읽는 것(use: event-detail.tsx):
   *  - hiddenEvidenceCount(정수): 보는 조직이 열 수 없는 근거를 그만큼 뺐다
   *  - codes(문자열 배열)·rejections[{code, message}]: 검증 거부 코드
   *  - excludedStreamIds(흐름 ID 배열): 허가 품목이 맞지 않아 이 대화에서 뺀 흐름
   *  - reopenedSeq(정수): 합의 뒤 업체 조건이 바뀌어 이 번호의 메시지로 대화를 다시 열었다
   *  - reportedBy("vendor"): 업체 측 에이전트가 답과 함께 보낸 기록
   *  - calledBy("code" | "orchestrator" | "model:<provider>"): 판단 도구를 누가 불렀는지
   */
  detail: z.record(z.string(), z.unknown()),
});

export const correctionFieldSchema = z.enum([
  "box",
  "material",
  "origin",
  "form",
  "contaminant",
  "grade",
  "contaminationPct",
  "moisturePct",
]);

/** 배출 기업 담당자가 고친 값(기록만 남는다. 흐름의 값은 바뀌지 않는다) */
export const correctionSchema = obj({
  type: z.literal("correction"),
  id: z.string(),
  sessionId: z.string(),
  orgId: z.string(),
  streamId: z.string(),
  field: correctionFieldSchema,
  before: z.union([z.string(), z.number()]).nullable(),
  after: z.union([z.string(), z.number()]).nullable(),
  note: z.string().nullable(),
  seq: z.number(),
  target: z.enum(["detector", "grade"]),
  photoEvidence: z.array(z.string()),
  recordedOn: z.string(),
});

/** 업체가 확정 뒤 기록한 실제 결과 */
export const outcomeSchema = obj({
  type: z.literal("outcome"),
  id: z.string(),
  sessionId: z.string(),
  threadId: z.string(),
  vendorOrgId: z.string(),
  emitterOrgId: z.string(),
  streamId: z.string(),
  inspectedOn: z.string(),
  actualGrade: z.string().nullable(),
  actualUnitPriceKrwPerKg: z.number().nullable(),
  actualKg: z.number().nullable(),
  note: z.string().nullable(),
  evidenceKind: z.enum(["human", "doc"]),
  evidence: obj({
    grade: z.string().nullable().optional(),
    unitPrice: z.string().nullable().optional(),
    kg: z.string().nullable().optional(),
  }),
  features: obj({
    material: z.string().nullable(),
    contaminationPct: z.number().nullable(),
    moisturePct: z.number().nullable(),
    basis: z.string().nullable(),
    evidence: z.array(z.string()).optional(),
  }),
  criterionId: z.string().nullable(),
  tablePrice: claimOrNull,
  offeredPrice: claimOrNull,
  /** 실제 단가에서 매입 기준표 단가를 뺀 값 */
  deviation: claimOrNull,
  recordedOn: z.string(),
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
  /** 이 진단에 쌓인 교정과 실제 결과. 교정은 배출 기업만, 실제 결과는 그 대화의 업체와 배출 기업만 본다 */
  feedback: obj({ corrections: z.array(correctionSchema), outcomes: z.array(outcomeSchema) }),
});

/** GET /orgs. order가 작은 것부터 온다(시연 주인공이 맨 앞, 운영 조직이 맨 뒤) */
export const orgSchema = obj({
  id: z.string(),
  name: z.string(),
  role: orgRoleSchema,
  region: z.string().nullable().optional(),
  location: z.tuple([z.number(), z.number()]).nullable().optional(),
  order: z.number().optional(),
  synthetic: z.boolean().optional(),
  note: z.string().optional(),
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
  /** 응답에는 보는 조직과 소유 조직만 실린다(전체 공개는 "*"). 다른 조직이 볼 수 있는지는 알려 주지 않는다 */
  access: z.array(z.string()),
  version: z.number(),
  meta: z.record(z.string(), z.unknown()),
  /** 계산 사슬 안에서의 깊이(사슬 항목에만 붙는다) */
  depth: z.number().optional(),
});
