/**
 * 실제 백엔드(app.v3.devserver, 규칙 정책)가 낸 진단 뷰가 화면 타입의 정본(schema.ts)에 맞는지 본다.
 *  - src/lib/v3/fixture-data/view.json: 승인 전 상태(예시 데이터로도 쓴다). scripts/v3-capture-fixture.mjs로 다시 받는다.
 *  - tests/fixtures/v3-view-confirmed.json: 양쪽 승인 뒤 확정 상태
 * V3_API_BASE를 주면 돌고 있는 서버의 근거 응답도 함께 검사한다.
 * 실행: node --test tests/v3-view.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { diagnosisViewSchema, evidenceSchema } from "../src/lib/v3/schema.ts";
import { formatUnitPrice, isUnitPriceClaim, modelLabel } from "../src/lib/v3/format.ts";

const read = (relative: string) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as unknown;

function problems(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  if (result.success) return [];
  return (result.error?.issues ?? []).slice(0, 20).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

for (const [name, file] of [
  ["승인 전", "../src/lib/v3/fixture-data/view.json"],
  ["확정 뒤", "./fixtures/v3-view-confirmed.json"],
] as const) {
  test(`진단 뷰(${name})가 스키마에 맞는다`, () => {
    assert.deepEqual(problems(diagnosisViewSchema.safeParse(read(file))), []);
  });
}

test("확정 뒤 뷰에는 요청서와 이행 계획서가 있고 모두 검증을 통과했다", () => {
  const view = diagnosisViewSchema.parse(read("./fixtures/v3-view-confirmed.json"));
  assert.equal(view.session.status, "confirmed");
  assert.ok(view.documents.some((item) => item.kind === "request"));
  assert.ok(view.documents.some((item) => item.kind === "plan"));
  assert.ok(view.documents.every((item) => item.validation.ok));
});

test("예시 데이터의 근거 레코드가 스키마에 맞는다", () => {
  const records = read("../src/lib/v3/fixture-data/evidence.json") as Record<string, unknown>;
  const bad = Object.entries(records).flatMap(([id, record]) =>
    problems(evidenceSchema.safeParse(record)).map((line) => `${id} ${line}`),
  );
  assert.deepEqual(bad.slice(0, 10), []);
});

test("예시 데이터는 규칙 정책(모델 미연결)이 쓴 것으로 표시된다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  for (const thread of view.threads) {
    assert.equal(thread.vendorModel.provider, "rule");
    assert.equal(modelLabel(thread.vendorModel), "규칙 정책(모델 미연결)");
  }
});

test("단가 부호를 매입과 처리비로 푼다", () => {
  const claim = (value: number | null) => ({ id: "st_x_unitPrice", kind: "number" as const, value, unit: "원/kg", evidence: [] });
  assert.equal(formatUnitPrice(claim(320)), "매입 320 원/kg");
  assert.equal(formatUnitPrice(claim(-80)), "처리비 80 원/kg");
  assert.equal(formatUnitPrice(claim(0)), "무상 0 원/kg");
  assert.equal(formatUnitPrice(claim(null)), null);
  assert.equal(isUnitPriceClaim(claim(1)), true);
  assert.equal(isUnitPriceClaim({ ...claim(1), id: "st_x_currentUnitCost" }), false);
});

const base = process.env.V3_API_BASE;
test("돌고 있는 서버의 근거 응답이 스키마에 맞는다", { skip: base ? false : "V3_API_BASE가 없어 건너뜀" }, async () => {
  const response = await fetch(`${base}/evidence?q=PP`, { headers: { "X-Org-Id": "org_hanbit" } });
  assert.equal(response.status, 200);
  const hits = (await response.json()) as { evidence: unknown }[];
  assert.ok(hits.length > 0);
  for (const hit of hits) assert.deepEqual(problems(evidenceSchema.safeParse(hit.evidence)), []);
});
