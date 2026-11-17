/**
 * 통로가 실시간 진행(SSE)을 모으지 않고 흘려보내는지 본다(src/lib/v3/relay.ts, src/lib/server/proxy.ts가 쓴다).
 * 실행: node --test tests/sse-relay.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_STREAM_HEADERS, isEventStream, relayEventStream, wantsEventStream } from "../src/lib/v3/relay.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 조각을 손으로 밀어 넣는 백엔드 본문. close()를 부르기 전에는 끝나지 않는다 */
function upstream() {
  let push!: (text: string) => void;
  let close!: () => void;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (text) => controller.enqueue(encoder.encode(text));
      close = () => controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, push: (text: string) => push(text), close: () => close(), cancelled: () => cancelled };
}

test("머리글: event-stream, 캐시·압축 안 함, 프록시 버퍼링 끔", () => {
  const source = upstream();
  const response = relayEventStream(source.body, () => undefined);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.match(response.headers.get("cache-control") ?? "", /no-cache/);
  assert.match(response.headers.get("cache-control") ?? "", /no-transform/);
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  assert.equal(response.headers.get("content-length"), null);
  assert.deepEqual(Object.keys(EVENT_STREAM_HEADERS).sort(), ["cache-control", "content-type", "x-accel-buffering"]);
});

test("모으지 않는다: 백엔드가 끝나기 전에 첫 조각을 읽는다", async () => {
  const source = upstream();
  const response = relayEventStream(source.body, () => undefined);
  const reader = response.body!.getReader();
  source.push("id: 1\nevent: activity\ndata: {\"seq\":1}\n\n");
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.equal(decoder.decode(first.value), "id: 1\nevent: activity\ndata: {\"seq\":1}\n\n");
  // 두 번째 조각도 오는 대로 넘어간다
  source.push(": keep-alive\n\n");
  const second = await reader.read();
  assert.equal(decoder.decode(second.value), ": keep-alive\n\n");
  source.close();
  assert.equal((await reader.read()).done, true);
});

test("브라우저가 끊으면 백엔드 요청도 끊는다", async () => {
  const source = upstream();
  let aborted = 0;
  const response = relayEventStream(source.body, () => {
    aborted += 1;
  });
  const reader = response.body!.getReader();
  source.push("event: status\ndata: {}\n\n");
  await reader.read();
  await reader.cancel("client left");
  assert.equal(aborted, 1);
  assert.equal(source.cancelled(), true);
});

test("백엔드가 도중에 끊기면 오류 없이 닫는다(브라우저는 Last-Event-ID로 다시 붙는다)", async () => {
  const broken = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("socket hang up"));
    },
  });
  let aborted = 0;
  const response = relayEventStream(broken, () => {
    aborted += 1;
  });
  const text = await response.text();
  assert.equal(text, "");
  assert.equal(aborted, 0);
});

test("어떤 요청을 흘려보내는가", () => {
  assert.equal(isEventStream("text/event-stream; charset=utf-8"), true);
  assert.equal(isEventStream("application/json"), false);
  assert.equal(isEventStream(null), false);
  assert.equal(wantsEventStream("GET", ["sessions", "s1", "stream"], null), true);
  assert.equal(wantsEventStream("GET", ["sessions", "s1"], "text/event-stream"), true);
  assert.equal(wantsEventStream("GET", ["sessions", "s1"], "application/json"), false);
  assert.equal(wantsEventStream("POST", ["sessions", "s1", "stream"], "text/event-stream"), false);
});
