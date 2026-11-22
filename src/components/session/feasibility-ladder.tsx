"use client";

import { useState } from "react";
import { formatSigned } from "@/lib/format";

/**
 * 작업 단계별 kg당 손익 (발산형 세로 막대). dataviz 규칙: 0 기준선에서 시작, 데이터 끝만 4px 둥글게,
 * 값 라벨은 먹색 글자 + 부호(색만으로 구분하지 않음), 막대 사이 간격, hover 툴팁, 표 보기.
 */
export function FeasibilityLadder({ ladder }: { ladder: { label: string; perKg: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 240;
  const pad = { top: 28, bottom: 60, left: 8, right: 8 };
  const max = Math.max(...ladder.map((l) => l.perKg), 0);
  const min = Math.min(...ladder.map((l) => l.perKg), 0);
  const span = max - min || 1;
  const y = (v: number) => pad.top + ((max - v) / span) * (H - pad.top - pad.bottom);
  const zero = y(0);
  const slot = (W - pad.left - pad.right) / ladder.length;
  const barW = Math.min(64, slot * 0.42);
  const r = 4;

  const summary = ladder.map((l) => `${l.label} ${formatSigned(l.perKg)}원/kg`).join(", ");

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`작업 단계별 kg당 손익: ${summary}`}>
        <line x1={pad.left} x2={W - pad.right} y1={zero} y2={zero} stroke="var(--color-chart-zero)" strokeWidth={1} />
        <text x={W - pad.right} y={zero - 6} textAnchor="end" className="fill-muted text-[12px]">
          0원
        </text>
        {ladder.map((l, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const top = Math.min(y(l.perKg), zero);
          const h = Math.max(1, Math.abs(y(l.perKg) - zero));
          const gain = l.perKg >= 0;
          const x = cx - barW / 2;
          // 데이터 끝(기준선 반대쪽)만 둥글게
          const path = gain
            ? `M${x},${zero} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${zero} Z`
            : `M${x},${zero} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + barW - r} Q${x + barW},${top + h} ${x + barW},${top + h - r} V${zero} Z`;
          const labelY = gain ? top - 8 : top + h + 16;
          return (
            <g key={l.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - slot / 2} y={pad.top - 20} width={slot} height={H - pad.top} fill="transparent" />
              <path d={path} fill={gain ? "var(--color-chart-gain)" : "var(--color-chart-loss)"} opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={cx} y={labelY} textAnchor="middle" className="num fill-ink text-[13px] font-semibold">
                {formatSigned(l.perKg)}
              </text>
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-2 text-[12px]">
                {l.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 rounded-md bg-ink px-2.5 py-1.5 text-[12px] text-on-ink"
          style={{ left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          {ladder[hover].label} · <span className="num">{formatSigned(ladder[hover].perKg)}</span>원/kg
        </div>
      ) : null}
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-muted">표로 보기</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">작업 단계별 kg당 손익</caption>
          <tbody>
            {ladder.map((l) => (
              <tr key={l.label} className="border-t border-line">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {l.label}
                </th>
                <td className="num py-1.5 text-right">{formatSigned(l.perKg)}원/kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
