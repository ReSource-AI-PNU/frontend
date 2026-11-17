"use client";

import { Fragment } from "react";
import { formatClaim, formatUnitPrice, isAssumed, isUnitPriceClaim } from "@/lib/v3/format";
import type { Claim } from "@/lib/v3/types";
import { useV3 } from "./context";

const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

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
        <span className="ml-1 align-baseline text-[11px] font-normal text-muted">가정</span>
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

/** 본문의 {{claimId}} 자리를 claims로 그린다. 맞는 claim이 없으면 "확인 필요". */
export function ClaimText({ text, claims }: { text: string; claims: Claim[] }) {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const parts: { key: string; text?: string; claim?: Claim | null }[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ key: `t${last}`, text: text.slice(last, index) });
    parts.push({ key: `c${index}`, claim: byId.get(match[1]) ?? null });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ key: `t${last}`, text: text.slice(last) });
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part) => (
        <Fragment key={part.key}>
          {part.text !== undefined ? part.text : <ClaimValue claim={part.claim} inline />}
        </Fragment>
      ))}
    </span>
  );
}
