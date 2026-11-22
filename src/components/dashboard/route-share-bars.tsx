"use client";

import { useState, type KeyboardEvent } from "react";
import { RouteBadge } from "@/components/session/stream-badges";
import { formatNumber } from "@/lib/format";
import { STREAM_ROUTE_LABEL, type StreamRoute } from "@/lib/session/types";

/** 행 높이 34px + 간격 4px */
const ROW_STEP = 38;

export type RouteShareDatum = { route: StreamRoute; kg: number; share: number; streams: number };

function pct(share: number) {
  return `${(Math.round(share * 1000) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

/**
 * 경로별 처리량 비중. 화면이 흑백이라 경로는 막대 색으로 나누지 않는다.
 * 막대는 무채색 한 계열(ink-2)이고, 경로 이름은 RouteBadge 라벨로 붙인다. 모든 막대에 비중과 kg을 직접 적는다.
 * 행에 마우스를 올리거나, 차트에 포커스한 뒤 ↑/↓로 값을 볼 수 있다. 순서는 경로 순서로 고정한다(값 순위로 바꾸지 않는다).
 */
export function RouteShareBars({ data, ariaLabel }: { data: RouteShareDatum[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.kg));
  const last = data.length - 1;
  const a = active !== null ? data[active] : null;

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") setActive((i) => Math.min(last, (i ?? -1) + 1));
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? data.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="group"
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      aria-label={`${ariaLabel} 위·아래 화살표로 경로마다 값을 볼 수 있습니다.`}
      className="relative rounded-sm"
    >
      <div role="img" aria-label={ariaLabel} className="grid gap-1">
        {data.map((d, i) => {
          const on = active === i;
          return (
            <div
              key={d.route}
              aria-hidden="true"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`grid h-[34px] grid-cols-[124px_minmax(0,1fr)] items-center gap-3 rounded-sm px-1 transition-colors duration-150 ${on ? "bg-sunken" : ""}`}
            >
              <span>
                <RouteBadge route={d.route} size="sm" />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3.5 shrink-0 rounded-r-sm bg-ink-2 transition-opacity duration-150"
                  style={{ width: `${(d.kg / max) * 70}%`, minWidth: d.kg > 0 ? 2 : 0, opacity: active === null || on ? 1 : 0.5 }}
                />
                <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">{pct(d.share)}</span>
                <span className="text-[12px] whitespace-nowrap text-muted tabular-nums">{formatNumber(d.kg)}kg</span>
              </span>
            </div>
          );
        })}
      </div>
      {a ? (
        <div
          role="status"
          className="pointer-events-none absolute left-[128px] z-10 -translate-y-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.4)]"
          style={{ top: (active ?? 0) * ROW_STEP - 4 }}
        >
          <p className="font-semibold whitespace-nowrap text-ink">{STREAM_ROUTE_LABEL[a.route]}</p>
          <p className="whitespace-nowrap text-ink-2 tabular-nums">
            {formatNumber(a.kg)}kg · 전체의 {pct(a.share)}
          </p>
          <p className="whitespace-nowrap text-muted">{a.streams > 0 ? `흐름 ${a.streams}개` : "해당 흐름 없음"}</p>
        </div>
      ) : null}
    </div>
  );
}
