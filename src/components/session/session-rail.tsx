"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { goToStep } from "@/lib/server/session-actions";
import type { FlowStep } from "@/lib/session/types";
import { CheckIcon } from "../icons";

export type RailItem = { slug: FlowStep | "upload" | "dashboard"; no: number; label: string; state: "done" | "next" | "locked" };

const itemClass =
  "group grid min-h-10 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-md px-2 text-left text-sm text-muted transition-colors data-[current]:bg-surface data-[current]:font-semibold data-[current]:text-ink data-[current]:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=done]:text-ink-2";
const numClass =
  "grid size-[22px] place-items-center rounded-full border border-line-strong font-mono text-[11px] group-data-[current]:border-ink group-data-[current]:bg-marker group-data-[current]:text-marker-ink group-data-[state=done]:border-ink group-data-[state=done]:bg-ink group-data-[state=done]:text-on-ink [&_svg]:size-3";

/** 세션 화면 좌측 단계 메뉴. 현재 단계 번호는 형광펜으로 표시한다. */
export function SessionRail({ sessionId, items }: { sessionId: string; items: RailItem[] }) {
  const segment = useSelectedLayoutSegment();
  return (
    <ol className="grid gap-0.5" aria-label="진행 단계">
      {items.map((item) => {
        const current = segment === item.slug || (segment === "analyzing" && item.slug === "upload");
        const inner = (
          <>
            <span className={numClass}>{item.state === "done" && !current && item.slug !== "dashboard" ? <CheckIcon /> : item.no}</span>
            {item.label}
          </>
        );
        const common = { "data-state": item.state, "data-current": current ? "" : undefined, "aria-current": current ? ("step" as const) : undefined };
        if (item.slug === "upload") {
          return (
            <li key={item.slug}>
              <div className={itemClass} {...common}>
                {inner}
              </div>
            </li>
          );
        }
        if (item.slug === "dashboard") {
          return (
            <li key={item.slug}>
              <Link href="/dashboard" className={`${itemClass} hover:bg-sunken`} {...common} data-state="todo">
                {inner}
              </Link>
            </li>
          );
        }
        if (item.state === "done") {
          return (
            <li key={item.slug}>
              <Link href={`/session/${sessionId}/${item.slug}`} className={`${itemClass} hover:bg-sunken`} {...common}>
                {inner}
              </Link>
            </li>
          );
        }
        if (item.state === "next") {
          return (
            <li key={item.slug}>
              <form action={goToStep.bind(null, sessionId, item.slug as FlowStep)}>
                <button type="submit" className={`${itemClass} hover:bg-sunken`} {...common}>
                  {inner}
                </button>
              </form>
            </li>
          );
        }
        return (
          <li key={item.slug}>
            <div className={`${itemClass} opacity-55`} {...common} aria-disabled="true">
              {inner}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
