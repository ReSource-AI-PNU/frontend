/**
 * 결과 한 줄의 수거·운반(src/lib/v3/pickup.ts)과 그 화면 모양(schema.ts의 pickupSchema).
 * 실행: node --test tests/pickup.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { feeKind, feeWords, pickupStatusText, pickupTodo, pickupUnconfirmed, roomAgainstName, transportComparison } from "../src/lib/v3/pickup.ts";
import { pickupSchema } from "../src/lib/v3/schema.ts";
import type { Pickup } from "../src/lib/v3/types.ts";

const claim = (id: string, value: number, unit: string) => ({ id, kind: "number" as const, value, unit, evidence: [`calc:${id}`] });

function pickup(over: Partial<Pickup>): Pickup {
  return pickupSchema.parse({
    status: "route",
    label: null,
    days: [],
    basis: "included",
    basisLabel: null,
    routeBasis: "included",
    paidBy: "vendor",
    unit: null,
    fee: null,
    pickups: null,
    monthly: null,
    room: null,
    roomAgainst: null,
    pending: false,
    seq: 3,
    source: "answer",
    ...over,
  });
}

test("수거 상태와 운반비 방식을 따로 적는다", () => {
  const route = pickup({ days: ["화", "목"] });
  assert.equal(pickupStatusText(route), "기존 노선 포함(화·목 운행)");
  // 실제 수거 확약이 필요한 때에는 양쪽 승인 전인지 뒤인지 붙인다
  assert.equal(pickupStatusText(route, false), "기존 노선 포함(화·목 운행) · 수거 확약 전");
  assert.equal(pickupStatusText(route, true), "기존 노선 포함(화·목 운행) · 수거 확약(양쪽 승인)");
  assert.equal(feeKind(route), "included");
  assert.equal(pickupUnconfirmed(route), false);
  const visit = pickup({
    status: "visit",
    basis: "separate",
    paidBy: "emitter",
    unit: "per_pickup",
    fee: claim("f", 30000, "원/회"),
    pickups: claim("p", 2, "회/월"),
    monthly: claim("m", 60000, "원/월"),
  });
  assert.equal(pickupStatusText(visit), "업체 수거 가능 확인");
  assert.equal(feeKind(visit), "monthly");
  assert.equal(feeWords(visit), "운반비 별도(공장 부담)");
  assert.deepEqual(pickupTodo({ pickup: visit, transportPending: false }), []);
});

test("노선 밖이고 업체가 방문을 밝히지 않으면 확인할 것과 잠정 금액을 알린다", () => {
  const check = pickup({ status: "check", basis: "undecided", paidBy: null, pending: true });
  assert.equal(pickupUnconfirmed(check), true);
  assert.equal(pickupStatusText(check, false), "별도 수거 확인 필요"); // 확인 필요 상태에는 확약 꼬리를 붙이지 않는다
  assert.equal(feeKind(check), "undecided");
  const todo = pickupTodo({ pickup: check, transportPending: true });
  assert.equal(todo.length, 2);
  assert.match(todo[0], /노선 밖/);
  assert.match(todo[0], /단가에 포함/); // 노선 수거 조건은 포함이었다는 것도 밝힌다
  assert.match(todo[1], /별도 운반비 반영 전/);
  assert.ok(todo.every((line) => !/\d/.test(line))); // 문장에 숫자를 쓰지 않는다
});

test("회당 금액만 있고 횟수가 없으면 금액 확인 필요로 본다", () => {
  const missing = pickup({ status: "visit", basis: "separate", paidBy: "emitter", unit: "per_pickup", fee: claim("f", 30000, "원/회"), pending: true });
  assert.equal(feeKind(missing), "missing");
  assert.match(pickupTodo({ pickup: missing, transportPending: true })[0], /금액이나 월 수거 횟수/);
});

test("수거 불가는 운반비를 보지 않고, 손익분기 상대 이름은 현행 유지면 지금 방식이다", () => {
  const gone = pickup({ status: "unavailable", basis: "undecided", paidBy: null });
  assert.equal(feeKind(gone), "none");
  assert.deepEqual(pickupTodo({ pickup: gone, transportPending: false }), ["업체가 이 공장까지 수거하러 올 수 없다고 밝혔습니다."]);
  const pending = pickup({ status: "unknown", basis: "undecided", pending: true, roomAgainst: { vendorOrgId: null, route: "keep" } });
  assert.equal(roomAgainstName(pending, () => null), "지금 방식");
  const other = pickup({ status: "unknown", basis: "undecided", pending: true, roomAgainst: { vendorOrgId: "org_saegil", route: "sell" } });
  assert.equal(roomAgainstName(other, () => "(주)새길자원"), "(주)새길자원");
});

test("모르는 수거 상태는 화면 모양 검사에서 막는다", () => {
  assert.throws(() => pickup({ status: "teleport" as Pickup["status"] }));
});

test("노선과 범위 충돌 사유를 결과와 승인에 같은 문구로 표시한다", () => {
  const detail = "지역명은 기존 수거 노선과 일치하지만, 공장까지 거리가 업체가 밝힌 최대 수거 거리를 넘습니다.";
  const check = pickup({
    status: "check",
    label: "주소 또는 수거 가능 여부 확인",
    detail,
    basis: "undecided",
    paidBy: null,
    pending: true,
  });
  assert.equal(pickupStatusText(check, false), check.label);
  assert.equal(pickupTodo({ pickup: check, transportPending: true })[0], detail);
  assert.equal(feeKind(check), "undecided");
});


test("예전 결과에 현행 기준 손익분기가 있어도 업체 견적이 미정이면 견적 확인을 안내한다", () => {
  const terms = pickup({
    status: "visit",
    basis: "separate",
    pending: true,
    room: claim("room", 570000, "원/월"),
    roomAgainst: { vendorOrgId: null, route: "keep" },
  });
  const b = {
    vendorOrgId: "org_b", vendorName: "B사", route: "sell", note: "",
    unitPrice: null, monthlyAfter: claim("b", 250000, "원/월"),
    transportPending: true, costPending: true,
  };
  const base = { pickup: terms, transportPending: true, costPending: false };
  assert.deepEqual(transportComparison({ ...base, alternatives: [b] }), {
    reason: "두 업체의 운반 견적을 확인해 비교해 주세요.",
  });
  assert.deepEqual(transportComparison({ ...base, alternatives: [{ ...b, transportPending: false }] }), {
    reason: "두 업체의 운반 견적과 미확인 비용을 확인해 비교해 주세요.",
  });
});
