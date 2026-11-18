"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** 미디어 쿼리가 맞는지. 서버에서 그릴 때와 첫 하이드레이션에서는 false다 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

/**
 * 요소가 화면 안에 보이는지. rootMargin으로 위아래에 붙는 띠(휴대폰 머리줄, 아래 대화 단추)를 뺀 곳만 화면으로 친다.
 * 요소가 없거나 관찰하지 않으면 true(보인다고 보고 따로 알리지 않는다)다.
 */
export function useInView<T extends Element>(node: T | null, enabled: boolean, rootMargin = "0px"): boolean {
  const [seen, setSeen] = useState<{ node: T | null; visible: boolean }>({ node: null, visible: true });
  useEffect(() => {
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setSeen({ node, visible: last.isIntersecting });
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, enabled, rootMargin]);
  return !enabled || !node || seen.node !== node ? true : seen.visible;
}
