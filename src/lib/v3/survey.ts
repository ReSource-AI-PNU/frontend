export type PriceCandidate = {
  streamId: string;
  streamName: string;
  vendorOrgId: string;
  vendorName: string;
  criterionId: string;
  material: string;
  form: string | null;
  low: number;
  high: number;
  monthlyLow: number | null;
  monthlyHigh: number | null;
  moneyEvidence?: string[];
  differenceLow?: number | null;
  differenceHigh?: number | null;
  evidence: string[];
  note: string;
};
export type RangeQuote = {
  id: string;
  orgId: string;
  streamId: string;
  streamName: string;
  vendorOrgId: string;
  vendorName: string;
  low: number;
  high: number;
  status: "range" | "offered" | "accepted";
  revision: number;
  confirmed: string[];
  evidence: string[];
  stale?: boolean;
  facts: Record<string, unknown>;
  quality: Record<string, unknown>;
  history: { low: number; high: number; reason: string; at: string }[];
  route?: {
    cost: Record<string, { value: number; unit: string; evidence: string[] }>;
    loading: Record<
      string,
      { value: number; unit: string; evidence: string[] }
    >;
    checks: { text: string; status: string }[];
    note: string;
  };
};
export type SharedPhoto = {
  streamName?: string;
  id: string;
  streamId: string;
  sharedWith: string[];
  createdAt: string;
};
export type SurveyData = {
  recipients?: { streamId: string; vendorOrgId: string; vendorName: string }[];
  role: string;
  candidates: PriceCandidate[];
  quotes: RangeQuote[];
  photos: SharedPhoto[];
  sharedPhotos: SharedPhoto[];
};
export const FACT_LABELS: Record<string, string> = {
  material: "재질 자료 확인",
  quality: "품질·검수 조건 확인",
  transport: "수거·운반비 조건 확인",
};
/** 공개 범위와 거래별 협상 범위에서만 줄어들 수 있다. 서버도 별도로 검사한다. */
export function narrower(
  low: number,
  high: number,
  before: { low: number; high: number },
) {
  return (
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low >= before.low &&
    high <= before.high &&
    low <= high
  );
}
export function rangeText(low: number, high: number) {
  const show = (value: number) =>
    value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return low === high ? `${show(low)}원/kg` : `${show(low)}~${show(high)}원/kg`;
}

/** 처음 고르는 합산 월은 사업장 기준 시간대다. 월말 UTC 때문에 지난달이 선택되지 않게 한다. */
export function monthInSeoul(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}
