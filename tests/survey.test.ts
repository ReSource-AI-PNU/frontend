import { test } from "node:test";
import assert from "node:assert/strict";
import { narrower, rangeText, monthInSeoul } from "../src/lib/v3/survey.ts";
test("범위 확장·역전·비유한 수를 거절하고 점 제안을 허용한다", () => {
  assert.equal(narrower(320, 350, { low: 300, high: 400 }), true);
  assert.equal(narrower(350, 350, { low: 300, high: 400 }), true);
  assert.equal(narrower(299, 350, { low: 300, high: 400 }), false);
  assert.equal(narrower(350, 320, { low: 300, high: 400 }), false);
  assert.equal(narrower(NaN, 350, { low: 300, high: 400 }), false);
  assert.equal(rangeText(300, 400), "300~400원/kg");
});

test("월말 합산 월은 한국 시간으로 정한다", () => {
  assert.equal(monthInSeoul(new Date("2026-10-31T15:30:00Z")), "2026-11");
});
