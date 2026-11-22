/**
 * 업체 정보 AI 도우미의 순수 함수(src/lib/v3/onboarding.ts).
 * 실행: node --test tests/onboarding.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { authorLabel, checkSummary, vendorRegistrationSummary, groupDraft, selectedKeys, startOpen } from "../src/lib/v3/onboarding.ts";
import type { OnboardingDraftItem } from "../src/lib/v3/types.ts";

const item = (key: string, section: OnboardingDraftItem["section"]): OnboardingDraftItem => ({
  key,
  section,
  label: key,
  value: null,
  text: key,
  source: { kind: "conversation", label: "담당자 답", quote: null },
});

test("초안은 허가 품목 → 처리 방식 → AI가 지킬 범위 → 노선·차량 순으로 묶고 빈 묶음은 뺀다", () => {
  const groups = groupDraft([item("fleet.capacityKg", "fleet"), item("permits", "permits"), item("fleet.depot", "fleet")]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.map((x) => x.key)]),
    [
      ["허가 품목", ["permits"]],
      ["노선·차량", ["fleet.capacityKg", "fleet.depot"]],
    ],
  );
});

test("요약 한 줄은 탐색에 나오면 그 사실만, 아니면 남은 항목 이름을 적는다", () => {
  assert.equal(checkSummary(false), "문의 후보군에 포함되려면 허가 품목 또는 매입 기준을 추가해 주세요.");
  assert.equal(checkSummary(true), "문의 후보군에 포함됩니다. 실제 문의는 물량별 품목과 조건에 따라 결정됩니다.");
});

test("탐색에 나오고 확인할 초안도 없을 때만 접어서 시작한다", () => {
  assert.equal(startOpen({ discoverable: false, draft: [] }), true);
  assert.equal(startOpen({ discoverable: true, draft: [item("permits", "permits")] }), true);
  assert.equal(startOpen({ discoverable: true, draft: [] }), false);
});

test("새 초안 항목은 골라 두고, 담당자가 뺀 항목만 뺀다", () => {
  const draft = [item("permits", "permits"), item("fleet.depot", "fleet")];
  assert.deepEqual(selectedKeys(draft, new Set(["permits", "gone"])), ["fleet.depot"]);
  assert.deepEqual(selectedKeys(draft, new Set()), ["permits", "fleet.depot"]);
});

test("모델 없이 답한 안내는 AI라고 부르지 않는다", () => {
  assert.equal(authorLabel({ provider: "rule", name: "rule" }, "업체 측 AI"), "자동 안내");
  assert.equal(authorLabel({ provider: "ollama", name: "x" }, "업체 측 AI"), "업체 측 AI");
  assert.equal(authorLabel(null, "업체 측 AI"), "업체 측 AI");
});

test("업체 정보 저장, 후보군 등록, 물량별 거래 확정을 각각 안내한다", () => {
  const blank = vendorRegistrationSummary({ saved: false, permits: [], criteria: [] });
  assert.equal(blank.saved, "업체 정보 저장 전");
  assert.match(blank.candidates, /허가 품목 또는 매입 기준/);
  for (const profile of [
    { permits: [{ entrySource: "manual" }], criteria: [] },
    { permits: [], criteria: [{ priceMode: "negotiated" }] },
  ]) {
    const summary = vendorRegistrationSummary({ ...profile, saved: true });
    assert.equal(summary.saved, "업체 정보 저장됨");
    assert.match(summary.candidates, /후보군에 포함 · 실제 문의는 물량별/);
    assert.match(summary.confirmation, /허가증 원본.*대조와 양측 승인/);
  }
});

test("매입 기준 묶음은 허가 품목 다음, 연결한 에이전트 초안을 가린다", async () => {
  const { groupDraft: group, fromAgent } = await import("../src/lib/v3/onboarding.ts");
  const rows: OnboardingDraftItem[] = [
    { key: "fleet.vehicleCount", section: "fleet", label: "차량 수", value: 2, text: "2대", source: { kind: "conversation", label: "담당자 답변", quote: "2대" } },
    { key: "criteria", section: "criteria", label: "매입 기준", value: [], text: "PP · kg당 200원 매입\nPE · 협의", source: { kind: "agent", label: "연결한 에이전트(사내 AI)가 제출", quote: "PP 200원" } },
    { key: "permits", section: "permits", label: "허가 품목", value: [], text: "폐플라스틱", source: { kind: "registry", label: "공공 허가 명부", quote: null } },
  ];
  assert.deepEqual(group(rows).map((g) => g.section), ["permits", "criteria", "fleet"]);
  assert.equal(fromAgent(rows[1]), true);
  assert.equal(fromAgent(rows[0]), false);
});
