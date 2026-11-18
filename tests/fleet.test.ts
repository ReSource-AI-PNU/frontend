/**
 * 처리 업체의 노선·차량 입력: 차고지 고르기, 범위 검사(백엔드 app/v3/fleet.py와 같다), 노선, 보낼 본문의 모양.
 * 실행: node --test tests/fleet.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  depotChoice,
  emptyRoute,
  fleetBody,
  fleetDraft,
  fleetErrors,
  hasFleetErrors,
  KEEP_DEPOT,
  regionList,
  sortDays,
  toggleDay,
} from "../src/lib/v3/fleet.ts";

const COMPLEXES = [
  { id: "noksan", center: [128.8475, 35.0925] as [number, number] },
  { id: "sasang", center: [128.9845, 35.1475] as [number, number] },
];
const ALLOWED = new Set(["depot", "capacityKg", "capacityM3", "costPerKm", "vehicleCount", "routes"]);
const ROUTE_KEYS = ["complexes", "days", "name", "regions"];

test("차고지 좌표가 산업단지 가운데면 그 단지를, 다르면 '그대로'를, 없으면 빈 값을 고른다", () => {
  assert.equal(depotChoice([128.8475, 35.0925], COMPLEXES), "noksan");
  assert.equal(depotChoice([128.8721, 35.1493], COMPLEXES), KEEP_DEPOT);
  assert.equal(depotChoice(undefined, COMPLEXES), "");
  assert.equal(depotChoice(null, COMPLEXES), "");
});

test("저장된 노선·차량으로 입력 칸을 채운다(새 업체의 빈 fleet도 받는다)", () => {
  const draft = fleetDraft(
    {
      depot: [128.9845, 35.1475],
      capacityKg: 5000,
      capacityM3: 20,
      costPerKm: 1200,
      vehicleCount: 2,
      routes: [{ name: "강서 화목", days: ["목", "화"], regions: ["부산 강서구"], complexes: ["녹산국가산업단지"] }],
      evidence: ["human:x"],
    },
    COMPLEXES,
  );
  assert.deepEqual(draft, {
    depot: "sasang",
    capacityKg: "5000",
    capacityM3: "20",
    costPerKm: "1200",
    vehicleCount: "2",
    routes: [{ key: "r0", name: "강서 화목", days: ["화", "목"], regions: "부산 강서구", complexes: ["녹산국가산업단지"] }],
  });
  assert.deepEqual(fleetDraft({}, COMPLEXES), { depot: "", capacityKg: "", capacityM3: "", costPerKm: "", vehicleCount: "", routes: [] });
});

test("백엔드와 같은 범위로 검사한다: 무게 0<x≤100,000, 부피 0<x≤1,000, 운송비 0~1,000,000, 대수 1~1,000 정수", () => {
  const base = fleetDraft(null, COMPLEXES);
  assert.deepEqual(fleetErrors(base), {}, "빈 칸은 아직 모르는 값으로 둔다");
  assert.deepEqual(fleetErrors({ ...base, capacityKg: "100,000", capacityM3: "1000", costPerKm: "0", vehicleCount: "1000" }), {});
  const errors = fleetErrors({ ...base, capacityKg: "0", capacityM3: "1001", costPerKm: "-1", vehicleCount: "1.5" });
  assert.ok(errors.capacityKg && errors.capacityM3 && errors.costPerKm && errors.vehicleCount);
  assert.ok(fleetErrors({ ...base, capacityKg: "100001" }).capacityKg);
  assert.ok(fleetErrors({ ...base, vehicleCount: "1001" }).vehicleCount);
  assert.equal(hasFleetErrors(errors), true);
  assert.equal(hasFleetErrors({}), false);
});

test("노선마다 이름(겹치지 않게), 요일 하나 이상, 수거 지역이나 산업단지 하나 이상이 있어야 한다", () => {
  const ok = { ...emptyRoute("a"), name: "강서 화목", days: ["화"], complexes: ["녹산국가산업단지"] };
  const base = fleetDraft(null, COMPLEXES);
  assert.deepEqual(fleetErrors({ ...base, routes: [ok, { ...ok, key: "b", name: "사상 월", complexes: [], regions: "부산 사상구" }] }), {});
  const errors = fleetErrors({
    ...base,
    routes: [
      { ...ok, name: " " },
      { ...ok, key: "b", days: [] },
      { ...ok, key: "c", name: "북부", complexes: [], regions: " , " },
      { ...ok, key: "d" },
      { ...ok, key: "e", name: "가".repeat(51) },
    ],
  });
  assert.match(errors.route?.[0] ?? "", /이름을 적어/);
  assert.match(errors.route?.[1] ?? "", /요일/);
  assert.match(errors.route?.[2] ?? "", /수거 지역이나 산업단지/);
  assert.match(errors.route?.[3] ?? "", /이름이 같습니다/);
  assert.match(errors.route?.[4] ?? "", /50자/);
  const many = fleetErrors({ ...base, routes: Array.from({ length: 31 }, (_, i) => ({ ...ok, key: `k${i}`, name: `노선 ${i}` })) });
  assert.match(many.routes ?? "", /30개/);
});

test("요일은 월~일 순서로 겹침 없이 두고, 수거 지역은 쉼표로 나눈다", () => {
  assert.deepEqual(sortDays(["목", "화", "목", "평일"]), ["화", "목"]);
  assert.deepEqual(toggleDay(["화", "목"], "월"), ["월", "화", "목"]);
  assert.deepEqual(toggleDay(["화", "목"], "화"), ["목"]);
  assert.deepEqual(regionList(" 부산 강서구, 부산 사상구 ,, 부산 강서구"), ["부산 강서구", "부산 사상구"]);
});

test("보낼 fleet은 계약의 항목만 담고 evidence는 보내지 않는다", () => {
  const previous = {
    depot: [128.8721, 35.1493] as [number, number],
    capacityKg: 5000,
    capacityM3: 20,
    costPerKm: 1200,
    evidence: ["human:x"],
  };
  const draft = fleetDraft(previous, COMPLEXES);
  assert.equal(draft.depot, KEEP_DEPOT);
  const body = fleetBody(
    {
      ...draft,
      capacityKg: "6,000",
      vehicleCount: "3",
      routes: [{ key: "a", name: " 강서 화목 ", days: ["목", "화"], regions: "부산 강서구", complexes: ["녹산국가산업단지", "녹산국가산업단지"] }],
    },
    previous,
    COMPLEXES,
  );
  assert.deepEqual(body, {
    capacityKg: 6000,
    capacityM3: 20,
    costPerKm: 1200,
    vehicleCount: 3,
    routes: [{ name: "강서 화목", days: ["화", "목"], regions: ["부산 강서구"], complexes: ["녹산국가산업단지"] }],
  }, "차고지를 그대로 두면 보내지 않는다");
  for (const key of Object.keys(body ?? {})) assert.ok(ALLOWED.has(key), `${key}는 계약에 없는 항목이다`);
  for (const route of body?.routes ?? []) assert.deepEqual(Object.keys(route).sort(), ROUTE_KEYS);
  assert.equal("evidence" in (body ?? {}), false);
  assert.equal("count" in (body ?? {}), false);
  assert.equal("complexes" in (body ?? {}), false);
});

test("있던 값을 비우면 null로 지우고, 처음부터 빈 항목은 보내지 않으며, 바꿀 것이 없으면 fleet을 보내지 않는다", () => {
  const previous = { depot: [128.8475, 35.0925] as [number, number], capacityKg: 5000, vehicleCount: 2, routes: [{ name: "a", days: ["화"], regions: ["부산"], complexes: [] }] };
  const draft = fleetDraft(previous, COMPLEXES);
  assert.deepEqual(fleetBody({ ...draft, depot: "", capacityKg: "", vehicleCount: "", routes: [] }, previous, COMPLEXES), {
    depot: null,
    capacityKg: null,
    vehicleCount: null,
    routes: null,
  });
  assert.deepEqual(fleetBody({ ...draft, depot: "sasang" }, previous, COMPLEXES)?.depot, [128.9845, 35.1475]);
  assert.equal(fleetBody(fleetDraft(null, COMPLEXES), null, COMPLEXES), null);
  assert.equal(fleetBody(fleetDraft({}, COMPLEXES), {}, COMPLEXES), null);
});
