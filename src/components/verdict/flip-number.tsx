"use client";

import { useEffect, useRef, useState } from "react";
import { formatSigned } from "@/lib/format";

/**
 * 시그니처 모션의 숫자 부분. 화면에 보이면 from에서 to로 1.1초 동안 올라가고, 0을 넘는 순간 손실색에서 이익색으로 바뀐다.
 * 모션 감소 설정이면 바로 to를 보여 준다.
 */
export function FlipNumber({ from, to, unit, className = "" }: { from: number; to: number; unit: string; className?: string }) {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setValue(to), 0);
      return () => clearTimeout(t);
    }
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        timer = setTimeout(() => {
          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / 1100);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round((from + (to - from) * eased) / 10) * 10);
            if (t < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }, 350);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [from, to]);

  return (
    <p ref={ref} aria-label={`${formatSigned(to)} ${unit}`} className={`num leading-none font-semibold tracking-[-0.04em] transition-colors duration-300 ${value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink"} ${className}`}>
      <span aria-hidden="true">{formatSigned(value)}</span>
      <small aria-hidden="true" className="ml-1.5 font-sans text-xl font-medium tracking-normal text-muted">
        {unit}
      </small>
    </p>
  );
}
