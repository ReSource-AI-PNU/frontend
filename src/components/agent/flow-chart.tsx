"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useV3 } from "@/components/v3/context";
import { bandPath, GRADE_ORDER, gradeKey, gradeLabel, layoutFlow, NODE_W, ROUTE_NAME, type FlowInput, type GradeKey } from "@/lib/v3/flow";
import { formatNumber } from "@/lib/v3/format";
import type { Result, ViewStream } from "@/lib/v3/types";

/**
 * 처리 흐름도: 폐기물 → 오염 등급 → 처리 방식 → 받는 곳. 띠 굵기는 한 달 발생량이고 색은 오염 등급이다.
 * 띠에 마우스를 올리거나 키보드로 고르면 그 폐기물의 길만 밝히고 값을 보이며, 누르면 근거(발생량·등급)가 열린다.
 * 같은 내용을 화면 낭독기용 표로도 둔다.
 */

const GRADE_COLOR: Record<GradeKey, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  등외: "var(--color-grade-d)",
  "확인 필요": "var(--color-grade-unknown)",
};
const COLUMN_TITLE = ["폐기물", "오염 등급", "처리 방식", "받는 곳"];
const TOP = 26;

/** 회사 이름의 법인 표시를 뗀다(그림의 좁은 칸용). 표와 툴팁에는 원래 이름을 쓴다 */
function shortName(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, "").trim() || name;
}

/** 칸 너비(px)에 들어가게 글자 수를 줄인다. 한글 한 글자를 글꼴 크기만큼으로 어림한다 */
function fit(text: string, room: number, size: number): string {
  const max = Math.max(3, Math.floor((room - 10) / size));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

type Row = FlowInput & {
  stream: ViewStream;
  kgText: string;
  gradeText: string;
  evidence: string[];
};

function rowsOf(result: Result, streams: ViewStream[]): Row[] {
  return streams.map((stream) => {
    const assignment = result.assignments.find((item) => item.streamId === stream.id);
    const kg = typeof stream.monthlyKg?.value === "number" ? stream.monthlyKg.value : null;
    const grade = gradeKey(stream.grade.value);
    const basis = stream.grade.basis === "photo_estimate" ? " (사진 추정)" : stream.grade.basis === "measured" ? " (측정)" : "";
    return {
      id: stream.id,
      name: stream.name ?? stream.label,
      kg,
      grade: stream.grade.value,
      route: assignment?.route ?? null,
      receiver: assignment?.vendorName ?? null,
      stream,
      kgText: kg != null ? `한 달 ${formatNumber(kg)} kg` : "발생량 확인 필요",
      gradeText: `${gradeLabel(grade)}${grade === "확인 필요" ? "" : basis}`,
      evidence: [...(stream.monthlyKg?.evidence ?? []), ...stream.grade.evidence],
    };
  });
}

export function FlowChart({ result, streams }: { result: Result; streams: ViewStream[] }) {
  const { openEvidence } = useV3();
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(680);
  const [focus, setFocus] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => rowsOf(result, streams), [result, streams]);
  const narrow = width < 560;
  const gutterL = narrow ? 82 : 116;
  const gutterR = narrow ? 86 : 124;
  const height = Math.max(narrow ? 220 : 240, rows.length * (narrow ? 52 : 60));
  const flow = useMemo(() => layoutFlow(rows, width - gutterL - gutterR, height), [rows, width, gutterL, gutterR, height]);
  const active = focus?.id ?? null;
  const shown = rows.find((row) => row.id === active) ?? null;
  const grades = GRADE_ORDER.filter((grade) => rows.some((row) => gradeKey(row.grade) === grade));
  const label = narrow ? 11 : 12.5;

  return (
    <section aria-label="처리 흐름" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">처리 흐름</h2>
      <p className="mt-1.5 text-[14px] text-ink-2">
        폐기물마다 오염 등급과 처리 방식, 받는 곳을 한 그림으로 봅니다. 띠가 굵을수록 한 달에 많이 나옵니다.
      </p>
      <div ref={box} className="relative mt-4" onMouseLeave={() => setFocus(null)}>
        <svg
          role="img"
          aria-label="폐기물별 처리 흐름 그림"
          viewBox={`0 0 ${width} ${height + TOP}`}
          width="100%"
          height={height + TOP}
          className="block overflow-visible"
        >
          <g transform={`translate(${gutterL},${TOP})`}>
            {COLUMN_TITLE.map((title, i) => {
              const x = ((width - gutterL - gutterR - NODE_W) * i) / 3;
              return (
                <text
                  key={title}
                  x={i === 0 ? x + NODE_W : x}
                  y={-12}
                  textAnchor={i === 0 ? "end" : "start"}
                  fontSize={12}
                  fill="var(--color-muted)"
                >
                  {title}
                </text>
              );
            })}
            {flow.bands.map((band, i) => {
              const row = rows.find((item) => item.id === band.streamId)!;
              const dim = active !== null && active !== band.streamId;
              return (
                <path
                  key={`${band.streamId}-${band.column}-${i}`}
                  d={bandPath(band)}
                  fill={GRADE_COLOR[band.grade]}
                  opacity={dim ? 0.12 : active === band.streamId ? 0.92 : 0.55}
                  className="cursor-pointer transition-opacity duration-200 outline-none"
                  tabIndex={band.column === 0 ? 0 : -1}
                  aria-label={`${row.name}: ${row.kgText}, ${row.gradeText}, ${ROUTE_NAME[row.route ?? "none"] ?? "정해지지 않음"}`}
                  onMouseMove={(event) => {
                    const rect = box.current?.getBoundingClientRect();
                    if (rect)
                      setFocus({
                        id: band.streamId,
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                      });
                  }}
                  onFocus={() =>
                    setFocus({
                      id: band.streamId,
                      x: gutterL + band.x1,
                      y: band.y1 + TOP,
                    })
                  }
                  onBlur={() => setFocus(null)}
                  onClick={() => openEvidence(row.evidence, `${row.name}의 발생량과 등급`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEvidence(row.evidence, `${row.name}의 발생량과 등급`);
                    }
                  }}
                />
              );
            })}
            {flow.nodes.map((node) => {
              const dim =
                active !== null &&
                !flow.bands.some(
                  (band) =>
                    band.streamId === active &&
                    ((band.column === node.column && band.y0 >= node.y - 0.5 && band.y0 <= node.y + node.h) ||
                      (band.column === node.column - 1 && band.y1 >= node.y - 0.5 && band.y1 <= node.y + node.h)),
                );
              const fill =
                node.column === 1 && node.grade ? GRADE_COLOR[node.grade] : node.column === 3 ? "var(--color-ink)" : "var(--color-ink-2)";
              const left = node.column === 0;
              const right = node.column === 3;
              const tx = left ? node.x - 8 : right ? node.x + NODE_W + 8 : node.x + NODE_W + 6;
              return (
                <g key={node.key} opacity={dim ? 0.35 : 1} className="transition-opacity duration-200">
                  <rect x={node.x} y={node.y} width={NODE_W} height={Math.max(node.h, 2)} rx={3} fill={fill} />
                  <text
                    x={tx}
                    y={node.y + node.h / 2}
                    dominantBaseline="middle"
                    textAnchor={left ? "end" : "start"}
                    fontSize={label}
                    fontWeight={node.column === 1 || right ? 600 : 500}
                    fill="var(--color-ink)"
                    stroke="var(--color-bg)"
                    strokeWidth={node.column === 1 || node.column === 2 ? 4 : 0}
                    paintOrder="stroke"
                  >
                    {fit(
                      node.column === 3 ? shortName(node.label) : node.label,
                      left ? gutterL : right ? gutterR : (width - gutterL - gutterR) / 3 - 10,
                      label,
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {shown && focus ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
            style={{
              left: Math.min(focus.x + 14, width - 250),
              top: Math.max(focus.y - 70, 0),
            }}
          >
            <p className="font-semibold">{shown.name}</p>
            <p className="mt-0.5 tabular-nums text-ink-2">{shown.kgText}</p>
            <p className="text-ink-2">{shown.gradeText}</p>
            <p className="text-ink-2">
              {ROUTE_NAME[shown.route ?? "none"] ?? "정해지지 않음"}
              {shown.receiver && shown.route !== "reuse" ? ` → ${shown.receiver}` : ""}
            </p>
            <p className="mt-1 text-[12px] text-muted">눌러서 근거 보기</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
        <span className="text-muted">오염 등급</span>
        {grades.map((grade) => (
          <span key={grade} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm" style={{ background: GRADE_COLOR[grade] }} />
            {gradeLabel(grade)}
          </span>
        ))}
        <span className="text-muted">· 진할수록 오염이 심합니다</span>
        {flow.unknownKg.length > 0 ? <span className="text-muted">· 발생량을 모르는 폐기물은 가는 띠로 그렸습니다</span> : null}
      </div>
      <div className="sr-only">
        <table>
          <caption>폐기물별 처리 흐름</caption>
          <thead>
            <tr>
              {COLUMN_TITLE.map((title) => (
                <th key={title} scope="col">
                  {title}
                </th>
              ))}
              <th scope="col">한 달 발생량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.gradeText}</td>
                <td>{ROUTE_NAME[row.route ?? "none"] ?? "정해지지 않음"}</td>
                <td>{row.route === "reuse" ? "우리 공장" : (row.receiver ?? "정해지지 않음")}</td>
                <td>{row.kgText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
