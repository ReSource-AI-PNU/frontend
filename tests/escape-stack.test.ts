/**
 * Esc 차례(src/lib/escape-stack.ts): 겹친 패널은 맨 위 것 하나만 닫는다.
 * 실행: node --test tests/escape-stack.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createEscapeStack } from "../src/lib/escape-stack.ts";

test("근거 패널이 대화 패널 위에 있으면 Esc 한 번에 근거 패널만 닫힌다", () => {
  const stack = createEscapeStack();
  const closed: string[] = [];
  const releaseTalk = stack.push(() => closed.push("talk"));
  const releaseEvidence = stack.push(() => closed.push("evidence"));
  assert.equal(stack.escape(), true);
  assert.deepEqual(closed, ["evidence"]);
  // 패널이 닫히면(✕ 단추와 같은 길) 차례에서 내린다
  releaseEvidence();
  assert.equal(stack.escape(), true);
  assert.deepEqual(closed, ["evidence", "talk"]);
  releaseTalk();
  assert.equal(stack.escape(), false, "닫을 것이 없으면 아무것도 하지 않는다");
  assert.equal(stack.size(), 0);
});

test("아래 패널이 먼저 닫혀도 위 패널의 차례는 그대로다", () => {
  const stack = createEscapeStack();
  const closed: string[] = [];
  const releaseTalk = stack.push(() => closed.push("talk"));
  stack.push(() => closed.push("evidence"));
  releaseTalk();
  releaseTalk();
  assert.equal(stack.size(), 1);
  stack.escape();
  assert.deepEqual(closed, ["evidence"]);
});
