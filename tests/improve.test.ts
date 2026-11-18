/**
 * 분리 개선 안내(src/lib/v3/improve.ts). 실제 백엔드가 낸 결과(fixture-data/view.json)의 improvements로 본다.
 * 실행: node --test tests/improve.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IMPROVE_FOOT,
  IMPROVE_LEAD,
  SPLIT_LEAD,
  gradeText,
  needsText,
  planImprovements,
  splitNobody,
} from "../src/lib/v3/improve.ts";
import type { DiagnosisView } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|Foundry|Ollama|규칙 정책|연결되지 않았습니다|예시 데이터|improve|claim|null/;
const view = JSON.parse(readFileSync(new URL("../src/lib/v3/fixture-data/view.json", import.meta.url), "utf8")) as DiagnosisView;
const items = view.result?.improvements ?? [];
const nameOf = (id: string) => view.streams.find((item) => item.id === id)?.name ?? "폐기물";

test("더 받는 길이 있는 폐기물이 맨 앞이고, 기록 습관(측정·계량)은 한 줄로 모은다", () => {
  const plan = planImprovements(items, nameOf);
  assert.ok(plan.streams.length > 0);
  assert.ok(plan.streams[0].option, "맨 앞은 더 받는 길이 있는 폐기물");
  for (const item of plan.streams) {
    assert.ok(item.actions.every((action) => action.key !== "measure" && action.key !== "weigh"));
  }
  const measure = plan.common.find((item) => item.key === "measure");
  assert.ok(measure && measure.names.length > 1, "측정 기록은 여러 폐기물을 한 줄로 모은다");
  assert.match(plan.headline, /가지 있습니다$/);
});

test("섞인 재질을 나누면 받는 곳과, 받는 곳이 없는 재질을 함께 보인다", () => {
  const plan = planImprovements(items, nameOf);
  const mixed = plan.streams.find((item) => item.split.length > 0);
  assert.ok(mixed, "PP+ABS 퍼지에는 재질별 길이 있다");
  assert.ok(mixed.split.some((part) => part.vendorOrgId));
  const nobody = mixed.split.find((part) => !part.vendorOrgId);
  if (nobody) assert.match(splitNobody(nobody.material), /받는 곳이 없습니다/);
});

test("더 받는 길이 없으면 제목이 숫자 없이 바뀌고, 할 일이 없는 폐기물은 뺀다", () => {
  const plain = items.map((item) => ({ ...item, option: null, split: [] }));
  const plan = planImprovements(plain, nameOf);
  assert.equal(plan.headline, "폐기물마다 해 두면 좋은 일을 정리했습니다");
  const bare = planImprovements([{ streamId: "x", actions: [], option: null, split: [] }], nameOf);
  assert.equal(bare.streams.length, 0);
});

test("등급과 낮출 것 낱말, 문구에 개발자 말이 없다", () => {
  assert.equal(gradeText("A"), "A등급");
  assert.equal(gradeText("등외"), "등외");
  assert.equal(gradeText(null), "기준");
  assert.equal(needsText(["오염도"]), "오염도");
  assert.equal(needsText(["오염도", "수분"]), "오염도와 수분");
  const plan = planImprovements(items, nameOf);
  const texts = [
    IMPROVE_LEAD,
    IMPROVE_FOOT,
    SPLIT_LEAD,
    plan.headline,
    splitNobody("ABS"),
    ...plan.common.map((item) => item.text),
    ...plan.streams.flatMap((item) => item.actions.map((action) => action.text)),
  ];
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
});
