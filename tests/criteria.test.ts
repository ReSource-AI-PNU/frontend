/**
 * 매입 기준표 검토 화면의 순수 함수(src/lib/v3/criteria.ts)와 확인을 기다리는 문서(src/lib/v3/intake.ts).
 * 예시 데이터는 실제 백엔드가 시험 PDF를 실제 AI로 읽은 응답이다(tests/fixtures/criteria-draft-*.json,
 * 백엔드 tests/v3/fixtures/criteria_pdf의 05_footnote_units.pdf, 09_ambiguous.pdf).
 * 실행: node --test tests/criteria.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  commonLine,
  draftHeadline,
  duplicateProblem,
  editedKeys,
  emptyRow,
  numberInput,
  rowPayload,
  rowProblems,
  rowSummary,
  rowsFromDraft,
  savable,
  type CriteriaRowState,
} from "../src/lib/v3/criteria.ts";
import { addManual, addPending, parsePending, profileSummaryText, setRows } from "../src/lib/v3/intake.ts";
import type { DocumentUploadResult } from "../src/lib/v3/types.ts";

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as DocumentUploadResult;
const footnote = load("criteria-draft-footnote.json");
const ambiguous = load("criteria-draft-ambiguous.json");

const edit = (row: CriteriaRowState, values: Partial<CriteriaRowState["values"]>): CriteriaRowState => ({
  ...row,
  values: { ...row.values, ...values },
});

test("각주 단위(원/톤, 톤/월)로 적힌 문서도 kg당 320원·월 1,000kg으로 읽고 바로 저장할 수 있다", () => {
  const rows = rowsFromDraft(footnote.draft!);
  const pp = rows.find((row) => row.values.material === "PP" && row.values.grade === "A")!;
  assert.equal(pp.values.price, "320");
  assert.equal(pp.values.direction, "buy");
  assert.equal(pp.values.minMonthlyKg, "1000");
  assert.ok(pp.include && !pp.open, "확인할 값이 없는 줄은 골라 두고 접는다");
  assert.match(pp.sources.price ?? "", /320,000/);
  assert.match(pp.sources.price ?? "", /kg당 320원/);
  assert.ok(pp.quote, "문서 원문 행이 있다");
  assert.equal(rowSummary(pp).startsWith("PP · "), true);
  assert.match(rowSummary(pp), /매입 kg당 320원 · 최소 월 1,000kg/);
  const payload = rowPayload(pp)!;
  assert.equal(payload.unitPriceKrwPerKg, 320);
  assert.equal(payload.minMonthlyKg, 1000);
  assert.equal(payload.manual, false);
  assert.equal(payload.draftRow, pp.key, "읽은 줄은 초안의 행 ID를 보낸다(서버가 보관한 초안과 대조한다)");
  assert.deepEqual(payload.edited, []);
  assert.match(payload.source.quotes.unitPriceKrwPerKg, /320,000/);
  assert.equal(savable(rows).length, 3);
  assert.match(draftHeadline(rows), /AI가 매입 기준 3줄을 읽었습니다/);
  assert.match(draftHeadline(rows, "rules"), /^문서의 표에서 매입 기준 3줄을 읽었습니다/);
});

test("범위 단가·협의·단위 미상·방향 불명은 고르지 않은 채 펼쳐 두고, 값을 정하기 전에는 저장하지 않는다", () => {
  const rows = rowsFromDraft(ambiguous.draft!);
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.include, false, row.values.material);
    assert.equal(row.open, true);
    assert.ok(rowProblems(row).length > 0 || (row.review.price?.length ?? 0) > 0);
  }
  assert.equal(savable(rows).length, 0);
  const range = rows.find((row) => row.values.material === "PP" && row.values.grade === "A")!;
  assert.deepEqual(range.candidates, [300, 400]);
  assert.equal(range.values.price, "");
  assert.equal(range.values.minMonthlyKg, "", "회당 1톤은 월 물량으로 채우지 않는다");
  assert.ok(rowProblems(range).some((text) => text.includes("kg당 단가")));
  const abs = rows.find((row) => row.values.material === "ABS")!;
  assert.equal(abs.values.price, "200");
  assert.ok(rowProblems(abs).some((text) => text.includes("매입인지 처리비인지")));
  assert.match(draftHeadline(rows), /확인할 줄이 4개/);
  assert.match(commonLine(ambiguous.draft!.common.find((c) => c.field === "collectionFee")!, rows), /모든 줄/);

  // 담당자가 값을 정하면 저장할 수 있고, 고친 칸은 "고친 칸"으로 간다
  const decided = { ...edit(range, { price: "320", minMonthlyKg: "1000" }), include: true };
  assert.deepEqual(rowProblems(decided), []);
  assert.deepEqual(editedKeys(decided).sort(), ["minMonthlyKg", "price"]);
  const payload = rowPayload(decided)!;
  assert.equal(payload.unitPriceKrwPerKg, 320);
  assert.deepEqual(payload.edited.sort(), ["minMonthlyKg", "unitPriceKrwPerKg"]);
  assert.equal(payload.collectionFee, "separate");
  assert.equal(payload.collectionFeePerPickupKrw, 50000);
  const fee = { ...edit(abs, { direction: "fee" }), include: true };
  assert.equal(rowPayload(fee)!.unitPriceKrwPerKg, -200, "처리비는 음수로 보낸다");
});

test("직접 적은 줄은 재질·단가·방향이 있어야 하고, 같은 재질·등급·형태는 한 번만 저장한다", () => {
  const blank = emptyRow("n1");
  assert.deepEqual(rowProblems(blank), ["재질을 골라 주세요.", "kg당 단가를 숫자 하나로 적어 주세요.", "매입인지 처리비인지 골라 주세요."]);
  const filled = edit(blank, { material: "PP", price: "1,000", direction: "buy", minMonthlyKg: "1,000" });
  assert.deepEqual(rowProblems(filled), []);
  assert.equal(rowPayload(filled)!.manual, true);
  assert.equal(rowPayload(filled)!.draftRow, null, "직접 적은 줄은 초안 행을 가리키지 않는다");
  assert.equal(rowPayload(filled)!.minMonthlyKg, 1000);
  assert.ok(rowProblems(edit(filled, { price: "320000" }))[0].includes("1,000으로 나눠"));
  assert.ok(rowProblems(edit(filled, { maxMoisturePct: "120" }))[0].includes("수분 상한"));
  assert.ok(rowProblems(edit(filled, { minMonthlyKg: "1톤" }))[0].includes("kg 단위"));
  assert.match(duplicateProblem([filled, { ...filled, key: "n2" }]) ?? "", /1번째 줄과 2번째 줄/);
  assert.equal(duplicateProblem([filled, { ...filled, key: "n2", include: false }]), null);
});

test("숫자 칸은 쉼표와 공백을 읽고, 숫자가 아니면 NaN이다", () => {
  assert.equal(numberInput(" 1,000 "), 1000);
  assert.equal(numberInput(""), null);
  assert.ok(Number.isNaN(numberInput("1톤") as number));
});

test("초안은 확인을 기다리는 문서로 남고, 고친 줄도 새로 고쳐 읽은 뒤 같다", () => {
  let list = addPending([], footnote, new Date("2026-11-19T01:00:00Z"));
  assert.equal(list.length, 1);
  assert.equal(list[0].rows?.length, 3);
  const rows = list[0].rows!.map((row, index) => (index === 0 ? edit(row, { price: "330" }) : row));
  list = setRows(list, list[0].id, rows);
  const again = parsePending(JSON.stringify(list));
  assert.equal(again[0].rows?.[0].values.price, "330");
  // 매입 조건을 찾지 못했거나 AI가 읽지 못한 결과는 남기지 않는다(화면의 안내와 "직접 적기"로 간다)
  for (const outcome of ["not_found", "model_failed"] as const) {
    const empty = { ...footnote, draft: { ...footnote.draft!, outcome, rows: [] } };
    assert.equal(addPending([], empty, new Date()).length, 0);
  }
  const manual = addManual([], "견적서.pdf", new Date("2026-11-19T02:00:00Z"));
  assert.equal(manual[0].rows?.[0].origin, "manual");
  assert.equal(manual[0].result.filename, "견적서.pdf");
});

test("운반 조건을 바꿨으면 요약에 적는다", () => {
  const text = profileSummaryText({
    permitsAdded: 0,
    permitsUpdated: 0,
    criteriaAdded: 1,
    criteriaUpdated: 0,
    permits: [],
    criteria: [],
    skipped: [],
    transportUpdated: true,
  });
  assert.equal(text, "업체 정보에 반영했습니다(매입 기준 1개 추가, 운반 조건 수정).");
});

test("코드가 바꾼 단위는 줄의 환산 근거로 남는다", () => {
  const rows = rowsFromDraft(footnote.draft!);
  const pp = rows.find((row) => row.values.material === "PP" && row.values.grade === "A")!;
  assert.ok(pp.conversions?.some((text) => text.includes("kg당 320원")));
  assert.ok(pp.conversions?.some((text) => text.includes("월 1,000kg")));
});

test("건별 협의는 0원 및 단가 미입력과 구분되고 선택 조건을 비울 수 있다", () => {
  const row = emptyRow("manual");
  row.values.material = "PP+ABS";
  row.values.grade = "혼합";
  assert.equal(rowPayload(row), null);
  row.values.priceMode = "negotiated";
  assert.deepEqual(rowProblems(row), []);
  const payload = rowPayload(row);
  assert.equal(payload?.priceMode, "negotiated");
  assert.equal(payload?.unitPriceKrwPerKg, null);
  assert.equal(payload?.minMonthlyKg, null);
  assert.equal(payload?.maxContaminationPct, null);
  assert.equal(payload?.maxMoisturePct, null);
  assert.match(rowSummary(row), /담당자 견적 필요/);
  row.values.priceMode = "fixed";
  row.values.price = "0";
  row.values.direction = "buy";
  assert.equal(rowPayload(row)?.unitPriceKrwPerKg, 0);
  row.values.price = "80";
  row.values.direction = "fee";
  assert.equal(rowPayload(row)?.unitPriceKrwPerKg, -80);
});
