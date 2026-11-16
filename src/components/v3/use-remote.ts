"use client";

import { useEffect, useState } from "react";

type State<T> = { key: string; data: T | null; error: string | null };

/** 키가 바뀔 때마다 다시 읽는다. enabled가 false면 아무 호출도 하지 않는다. */
export function useRemote<T>(key: string, enabled: boolean, load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: "", data: null, error: null });
  const [version, setVersion] = useState(0);
  const fullKey = `${key}#${version}`;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((data) => {
        if (alive) setState({ key: fullKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (alive) {
          setState({
            key: fullKey,
            data: null,
            error: error instanceof Error ? error.message : "불러오지 못했습니다.",
          });
        }
      });
    return () => {
      alive = false;
    };
    // load는 key에 묶여 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, enabled]);
  const current = state.key === fullKey ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && current === null,
    reload: () => setVersion((before) => before + 1),
    set: (data: T) => setState({ key: fullKey, data, error: null }),
  };
}
