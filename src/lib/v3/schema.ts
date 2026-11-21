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
  /** 지금 재활용 업체에 팔고 있을 때 받는 kg당 금액(양수) */
  "currentUnitPrice",
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
  "labor",
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
  /** 자원순환 효과(2026-11-19). 세 지표는 서로 다른 성과라 합치지 않는다 */
  "ghgReduction",
  "energySaving",
  "virginDisplaced",
  "routedKg",
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

/**
 * 방문 수거 상태(2026-11-19). route 기존 노선 포함, check 별도 수거 확인 필요(노선 밖이고 업체가 방문을 밝히지 않음),
 * visit 업체 수거 가능 확인(노선 밖이지만 업체가 따로 오겠다고 밝힘), unavailable 수거 불가, unknown 미상(노선을 밝히지 않음)
 */
export const pickupStatusSchema = z.enum(["route", "check", "visit", "unavailable", "unknown"]);
/** 운반비 방식: 단가에 포함, 별도, 미정 */
export const transportBasisSchema = z.enum(["included", "separate", "undecided"]);
export const transportUnitSchema = z.enum(["per_pickup", "per_month"]);

/** 업체 조건 답에 붙은 수거·운반 견적. 값은 claims에만 있고 여기에는 어느 claim이 금액·횟수인지만 둔다 */
export const messagePickupSchema = obj({
  status: pickupStatusSchema,
  basis: transportBasisSchema,
  paidBy: z.enum(["vendor", "emitter"]).nullable(),
  unit: transportUnitSchema.nullable(),
  feeClaimId: z.string().nullable(),
  pickupsClaimId: z.string().nullable(),
  days: z.array(z.string()),
});

export const messageMetaSchema = obj({
  asks: z.array(obj({ streamId: z.string(), field: askFieldSchema })),
  excluded: z.array(obj({ streamId: z.string(), reason: z.string() })),
  reason: z.string().nullable(),
  terms: obj({
    items: z.array(obj({ streamId: z.string(), claimId: z.string() })),
    days: z.array(z.string()),
    conditions: z.array(z.string()),
    /** 2026-11-19 뒤 업체 조건 답에만 있다 */
    pickup: messagePickupSchema.nullable().optional(),
  }).nullable(),
});

/**
 * 화면에 보이는 작성자 표시(계약 7장 "작성자 표시"). 구현 이름 대신 이것만 일반 화면에 쓴다.
 * label은 "회사 측 AI" | "업체 측 AI" | "자동 안내"다.
 */
export const authorSchema = obj({
  side: z.enum(["company", "vendor"]),
  kind: z.enum(["agent", "system"]),
  label: z.string(),
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
  author: authorSchema.optional(),
  meta: messageMetaSchema.optional(),
});

/** 대화의 끝 상태(계약 8장 "대화의 끝 상태"). not_selected: 조건을 받았지만 최적안에 들지 않음, ended: 조건을 다 받지 못하고 끝남, waiting: 담당자 답 대기 */
export const threadOutcomeSchema = z.enum(["agreed", "confirmed", "declined", "handoff", "not_selected", "ended", "waiting"]);

export const threadSchema = obj({
  id: z.string(),
  emitterOrgId: z.string(),
  vendorOrgId: z.string(),
  vendorName: z.string(),
  /** 구현 이름(운영 정보). 일반 화면에는 쓰지 않고, 백엔드가 일반 뷰에서 지울 수 있다 */
  vendorModel: vendorModelSchema.optional(),
  vendorAuthor: authorSchema.optional(),
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
  /** 실행이 멈춘 뒤의 끝 상태와 그 문장. 진행 중이거나 열지 않은 대화는 null */
  outcome: threadOutcomeSchema.nullable().optional(),
  outcomeText: z.string().nullable().optional(),
});

export const stageSchema = obj({
  stage: z.number(),
  key: z.string(),
  label: z.string(),
  status: stageStatusSchema,
});

/** 오염도·수분 값의 출처: 측정 | 담당자가 질문에 답한 값 | 사진 추정 */
export const valueBasisSchema = z.enum(["measured", "answered", "photo_estimate"]);

/**
 * 차량·횟수 단위나 월 정액으로 받은 현행 처리비 계약(백엔드가 월 발생량으로 kg당 처리비로 바꾼 원래 꼴).
 * 뷰에는 사람이 읽는 꼴(text, 예: "회당 300,000원 × 월 2회(월 600,000원)")이 붙어 온다. 흐름 기록(GET streams)에는 text가 없다.
 */
export const billingSchema = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("per_trip"), krwPerTrip: z.number(), tripsPerMonth: z.number(), text: z.string().optional() }),
  obj({ kind: z.literal("monthly"), krwPerMonth: z.number(), text: z.string().optional() }),
]);

export const viewStreamSchema = obj({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  /** 보이는 이름(업체가 보는 뷰에서는 name과 같다) */
  label: z.string().optional(),
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
  /** contamination·moisture 값의 출처. 담당자 답이면 claim 이름이 "오염도(담당자 답)"처럼 온다 */
  contaminationBasis: valueBasisSchema.nullable().optional(),
  moistureBasis: valueBasisSchema.nullable().optional(),
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
    /** 내는 돈(현행 처리 단가). 지금 팔고 있으면 null이다 */
    unitCost: claimOrNull,
    /** 지금 재활용 업체에 팔고 돈을 받는다. 이 기능 전 뷰에는 없다 */
    sale: z.boolean().optional(),
    /** 받는 kg당 금액(현행 판매 단가, role currentUnitPrice). 팔지 않으면 null */
    unitPrice: claimOrNull.optional(),
    assumed: z.boolean(),
    /** 회당·월 정액으로 적은 계약이면 그 꼴. kg당으로 적었거나 가정값이면 null(이 기능 전 뷰에는 없다) */
    billing: billingSchema.nullable().optional(),
  }).nullable(),
  /** 순비용에 쓰는 배출 기업만의 입력. 배출 기업이 보는 뷰에만 온다 */
  costInputs: obj({
    pretreatHoursPerMonth: z.number().nullable(),
    laborCostKrwPerHour: z.number().nullable(),
    reuse: obj({
      virginPriceKrwPerKg: z.number(),
      reusableKgPerMonth: z.number(),
      regrindCostKrwPerKg: z.number().nullable(),
    }).nullable(),
  }).optional(),
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
  "current_method",
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
  /** 업체가 밝힌 수거 노선이 공장 지역을 지나는지(2026-11-19) */
  "pickup_route",
  "pickup_area",
  /** 배정한 업체의 허가 근거 수준: 허가증·공공 명부 확인, 허가증 문서, 업체 입력, 공공 명부와 다름(2026-11-19) */
  "permit_level",
  /** 운송 배출을 계산하지 못했을 때(공장 위치나 업체 차고지가 없을 때) */
  "transport_carbon",
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
  /** 이 업체에만 보낼 때의 탄소 변화(처리 방식 + 수거 운행). 이 기능 전 결과에는 없다 */
  carbon: claimOrNull.optional(),
  /** 이 업체로 보낼 때의 허가 확인 상태(2026-11-19 뒤 결과) */
  permit: z.lazy(() => permitLevelSchema).nullable().optional(),
  /** 운반비가 정해지지 않아 monthlyAfter가 별도 운반비 반영 전 값이다(2026-11-19 뒤 결과) */
  transportPending: z.boolean().optional(),
  pickupStatus: pickupStatusSchema.nullable().optional(),
  note: z.string(),
});

/** 배출 기업 담당자가 업체가 올린 허가증 원문에서 품목과 처리 방법을 대조한 기록(2026-11-19) */
export const permitCheckSchema = obj({
  id: z.string(),
  documentId: z.string().nullable(),
  document: z.string().nullable(),
  /** 대조한 쪽 */
  page: z.number().nullable(),
  wasteItem: z.string().nullable(),
  materials: z.array(z.string()),
  /** 대조한 처리 방식(재활용, 열분해 등) */
  process: z.string().nullable(),
  itemFound: z.boolean(),
  processFits: z.boolean(),
  itemQuote: z.string().nullable(),
  processQuote: z.string().nullable(),
  /** 업체 뷰에서는 userName이 null이다 */
  checkedBy: obj({ orgId: z.string(), orgName: z.string().nullable(), userName: z.string().nullable() }),
  checkedAt: z.string(),
  /** 대조 기록 근거(human). 업체 뷰에서는 null */
  evidence: z.string().nullable(),
});

const permitPlaceSchema = obj({ name: z.string(), page: z.number().nullable(), quote: z.string().nullable() });

/** 업체가 올린 허가증(AI가 읽은 값, 담당자 대조 전). 파일은 서버에 남지 않는다 */
export const permitDocumentSchema = obj({
  id: z.string(),
  name: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  pages: z.array(z.number()),
  items: z.array(
    obj({ wasteItem: z.string(), materials: z.array(z.string()), page: z.number().nullable(), quote: z.string().nullable() }),
  ),
  business: permitPlaceSchema.nullable(),
  holder: obj({
    name: z.string().nullable(),
    address: z.string().nullable(),
    page: z.number().nullable(),
    quote: z.string().nullable(),
    /** 허가증의 상호·소재지가 이 업체와 같은가(모르면 null). 다르면 그 문서는 쓰지 않는다 */
    nameMatches: z.boolean().nullable().optional(),
    siteMatches: z.boolean().nullable().optional(),
  }).nullable(),
  evidence: z.array(z.string()),
});

/**
 * 결과 한 줄의 수거·운반(2026-11-19). 수거 상태와 운반비 조건은 따로 본다.
 * fee는 업체가 밝힌 운반비 견적(원/회 또는 원/월), pickups는 월 수거 횟수, monthly는 이 업체에 드는 월 운반비(같은 수거 차량의
 * 폐기물에 한 번만 든다), room은 운반비가 정해지지 않았을 때 "운반비가 한 달 이만큼을 넘으면 다음 선택지가 낫다"는 값이다.
 * 업체 뷰에서 room과 roomAgainst는 null이다.
 */
export const pickupSchema = obj({
  status: pickupStatusSchema,
  label: z.string().nullable(),
  detail: z.string().optional(),
  days: z.array(z.string()),
  basis: transportBasisSchema,
  basisLabel: z.string().nullable(),
  /** 노선 수거의 운반비 방식(노선 밖이라 이 공장에 그대로 쓰지 않았을 때 참고) */
  routeBasis: transportBasisSchema.nullable(),
  paidBy: z.enum(["vendor", "emitter"]).nullable(),
  unit: transportUnitSchema.nullable(),
  fee: claimOrNull,
  pickups: claimOrNull,
  monthly: claimOrNull,
  room: claimOrNull,
  roomAgainst: obj({ vendorOrgId: z.string().nullable(), route: z.string() }).nullable(),
  pending: z.boolean(),
  /** 이 조건을 밝힌 업체 답의 메시지 번호. 업체 답이 아니라 업체 정보로 정했으면 null */
  seq: z.number().nullable(),
  source: z.enum(["answer", "profile"]).nullable(),
});

/**
 * 배정 경로(업체 · 폐기물 · 처리 방식)의 허가 확인 상태. 담당자가 원문을 대조한 경로만 verified(대조 완료)다.
 * 2026-11-19 이전 결과의 level(registry, document, self)은 원문 대조 기록이 없는 상태로 그린다(permit.ts).
 */
export const permitLevelSchema = obj({
  level: z.enum(["verified", "pending_review", "registered", "mismatch", "registry", "document", "self"]),
  label: z.string(),
  status: z.enum(["met", "conditional", "unmet"]),
  text: z.string(),
  evidence: z.array(z.string()),
  /** 실제 근거 수준: 원문 대조 기록 · 업체가 올린 허가증 · 공공 명부 · 업체 입력 */
  source: z.enum(["check", "document", "registry", "typed"]).optional(),
  wasteItem: z.string().nullable().optional(),
  materials: z.array(z.string()).optional(),
  process: z.string().nullable().optional(),
  /** 처리 방식에 필요한 허가 업종(재활용업, 처분업) */
  need: z.string().nullable().optional(),
  business: z.string().nullable().optional(),
  check: permitCheckSchema.nullable().optional(),
  document: permitDocumentSchema.nullable().optional(),
  /** 쓰지 않은 허가증(다른 업체·사업장)과 그 이유 */
  ignored: z.array(obj({ name: z.string().nullable(), reason: z.string() })).optional(),
  /** 대조 완료 전: 제출받을 문서와 확인할 항목 */
  todo: obj({ submit: z.string(), items: z.array(z.string()) }).nullable().optional(),
});

/** 허가 확인 결과 이 경로로 진행할 수 없는 업체. 예상 손익은 싣지 않는다 */
export const blockedRouteSchema = obj({
  vendorOrgId: z.string(),
  vendorName: z.string().nullable(),
  permit: permitLevelSchema,
  note: z.string(),
});

/** 공정 재투입 후보(판단 도구 judge_reuse). 업체가 보는 뷰에서는 null이다 */
export const reuseSchema = obj({
  /** 후보인가. 조건을 다 보지 못했으면 null */
  eligible: z.boolean().nullable(),
  status: triStatusSchema,
  reason: z.string(),
  /** 신재 구입 단가와 다시 넣을 수 있는 양을 넣었을 때만 온다 */
  monthlyAfter: claimOrNull,
  difference: claimOrNull,
  checks: z.array(obj({ key: z.string(), status: checkStatusSchema, text: z.string(), evidence: z.array(z.string()) })),
});

export const assignmentSchema = obj({
  streamId: z.string(),
  vendorOrgId: z.string().nullable(),
  vendorName: z.string().nullable(),
  threadId: z.string().nullable(),
  route: z.string().nullable(),
  /** 처리 방식: 업체면 프로필의 처리 방식(재활용, 열분해), 지금 방식 그대로면 현행 처리. 이 기능 전 결과에는 없다 */
  process: z.string().nullable().optional(),
  status: triStatusSchema,
  /** 배출 기업이 받으면 양수(매입), 내면 음수(처리비) */
  unitPrice: claimOrNull,
  monthlyAfter: claimOrNull,
  monthlyNow: claimOrNull,
  difference: claimOrNull,
  /** 순비용의 내역: 매각 수익(처리비면 음수), 배출 기업이 따로 내는 운반비, 전처리 인건비. 업체 뷰에서는 null */
  revenue: claimOrNull,
  transport: claimOrNull,
  labor: claimOrNull,
  /** 운반비를 누가 내는가. 업체가 조건을 밝히지 않았으면 null */
  transportPaidBy: z.enum(["vendor", "emitter"]).nullable(),
  reuse: reuseSchema.nullable(),
  /** 탄소 변화 = 처리 방식이 바뀌어 달라지는 배출 + 수거 운행 배출(같은 업체로 가는 폐기물끼리 나눈 몫) */
  carbon: claimOrNull,
  /** 아래 셋은 2026-11-19 뒤 결과에만 온다. 업체 뷰에서는 null */
  carbonProcess: claimOrNull.optional(),
  /** 운송 배출 = 트럭 운송 계수(톤·km당) × 월 발생량 × 공장 → 업체 거리 */
  carbonTransport: claimOrNull.optional(),
  /** 공장 → 업체 차고지 거리(km) */
  transportKm: claimOrNull.optional(),
  /** 탄소 감축량을 KAU 시세로 환산한 금액 */
  carbonValue: claimOrNull,
  /** 허가 근거 수준. 업체에 배정한 줄에만 있다 */
  permit: permitLevelSchema.nullable().optional(),
  /** 수거 상태와 운반비 조건. 업체에 배정한 줄에만 있다(2026-11-19 뒤 결과) */
  pickup: pickupSchema.nullable().optional(),
  /** 운반비가 정해지지 않아 이 줄의 한 달 값(monthlyAfter, difference)은 별도 운반비 반영 전이다 */
  transportPending: z.boolean().optional(),
  currentAssumed: z.boolean(),
  checks: z.array(checkSchema),
  alternatives: z.array(alternativeSchema),
  /** 허가 확인 결과 진행할 수 없는 경로(2026-11-19 뒤 결과) */
  blockedRoutes: z.array(blockedRouteSchema).optional(),
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

const wasteCodeSchema = obj({ code: z.string(), name: z.string().nullable() });

/** 가입하지 않은 처리 업체 후보(공공데이터 허가 명부). AI가 대화하지 않고, 손익 계산에도 넣지 않는다 */
export const outsideCandidateSchema = obj({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  business: z.string(),
  /** confirmed: 허가받은 처리 폐기물이 맞음 · check: 원본의 처리 폐기물을 믿기 어려워 상호로 고름 */
  match: z.enum(["confirmed", "check"]),
  distance: claimOrNull,
  matchedCodes: z.array(wasteCodeSchema),
  codes: z.array(wasteCodeSchema),
  permitDate: z.string().nullable(),
  phone: z.string().nullable(),
  agency: z.string().nullable(),
  asOf: z.string().nullable(),
  evidence: z.array(z.string()),
  note: z.string().nullable(),
  /** 회사와 같은 산업단지에 있는 업체(2026-11-22 추가, 이전 결과에는 없다) */
  sameComplex: z.boolean().optional(),
});

export const outsideVendorsSchema = obj({
  source: obj({
    name: z.string(),
    url: z.string(),
    asOfRange: z.array(z.string()).nullable(),
    note: z.string(),
    radiusKm: z.number(),
  }),
  streams: z.array(
    obj({
      streamId: z.string(),
      codes: z.array(wasteCodeSchema),
      candidates: z.array(outsideCandidateSchema),
      total: z.number(),
      confirmedTotal: z.number(),
      reason: z.string().nullable(),
      /** 후보를 찾은 뒤 바뀐 폐기물 칸(재질, 품목 등). 찾을 때 자료를 남기지 않은 이전 찾기에는 없다 */
      changed: z.array(obj({ field: z.string(), label: z.string(), before: z.string(), after: z.string() })).optional(),
      /** 후보를 찾은 뒤 폐기물이 지워졌다 */
      removed: z.boolean().optional(),
    }),
  ),
});

/**
 * 같은 산업단지의 자원순환 후보(2026-11-22). 등록공장 현황(회사가 신고한 생산품)과 공공 허가 명부로 찾는다.
 * takes: 폐기물을 받아 재생원료로 만드는 곳, uses: 재생원료가 된 뒤 쓸 수 있는 곳. 손익 계산에는 넣지 않는다.
 */
export const complexCandidateSchema = obj({
  /** 등록공장 ID(cf_…) 또는 허가 명부에만 있는 업체 ID(pv_…) */
  id: z.string(),
  name: z.string(),
  address: z.string(),
  role: z.enum(["takes", "uses"]),
  /** 회사가 신고한 생산품 원문. 허가 명부에만 있는 곳은 null */
  product: z.string().nullable(),
  /** 생산품에서 이 역할로 읽은 품목 */
  items: z.array(z.string()),
  /** named: 생산품에 같은 재질이 적혀 있음 · unstated: 재질이 적혀 있지 않음(확인 필요) */
  resinMatch: z.enum(["named", "unstated"]),
  resins: z.array(z.string()),
  evidence: z.array(z.string()),
  /** takes에만 있다. listed: 허가 품목 맞음 · listed_check: 재활용업 허가 명부에 있으나 처리 품목 확인 필요 · unlisted: 명부에 없음 */
  permit: obj({
    status: z.enum(["listed", "listed_check", "unlisted"]),
    vendorId: z.string().nullable(),
    business: z.string().nullable(),
    phone: z.string().nullable(),
    agency: z.string().nullable().optional(),
    matchedCodes: z.array(wasteCodeSchema),
  }).optional(),
});

export const complexPartnersSchema = obj({
  /** 회사가 든 산업단지. 모르면 null이고 reason에 이유가 있다 */
  complex: obj({ id: z.string(), name: z.string(), basis: z.enum(["region", "location"]) }).nullable(),
  reason: z.string().nullable(),
  source: obj({
    factories: obj({ name: z.string(), url: z.string(), asOf: z.string(), note: z.string() }),
    registry: obj({ name: z.string(), url: z.string(), asOfRange: z.array(z.string()).nullable() }),
  }),
  streams: z.array(
    obj({
      streamId: z.string(),
      takes: z.array(complexCandidateSchema),
      uses: z.array(complexCandidateSchema),
      takesTotal: z.number(),
      usesTotal: z.number(),
      reason: z.string().nullable(),
    }),
  ),
});

/** ③ 규정 확인의 법령 조항 인용. 조문 원문의 부분 문자열이고 label은 조항 이름이다 */
const clauseClaimSchema = obj({
  id: z.string(),
  kind: z.literal("clause"),
  value: z.string(),
  unit: z.null(),
  evidence: z.array(z.string()),
  label: z.string().optional(),
});

const regulationSectionSchema = obj({
  route: z.string().nullable(),
  status: triStatusSchema,
  items: z.array(
    obj({
      key: z.string(),
      title: z.string(),
      applies: z.string().nullable(),
      action: z.string(),
      /** met·unmet·needs_information은 허가 대조 결과, conditional은 확인이 필요하거나 담당자 할 일 */
      status: z.enum(["met", "conditional", "unmet", "needs_information"]),
      note: z.string(),
      /** check: 서비스가 판정한 요건(업체 허가) · todo: 서비스가 확인할 수 없는 담당자 할 일 */
      kind: z.enum(["check", "todo"]),
      /** 배정한 업체의 허가 확인 상태(결과표·승인 카드와 같은 값). 배정이 없거나 이전 결과면 없다 */
      permit: z.lazy(() => permitLevelSchema).nullable().optional(),
      clauses: z.array(clauseClaimSchema),
    }),
  ),
  /** 폐기물과 경로로 찾은 관련 조항(체크리스트에 없는 것) */
  related: z.array(clauseClaimSchema),
});

/** ③ 규정 확인(배출 기업만). 폐기물마다 경로 요건 체크리스트, 공정 재투입 후보면 자가 재활용 요건(reuse) */
export const regulationSchema = obj({
  streamId: z.string(),
  ...regulationSectionSchema.shape,
  reuse: regulationSectionSchema.nullable(),
});

/**
 * 분리 개선 안내(배출 기업만). 폐기물마다 할 일, 더 받는 길(지금보다 단가가 높은데 오염도·수분 상한만 넘는 매입 기준),
 * 섞인 재질을 나누면 받는 곳. 실제로 그 등급을 받을지는 반입 검수가 정한다.
 */
export const improvementActionKeySchema = z.enum([
  "remove_contaminants",
  "separate_material",
  "lower_contamination",
  "lower_moisture",
  "measure",
  "weigh",
]);

export const improvementSchema = obj({
  streamId: z.string(),
  actions: z.array(obj({ key: improvementActionKeySchema, text: z.string() })),
  option: obj({
    vendorOrgId: z.string(),
    vendorName: z.string().nullable(),
    grade: z.string().nullable(),
    /** 낮춰야 할 것("오염도", "수분") */
    needs: z.array(z.string()),
    unitPrice: claimOrNull,
    maxContamination: claimOrNull,
    maxMoisture: claimOrNull,
    /** (그 기준 단가 − 지금 kg당 손익) × 월 발생량. 월 발생량을 모르면 null */
    monthlyGain: claimOrNull,
  }).nullable(),
  /** 재질이 섞인 폐기물(예: PP+ABS)을 재질별로 나누면 받는 곳. 받는 곳이 없는 재질은 업체가 null이다 */
  split: z.array(
    obj({
      material: z.string(),
      vendorOrgId: z.string().nullable(),
      vendorName: z.string().nullable(),
      grade: z.string().nullable(),
      unitPrice: claimOrNull,
      maxContamination: claimOrNull,
      /** 지금 오염도로도 그 기준 안이라 나누기만 하면 되는지 */
      meetsNow: z.boolean(),
    }),
  ),
});

const circularMetricSchema = obj({
  /** estimated: 계산함, hold: 산정 보류(0이 아님), zero: 정의상 변화 없음(현행 유지, 거래처만 바뀜) */
  status: z.enum(["estimated", "hold", "zero"]),
  /** literature: 문헌 시나리오 추정, site: 현장 입력값으로 낸 추정 */
  method: z.enum(["literature", "site"]).nullable(),
  reason: z.string(),
  value: claimOrNull,
  /** 이 값에 쓴 계수(문헌·현장 입력)의 근거 ID */
  evidence: z.array(z.string()),
});

const circularTotalSchema = obj({
  /** partial: 산정한 폐기물만 더한 부분합 */
  status: z.enum(["estimated", "partial", "hold", "zero"]),
  total: claimOrNull,
  countedKg: claimOrNull,
  heldKg: claimOrNull,
  heldStreams: z.array(obj({ streamId: z.string(), streamName: z.string().nullable() })),
});

export const circularRouteSchema = z.enum(["reuse", "recycle", "pyrolysis", "landfill", "keep", "unknown"]);
export const circularBaselineSchema = z.enum(["incineration", "landfill", "recycle"]);

export const circularScenarioSchema = obj({
  id: z.enum(["A", "B", "C", "D"]),
  label: z.string(),
  available: z.boolean(),
  reason: z.string().nullable().optional(),
  /** 현행 대비 월 손익. C는 기준선이라, D는 매립 처리비 자료가 없어 null */
  money: claimOrNull,
  moneyReason: z.string().nullable().optional(),
  /** 공정 재투입과 재활용 업체로 가는 물량 */
  circularKg: claimOrNull,
  flows: z.array(obj({ route: circularRouteSchema, kg: claimOrNull })),
  totals: z.partialRecord(z.enum(["ghg", "energy", "virgin"]), circularTotalSchema),
  virginByMaterial: z.array(obj({ material: z.string(), total: claimOrNull })),
  /** C만: 현행 처리 단계 배출(국내 계수). 감축량 0이 배출 0이 아님을 보인다 */
  baselineEmission: claimOrNull,
  rows: z.array(
    obj({
      streamId: z.string(),
      streamName: z.string().nullable(),
      route: circularRouteSchema,
      baseline: circularBaselineSchema.nullable(),
      baselineAssumed: z.boolean(),
      ghg: circularMetricSchema,
      energy: circularMetricSchema,
      virgin: circularMetricSchema,
      virginMaterial: z.string().nullable(),
      resources: z.array(obj({ name: z.string(), value: claimOrNull })),
      unconfirmed: z.array(z.string()),
      explain: obj({ effect: z.string(), why: z.string(), conditions: z.string(), basis: z.string() }),
    }),
  ),
});

export const circularSourceSchema = obj({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  year: z.number().nullable(),
  table: z.string().nullable(),
  unit: z.string().nullable(),
  originalUnit: z.string().nullable(),
  metric: z.string().nullable(),
  material: z.string().nullable(),
  route: z.string().nullable(),
  baseline: z.string().nullable(),
  conditions: z.array(z.string()),
  caveats: z.array(z.string()),
  url: z.string().nullable(),
  asOf: z.string(),
});

/** 자원순환 효과와 네 시나리오(A 흐름별 최적안, B 묶음 없이, C 현행 유지, D 전부 매립). 배출 기업만 본다 */
export const circularSchema = obj({
  scenarios: z.array(circularScenarioSchema),
  baselines: z.record(z.string(), z.number()),
  bundle: obj({
    available: z.boolean(),
    streams: z.array(obj({ streamId: z.string(), streamName: z.string().nullable() })),
    kg: claimOrNull,
  }),
  excluded: z.array(obj({ streamId: z.string().nullable(), streamName: z.string().nullable(), reason: z.string().nullable() })),
  sources: z.array(circularSourceSchema),
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
  /** 아래 셋은 배출 기업이 보는 뷰에만 온다 */
  carbonInObjective: z.boolean().optional(),
  /** 탄소를 배정에 넣을 때 쓴 내부 탄소 가격(배출권 시세, 원/tCO2e) */
  carbonPrice: claimOrNull.optional(),
  /** 탄소를 가장 많이 줄이는 배정과의 비교. 같으면 same true, 다르면 바뀌는 폐기물과 돈·탄소 차이(탄소 우선 − 고른 배정) */
  greenest: obj({
    same: z.boolean(),
    changes: z.array(
      obj({
        streamId: z.string(),
        streamName: z.string().nullable(),
        vendorOrgId: z.string().nullable(),
        vendorName: z.string().nullable(),
        route: z.string(),
      }),
    ),
    monthlyAfter: claimOrNull.optional(),
    carbon: claimOrNull.optional(),
    moneyGap: claimOrNull.optional(),
    carbonGap: claimOrNull.optional(),
  })
    .nullable()
    .optional(),
  evidence: z.array(z.string()).optional(),
  /** 배출 기업이 보는 뷰에만 온다. 이 기능 전에 만든 결과에는 없다 */
  outsideVendors: outsideVendorsSchema.nullable().optional(),
  /** 같은 산업단지의 자원순환 후보. 배출 기업이 보는 뷰에만 온다(2026-11-22 전 결과에는 없다) */
  complexPartners: complexPartnersSchema.nullable().optional(),
  /** 배출 기업이 보는 뷰에만 온다. 이 기능 전에 만든 결과에는 없다 */
  improvements: z.array(improvementSchema).optional(),
  /** ③ 규정 확인. 배출 기업이 보는 뷰에만 온다(2026-11-19 전 결과에는 없다) */
  regulation: z.array(regulationSchema).optional(),
  /** 운반비가 정해지지 않아 합계에 별도 운반비 반영 전 값이 섞인 폐기물(합계는 잠정값). 업체 뷰에는 없다 */
  transportPending: z.array(z.string()).optional(),
  /** 비용·탄소 비교의 계산 범위(지금 처리 쪽 운송이 빠졌다는 것 등). 업체 뷰에는 없다 */
  scope: z.array(obj({ key: z.string(), text: z.string() })).optional(),
  /** 자원순환 효과. 배출 기업이 보는 뷰에만 온다(이 기능 전에 만든 결과에는 없다) */
  circular: circularSchema.nullable().optional(),
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

/**
 * 계약 검토 담당의 검토(계약 8장 "계약 검토", 2026-11-19). 두 AI가 합의한 조건을 승인 전에 규칙으로 다시 대조한다.
 * block이 있으면 양쪽 모두 승인할 수 없고(409 REVIEW_BLOCKED), check는 담당자가 확인했다고 표시해야 승인 단추가 켜진다.
 */
export const reviewItemSchema = obj({
  key: z.string(),
  title: z.string(),
  status: z.enum(["block", "check", "ok"]),
  text: z.string(),
  /** 첫 거래 시범 기간 항목만. true면 계약서 초안에 시범 기간이 들어간다 */
  pilot: z.boolean().optional(),
  /** 지난 검수 기록(history) 항목만. 같은 두 회사 사이의 검수 근거 ID */
  evidence: z.array(z.string()).optional(),
});

export const contractReviewSchema = obj({
  status: z.enum(["blocked", "needs_check", "clear"]),
  summary: z.string(),
  items: z.array(reviewItemSchema),
  reviewer: obj({ label: z.string(), kind: z.string() }),
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
  /** 막히면서 지운 승인 쪽(emitter, vendor). 아무도 승인하지 않았거나 막히지 않았으면 빈 배열 */
  clearedApprovals: z.array(z.enum(["emitter", "vendor"])).optional(),
  /** 계약 검토 담당의 검토. 예전 서버는 보내지 않는다 */
  review: contractReviewSchema.nullable().optional(),
  /** 이 대화에 배정된 폐기물마다 허가 확인 상태(결과표와 같은 값, 2026-11-19 뒤) */
  permits: z.array(permitLevelSchema.extend({ streamId: z.string() })).optional(),
  /** 허가증 대조 완료가 아닌 경로가 있으면 true. 서버가 배출 기업의 승인(확정)을 409 PERMIT_UNVERIFIED로 막는다 */
  permitHold: z.boolean().optional(),
});

export const viewDocumentSchema = obj({
  id: z.string(),
  /** request 요청서, plan 이행 계획서, contract 위탁 계약서 초안(계약 검토 담당이 쓴다) */
  kind: z.enum(["request", "plan", "contract"]),
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
  actor: z.enum(["company_agent", "vendor_agent", "validator", "tool", "system", "contract_reviewer"]),
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
    "review",
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
export const dataOriginSchema = z.enum(["real", "demo", "unknown"]);

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
  /** 기록 출처. demo는 시연(가상) 회사 사이의 기록이라 실제 학습·배포 게이트에 세지 않는다 */
  dataOrigin: dataOriginSchema.optional(),
});

const outcomeEvidenceSchema = obj({
  grade: z.string().nullable().optional(),
  unitPrice: z.string().nullable().optional(),
  kg: z.string().nullable().optional(),
});

/** 업체가 실제로 적용한 처리 방식(탄소 계산에 쓴 값)과 출처: 검수 기록에 적음, 기록 당시 업체 정보, 매입이라 재활용으로 봄, 모름 */
export const appliedProcessSchema = obj({
  value: z.string().nullable(),
  source: z.enum(["vendor_input", "vendor_profile", "price", "unknown"]),
  assumed: z.boolean(),
});

/** 정정되기 전 판 하나(그때 업체가 적은 값과 그 근거). reason은 그 판을 만든 정정의 사유(처음 판이면 null) */
export const outcomeRevisionSchema = obj({
  revision: z.number(),
  reason: z.string().nullable(),
  recordedOn: z.string().nullable(),
  recordedAt: z.string().nullable(),
  inspectedOn: z.string(),
  actualGrade: z.string().nullable(),
  actualUnitPriceKrwPerKg: z.number().nullable(),
  actualKg: z.number().nullable(),
  note: z.string().nullable(),
  weighTicket: z.string().nullable(),
  documentName: z.string().nullable(),
  evidenceKind: z.enum(["human", "doc"]),
  evidence: outcomeEvidenceSchema,
  deviation: claimOrNull,
  /** 업체가 적은 실제 처리 방식(재활용·열분해·소각·매립). 적지 않았거나 이 필드 전의 기록이면 null·없음 */
  actualProcess: z.string().nullable().optional(),
  appliedProcess: appliedProcessSchema.nullable().optional(),
});

/**
 * 업체가 확정 뒤 기록한 실제 결과. 검수(계량) 한 건이 하나이고 id는 검수 ID(inspectionId)와 같다.
 * 정정하면 최신 판이 오고 앞 판은 history에 실린다. legacy는 검수일로 키를 만든 2026-11-19 전 기록이다.
 */
export const outcomeSchema = obj({
  type: z.literal("outcome"),
  id: z.string(),
  inspectionId: z.string(),
  revision: z.number(),
  /** 고친 앞 판 번호(처음 판이면 null) */
  supersedes: z.number().nullable(),
  /** 등록·정정 요청 번호(재전송을 한 건으로 묶는다). 예전 기록이면 null */
  requestId: z.string().nullable(),
  /** 이 판을 만든 정정의 사유(처음 판이면 null) */
  reason: z.string().nullable(),
  legacy: z.boolean(),
  /** 계량표 번호(업체가 적었으면) */
  weighTicket: z.string().nullable(),
  documentName: z.string().nullable(),
  createdOn: z.string().nullable(),
  createdAt: z.string().nullable(),
  recordedAt: z.string().nullable(),
  history: z.array(outcomeRevisionSchema),
  sessionId: z.string(),
  threadId: z.string(),
  vendorOrgId: z.string(),
  emitterOrgId: z.string(),
  streamId: z.string(),
  inspectedOn: z.string(),
  actualGrade: z.string().nullable(),
  actualUnitPriceKrwPerKg: z.number().nullable(),
  actualKg: z.number().nullable(),
  /** 업체가 검수 기록에 적은 실제 처리 방식(재활용·열분해·소각·매립). 적지 않았거나 이 필드 전의 기록이면 null·없음 */
  actualProcess: z.string().nullable().optional(),
  /** 탄소 계산에 쓴 처리 방식과 출처(검수 기록에 적음, 기록 당시 업체 정보 등). 이 필드 전의 기록에는 없다 */
  appliedProcess: appliedProcessSchema.optional(),
  note: z.string().nullable(),
  evidenceKind: z.enum(["human", "doc"]),
  evidence: outcomeEvidenceSchema,
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
  dataOrigin: dataOriginSchema.optional(),
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
  /** 답을 기다리는 질문 묶음의 요약과 머리 문장(배출 기업에게만). 기다리는 질문이 없으면 null */
  questionBatch: obj({
    batch: z.number(),
    maxBatches: z.number(),
    maxPerBatch: z.number(),
    count: z.number(),
    open: z.number(),
    last: z.boolean(),
    intro: z.string(),
    note: z.string().nullable(),
  })
    .nullable()
    .optional(),
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
  /** 시연 조직(체험하기에서 읽기 전용으로 보이는 회사) */
  demo: z.boolean().optional(),
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
  /** 저장된 출처 글(도구 ID 등). source는 화면 이름이다. 기술 정보에만 쓴다 */
  sourceRaw: z.string().optional(),
  /** 근거를 만든 판단 도구의 기계 ID(기술 정보에만)와 화면 이름 */
  tool: z.string().optional(),
  toolLabel: z.string().nullable().optional(),
});

/**
 * GET /orgs/{orgId}/report?from=&to=: 재활용·탄소 실적 리포트(배출 기업 본인만).
 * 실적(records)은 업체가 기록한 검수 결과, 예상(planned)은 양쪽이 확정한 합의의 한 달 예상이다. 숫자는 모두 근거가 붙은 claim이다.
 */
/** 실적 줄의 정정 이력 한 판(그때의 값과 근거 ID) */
export const reportRevisionSchema = obj({
  revision: z.number(),
  recordedOn: z.string().nullable(),
  inspectedOn: z.string().nullable(),
  grade: z.string().nullable(),
  kg: z.number().nullable(),
  unitPrice: z.number().nullable(),
  weighTicket: z.string().nullable(),
  reason: z.string().nullable(),
  evidence: outcomeEvidenceSchema,
});

/** 탄소 변화의 계산 범위. 지금은 처리 방식 배출 차이만이다(수거 운송 배출과 신재 대체 효과는 넣지 않는다) */
export const carbonScopeSchema = obj({
  key: z.string(),
  label: z.string(),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  text: z.string(),
});

/** 검수를 기록할 때 옮겨 적은 배출계수(값·단위·판·기준일). 지금 레지스트리의 값이 아니다 */
const carbonFactorSchema = obj({
  evidenceId: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  version: z.number(),
  asOf: z.string(),
  source: z.string(),
}).nullable();

/**
 * 검수 기록 한 건의 탄소 계산 기준(백엔드 outcome_carbon). 검수를 기록할 때 고정하고, 지금 자료를 고쳐도 바뀌지 않는다.
 * recorded: 기록 당시 기준, not_computed: 기록했지만 계수·처리 방식이 없어 계산하지 않음,
 * reconstructed: 이 기능 전의 기록을 합의 당시 계산으로 재구성(계수 일치 확인), unverified: 당시 기준을 확인할 수 없어 계산하지 않음
 */
export const carbonBasisSchema = obj({
  status: z.enum(["recorded", "not_computed", "reconstructed", "unverified"]),
  statusLabel: z.string(),
  /** 고정한 기준 근거(배출 기업만 본다). 근거 패널에서 연다 */
  evidenceId: z.string().nullable(),
  capturedOn: z.string().nullable(),
  capturedBy: z.string().nullable(),
  revision: z.number().nullable(),
  baseline: obj({
    method: z.string().nullable(),
    assumed: z.boolean().nullable(),
    source: z.string().nullable(),
    sourceLabel: z.string().nullable(),
  }),
  applied: obj({
    process: z.string().nullable(),
    source: z.string().nullable(),
    sourceLabel: z.string().nullable(),
    assumed: z.boolean().nullable(),
  }),
  factors: obj({ baseline: carbonFactorSchema, applied: carbonFactorSchema }),
  /** kg당 배출 차이(보낸 곳 계수 − 현행 계수) */
  perKg: z.number().nullable(),
  perKgUnit: z.string(),
  scope: carbonScopeSchema,
  reason: z.string().nullable(),
  notes: z.array(z.string()),
  deal: obj({
    computedOn: z.string().nullable(),
    monthlyKg: z.number().nullable(),
    carbonPerMonth: z.number().nullable(),
  }).nullable(),
});

export const reportRecordSchema = obj({
  id: z.string(),
  /** 검수(계량) 한 건의 ID. 같은 날 같은 폐기물을 두 번 받았으면 두 줄이다 */
  inspectionId: z.string(),
  /** 정정했으면 2 이상(최신 판만 실적에 넣는다) */
  revision: z.number(),
  weighTicket: z.string().nullable(),
  legacy: z.boolean(),
  history: z.array(reportRevisionSchema),
  correctionReason: z.string().nullable(),
  inspectedOn: z.string(),
  streamId: z.string(),
  streamLabel: z.string(),
  streamName: z.string().nullable(),
  vendorOrgId: z.string(),
  vendorName: z.string(),
  /** 업체가 실제로 적용한 처리 방식(검수를 기록할 때 고정). 확인할 수 없으면 null */
  process: z.string().nullable(),
  grade: z.string().nullable(),
  kg: claimOrNull,
  /** +는 매입(받은 돈), −는 처리비(낸 돈) */
  unitPrice: claimOrNull,
  amount: claimOrNull,
  /** 배출계수를 적용한 추정값. 계수가 없거나 당시 기준을 확인할 수 없으면 null(carbonBasis.status) */
  carbon: claimOrNull,
  /** 탄소 변화를 내지 않은 이유(계수 없음, 당시 기준 확인 불가 등). 계산했으면 null */
  carbonNote: z.string().nullable(),
  /** 비교한 현행 처리(검수를 기록할 때 고정). 당시 기준을 확인할 수 없으면 null */
  currentMethod: z.string().nullable(),
  currentMethodAssumed: z.boolean(),
  carbonBasis: carbonBasisSchema,
  /** 실제 무게·단가·등급을 남긴 방식: 검수 문서(doc) 또는 업체 담당자 입력(human) */
  measuredBy: z.enum(["doc", "human"]).nullable(),
});

export const reportPlannedSchema = obj({
  sessionId: z.string(),
  streamId: z.string(),
  streamLabel: z.string(),
  streamName: z.string().nullable(),
  vendorOrgId: z.string(),
  vendorName: z.string(),
  route: z.string().nullable(),
  unitPrice: claimOrNull,
  monthlyAfter: claimOrNull,
  carbon: claimOrNull,
});

/** 회사별 기록에서 검수 한 건을 합의 때의 등급·단가와 견준 결과. null이면 견줄 값이 없다 */
export const memoryCompareSchema = z.enum(["lower", "same", "higher"]).nullable();

/** 회사별 기록의 검수 묶음 요약(평균 없이 건수만). few는 minRecords건 미만이라 참고만 한다 */
export const memorySummarySchema = obj({
  count: z.number(),
  gradeLower: z.number(),
  priceLower: z.number(),
  below: z.number(),
  status: z.enum(["none", "few", "as_agreed", "below"]),
  minRecords: z.number(),
  evidence: z.array(z.string()),
});

export const memoryInspectionSchema = obj({
  inspectionId: z.string(),
  inspectedOn: z.string(),
  sessionId: z.string(),
  streamId: z.string(),
  vendorOrgId: z.string(),
  vendorName: z.string().nullable(),
  agreedGrade: z.string().nullable(),
  actualGrade: z.string().nullable(),
  grade: memoryCompareSchema,
  agreedPrice: claimOrNull,
  actualPrice: claimOrNull,
  price: memoryCompareSchema,
  evidence: z.array(z.string()),
  dataOrigin: z.string(),
});

export const memoryAnswerSchema = obj({
  streamId: z.string(),
  field: z.string(),
  label: z.string(),
  answer: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  unknown: z.boolean(),
  /** 모름으로 답한 뒤 아직 채우지 않았다(다시 묻지 않으므로 자료 화면에서 채운다) */
  stillUnknown: z.boolean(),
  answeredOn: z.string().nullable(),
  sessionId: z.string(),
});

export const memoryCorrectionSchema = obj({
  id: z.string(),
  streamId: z.string(),
  field: z.string(),
  label: z.string(),
  before: z.union([z.string(), z.number()]).nullable(),
  after: z.union([z.string(), z.number()]).nullable(),
  recordedOn: z.string(),
  evidence: z.array(z.string()),
});

/** GET·PUT /orgs/{orgId}/memory: 회사별 기록(지난 답변·검수·교정·거래). 배출 기업 본인만 본다 */
export const orgMemorySchema = obj({
  orgId: z.string(),
  /** false면 계약 검토에 쓰지 않는다(기록은 그대로 둔다) */
  enabled: z.boolean(),
  dataOrigin: z.enum(["real", "demo"]),
  minRecords: z.number(),
  summary: obj({
    streams: z.number(),
    inspections: z.number(),
    below: z.number(),
    answers: z.number(),
    stillUnknown: z.number(),
    corrections: z.number(),
    deals: z.number(),
    vendors: z.number(),
  }),
  streams: z.array(
    obj({
      streamId: z.string(),
      name: z.string(),
      inspections: memorySummarySchema,
      inspectionRows: z.array(memoryInspectionSchema),
      answers: z.array(memoryAnswerSchema),
      corrections: z.array(memoryCorrectionSchema),
    }),
  ),
  deals: z.array(
    obj({ vendorOrgId: z.string(), vendorName: z.string().nullable(), count: z.number(), lastOn: z.string().nullable() }),
  ),
});

export const reportSchema = obj({
  orgId: z.string(),
  period: obj({ from: z.string().nullable(), to: z.string().nullable() }),
  generatedOn: z.string(),
  records: z.array(reportRecordSchema),
  /** 실적이 한 건도 없으면 null. 처리비(fee)는 낸 금액의 크기(양수)다 */
  totals: obj({
    kg: claimOrNull,
    revenue: claimOrNull,
    fee: claimOrNull,
    carbon: claimOrNull,
    count: z.number(),
    /** 탄소 기준 상태별 건수. 합계에는 recorded와 reconstructed만 넣는다 */
    carbonStatus: obj({
      recorded: z.number(),
      not_computed: z.number(),
      reconstructed: z.number(),
      unverified: z.number(),
    }),
  }).nullable(),
  planned: z.array(reportPlannedSchema),
  carbonScope: carbonScopeSchema,
});

// ── 보관장 3D 스캔 (2026-11-20, ~/rs-work/scan/CONTRACT.md 3장) ─────────────────────
// 좌표는 모두 바닥 좌표계(원점은 보인 바닥의 중심, x·y는 바닥 위, z는 위쪽, 단위 m)다.

const xy = z.tuple([z.number(), z.number()]);
const xyz = z.tuple([z.number(), z.number(), z.number()]);

export const scanStatusSchema = z.enum(["processing", "done", "failed"]);
/** 재구성 서버의 단계. 차례를 기다리는 동안은 null이다 */
export const scanStageSchema = z.enum(["geometry", "scale", "floor", "piles", "done"]);

/** 무게를 낸 밀도. weighed: 담당자가 계량한 무게로 보정, stream: 회사가 적은 겉보기 밀도, ref: 문헌값(필름) */
export const scanDensitySchema = obj({
  basis: z.enum(["weighed", "stream", "ref"]),
  lowKgM3: z.number(),
  highKgM3: z.number(),
  label: z.string(),
  evidence: z.array(z.string()),
});

export const scanWeightSchema = obj({ low: claimSchema, high: claimSchema });

export const scanPileSchema = obj({
  id: z.string(),
  name: z.string(),
  center: xy,
  footprint: z.array(xy),
  sizeM: xy,
  yawDeg: z.number(),
  heightM: z.number(),
  volume: claimSchema,
  volumeRangeM3: xy,
  coverage: z.number(),
  thumbnail: z.string().nullable(),
  streamId: z.string().nullable(),
  streamName: z.string().nullable(),
  density: scanDensitySchema.nullable(),
  weight: scanWeightSchema.nullable(),
  weighedKg: claimOrNull,
  note: z.string().nullable(),
  /** 담당자가 "더미 아님"으로 뺀 더미(벽·바닥 자국 등). 합계·무게·정리안에서 빠지고 폐기물·계량값이 없다 */
  excluded: z.boolean(),
});

export const scanLayoutMetricsSchema = obj({
  /** 서로 다른 폐기물이면서 간격이 gapM보다 좁은 더미 쌍 */
  mixedPairs: z.number(),
  minMixedGapM: z.number().nullable(),
  /** Σ부피×상차 거리 ÷ Σ부피 */
  weightedDistanceM: z.number().nullable(),
  footprintM2: z.number(),
  /** 지표마다 계산(calc) 근거 ID. 간격을 잴 쌍이 없으면 minMixedGapM은 null */
  evidence: obj({ mixedPairs: z.string(), minMixedGapM: z.string().nullable(), weightedDistanceM: z.string() }),
});

export const scanLayoutSchema = obj({
  pickup: obj({ x: z.number(), y: z.number(), source: z.enum(["start", "manual"]) }),
  rules: obj({ gapM: z.number(), wallM: z.number(), pickupClearM: z.number(), evidence: z.array(z.string()) }),
  current: scanLayoutMetricsSchema,
  proposal: obj({
    piles: z.array(obj({ id: z.string(), center: xy, footprint: z.array(xy), yawDeg: z.number(), zone: z.string().nullable() })),
    zones: z.array(obj({ streamId: z.string(), name: z.string(), polygon: z.array(xy) })),
    metrics: scanLayoutMetricsSchema,
    moved: z.number(),
    /** 폐기물을 지정했지만 옮길 자리가 없어 제자리에 둔 더미 ID. 그 폐기물의 더미가 모두 제자리면 zones에 그 폐기물이 없다 */
    kept: z.array(z.string()),
  }).nullable(),
  unavailable: z.string().nullable(),
});

export const scanViewSchema = obj({
  id: z.string(),
  orgId: z.string(),
  createdAt: z.string(),
  source: z.enum(["video", "photos"]),
  frameCount: z.number(),
  status: scanStatusSchema,
  progress: obj({ stage: scanStageSchema.nullable(), ratio: z.number() }).nullable(),
  failure: obj({ message: z.string() }).nullable(),
  summary: obj({
    pileCount: z.number(),
    volume: claimSchema,
    weight: scanWeightSchema.nullable(),
    /** 무게를 산정 보류한 더미 수(계량값이나 밀도가 없음) */
    weightPending: z.number(),
    /** "더미 아님"으로 뺀 더미 수(pileCount에는 들지 않는다) */
    excludedCount: z.number(),
    floorAreaM2: z.number().nullable(),
    /** 보인 바닥 넓이(m², 재구성 근거). 바닥을 찾지 못했으면 null */
    floorArea: claimOrNull,
  }).nullable(),
  piles: z.array(scanPileSchema),
  layout: scanLayoutSchema.nullable(),
  floor: obj({ polygon: z.array(xy), areaM2: z.number() }).nullable(),
  camera: obj({ path: z.array(xyz) }).nullable(),
  bounds: obj({ min: xyz, max: xyz }).nullable(),
  pointsCount: z.number(),
  quality: obj({ frames: z.number(), scaleSpreadPct: z.number().nullable(), notes: z.array(z.string()) }).nullable(),
});

export const scanListSchema = obj({
  /** 지금 3D 분석을 받을 수 있는지(재구성 서버가 답하는지). false면 올리기를 숨긴다 */
  canScan: z.boolean(),
  scans: z.array(scanViewSchema),
});
