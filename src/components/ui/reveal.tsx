"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * 내려오다가 화면에 들어오면 아래에서 떠오르며 나타난다(한 번만). 처음부터 화면 안에 있는 것은 그대로 둔다.
 * 스크립트가 돌기 전에는 평소대로 보이므로, 스크립트가 꺼져 있어도 내용이 숨지 않는다.
 * 움직임 줄이기 설정이면 아무것도 하지 않는다. 모양은 globals.css의 [data-reveal]이 정한다.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** 늦게 나타나게 한다(ms). 나란한 카드에 차례를 줄 때 쓴다 */
  delay?: number;
  as?: "div" | "li" | "section" | "article";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // 이미 화면 안에 있으면(첫 장) 숨기지 않는다
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    node.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;
  return (
    // 태그만 바뀌는 같은 요소다
    <Tag ref={ref as never} style={style} className={className}>
      {children}
    </Tag>
  );
}
