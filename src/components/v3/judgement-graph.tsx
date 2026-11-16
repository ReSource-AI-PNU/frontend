"use client";

import { useState } from "react";
import type { EdgeStatus, GraphEdge, GraphNode } from "@/lib/v3/types";
import { useV3 } from "./context";

const COLUMNS: GraphNode["type"][] = ["stream", "criterion", "vendor", "evidence"];
const COLUMN_LABEL = { stream: "흐름", criterion: "기준", vendor: "업체", evidence: "근거 문서" };
const STROKE: Record<EdgeStatus, { color: string; dash?: string; label: string; tone: string }> = {
  // 초록은 이익 숫자에만 쓴다. 충족은 먹색 실선, 조건부는 긴 점선, 불충족은 짧은 점선이다.
  met: { color: "var(--color-ink)", label: "충족", tone: "text-ink" },
  conditional: { color: "var(--color-warn)", dash: "7 5", label: "조건부", tone: "text-warn" },
  unmet: { color: "var(--color-loss)", dash: "2 5", label: "불충족", tone: "text-loss" },
};

const W = 860;
const NODE_W = 156;
const NODE_H = 44;
const TOP = 34;
const GAP = 14;
const LINE = 12; // 한 줄에 넣는 글자 수

/** 노드 이름을 두 줄까지 나눠 적는다. 넘치면 말줄임표를 붙인다(전체 이름은 title로 남는다). */
function lines(label: string): string[] {
  if (label.length <= LINE) return [label];
  const second = label.slice(LINE);
  return [label.slice(0, LINE), second.length > LINE ? `${second.slice(0, LINE - 1)}…` : second];
}

/**
 * 판단 그래프. 뷰가 갱신되면 노드와 엣지가 그대로 다시 그려진다.
 * 색만으로 구분하지 않도록 선 모양과 범례를 함께 쓴다. 선이 많아 겹치므로 선의 설명은
 * 노드를 골랐을 때만 그리고, 고른 노드와 이어진 판단을 아래에 목록으로 풀어 적는다.
 */
export function JudgementGraph({ nodes, edges: rawEdges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const { openEvidence } = useV3();
  const [picked, setPicked] = useState<string | null>(null);
  if (nodes.length === 0) {
    return <p className="p-5 text-sm text-muted">아직 판단한 내용이 없습니다.</p>;
  }
  // 같은 판단이 여러 번 실려 오면 한 번만 그린다
  const seen = new Set<string>();
  const edges = rawEdges.filter((edge) => {
    const key = [edge.from, edge.to, edge.kind, edge.status, edge.label].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const focus = picked && byId.has(picked) ? picked : null;
  const direct = focus ? edges.filter((edge) => edge.from === focus || edge.to === focus) : [];
  // 고른 흐름이 거친 기준에서 업체로 가는 선까지 함께 보여 준다
  const via = new Set(
    direct
      .map((edge) => (edge.from === focus ? edge.to : edge.from))
      .filter((id) => byId.get(id)?.type === "criterion"),
  );
  const related = focus
    ? edges.filter((edge) => direct.includes(edge) || (via.has(edge.from) && byId.get(edge.to)?.type === "vendor"))
    : [];
  const lit = new Set(related);

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
  const name = (id: string) => byId.get(id)?.label ?? id;

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
          // 왼쪽 열에서 오른쪽 열로 그린다
          const forward = from.x <= to.x;
          const a = forward ? from : to;
          const b = forward ? to : from;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          const path = `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
          const on = lit.has(edge);
          return (
            <g
              key={`${edge.from}-${edge.to}-${index}`}
              className={edge.evidence.length > 0 ? "cursor-pointer" : ""}
              opacity={focus && !on ? 0.1 : 1}
              onClick={() => openEvidence(edge.evidence, edge.label || style.label)}
            >
              <path d={path} fill="none" stroke={style.color} strokeWidth={on ? 2.5 : 1.5} strokeDasharray={style.dash}>
                <title>{`${name(edge.from)} → ${name(edge.to)} · ${style.label}${edge.label ? `: ${edge.label}` : ""}`}</title>
              </path>
              <path d={path} fill="none" stroke="transparent" strokeWidth="12" />
            </g>
          );
        })}
        {nodes.map((node) => {
          const at = position.get(node.id);
          if (!at) return null;
          const isEvidence = node.type === "evidence";
          const text = lines(node.label);
          const dim = focus && focus !== node.id && !related.some((edge) => edge.from === node.id || edge.to === node.id);
          const dark = node.type === "vendor";
          return (
            <g
              key={node.id}
              className="cursor-pointer"
              opacity={dim ? 0.25 : 1}
              onClick={() =>
                isEvidence ? openEvidence([node.id], node.label) : setPicked(focus === node.id ? null : node.id)
              }
            >
              <title>{node.label}</title>
              <rect
                x={at.x}
                y={at.y}
                width={NODE_W}
                height={NODE_H}
                rx={dark ? 0 : node.type === "stream" ? NODE_H / 2 : 6}
                fill={dark ? "var(--color-ink)" : "var(--color-surface)"}
                stroke={isEvidence ? "var(--color-line-strong)" : "var(--color-ink)"}
                strokeWidth={focus === node.id ? 3 : 1}
                strokeDasharray={isEvidence ? "3 3" : undefined}
              />
              {text.map((line, index) => (
                <text
                  key={index}
                  x={at.x + NODE_W / 2}
                  y={at.y + NODE_H / 2 + 4 + (index - (text.length - 1) / 2) * 14}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="600"
                  fill={dark ? "var(--color-on-ink)" : "var(--color-ink)"}
                >
                  {line}
                </text>
              ))}
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
      </ul>
      {focus ? (
        <div className="mt-3 rounded-md border border-line p-3">
          <p className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>
              <span className="font-semibold">{name(focus)}</span>와(과) 이어진 판단 {related.length}건
            </span>
            <button type="button" className="font-semibold underline" onClick={() => setPicked(null)}>
              전체 보기
            </button>
          </p>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {related.map((edge, index) => (
              <li key={index} className="grid grid-cols-[3.5rem_1fr_auto] gap-x-2 py-1.5">
                <span className={`font-semibold ${STROKE[edge.status].tone}`}>{STROKE[edge.status].label}</span>
                <span className="min-w-0">
                  <span className="text-muted">
                    {name(edge.from)} → {name(edge.to)}
                  </span>
                  {edge.label ? <span className="block">{edge.label}</span> : null}
                </span>
                {edge.evidence.length > 0 ? (
                  <button
                    type="button"
                    className="self-start underline decoration-dotted underline-offset-4"
                    onClick={() => openEvidence(edge.evidence, edge.label || STROKE[edge.status].label)}
                  >
                    근거
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted">
          흐름·기준·업체를 누르면 그것과 이어진 판단만 남기고 설명을 보여 줍니다. 선이나 근거 문서를 누르면 근거가
          열립니다.
        </p>
      )}
    </div>
  );
}
