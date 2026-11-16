"use client";

import { Fragment } from "react";
import { formatClaim, isAssumed } from "@/lib/v3/format";
import type { Claim } from "@/lib/v3/types";
import { useV3 } from "./context";

const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function NeedsCheck() {
  return (
    <span className="rounded-sm bg-warn-bg px-1.5 py-0.5 text-[13px] font-semibold text-warn">
      확인 필요
    </span>
  );
}

/** 숫자나 조항 하나. 누르면 근거 패널이 열린다. 값이 없으면 "확인 필요". */
export function ClaimValue({
  claim,
  signed = false,
  title,
  className = "",
}: {
  claim: Claim | null | undefined;
  signed?: boolean;
  title?: string;
  className?: string;
}) {
  const { openEvidence } = useV3();
  const text = formatClaim(claim, signed);
  if (!claim || text === null) return <NeedsCheck />;
  const assumed = isAssumed(claim);
  const tone =
    signed && typeof claim.value === "number"
      ? claim.value > 0
        ? "text-gain"
        : claim.value < 0
          ? "text-loss"
          : ""
      : "";
  const body = (
    <>
      {claim.kind === "clause" ? `“${text}”` : text}
      {assumed ? (
        <span className="ml-1 rounded-sm bg-warn-bg px-1 py-px align-middle font-sans text-[11px] font-semibold text-warn">
          가정값
        </span>
      ) : null}
    </>
  );
  if (claim.evidence.length === 0) {
    return (
      <span className={`font-mono tabular-nums ${className}`}>
        {body} <NeedsCheck />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openEvidence(claim.evidence, title)}
      title="근거 보기"
      className={`inline cursor-pointer rounded-sm font-semibold underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-sunken hover:decoration-ink ${claim.kind === "number" ? "font-mono tabular-nums" : ""} ${tone} ${className}`}
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
          {part.text !== undefined ? part.text : <ClaimValue claim={part.claim} />}
        </Fragment>
      ))}
    </span>
  );
}
