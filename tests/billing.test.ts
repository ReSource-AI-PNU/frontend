/**
 * 자료 화면의 현행 처리비 입력(src/lib/v3/billing.ts). 계약한 꼴(kg당, 회당 × 월 횟수, 월 정액)을 PUT 본문으로 바꾼다.
 * 실행: node --test tests/billing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingHint,
  billingText,
  initialFields,
  parseAmount,
  parseCount,
  treatmentInput,
  type BillingFields,
} from "../src/lib/v3/billing.ts";

const JARGON = /env|API|백엔드|billing|per_trip|monthly|unitCost|PUT|null|undefined/;
const empty: BillingFields = { mode: "per_kg", perKg: "", perTrip: "", trips: "", monthly: "" };
const stream = { monthlyKg: 1200, currentTreatment: { method: "혼합 소각", unitCostKrwPerKg: 250, evidence: ["doc:x"] } };

test("금액은 쉼표, 원, 만 단위를 읽고 못 읽으면 NaN이다", () => {
  assert.equal(parseAmount("300000"), 300000);
  assert.equal(parseAmount("300,000원"), 300000);
  assert.equal(parseAmount("30만"), 300000);
  assert.equal(parseAmount("1.5만 원"), 15000);
  assert.equal(parseAmount(""), null);
  assert.ok(Number.isNaN(parseAmount("삼십만")));
  assert.equal(parseCount("2회"), 2);
  assert.equal(parseCount("3번"), 3);
  assert.ok(Number.isNaN(parseCount("두 번")));
});

test("kg당은 단가를, 회당·월 정액은 계약 꼴만 보낸다(kg당은 서버가 다시 계산한다)", () => {
  assert.deepEqual(treatmentInput("혼합 소각", { ...empty, perKg: "250" }, stream), {
    ok: true,
    currentTreatment: { method: "혼합 소각", unitCostKrwPerKg: 250, billing: null, evidence: ["doc:x"] },
  });
  const trip = treatmentInput("위탁 소각", { ...empty, mode: "per_trip", perTrip: "30만", trips: "2" }, stream);
  assert.ok(trip.ok);
  assert.deepEqual(trip.ok && trip.currentTreatment?.billing, { kind: "per_trip", krwPerTrip: 300000, tripsPerMonth: 2 });
  assert.equal(trip.ok && trip.currentTreatment?.unitCostKrwPerKg, null);
  const monthly = treatmentInput("위탁 소각", { ...empty, mode: "monthly", monthly: "600,000" }, stream);
  assert.deepEqual(monthly.ok && monthly.currentTreatment?.billing, { kind: "monthly", krwPerMonth: 600000 });
});

test("처리 방법을 비우면 가정값(null)이고, 빠진 값은 담당자 말로 알려 준다", () => {
  assert.deepEqual(treatmentInput("  ", empty, stream), { ok: true, currentTreatment: null });
  const messages = [
    treatmentInput("소각", empty, stream),
    treatmentInput("소각", { ...empty, perKg: "abc" }, stream),
    treatmentInput("소각", { ...empty, mode: "per_trip", perTrip: "30만" }, stream),
    treatmentInput("소각", { ...empty, mode: "per_trip", trips: "2" }, stream),
    treatmentInput("소각", { ...empty, mode: "monthly" }, stream),
    treatmentInput("소각", { ...empty, mode: "monthly", monthly: "60만" }, { ...stream, monthlyKg: null }),
  ];
  for (const result of messages) {
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.doesNotMatch(result.message, JARGON);
      assert.match(result.message, /(니다|주세요)\.|예: /);
    }
  }
  const noKg = messages.at(-1);
  assert.ok(noKg && !noKg.ok && /한 달 발생량/.test(noKg.message));
});

test("저장된 계약은 그 꼴로 다시 열고, 사람이 읽는 꼴로 적는다", () => {
  const trip = { method: "소각", unitCostKrwPerKg: 500, billing: { kind: "per_trip" as const, krwPerTrip: 300000, tripsPerMonth: 2 }, evidence: [] };
  assert.deepEqual(initialFields(trip), { mode: "per_trip", perKg: "", perTrip: "300000", trips: "2", monthly: "" });
  assert.equal(initialFields(null).mode, "per_kg");
  assert.equal(initialFields(stream.currentTreatment).perKg, "250");
  assert.equal(billingText(trip.billing), "회당 300,000원 × 월 2회");
  assert.equal(billingText({ kind: "monthly", krwPerMonth: 450000 }), "월 정액 450,000원");
  for (const mode of ["per_kg", "per_trip", "monthly"] as const) assert.doesNotMatch(billingHint(mode), JARGON);
});
