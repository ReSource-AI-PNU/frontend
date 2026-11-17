/**
 * 백엔드의 실시간 진행(GET /sessions/{id}/stream, text/event-stream)을 브라우저로 모으지 않고 흘려보낸다.
 * 네트워크도 Next.js도 부르지 않는 순수 함수라 node --test로 바로 검사한다(tests/sse-relay.test.ts).
 *
 *  - 조각이 오는 대로 넘긴다(읽는 쪽이 읽을 때만 백엔드에서 한 조각을 더 읽는다. 모아 두지 않는다).
 *  - 브라우저가 끊으면(cancel) abort()로 백엔드 요청도 끊는다.
 *  - 프록시가 응답을 붙들지 않게 머리글을 단다. no-transform은 Next 서버의 gzip 압축이 조각을 모으지 않게 한다.
 */

export const EVENT_STREAM_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
};

export function isEventStream(contentType: string | null | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("text/event-stream");
}

/** 브라우저가 실시간 진행을 바라는 요청인지(GET이고 경로 끝이 stream이거나 Accept가 event-stream) */
export function wantsEventStream(method: string, path: string[], accept: string | null): boolean {
  if (method.toUpperCase() !== "GET") return false;
  return path[path.length - 1] === "stream" || isEventStream(accept);
}

/**
 * 백엔드 응답 본문을 그대로 흘려보내는 응답. 백엔드가 도중에 끊기면 조용히 닫는다
 * (브라우저는 done을 받지 못했으므로 Last-Event-ID로 다시 붙는다).
 */
export function relayEventStream(
  body: ReadableStream<Uint8Array> | null,
  abort: () => void,
  status = 200,
): Response {
  const reader = body ? body.getReader() : null;
  let finished = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (!reader) {
          controller.close();
          return;
        }
        try {
          const { done, value } = await reader.read();
          if (done) {
            finished = true;
            controller.close();
          } else if (value && value.byteLength > 0) {
            controller.enqueue(value);
          }
        } catch {
          finished = true;
          controller.close();
        }
      },
      async cancel(reason) {
        if (!finished) abort();
        await reader?.cancel(reason).catch(() => undefined);
      },
    },
    // 읽는 쪽이 읽을 때만 당겨 온다. 미리 쌓아 두지 않는다
    { highWaterMark: 0 },
  );
  return new Response(stream, { status, headers: { ...EVENT_STREAM_HEADERS } });
}
