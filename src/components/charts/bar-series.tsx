"use client";

import { useState, type KeyboardEvent } from "react";
import { formatSigned } from "@/lib/format";

export type BarDatum = { label: string; value: number; note?: string };

type Format = "krw" | "tco2" | "count";

const W = 560;
const H = 220;
const PAD = { top: 26, right: 12, bottom: 28, left: 52 };
const MAX_BAR = 24;
const MINUS = "−";

/** 축 눈금: 0을 포함하는 1·2·5 × 10^k 간격 */
function niceTicks(min: number, max: number, target = 4) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function compact(value: number, format: Format) {
  const sign = value < 0 ? MINUS : "";
  const abs = Math.abs(value);
  if (format === "krw") {
    if (abs >= 100_000_000) return `${sign}${trim(abs / 100_000_000)}억`;
    if (abs >= 10_000) return `${sign}${trim(abs / 10_000)}만`;
    return `${sign}${abs.toLocaleString("ko-KR")}`;
  }
  if (format === "tco2") return `${sign}${trim(abs)}`;
  return `${sign}${abs.toLocaleString("ko-KR")}`;
}

function trim(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function full(value: number, format: Format, signed: boolean) {
  if (format === "krw") return `${signed ? formatSigned(value) : Math.round(value).toLocaleString("ko-KR")}원`;
  if (format === "tco2") return `${signed ? formatSigned(value, 2) : value.toFixed(2)} tCO₂e`;
  return `${value.toLocaleString("ko-KR")}건`;
}

/** 아래(또는 위)는 각지고, 값 끝만 4px 둥근 막대 */
function barPath(x: number, w: number, y0: number, y1: number) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const r = Math.min(4, h, w / 2);
  const d = y1 < y0 ? 1 : -1; // 1: 위로 자람
  return [
    `M${x},${y0}`,
    `L${x},${y1 + d * r}`,
    `Q${x},${y1} ${x + r},${y1}`,
    `L${x + w - r},${y1}`,
    `Q${x + w},${y1} ${x + w},${y1 + d * r}`,
    `L${x + w},${y0}`,
    "Z",
  ].join(" ");
}

/**
 * 세로 막대 한 계열. signed면 손익 발산형(0 위는 chart-gain, 아래는 chart-loss, 값에는 부호),
 * 아니면 먹 계열 한 색. 막대에 마우스를 올리거나 차트에 포커스한 뒤 ←/→로 값을 볼 수 있다.
 */
export function BarSeries({
  data,
  format,
  signed = false,
  ariaLabel,
}: {
  data: BarDatum[];
  format: Format;
  signed?: boolean;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values, 0), Math.max(...values, 0));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo || 1)) * plotH;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(MAX_BAR, band * 0.6);
  const zeroY = y(0);

  // 값은 마지막 막대와 가장 큰 막대에만 직접 붙인다
  const last = data.length - 1;
  const maxIdx = values.reduce((best, v, i) => (Math.abs(v) > Math.abs(values[best] ?? 0) ? i : best), 0);
  const labeled = new Set([last, maxIdx]);

  const color = (v: number) => (!signed ? "var(--color-ink-2)" : v >= 0 ? "var(--color-chart-gain)" : "var(--color-chart-loss)");

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowRight") setActive((i) => Math.min(last, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? data.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const a = active !== null ? data[active] : null;
  const ax = active !== null ? PAD.left + band * active + band / 2 : 0;

  return (
    <div
      className="relative rounded-sm"
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      aria-label={`${ariaLabel}. 왼쪽·오른쪽 화살표로 달마다 값을 볼 수 있습니다.`}
      role="group"
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--color-chart-zero)" : "var(--color-line)"} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)" style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              {compact(t, format)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const y1 = y(d.value);
          const isActive = active === i;
          return (
            <g key={d.label}>
              <path d={barPath(x, barW, zeroY, y1)} fill={color(d.value)} opacity={active === null || isActive ? 1 : 0.55} />
              <text x={PAD.left + band * i + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                {d.label}
              </text>
              {labeled.has(i) && d.value !== 0 ? (
                <text
                  x={PAD.left + band * i + band / 2}
                  y={d.value >= 0 ? y1 - 6 : y1 + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--color-ink)"
                  style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
                >
                  {signed ? (d.value > 0 ? "+" : "") + compact(d.value, format) : compact(d.value, format)}
                </text>
              ) : null}
              {/* 칸 전체를 마우스 대상 영역으로 쓴다 */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {a ? (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.4)]"
          style={{ left: `${(ax / W) * 100}%` }}
        >
          <p className="font-semibold whitespace-nowrap text-ink tabular-nums">{full(a.value, format, signed)}</p>
          <p className="whitespace-nowrap text-muted">
            {a.label}
            {a.note ? ` · ${a.note}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
