/**
 * 처리 업체의 노선 밖 공장 수거 조건: 저장된 값으로 칸 채우기, 범위 검사(백엔드 app/v3/transport_input.py와 같다),
 * 보낼 본문의 모양, 저장한 조건 한 줄.
 * 실행: node --test tests/transport-terms.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  hasOffRouteErrors,
  offRouteBody,
  offRouteDraft,
  offRouteErrors,
  offRouteText,
  transportBody,
  type OffRouteDraft,
  type TransportTerms,
} from "../src/lib/v3/transport-terms.ts";

const SAVED: TransportTerms = { paidBy: "vendor", evidence: ["doc:miso:운반조건"] };
const draft = (patch: Partial<OffRouteDraft>): OffRouteDraft => ({ choice: "", unit: "per_pickup", fee: "", pickups: "", ...patch });

test("네 가지 답이 백엔드 offRoute 모양으로 나간다(따로 받는 운반비는 공장 부담)", () => {
  assert.deepEqual(offRouteBody(draft({ choice: "unavailable" }), SAVED), { status: "unavailable" });
  assert.deepEqual(offRouteBody(draft({ choice: "free" }), SAVED), { status: "visit", basis: "included" });
  assert.deepEqual(offRouteBody(draft({ choice: "undecided" }), SAVED), { status: "visit", basis: "undecided" });
  assert.deepEqual(offRouteBody(draft({ choice: "paid", fee: "3만", pickups: "2회" }), SAVED), {
    status: "visit",
    basis: "separate",
    feePerPickupKrw: 30000,
    pickupsPerMonth: 2,
  });
  // 월 횟수를 모르면 비워 보낸다(공장 화면에 "월 수거 횟수 확인 필요")
  assert.deepEqual(offRouteBody(draft({ choice: "paid", fee: "30,000원" }), SAVED), {
    status: "visit",
    basis: "separate",
    feePerPickupKrw: 30000,
  });
  // 한 달 금액이면 횟수를 보내지 않는다
  assert.deepEqual(offRouteBody(draft({ choice: "paid", unit: "per_month", fee: "60000", pickups: "2" }), SAVED), {
    status: "visit",
    basis: "separate",
    feePerMonthKrw: 60000,
  });
});

test("정하지 않음은 저장된 조건이 있을 때만 지우고, 없으면 보내지 않는다", () => {
  assert.equal(offRouteBody(draft({}), SAVED), undefined);
  assert.equal(offRouteBody(draft({}), { ...SAVED, offRoute: { status: "unavailable" } }), null);
});

test("노선 수거 조건은 저장된 그대로 돌려보내고 근거 키는 빼고 보낸다", () => {
  assert.deepEqual(transportBody(SAVED, draft({ choice: "free" })), {
    paidBy: "vendor",
    offRoute: { status: "visit", basis: "included" },
  });
  assert.deepEqual(transportBody({ paidBy: "emitter", feePerPickupKrw: 30000, evidence: ["x"] }, draft({})), {
    paidBy: "emitter",
    feePerPickupKrw: 30000,
  });
  assert.equal(transportBody(null, draft({})), undefined);
});

test("저장된 조건으로 칸을 채운다(예전 paidBy 모양도 받는다)", () => {
  assert.deepEqual(offRouteDraft(SAVED), draft({}));
  assert.deepEqual(offRouteDraft({ offRoute: { status: "unavailable" } }), draft({ choice: "unavailable" }));
  assert.deepEqual(offRouteDraft({ offRoute: { status: "visit", paidBy: "vendor" } }), draft({ choice: "free" }));
  assert.deepEqual(offRouteDraft({ offRoute: { status: "visit", basis: "undecided" } }), draft({ choice: "undecided" }));
  assert.deepEqual(
    offRouteDraft({ offRoute: { status: "visit", basis: "separate", paidBy: "emitter", feePerPickupKrw: 30000, pickupsPerMonth: 2 } }),
    draft({ choice: "paid", fee: "30000", pickups: "2" }),
  );
  assert.deepEqual(
    offRouteDraft({ offRoute: { status: "visit", basis: "separate", feePerMonthKrw: 60000 } }),
    draft({ choice: "paid", unit: "per_month", fee: "60000" }),
  );
});

test("금액은 꼭 적고, 횟수는 비워도 되지만 적으면 범위 안이어야 한다", () => {
  assert.ok(hasOffRouteErrors(offRouteErrors(draft({ choice: "paid" }))));
  assert.match(offRouteErrors(draft({ choice: "paid" })).fee ?? "", /비용 미정/);
  assert.ok(offRouteErrors(draft({ choice: "paid", fee: "0" })).fee);
  assert.ok(offRouteErrors(draft({ choice: "paid", fee: "삼만" })).fee);
  assert.ok(offRouteErrors(draft({ choice: "paid", fee: "30000", pickups: "200" })).pickups);
  assert.ok(offRouteErrors(draft({ choice: "paid", fee: "30000", pickups: "두 번" })).pickups);
  assert.equal(hasOffRouteErrors(offRouteErrors(draft({ choice: "paid", fee: "30000" }))), false);
  // 한 달 금액이면 횟수 칸은 보지 않는다
  assert.equal(hasOffRouteErrors(offRouteErrors(draft({ choice: "paid", unit: "per_month", fee: "60000", pickups: "x" }))), false);
  assert.equal(hasOffRouteErrors(offRouteErrors(draft({ choice: "undecided", fee: "x" }))), false);
});

test("저장한 조건 한 줄", () => {
  assert.equal(offRouteText(null), null);
  assert.equal(offRouteText({ status: "unavailable" }), "수거 불가");
  assert.equal(offRouteText({ status: "visit", basis: "included" }), "추가비 없이 수거(운반비 포함)");
  assert.equal(offRouteText({ status: "visit", basis: "undecided" }), "수거는 가능, 추가 운반비 미정");
  assert.equal(
    offRouteText({ status: "visit", basis: "separate", feePerPickupKrw: 30000, pickupsPerMonth: 2 }),
    "추가 운반비 회당 30,000원(공장 부담) × 한 달 2회",
  );
  assert.equal(
    offRouteText({ status: "visit", basis: "separate", feePerPickupKrw: 30000 }),
    "추가 운반비 회당 30,000원(공장 부담) · 한 달 수거 횟수 미정",
  );
  assert.equal(offRouteText({ status: "visit", basis: "separate", feePerMonthKrw: 60000 }), "추가 운반비 한 달 60,000원(공장 부담)");
});
