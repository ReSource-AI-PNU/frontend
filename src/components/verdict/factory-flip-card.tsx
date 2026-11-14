"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RouteBadge } from "@/components/session/stream-badges";
import { formatSigned } from "@/lib/format";
import type { StreamOrigin, StreamRoute } from "@/lib/session/types";
import { Badge } from "../ui/badge";
import { FlipNumber } from "./flip-number";

export type FactoryFlipStream = {
  name: string;
  /** 예: "PP 단일 · 깨끗" */
  nature: string;
  origin: StreamOrigin;
  kg: number;
  route: StreamRoute;
  /** 현행(전부 혼합 소각) 월 손익 */
  now: number;
  /** AI가 고른 경로의 월 손익 */
  after: number;
};

/**
 * 소개 화면 히어로 카드. 공장 한 곳의 폐플라스틱 흐름이 "전부 소각"에서 흐름별 경로로 나뉘며 월 손익이 뒤집히는 장면.
 * 화면에 보이면 한 번 재생한다: 흐름마다 소각 배지가 AI가 고른 경로로 바뀌고, 공장 월 손익이 from에서 to로 올라간다(FlipNumber).
 * 모션 감소 설정이면 결과만 보여 준다. 숫자는 시연용 가정값이다.
 */
export function FactoryFlipCard({ title, streams }: { title: string; streams: FactoryFlipStream[] }) {
  const from = streams.reduce((s, x) => s + x.now, 0);
  const to = streams.reduce((s, x) => s + x.after, 0);
  const [split, setSplit] = useState(false);
  const [run, setRun] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSplit(true);
      return;
    }
    setSplit(false);
    setRun((r) => r + 1);
    timer.current = setTimeout(() => setSplit(true), 450);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setSplit(true);
          return;
        }
        timer.current = setTimeout(() => setSplit(true), 450);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div ref={cardRef} className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 text-[13px] text-muted">
        <span className="min-w-0 truncate">{title}</span>
        <span className="shrink-0">시연용 가정값</span>
      </div>

      <p className="sr-only">
        흐름 {streams.length}개를 지금처럼 전부 소각하면 공장 월 손익이 {formatSigned(from)}원이고, 흐름별 최적안으로 바꾸면 {formatSigned(to)}원입니다.
      </p>
      <div aria-hidden="true" className="flex justify-between gap-3 border-b border-line px-[18px] pt-2.5 pb-2 text-[12px] text-muted">
        <span>흐름 · 성질 · 월 물량</span>
        <span>경로 · 월 손익 (원)</span>
      </div>
      <ol aria-hidden="true" className="divide-y divide-line">
        {streams.map((s) => {
          const v = split ? s.after : s.now;
          return (
            <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-[18px] py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{s.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {s.nature} · {s.origin} · 월 <span className="tabular-nums">{s.kg.toLocaleString("ko-KR")}</span>kg
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <RouteBadge route={split ? s.route : "incinerate"} size="sm" />
                <span className={`num text-[13px] font-semibold transition-colors duration-300 ${v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-2"}`}>
                  {formatSigned(v)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-line px-[18px] pt-4 pb-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">공장 월 손익</span>
          <span className={`num text-[15px] text-loss line-through decoration-1 transition-opacity duration-300 ${split ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            {formatSigned(from)}
          </span>
        </div>
        <FlipNumber key={run} from={from} to={to} unit="원/월" className="mt-2.5 text-[48px] sm:text-[56px]" />
        <p className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1 border-t border-dashed border-line-strong pt-3 text-[13px] text-muted">
          <span>현행 전부 소각 → 흐름별 최적안</span>
          <span>
            개선 <b className="num font-semibold text-ink">{formatSigned(to - from)}</b>원/월
          </span>
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-line bg-bg px-[18px] py-3">
        <Badge tone="ai">AI 진단</Badge>
        <button type="button" onClick={play} className="min-h-[34px] rounded-md px-2 text-[13px] font-semibold hover:underline">
          다시 보기
        </button>
      </div>
    </div>
  );
}
