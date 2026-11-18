/**
 * 소개 화면 미리보기(src/lib/v3/preview.ts): 숫자를 손으로 적지 않고 체험하기가 여는 진단 뷰에서 그대로 꺼낸다.
 * 실행: node --test tests/preview.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { placedHeadline } from "../src/lib/v3/format.ts";
import { previewOf } from "../src/lib/v3/preview.ts";

const view = JSON.parse(readFileSync(new URL("./fixtures/v3-view-confirmed.json", import.meta.url), "utf8"));

test("결과 카드와 같은 문장과 숫자: 합계는 뷰의 totals.difference 그대로", () => {
  const preview = previewOf(view);
  assert.ok(preview);
  assert.equal(preview.request, `폐기물 ${view.streams.length}가지를 받아 줄 곳을 찾아 주세요.`);
  assert.equal(preview.headline, "4가지 모두 보낼 곳을 찾았습니다.");
  assert.equal(preview.money, "지금은 한 달에 387,500원을 내고 있습니다. 조건이 확인되면 한 달에 293,500원을 받게 됩니다.");
  assert.equal(preview.total, `+${new Intl.NumberFormat("ko-KR").format(view.result.totals.difference.value)}원`);
  assert.equal(preview.totalSign, 1);
  const purge = preview.rows.find((row) => row.streamId === "st_purge");
  assert.deepEqual(purge, {
    streamId: "st_purge",
    name: "퍼지 덩어리",
    amount: "한 달 250 kg",
    vendor: "(주)남해열분해",
    state: "조건 확인 뒤 확정",
    // 합의 전 단가 협상(⑥)으로 처리비 80원이 72원이 됐다
    price: "처리비 kg당 72원",
    diff: "+14,500원",
    sign: 1,
  });
});

test("결과가 없으면 숫자를 만들지 않는다", () => {
  assert.equal(previewOf(null), null);
  assert.equal(previewOf({ ...view, result: null }), null);
  assert.equal(previewOf({ ...view, result: { ...view.result, assignments: [] } }), null);
});

test("옮길 곳이 없거나 값이 없는 줄은 '지금 방식 그대로', 차이 없음으로 둔다", () => {
  const first = view.result.assignments[0];
  const kept = { ...first, vendorOrgId: null, vendorName: null, threadId: null, route: "keep", unitPrice: null, difference: null };
  const preview = previewOf({ ...view, result: { ...view.result, assignments: [kept] } })!;
  assert.equal(preview.headline, "지금보다 나은 곳을 찾지 못했습니다.");
  assert.equal(preview.rows[0].vendor, "지금 방식 그대로");
  assert.equal(preview.rows[0].state, null);
  assert.equal(preview.rows[0].diff, null);
  assert.equal(preview.rows[0].sign, 0);
});

test("결과 머리 한 줄은 폐기물 수에 맞춘다: 한 가지면 '모두'를 쓰지 않는다", () => {
  assert.equal(placedHeadline(1, 1), "1가지 폐기물의 보낼 곳을 찾았습니다.");
  assert.equal(placedHeadline(2, 2), "2가지 모두 보낼 곳을 찾았습니다.");
  assert.equal(placedHeadline(3, 1), "3가지 가운데 1가지는 보낼 곳을 찾았습니다.");
  assert.equal(placedHeadline(2, 0), "지금보다 나은 곳을 찾지 못했습니다.");
  // 미리보기도 같은 문장을 쓴다(첫 줄은 업체에 배정된 폐기물)
  const one = { ...view, result: { ...view.result, assignments: view.result.assignments.slice(0, 1) } };
  assert.ok(one.result.assignments[0].vendorOrgId);
  assert.equal(previewOf(one)?.headline, "1가지 폐기물의 보낼 곳을 찾았습니다.");
});
