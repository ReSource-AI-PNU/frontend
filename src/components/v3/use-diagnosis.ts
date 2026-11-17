"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/v3/api";
import type { DiagnosisView } from "@/lib/v3/types";
import { useV3 } from "./context";
import { useLiveRun, type LiveMode, type LiveTarget } from "./use-live";

type Loaded = { key: string; view: DiagnosisView | null; error: string | null };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function baselineOf(view: DiagnosisView | null): LiveTarget["baseline"] {
  return {
    messageIds: (view?.threads ?? []).flatMap((thread) => thread.messages.map((message) => message.id)),
    stages: view?.stages ?? [],
  };
}

/**
 * 진단 뷰를 읽고 실행·답변·승인을 보낸다. 체험하기(읽기 전용)에서는 읽기만 하고 아무것도 보내지 않는다.
 * 실행은 뒤에서 돌리고(POST /run?mode=async) 실시간 진행 스트림으로 지켜본다. 스트림을 쓸 수 없으면 뷰를 되풀이해 읽는다.
 */
export function useDiagnosis() {
  const { mode, canWrite, readOnly, org, sessionId, setSessionId } = useV3();
  const key = `${mode}:${org.id}:${sessionId ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", view: null, error: null });
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  // 실행·답변·승인이 거절됐을 때의 사유. 뷰를 다시 읽어도 다음 행동 전까지 남긴다
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);
  const [target, setTarget] = useState<LiveTarget | null>(null);
  const counter = useRef(0);
  /** 지금 지켜보는 실행(스트림). 뷰를 읽다가 같은 실행에 또 붙지 않게 바로 적어 둔다 */
  const watching = useRef<LiveTarget | null>(null);
  /** 스트림이 실패한 찾기. 다시 붙지 않고 뷰를 되풀이해 읽는다 */
  const streamFailed = useRef(new Set<string>());

  const live = mode === "live";
  const current = loaded.key === key ? loaded : null;
  const view = live ? (current?.view ?? null) : null;
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });

  const reload = useCallback(() => setTick((before) => before + 1), []);
  const follow = useCallback((id: string, after: number, how: LiveMode, baseline: LiveTarget["baseline"]) => {
    counter.current += 1;
    const next = { id: counter.current, sessionId: id, after, mode: how, baseline };
    watching.current = next;
    setTarget(next);
  }, []);

  const liveTarget = target && target.sessionId === sessionId ? target : null;
  const stream = useLiveRun(liveTarget, org.id, {
    poll: async (id) => {
      const next = await api.getView(id, org.id);
      setLoaded({ key: `${mode}:${org.id}:${id}`, view: next, error: null });
      return next.session.status === "running";
    },
    onDone: (failed) => {
      const done = watching.current;
      if (done && failed) streamFailed.current.add(done.sessionId);
      watching.current = null;
      reload();
    },
    view: () => viewRef.current,
  });
  const streaming = stream.active;
  const running = live && view?.session.status === "running";

  useEffect(() => {
    if (!live || !sessionId) return;
    let alive = true;
    const read = () =>
      api
        .getView(sessionId, org.id)
        .then((next) => {
          if (!alive) return;
          setLoaded({ key, view: next, error: null });
          // 다른 창에서 시작했거나 다시 열어 보니 돌고 있다: 실시간 진행에 붙는다
          const watched = watching.current?.sessionId === sessionId;
          if (next.session.status === "running" && !watched && !streamFailed.current.has(sessionId)) {
            follow(sessionId, 0, "attach", null);
          }
        })
        .catch((error: unknown) => {
          if (alive) setLoaded({ key, view: null, error: messageOf(error) });
        });
    void read();
    // 스트림 없이 도는 동안에는 2초마다 다시 읽는다
    const timer = running && !streaming ? window.setInterval(read, 2000) : null;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [live, sessionId, org.id, key, running, streaming, tick, follow]);

  const act = useCallback(
    async (call: () => Promise<DiagnosisView>) => {
      if (!canWrite) return;
      setBusy(true);
      setActionError(null);
      try {
        const next = await call();
        if (next.session.id !== sessionId) setSessionId(next.session.id);
        setLoaded({ key: `${mode}:${org.id}:${next.session.id}`, view: next, error: null });
      } catch (error) {
        setActionError({ key, message: messageOf(error) });
        // 거절된 행동이 서버 상태를 바꿨을 수 있다(승인 막힘 등). 뷰를 다시 읽어 그 상태를 보여 준다
        setTick((before) => before + 1);
      } finally {
        setBusy(false);
      }
    },
    [canWrite, mode, org.id, sessionId, setSessionId, key],
  );

  /**
   * 실행을 뒤에서 돌리고 실시간 진행을 연다. 이 방식을 모르는 서버는 끝까지 돌린 뷰를 주므로 그대로 쓴다.
   * 이미 돌고 있으면(409) 그 실행에 붙는다.
   */
  const startRun = useCallback(
    async (id: string, before: DiagnosisView | null): Promise<DiagnosisView> => {
      let started: Awaited<ReturnType<typeof api.runAsync>>;
      try {
        started = await api.runAsync(id, org.id);
      } catch (error) {
        if (error instanceof ApiError && error.code === "RUN_IN_PROGRESS") {
          streamFailed.current.delete(id);
          follow(id, 0, "attach", null);
          return api.getView(id, org.id);
        }
        throw error;
      }
      if ("session" in started) return started;
      streamFailed.current.delete(id);
      follow(id, typeof started.after === "number" ? started.after : 0, "live", baselineOf(before));
      const next = await api.getView(id, org.id);
      // 규칙 정책은 이미 끝났을 수 있다. 스트림을 다 보여 줄 때까지 도는 중으로 보인다
      return next.session.status === "running" ? next : { ...next, session: { ...next.session, status: "running" } };
    },
    [org.id, follow],
  );

  return {
    mode,
    org,
    view,
    sessionId,
    error: live ? ((actionError?.key === key ? actionError.message : null) ?? current?.error ?? null) : null,
    busy,
    loading: mode === "loading" || (live && Boolean(sessionId) && current === null),
    canAct: canWrite,
    /** 실시간 진행(스트림으로 받은 대화·단계·질문) */
    stream,
    start: () => act(() => api.createSession(org.id)),
    /** 진단을 만들고 곧바로 에이전트를 돌린다 */
    find: () =>
      act(async () => {
        const created = await api.createSession(org.id);
        setSessionId(created.session.id);
        return startRun(created.session.id, created);
      }),
    run: () => (sessionId ? act(() => startRun(sessionId, view)) : Promise.resolve()),
    /** 체험하기: 끝난 찾기에서 두 AI가 주고받은 과정을 저장된 기록으로 다시 보여 준다 */
    replay: () => {
      if (!sessionId || !live) return;
      follow(sessionId, 0, "replay", { messageIds: [], stages: (view?.stages ?? []).map((item) => ({ ...item, status: "waiting" as const })) });
    },
    stopReplay: () => {
      watching.current = null;
      setTarget(null);
    },
    /** 끝난 찾기에 주고받은 메시지가 있으면 다시 볼 수 있다 */
    canReplay: live && !running && !streaming && Boolean(view?.threads.some((thread) => thread.messages.length > 0)),
    /** 체험하기(읽기 전용)인지. 다시 보기를 화면에 크게 둔다 */
    readOnly,
    reload,
    answer: (questionId: string, value: string | number) =>
      sessionId ? act(() => api.answer(sessionId, org.id, questionId, value)) : Promise.resolve(),
    /** 답을 보내고, 남은 질문이 없으면 묻지 않고 이어서 돌린다 */
    answerAndContinue: (questionId: string, value: string | number) =>
      sessionId
        ? act(async () => {
            const next = await api.answer(sessionId, org.id, questionId, value);
            const open = next.questions.some((item) => !item.answered);
            const waiting = next.session.status === "idle" && next.session.phase !== "done";
            return !open && waiting ? startRun(sessionId, next) : next;
          })
        : Promise.resolve(),
    /** 여러 대화를 차례로 승인한다. 중간에 막히면 거기서 멈추고 사유를 보여 준다 */
    approveAll: (threadIds: string[]) =>
      sessionId && threadIds.length > 0
        ? act(async () => {
            let next = await api.approve(sessionId, org.id, threadIds[0]);
            for (const threadId of threadIds.slice(1)) next = await api.approve(sessionId, org.id, threadId);
            return next;
          })
        : Promise.resolve(),
    approve: (threadId: string) =>
      sessionId ? act(() => api.approve(sessionId, org.id, threadId)) : Promise.resolve(),
    forget: () => setSessionId(null),
  };
}
