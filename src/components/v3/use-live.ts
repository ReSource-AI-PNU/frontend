"use client";

import { useEffect, useReducer, useRef } from "react";
import { api, scopeHeaders } from "@/lib/v3/api";
import { connectLive, type LiveConnection } from "@/lib/v3/live-client";
import { initialLive, isHistory, paceMs, reduceLive, replayFromView, type LiveEvent, type LiveState } from "@/lib/v3/live";
import type { DiagnosisView, Stage } from "@/lib/v3/types";

/**
 * live: 이 화면이 방금 시작한 실행(기록이 오는 대로, 몰려 오면 읽을 빠르기로 풀어 보여 준다)
 * attach: 이미 돌고 있는 실행에 붙음(지난 기록은 기다리지 않고 바로 그린다)
 * replay: 끝난 찾기를 저장된 기록으로 다시 보여 줌(체험하기)
 */
export type LiveMode = "live" | "attach" | "replay";

export type LiveTarget = {
  id: number;
  sessionId: string;
  after: number;
  mode: LiveMode;
  /**
   * 실행 전에 이미 있던 메시지 ID와 단계. 있으면 실행이 끝날 때까지 뷰의 나머지 메시지·결과를 가리고 스트림으로 받은 것만
   * 차례로 보여 준다(규칙 정책은 1초 안에 끝나 뷰에 이미 다 들어 있다). attach는 null이다.
   */
  baseline: { messageIds: string[]; stages: Stage[] } | null;
};

type Held = { id: number; state: LiveState; connection: LiveConnection; finished: boolean };
type Action =
  | { type: "event"; id: number; event: LiveEvent }
  | { type: "connection"; id: number; connection: LiveConnection }
  | { type: "finish"; id: number };

function fresh(id: number): Held {
  return { id, state: initialLive(), connection: "connecting", finished: false };
}

function reducer(held: Held | null, action: Action): Held {
  const base = held && held.id === action.id ? held : fresh(action.id);
  if (action.type === "event") return { ...base, state: reduceLive(base.state, action.event) };
  if (action.type === "connection") return { ...base, connection: action.connection };
  return { ...base, finished: true };
}

export type LiveRun = {
  target: LiveTarget | null;
  state: LiveState | null;
  connection: LiveConnection | null;
  /** 아직 보여 줄 기록이 남았거나 실행이 도는 중 */
  active: boolean;
  /** 실행이 끝날 때까지 뷰를 가리고 스트림으로 받은 것만 보여 주는 중 */
  holding: boolean;
  /** 다시 보기를 끝까지 건너뛴다 */
  skip: () => void;
};

/**
 * 실행 하나의 실시간 진행을 읽는다. 스트림이 없거나 끊기면 live-client가 다시 붙거나 진단 뷰를 되풀이해 읽는다(poll).
 * 다시 보기는 스트림에 기록이 없으면(이 기능 전에 돈 찾기) 저장된 대화(뷰)로 같은 순서를 만들어 보여 준다.
 */
export function useLiveRun(
  target: LiveTarget | null,
  orgId: string,
  options: {
    poll: (sessionId: string) => Promise<boolean>;
    /** 보여 줄 기록을 다 보여 줬다. failed면 스트림을 쓸 수 없었다(뷰를 되풀이해 읽는 쪽으로 넘긴다) */
    onDone: (failed: boolean) => void;
    view: () => DiagnosisView | null;
  },
): LiveRun {
  const [held, dispatch] = useReducer(reducer, null);
  const opts = useRef(options);
  const skipRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    if (!target) return;
    const { id, mode, sessionId } = target;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let readyAt = 0;
    let rushing = false;
    let messages = 0;
    let finishedStream = false;
    let failedStream = false;
    const queue: LiveEvent[] = [];
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pace = mode === "replay" ? "replay" : "live";

    const show = () => {
      timer = null;
      if (closed) return;
      const event = queue.shift();
      if (!event) return;
      dispatch({ type: "event", id, event });
      if (event.type === "done") {
        dispatch({ type: "finish", id });
        opts.current.onDone(failedStream);
        return;
      }
      const instant = rushing || (reduced && mode !== "replay") || (mode === "attach" && isHistory(event, Date.now()));
      const wait = instant ? 0 : paceMs(event, pace, queue.length);
      readyAt = Date.now() + wait;
      if (queue.length > 0) timer = setTimeout(show, wait);
    };
    const enqueue = (event: LiveEvent) => {
      if (closed) return;
      queue.push(event);
      if (timer === null) timer = setTimeout(show, Math.max(0, readyAt - Date.now()));
    };
    /** 다시 보기: 스트림에 기록이 없으면 저장된 대화로 */
    const replayStored = () => {
      const view = opts.current.view();
      if (view) for (const event of replayFromView(view)) enqueue(event);
      else enqueue({ type: "done", status: null, lastSeq: null });
    };

    const handle = connectLive({
      url: api.streamUrl(sessionId),
      after: target.after,
      headers: scopeHeaders(orgId),
      onEvent: (event) => {
        if (event.type === "activity" && event.message) messages += 1;
        if (event.type === "done") finishedStream = true;
        if (event.type === "done" && mode === "replay" && messages === 0) {
          // 받은 기록 가운데 말풍선이 하나도 없었다: 앞서 받은 단계 기록은 그대로 두고 저장된 대화로 이어 보여 준다
          replayStored();
          return;
        }
        enqueue(event);
      },
      onConnection: (connection) => {
        if (!closed) dispatch({ type: "connection", id, connection });
      },
      poll: mode === "replay" ? undefined : () => opts.current.poll(sessionId),
    });
    void handle.finished.then((end) => {
      if (closed || finishedStream || end === "done" || end === "closed") return;
      // 스트림을 쓸 수 없다(볼 수 없게 됨, 폴링도 실패). 다시 보기는 저장된 대화로, 실행은 뷰를 다시 읽게 하고 끝낸다
      failedStream = end === "failed";
      if (mode === "replay") replayStored();
      else enqueue({ type: "done", status: null, lastSeq: null });
    });
    skipRef.current = () => {
      rushing = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      show();
    };

    return () => {
      closed = true;
      if (timer !== null) clearTimeout(timer);
      handle.close();
      skipRef.current = () => undefined;
    };
  }, [target, orgId]);

  const mine = held && target && held.id === target.id ? held : null;
  const active = Boolean(target) && !mine?.finished;
  return {
    target,
    state: target ? (mine?.state ?? initialLive()) : null,
    connection: target ? (mine?.connection ?? "connecting") : null,
    active,
    holding: active && Boolean(target?.baseline) && mine?.connection !== "polling",
    skip: () => skipRef.current(),
  };
}
