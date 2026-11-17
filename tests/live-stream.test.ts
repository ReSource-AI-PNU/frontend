/**
 * 실시간 진행 클라이언트(src/lib/v3/live.ts, src/lib/v3/live-client.ts): SSE 읽기, 화면 상태, 이어 받기,
 * 다시 붙기와 간격, 폴링으로 바꾸기. 네트워크 없이 fetch를 바꿔 끼운다.
 * 실행: node --test tests/live-stream.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  SseParser,
  evidenceOf,
  initialLive,
  isHistory,
  mergeThreads,
  paceMs,
  presentStages,
  presentThreads,
  reduceLive,
  replayFromView,
  retryDelay,
  rewriteText,
  toLiveEvent,
  typingText,
  withinVendorRange,
  type LiveEvent,
  type LiveState,
} from "../src/lib/v3/live.ts";
import { connectLive, withAfter, type LiveConnection } from "../src/lib/v3/live-client.ts";

const encoder = new TextEncoder();

function sse(event: string, data: unknown, id?: number) {
  return `${id !== undefined ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const MESSAGE = {
  id: "m1",
  seq: 1,
  from: "org_vendor",
  to: "org_factory",
  type: "offer",
  stage: 5,
  streamIds: ["st_1"],
  text: "kg당 {c1}원에 매입합니다.",
  claims: [
    { id: "c1", kind: "number", value: 200, unit: "원/kg", evidence: ["ev_a", "ev_b"] },
    { id: "c2", kind: "number", value: 400, unit: "kg", evidence: ["ev_b"] },
  ],
  validation: { ok: true, attempts: 2 },
  createdAt: "2026-11-18T01:00:00Z",
  author: { side: "vendor", kind: "agent", label: "업체 측 AI" },
  meta: { asks: [], excluded: [], reason: null, terms: { items: [{ streamId: "st_1", claimId: "c1" }], days: ["화"], conditions: [] } },
};

const act = (seq: number, kind: string, extra: Record<string, unknown> = {}) =>
  sse(
    "activity",
    {
      seq,
      at: "2026-11-18T01:00:00Z",
      stage: 4,
      actor: "vendor_agent",
      kind,
      threadId: "th_1",
      vendorOrgId: "org_vendor",
      vendorName: "(주)새길자원",
      author: { side: "vendor", kind: "agent", label: "업체 측 AI" },
      text: `${kind} 줄`,
      ...extra,
    },
    seq,
  );

/** 조각 목록을 차례로 내보내는 SSE 응답. hang이면 다 보낸 뒤 끝나지 않는다 */
function sseResponse(chunks: string[], { hang = false } = {}) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
      else if (!hang) controller.close();
      else return new Promise(() => undefined);
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
}

type Call = { url: string; headers: Record<string, string> };

function fakeFetch(responses: (() => Response | Promise<Response>)[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next();
  }) as typeof fetch;
  return { impl, calls };
}

test("SSE 읽기: 조각이 줄 가운데서 끊겨도, CRLF여도, 여러 줄 data와 주석이 섞여도 덩어리로 나눈다", () => {
  const parser = new SseParser();
  const out = [
    ...parser.push("retry: 3000\n\n: keep-alive\n\nid: 7\nevent: act"),
    ...parser.push('ivity\r\ndata: {"a":\r\ndata: 1}\r'),
    ...parser.push("\n\r\nevent: done\ndata: {}\n\n"),
  ];
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { event: "", data: "", id: null, retry: 3000 });
  assert.deepEqual(out[1], { event: "activity", data: '{"a":\n1}', id: "7", retry: null });
  assert.equal(out[2].event, "done");
  // id는 다음 덩어리에도 남는다(표준). 이어 받기는 마지막 id로 한다
  assert.equal(out[2].id, "7");
});

test("이벤트 모양: 작성자 글자·객체 둘 다, reason 하나·reasons 여럿 둘 다 받는다", () => {
  const stringAuthor = toLiveEvent({
    event: "activity",
    id: "3",
    retry: null,
    data: JSON.stringify({ at: "x", stage: 3, actor: "validator", kind: "rejected", threadId: "t", author: "회사 측 AI", text: "돌려보냈습니다", reason: "근거에 없는 숫자" }),
  });
  assert.ok(stringAuthor && stringAuthor.type === "activity");
  assert.equal(stringAuthor.seq, 3);
  assert.deepEqual(stringAuthor.author, { side: "company", kind: "agent", label: "회사 측 AI" });
  assert.deepEqual(stringAuthor.reasons, ["근거에 없는 숫자"]);
  const sent = toLiveEvent({ event: "activity", id: "9", retry: null, data: JSON.stringify({ seq: 9, actor: "vendor_agent", kind: "sent", text: "보냈습니다", message: MESSAGE, evidenceCount: 2 }) });
  assert.ok(sent && sent.type === "activity" && sent.message?.id === "m1" && sent.evidenceCount === 2);
  assert.equal(sent.author?.side, "vendor");
  const status = toLiveEvent({ event: "status", id: "10", retry: null, data: JSON.stringify({ seq: 10, status: "running", phase: "converse", stages: { "1": "done", "4": "running" } }) });
  assert.ok(status && status.type === "status");
  assert.deepEqual(status.stages?.map((item) => [item.stage, item.status]), [[1, "done"], [4, "running"]]);
  assert.equal(toLiveEvent({ event: "activity", id: null, retry: null, data: "{깨진" }), null);
  assert.equal(toLiveEvent({ event: "unknown", id: null, retry: null, data: "{}" }), null);
});

test("화면 상태: 작성 중 → 근거 확인 중 → 다시 쓰는 중 → 말풍선, 같은 seq는 두 번 더하지 않는다", () => {
  const events = [
    act(1, "drafting"),
    act(2, "validating", { actor: "validator" }),
    act(3, "rejected", { actor: "validator", reasons: ["근거에 없는 숫자"] }),
    act(4, "rewriting"),
    act(5, "sent", { message: MESSAGE, evidenceCount: 2 }),
  ];
  const parser = new SseParser();
  const parsed = parser.push(events.join("")).map(toLiveEvent).filter((item): item is LiveEvent => item !== null);
  const seen: string[] = [];
  let state: LiveState = initialLive();
  for (const event of parsed) {
    state = reduceLive(state, event);
    const typing = state.threads.th_1.typing;
    seen.push(typing ? typingText(typing) : "말풍선");
  }
  assert.deepEqual(seen, ["작성 중", "근거 확인 중", "근거에 없는 숫자가 있어 다시 쓰는 중", "근거에 없는 숫자가 있어 다시 쓰는 중", "말풍선"]);
  assert.equal(state.threads.th_1.messages.length, 1);
  assert.equal(state.threads.th_1.rejections, 1);
  assert.equal(state.threads.th_1.vendorName, "(주)새길자원");
  assert.equal(state.lastSeq, 5);
  // 다시 붙어서 같은 기록을 또 받아도 그대로다
  const again = reduceLive(state, parsed[4]);
  assert.equal(again, state);
  // done이 오면 쓰는 중 표시를 모두 지운다
  const drafting = reduceLive(state, toLiveEvent({ event: "activity", id: "6", retry: null, data: JSON.stringify({ seq: 6, actor: "company_agent", kind: "drafting", threadId: "th_1", text: "" }) })!);
  assert.equal(drafting.threads.th_1.typing?.side, "company");
  assert.equal(drafting.feed.length, 5, "빈 문장은 진행 줄에 넣지 않는다");
  const done = reduceLive(drafting, { type: "done", status: "awaiting_approval", lastSeq: 8 });
  assert.equal(done.threads.th_1.typing, null);
  assert.equal(done.done, true);
  assert.equal(done.lastSeq, 8);
});

test("다시 쓰는 중 문구: 명사 사유는 '…가 있어', 서술 사유는 '다시 쓰는 중 · …'", () => {
  assert.equal(rewriteText("근거에 없는 값"), "근거에 없는 값이 있어 다시 쓰는 중");
  assert.equal(rewriteText("업체 기준 밖의 조건"), "업체 기준 밖의 조건이 있어 다시 쓰는 중");
  assert.equal(rewriteText("본문과 값이 맞지 않음"), "다시 쓰는 중 · 본문과 값이 맞지 않음");
  assert.equal(rewriteText("응답 형식 오류"), "다시 쓰는 중 · 응답 형식 오류");
  assert.equal(rewriteText(null), "다시 쓰는 중");
});

test("질문 묶음과 단계 상태가 오는 대로 쌓인다", () => {
  let state = initialLive();
  state = reduceLive(state, { type: "status", seq: 1, status: "running", phase: "identify", stages: [{ stage: 1, key: "identify", label: "식별·분류", status: "running" }] });
  const question = { id: "q1", batch: 1, streamId: "st_1", field: "moisturePct", text: "수분은 몇 %인가요?", answered: false, unknown: null, answerType: "number", unit: "%", choices: null };
  state = reduceLive(state, { type: "question", seq: 2, stage: 1, questions: [question as never] });
  state = reduceLive(state, { type: "question", seq: 3, stage: 1, questions: [question as never] });
  assert.equal(state.questions.length, 1);
  assert.equal(state.stages?.[0].status, "running");
  assert.equal(state.phase, "identify");
});

test("뷰와 합치기: 뷰의 메시지와 스트림 메시지를 ID로 한 번만, 뷰에 없는 대화는 스트림 이름으로", () => {
  let state = initialLive();
  for (const raw of new SseParser().push(act(1, "sent", { message: MESSAGE }) + act(2, "drafting", { threadId: "th_2", vendorName: "(주)미소환경" }))) {
    state = reduceLive(state, toLiveEvent(raw)!);
  }
  const merged = mergeThreads(
    [{ id: "th_1", vendorOrgId: "org_vendor", vendorName: "(주)새길자원", status: "open", statusReason: null, reasonEvidence: [], streamIds: ["st_1"], turns: 1, messages: [MESSAGE as never] }],
    state,
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].messages.length, 1);
  assert.equal(merged[1].vendorName, "(주)미소환경");
  assert.equal(merged[1].typing?.phase, "drafting");
});

test("근거 n개와 업체 범위: claim 수를 세고, 조건이 실린 채 통과한 업체 측 제안만 범위 안으로 본다", () => {
  assert.deepEqual(evidenceOf(MESSAGE as never), { count: 2, ids: ["ev_a", "ev_b"] });
  assert.equal(withinVendorRange(MESSAGE as never), true);
  assert.equal(withinVendorRange({ ...MESSAGE, meta: { ...MESSAGE.meta, terms: null } } as never), false);
  assert.equal(withinVendorRange({ ...MESSAGE, author: { side: "company", kind: "agent", label: "회사 측 AI" } } as never), false);
  assert.equal(withinVendorRange({ ...MESSAGE, type: "question" } as never), false);
  assert.equal(withinVendorRange({ ...MESSAGE, author: undefined } as never), false, "작성자 표시가 없으면 지어내지 않는다");
});

test("보여 주는 빠르기: 다시 보기는 더 느리고, 밀리면 줄이고, 지난 기록은 기다리지 않는다", () => {
  const sent = toLiveEvent(new SseParser().push(act(1, "sent"))[0])!;
  assert.ok(paceMs(sent, "replay") > paceMs(sent, "live"));
  assert.ok(paceMs(sent, "live", 50) < paceMs(sent, "live"));
  assert.equal(isHistory(sent, Date.parse("2026-11-18T01:00:30Z")), true);
  assert.equal(isHistory(sent, Date.parse("2026-11-18T01:00:02Z")), false);
});

test("다시 붙는 간격: 서버 retry에서 두 배씩, 15초에서 멈춘다", () => {
  const fixed = () => 1;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((n) => retryDelay(n, 1000, 15_000, fixed)), [1000, 2000, 4000, 8000, 15000, 15000]);
  assert.equal(retryDelay(0, 3000, 15_000, () => 0), 1500);
  assert.equal(withAfter("/api/v3/sessions/s1/stream", 12), "/api/v3/sessions/s1/stream?after=12");
  assert.equal(withAfter("/x/stream?after=3&y=1", 9), "/x/stream?y=1&after=9");
});

test("이어 받기: 끊기면 마지막 id를 Last-Event-ID와 ?after=로 보내 다시 붙고, done에서 끝난다", async () => {
  const { impl, calls } = fakeFetch([
    () => sseResponse(["retry: 2000\n\n", act(4, "drafting"), act(5, "validating")]),
    () => {
      throw new TypeError("network down");
    },
    () => sseResponse([act(6, "sent", { message: MESSAGE }), sse("done", { status: "awaiting_approval", lastSeq: 6 })]),
  ]);
  const waits: number[] = [];
  const states: LiveConnection[] = [];
  const got: LiveEvent[] = [];
  const handle = connectLive({
    url: "/api/v3/sessions/s1/stream",
    after: 3,
    headers: { "X-Expected-Org": "org_factory" },
    fetch: impl,
    onEvent: (event) => got.push(event),
    onConnection: (state) => states.push(state),
    random: () => 1,
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(await handle.finished, "done");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/v3/sessions/s1/stream?after=3");
  assert.equal(calls[0].headers["Last-Event-ID"], "3");
  assert.equal(calls[0].headers["X-Expected-Org"], "org_factory");
  assert.equal(calls[0].headers.Accept, "text/event-stream");
  assert.equal(calls[1].url, "/api/v3/sessions/s1/stream?after=5");
  assert.equal(calls[1].headers["Last-Event-ID"], "5");
  assert.equal(calls[2].headers["Last-Event-ID"], "5");
  // 받은 것이 있었던 연결이 끊기면 서버 retry(2초)부터, 받지 못한 연결이 또 끊기면 두 배
  assert.deepEqual(waits, [2000, 4000]);
  assert.deepEqual(got.map((item) => item.type), ["activity", "activity", "activity", "done"]);
  assert.equal(handle.lastEventId(), 6);
  assert.deepEqual(states, ["connecting", "open", "retrying", "open", "done"]);
});

test("빈 줄도 오지 않으면(idle) 끊고 다시 붙는다", async () => {
  const { impl, calls } = fakeFetch([
    () => sseResponse([act(1, "drafting")], { hang: true }),
    () => sseResponse([sse("done", { status: "idle", lastSeq: 1 })]),
  ]);
  const handle = connectLive({ url: "/s", fetch: impl, onEvent: () => undefined, idleMs: 20, random: () => 1, wait: async () => undefined });
  assert.equal(await handle.finished, "done");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers["Last-Event-ID"], "1");
});

test("스트림이 없는 서버(404·JSON)면 진단 뷰를 되풀이해 읽고, 다 돌면 done을 낸다", async () => {
  for (const make of [
    () => Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }),
    () => Response.json({ session: {} }, { status: 200 }),
  ]) {
    const { impl } = fakeFetch([make]);
    let polls = 0;
    const got: LiveEvent[] = [];
    const states: LiveConnection[] = [];
    const handle = connectLive({
      url: "/s",
      fetch: impl,
      onEvent: (event) => got.push(event),
      onConnection: (state) => states.push(state),
      poll: async () => ++polls < 3,
      wait: async () => undefined,
    });
    assert.equal(await handle.finished, "done");
    assert.equal(polls, 3);
    assert.deepEqual(got, [{ type: "done", status: null, lastSeq: null }]);
    assert.ok(states.includes("polling"));
  }
});

test("여러 번 잇달아 붙지 못하면 폴링으로 바꾼다", async () => {
  const fail = () => new Response("bad gateway", { status: 502 });
  const { impl, calls } = fakeFetch([fail, fail, fail]);
  let polled = false;
  const handle = connectLive({
    url: "/s",
    fetch: impl,
    onEvent: () => undefined,
    maxRetries: 2,
    poll: async () => {
      polled = true;
      return false;
    },
    random: () => 1,
    wait: async () => undefined,
  });
  assert.equal(await handle.finished, "done");
  assert.equal(calls.length, 3);
  assert.equal(polled, true);
});

test("볼 수 없게 되면(403, 서버 error 이벤트) 그만 붙고, 저장소 오류(INTERNAL)는 다시 붙는다", async () => {
  const forbidden = fakeFetch([() => Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 })]);
  const a = connectLive({ url: "/s", fetch: forbidden.impl, onEvent: () => undefined, wait: async () => undefined });
  assert.equal(await a.finished, "failed");

  const internal = fakeFetch([
    () => sseResponse([act(1, "drafting"), sse("error", { code: "INTERNAL", message: "서버에서 오류가 났습니다." })]),
    () => sseResponse([sse("error", { code: "NOT_FOUND", message: "없습니다" })]),
  ]);
  const b = connectLive({ url: "/s", fetch: internal.impl, onEvent: () => undefined, random: () => 1, wait: async () => undefined });
  assert.equal(await b.finished, "failed");
  assert.equal(internal.calls.length, 2);
});

test("화면이 닫으면 더 붙지 않는다", async () => {
  const { impl, calls } = fakeFetch([() => sseResponse([act(1, "drafting")], { hang: true })]);
  const handle = connectLive({ url: "/s", fetch: impl, onEvent: () => undefined, wait: async () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 10));
  handle.close();
  assert.equal(await handle.finished, "closed");
  assert.equal(calls.length, 1);
});

test("저장된 대화로 다시 보기: 메시지마다 작성 → 근거 확인 → (거부 기록이 있으면 다시 쓰기) → 보냄, 끝에 done", () => {
  const company = {
    ...MESSAGE,
    id: "m0",
    seq: 0,
    from: "org_factory",
    to: "org_vendor",
    type: "inquiry",
    stage: 4,
    createdAt: "2026-11-18T00:59:00Z",
    claims: [],
    validation: { ok: true, attempts: 2, rejections: [{ code: "NUMBER_OUTSIDE_PLACEHOLDER", message: "…", attempt: 1 }] },
    author: { side: "company", kind: "agent", label: "회사 측 AI" },
    meta: { asks: [], excluded: [], reason: null, terms: null },
  };
  const view = {
    session: { emitterOrgId: "org_factory", status: "awaiting_approval" },
    stages: [4, 5].map((stage) => ({ stage, key: `s${stage}`, label: `${stage}단계`, status: "done" })),
    threads: [
      { id: "th_1", vendorOrgId: "org_vendor", vendorName: "(주)새길자원", status: "agreed" as const, statusReason: null, reasonEvidence: [], streamIds: [], turns: 2, messages: [MESSAGE as never, company as never] },
    ],
  };
  const events = replayFromView(view);
  const kinds = events.map((item) => (item.type === "activity" ? item.kind : item.type));
  assert.deepEqual(kinds, [
    "status",
    "status",
    "status",
    "drafting",
    "validating",
    "rejected",
    "rewriting",
    "validating",
    "sent",
    "status",
    "drafting",
    "validating",
    "rejected",
    "rewriting",
    "validating",
    "sent",
    "status",
    "done",
  ]);
  const rejected = events.find((item) => item.type === "activity" && item.kind === "rejected");
  assert.ok(rejected && rejected.type === "activity");
  assert.deepEqual(rejected.reasons, ["근거에 없는 숫자"]);
  // 시도가 두 번이고 사유 기록이 없으면(상대 조직이 본 뷰) 사유를 지어내지 않고 일반 문구로 적는다
  const second = events.filter((item) => item.type === "activity" && item.kind === "rejected")[1];
  assert.ok(second && second.type === "activity");
  assert.deepEqual(second.reasons, ["검사를 통과하지 못함"]);
  let state = initialLive();
  for (const event of events) state = reduceLive(state, event);
  assert.equal(state.threads.th_1.messages.length, 2);
  assert.equal(state.threads.th_1.messages[0].id, "m0", "보낸 순서대로");
  assert.equal(state.done, true);
  assert.equal(state.stages?.every((item) => item.status === "done"), true);
});

test("실행 중 보여 주기: 실행 전 메시지만 두고 스트림으로 받은 것을 더하며, 단계는 스트림 상태에 뷰의 이름을 붙인다", () => {
  const old = { ...MESSAGE, id: "m_old", seq: 0 };
  const viewThreads = [
    { id: "th_1", vendorOrgId: "org_vendor", vendorName: "(주)새길자원", status: "agreed" as const, statusReason: "합의", reasonEvidence: ["ev"], streamIds: [], turns: 3, messages: [old as never, MESSAGE as never] },
    { id: "th_9", vendorOrgId: "org_x", vendorName: "(주)다른곳", status: "declined" as const, statusReason: "허가 품목 없음", reasonEvidence: [], streamIds: [], turns: 1, messages: [{ ...MESSAGE, id: "m_x" } as never] },
  ];
  let state = initialLive();
  const before = presentThreads(viewThreads, state, new Set(["m_old"]));
  assert.deepEqual(before.map((item) => [item.id, item.messages.length]), [["th_1", 1]], "아직 이 실행에서 받은 것이 없으면 실행 전 메시지만");
  state = reduceLive(state, toLiveEvent(new SseParser().push(act(1, "sent", { message: MESSAGE }))[0])!);
  const during = presentThreads(viewThreads, state, new Set(["m_old"]));
  assert.equal(during[0].messages.length, 2);
  assert.equal(during[0].status, "open", "끝나기 전에는 합의 상태를 미리 보이지 않는다");
  assert.equal(presentThreads(viewThreads, state, null)[0].status, "agreed");

  type StageStatus = "waiting" | "running" | "done" | "needs_check";
  const viewStages = [1, 2].map((stage) => ({ stage, key: `k${stage}`, label: `이름${stage}`, status: "done" as StageStatus }));
  assert.deepEqual(presentStages(viewStages, initialLive(), viewStages.map((item) => ({ ...item, status: "waiting" as StageStatus }))).map((item) => item.status), ["waiting", "waiting"]);
  const running = reduceLive(initialLive(), { type: "status", seq: 1, status: "running", phase: null, stages: [{ stage: 1, key: null, label: null, status: "done" }, { stage: 2, key: null, label: null, status: "running" }] });
  const shown = presentStages(viewStages, running, null);
  assert.deepEqual(shown.map((item) => [item.label, item.status]), [["이름1", "done"], ["이름2", "running"]]);
  // 도는 단계가 없다고 와도 마지막 활동의 단계를 도는 중으로 보인다
  let quiet = reduceLive(initialLive(), { type: "status", seq: 1, status: "running", phase: null, stages: [{ stage: 1, key: null, label: null, status: "waiting" }, { stage: 2, key: null, label: null, status: "waiting" }] });
  quiet = reduceLive(quiet, toLiveEvent({ event: "activity", id: "2", retry: null, data: JSON.stringify({ seq: 2, stage: 1, actor: "tool", kind: "tool", text: "판단 도구" }) })!);
  assert.deepEqual(presentStages(viewStages, quiet, null).map((item) => item.status), ["running", "waiting"]);
});
