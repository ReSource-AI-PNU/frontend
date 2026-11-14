const MINUS = "−";

const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 부호를 항상 붙인다. 음수는 하이픈 대신 U+2212를 쓴다. 예: +195,000 / −200,000 */
export function formatSigned(value: number, fractionDigits = 0): string {
  const abs = Math.abs(value).toLocaleString("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  if (value > 0) return `+${abs}`;
  if (value < 0) return `${MINUS}${abs}`;
  return abs;
}

export function formatNumber(value: number): string {
  return integer.format(value).replace("-", MINUS);
}

export type Trend = "gain" | "loss" | "neutral";

export function trendOf(value: number): Trend {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "neutral";
}
