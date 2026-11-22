"use client";

import { useEffect, useState } from "react";

type State<T> = { key: string; fullKey: string; data: T | null; error: string | null };

/**
 * keep으로 읽은 마지막 값(키마다). 화면을 옮겨 같은 키를 다시 열면 이 값을 먼저 보이고 뒤에서 새로 읽는다.
 * 탭을 닫거나 새로 고치면 비워진다.
 */
const kept = new Map<string, unknown>();

/**
 * 키가 바뀔 때마다 다시 읽는다. enabled가 false면 아무 호출도 하지 않는다.
 * 같은 키를 다시 읽는(reload) 동안에는 앞서 읽은 값을 그대로 돌려줘 화면이 비지 않게 한다.
 * keep이면 다른 화면에서 같은 키로 읽어 둔 값을 처음부터 보인다(loading 없이 refreshing으로 새로 읽는다).
 */
export function useRemote<T>(key: string, enabled: boolean, load: () => Promise<T>, options: { keep?: boolean } = {}) {
  const keep = options.keep === true;
  const [state, setState] = useState<State<T>>(() =>
    keep && kept.has(key)
      ? { key, fullKey: "", data: kept.get(key) as T, error: null }
      : { key: "", fullKey: "", data: null, error: null },
  );
  const [version, setVersion] = useState(0);
  const fullKey = `${key}#${version}`;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((data) => {
        if (keep) kept.set(key, data);
        if (alive) setState({ key, fullKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (keep) kept.delete(key);
        if (alive) {
          setState({
            key,
            fullKey,
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
  const sameKey = state.key === key ? state : null;
  return {
    data: sameKey?.data ?? null,
    error: sameKey?.error ?? null,
    loading: enabled && sameKey === null,
    /** 같은 키를 다시 읽는 중인지 */
    refreshing: enabled && sameKey !== null && sameKey.fullKey !== fullKey,
    reload: () => setVersion((before) => before + 1),
    set: (data: T) => {
      if (keep) kept.set(key, data);
      setState({ key, fullKey, data, error: null });
    },
  };
}
