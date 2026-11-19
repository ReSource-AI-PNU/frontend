/**
 * ③ 법령 요건 확인(src/lib/v3/regulation.ts). 실제 백엔드가 낸 결과(fixture-data/view.json)의 regulation으로 본다.
 * 실행: node --test tests/regulation.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGULATION_FOOT, REGULATION_LEAD, planRegulation } from "../src/lib/v3/regulation.ts";
import type { DiagnosisView } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|규칙 정책|permit_match|decidedBy|claim|null|undefined/;
const view = JSON.parse(readFileSync(new URL("../src/lib/v3/fixture-data/view.json", import.meta.url), "utf8")) as DiagnosisView;
const sections = view.result?.regulation ?? [];
const nameOf = (id: string) => view.streams.find((item) => item.id === id)?.name ?? "폐기물";

test("업체 허가는 폐기물마다 한 줄, 담당자 할 일은 겹치지 않게 한 번씩", () => {
  const plan = planRegulation(sections, nameOf);
  assert.equal(plan.permits.length, sections.length);
  assert.ok(plan.permits.every((row) => row.clauses.length > 0 && row.clauses.every((c) => c.kind === "clause")));
  const keys = plan.todos.map((todo) => todo.key);
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(keys.includes("allbaro_entry"));
  // 매각에만 걸리는 할 일은 해당 폐기물 이름을 단다(위탁 처리하는 퍼지 덩어리는 빠진다)
  const circular = plan.todos.find((todo) => todo.key === "circular_resource");
  if (circular) assert.ok(circular.only.length > 0 && !circular.only.includes("퍼지 덩어리"));
  const related = plan.related.map((claim) => claim.evidence[0]);
  assert.equal(related.length, new Set(related).size);
});

test("제목은 배정 경로마다의 허가 확인 상태를 세고, \"모두 확인했습니다\"라고 쓰지 않는다", () => {
  const plan = planRegulation(sections, nameOf);
  assert.doesNotMatch(plan.headline, /모두 확인했습니다/);
  assert.match(plan.headline, /^받는 업체의 허가: /);
  // 시연은 대조 완료 · 검토 대기 · 원본 확인 필요를 함께 보인다
  assert.match(plan.headline, /허가증 대조 완료 \d+건/);
  assert.match(plan.headline, /원본 확인 필요 \d+건/);
  assert.match(plan.headline, /담당자가 챙길 일 \d+가지/);
  // 줄마다 허가 상태(결과표와 같은 값)가 붙는다
  assert.ok(plan.permits.filter((row) => row.route !== "지금 방식 그대로").every((row) => row.permit));
  // 이전 결과(허가 상태가 없는 줄)는 "허가 상태 확인 필요"로 센다
  const old = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => (item.kind === "check" ? { ...item, permit: undefined, status: "met" as const } : item)),
  }));
  assert.match(planRegulation(old, nameOf).headline, /허가 상태 확인 필요 \d+건/);
});

test("문구에 개발자 말이 없다", () => {
  const plan = planRegulation(sections, nameOf);
  const texts = [
    REGULATION_LEAD,
    REGULATION_FOOT,
    plan.headline,
    ...plan.permits.map((row) => row.note),
    ...plan.todos.flatMap((todo) => [todo.title, todo.action, todo.applies ?? ""]),
  ];
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
});
