"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { RunEventView } from "@/lib/run-log-labels";
import { AgentConsole, type ConsoleStatus } from "./agent-console";

const KEY = "rs-console";
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
/** 저장한 선택이 없으면 넓은 화면(1280px 이상)에서만 연다 */
const snapshot = () => window.localStorage.getItem(KEY) ?? (window.matchMedia("(min-width: 1280px)").matches ? "open" : "closed");
function setOpen(open: boolean) {
  window.localStorage.setItem(KEY, open ? "open" : "closed");
  listeners.forEach((l) => l());
}

/**
 * 세션 화면 틀. 왼쪽 단계 메뉴, 가운데 단계 화면, 오른쪽 에이전트 실행 콘솔.
 * 콘솔을 열면 넓은 화면에서는 단계 메뉴를 번호만 남기고 줄여 본문 폭을 지킨다.
 * 좁은 화면에서는 콘솔이 오른쪽에서 덮어 열린다.
 */
export function SessionShell({
  rail,
  children,
  sessionId,
  events,
  status,
}: {
  rail: ReactNode;
  children: ReactNode;
  sessionId: string;
  events: RunEventView[];
  status: ConsoleStatus;
}) {
  const open = useSyncExternalStore(subscribe, snapshot, () => "open") === "open";

  return (
    <div
      data-console={open ? "open" : "closed"}
      className="group/shell grid flex-1 lg:grid-cols-[232px_minmax(0,1fr)] xl:data-[console=open]:grid-cols-[76px_minmax(0,1fr)_380px]"
    >
      {rail}
      <div className="min-w-0">{children}</div>
      {open ? (
        <aside
          aria-label="에이전트 실행 콘솔"
          className="fixed inset-y-0 right-0 z-40 w-[min(380px,100vw)] border-l border-line shadow-[-12px_0_32px_-16px_rgb(0_0_0/0.25)] xl:sticky xl:top-[61px] xl:z-auto xl:h-[calc(100dvh-61px)] xl:w-auto xl:shadow-none"
        >
          <AgentConsole sessionId={sessionId} events={events} status={status} onClose={() => setOpen(false)} />
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-semibold shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] hover:border-ink"
        >
          <span
            aria-hidden="true"
            className={`inline-block size-2 rounded-full ${status.live ? "animate-pulse bg-marker shadow-[0_0_0_1px_var(--color-ink)] motion-reduce:animate-none" : "bg-muted"}`}
          />
          에이전트 실행 기록 <span className="num font-normal text-muted">{events.length}</span>
        </button>
      )}
    </div>
  );
}
