/**
 * 회사별 기록(GET /orgs/{orgId}/memory)과 계약 검토의 "지난 검수 기록" 항목이 화면 스키마에 맞는지 본다.
 * 예시 데이터(tests/fixtures/v3-memory.json)는 백엔드(app/v3/memory.py)가 시연 회사로 실제 낸 응답이다.
 * 실행: node --test tests/memory.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignmentSchema, contractReviewSchema, orgMemorySchema, vendorMemorySchema } from "../src/lib/v3/schema.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/v3-memory.json", import.meta.url), "utf8"));

test("회사별 기록 응답이 스키마에 맞는다", () => {
  const memory = orgMemorySchema.parse(fixture.memory);
  assert.equal(memory.minRecords, 3);
  const sprue = memory.streams.find((s) => s.streamId === "st_sprue");
  assert.ok(sprue, "검수를 기록한 폐기물이 있다");
  assert.equal(sprue.inspections.status, "below");
  assert.equal(sprue.inspectionRows.length, sprue.inspections.count);
  // 단가는 근거가 열리는 claim으로 온다(화면이 숫자를 지어내지 않는다)
  for (const row of sprue.inspectionRows) {
    assert.ok(row.actualPrice && row.actualPrice.evidence.length > 0);
    assert.ok(row.agreedPrice && row.agreedPrice.evidence.length > 0);
  }
  const unknown = memory.streams.flatMap((s) => s.answers).filter((a) => a.stillUnknown);
  assert.equal(unknown.length, memory.summary.stillUnknown);
});

test("지난 검수가 합의보다 낮게 나왔으면 계약 검토가 확인을 요청한다", () => {
  const review = contractReviewSchema.parse(fixture.review);
  const item = review.items.find((i) => i.key === "history");
  assert.ok(item);
  assert.equal(item.status, "check");
  assert.equal(item.title, "지난 검수 기록");
  assert.ok((item.evidence ?? []).length > 0);
  assert.equal(review.status, "needs_check");
});

test("판정 반영을 승인하면 보정 미리 보기와 승인 기록이 온다", () => {
  const memory = orgMemorySchema.parse(fixture.memory);
  assert.ok(memory.calibration?.applied, "담당자 승인 근거가 있다");
  assert.ok(memory.calibration.applied.evidence.startsWith("human:"));
  const sprue = memory.calibration.streams.find((s) => s.streamId === "st_sprue");
  assert.ok(sprue && sprue.vendors.length > 0 && sprue.vendors[0].ratePct < 0);
});

test("결과 한 줄에 회사 기록 반영 예상 단가가 근거와 함께 온다", () => {
  const row = assignmentSchema.parse(fixture.assignment);
  assert.ok(row.personal?.expectedUnitPrice, "예상 단가 claim");
  assert.ok(row.personal.expectedUnitPrice.evidence.length > 0);
  assert.equal(row.personal.expectedUnitPrice.role, "unitPrice");
  // 계약 단가는 그대로이고 예상 단가가 더 낮다(지난 검수가 합의보다 낮았다)
  assert.ok(row.unitPrice && Number(row.personal.expectedUnitPrice.value) < Number(row.unitPrice.value));
  // 다른 제안도 같은 기준의 예상 단가가 있고, 한 달 값은 보정 전이라고 밝힌다
  const other = row.alternatives.find((a) => a.personalUnitPrice);
  assert.ok(other && other.note.includes("회사 기록 보정 전"));
});

test("처리 업체는 자기 검수 기록을 배출 기업별로 본다", () => {
  const memory = vendorMemorySchema.parse(fixture.vendorMemory);
  assert.equal(memory.role, "vendor");
  const hanbit = memory.emitters.find((e) => e.emitterOrgId === "org_hanbit");
  assert.ok(hanbit && hanbit.inspections.status === "below");
  assert.ok(hanbit.inspectionRows.every((row) => row.streamName.length > 0));
});

test("담당자가 고친 판정이 지금 자료에 반영되지 않았으면 결과 한 줄에 확인 항목이 온다", () => {
  const row = assignmentSchema.parse(fixture.assignment);
  const found = row.checks.find((c) => c.key === "correction_pattern");
  assert.ok(found && found.status === "conditional" && found.evidence.length > 0);
});
