/**
 * 실행 기록 요약(src/lib/v3/run-log.ts). 백엔드에서 받아 둔 화면 자료(tests/fixtures/v3-view-handoff.json)로 센다.
 * 실행: node --test tests/run-log.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeRun } from "../src/lib/v3/run-log.ts";

const view = JSON.parse(readFileSync(new URL("./fixtures/v3-view-handoff.json", import.meta.url), "utf8"));

test("종류별 건수는 기록을 그대로 센 값이다", () => {
  const run = summarizeRun(view.events);
  const count = (kind: string) => view.events.filter((event: { kind: string }) => event.kind === kind).length;
  assert.equal(run.total, view.events.length);
  assert.equal(run.toolCalls, count("tool_call"));
  assert.equal(run.validations, count("validation"));
  assert.equal(run.messages, count("message"));
  assert.equal(run.questions, count("question"));
  assert.ok(run.validationsPassed <= run.validations);
});

test("줄의 합은 전체와 같고, 도구별 합은 도구 호출 수와 같다", () => {
  const run = summarizeRun(view.events);
  assert.equal(run.lanes.reduce((sum, lane) => sum + lane.count, 0), run.total);
  assert.equal(run.tools.reduce((sum, tool) => sum + tool.count, 0), run.toolCalls);
  assert.equal(run.tools.length, run.toolKinds);
  // 많은 순으로 놓고, 도구 이름은 내부 ID가 아니라 화면 이름이다
  for (let i = 1; i < run.tools.length; i += 1) assert.ok(run.tools[i - 1].count >= run.tools[i].count);
  for (const tool of run.tools) assert.doesNotMatch(tool.label, /_/);
});

test("기록이 없으면 모두 0이고 줄도 없다", () => {
  const run = summarizeRun([]);
  assert.equal(run.total, 0);
  assert.deepEqual(run.lanes, []);
  assert.deepEqual(run.tools, []);
});
