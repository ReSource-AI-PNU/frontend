"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/v3/api";
import type { DiagnosisView } from "@/lib/v3/types";
import { useV3 } from "./context";

type Loaded = { key: string; view: DiagnosisView | null; error: string | null };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

/** 진단 뷰를 읽고 실행·답변·승인을 보낸다. 예시 데이터 모드에서는 어떤 호출도 보내지 않는다. */
export function useDiagnosis() {
  const { mode, fixture, org, sessionId, setSessionId } = useV3();
  const key = `${mode}:${org.id}:${sessionId ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", view: null, error: null });
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  // 실행·답변·승인이 거절됐을 때의 사유. 뷰를 다시 읽어도 다음 행동 전까지 남긴다
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);

  const live = mode === "live";
  const current = loaded.key === key ? loaded : null;
  const view = live ? (current?.view ?? null) : (fixture?.view(org.id) ?? null);
  const running = live && view?.session.status === "running";

  useEffect(() => {
    if (!live || !sessionId) return;
    let alive = true;
    const read = () =>
      api
        .getView(sessionId, org.id)
        .then((next) => {
          if (alive) setLoaded({ key, view: next, error: null });
        })
        .catch((error: unknown) => {
          if (alive) setLoaded({ key, view: null, error: messageOf(error) });
        });
    void read();
    // 에이전트가 도는 동안에는 2초마다 다시 읽는다
    const timer = running ? window.setInterval(read, 2000) : null;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [live, sessionId, org.id, key, running, tick]);

  const act = useCallback(
    async (call: () => Promise<DiagnosisView>) => {
      if (!live) return;
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
    [live, mode, org.id, sessionId, setSessionId, key],
  );

  return {
    mode,
    org,
    view,
    sessionId,
    error: live ? ((actionError?.key === key ? actionError.message : null) ?? current?.error ?? null) : null,
    busy,
    loading: mode === "loading" || (live && Boolean(sessionId) && current === null),
    canAct: live,
    start: () => act(() => api.createSession(org.id)),
    /** 진단을 만들고 곧바로 에이전트를 돌린다 */
    find: () =>
      act(async () => {
        const created = await api.createSession(org.id);
        return api.run(created.session.id, org.id);
      }),
    run: () => (sessionId ? act(() => api.run(sessionId, org.id)) : Promise.resolve()),
    reload: () => setTick((before) => before + 1),
    answer: (questionId: string, value: string | number) =>
      sessionId ? act(() => api.answer(sessionId, org.id, questionId, value)) : Promise.resolve(),
    /** 답을 보내고, 남은 질문이 없으면 묻지 않고 이어서 돌린다 */
    answerAndContinue: (questionId: string, value: string | number) =>
      sessionId
        ? act(async () => {
            const next = await api.answer(sessionId, org.id, questionId, value);
            const open = next.questions.some((item) => !item.answered);
            const waiting = next.session.status === "idle" && next.session.phase !== "done";
            return !open && waiting ? api.run(sessionId, org.id) : next;
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
