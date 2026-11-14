"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSigned } from "@/lib/format";
import { Badge } from "../ui/badge";
import { WastePileIllustration } from "./waste-pile";

const DURATION = 1100;
const DELAY = 450;

/**
 * 시그니처 모션 "테이프 떼기" (DESIGN.md 모션 항목).
 * 테이프 박스가 사진에서 떨어지고 kg당 손익이 from에서 to로 넘어간다. 0을 넘는 순간 색이 바뀐다.
 */
export function PriceFlipCard({
  from = -250,
  to = 300,
  title = "판정 · PP 압축품 · 월 800kg",
  action = "테이프·라벨 제거",
  monthlyGain = 440000,
}: {
  from?: number;
  to?: number;
  title?: string;
  action?: string;
  monthlyGain?: number;
}) {
  const [value, setValue] = useState(from);
  const [peeled, setPeeled] = useState(false);
  const [washKey, setWashKey] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      setPeeled(true);
      return;
    }
    setValue(from);
    setPeeled(false);
    let crossed = false;
    timer.current = setTimeout(() => {
      setPeeled(true);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        const n = Math.round((from + (to - from) * eased) / 10) * 10;
        setValue(n);
        if (!crossed && n > 0) {
          crossed = true;
          setWashKey((k) => k + 1);
        }
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    }, DELAY);
  }, [from, to]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  const gain = value > 0;

  return (
    <div ref={cardRef} className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5 text-[13px] text-muted">
        <span>{title}</span>
        <span className="flex items-center gap-1.5 num text-[12px] before:size-1.5 before:rounded-full before:bg-gain before:content-['']">LIVE</span>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden bg-photo">
        <WastePileIllustration label="압축 플라스틱 베일 더미 사진. 테이프와 라벨이 붙어 있음" />
        <div className="absolute top-[22%] left-[6%] h-[64%] w-[88%] rounded-[2px] border-[1.5px] border-marker">
          <span className="num absolute -top-[22px] -left-[1.5px] rounded-[2px] rounded-bl-none bg-marker px-1.5 text-[11px] leading-5 font-semibold text-marker-ink">
            PP 압축품 0.94
          </span>
        </div>
        <button
          type="button"
          onClick={run}
          aria-label="테이프 떼기 다시 보기"
          className={`absolute top-[54%] left-[40%] h-[15%] w-[20%] rounded-[2px] border-2 border-marker bg-marker/15 transition-[transform,opacity] duration-700 ease-in-out ${peeled ? "translate-x-7 -translate-y-9 -rotate-[9deg] opacity-0" : ""}`}
        >
          <span className="num absolute -top-[22px] -left-[2px] rounded-[2px] rounded-bl-none bg-marker px-1.5 text-[11px] leading-5 font-semibold whitespace-nowrap text-marker-ink">
            테이프 12%
          </span>
        </button>
        <span className="absolute bottom-2.5 left-3 text-[12px] text-white/55">현장 사진 · 시연용 일러스트</span>
      </div>
      <div key={washKey} className={`px-[18px] pt-5 pb-[18px] ${washKey ? "animate-[rs-wash_1.4s_var(--ease-out)]" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">kg당 손익</span>
          <span className={`num text-[15px] text-loss line-through decoration-1 transition-opacity duration-300 ${gain ? "opacity-100" : "opacity-0"}`}>
            {formatSigned(from)} 원/kg
          </span>
        </div>
        <p
          aria-live="polite"
          className={`num mt-2.5 mb-1.5 text-[56px] leading-none font-semibold tracking-[-0.04em] transition-colors duration-300 sm:text-[64px] ${gain ? "text-gain" : "text-loss"}`}
        >
          {formatSigned(value)}
          <small className="ml-1.5 font-sans text-xl font-medium tracking-normal text-muted">원/kg</small>
        </p>
        <p className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1 border-t border-dashed border-line-strong pt-3 text-[13px] text-muted">
          <span>
            조치 <b className="font-semibold text-ink">{action}</b>
          </span>
          <span>
            차액 <b className="num font-semibold text-ink">{formatSigned(to - from)}</b> 원/kg
          </span>
          <span>
            월 <b className="num font-semibold text-ink">{formatSigned(monthlyGain)}</b>원
          </span>
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-line bg-bg px-[18px] py-3">
        <Badge tone="ai">AI 판정</Badge>
        <button type="button" onClick={run} className="text-[13px] font-semibold hover:underline">
          테이프 떼기 다시 보기
        </button>
      </div>
    </div>
  );
}
