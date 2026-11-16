/**
 * 실제 백엔드(app.v3.devserver, 규칙 정책)가 낸 진단 뷰가 화면 타입의 정본(schema.ts)에 맞는지 본다.
 *  - src/lib/v3/fixture-data/view.json: 승인 전 상태(예시 데이터로도 쓴다). scripts/v3-capture-fixture.mjs로 다시 받는다.
 *  - tests/fixtures/v3-view-confirmed.json: 양쪽 승인 뒤 확정 상태
 *  - tests/fixtures/v3-view-vendor-confirmed.json: 같은 진단을 처리 업체((주)남해열분해)가 본 뷰
 *  - tests/fixtures/v3-view-{declined,blocked,handoff}.json: 자동 거절, 승인 막힘, 담당자 인계 상태(tests/fixtures/README.md)
 * 위 세 건(승인 전, 확정 뒤 두 건)은 scripts/v3-capture-fixture.mjs가 한 번에 다시 받는다.
 * V3_API_BASE를 주면 돌고 있는 서버의 근거 응답도 함께 검사한다. V3_VIEW_FILES로 저장소 밖의 뷰 파일도 검사한다.
 * 실행: node --test tests/v3-view.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { z } from "zod";
import { checkKeySchema, diagnosisViewSchema, evidenceSchema, orgSchema } from "../src/lib/v3/schema.ts";
import { CHECK_KEY_LABEL, formatUnitPrice, isUnitPriceClaim, modelLabel, sessionLabel } from "../src/lib/v3/format.ts";
import { countCrossings, dedupeEdges, layoutGraph } from "../src/lib/v3/graph-layout.ts";

type View = z.infer<typeof diagnosisViewSchema>;

const read = (relative: string) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as unknown;

function problems(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  if (result.success) return [];
  return (result.error?.issues ?? []).slice(0, 20).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

for (const [name, file] of [
  ["승인 전", "../src/lib/v3/fixture-data/view.json"],
  ["확정 뒤", "./fixtures/v3-view-confirmed.json"],
  ["확정 뒤, 업체가 본 뷰", "./fixtures/v3-view-vendor-confirmed.json"],
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

test("업체가 본 뷰에는 배출 기업의 현행 처리와 손익이 없다", () => {
  const view = diagnosisViewSchema.parse(read("./fixtures/v3-view-vendor-confirmed.json"));
  assert.equal(view.viewer.role, "vendor");
  assert.ok(view.streams.every((item) => item.currentTreatment === null));
  assert.ok((view.result?.assignments ?? []).every((item) => item.monthlyNow === null && item.difference === null));
  assert.equal(view.questions.length, 0);
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

test("단가는 claim의 role로 가리고 처리비는 크기로 적는다", () => {
  const claim = (value: number | null, role?: "unitPrice" | "treatmentFee" | "currentUnitCost") => ({
    id: "c1",
    kind: "number" as const,
    value,
    unit: "원/kg",
    evidence: [],
    ...(role ? { role } : {}),
  });
  assert.equal(formatUnitPrice(claim(320, "unitPrice")), "매입 320 원/kg");
  // 처리비는 값이 음수 그대로 온다
  assert.equal(formatUnitPrice(claim(-80, "treatmentFee")), "처리비 80 원/kg");
  assert.equal(formatUnitPrice(claim(0, "unitPrice")), "무상 0 원/kg");
  assert.equal(formatUnitPrice(claim(null, "unitPrice")), null);
  // role이 없는 단가(실제 결과의 기준표 단가)는 부호로 가린다
  assert.equal(formatUnitPrice(claim(-80)), "처리비 80 원/kg");
  assert.equal(isUnitPriceClaim(claim(1, "unitPrice")), true);
  assert.equal(isUnitPriceClaim(claim(-1, "treatmentFee")), true);
  assert.equal(isUnitPriceClaim(claim(1, "currentUnitCost")), false);
  // ID 끝말로는 가리지 않는다
  assert.equal(isUnitPriceClaim({ ...claim(1), id: "st_x_unitPrice" }), false);
});

test("뷰의 단가 claim에는 role이 붙어 있고 처리비는 음수다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  const prices = (view.result?.assignments ?? []).flatMap((item) => (item.unitPrice ? [item.unitPrice] : []));
  assert.ok(prices.length > 0);
  for (const price of prices) {
    assert.ok(price.role === "unitPrice" || price.role === "treatmentFee", `${price.id}에 단가 role이 없다`);
    if (price.role === "treatmentFee") assert.ok(typeof price.value === "number" && price.value < 0);
  }
  assert.ok(prices.some((price) => price.role === "treatmentFee"));
});

test("가정값은 이름과 값으로 오고, 확인 항목의 key는 모두 화면 이름이 있다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  assert.ok((view.result?.assumptions.length ?? 0) > 0);
  for (const item of view.result?.assumptions ?? []) {
    assert.ok(item.id.startsWith("assumption:") && item.label.length > 0);
  }
  for (const key of checkKeySchema.options) assert.ok(CHECK_KEY_LABEL[key], `${key}의 화면 이름이 없다`);
  const keys = new Set((view.result?.assignments ?? []).flatMap((item) => item.checks.map((check) => check.key)));
  // 적재 검사는 충족해도 나온다
  assert.ok(keys.has("min_volume") && keys.has("loading"));
});

test("확정 뒤 뷰에는 사람 교정과 업체의 실제 결과가 있다", () => {
  const view = diagnosisViewSchema.parse(read("./fixtures/v3-view-confirmed.json"));
  assert.equal(view.feedback.corrections.length, 1);
  assert.equal(view.feedback.outcomes.length, 1);
  assert.ok(view.events.some((event) => event.kind === "feedback"));
  // 승인 칸은 합의·확정 대화에만 있다
  const open = new Set(view.threads.filter((item) => ["agreed", "confirmed"].includes(item.status)).map((item) => item.id));
  assert.ok(view.approvals.every((approval) => open.has(approval.threadId)));
  // 업체에게는 교정이 가지 않는다
  const vendor = diagnosisViewSchema.parse(read("./fixtures/v3-view-vendor-confirmed.json"));
  assert.equal(vendor.feedback.corrections.length, 0);
  assert.equal(vendor.feedback.outcomes.length, 1);
});

test("실행 기록의 숨긴 근거 개수는 정수다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  const hidden = view.events.map((event) => event.detail.hiddenEvidenceCount).filter((count) => count !== undefined);
  assert.ok(hidden.length > 0);
  assert.ok(hidden.every((count) => Number.isInteger(count) && (count as number) > 0));
});

test("조직 목록은 order 순이고 운영 조직이 맨 뒤다", () => {
  const { orgs } = read("../src/lib/v3/fixture-data/records.json") as { orgs: unknown[] };
  const parsed = orgs.map((org) => orgSchema.parse(org));
  assert.equal(parsed[0].id, "org_hanbit");
  assert.equal(parsed.at(-1)?.role, "admin");
  const order = parsed.map((org) => org.order ?? Infinity);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test("판단 그래프의 노드 순서가 선 겹침을 늘리지 않고 모든 노드에 자리가 있다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  const { nodes, edges } = view.graph;
  const ids = (type: string) => nodes.filter((node) => node.type === type).map((node) => node.id);
  const layout = layoutGraph(nodes, dedupeEdges(edges), nodes.filter((node) => node.type === "evidence"));
  for (const node of nodes) assert.ok(layout.position.has(node.id), `${node.id}의 자리가 없다`);
  const before = countCrossings(ids("stream"), ids("criterion"), edges);
  const after = countCrossings(layout.streamOrder, layout.criterionOrder, edges);
  assert.ok(after <= before, `겹침이 늘었다: ${before} → ${after}`);
  // 기준은 자기 업체 옆에 묶여 있다(업체가 바뀌는 횟수가 업체 수보다 적다)
  const vendors = layout.criterionOrder.map((criterion) => layout.vendorOf.get(criterion));
  const switches = vendors.filter((vendor, index) => index > 0 && vendor !== vendors[index - 1]).length;
  assert.ok(switches < new Set(vendors).size);
});

// 거절·담당자 인계·승인 막힘은 시연 시나리오에 없어 devserver에서 따로 만든 뷰로 본다(tests/fixtures/README.md)
for (const [name, file, check] of [
  [
    "자동 거절",
    "./fixtures/v3-view-declined.json",
    (view: View) => {
      const declined = view.threads.filter((item) => item.status === "declined");
      assert.ok(declined.length > 0 && declined.every((item) => item.statusReason));
      assert.ok(declined.every((item) => item.messages.at(-1)?.type === "decline"));
      assert.ok(view.approvals.every((approval) => !declined.some((item) => item.id === approval.threadId)));
    },
  ],
  [
    "승인 막힘",
    "./fixtures/v3-view-blocked.json",
    (view: View) => {
      const blocked = view.approvals.filter((approval) => approval.blocked);
      assert.ok(blocked.length > 0 && blocked.every((approval) => approval.blockedReason?.includes("EVIDENCE_CHANGED")));
    },
  ],
  [
    "담당자 인계",
    "./fixtures/v3-view-handoff.json",
    (view: View) => {
      const handed = view.threads.filter((item) => item.status === "handoff");
      assert.ok(handed.length > 0 && handed.every((item) => item.messages.at(-1)?.type === "handoff"));
      // 넘어간 대화의 승인 칸은 없고, 승인할 대화가 남지 않아 idle·done이다
      assert.equal(view.approvals.length, 0);
      assert.equal(view.session.status, "idle");
      assert.equal(view.session.phase, "done");
      assert.equal(sessionLabel(view.session.status, view.session.phase, true), "합의 없이 끝남");
      const moved = (view.result?.assignments ?? []).filter((item) => item.checks.some((item2) => item2.key === "handoff"));
      assert.ok(moved.length > 0);
      assert.ok(moved.every((item) => item.vendorOrgId === null && item.status === "needs_information"));
    },
  ],
] as const) {
  test(`진단 뷰(${name})가 스키마에 맞고 그 상태가 보인다`, () => {
    const parsed = diagnosisViewSchema.safeParse(read(file));
    assert.deepEqual(problems(parsed), []);
    if (parsed.success) check(parsed.data);
  });
}

// 저장소 밖에 받아 둔 뷰(쉼표로 나눈 경로)도 같은 스키마로 본다: V3_VIEW_FILES=/경로/a.json,/경로/b.json
for (const file of (process.env.V3_VIEW_FILES ?? "").split(",").filter(Boolean)) {
  test(`진단 뷰(${file})가 스키마에 맞는다`, () => {
    assert.deepEqual(problems(diagnosisViewSchema.safeParse(JSON.parse(readFileSync(file, "utf8")))), []);
  });
}

const base = process.env.V3_API_BASE;
test("돌고 있는 서버의 근거 응답이 스키마에 맞는다", { skip: base ? false : "V3_API_BASE가 없어 건너뜀" }, async () => {
  const response = await fetch(`${base}/evidence?q=PP`, { headers: { "X-Org-Id": "org_hanbit" } });
  assert.equal(response.status, 200);
  const hits = (await response.json()) as { evidence: unknown }[];
  assert.ok(hits.length > 0);
  for (const hit of hits) assert.deepEqual(problems(evidenceSchema.safeParse(hit.evidence)), []);
});
