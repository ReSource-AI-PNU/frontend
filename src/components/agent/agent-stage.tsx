"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveState } from "@/lib/v3/live";
import { company, flows, specialists, vendors, type SlimeState, type SpecialistView, type TalkerView } from "@/lib/v3/stage";
import { Slime, type SlimeTone } from "./slime";

/**
 * AI 작업실: 찾기가 도는 동안 누가 무엇을 하는지 캐릭터로 보여 준다(사용자 요청으로 DESIGN.md "AI 작업실"에 더함).
 * 위에는 대회 6단계의 전문 담당 여섯, 아래 왼쪽에 회사 측 AI, 오른쪽에 업체마다 업체 측 AI가 선다.
 * 쓰는 쪽에서 받는 쪽으로 선 위에 점이 흐르고, 지금 일하는 캐릭터만 말풍선을 단다.
 * 같은 내용은 아래 진행 목록과 대화 패널에 글로도 있다(이 그림은 aria-hidden이 아니라 요약 문장을 함께 둔다).
 */

const VENDOR_LIMIT = 4;

type Point = { x: number; y: number };

function layout(narrow: boolean, vendorCount: number) {
  const special: Point[] = narrow
    ? [0, 1, 2, 3, 4, 5].map((i) => ({
        x: 17 + (i % 3) * 33,
        y: i < 3 ? 11 : 31,
      }))
    : [0, 1, 2, 3, 4, 5].map((i) => ({ x: 8.5 + i * 16.6, y: 15 }));
  const companyAt: Point = narrow ? { x: 22, y: 72 } : { x: 21, y: 70 };
  const n = Math.min(vendorCount, VENDOR_LIMIT);
  const top = narrow ? 54 : 42;
  const bottom = narrow ? 92 : 92;
  const vendorAt: Point[] = Array.from({ length: n }, (_, i) => ({
    x: narrow ? 76 : 79,
    y: n === 1 ? companyAt.y : top + ((bottom - top) * i) / (n - 1),
  }));
  return { special, companyAt, vendorAt, height: narrow ? 500 : 420 };
}

function Bubble({
  text,
  align = "center",
  tone = "plain",
}: {
  text: string;
  align?: "center" | "left" | "right" | "side";
  tone?: "plain" | "dark";
}) {
  const place =
    align === "side"
      ? "right-full top-1 mr-2"
      : `bottom-full mb-2 ${align === "center" ? "left-1/2 -translate-x-1/2" : align === "left" ? "right-0" : "left-0"}`;
  return (
    <span
      key={text}
      className={`pointer-events-none absolute w-max max-w-[200px] rounded-[14px] px-3 py-1.5 text-[12.5px] leading-snug shadow-[0_6px_18px_rgb(0_0_0/0.08)] [animation:rs-rise_240ms_var(--ease-out)_both] ${place} ${
        tone === "dark" ? "bg-ink text-bg" : "border border-line bg-surface text-ink-2"
      }`}
    >
      <span className="line-clamp-2">{text}</span>
    </span>
  );
}

function Actor({
  at,
  tone,
  state,
  size,
  name,
  sub,
  line,
  bubbleAlign,
  onClick,
}: {
  at: Point;
  tone: SlimeTone;
  state: SlimeState;
  size: number;
  name: string;
  sub?: string | null;
  line?: string | null;
  bubbleAlign?: "center" | "left" | "right" | "side";
  /** 누르면 이 캐릭터의 대화를 연다(업체 측 AI) */
  onClick?: () => void;
}) {
  const speaking = Boolean(line) && (state === "talk" || state === "work");
  const Body = onClick ? "button" : "div";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <Body
        {...(onClick
          ? {
              type: "button" as const,
              onClick,
              "aria-label": `${name}와 나눈 대화 보기`,
            }
          : {})}
        className={`relative flex flex-col items-center ${onClick ? "rounded-xl p-1 hover:bg-surface focus-visible:outline-2 focus-visible:outline-ink" : ""}`}
      >
        {speaking && line ? <Bubble text={line} align={bubbleAlign} tone={tone === "company" ? "dark" : "plain"} /> : null}
        <Slime tone={tone} state={state} size={size} />
        <span className={`mt-1 max-w-[110px] truncate text-center text-[12px] font-medium ${state === "wait" ? "text-muted" : "text-ink"}`}>
          {name}
        </span>
        {sub ? <span className="max-w-[110px] truncate text-center text-[11px] text-muted">{sub}</span> : null}
      </Body>
    </div>
  );
}

function useNarrow(ref: React.RefObject<HTMLDivElement | null>) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 560));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return narrow;
}

function summaryOf(spec: SpecialistView[], me: TalkerView, others: TalkerView[]): string {
  const busy = spec.find((item) => item.state === "talk" || item.state === "work");
  const talking = others.filter((item) => item.state === "talk" || item.state === "work").length;
  if (talking > 0) return `업체 측 AI ${others.length}곳과 대화하고 있습니다.`;
  if (others.length > 0 && (me.state === "talk" || me.state === "work")) return "회사 측 AI가 업체에 보낼 글을 쓰고 있습니다.";
  if (busy) return `${busy.name} 담당: ${busy.role.replace(/니다$/, "니다.")}`;
  if (others.length > 0) return `업체 측 AI ${others.length}곳과 대화를 마쳤습니다.`;
  return "전문 담당이 차례로 판단하고 있습니다.";
}

export function AgentStage({ live, onOpen }: { live: LiveState; onOpen?: (threadId: string) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const narrow = useNarrow(box);
  const spec = specialists(live);
  const me = company(live);
  const others = vendors(live);
  const shown = others.slice(0, VENDOR_LIMIT);
  const hidden = others.length - shown.length;
  const moving = new Map(flows(live).map((item) => [item.threadId, item.from]));
  const place = layout(narrow, shown.length);
  const busyStage = spec.find((item) => item.state === "talk" || item.state === "work")?.stage ?? null;

  return (
    <section aria-label="AI 작업실" className="overflow-hidden rounded-[20px] border border-line bg-ground">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-4">
        <h2 className="text-[15px] font-semibold">AI 작업실</h2>
        <p aria-live="polite" className="text-[13px] text-muted">
          {summaryOf(spec, me, others)}
        </p>
      </header>
      <div ref={box} className="relative mx-2 mb-2" style={{ height: place.height }}>
        <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {spec.map((item, i) => {
            const from = place.special[i];
            const active = item.stage === busyStage;
            return (
              <line
                key={item.stage}
                x1={from.x}
                y1={from.y + (narrow ? 7 : 9)}
                x2={place.companyAt.x}
                y2={place.companyAt.y - 9}
                vectorEffect="non-scaling-stroke"
                stroke={active ? "var(--color-ink)" : "var(--color-line-strong)"}
                strokeWidth={active ? 1.6 : 1}
                strokeDasharray={active ? "4 8" : "2 6"}
                className={active ? "[animation:rs-flow_0.8s_linear_infinite]" : ""}
                opacity={item.state === "wait" ? 0.45 : 1}
              />
            );
          })}
          {shown.map((vendor, i) => {
            const to = place.vendorAt[i];
            const from = moving.get(vendor.id);
            const reverse = from === "vendor";
            const a = reverse ? to : place.companyAt;
            const b = reverse ? place.companyAt : to;
            return (
              <g key={vendor.id}>
                <line
                  x1={place.companyAt.x + 6}
                  y1={place.companyAt.y}
                  x2={to.x - 6}
                  y2={to.y}
                  vectorEffect="non-scaling-stroke"
                  stroke="var(--color-line-strong)"
                  strokeWidth={1.2}
                />
                {from ? (
                  <line
                    x1={a.x + (reverse ? -6 : 6)}
                    y1={a.y}
                    x2={b.x + (reverse ? 6 : -6)}
                    y2={b.y}
                    vectorEffect="non-scaling-stroke"
                    stroke="var(--color-ink)"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeDasharray="2 10"
                    className="[animation:rs-flow_0.6s_linear_infinite]"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {spec.map((item, i) => (
          <Actor
            key={item.stage}
            at={place.special[i]}
            tone={`s${item.stage}` as SlimeTone}
            state={item.state}
            size={narrow ? 40 : 46}
            name={item.name}
            line={narrow ? null : item.line}
            bubbleAlign={i === 0 ? "right" : i === 5 ? "left" : "center"}
          />
        ))}
        <Actor
          at={place.companyAt}
          tone="company"
          state={me.state}
          size={narrow ? 64 : 76}
          name={me.name}
          line={me.line}
          bubbleAlign="right"
        />
        {shown.map((vendor, i) => (
          <Actor
            key={vendor.id}
            at={place.vendorAt[i]}
            tone="vendor"
            state={vendor.state}
            size={narrow ? 46 : 54}
            name={vendor.name}
            sub={vendor.outcome}
            line={vendor.line}
            bubbleAlign="side"
            onClick={onOpen ? () => onOpen(vendor.id) : undefined}
          />
        ))}
        {hidden > 0 ? <span className="absolute right-3 bottom-2 text-[12px] text-muted">업체 {hidden}곳 더</span> : null}
        {shown.length === 0 ? (
          <span
            className="absolute text-[12px] text-muted"
            style={{
              left: `${narrow ? 60 : 64}%`,
              top: `${place.companyAt.y}%`,
            }}
          >
            업체를 찾으면 업체 측 AI가 여기에 나옵니다
          </span>
        ) : null}
      </div>
      <p className="border-t border-line px-5 py-2.5 text-[12px] leading-relaxed text-muted">
        위의 전문 담당 여섯은 근거가 붙은 계산과 검색으로 판단하고, 회사 측 AI와 업체 측 AI가 그 결과로 대화합니다.
      </p>
    </section>
  );
}
