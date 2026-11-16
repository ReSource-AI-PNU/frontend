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
 * 단가를 낱말과 크기로 적는다. 처리비(role treatmentFee)는 값이 음수 그대로 오므로 크기로 적는다("처리비 80 원/kg").
 * role이 없는 단가(실제 결과의 기준표 단가 등)는 부호로 가린다.
 */
export function formatUnitPrice(claim: Claim | null | undefined): string | null {
  if (!claim || typeof claim.value !== "number") return formatClaim(claim);
  const side = claim.role === "treatmentFee" ? "처리비" : priceSide(claim.value);
  return `${side} ${withUnit(formatNumber(Math.abs(claim.value)), claim.unit)}`;
}

/** 근거 없이 숫자만 있는 단가(입력값 되읽기)를 같은 방식으로 적는다. */
export function formatSignedPrice(value: number, unit = "원/kg"): string {
  return `${priceSide(value)} ${withUnit(formatNumber(Math.abs(value)), unit)}`;
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

const PROVIDER_LABEL: Record<string, string> = { foundry: "Foundry", ollama: "Ollama" };

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
  not_opened: "대화 안 엶",
  open: "대화 중",
  agreed: "합의",
  declined: "거절",
  handoff: "담당자 인계",
  confirmed: "확정",
};

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
      running: "에이전트 대화 중",
      awaiting_answers: "담당자 답변 대기",
      awaiting_approval: "승인 대기",
      confirmed: "확정",
    }[status] ?? status
  );
}
