/**
 * 실제 백엔드(app.v3.devserver, 규칙 정책)가 낸 진단 뷰가 화면 타입의 정본(schema.ts)에 맞는지 본다.
 *  - src/lib/v3/fixture-data/view.json: 승인 전 상태(예시 데이터로도 쓴다). scripts/v3-capture-fixture.mjs로 다시 받는다.
 *  - tests/fixtures/v3-view-confirmed.json: 양쪽 승인 뒤 확정 상태
 *  - tests/fixtures/v3-view-vendor-confirmed.json: 같은 진단을 처리 업체((주)남해열분해)가 본 뷰
 *  - tests/fixtures/v3-view-{declined,blocked,handoff}.json: 자동 거절, 승인 막힘, 담당자 인계 상태(tests/fixtures/README.md)
 *  - tests/fixtures/v3-view-{terms-changed,renegotiated,vendor-renegotiated}.json: 합의 뒤 업체 조건 변경으로 막힌 뷰,
 *    다시 실행해 재합의한 뷰, 그 업체가 본 뷰
 * 위 세 건(승인 전, 확정 뒤 두 건)은 scripts/v3-capture-fixture.mjs가 한 번에 다시 받는다.
 * V3_API_BASE를 주면 돌고 있는 서버의 근거 응답도 함께 검사한다. V3_VIEW_FILES로 저장소 밖의 뷰 파일도 검사한다.
 * 실행: node --test tests/v3-view.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { z } from "zod";
import {
  checkKeySchema,
  diagnosisViewSchema,
  evidenceSchema,
  orgSchema,
  rejectionSchema,
  reportSchema,
} from "../src/lib/v3/schema.ts";
import {
  BLOCK_CODE_LABEL,
  CHECK_KEY_LABEL,
  EDGE_KIND_LABEL,
  REJECTION_LABEL,
  blockCodeLabel,
  blockNotice,
  calledByLabel,
  formatUnitPrice,
  isUnitPriceClaim,
  modelLabel,
  rejectionLabel,
  sessionLabel,
} from "../src/lib/v3/format.ts";
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

test("실적 리포트(확정 뒤 검수 한 건)가 스키마에 맞고, 합계는 실적만 더한다", () => {
  const report = reportSchema.parse(read("./fixtures/v3-report.json"));
  assert.ok(report.records.length > 0);
  assert.equal(report.totals?.count, report.records.length);
  const kg = report.records.reduce((sum, item) => sum + Number(item.kg?.value ?? 0), 0);
  assert.equal(report.totals?.kg?.value, kg);
  // 처리비 합계는 낸 금액의 크기(양수)다
  if (report.totals?.fee) assert.ok(Number(report.totals.fee.value) > 0);
  assert.ok(report.planned.length > 0, "확정한 합의는 예상으로 보인다");
});

test("분리 개선 안내: 더 받는 길은 지금보다 단가가 높고, 한 달 차이는 계산 근거가 맨 앞이다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  const items = view.result?.improvements ?? [];
  assert.ok(items.length > 0);
  for (const item of items) {
    const option = item.option;
    if (!option) continue;
    const assigned = view.result?.assignments.find((a) => a.streamId === item.streamId);
    if (assigned?.unitPrice && typeof assigned.unitPrice.value === "number") {
      assert.ok(Number(option.unitPrice?.value) > assigned.unitPrice.value);
    }
    if (option.monthlyGain) assert.match(option.monthlyGain.evidence[0], /^calc:improve_gain:/);
  }
});

test("업체가 본 뷰에는 분리 개선 안내와 현행 처리(계약 포함)가 없다", () => {
  const view = diagnosisViewSchema.parse(read("./fixtures/v3-view-vendor-confirmed.json"));
  assert.equal(view.result?.improvements, undefined);
  assert.ok(view.streams.every((stream) => stream.currentTreatment === null));
});

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
    assert.equal(thread.vendorModel?.provider, "rule");
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
  assert.equal(formatUnitPrice(claim(320, "unitPrice")), "매입 kg당 320원");
  // 처리비는 값이 음수 그대로 온다
  assert.equal(formatUnitPrice(claim(-80, "treatmentFee")), "처리비 kg당 80원");
  assert.equal(formatUnitPrice(claim(0, "unitPrice")), "무상 kg당 0원");
  assert.equal(formatUnitPrice(claim(null, "unitPrice")), null);
  // role이 없는 단가(실제 결과의 기준표 단가)는 부호로 가린다
  assert.equal(formatUnitPrice(claim(-80)), "처리비 kg당 80원");
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
      // 사유는 문장이 아니라 코드 배열로 읽는다
      assert.ok(blocked.length > 0 && blocked.every((approval) => approval.blockedCodes.includes("EVIDENCE_CHANGED")));
      assert.ok(blocked.some((approval) => approval.blockedCodes.includes("STREAM_CHANGED")));
      for (const approval of blocked) {
        assert.equal(blockNotice(approval.blockedCodes)?.action, "rediagnose");
        assert.equal(blockNotice(approval.blockedCodes)?.headline, "자료가 바뀌었습니다. 새 진단이 필요합니다");
        for (const code of approval.blockedCodes) assert.ok(BLOCK_CODE_LABEL[code], `${code}의 풀이가 없다`);
      }
      // 막히지 않은 승인의 코드는 빈 배열이다
      assert.ok(view.approvals.filter((approval) => !approval.blocked).every((approval) => approval.blockedCodes.length === 0));
    },
  ],
  [
    "업체 조건 변경으로 승인 막힘",
    "./fixtures/v3-view-terms-changed.json",
    (view: View) => {
      const blocked = view.approvals.filter((approval) => approval.blocked);
      assert.equal(blocked.length, 1);
      assert.deepEqual(blocked[0].blockedCodes, ["VENDOR_TERMS_CHANGED"]);
      assert.equal(blocked[0].emitter || blocked[0].vendor, false);
      const notice = blockNotice(blocked[0].blockedCodes);
      assert.equal(notice?.action, "rerun");
      assert.equal(notice?.headline, "업체가 조건을 바꿨습니다. 다시 실행하면 새 조건으로 이어 갑니다");
      // 대화는 합의 그대로이고 진단은 승인 대기다(다시 실행하기 전)
      assert.equal(view.threads.find((item) => item.id === blocked[0].threadId)?.status, "agreed");
      assert.equal(view.session.status, "awaiting_approval");
    },
  ],
  [
    "다시 실행해 재합의",
    "./fixtures/v3-view-renegotiated.json",
    (view: View) => {
      assert.equal(view.session.status, "awaiting_approval");
      assert.ok(view.approvals.every((approval) => !approval.blocked && approval.blockedCodes.length === 0));
      // 다시 연 대화: 회사 측의 counter는 코드가 쓴 메시지이고 숫자와 claim이 없다
      const reopened = view.threads.filter((item) =>
        item.messages.some((message) => message.type === "counter" && message.model?.provider === "code"),
      );
      assert.equal(reopened.length, 1);
      const [thread] = reopened;
      assert.equal(thread.status, "agreed");
      const counter = thread.messages.find((message) => message.type === "counter");
      assert.equal(modelLabel(counter?.model), "진행기(코드)");
      assert.equal(counter?.claims.length, 0);
      assert.ok(counter?.meta?.asks.every((ask) => ask.field === "terms"));
      // 업체 측이 그 뒤에 지금 조건으로 다시 답했다
      assert.ok(thread.messages.some((message) => message.seq > (counter?.seq ?? 0) && message.from === thread.vendorOrgId));
      assert.equal(thread.agreedSeq !== null && thread.agreedSeq > (counter?.seq ?? 0), true);
      // 실행 기록에 다시 연 번호가 남는다
      const event = view.events.find((item) => typeof item.detail.reopenedSeq === "number");
      assert.equal(event?.detail.reopenedSeq, counter?.seq);
      assert.equal(event?.threadId, thread.id);
    },
  ],
  [
    "담당자 인계",
    "./fixtures/v3-view-handoff.json",
    (view: View) => {
      const handed = view.threads.filter((item) => item.status === "handoff");
      assert.ok(handed.length > 0 && handed.every((item) => item.messages.at(-1)?.type === "handoff"));
      // 담당자 인계 메시지는 코드가 쓴다
      assert.ok(handed.every((item) => item.messages.at(-1)?.model?.provider === "code"));
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

test("업체가 본 뷰의 판단 그래프에는 자기 매입 기준 노드와 대조·배정 엣지만 있다", () => {
  const view = diagnosisViewSchema.parse(read("./fixtures/v3-view-vendor-renegotiated.json"));
  assert.equal(view.viewer.role, "vendor");
  const { nodes, edges } = view.graph;
  const type = new Map(nodes.map((node) => [node.id, node.type]));
  const criteria = nodes.filter((node) => node.type === "criterion");
  assert.ok(criteria.length > 0);
  // 기준 노드 이름은 재질·등급(·형태)이다
  assert.ok(criteria.every((node) => node.label.includes(" · ")));
  // 업체는 자기 하나뿐이고 다른 업체의 기준은 없다
  assert.deepEqual(nodes.filter((node) => node.type === "vendor").map((node) => node.id), [view.viewer.orgId]);
  const kinds = new Set(edges.map((edge) => edge.kind));
  assert.ok(kinds.has("criterion") && kinds.has("assignment"));
  assert.ok(!kinds.has("regulation"));
  for (const kind of kinds) assert.ok(EDGE_KIND_LABEL[kind], `${kind}의 화면 이름이 없다`);
  // 기준마다 흐름 → 기준, 기준 → 업체 엣지가 있다
  for (const node of criteria) {
    assert.ok(edges.some((edge) => edge.kind === "criterion" && edge.to === node.id && type.get(edge.from) === "stream"));
    assert.ok(edges.some((edge) => edge.kind === "criterion" && edge.from === node.id && edge.to === view.viewer.orgId));
  }
  const layout = layoutGraph(nodes, dedupeEdges(edges), nodes.filter((node) => node.type === "evidence"));
  for (const node of nodes) assert.ok(layout.position.has(node.id), `${node.id}의 자리가 없다`);
  assert.ok(criteria.every((node) => layout.vendorOf.get(node.id) === view.viewer.orgId));
  assert.ok(layout.assigned.size > 0);
  // 업체 뷰에는 현행 처리에서 나온 값이 없다
  assert.ok(view.streams.every((item) => item.currentTreatment === null));
});

test("거부 기록은 코드와 일반 문장만 오고, 코드마다 화면 풀이가 있다", () => {
  // 백엔드 agents/draft.py의 public_rejections가 내는 모양
  const entry = { code: "UNBACKED_TERM", message: "일반 문장", claimId: null, detail: {}, attempt: 2 };
  assert.deepEqual(problems(rejectionSchema.safeParse(entry)), []);
  assert.ok(rejectionLabel("UNBACKED_TERM").includes("숫자 없이 조건을 뜻하는 낱말"));
  // 계약 8장 "초안 거부 코드"
  for (const code of [
    "NUMBER_OUTSIDE_PLACEHOLDER",
    "UNKNOWN_PLACEHOLDER",
    "UNUSED_CLAIM",
    "CLAIM_WITHOUT_EVIDENCE",
    "EVIDENCE_NOT_FOUND",
    "EVIDENCE_FORBIDDEN",
    "EVIDENCE_EXPIRED",
    "VALUE_MISMATCH",
    "UNIT_MISMATCH",
    "QUOTE_MISMATCH",
    "UNKNOWN_CLAIM_REF",
    "TYPE_NOT_ALLOWED",
    "APPROVAL_REQUIRED",
    "THREAD_RULE",
    "UNKNOWN_STREAM",
    "PERMIT_MISMATCH",
    "UNBACKED_TERM",
    "TOO_MANY_TOOL_ROUNDS",
    "INVALID_OUTPUT",
    "MODEL_ERROR",
    "REJECTED",
  ]) {
    assert.ok(REJECTION_LABEL[code], `${code}의 풀이가 없다`);
  }
  assert.equal(rejectionLabel("GUARDRAIL_PRICE_BELOW_FLOOR"), "업체 가드레일 밖의 조건이었습니다");
  assert.equal(rejectionLabel("GUARDRAIL_TERMS_MISSING"), "조건을 내는 메시지의 조건 항목이 없거나 값과 맞지 않았습니다");
  assert.equal(rejectionLabel("OTHER_EMITTER_NAMED"), "다른 배출 기업의 정보를 드러내는 내용이었습니다");
  // 표에 없는 코드는 서버가 준 일반 문장을 쓴다
  assert.equal(rejectionLabel("SOMETHING_NEW", "서버가 준 문장"), "서버가 준 문장");
  // 승인을 막는 코드에 검증기 코드가 섞여 와도 풀이가 있다
  assert.ok(blockCodeLabel("EVIDENCE_EXPIRED").length > 0 && blockCodeLabel("SOMETHING_NEW").length > 0);
  assert.equal(blockNotice([]), null);
  assert.equal(blockNotice(["VENDOR_TERMS_CHANGED", "STREAM_CHANGED"])?.action, "rediagnose");
  assert.equal(blockNotice(["EVIDENCE_EXPIRED"])?.action, "rediagnose");
});

test("실행 기록의 새 항목(calledBy, reportedBy, codes)이 화면이 읽는 모양으로 온다", () => {
  const view = diagnosisViewSchema.parse(read("../src/lib/v3/fixture-data/view.json"));
  const calls = view.events.filter((event) => event.kind === "tool_call");
  assert.ok(calls.length > 0);
  for (const event of calls) {
    assert.ok(calledByLabel(event.detail.calledBy), `calledBy ${String(event.detail.calledBy)}의 화면 이름이 없다`);
  }
  assert.equal(calledByLabel("code"), "정해진 순서에 따라 부름");
  assert.equal(calledByLabel("model:rule"), "AI가 부름");
  assert.equal(calledByLabel(undefined), null);
  assert.ok(view.events.some((event) => event.detail.reportedBy === "vendor"));
  const coded = view.events.filter((event) => event.detail.codes !== undefined);
  assert.ok(coded.length > 0);
  assert.ok(coded.every((event) => Array.isArray(event.detail.codes) && event.detail.codes.every((code) => typeof code === "string")));
});

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
  // access에는 보는 조직과 소유 조직만 실린다(전체 공개는 "*")
  for (const hit of hits) {
    const { access } = evidenceSchema.parse(hit.evidence);
    assert.ok(access.includes("*") || (access.includes("org_hanbit") && access.length <= 2), `access가 넓다: ${access.join(",")}`);
  }
});

test("돌고 있는 서버의 관리자 상태에 인증 모드가 있다", { skip: base ? false : "V3_API_BASE가 없어 건너뜀" }, async () => {
  const response = await fetch(`${base}/admin/status`, { headers: { "X-Org-Id": "org_admin" } });
  assert.equal(response.status, 200);
  const status = (await response.json()) as { auth?: { mode?: string; demoOnly?: boolean } };
  assert.ok(status.auth?.mode === "header" || status.auth?.mode === "token");
  assert.equal(typeof status.auth?.demoOnly, "boolean");
});
