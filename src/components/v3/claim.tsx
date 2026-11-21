"use client";

import { Fragment } from "react";
import { splitClaimText } from "@/lib/v3/claim-text";
import { formatClaim, formatUnitPrice, isAssumed, isUnitPriceClaim } from "@/lib/v3/format";
import type { Claim } from "@/lib/v3/types";
import { useV3 } from "./context";

export function NeedsCheck() {
  return (
    <span className="text-[13px] font-medium text-warn">확인 필요</span>
  );
}

/**
 * 숫자나 조항 하나. 누르면 근거 패널이 열린다. 값이 없으면 "확인 필요".
 * 업체 단가는 부호 대신 "매입"(받는 돈)과 "처리비"(내는 돈)로 풀어 보여 준다. 처리비는 값이 음수로 오지만 크기로 적는다.
 * 단가인지는 claim의 role(unitPrice, treatmentFee)로 가린다.
 */
export function ClaimValue({
  claim,
  signed = false,
  price,
  inline = false,
  display,
  hideAssumed = false,
  title,
  className = "",
}: {
  claim: Claim | null | undefined;
  signed?: boolean;
  /** 단가로 그릴지. 주지 않으면 claim의 role로 가린다 */
  price?: boolean;
  /**
   * 문장 안의 값인지. 백엔드 문장이 "매입 단가는 …", "처리비는 …"으로 이미 낱말을 쓰므로
   * 단가는 낱말을 다시 붙이지 않고 크기만 적는다.
   */
  inline?: boolean;
  /** 문장에 맞춰 다르게 적을 때(예: "387,500원"). 근거와 가정 표시는 그대로 붙는다 */
  display?: string;
  /** 가정 표시를 값 옆에 붙이지 않는다. 표의 숫자 칸처럼 줄을 맞춰야 할 때 쓰고, 표시는 부르는 쪽이 따로 한다 */
  hideAssumed?: boolean;
  title?: string;
  className?: string;
}) {
  const { openEvidence } = useV3();
  const asPrice = price ?? isUnitPriceClaim(claim);
  const text =
    display !== undefined && claim
      ? display
      : asPrice && inline && claim && typeof claim.value === "number"
      ? formatClaim({ ...claim, value: Math.abs(claim.value) })
      : asPrice
        ? formatUnitPrice(claim)
        : formatClaim(claim, signed);
  if (!claim || text === null) return <NeedsCheck />;
  const assumed = isAssumed(claim);
  const tone =
    signed && !asPrice && typeof claim.value === "number"
      ? claim.value > 0
        ? "text-gain"
        : claim.value < 0
          ? "text-loss"
          : ""
      : "";
  const body = (
    <>
      {claim.kind === "clause" ? `“${text}”` : text}
      {assumed && !hideAssumed ? (
        <span className="ml-1 align-baseline text-[11px] font-normal text-muted">{claim.evidenceClass === "policy" ? "운영 정책" : "가정"}</span>
      ) : null}
    </>
  );
  if (claim.evidence.length === 0) {
    return (
      <span className={`tabular-nums ${className}`}>
        {body} <NeedsCheck />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openEvidence(claim.evidence, title ?? claim.label)}
      title={claim.label ? `${claim.label} · 근거 보기` : "근거 보기"}
      className={`inline cursor-pointer rounded-[4px] font-semibold decoration-current/40 underline-offset-4 hover:underline ${claim.kind === "number" ? "tabular-nums" : ""} ${tone} ${className}`}
    >
      {body}
    </button>
  );
}

/**
 * 본문의 {{claimId}} 자리를 claims로 그린다. 맞는 claim이 없으면 "확인 필요".
 * 숫자 값은 앞뒤에 붙은 글자와 한 덩어리(줄 바꿈 없음)로 묶어 줄이 쉼표나 조사로 시작하지 않게 한다(claim-text.ts).
 */
export function ClaimText({ text, claims }: { text: string; claims: Claim[] }) {
  const segments = splitClaimText(text, claims);
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : segment.before || segment.after ? (
          <span key={index} className="whitespace-nowrap">
            {segment.before}
            <ClaimValue claim={segment.claim} inline />
            {segment.after}
          </span>
        ) : (
          <ClaimValue key={index} claim={segment.claim} inline />
        ),
      )}
    </span>
  );
}

/** 문장 안의 값과 바로 뒤에 붙는 글자("을", "입니다.")를 한 덩어리로 둔다. 줄이 조사나 쉼표로 시작하지 않게 한다 */
export function Glue({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}
