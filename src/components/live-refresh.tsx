"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 다른 창(이웃 기업 화면, 업체 화면)에서 회신하면 이 화면에 바로 보이도록 서버 데이터를 주기적으로 다시 읽는다.
 * active일 때만, 탭이 보일 때만 돈다. 회신을 기다리는 동안만 켠다.
 */
export function LiveRefresh({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
