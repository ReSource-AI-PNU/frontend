"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/v3/api";
import {
  buildingRoles,
  edgeMarker,
  fullView,
  labelSize,
  missingLine,
  nodeLabel,
  partnerView,
  percentIn,
  planNodes,
  placeLabels,
  planSourceLine,
  projection,
  ROLE_LABEL,
  shortItem,
  type LabelSide,
  type PlanRole,
  type ViewBox,
} from "@/lib/v3/complex-plan";
import type { ComplexCandidate, ComplexPartners, ComplexPlan, ViewStream } from "@/lib/v3/types";
import { fetchBuildings, type PlanBuilding } from "@/lib/v3/vworld";

/** 이름표 자리(핀 단추 44px의 가운데 기준, 핀 반지름 10px + 틈 4px) */
const SIDE_CLASS: Record<LabelSide, string> = {
  right: "top-1/2 left-[calc(50%+14px)] -translate-y-1/2 text-left",
  left: "top-1/2 right-[calc(50%+14px)] -translate-y-1/2 text-right",
  top: "bottom-[calc(50%+14px)] left-1/2 -translate-x-1/2 text-center",
  bottom: "top-[calc(50%+14px)] left-1/2 -translate-x-1/2 text-center",
};

/** 브라우저가 VWorld 건물을 받지 못했을 때(해외 접속이나 VWorld 장애) */
const BUILDINGS_FAILED = "건물 도형을 받지 못해 건물 없이 위치만 그렸습니다. 국내 인터넷에서 다시 열면 건물이 보입니다.";

type Loaded = { plan: ComplexPlan | null; error: string | null };

/** 건물 칠: 바탕 건물은 옅은 선색, 우리 회사는 먹, 받는 곳은 진회색, 쓰는 곳은 흰 바탕에 진회색 테두리 */
const BUILDING_FILL: Record<PlanRole | "base", string> = {
  base: "var(--color-line)",
  self: "var(--color-ink)",
  takes: "var(--color-ink-2)",
  uses: "var(--color-surface)",
};

function Pin({ role, active }: { role: PlanRole; active: boolean }) {
  const ring = active ? "outline outline-2 outline-offset-2 outline-ink" : "";
  if (role === "self") return <span className={`block size-5 rounded-full bg-ink shadow-[0_0_0_3px_var(--color-surface)] ${ring}`} />;
  if (role === "takes")
    return (
      <span className="relative block size-3.5">
        {/* 우리 폐기물을 받아 줄 수 있는 곳: 고리가 천천히 퍼진다(움직임 줄이기면 멈춘 고리) */}
        <span aria-hidden="true" className="absolute -inset-1.5 rounded-full border-2 border-ink-2 opacity-40 [animation:rs-halo_2.4s_ease-out_infinite]" />
        <span className={`relative block size-3.5 rounded-[2px] border-2 border-surface bg-ink-2 ${ring}`} />
      </span>
    );
  return <span className={`block size-3.5 rounded-full border-2 border-ink-2 bg-surface ${ring}`} />;
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {(["self", "takes", "uses"] as const).map((role) => (
        <span key={role} className="inline-flex items-center gap-1.5">
          <Pin role={role} active={false} />
          {ROLE_LABEL[role]}
        </span>
      ))}
    </p>
  );
}

/**
 * 같은 단지 평면도: 실제 건물 도형 위에 우리 회사와 후보 회사를 찍는다. 우리 폐기물을 받아 줄 수 있는 곳은 고리가 퍼진다. 회사를 누르면 아래에 상세가 열린다.
 * 지도 자료는 열 때마다 서버가 실시간으로 받는다(저장하지 않는다). 목록이 같은 내용을 글로 갖고 있어 지도는 보조다.
 */
export function ComplexPlanView({
  partners,
  streams,
  sessionId,
  orgId,
  renderDetail,
}: {
  partners: ComplexPartners;
  streams: ViewStream[];
  sessionId: string;
  orgId: string;
  /** 고른 회사의 상세 줄(목록의 줄과 같은 모양) */
  renderDetail: (candidate: ComplexCandidate, streamIds: string[]) => React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [near, setNear] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(box);
    return () => observer.disconnect();
  });

  useEffect(() => {
    let alive = true;
    api
      .complexPlan(sessionId, orgId)
      .then((plan) => alive && setLoaded({ plan, error: null }))
      .catch((reason: unknown) => {
        if (!alive) return;
        const message = reason instanceof ApiError ? reason.message : "평면도를 불러오지 못했습니다.";
        setLoaded({ plan: null, error: message });
      });
    return () => {
      alive = false;
    };
  }, [sessionId, orgId, attempt]);

  const plan = loaded?.plan ?? null;
  // 건물 도형은 브라우저가 VWorld에서 받는다(서버는 해외 IP라 끊긴다). 화면에만 쓰고 저장하지 않는다
  const [shapes, setShapes] = useState<{ plan: ComplexPlan; buildings: PlanBuilding[]; failed: boolean } | null>(null);
  useEffect(() => {
    const layer = plan?.buildingLayer;
    if (!plan || !plan.bbox || !layer) return;
    let alive = true;
    fetchBuildings(layer, plan.bbox)
      .then((buildings) => alive && setShapes({ plan, buildings, failed: false }))
      .catch(() => alive && setShapes({ plan, buildings: [], failed: true }));
    return () => {
      alive = false;
    };
  }, [plan]);
  const shown = shapes && shapes.plan === plan ? shapes : null;
  const shapesLoading = Boolean(plan?.buildingLayer && plan.bbox && !shown);
  const proj = useMemo(() => (plan ? projection(plan) : null), [plan]);
  const nodes = useMemo(
    () => (plan ? planNodes(plan, partners, streamId, shown?.buildings ?? []) : []),
    [plan, partners, streamId, shown],
  );
  const roles = useMemo(() => buildingRoles(nodes), [nodes]);
  const buildings = useMemo(
    () => (proj && shown ? shown.buildings.map((building) => ({ ...building, d: building.rings.map(proj.ring).join("") })) : []),
    [proj, shown],
  );

  const nameOf = (id: string) => streams.find((item) => item.id === id)?.name ?? "폐기물";
  // 폐기물 고르기: 후보가 같은 폐기물은 이름을 이어 한 단추로 둔다
  const filters = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const stream of partners.streams) {
      const key = [...stream.takes, ...stream.uses].map((item) => item.id).join("|");
      seen.set(key, [...(seen.get(key) ?? []), stream.streamId]);
    }
    return [...seen.values()];
  }, [partners]);

  if (!loaded) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-xl border border-line bg-ground text-[14px] text-muted" aria-busy="true">
        단지 평면도를 그리고 있습니다.
      </div>
    );
  }
  if (!plan || !proj) {
    return (
      <div className="rounded-xl border border-line bg-ground px-4 py-3 text-[14px] text-ink-2">
        <p>{loaded.error ?? "회사 위치를 찾지 못해 평면도를 그리지 못했습니다. 아래 목록에서 후보를 볼 수 있습니다."}</p>
        {loaded.error ? (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
            다시 시도
          </Button>
        ) : null}
      </div>
    );
  }

  const self = nodes.find((node) => node.role === "self") ?? null;
  const view: ViewBox = (near && partnerView(nodes, proj)) || fullView(proj);
  const picked = nodes.find((node) => node.id === selected) ?? null;
  const groupIds = (ids: string[]) => ids.join("|");
  const activeFilter = streamId ? (filters.find((ids) => ids.includes(streamId)) ?? [streamId]) : null;
  // 이름표: 고른 회사 → 우리 회사 → 받는 곳 → 쓰는 곳 순서로 빈 자리에 놓고, 놓을 곳이 없으면 숨긴다
  const boxHeight = boxWidth * (view.height / view.width);
  const order = [...nodes].sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  const sides: Map<string, LabelSide | null> = boxWidth
    ? placeLabels(
        order.flatMap((node) => {
          const at = percentIn(view, node.x, node.y);
          if (!at) return [];
          const size = labelSize(node.name, node.role === "self" ? null : shortItem(node.candidate));
          return [{ id: node.id, left: at.left, top: at.top, ...size, force: node.id === selected }];
        }),
        boxWidth,
        boxHeight,
      )
    : new Map();
  const selfEdge = self ? edgeMarker(view, self.x, self.y) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="폐기물 고르기" className="flex flex-wrap gap-1.5">
          <FilterButton active={!streamId} onClick={() => setStreamId(null)}>
            전체
          </FilterButton>
          {filters.map((ids) => (
            <FilterButton
              key={groupIds(ids)}
              active={Boolean(activeFilter && groupIds(activeFilter) === groupIds(ids))}
              onClick={() => setStreamId(ids[0])}
            >
              {ids.map(nameOf).join(" · ")}
            </FilterButton>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <FilterButton active={near} onClick={() => setNear(true)}>
            후보 주변
          </FilterButton>
          <FilterButton active={!near} onClick={() => setNear(false)}>
            우리 회사까지
          </FilterButton>
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative mt-3 w-full overflow-hidden rounded-xl border border-line bg-ground"
        style={{ aspectRatio: `${view.width} / ${view.height}` }}
      >
        <svg
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 size-full"
          role="img"
          aria-label={`${partners.complex?.name ?? "산업단지"} 평면도. 우리 회사와 후보 ${nodes.length - (self ? 1 : 0)}곳의 위치입니다. 같은 내용이 아래 목록에 있습니다.`}
        >
          {buildings.map((building, index) => {
            const role = building.id ? roles.get(building.id) : undefined;
            return (
              <path
                key={building.id ?? index}
                d={building.d}
                fill={BUILDING_FILL[role ?? "base"]}
                stroke={role === "uses" ? "var(--color-ink-2)" : role ? "none" : "var(--color-line-strong)"}
                strokeWidth={role === "uses" ? 1.5 : 0.6}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {nodes.map((node) => {
          const at = percentIn(view, node.x, node.y);
          if (!at) return null;
          const active = node.id === selected;
          const item = node.role === "self" ? null : shortItem(node.candidate);
          return (
            <button
              key={node.id}
              type="button"
              aria-label={nodeLabel(node)}
              aria-pressed={node.role === "self" ? undefined : active}
              disabled={node.role === "self"}
              onClick={() => setSelected(active ? null : node.id)}
              className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-default"
              style={{ left: `${at.left}%`, top: `${at.top}%`, zIndex: active ? 3 : node.role === "uses" ? 1 : 2 }}
            >
              <Pin role={node.role} active={active} />
              {sides.get(node.id) ? (
                <span
                  className={`pointer-events-none absolute ${SIDE_CLASS[sides.get(node.id) as LabelSide]} rounded-md bg-surface/90 px-1.5 py-0.5 text-[12px] leading-tight whitespace-nowrap shadow-[0_0_0_1px_var(--color-line)] ${active ? "font-semibold text-ink" : "text-ink-2"}`}
                >
                  {node.name}
                  {item ? <span className="block text-[12px] font-normal text-muted">{item}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
        {selfEdge ? (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-on-ink"
            style={{ left: `clamp(52px, ${selfEdge.left}%, calc(100% - 52px))`, top: `clamp(16px, ${selfEdge.top}%, calc(100% - 16px))` }}
          >
            우리 회사 쪽
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1">
        <Legend />
        {missingLine(plan) ? <p className="text-[12.5px] text-muted">{missingLine(plan)}</p> : null}
        {shapesLoading ? <p className="text-[12.5px] text-muted">건물 도형을 불러오고 있습니다.</p> : null}
        {[plan.notes.locations, plan.notes.buildings, shown?.failed ? BUILDINGS_FAILED : null].filter(Boolean).map((note) => (
          <p key={note} className="text-[12.5px] text-warn">
            {note}
          </p>
        ))}
      </div>

      {picked?.candidate ? (
        <ul className="mt-2 border-y border-line" aria-live="polite">
          {renderDetail(picked.candidate, picked.streamIds)}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted">회사를 누르면 무엇을 만들고 허가가 어떤지 여기에 보입니다.</p>
      )}
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{planSourceLine(plan)}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3.5 text-[13px] ${active ? "border-ink-2 bg-sunken font-medium text-ink" : "border-line-strong bg-surface text-ink-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
