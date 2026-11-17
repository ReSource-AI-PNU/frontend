/**
 * 돈과 단가를 문장에 맞춰 적는다. 결과 카드(src/components/agent/result-card.tsx)와 소개 화면의 미리보기가 같이 쓴다.
 * 네트워크도 React도 부르지 않는 순수 함수다.
 */
import { formatNumber, formatUnitPrice } from "./format.ts";
import type { Claim } from "./types";

export function numberOf(claim: Claim | null | undefined): number | null {
  return claim && typeof claim.value === "number" ? claim.value : null;
}

/** "387,500원"처럼 크기만 적는다. 내는지 받는지는 문장이 말한다. */
export function won(claim: Claim | null | undefined): string | undefined {
  const value = numberOf(claim);
  return value === null ? undefined : `${formatNumber(Math.abs(value))}원`;
}

/** "+180,000원"처럼 부호를 붙여 적는다(빼기는 U+2212). */
export function signedWon(claim: Claim | null | undefined): string | undefined {
  const value = numberOf(claim);
  if (value === null) return undefined;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}원`;
}

/** 단가를 "매입 kg당 200원", "처리비 kg당 80원"으로 적는다. 단위가 원/kg이 아니면 원래 표기를 쓴다. */
export function priceText(claim: Claim | null | undefined): string | undefined {
  const value = numberOf(claim);
  if (value === null || claim?.unit !== "원/kg") return formatUnitPrice(claim) ?? undefined;
  if (value === 0 && claim.role !== "treatmentFee") return "무상 수거";
  const side = claim.role === "treatmentFee" || value < 0 ? "처리비" : "매입";
  return `${side} kg당 ${formatNumber(Math.abs(value))}원`;
}
