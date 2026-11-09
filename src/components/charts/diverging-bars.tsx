"use client";

/**
 * 발산형 막대 차트 (가로 · 세로). 손익처럼 0을 기준으로 부호가 갈리는 값을 그린다.
 *
 * 규칙 (DESIGN.md, dataviz 스킬)
 * - 색은 검증된 차트 토큰만 쓴다: 좋은 쪽 --color-chart-gain, 나쁜 쪽 --color-chart-loss, 0 기준선 --color-chart-zero.
 * - 색만으로 말하지 않는다: 모든 막대 끝에 부호가 붙은 값(+ / U+2212 −)을 직접 적는다.
 * - 막대는 24px 이하, 데이터 끝만 4px 둥글게, 0 기준선에서 자란다. 눈금·격자는 두지 않는다(모든 값이 직접 라벨).
 * - 마우스를 올리거나, 차트에 포커스를 두고 방향키를 누르면 툴팁이 뜬다. 툴팁은 보조일 뿐이므로
 *   같은 데이터를 표로도 보여 줘야 한다(화면에 이미 표가 있으면 그것으로 충분하다).
 * - 이중 축 금지: 단위가 다른 두 값은 차트를 두 개로 나눈다.
 *
 * 사용법 (서버 컴포넌트에서 바로 써도 된다. props는 모두 직렬화 가능한 값이다)
 *
 *   // 가로: 경로별 월 손익
 *   <DivergingBars
 *     ariaLabel="경로별 월 손익. A +195,000원, C −200,000원"
 *     data={[
 *       { id: "A", label: "A. 묶음 재활용", value: 195000, note: "3개사 묶음 → 녹산리사이클 매각", emphasis: true },
 *       { id: "C", label: "C. 현행 유지", value: -200000 },
 *     ]}
 *     unit="원"                                  // 툴팁에만 붙는다. 막대 라벨은 숫자만 (단위는 차트 제목에 둔다)
 *     captions={{ negative: "지출", positive: "수익" }}
 *   />
 *
 *   // 가로: 순 탄소 (값이 작을수록 좋다)
 *   <DivergingBars data={...} goodWhen="negative" fractionDigits={2} unit="tCO₂e" captions={{ negative: "줄어드는 배출", positive: "늘어나는 배출" }} ariaLabel="..." />
 *
 *   // 세로: 판정 화면의 kg당 손익 단계
 *   <DivergingBars
 *     orientation="vertical"
 *     height={200}
 *     data={ladder.map((s, i) => ({ id: String(i), label: s.label, value: s.perKg }))}
 *     unit="원/kg"
 *     ariaLabel="작업 단계별 kg당 손익"
 *   />
 *
 * props
 * - data: { id, label, value, note?, emphasis? }[]. emphasis는 AI가 고른 항목(추천 등)이며 형광펜 13% 바탕으로 표시한다.
 * - orientation: "horizontal"(기본, 범주가 세로로 쌓임) | "vertical"(범주가 가로로 늘어섬).
 * - goodWhen: "positive"(기본, 손익) | "negative"(탄소처럼 줄어야 좋은 값). 색만 바뀌고 부호 표기는 그대로다.
 * - fractionDigits: 소수 자릿수(기본 0). unit: 툴팁 값 뒤에 붙는 단위.
 * - captions: 0 기준 양쪽의 방향 설명. 가로는 아래, 세로는 왼쪽에 작게 쓴다.
 * - labelWidth: 가로 차트의 범주 라벨 너비(px, 기본 136). height: 세로 차트의 그림 높이(px, 기본 200).
 * - emphasisLabel: 툴팁에서 emphasis 항목에 붙일 말(기본 "AI 추천").
 * - tableView: 주면 차트 아래에 접힌 "표로 보기"를 둔다. { categoryHeader, valueHeader, caption? }.
 *   화면에 같은 값의 표가 따로 없을 때 꼭 준다(툴팁은 보조일 뿐이다).
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatSigned } from "@/lib/format";

export type DivergingDatum = {
  id: string;
  label: string;
  value: number;
  /** 툴팁 둘째 줄 */
  note?: string;
  /** AI가 고른 항목. 형광펜 바탕 */
  emphasis?: boolean;
};

export type DivergingBarsProps = {
  data: DivergingDatum[];
  ariaLabel: string;
  orientation?: "horizontal" | "vertical";
  goodWhen?: "positive" | "negative";
  fractionDigits?: number;
  unit?: string;
  captions?: { negative?: string; positive?: string };
  labelWidth?: number;
  height?: number;
  emphasisLabel?: string;
  /** 접힌 "표로 보기". 범주 열 제목, 값 열 제목(단위 포함), 표 설명 */
  tableView?: { categoryHeader: string; valueHeader: string; caption?: string };
  className?: string;
};

const BAR = 20; // 막대 두께 (≤ 24px)
const ROW = 44; // 가로 차트 행 높이
const RADIUS = 4;
const GAP = 6; // 막대 끝과 값 라벨 사이

/** 막대 경로: 0 기준선 쪽은 각지게, 데이터 끝만 둥글게 */
function barPath(orientation: "horizontal" | "vertical", base: number, end: number, cross: number, thick: number) {
  const len = Math.abs(end - base);
  if (len < 0.5) return "";
  const r = Math.min(RADIUS, len, thick / 2);
  const dir = end >= base ? 1 : -1;
  if (orientation === "horizontal") {
    const y0 = cross - thick / 2;
    const y1 = cross + thick / 2;
    const e = end;
    const sweep = dir === 1 ? 1 : 0;
    return [
      `M${base},${y0}`,
      `L${e - dir * r},${y0}`,
      `A${r},${r} 0 0 ${sweep} ${e},${y0 + r}`,
      `L${e},${y1 - r}`,
      `A${r},${r} 0 0 ${sweep} ${e - dir * r},${y1}`,
      `L${base},${y1}`,
      "Z",
    ].join(" ");
  }
  // vertical: base/end are y values (화면 좌표, 위가 작다)
  const x0 = cross - thick / 2;
  const x1 = cross + thick / 2;
  const up = end < base; // 양수 → 위로
  const sweep = up ? 1 : 0;
  const s = up ? 1 : -1;
  return [
    `M${x0},${base}`,
    `L${x0},${end + s * r}`,
    `A${r},${r} 0 0 ${sweep} ${x0 + r},${end}`,
    `L${x1 - r},${end}`,
    `A${r},${r} 0 0 ${sweep} ${x1},${end + s * r}`,
    `L${x1},${base}`,
    "Z",
  ].join(" ");
}

/** Geist Mono 13px 기준 대략 너비 (라벨 자리 확보용) */
function textWidth(s: string) {
  return s.length * 7.8 + 4;
}

export function DivergingBars({
  data,
  ariaLabel,
  orientation = "horizontal",
  goodWhen = "positive",
  fractionDigits = 0,
  unit,
  captions,
  labelWidth = 136,
  height = 200,
  emphasisLabel = "AI 추천",
  tableView,
  className = "",
}: DivergingBarsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  const tipId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = (v: number) => formatSigned(v, fractionDigits);
  const tone = (v: number) => {
    if (v === 0) return "var(--color-chart-zero)";
    const good = goodWhen === "positive" ? v > 0 : v < 0;
    return good ? "var(--color-chart-gain)" : "var(--color-chart-loss)";
  };

  const values = data.map((d) => d.value);
  const lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (lo === hi) hi = 1;
  const negLabel = Math.max(0, ...data.filter((d) => d.value < 0).map((d) => textWidth(fmt(d.value)) + GAP));
  const posLabel = Math.max(0, ...data.filter((d) => d.value >= 0).map((d) => textWidth(fmt(d.value)) + GAP));

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const prevKeys = orientation === "horizontal" ? ["ArrowUp", "ArrowLeft"] : ["ArrowLeft", "ArrowUp"];
    const nextKeys = orientation === "horizontal" ? ["ArrowDown", "ArrowRight"] : ["ArrowRight", "ArrowDown"];
    if (nextKeys.includes(e.key)) {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.min(data.length - 1, a + 1)));
    } else if (prevKeys.includes(e.key)) {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.max(0, a - 1)));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  // ---------- 좌표 ----------
  type Mark = { d: DivergingDatum; path: string; labelX: number; labelY: number; anchor: "start" | "end" | "middle"; tipX: number; tipY: number; hit: { x: number; y: number; w: number; h: number } };
  let marks: Mark[] = [];
  let svgH = 0;
  let zero: { x1: number; y1: number; x2: number; y2: number };
  let plotX0 = 0;
  let plotX1 = width;

  if (orientation === "horizontal") {
    const padY = 6;
    svgH = padY * 2 + data.length * ROW;
    plotX0 = labelWidth + 12;
    plotX1 = width - 4;
    const a = plotX0 + negLabel;
    const b = Math.max(a + 40, plotX1 - posLabel);
    const x = (v: number) => a + ((v - lo) / (hi - lo)) * (b - a);
    const x0 = x(0);
    zero = { x1: x0, y1: padY / 2, x2: x0, y2: svgH - padY / 2 };
    marks = data.map((d, i) => {
      const cy = padY + i * ROW + ROW / 2;
      const xe = x(d.value);
      const neg = d.value < 0;
      return {
        d,
        path: barPath("horizontal", x0, xe, cy, BAR),
        labelX: neg ? xe - GAP : xe + GAP,
        labelY: cy,
        anchor: neg ? "end" : "start",
        tipX: xe,
        tipY: cy - BAR / 2,
        hit: { x: 0, y: padY + i * ROW, w: width, h: ROW },
      };
    });
  } else {
    const padTop = 22;
    const padBottom = 22;
    const padX = captions ? 56 : 8;
    svgH = height + padTop + padBottom;
    plotX0 = padX;
    plotX1 = width - 8;
    const col = (plotX1 - plotX0) / Math.max(1, data.length);
    const thick = Math.min(24, col * 0.5);
    const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * height;
    const y0 = y(0);
    zero = { x1: plotX0, y1: y0, x2: plotX1, y2: y0 };
    marks = data.map((d, i) => {
      const cx = plotX0 + col * i + col / 2;
      const ye = y(d.value);
      const neg = d.value < 0;
      return {
        d,
        path: barPath("vertical", y0, ye, cx, thick),
        labelX: cx,
        labelY: neg ? ye + 14 : ye - 8,
        anchor: "middle",
        tipX: cx,
        tipY: Math.min(ye, y0),
        hit: { x: plotX0 + col * i, y: 0, w: col, h: svgH },
      };
    });
  }

  const current = active !== null ? marks[active] : null;
  const tipLeft = current ? Math.min(Math.max(current.tipX, 96), width - 96) : 0;

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <div className="relative">
        {orientation === "horizontal"
          ? data.map((d, i) => (
              <div
                key={d.id}
                aria-hidden="true"
                className={`pointer-events-none absolute left-0 flex items-center pr-2 text-[13px] leading-tight ${d.emphasis ? "font-semibold text-ink" : "text-ink-2"}`}
                style={{ top: 6 + i * ROW, height: ROW, width: labelWidth }}
              >
                <span className="line-clamp-2">{d.label}</span>
              </div>
            ))
          : null}
        <svg
          width={width}
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          role="img"
          aria-label={ariaLabel}
          aria-describedby={current ? tipId : undefined}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) setActive((a) => a ?? 0);
          }}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="block overflow-visible rounded-sm"
        >
          {marks.map((m) =>
            m.d.emphasis ? (
              <rect
                key={`em-${m.d.id}`}
                x={orientation === "horizontal" ? 0 : m.hit.x + 2}
                y={orientation === "horizontal" ? m.hit.y + 2 : 0}
                width={orientation === "horizontal" ? width : m.hit.w - 4}
                height={orientation === "horizontal" ? m.hit.h - 4 : svgH}
                rx={4}
                fill="var(--color-marker)"
                fillOpacity={0.13}
              />
            ) : null,
          )}
          <line {...zero} stroke="var(--color-chart-zero)" strokeWidth={1} shapeRendering="crispEdges" />
          {marks.map((m, i) => {
            const dim = active !== null && active !== i;
            return (
              <g key={m.d.id} style={{ opacity: dim ? 0.45 : 1, transition: "opacity 180ms var(--ease-out)" }}>
                {m.path ? <path d={m.path} fill={tone(m.d.value)} /> : null}
                <text
                  x={m.labelX}
                  y={m.labelY}
                  textAnchor={m.anchor}
                  dominantBaseline={orientation === "horizontal" ? "central" : "auto"}
                  className={`num fill-ink text-[13px] ${m.d.emphasis ? "font-semibold" : ""}`}
                >
                  {fmt(m.d.value)}
                </text>
              </g>
            );
          })}
          {marks.map((m, i) => (
            <rect
              key={`hit-${m.d.id}`}
              x={m.hit.x}
              y={m.hit.y}
              width={m.hit.w}
              height={m.hit.h}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerMove={() => setActive(i)}
            />
          ))}
        </svg>

        {current ? (
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] leading-snug shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]"
            style={{ left: tipLeft, top: current.tipY - 8 }}
          >
            <p className="flex items-baseline gap-1 text-ink">
              <span className="num text-[15px] font-semibold">{fmt(current.d.value)}</span>
              {unit ? <span className="text-muted">{unit}</span> : null}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-ink-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: tone(current.d.value) }} />
              {current.d.label}
              {current.d.emphasis ? <span className="rounded-sm bg-marker px-1 text-[11px] font-semibold text-marker-ink">{emphasisLabel}</span> : null}
            </p>
            {current.d.note ? <p className="mt-0.5 text-[12px] text-muted">{current.d.note}</p> : null}
          </div>
        ) : null}
      </div>

      {orientation === "vertical" ? (
        <div
          aria-hidden="true"
          className="grid text-center text-[12.5px] leading-snug text-ink-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`, marginLeft: plotX0, marginRight: width - plotX1 }}
        >
          {data.map((d) => (
            <span key={d.id} className={`px-1 ${d.emphasis ? "font-semibold text-ink" : ""}`}>
              {d.label}
            </span>
          ))}
        </div>
      ) : null}

      {captions && orientation === "horizontal" ? (
        <div aria-hidden="true" className="mt-1 flex justify-between text-[12px] text-muted" style={{ marginLeft: plotX0 }}>
          <span>{captions.negative ? `← ${captions.negative}` : ""}</span>
          <span>{captions.positive ? `${captions.positive} →` : ""}</span>
        </div>
      ) : null}
      {captions && orientation === "vertical" ? (
        <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 flex flex-col justify-between text-[12px] leading-tight text-muted" style={{ height: svgH, width: plotX0 - 4 }}>
          <span className="pt-5">{captions.positive ? `↑ ${captions.positive}` : ""}</span>
          <span className="pb-5">{captions.negative ? `↓ ${captions.negative}` : ""}</span>
        </div>
      ) : null}
      {tableView ? (
        <details className="mt-2 text-[13px]">
          <summary className="w-fit cursor-pointer text-muted underline-offset-4 hover:text-ink hover:underline">표로 보기</summary>
          <table className="mt-2 w-full border-collapse">
            <caption className="sr-only">{tableView.caption ?? ariaLabel}</caption>
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="pb-1.5 font-[550]">
                  {tableView.categoryHeader}
                </th>
                <th scope="col" className="pb-1.5 pl-3 text-right font-[550]">
                  {tableView.valueHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-line">
                  <th scope="row" className={`py-1.5 text-left font-normal ${d.emphasis ? "font-semibold" : ""}`}>
                    {d.label}
                    {d.emphasis ? <span className="ml-1.5 rounded-sm bg-marker px-1 text-[11px] font-semibold text-marker-ink">{emphasisLabel}</span> : null}
                  </th>
                  <td className="num py-1.5 pl-3 text-right">{fmt(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
