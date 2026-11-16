"use client";

import type { EdgeStatus, GraphEdge, GraphNode } from "@/lib/v3/types";
import { useV3 } from "./context";

const COLUMNS: GraphNode["type"][] = ["stream", "criterion", "vendor", "evidence"];
const COLUMN_LABEL = { stream: "흐름", criterion: "기준", vendor: "업체", evidence: "근거 문서" };
const STROKE: Record<EdgeStatus, { color: string; dash?: string; label: string }> = {
  // 초록은 이익 숫자에만 쓴다. 충족은 먹색 실선, 조건부는 긴 점선, 불충족은 짧은 점선이다.
  met: { color: "var(--color-ink)", label: "충족" },
  conditional: { color: "var(--color-warn)", dash: "7 5", label: "조건부" },
  unmet: { color: "var(--color-loss)", dash: "2 5", label: "불충족" },
};

const W = 720;
const NODE_W = 132;
const NODE_H = 38;
const TOP = 34;
const GAP = 16;

/** 판단 그래프. 뷰가 갱신되면 노드와 엣지가 그대로 다시 그려진다. 색만으로 구분하지 않도록 선 모양과 범례를 함께 쓴다. */
export function JudgementGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const { openEvidence } = useV3();
  if (nodes.length === 0) {
    return <p className="p-5 text-sm text-muted">아직 판단한 내용이 없습니다.</p>;
  }
  const byColumn = COLUMNS.map((type) => nodes.filter((node) => node.type === type));
  const rows = Math.max(...byColumn.map((column) => column.length), 1);
  const height = TOP + rows * (NODE_H + GAP) + 8;
  const colX = (index: number) => (index * (W - NODE_W)) / (COLUMNS.length - 1);
  const position = new Map<string, { x: number; y: number }>();
  byColumn.forEach((column, columnIndex) => {
    const offset = ((rows - column.length) * (NODE_H + GAP)) / 2;
    column.forEach((node, rowIndex) => {
      position.set(node.id, {
        x: colX(columnIndex),
        y: TOP + offset + rowIndex * (NODE_H + GAP),
      });
    });
  });

  return (
    <div className="p-4">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label="흐름, 기준, 업체, 근거 문서 사이의 판단 그래프"
        className="h-auto w-full"
      >
        {COLUMNS.map((type, index) => (
          <text
            key={type}
            x={colX(index) + NODE_W / 2}
            y={16}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-muted)"
          >
            {COLUMN_LABEL[type]}
          </text>
        ))}
        {edges.map((edge, index) => {
          const from = position.get(edge.from);
          const to = position.get(edge.to);
          if (!from || !to) return null;
          const style = STROKE[edge.status];
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <g
              key={`${edge.from}-${edge.to}-${index}`}
              className={edge.evidence.length > 0 ? "cursor-pointer" : ""}
              onClick={() => openEvidence(edge.evidence, edge.label || style.label)}
            >
              <path
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke={style.color}
                strokeWidth="2"
                strokeDasharray={style.dash}
              >
                <title>{`${style.label}${edge.label ? `: ${edge.label}` : ""}`}</title>
              </path>
              <path d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} fill="none" stroke="transparent" strokeWidth="14" />
              {edge.label ? (
                <text
                  x={mid}
                  y={(y1 + y2) / 2 - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-ink-2)"
                  stroke="var(--color-surface)"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {nodes.map((node) => {
          const at = position.get(node.id);
          if (!at) return null;
          const isEvidence = node.type === "evidence";
          const label = node.label.length > 11 ? `${node.label.slice(0, 10)}…` : node.label;
          return (
            <g
              key={node.id}
              className={isEvidence ? "cursor-pointer" : ""}
              onClick={isEvidence ? () => openEvidence([node.id], node.label) : undefined}
            >
              <rect
                x={at.x}
                y={at.y}
                width={NODE_W}
                height={NODE_H}
                rx={node.type === "vendor" ? 0 : node.type === "stream" ? 19 : 6}
                fill={node.type === "vendor" ? "var(--color-ink)" : "var(--color-surface)"}
                stroke={isEvidence ? "var(--color-line-strong)" : "var(--color-ink)"}
                strokeDasharray={isEvidence ? "3 3" : undefined}
              />
              <text
                x={at.x + NODE_W / 2}
                y={at.y + NODE_H / 2 + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill={node.type === "vendor" ? "var(--color-on-ink)" : "var(--color-ink)"}
              >
                <title>{node.label}</title>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {(Object.keys(STROKE) as EdgeStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-2">
            <svg width="34" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="34"
                y2="4"
                stroke={STROKE[status].color}
                strokeWidth="2"
                strokeDasharray={STROKE[status].dash}
              />
            </svg>
            {STROKE[status].label}
          </li>
        ))}
        <li className="text-muted">선이나 근거 문서를 누르면 근거가 열립니다.</li>
      </ul>
    </div>
  );
}
