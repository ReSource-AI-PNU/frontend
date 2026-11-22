/**
 * 업체 정보 폼을 다시 그릴 때 고친 칸 지키기(src/lib/v3/vendor-form-carry.ts).
 * 실행: node --test tests/vendor-form-carry.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { carryEdits, refreshedFields, type VendorFormDraft } from "../src/lib/v3/vendor-form-carry.ts";

const draft = (patch: Partial<VendorFormDraft> = {}): VendorFormDraft => ({
  floor: "",
  ceiling: "",
  days: "",
  pickups: "",
  decline: "",
  process: "",
  fallbackGrade: "",
  fleet: { capacityKg: "", vehicleCount: "", serviceAreas: "", routes: [] },
  offRoute: { choice: "" },
  prices: {},
  ...patch,
});

test("도우미가 저장한 키를 폼 칸으로 옮긴다", () => {
  assert.deepEqual(
    [...refreshedFields(["permits", "fleet.capacityKg", "guardrails.days", "process", "criteria", "guardrails.minPickupsPerMonth"])].sort(),
    ["days", "fleet.capacityKg", "pickups", "prices", "process"].sort(),
  );
});

test("담당자가 고쳐 두고 저장하지 않은 칸은 남고, 도우미가 저장한 칸은 새 값이 된다", () => {
  const start = draft();
  const current = draft({
    floor: "120", // 담당자가 고쳐 둠(도우미와 무관)
    days: "월", // 담당자가 고쳐 둠, 그런데 도우미가 요일을 저장함
    fleet: { capacityKg: "", vehicleCount: "3", serviceAreas: "", routes: [{ key: "n1", name: "북부" }] },
    prices: { pc_1: "300" },
  });
  const fresh = draft({
    days: "화, 금",
    fleet: { capacityKg: "5000", vehicleCount: "", serviceAreas: "금정구", routes: [] },
  });
  const out = carryEdits(start, current, fresh, refreshedFields(["guardrails.days", "fleet.capacityKg", "fleet.serviceAreas"]));
  assert.equal(out.floor, "120");
  assert.equal(out.days, "화, 금");
  assert.equal(out.fleet.capacityKg, "5000");
  assert.equal(out.fleet.serviceAreas, "금정구");
  assert.equal(out.fleet.vehicleCount, "3");
  assert.deepEqual(out.fleet.routes, [{ key: "n1", name: "북부" }]);
  assert.deepEqual(out.prices, { pc_1: "300" });
});

test("고치지 않은 칸은 새 저장값을 따른다", () => {
  const start = draft({ process: "재활용" });
  const out = carryEdits(start, start, draft({ process: "열분해" }), new Set());
  assert.equal(out.process, "열분해");
});

test("매입 기준을 새로 저장하면 고쳐 둔 단가 글을 버린다", () => {
  const out = carryEdits(draft(), draft({ prices: { pc_1: "300" } }), draft(), refreshedFields(["criteria"]));
  assert.deepEqual(out.prices, {});
});
