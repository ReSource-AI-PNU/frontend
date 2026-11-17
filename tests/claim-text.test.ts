/**
 * AI 메시지 본문 나누기(src/lib/v3/claim-text.ts): 숫자 값에 붙은 쉼표·조사를 값과 한 덩어리로 묶는다.
 * 실행: node --test tests/claim-text.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { splitClaimText } from "../src/lib/v3/claim-text.ts";
import type { Claim } from "../src/lib/v3/types.ts";

const number = (id: string, value: number, unit: string): Claim => ({ id, kind: "number", value, unit, evidence: ["ev"] });
const clause = (id: string): Claim => ({ id, kind: "clause", value: "폐기물을 재활용하려는 자는…", unit: null, evidence: ["law"] });

test("값 뒤의 쉼표, 조사, 괄호는 값과 함께 줄을 바꾼다", () => {
  const segments = splitClaimText("월 발생량 {{q}}, 오염도 {{c}}(담당자 답변), 금액은 {{w}}을 냅니다.", [
    number("q", 400, "kg/월"),
    number("c", 5, "%"),
    number("w", 387500, "원"),
  ]);
  assert.deepEqual(
    segments.map((segment) => (segment.kind === "text" ? segment.text : `[${segment.before}|${segment.claim?.id}|${segment.after}]`)),
    ["월 발생량 ", "[|q|,]", " 오염도 ", "[|c|(담당자]", " 답변), 금액은 ", "[|w|을]", " 냅니다."],
  );
});

test("앞에 공백 없이 붙은 글자도 함께 묶고, 조항 인용과 모르는 값은 묶지 않는다", () => {
  const segments = splitClaimText("단가(kg당 {{p}}원), 조항 {{law}}, 없는 값 {{nope}}.", [number("p", 200, "원/kg"), clause("law")]);
  const shown = segments.map((segment) => (segment.kind === "text" ? segment.text : `[${segment.before}|${segment.claim?.id ?? "?"}|${segment.after}]`));
  assert.deepEqual(shown, ["단가(kg당 ", "[|p|원),]", " 조항 ", "[|law|]", ", 없는 값 ", "[|?|.]"]);
  assert.deepEqual(splitClaimText("숫자 없음", []), [{ kind: "text", text: "숫자 없음" }]);
  assert.deepEqual(splitClaimText("{{p}}", [number("p", 1, "kg")]), [{ kind: "claim", claim: number("p", 1, "kg"), before: "", after: "" }]);
});
