/**
 * 실시간 진행 스트림(GET /sessions/{id}/stream)에 붙는 클라이언트. React와 무관한 순수 모듈이라
 * fetch·기다리기를 바꿔 끼워 node --test로 검사한다(tests/live-stream.test.ts).
 *
 *  - EventSource 대신 fetch로 읽는다. 통로가 회사 확인 머리글(X-Expected-Org)을 받아야 하고, 이어 받을 지점을
 *    Last-Event-ID 머리글과 ?after= 둘 다로 보내기 위해서다.
 *  - 끊기면 마지막으로 받은 id부터 다시 붙는다. 기다리는 시간은 서버의 retry:에서 시작해 두 배씩 늘린다.
 *  - 15초마다 오는 빈 줄도 오지 않은 채 idleMs가 지나면 끊고 다시 붙는다.
 *  - 스트림이 없는 서버(404·405, event-stream이 아닌 응답)이거나 여러 번 붙지 못하면 진단 뷰를 되풀이해 읽는다(폴링).
 */
import { SseParser, retryDelay, toLiveEvent, type LiveEvent } from "./live.ts";

export type LiveConnection = "connecting" | "open" | "retrying" | "polling" | "done" | "closed" | "failed";

export type ConnectOptions = {
  /** 스트림 주소(?after=는 이 모듈이 붙인다) */
  url: string;
  /** 처음 이어 받을 지점. 이 seq 다음 기록부터 받는다 */
  after?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  onEvent: (event: LiveEvent) => void;
  onConnection?: (state: LiveConnection) => void;
  /** 스트림을 쓸 수 없을 때 진단 뷰를 한 번 읽는다. 아직 돌고 있으면 true */
  poll?: () => Promise<boolean>;
  pollEveryMs?: number;
  /** 잇달아 이만큼 붙지 못하면 폴링으로 바꾼다 */
  maxRetries?: number;
  idleMs?: number;
  random?: () => number;
  /** 기다리기(시험에서 바꿔 낀다). signal이 끊기면 바로 끝나야 한다 */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export type LiveHandle = {
  close: () => void;
  /** 끝난 까닭: done(실행이 끝남), failed(볼 수 없음), closed(화면이 닫음) */
  finished: Promise<LiveConnection>;
  lastEventId: () => number;
};

/** 한 번 붙어 본 결과 */
type Outcome = "done" | "dropped" | "unsupported" | "fatal" | "closed";

const UNSUPPORTED = new Set([404, 405, 406, 415, 501]);
const FATAL = new Set([400, 401, 403, 409, 410, 422]);

export function withAfter(url: string, after: number): string {
  const [path, hash = ""] = url.split("#");
  const cleaned = path.replace(/([?&])after=[^&]*(&|$)/, (_, lead: string, tail: string) => (tail ? lead : "")).replace(/[?&]$/, "");
  return `${cleaned}${cleaned.includes("?") ? "&" : "?"}after=${after}${hash ? `#${hash}` : ""}`;
}

function defaultWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export function connectLive(options: ConnectOptions): LiveHandle {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const wait = options.wait ?? defaultWait;
  const maxRetries = options.maxRetries ?? 4;
  const idleMs = options.idleMs ?? 45_000;
  const pollEveryMs = options.pollEveryMs ?? 2000;
  const life = new AbortController();
  let lastId = Math.max(0, options.after ?? 0);
  let retryBase = 1000;
  let state: LiveConnection | null = null;

  const report = (next: LiveConnection) => {
    if (state === next) return;
    state = next;
    options.onConnection?.(next);
  };

  async function once(): Promise<{ outcome: Outcome; received: boolean }> {
    const attempt = new AbortController();
    const stop = () => attempt.abort();
    life.signal.addEventListener("abort", stop, { once: true });
    let received = false;
    let idle: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(stop, idleMs);
    };
    try {
      const headers: Record<string, string> = { Accept: "text/event-stream", ...options.headers };
      if (lastId > 0) headers["Last-Event-ID"] = String(lastId);
      let response: Response;
      try {
        response = await doFetch(withAfter(options.url, lastId), { headers, signal: attempt.signal, cache: "no-store" });
      } catch {
        return { outcome: life.signal.aborted ? "closed" : "dropped", received };
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        if (UNSUPPORTED.has(response.status)) return { outcome: "unsupported", received };
        if (FATAL.has(response.status)) return { outcome: "fatal", received };
        return { outcome: "dropped", received };
      }
      const type = response.headers.get("content-type") ?? "";
      if (!type.toLowerCase().includes("text/event-stream") || !response.body) {
        await response.body?.cancel().catch(() => undefined);
        return { outcome: "unsupported", received };
      }
      report("open");
      const reader = response.body.getReader();
      // 끊을 때(화면이 닫음, idle) 기다리던 읽기도 바로 끝나게 한다
      attempt.signal.addEventListener("abort", () => void reader.cancel().catch(() => undefined), { once: true });
      const decoder = new TextDecoder();
      const parser = new SseParser();
      arm();
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          return { outcome: life.signal.aborted ? "closed" : "dropped", received };
        }
        if (chunk.done) return { outcome: life.signal.aborted ? "closed" : "dropped", received };
        arm();
        for (const raw of parser.push(decoder.decode(chunk.value, { stream: true }))) {
          if (raw.retry !== null) retryBase = Math.max(250, raw.retry);
          if (!raw.event) continue;
          if (raw.id !== null && /^\d+$/.test(raw.id)) lastId = Math.max(lastId, Number(raw.id));
          const event = toLiveEvent(raw);
          if (!event) continue;
          received = true;
          if (event.type === "error") {
            await reader.cancel().catch(() => undefined);
            // 저장소가 잠시 닿지 않음(INTERNAL)은 다시 붙고, 볼 수 없게 된 것은 그만 붙는다
            return { outcome: event.code === "INTERNAL" ? "dropped" : "fatal", received };
          }
          options.onEvent(event);
          if (event.type === "done") {
            await reader.cancel().catch(() => undefined);
            return { outcome: "done", received };
          }
        }
      }
    } finally {
      if (idle) clearTimeout(idle);
      life.signal.removeEventListener("abort", stop);
    }
  }

  async function polling(): Promise<LiveConnection> {
    if (!options.poll) return "failed";
    report("polling");
    let failures = 0;
    while (!life.signal.aborted) {
      try {
        const running = await options.poll();
        failures = 0;
        if (!running) {
          options.onEvent({ type: "done", status: null, lastSeq: null });
          return "done";
        }
      } catch {
        failures += 1;
        if (failures >= 5) return "failed";
      }
      await wait(pollEveryMs, life.signal);
    }
    return "closed";
  }

  async function run(): Promise<LiveConnection> {
    report("connecting");
    let failures = 0;
    while (!life.signal.aborted) {
      const { outcome, received } = await once();
      if (outcome === "done") return "done";
      if (outcome === "closed" || life.signal.aborted) return "closed";
      if (outcome === "unsupported") return polling();
      if (outcome === "fatal") return "failed";
      // 끊겼다: 받은 것이 있었으면 처음부터 다시 센다
      failures = received ? 1 : failures + 1;
      if (failures > maxRetries) return polling();
      report("retrying");
      await wait(retryDelay(failures - 1, retryBase, 15_000, options.random), life.signal);
    }
    return "closed";
  }

  const finished = run().then((end) => {
    report(life.signal.aborted ? "closed" : end);
    return life.signal.aborted ? "closed" : end;
  });

  return {
    close: () => life.abort(),
    finished,
    lastEventId: () => lastId,
  };
}
