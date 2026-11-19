import { test } from "node:test";
import assert from "node:assert/strict";
import { initialLive, type LiveState, type LiveThread } from "../src/lib/v3/live.ts";
import { company, flows, SPECIALISTS, specialistLine, specialists, vendors } from "../src/lib/v3/stage.ts";

const JARGON = /판단 도구|tool|에이전트|Foundry|Ollama|규칙 정책/;

function thread(id: string, extra: Partial<LiveThread> = {}): LiveThread {
  return {
    id,
    vendorOrgId: `org_${id}`,
    vendorName: `업체 ${id}`,
    messages: [],
    typing: null,
    rejections: 0,
    lastText: null,
    handoff: false,
    outcome: null,
    outcomeText: null,
    review: null,
    touched: 1,
    ...extra,
  };
}

function live(extra: Partial<LiveState>): LiveState {
  return { ...initialLive(), ...extra };
}

test("전문 담당은 여섯이고 AI라고 부르지 않는다", () => {
  assert.equal(SPECIALISTS.length, 6);
  for (const item of SPECIALISTS) assert.doesNotMatch(`${item.name} ${item.role}`, /AI|에이전트/);
});

test("도구 기록을 사람이 읽는 말로 바꾼다", () => {
  const line = (text: string) => ({
    seq: 1,
    at: null,
    stage: 4,
    kind: "tool",
    text,
    threadId: null,
  });
  assert.equal(specialistLine(line("판단 도구 · 업체 찾기: 확인됨")), "업체 찾기를 마쳤습니다");
  assert.equal(specialistLine(line("판단 도구 · 경로 판정·매입 기준 대조: 조건부")), "경로 판정·매입 기준 대조 · 조건이 붙었습니다");
  assert.equal(specialistLine(line("업체를 찾고 허가 품목과 매입 기준을 대조합니다.")), "업체를 찾고 허가 품목과 매입 기준을 대조합니다.");
  for (const text of ["판단 도구 · 업체 찾기: 확인됨", "판단 도구 · 법령 조항 찾기: 확인 필요"]) {
    assert.doesNotMatch(specialistLine(line(text)), JARGON);
  }
});

test("지금 단계의 전문 담당만 말하고, 끝난 단계는 끝난 모습이다", () => {
  const state = live({
    stage: 4,
    stages: [
      { stage: 1, key: null, label: null, status: "done" },
      { stage: 4, key: null, label: null, status: "running" },
    ],
    feed: [
      {
        seq: 1,
        at: null,
        stage: 1,
        kind: "tool",
        text: "판단 도구 · 폐기물 식별·등급: 확인됨",
        threadId: null,
      },
      {
        seq: 2,
        at: null,
        stage: 4,
        kind: "tool",
        text: "판단 도구 · 업체 찾기: 확인됨",
        threadId: null,
      },
    ],
  });
  const by = new Map(specialists(state).map((item) => [item.stage, item]));
  assert.equal(by.get(1)?.state, "done");
  assert.equal(by.get(4)?.state, "talk");
  assert.equal(by.get(6)?.state, "wait");
  assert.equal(by.get(6)?.line, null);
});

test("업체 측 AI는 업체마다 나오고, 쓰는 쪽에서 받는 쪽으로 흐른다", () => {
  const state = live({
    order: ["t1", "t2"],
    threads: {
      t1: thread("t1", {
        typing: {
          side: "vendor",
          label: "업체 측 AI",
          phase: "drafting",
          reason: null,
        },
      }),
      t2: thread("t2", {
        typing: {
          side: "company",
          label: "회사 측 AI",
          phase: "validating",
          reason: null,
        },
        touched: 2,
      }),
    },
    stage: 4,
  });
  assert.deepEqual(
    vendors(state).map((v) => [v.name, v.state]),
    [
      ["업체 t1", "talk"],
      ["업체 t2", "idle"],
    ],
  );
  assert.equal(company(state).state, "work");
  assert.match(company(state).line ?? "", /업체 t2에 보낼 글 쓰는 중/);
  assert.deepEqual(flows(state), [
    { threadId: "t1", from: "vendor" },
    { threadId: "t2", from: "company" },
  ]);
});
