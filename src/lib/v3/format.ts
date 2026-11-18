import type { Claim } from "./types";

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 });

export function formatNumber(value: number): string {
  return number.format(value);
}

function withUnit(text: string, unit: string | null): string {
  if (!unit) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

/** 값과 단위를 한 줄로. 값이 없으면 null을 돌려주고 화면은 "확인 필요"를 그린다. */
export function formatClaim(claim: Claim | null | undefined, signed = false): string | null {
  if (!claim || claim.value === null || claim.value === undefined) return null;
  if (typeof claim.value === "string") return claim.value;
  const sign = signed && claim.value > 0 ? "+" : "";
  return withUnit(`${sign}${formatNumber(claim.value)}`.replace("-", "−"), claim.unit);
}

/**
 * 업체가 내는 단가인지. 백엔드가 claim에 붙이는 role로 가린다(계약 7장 "사람이 읽는 이름").
 * unitPrice는 배출 기업이 받는 매입 단가, treatmentFee는 배출 기업이 내는 처리비다.
 * 현행 처리 단가(currentUnitCost, 내는 돈을 양수로 적는다)와 참고 시세(referencePrice)는 여기에 들지 않는다.
 */
export function isUnitPriceClaim(claim: Claim | null | undefined): boolean {
  return claim?.role === "unitPrice" || claim?.role === "treatmentFee";
}

/** 단가 부호 풀이: 양수는 "매입"(배출 기업이 받는다), 음수는 "처리비"(배출 기업이 낸다). */
export function priceSide(value: number): "매입" | "처리비" | "무상" {
  return value > 0 ? "매입" : value < 0 ? "처리비" : "무상";
}

/**
 * 단가를 낱말과 크기로 적는다. 처리비(role treatmentFee)는 값이 음수 그대로 오므로 크기로 적는다("처리비 kg당 80원").
 * role이 없는 단가(실제 결과의 기준표 단가 등)는 부호로 가린다.
 */
export function formatUnitPrice(claim: Claim | null | undefined): string | null {
  if (!claim || typeof claim.value !== "number") return formatClaim(claim);
  const side = claim.role === "treatmentFee" ? "처리비" : priceSide(claim.value);
  return `${side} ${perKg(Math.abs(claim.value), claim.unit)}`;
}

/** 근거 없이 숫자만 있는 단가(입력값 되읽기)를 같은 방식으로 적는다. */
export function formatSignedPrice(value: number, unit = "원/kg"): string {
  return `${priceSide(value)} ${perKg(Math.abs(value), unit)}`;
}

/** 단가는 화면 어디서나 "kg당 200원"으로 적는다. 단위가 원/kg이 아니면 값과 단위를 그대로 적는다. */
function perKg(size: number, unit: string | null): string {
  return unit === "원/kg" ? `kg당 ${formatNumber(size)}원` : withUnit(formatNumber(size), unit);
}

/** 가정값처럼 근거 ID만 달린 값과 단위. 값 하나로 적을 수 없으면 null */
export function formatValue(value: number | string | null | undefined, unit: string | null): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return withUnit(formatNumber(value).replace("-", "−"), unit);
}

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** 서버가 준 시각(UTC)을 보는 사람의 시간대로 적는다. 읽지 못하면 받은 글자를 그대로 돌려준다. */
export function formatDateTime(iso: string, part: "date" | "time" | "both" = "both"): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const parts = Object.fromEntries(dateTime.formatToParts(at).map((item) => [item.type, item.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return part === "date" ? date : part === "time" ? time : `${date} ${time}`;
}

export function isAssumed(claim: Claim | null | undefined): boolean {
  return Boolean(claim?.evidence.some((id) => id.startsWith("assumption:")));
}

const PROVIDER_LABEL: Record<string, string> = {
  foundry: "Foundry",
  ollama: "Ollama",
  anthropic: "Anthropic",
};

/**
 * 실제로 답을 쓴 구현의 이름. 규칙 정책이면 백엔드가 준 이름("규칙 정책(모델 미연결)")을 그대로 쓴다.
 * 일어나지 않은 모델 호출을 모델 이름으로 보여 주지 않는다.
 */
export function modelLabel(model: { provider: string; name: string } | null | undefined): string {
  if (!model) return "확인 필요";
  // 규칙 정책과 진행기(코드)는 모델이 아니다. 백엔드가 준 이름만 쓴다
  if (model.provider === "rule" || model.provider === "code") return model.name;
  return `${PROVIDER_LABEL[model.provider] ?? model.provider} ${model.name}`;
}

export const ROUTE_LABEL: Record<string, string> = {
  reuse: "공정 재투입",
  sell: "매각",
  treat: "위탁 처리",
  keep: "현행 유지",
};

export const STATUS_LABEL = {
  calculated: "확정",
  conditional: "조건부",
  needs_information: "확인 필요",
} as const;

export const PHASE_LABEL: Record<string, string> = {
  identify: "식별·분류",
  discover: "업체 탐색",
  converse: "업체와 대화",
  propose: "최적안 계산",
  approval: "승인",
  done: "끝",
};

export const MESSAGE_LABEL: Record<string, string> = {
  inquiry: "문의",
  question: "질문",
  answer: "답변",
  offer: "제안",
  counter: "역제안",
  conditional: "조건부",
  decline: "거절",
  handoff: "담당자 인계",
  confirm: "확정",
};

export const THREAD_LABEL: Record<string, string> = {
  not_opened: "아직 묻지 않음",
  open: "조건을 묻는 중",
  agreed: "조건이 맞음",
  declined: "거절",
  handoff: "담당자가 이어받음",
  confirmed: "확정",
};

/**
 * 결과 머리 한 줄(배출 기업). 폐기물 count가지 가운데 placed가지에 보낼 곳(업체 또는 공정 재투입)을 찾았을 때.
 * 한 가지뿐이면 "모두"를 쓰지 않는다: "1가지 폐기물의 보낼 곳을 찾았습니다." 두 가지 이상이면 "n가지 모두 …".
 */
export function placedHeadline(count: number, placed: number): string {
  if (placed <= 0) return "지금보다 나은 곳을 찾지 못했습니다.";
  if (placed >= count) return count === 1 ? "1가지 폐기물의 보낼 곳을 찾았습니다." : `${count}가지 모두 보낼 곳을 찾았습니다.`;
  return `${count}가지 가운데 ${placed}가지는 보낼 곳을 찾았습니다.`;
}

/** 지금 보여 줄 질문 묶음: 답하지 않은 질문이 남은 가장 앞 묶음(batch)의 질문 전부. batch가 없으면 답하지 않은 질문 전부 */
export function currentBundle<T extends { answered: boolean; batch?: number | null }>(questions: T[]): T[] {
  const open = questions.filter((item) => !item.answered);
  if (open.length === 0) return [];
  const batches = open.map((item) => item.batch).filter((batch): batch is number => typeof batch === "number" && Number.isFinite(batch));
  if (batches.length === 0) return open;
  const batch = Math.min(...batches);
  return questions.filter((item) => item.batch === batch);
}

type BatchSummary = { batch: number; count: number; open: number; intro: string; note: string | null };

/**
 * 질문 묶음의 머리말과 덧붙임. 백엔드가 진단 뷰에 questionBatch(intro, note)를 주고 그 묶음이 지금 보이는 묶음과 같으면
 * 그 문장을 쓴다. 없으면(예전 서버, 실행 중 스트림으로 막 받은 묶음) 같은 말투로 만든다: 첫 묶음 "찾기 전에 n가지를
 * 여쭙겠습니다."(뒤에 더 물을 수 있어 "…만"이라고 쓰지 않는다), 둘째 묶음 "n가지만 더 여쭙겠습니다. 이번이 마지막
 * 질문입니다." 일부 답했으면 남은 수를 덧붙인다. 숫자는 늘 그 묶음의 질문 수다.
 */
export function questionIntro(
  bundle: { answered: boolean; batch?: number | null }[],
  summary?: BatchSummary | null,
): { intro: string; note: string | null } {
  const total = bundle.length;
  const open = bundle.filter((item) => !item.answered).length;
  const batch = bundle[0]?.batch ?? 1;
  const left = open < total ? `${total}가지 가운데 ${open}가지가 남았습니다.` : null;
  if (summary && summary.batch === batch) {
    return { intro: summary.intro, note: [left, summary.note].filter(Boolean).join(" ") || null };
  }
  const intro = batch <= 1 ? `찾기 전에 ${total}가지를 여쭙겠습니다.` : `${total}가지만 더 여쭙겠습니다. 이번이 마지막 질문입니다.`;
  return { intro, note: [left, batch <= 1 ? "답을 보고 한 번 더 여쭐 수 있습니다." : null].filter(Boolean).join(" ") || null };
}

/**
 * 오염도·수분 값 아래에 적는 출처(streams[].contaminationBasis·moistureBasis). 담당자 답이면 claim 이름("오염도(담당자 답)")을
 * 쓴다. 출처를 모르면 null.
 */
export function basisNote(basis: string | null | undefined, claim: Claim | null | undefined): string | null {
  if (basis === "answered") return claim?.label ?? "담당자 답";
  if (basis === "measured") return "측정";
  if (basis === "photo_estimate") return "사진 추정";
  return null;
}

/** 담당자 질문과 "모르는 값"에 나오는 항목 이름 */
export const FIELD_LABEL: Record<string, string> = {
  moisturePct: "수분",
  contaminationPct: "오염도",
  monthlyKg: "월 발생량",
  origin: "출처",
  form: "형태",
  material: "재질",
  lotSame: "같은 로트 여부",
  terms: "받는 조건",
};

/** 교정할 수 있는 항목(POST /sessions/{id}/corrections의 field) */
export const CORRECTION_FIELD_LABEL: Record<string, string> = {
  box: "탐지 박스",
  material: "재질",
  origin: "출처",
  form: "형태",
  contaminant: "혼입물",
  grade: "등급",
  contaminationPct: "오염도",
  moisturePct: "수분",
};

/** 결과 한 장 확인 항목(checks[].key)의 화면 이름 */
export const CHECK_KEY_LABEL: Record<string, string> = {
  contaminationPct: "오염도",
  moisturePct: "수분",
  contamination_basis: "오염도 출처",
  moisture_basis: "수분 출처",
  form: "형태",
  monthly_kg_basis: "물량 출처",
  material_basis: "재질 출처",
  mixture: "혼입물",
  permit: "허가 품목",
  current_assumed: "현행 처리",
  current_method: "현행 처리 방법(가정)",
  transport: "운송비",
  carbon: "탄소",
  vendor_condition: "업체 조건",
  price_differs: "단가 차이",
  unresolved: "모르는 값",
  skipped: "건너뜀",
  handoff: "담당자 인계",
  min_volume: "최소 물량",
  loading: "적재(무게·부피)",
  loading_volume: "부피 적재",
};

/** 진단 상태. 합의 없이 끝났거나 합의한 대화가 모두 담당자에게 넘어가면 idle인데 phase가 done이다. */
export function sessionLabel(status: string, phase: string, started: boolean): string {
  if (status === "idle") return phase === "done" ? "합의 없이 끝남" : started ? "이어서 실행 대기" : "실행 전";
  return (
    {
      running: "AI가 조건을 묻는 중",
      awaiting_answers: "담당자 답변 대기",
      awaiting_approval: "승인 대기",
      confirmed: "확정",
    }[status] ?? status
  );
}

/**
 * 초안 거부 코드의 풀이(계약 8장 "초안 거부 코드"). 메시지의 validation.rejections[]와 실행 기록의
 * detail.rejections[]·detail.codes에는 코드와 코드별 일반 문장만 온다(거부된 초안의 숫자·조항은 오지 않는다).
 * 화면은 코드로 풀이를 고르고, 표에 없는 코드는 서버가 준 일반 문장을 쓴다.
 */
export const REJECTION_LABEL: Record<string, string> = {
  NUMBER_OUTSIDE_PLACEHOLDER: "근거에 묶이지 않은 숫자를 본문에 직접 적었습니다",
  UNKNOWN_PLACEHOLDER: "본문이 가리키는 값이 메시지에 실려 있지 않았습니다",
  UNUSED_CLAIM: "실어 놓고 본문에 쓰지 않은 값이 있었습니다",
  CLAIM_WITHOUT_EVIDENCE: "근거가 없는 값이 있었습니다",
  EVIDENCE_NOT_FOUND: "근거 저장소에 없는 근거를 썼습니다",
  EVIDENCE_FORBIDDEN: "보내는 조직이 볼 수 없는 근거를 썼습니다",
  EVIDENCE_EXPIRED: "유효 기한이 지난 근거를 썼습니다",
  VALUE_MISMATCH: "메시지의 값이 근거의 값과 달랐습니다",
  UNIT_MISMATCH: "값의 단위를 근거의 단위로 바꿀 수 없었습니다",
  QUOTE_MISMATCH: "조항 인용이 원문과 글자 그대로 같지 않았습니다",
  UNKNOWN_CLAIM_REF: "쓸 수 있는 값 목록에 없는 값을 가리켰습니다",
  TYPE_NOT_ALLOWED: "지금 보낼 수 없는 종류의 메시지였습니다",
  APPROVAL_REQUIRED: "양쪽 담당자 승인 전에 확정을 보내려 했습니다",
  THREAD_RULE: "대화 규칙에 맞지 않는 메시지였습니다",
  UNKNOWN_STREAM: "이 대화에 없는 폐기물을 적었습니다",
  PERMIT_MISMATCH: "허가 품목이 맞지 않는 폐기물에 조건을 내려 했습니다",
  UNBACKED_TERM:
    "숫자 없이 조건을 뜻하는 낱말(무상, 반값, 주말, 매일, 전량 등)을 그에 해당하는 조건 항목이나 값 없이 썼습니다",
  TOO_MANY_TOOL_ROUNDS: "판단 도구를 정해진 횟수보다 많이 부르려 했습니다",
  INVALID_OUTPUT: "응답 형식이 맞지 않았습니다",
  MODEL_ERROR: "모델 호출에 실패했습니다",
  REJECTED: "메시지가 근거 확인을 통과하지 못했습니다",
};

/** 거부 코드 하나의 풀이. 가드레일과 다른 배출 기업 관련 코드는 앞머리로 묶어 푼다. */
export function rejectionLabel(code: string, fallback?: string | null): string {
  if (REJECTION_LABEL[code]) return REJECTION_LABEL[code];
  if (code.startsWith("GUARDRAIL_TERMS")) return "조건을 내는 메시지의 조건 항목이 없거나 값과 맞지 않았습니다";
  if (code.startsWith("GUARDRAIL_")) return "업체 가드레일 밖의 조건이었습니다";
  if (code.startsWith("OTHER_EMITTER")) return "다른 배출 기업의 정보를 드러내는 내용이었습니다";
  return fallback || REJECTION_LABEL.REJECTED;
}

/**
 * 승인을 막는 사유 코드의 풀이(계약 8장 "승인을 막는 사유 코드"). approvals[].blockedCodes에 온다.
 * 세 코드 밖의 값은 근거 검증기의 거부 코드이고 "지금 다시 검증했더니 통과하지 못한다"는 뜻이다.
 */
export const BLOCK_CODE_LABEL: Record<string, string> = {
  EVIDENCE_CHANGED: "대화에서 인용한 근거가 합의 뒤에 바뀌었거나 사라졌습니다",
  STREAM_CHANGED: "합의한 뒤에 배정된 폐기물의 자료(재질, 물량, 측정값 등)가 바뀌었습니다",
  VENDOR_TERMS_CHANGED: "합의한 뒤에 업체가 매입 기준표·허가 품목·가드레일을 바꿔 합의 조건에 영향을 줍니다",
  VALUE_MISMATCH: "메시지의 값이 지금 근거의 값과 다릅니다",
  EVIDENCE_EXPIRED: "인용한 근거의 유효 기한이 지났습니다",
  EVIDENCE_FORBIDDEN: "인용한 근거의 열람 권한이 닫혔습니다",
  EVIDENCE_NOT_FOUND: "인용한 근거가 근거 저장소에 없습니다",
  UNIT_MISMATCH: "메시지의 단위를 지금 근거의 단위로 바꿀 수 없습니다",
  QUOTE_MISMATCH: "조항 인용이 지금 원문과 같지 않습니다",
};

export function blockCodeLabel(code: string): string {
  return BLOCK_CODE_LABEL[code] ?? rejectionLabel(code, "근거를 다시 확인했더니 통과하지 못했습니다");
}

export type BlockNotice = {
  /** rerun: 다시 실행하면 같은 대화를 새 조건으로 이어 간다. rediagnose: 새 진단이 필요하다 */
  action: "rerun" | "rediagnose";
  headline: string;
};

/**
 * 막힌 승인에 무엇을 해야 하는지. blockedReason 문장이 아니라 blockedCodes로 정한다.
 *  - VENDOR_TERMS_CHANGED만 걸렸으면 POST /sessions/{id}/run을 다시 부르면 같은 대화에서 재협상한다.
 *  - STREAM_CHANGED가 함께 걸린 대화는 다시 열리지 않는다. 자료가 바뀐 것이므로 진단을 새로 한다.
 *  - EVIDENCE_CHANGED와 검증기 코드만 있으면 진단을 새로 한다.
 */
export function blockNotice(codes: string[]): BlockNotice | null {
  if (codes.length === 0) return null;
  const has = (code: string) => codes.includes(code);
  if (has("VENDOR_TERMS_CHANGED") && !has("STREAM_CHANGED")) {
    return { action: "rerun", headline: "업체가 조건을 바꿨습니다. 다시 실행하면 새 조건으로 이어 갑니다" };
  }
  if (has("STREAM_CHANGED") || has("EVIDENCE_CHANGED")) {
    return { action: "rediagnose", headline: "자료가 바뀌었습니다. 새 진단이 필요합니다" };
  }
  return { action: "rediagnose", headline: "근거를 다시 확인했더니 통과하지 못했습니다. 새 진단이 필요합니다" };
}

/**
 * 막힌 합의에서 지운 승인을 알리는 문장. approvals[].clearedApprovals(지운 쪽: emitter, vendor)가 비어 있지 않을 때만
 * 쓰고, 비었거나 없으면 null이다(승인한 적이 없으면 "지웠다"고 하지 않는다).
 */
export function clearedApprovalsText(approval: { clearedApprovals?: ("emitter" | "vendor")[] }): string | null {
  const sides = new Set(approval.clearedApprovals ?? []);
  if (sides.size === 0) return null;
  if (sides.has("emitter") && sides.has("vendor")) return "앞서 한 승인은 양쪽 모두 지워졌습니다.";
  return sides.has("emitter") ? "앞서 한 배출 기업의 승인은 지워졌습니다." : "앞서 한 처리 업체의 승인은 지워졌습니다.";
}

/** 판단 그래프 엣지의 종류(graph.edges[].kind) */
export const EDGE_KIND_LABEL: Record<string, string> = {
  permit: "허가 품목",
  criterion: "매입 기준",
  assignment: "최적안 배정",
  excluded: "뺀 폐기물",
  regulation: "규정",
  document: "근거 문서",
};

/**
 * 판단 도구를 누가 불렀는지(events[].detail.calledBy). 모르는 값이면 null.
 * 사용자 화면에 보이므로 구현 이름(규칙 정책, 모델 공급자)은 쓰지 않는다. 구현은 운영 화면의 modelLabel로만 본다.
 */
export function calledByLabel(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value === "code" || value === "orchestrator") return "정해진 순서에 따라 부름";
  if (value.startsWith("model:")) return "AI가 부름";
  return null;
}
