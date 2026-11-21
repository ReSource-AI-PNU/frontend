/**
 * 업체 정보 AI 도우미의 순수 함수(src/lib/v3/onboarding.ts).
 * 실행: node --test tests/onboarding.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { authorLabel, checkSummary, groupDraft, selectedKeys, startOpen } from "../src/lib/v3/onboarding.ts";
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
  const checks = [
    { key: "permits", label: "허가 품목", done: false, note: "" },
    { key: "criteria", label: "매입 기준", done: false, note: "" },
    { key: "fleet", label: "차고지", done: true, note: "" },
  ];
  assert.equal(checkSummary(checks, false), "업체 탐색에 나오려면 2가지가 남았습니다 · 허가 품목, 매입 기준");
  assert.equal(checkSummary(checks, true), "배출 기업이 찾기를 하면 이 업체가 후보로 나옵니다.");
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
