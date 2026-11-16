import type { Claim } from "./types";

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 });

export function formatNumber(value: number): string {
  return number.format(value);
}

/** 값과 단위를 한 줄로. 값이 없으면 null을 돌려주고 화면은 "확인 필요"를 그린다. */
export function formatClaim(claim: Claim | null | undefined, signed = false): string | null {
  if (!claim || claim.value === null || claim.value === undefined) return null;
  if (typeof claim.value === "string") return claim.value;
  const sign = signed && claim.value > 0 ? "+" : "";
  const text = `${sign}${formatNumber(claim.value)}`.replace("-", "−");
  if (!claim.unit) return text;
  return claim.unit === "%" ? `${text}%` : `${text} ${claim.unit}`;
}

export function isAssumed(claim: Claim | null | undefined): boolean {
  return Boolean(claim?.evidence.some((id) => id.startsWith("assumption:")));
}

export const ROUTE_LABEL: Record<string, string> = {
  reuse: "공정 재투입",
  sell: "매각",
  bundle: "묶음 수거",
  pyrolysis: "열분해",
  incinerate: "소각(현행 유지)",
};

export const STATUS_LABEL = {
  calculated: "확정",
  conditional: "조건부",
  needs_information: "확인 필요",
} as const;

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
