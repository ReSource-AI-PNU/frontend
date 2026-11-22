/**
 * 홈(확인할 것·거래)과 업체 대화 화면의 묶음(src/lib/v3/overview.ts).
 * 고정 자료는 로컬 백엔드(규칙 정책)로 찾기를 끝까지 돌린 진단 뷰다: 세 업체와 합의(승인 전), 그리고 새길자원과 확정한 뒤 업체가 본 뷰.
 * 실행: node --test tests/overview.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { activityOf, collectDeals, documentsOf, headlineOf, plainText, progressOf, snippet, tasksOf } from "../src/lib/v3/overview.ts";
import type { DiagnosisView } from "../src/lib/v3/types.ts";

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as DiagnosisView;
const agreed = load("overview-agreed.json");
const confirmed = load("overview-confirmed-vendor.json");

test("열린 대화만 거래가 되고, 묻지 않은 업체는 빠진다", () => {
  const deals = collectDeals([agreed]);
  assert.deepEqual(
    deals.map((deal) => deal.vendorName).sort(),
    ["(주)남해열분해", "(주)미소환경", "(주)새길자원"],
  );
  assert.ok(deals.every((deal) => deal.stage === "agreed"));
  const saegil = deals.find((deal) => deal.vendorName === "(주)새길자원");
  assert.deepEqual(saegil?.items.map((item) => item.name), ["포장 필름", "스프루·런너"]);
  assert.equal(saegil?.items[0].now, "혼합 소각");
});

test("배출 기업의 확인할 것: 거래마다 한 줄이고 허가증 대조가 승인보다 먼저다", () => {
  const tasks = tasksOf([agreed], "emitter");
  const perDeal = new Map<string, number>();
  for (const task of tasks) if (task.dealKey) perDeal.set(task.dealKey, (perDeal.get(task.dealKey) ?? 0) + 1);
  assert.ok([...perDeal.values()].every((count) => count === 1));
  const kinds = tasks.map((task) => task.kind);
  assert.ok(kinds.indexOf("permit") < kinds.indexOf("approve"));
  // 계약 검토가 남긴 확인할 것은 같은 줄에 붙는다
  assert.ok(tasks.some((task) => (task.checks?.count ?? 0) > 0));
});

test("업체가 확정한 거래에는 검수 기록이 할 일로 뜨고, 서류는 따로 모인다", () => {
  const tasks = tasksOf([confirmed], "vendor", () => "(주)한빛정밀");
  assert.deepEqual(
    tasks.map((task) => task.kind),
    ["outcome"],
  );
  const docs = documentsOf(collectDeals([confirmed]));
  assert.deepEqual(docs.map((item) => item.doc.kind).sort(), ["contract", "plan", "request"]);
});

test("맨 위 숫자: 지금 대비 합계는 결과 값을 그대로 쓴다", () => {
  const deals = collectDeals([agreed]);
  const headline = headlineOf([agreed], deals);
  assert.equal(headline.difference?.value, agreed.result?.totals.difference?.value);
  assert.equal(headline.agreedCount, 3);
  assert.equal(headline.recycledKg, 1550);
});

test("말풍선 미리보기는 자리표시자를 값으로 바꾸고 처리비는 크기로 적는다", () => {
  const text = plainText({
    text: "처리비는 {{fee}}에 맞추겠습니다.",
    claims: [{ id: "fee", kind: "number", value: -72, unit: "원/kg", evidence: ["e"], role: "treatmentFee" }],
  });
  assert.equal(text, "처리비는 72 원/kg에 맞추겠습니다.");
  assert.equal(snippet("(주)미소환경 담당자께, 문의드립니다.\n- PP 사출 불량품: 월 400kg"), "PP 사출 불량품: 월 400kg");
});

test("최근 바뀐 것은 거래마다 두 개까지만", () => {
  const items = activityOf([agreed], 20);
  const perDeal = new Map<string, number>();
  for (const item of items) perDeal.set(item.dealKey ?? "", (perDeal.get(item.dealKey ?? "") ?? 0) + 1);
  assert.ok([...perDeal.values()].every((count) => count <= 2));
});

test("거래 단계: 합의하면 승인 차례, 확정하면 검수 차례, 검수를 적으면 끝", () => {
  assert.deepEqual(progressOf({ stage: "talking", inspected: false }), { done: 0, current: "문의", stopped: null });
  assert.equal(progressOf(collectDeals([agreed])[0]).current, "승인");
  assert.equal(progressOf(collectDeals([confirmed])[0]).current, "검수");
  assert.equal(progressOf({ stage: "confirmed", inspected: true }).current, null);
  assert.equal(progressOf({ stage: "declined", inspected: false }).stopped, "거절");
});


test("같은 업체와 같은 폐기물을 새로 찾으면 앞선 찾기의 끝나지 않은 거래는 빠진다", () => {
  // 같은 찾기를 하루 뒤에 다시 한 것으로 만든다(찾기 번호와 시각만 다르다)
  const later = JSON.parse(JSON.stringify(agreed).replaceAll("2026-11-2", "2026-12-2")) as DiagnosisView;
  later.session = { ...later.session, id: `${agreed.session.id}_next` };
  const deals = collectDeals([later, agreed]);
  assert.equal(deals.length, collectDeals([agreed]).length);
  assert.ok(deals.every((deal) => deal.sessionId === later.session.id));
  // 할 일도 새 찾기의 것만 남는다
  const tasks = tasksOf([later, agreed], "emitter");
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.sessionId === later.session.id));
  // 확정한 거래는 새 찾기가 있어도 남는다
  const kept = collectDeals([later, confirmed]).filter((deal) => deal.sessionId === confirmed.session.id);
  assert.ok(kept.every((deal) => deal.stage === "confirmed"));
});
