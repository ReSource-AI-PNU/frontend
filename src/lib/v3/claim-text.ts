/**
 * AI 메시지 본문의 {{claimId}} 자리를 나눈다. 숫자 값은 앞뒤에 붙은 글자(", ", "을", "%(담당자")와 한 덩어리로 묶어
 * 휴대폰에서 줄이 쉼표나 조사로 시작하지 않게 한다. 값은 누르는 단추(인라인 블록)로 그려져 Chromium이 그 앞뒤를
 * 줄 바꿈 자리로 보기 때문이다(word-break: keep-all, line-break: strict로는 막히지 않는다).
 * 네트워크도 React도 부르지 않는다(tests/claim-text.test.ts).
 */
import type { Claim } from "./types";

const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export type ClaimSegment =
  | { kind: "text"; text: string }
  /** before·after는 값에 붙여 함께 줄을 바꾸는 글자(공백 없이 붙은 것만) */
  | { kind: "claim"; claim: Claim | null; before: string; after: string };

/** 조항(긴 인용)은 묶지 않는다. 한 줄에 다 들어가지 않아 넘칠 수 있기 때문이다 */
const glued = (claim: Claim | null) => claim === null || claim.kind === "number";

export function splitClaimText(text: string, claims: Claim[]): ClaimSegment[] {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const raw: ({ text: string } | { claim: Claim | null })[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) raw.push({ text: text.slice(last, index) });
    raw.push({ claim: byId.get(match[1]) ?? null });
    last = index + match[0].length;
  }
  if (last < text.length) raw.push({ text: text.slice(last) });

  const out: ClaimSegment[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const part = raw[index];
    if ("text" in part) {
      out.push({ kind: "text", text: part.text });
      continue;
    }
    let before = "";
    let after = "";
    if (glued(part.claim)) {
      // 앞 글의 끝에 공백 없이 붙은 글자(예: "약 " 다음이 아니라 "(" 같은 것)
      const previous = out[out.length - 1];
      if (previous?.kind === "text") {
        before = /\S*$/.exec(previous.text)?.[0] ?? "";
        previous.text = previous.text.slice(0, previous.text.length - before.length);
      }
      // 뒤 글의 머리에 공백 없이 붙은 글자(", " 의 쉼표, 조사 "을", "%(담당자")
      const next = raw[index + 1];
      if (next && "text" in next) {
        after = /^\S*/.exec(next.text)?.[0] ?? "";
        next.text = next.text.slice(after.length);
      }
    }
    out.push({ kind: "claim", claim: part.claim, before, after });
  }
  return out.filter((segment) => segment.kind !== "text" || segment.text !== "");
}
