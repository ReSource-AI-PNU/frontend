/**
 * 처리 업체의 노선·차량 입력: 차고지 고르기, 숫자 검사, 요일, 보낼 본문, 차량 대수·다니는 산업단지를 백엔드가 받았는지.
 * 실행: node --test tests/fleet.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  depotChoice,
  fleetBody,
  fleetDraft,
  fleetErrors,
  fleetExtrasKept,
  KEEP_DEPOT,
  sortDays,
  toggleDay,
} from "../src/lib/v3/fleet.ts";

const COMPLEXES = [
  { id: "noksan", center: [128.8475, 35.0925] as [number, number] },
  { id: "sasang", center: [128.9845, 35.1475] as [number, number] },
];

test("차고지 좌표가 산업단지 중심이면 그 단지를, 다르면 '그대로'를, 없으면 빈 값을 고른다", () => {
  assert.equal(depotChoice([128.8475, 35.0925], COMPLEXES), "noksan");
  assert.equal(depotChoice([128.8721, 35.1493], COMPLEXES), KEEP_DEPOT);
  assert.equal(depotChoice(undefined, COMPLEXES), "");
  assert.equal(depotChoice(null, COMPLEXES), "");
});

test("저장된 차량 정보로 입력 칸을 채운다(새 업체의 빈 fleet도 받는다)", () => {
  const draft = fleetDraft({ depot: [128.9845, 35.1475], capacityKg: 5000, capacityM3: 20, costPerKm: 1200, count: 2, complexes: ["noksan"] }, ["화", "목"], COMPLEXES);
  assert.deepEqual(draft, { depot: "sasang", capacityKg: "5000", capacityM3: "20", costPerKm: "1200", count: "2", complexes: ["noksan"], days: ["화", "목"] });
  assert.deepEqual(fleetDraft({}, [], COMPLEXES), { depot: "", capacityKg: "", capacityM3: "", costPerKm: "", count: "", complexes: [], days: [] });
});

test("적은 숫자만 검사한다: 무게·부피는 0보다 크고, 운송비는 0 이상, 대수는 1 이상의 정수", () => {
  const base = fleetDraft(null, [], COMPLEXES);
  assert.deepEqual(fleetErrors(base), {}, "빈 칸은 아직 모르는 값으로 둔다");
  assert.deepEqual(fleetErrors({ ...base, capacityKg: "5,000", capacityM3: "20", costPerKm: "0", count: "3" }), {});
  const errors = fleetErrors({ ...base, capacityKg: "0", capacityM3: "abc", costPerKm: "-1", count: "1.5" });
  assert.ok(errors.capacityKg && errors.capacityM3 && errors.costPerKm && errors.count);
});

test("요일은 월~일 순서로 두고, 목록에 없는 예전 값은 뒤에 남긴다", () => {
  assert.deepEqual(sortDays(["목", "화", "목", " 월 "]), ["월", "화", "목"]);
  assert.deepEqual(sortDays(["평일", "화"]), ["화", "평일"]);
  assert.deepEqual(toggleDay(["화", "목"], "월"), ["월", "화", "목"]);
  assert.deepEqual(toggleDay(["화", "목"], "화"), ["목"]);
});

test("보낼 차량 정보: 빈 칸은 보내지 않고, 차고지는 산업단지 중심으로, '그대로'면 이전 좌표를 보낸다", () => {
  const previous = { depot: [128.8721, 35.1493] as [number, number], capacityKg: 5000, capacityM3: 20, costPerKm: 1200, evidence: ["human:x"] };
  const draft = fleetDraft(previous, ["화"], COMPLEXES);
  assert.equal(draft.depot, KEEP_DEPOT);
  assert.deepEqual(fleetBody({ ...draft, capacityKg: "6,000", count: "2", complexes: ["noksan"] }, previous, COMPLEXES, true), {
    depot: [128.8721, 35.1493],
    capacityKg: 6000,
    capacityM3: 20,
    costPerKm: 1200,
    count: 2,
    complexes: ["noksan"],
  });
  assert.deepEqual(fleetBody({ ...draft, depot: "noksan", count: "2", complexes: ["noksan"] }, previous, COMPLEXES, false), {
    depot: [128.8475, 35.0925],
    capacityKg: 5000,
    capacityM3: 20,
    costPerKm: 1200,
  }, "백엔드가 받지 않는 칸은 싣지 않는다");
  assert.equal(fleetBody(fleetDraft(null, [], COMPLEXES), null, COMPLEXES, true), null, "아무것도 적지 않으면 fleet을 보내지 않는다");
  assert.deepEqual(
    fleetBody({ ...fleetDraft({ complexes: ["noksan"] }, [], COMPLEXES), complexes: [] }, { complexes: ["noksan"] }, COMPLEXES, true),
    { complexes: [] },
    "다니는 산업단지를 모두 풀면 빈 목록으로 지운다",
  );
});

test("보낸 차량 대수·다니는 산업단지가 저장한 응답에 없으면 백엔드가 받지 않은 것으로 본다", () => {
  assert.equal(fleetExtrasKept({ count: 2, complexes: ["noksan"] }, { count: 2, complexes: ["noksan"] }), true);
  assert.equal(fleetExtrasKept({ count: 2 }, { capacityKg: 5000 }), false);
  assert.equal(fleetExtrasKept({ complexes: ["noksan"] }, { capacityKg: 5000 }), false);
  assert.equal(fleetExtrasKept({ capacityKg: 5000 }, { capacityKg: 5000 }), true, "보내지 않은 값은 따지지 않는다");
  assert.equal(fleetExtrasKept(null, null), true);
});
