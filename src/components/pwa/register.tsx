"use client";

import { useEffect } from "react";

/** 서비스 워커(public/sw.js)를 운영 빌드에서만 등록한다. 개발 중에는 캐시가 화면 고치기를 방해하므로 두지 않는다 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
