"use client";

import { useState } from "react";
import { COLUMN_X, NODE_H, NODE_W, WIDTH, dedupeEdges, layoutGraph } from "@/lib/v3/graph-layout";
import { EDGE_KIND_LABEL } from "@/lib/v3/format";
import type { EdgeStatus, GraphEdge, GraphNode } from "@/lib/v3/types";
import { useV3 } from "./context";

const COLUMNS: GraphNode["type"][] = ["stream", "criterion", "vendor", "evidence"];
const COLUMN_LABEL = { stream: "폐기물", criterion: "기준", vendor: "업체", evidence: "근거 문서" };
/**
 * 상태는 선 모양으로 가른다(색은 거든다). 충족은 실선, 조건부는 점선, 불충족은 가는 점선에 ✕ 표시.
 * 초록은 이익 숫자에만 쓰므로 충족은 먹색이다.
 */
const STROKE: Record<EdgeStatus, { color: string; dash?: string; width: number; label: string; tone: string }> = {
  met: { color: "var(--color-ink)", width: 1.5, label: "충족", tone: "text-ink" },
  conditional: { color: "var(--color-warn)", dash: "7 4", width: 1.5, label: "조건부", tone: "text-warn" },
  unmet: { color: "var(--color-loss)", dash: "1.5 4", width: 1, label: "불충족", tone: "text-loss" },
};
/** 노드가 이보다 많으면 근거 문서 열을 접어 둔다 */
const COLLAPSE_AT = 10;
const LINE = 13; // 한 줄에 넣는 글자 수

/** 노드 이름을 두 줄까지 나눠 적는다. 넘치면 말줄임표를 붙인다(전체 이름은 title로 남는다). */
function lines(label: string): string[] {
  if (label.length <= LINE) return [label];
  const second = label.slice(LINE);
  return [label.slice(0, LINE), second.length > LINE ? `${second.slice(0, LINE - 1)}…` : second];
}

/**
 * 판단 그래프. 뷰가 갱신되면 노드와 엣지가 그대로 다시 그려진다.
 * 기본 상태에서는 흐름 → 기준 → 업체의 대조 선과, 받지 못하는 이유(허가 품목 없음, 자동 거절)만 그린다.
 * 기준을 거친 흐름의 "허가 품목 일치"처럼 같은 길을 되풀이하는 선은 그리지 않고 노드를 골랐을 때 목록으로 보여 준다.
 * 근거 문서 열은 노드가 많으면 접어 두고, 노드를 고르면 그 노드의 근거 문서만 편다.
 */
export function JudgementGraph({ nodes, edges: rawEdges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const { openEvidence } = useV3();
  const [picked, setPicked] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  if (nodes.length === 0) {
    return <p className="p-5 text-sm text-muted">아직 판단한 내용이 없습니다.</p>;
  }
  const edges = dedupeEdges(rawEdges);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const typeOf = (id: string) => byId.get(id)?.type;
  const name = (id: string) => byId.get(id)?.label ?? id;
  const focus = picked && byId.has(picked) ? picked : null;

  const direct = focus ? edges.filter((edge) => edge.from === focus || edge.to === focus) : [];
  // 고른 흐름이 거친 기준에서 업체로 가는 선, 고른 업체의 기준으로 오는 흐름의 선까지 함께 보여 준다
  const via = new Set(
    direct.map((edge) => (edge.from === focus ? edge.to : edge.from)).filter((id) => typeOf(id) === "criterion"),
  );
  const related = focus
    ? edges.filter(
        (edge) =>
          direct.includes(edge) ||
          (typeOf(focus) === "stream" && via.has(edge.from) && typeOf(edge.to) === "vendor") ||
          (typeOf(focus) === "vendor" && via.has(edge.to) && typeOf(edge.from) === "stream"),
      )
    : [];
  const lit = new Set(related);
  const litNodes = new Set(related.flatMap((edge) => [edge.from, edge.to]));

  const evidenceNodes = nodes.filter((node) => node.type === "evidence");
  const collapsible = evidenceNodes.length > 0 && nodes.length > COLLAPSE_AT;
  const collapsed = collapsible && !expanded;
  const shownEvidence = collapsed
    ? evidenceNodes.filter((node) => direct.some((edge) => edge.from === node.id || edge.to === node.id))
    : evidenceNodes;
  const shownIds = new Set(shownEvidence.map((node) => node.id));

  const layout = layoutGraph(nodes, edges, shownEvidence);
  const { position, lane } = layout;
  const height = layout.height;
  const right = (id: string) => {
    const at = position.get(id);
    return at ? { x: at.x + NODE_W, y: at.y + NODE_H / 2 } : null;
  };
  const left = (id: string) => {
    const at = position.get(id);
    return at ? { x: at.x, y: at.y + NODE_H / 2 } : null;
  };

  /** 그릴 선과 그 길. 그리지 않는 선은 null */
  const drawn = edges.flatMap((edge) => {
    const from = typeOf(edge.from);
    const to = typeOf(edge.to);
    const a = right(edge.from);
    const b = left(edge.to);
    const pair = `${edge.from}|${edge.to}`;
    if (to === "evidence" && !shownIds.has(edge.to)) return [];
    if (!a || !b) return [];
    let path: string;
    let mark: { x: number; y: number } | null = null;
    let assigned = false;
    if (from === "stream" && to === "vendor") {
      // 기준을 거친 길이 있으면 그 길이 같은 내용을 보여 준다. 받지 못하는 이유만 따로 그린다
      if (edge.status !== "unmet" && layout.viaCriterion.has(pair)) return [];
      assigned = edge.kind === "assignment";
      const y = lane.get(edge.to) ?? b.y;
      const x0 = COLUMN_X.criterion - 6;
      const x1 = COLUMN_X.criterion + NODE_W + 6;
      const m0 = (a.x + x0) / 2;
      const m1 = (x1 + b.x) / 2;
      path = `M${a.x},${a.y} C${m0},${a.y} ${m0},${y} ${x0},${y} L${x1},${y} C${m1},${y} ${m1},${b.y} ${b.x},${b.y}`;
      // 같은 업체로 가는 선은 이 길에서 모이므로 ✕ 표시도 길 가운데 한 곳에 둔다
      mark = { x: (x0 + x1) / 2, y };
    } else if (from === "stream" && to === "evidence") {
      // 조항은 고른 흐름에서만 그린다. 맨 아래 길로 돌아가 다른 노드를 가로지르지 않는다
      if (focus !== edge.from) return [];
      const y = layout.rail;
      path = `M${a.x},${a.y} C${a.x + 44},${a.y} ${a.x + 22},${y} ${a.x + 66},${y} L${b.x - 66},${y} C${b.x - 22},${y} ${b.x - 44},${b.y} ${b.x},${b.y}`;
    } else {
      const mid = (a.x + b.x) / 2;
      path = `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
      mark = { x: mid, y: (a.y + b.y) / 2 };
      if (from === "stream" && to === "criterion") {
        const vendor = layout.vendorOf.get(edge.to);
        assigned = Boolean(vendor && layout.assigned.has(`${edge.from}|${vendor}`));
      }
      if (from === "criterion" && to === "vendor") {
        assigned = edges.some(
          (other) => other.to === edge.from && typeOf(other.from) === "stream" && layout.assigned.has(`${other.from}|${edge.to}`),
        );
      }
    }
    return [{ edge, path, mark: edge.status === "unmet" ? mark : null, assigned }];
  });

  const hiddenEvidence = evidenceNodes.length - shownEvidence.length;

  return (
    <div className="p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label="폐기물, 기준, 업체, 근거 문서 사이의 판단 그래프"
        className="h-auto w-full"
      >
        {COLUMNS.map((type) => (
          <text
            key={type}
            x={COLUMN_X[type] + NODE_W / 2}
            y={14}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-muted)"
          >
            {COLUMN_LABEL[type]}
          </text>
        ))}
        {drawn.map(({ edge, path, mark, assigned }, index) => {
          const style = STROKE[edge.status];
          const on = lit.has(edge);
          return (
            <g
              key={`${edge.from}-${edge.to}-${index}`}
              className={edge.evidence.length > 0 ? "cursor-pointer" : ""}
              opacity={focus && !on ? 0.07 : 1}
              onClick={() => openEvidence(edge.evidence, edge.label || style.label)}
            >
              <path
                d={path}
                fill="none"
                stroke={style.color}
                strokeWidth={assigned ? 3.2 : on ? style.width + 0.8 : style.width}
                strokeDasharray={style.dash}
                strokeLinecap="round"
              >
                <title>{`${name(edge.from)} → ${name(edge.to)} · ${style.label}${assigned ? " · 최적안 배정" : ""}${edge.label ? `: ${edge.label}` : ""}`}</title>
              </path>
              {mark ? (
                <g stroke={style.color} strokeWidth="1.6" strokeLinecap="round">
                  <circle cx={mark.x} cy={mark.y} r="6.5" fill="var(--color-surface)" strokeWidth="1" />
                  <line x1={mark.x - 2.8} y1={mark.y - 2.8} x2={mark.x + 2.8} y2={mark.y + 2.8} />
                  <line x1={mark.x - 2.8} y1={mark.y + 2.8} x2={mark.x + 2.8} y2={mark.y - 2.8} />
                </g>
              ) : null}
              <path d={path} fill="none" stroke="transparent" strokeWidth="12" />
            </g>
          );
        })}
        {nodes.map((node) => {
          const at = position.get(node.id);
          const isEvidence = node.type === "evidence";
          if (!at || (isEvidence && !shownIds.has(node.id))) return null;
          const text = lines(node.label);
          const dim = focus && focus !== node.id && !litNodes.has(node.id);
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
        {collapsed && hiddenEvidence > 0 ? (
          <g className="cursor-pointer" onClick={() => setExpanded(true)}>
            <title>근거 문서 열 펴기</title>
            <rect
              x={COLUMN_X.evidence}
              y={shownEvidence.length > 0 ? height - 46 : (height - 44) / 2 + 8}
              width={NODE_W}
              height={shownEvidence.length > 0 ? 24 : 44}
              rx={6}
              fill="var(--color-sunken)"
              stroke="var(--color-line-strong)"
              strokeDasharray="3 3"
            />
            <text
              x={COLUMN_X.evidence + NODE_W / 2}
              y={shownEvidence.length > 0 ? height - 30 : (height - 44) / 2 + 26}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-ink-2)"
            >
              {shownEvidence.length > 0 ? `그 밖의 근거 문서 ${hiddenEvidence}건` : `근거 문서 ${hiddenEvidence}건 접어 둠`}
            </text>
            {shownEvidence.length > 0 ? null : (
              <text
                x={COLUMN_X.evidence + NODE_W / 2}
                y={(height - 44) / 2 + 42}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--color-muted)"
              >
                노드를 누르면 그 근거만 폅니다
              </text>
            )}
          </g>
        ) : null}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {(Object.keys(STROKE) as EdgeStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-2">
            <svg width="40" height="14" aria-hidden="true">
              <line
                x1="1"
                y1="7"
                x2="39"
                y2="7"
                stroke={STROKE[status].color}
                strokeWidth={STROKE[status].width + 0.5}
                strokeDasharray={STROKE[status].dash}
                strokeLinecap="round"
              />
              {status === "unmet" ? (
                <g stroke={STROKE[status].color} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="20" cy="7" r="5.5" fill="var(--color-surface)" strokeWidth="1" />
                  <line x1="17.6" y1="4.6" x2="22.4" y2="9.4" />
                  <line x1="17.6" y1="9.4" x2="22.4" y2="4.6" />
                </g>
              ) : null}
            </svg>
            {STROKE[status].label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <svg width="40" height="14" aria-hidden="true">
            <line x1="1" y1="7" x2="39" y2="7" stroke="var(--color-ink)" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          굵은 선은 최적안 배정
        </span>
        {collapsible ? (
          <button
            type="button"
            className="ml-auto font-semibold underline underline-offset-4"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "근거 문서 열 접기" : `근거 문서 열 펴기 (${evidenceNodes.length}건)`}
          </button>
        ) : null}
      </div>
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
                    {EDGE_KIND_LABEL[edge.kind] ? ` · ${EDGE_KIND_LABEL[edge.kind]}` : ""}
                  </span>
                  {edge.label ? <span className="block">{edge.label}</span> : null}
                </span>
                {edge.evidence.length > 0 ? (
                  <button
                    type="button"
                    className="self-start underline underline-offset-4"
                    onClick={() => openEvidence(edge.evidence, edge.label || STROKE[edge.status].label)}
                  >
                    근거 {edge.evidence.length}건
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
          폐기물·기준·업체를 누르면 그것과 이어진 판단만 남기고 설명과 근거 문서를 보여 줍니다. 기준을 거친 폐기물의
          &ldquo;허가 품목 일치&rdquo;는 선으로 그리지 않고 그 목록에 적습니다. 선이나 근거 문서를 누르면 근거가 열립니다.
        </p>
      )}
    </div>
  );
}
