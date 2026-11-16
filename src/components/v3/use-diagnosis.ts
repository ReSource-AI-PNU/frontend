"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/v3/api";
import { fixtureView } from "@/lib/v3/fixture";
import type { DiagnosisView } from "@/lib/v3/types";
import { useV3 } from "./context";

type Loaded = { key: string; view: DiagnosisView | null; error: string | null };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

/** 진단 뷰를 읽고 실행·답변·승인을 보낸다. 예시 데이터 모드에서는 어떤 호출도 보내지 않는다. */
export function useDiagnosis() {
  const { mode, org, sessionId, setSessionId } = useV3();
  const key = `${mode}:${org.id}:${sessionId ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", view: null, error: null });
  const [busy, setBusy] = useState(false);

  const live = mode === "live";
  const current = loaded.key === key ? loaded : null;
  const view = live ? (current?.view ?? null) : mode === "fixture" ? fixtureView(org.id) : null;
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
  }, [live, sessionId, org.id, key, running]);

  const act = useCallback(
    async (call: () => Promise<DiagnosisView>) => {
      if (!live) return;
      setBusy(true);
      try {
        const next = await call();
        if (next.session.id !== sessionId) setSessionId(next.session.id);
        setLoaded({ key: `${mode}:${org.id}:${next.session.id}`, view: next, error: null });
      } catch (error) {
        setLoaded((before) => ({ ...before, key, error: messageOf(error) }));
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
    error: live ? (current?.error ?? null) : null,
    busy,
    loading: mode === "loading" || (live && Boolean(sessionId) && current === null),
    canAct: live,
    start: () => act(() => api.createSession(org.id)),
    run: () => (sessionId ? act(() => api.run(sessionId, org.id)) : Promise.resolve()),
    answer: (questionId: string, value: string) =>
      sessionId ? act(() => api.answer(sessionId, org.id, questionId, value)) : Promise.resolve(),
    approve: (threadId: string) =>
      sessionId ? act(() => api.approve(sessionId, org.id, threadId)) : Promise.resolve(),
    forget: () => setSessionId(null),
  };
}
