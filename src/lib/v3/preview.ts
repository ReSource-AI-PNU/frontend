/**
 * 소개 화면의 결과 미리보기. 체험하기(/demo)가 여는 것과 같은 시연 찾기의 진단 뷰에서 숫자를 꺼낸다.
 * 화면에 손으로 적은 숫자를 두지 않기 위함이다(숫자는 체험하기의 실제 결과와 같아야 한다).
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/preview.test.ts).
 */
import { formatNumber } from "./format.ts";
import { numberOf, priceText, signedWon, won } from "./money.ts";
import type { Claim } from "./types";

export type PreviewRow = {
  streamId: string;
  name: string;
  /** "한 달 400 kg" */
  amount: string | null;
  vendor: string;
  /** "조건 확인 뒤 확정" 같은 상태. 옮길 곳이 없으면 null */
  state: string | null;
  price: string | null;
  /** "+180,000원" */
  diff: string | null;
  sign: -1 | 0 | 1;
};

export type DemoPreview = {
  /** "폐기물 4가지를 받아 줄 곳을 찾아 주세요." */
  request: string;
  headline: string;
  /** "지금은 한 달에 387,500원을 내고 있습니다. 조건이 확인되면 한 달에 297,000원을 받게 됩니다." */
  money: string | null;
  rows: PreviewRow[];
  /** 한 달 합계 "+684,500원" */
  total: string | null;
  totalSign: -1 | 0 | 1;
};

const STATUS_WORD: Record<string, string> = {
  calculated: "조건 확정",
  conditional: "조건 확인 뒤 확정",
  needs_information: "값 확인 필요",
};

type StreamLike = { id: string; name: string; monthlyKg?: Claim | null };
type AssignmentLike = {
  streamId: string;
  vendorOrgId: string | null;
  vendorName: string | null;
  route: string | null;
  status: string;
  unitPrice: Claim | null;
  difference: Claim | null;
};
type ViewLike = {
  streams: StreamLike[];
  result: {
    status: string;
    assignments: AssignmentLike[];
    totals: { monthlyNow: Claim | null; monthlyAfter: Claim | null; difference: Claim | null };
  } | null;
};

const signOf = (claim: Claim | null | undefined): -1 | 0 | 1 => {
  const value = numberOf(claim);
  return value === null || value === 0 ? 0 : value > 0 ? 1 : -1;
};

/** 한 달 손익 문장(결과 카드의 MoneySentence와 같은 말) */
function moneySentence(totals: NonNullable<ViewLike["result"]>["totals"], conditional: boolean): string | null {
  const now = numberOf(totals.monthlyNow);
  const after = numberOf(totals.monthlyAfter);
  const parts: string[] = [];
  if (now !== null) parts.push(`지금은 한 달에 ${won(totals.monthlyNow)}을 ${now < 0 ? "내고" : "받고"} 있습니다.`);
  if (after !== null) {
    parts.push(`${conditional ? "조건이 확인되면" : "이대로 바꾸면"} 한 달에 ${won(totals.monthlyAfter)}을 ${after < 0 ? "내게" : "받게"} 됩니다.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** 진단 뷰에서 미리보기를 만든다. 결과가 없으면 null(화면은 숫자 없이 체험하기로 잇는다) */
export function previewOf(view: ViewLike | null | undefined): DemoPreview | null {
  const result = view?.result;
  if (!view || !result || result.assignments.length === 0) return null;
  const count = result.assignments.length;
  const rows = result.assignments.map((item): PreviewRow => {
    const stream = view.streams.find((entry) => entry.id === item.streamId);
    const kg = numberOf(stream?.monthlyKg);
    const reused = item.route === "reuse";
    const placed = Boolean(item.vendorOrgId);
    return {
      streamId: item.streamId,
      name: stream?.name ?? "폐기물",
      amount: kg === null ? null : `한 달 ${formatNumber(kg)} kg`,
      vendor: reused ? "사내 공정에 다시 넣기" : placed ? (item.vendorName ?? "업체") : "지금 방식 그대로",
      state: placed ? (STATUS_WORD[item.status] ?? null) : null,
      price: reused ? "신재 구입을 줄입니다" : (priceText(item.unitPrice) ?? null),
      diff: signedWon(item.difference) ?? null,
      sign: signOf(item.difference),
    };
  });
  const placed = result.assignments.filter((item) => item.vendorOrgId || item.route === "reuse").length;
  return {
    request: `폐기물 ${view.streams.length}가지를 받아 줄 곳을 찾아 주세요.`,
    headline:
      placed === 0
        ? "지금보다 나은 곳을 찾지 못했습니다."
        : placed === count
          ? `${count}가지 모두 보낼 곳을 찾았습니다.`
          : `${count}가지 가운데 ${placed}가지는 보낼 곳을 찾았습니다.`,
    money: moneySentence(result.totals, result.status === "conditional"),
    rows,
    total: signedWon(result.totals.difference) ?? null,
    totalSign: signOf(result.totals.difference),
  };
}
