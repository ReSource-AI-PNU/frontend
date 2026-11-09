"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { buildingsUrl } from "@/lib/complexes";
import type { Company, IndustrialComplex } from "@/lib/domain";

/** 지도 전용 색. 흰 배경·흑백 팔레트에서 파생한다 (DESIGN.md 지도 항목). */
const MAP_COLORS = {
  light: { bg: "#FFFFFF", base: "#E4E4E7", tenant: "#A1A1AA", hover: "#71717A", selected: "#0A0A0A" },
  dark: { bg: "#0A0A0A", base: "#27272A", tenant: "#52525B", hover: "#71717A", selected: "#FAFAFA" },
} as const;

const VIEW_3D = { pitch: 52, bearing: -20 };

/** AI가 고른 묶음 수거 그룹은 형광펜으로 칠한다 (DESIGN.md 형광펜 규칙). 라이트·다크 같은 값 */
const MARKER = "#E6FF3D";

/**
 * 선택 사항: AI가 고른 묶음 수거 그룹을 지도에 강조한다 (판정 흐름의 "묶음 수거 매칭" 화면).
 * - groupIds: 그룹 기업(내 회사 포함). 건물과 핀을 형광펜으로 칠한다.
 * - collectorId: 수거 처리업체. 건물을 먹색으로 칠한다(핀은 원래 먹 사각).
 * - excludedIds: 허가 불일치 등으로 제외한 업체. 건물을 일반 건물색으로 낮추고 핀을 흐리게 한다.
 * - fit: true면 처음 그릴 때 묶음 그룹 건물이 모두 보이게 화면을 맞춘다(기본 true). 수거 업체는 멀 수 있어 맞춤에서 뺀다.
 * 강조하지 않은 나머지 핀은 조금 흐려진다. 주지 않으면 기존 탐색 화면과 똑같이 동작한다.
 */
export type MapHighlight = { groupIds: string[]; collectorId?: string; excludedIds?: string[]; fit?: boolean };

/** 단지 범위 안에 섞인 주거·교육·의료 건물은 산업단지 모형에서 뺀다. */
const NON_INDUSTRIAL_KINDS = [
  "apartments", "house", "residential", "detached", "school", "kindergarten",
  "university", "hospital", "church", "hotel", "dormitory", "terrace",
];

type Theme = keyof typeof MAP_COLORS;

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function extrusionColor(theme: Theme) {
  const c = MAP_COLORS[theme];
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    c.selected,
    ["boolean", ["feature-state", "hover"], false],
    c.hover,
    ["boolean", ["feature-state", "group"], false],
    MARKER,
    ["boolean", ["feature-state", "collector"], false],
    c.selected,
    ["boolean", ["feature-state", "excluded"], false],
    c.base,
    ["boolean", ["feature-state", "tenant"], false],
    c.tenant,
    c.base,
  ] as unknown as string;
}

function markerElement(company: Company) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "rs-pin";
  el.dataset.role = company.role;
  el.setAttribute("aria-label", `${company.name} (${company.role})`);
  const dot = document.createElement("span");
  dot.className = "rs-pin-dot";
  const label = document.createElement("span");
  label.className = "rs-pin-label";
  label.textContent = company.name;
  el.append(dot, label);
  return el;
}

export type ComplexMapStatus = "loading" | "ready" | "error";

export function ComplexMap({
  complex,
  companies,
  selectedId,
  onSelect,
  highlight,
}: {
  complex: IndustrialComplex;
  companies: Company[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlight?: MapHighlight;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef<string | null>(selectedId);
  // 강조 대상이 같으면 다시 칠하지 않도록 내용으로 비교한다
  const highlightKey = highlight ? JSON.stringify(highlight) : "";
  const highlightRef = useRef<MapHighlight | undefined>(highlight);
  const [status, setStatus] = useState<ComplexMapStatus>("loading");
  const [is3D, setIs3D] = useState(true);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // 지도 생성: 단지가 바뀔 때마다 새로 만든다.
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const markers = markersRef.current;
    const byOsmId = new Map(companies.map((c) => [c.buildingOsmId, c]));

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker-${maplibre.getVersion()}.mjs`);

      const theme = currentTheme();
      const map = new maplibre.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            buildings: { type: "geojson", data: buildingsUrl(complex.id), promoteId: "osmId" },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": MAP_COLORS[theme].bg } },
            {
              id: "buildings-3d",
              type: "fill-extrusion",
              source: "buildings",
              filter: ["!", ["in", ["get", "kind"], ["literal", NON_INDUSTRIAL_KINDS]]],
              paint: {
                "fill-extrusion-color": extrusionColor(theme),
                "fill-extrusion-height": ["coalesce", ["get", "height"], 8],
                "fill-extrusion-base": 0,
                "fill-extrusion-opacity": 0.95,
                "fill-extrusion-vertical-gradient": true,
              },
            },
          ],
        },
        bounds: complex.bbox,
        fitBoundsOptions: { padding: 32 },
        ...VIEW_3D,
        maxPitch: 75,
        attributionControl: { compact: true, customAttribution: "건물 © OpenStreetMap contributors" },
      });
      mapRef.current = map;

      map.on("error", (e) => {
        if (String(e.error?.message ?? "").includes("buildings")) setStatus("error");
      });
      map.on("sourcedata", (e) => {
        if (e.sourceId === "buildings" && e.isSourceLoaded && !cancelled) setStatus("ready");
      });

      map.on("load", () => {
        map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.4, position: [1.2, 200, 35] });
        for (const c of companies) {
          map.setFeatureState({ source: "buildings", id: c.buildingOsmId }, { tenant: true });
        }
        for (const c of companies) {
          const el = markerElement(c);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            onSelectRef.current(c.id);
          });
          markers.set(c.id, new maplibre.Marker({ element: el, anchor: "center" }).setLngLat(c.location).addTo(map));
        }
        applyHighlight(map, companies, highlightRef.current, markers);
        applySelection(map, companies, selectedRef.current, markers, false);
        fitHighlight(map, companies, highlightRef.current);
      });

      let hovered: number | null = null;
      map.on("mousemove", "buildings-3d", (e) => {
        const id = e.features?.[0]?.id as number | undefined;
        if (id === undefined || id === hovered) return;
        if (hovered !== null) map.setFeatureState({ source: "buildings", id: hovered }, { hover: false });
        hovered = byOsmId.has(id) ? id : null;
        if (hovered !== null) map.setFeatureState({ source: "buildings", id: hovered }, { hover: true });
        map.getCanvas().style.cursor = hovered !== null ? "pointer" : "";
      });
      map.on("mouseleave", "buildings-3d", () => {
        if (hovered !== null) map.setFeatureState({ source: "buildings", id: hovered }, { hover: false });
        hovered = null;
        map.getCanvas().style.cursor = "";
      });
      map.on("click", (e) => {
        const [feature] = map.queryRenderedFeatures(e.point, { layers: ["buildings-3d"] });
        const company = feature ? byOsmId.get(feature.id as number) : undefined;
        onSelectRef.current(company ? company.id : null);
      });

      observer = new MutationObserver(() => {
        const t = currentTheme();
        map.setPaintProperty("bg", "background-color", MAP_COLORS[t].bg);
        map.setPaintProperty("buildings-3d", "fill-extrusion-color", extrusionColor(t));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    })().catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      observer?.disconnect();
      markers.forEach((m) => m.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [complex, companies]);

  // 선택 반영
  useEffect(() => {
    selectedRef.current = selectedId;
    const map = mapRef.current;
    if (map?.loaded()) applySelection(map, companies, selectedId, markersRef.current, true);
  }, [selectedId, companies]);

  // 묶음 그룹 강조 반영
  useEffect(() => {
    const next: MapHighlight | undefined = highlightKey ? (JSON.parse(highlightKey) as MapHighlight) : undefined;
    highlightRef.current = next;
    const map = mapRef.current;
    if (map?.loaded()) applyHighlight(map, companies, next, markersRef.current);
  }, [highlightKey, companies]);

  const zoomBy = (delta: number) => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 14) + delta, { animate: !reducedMotion() });
  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({ ...(next ? VIEW_3D : { pitch: 0, bearing: 0 }), animate: !reducedMotion() });
  };
  const resetView = () => {
    onSelect(null);
    if (highlightRef.current && mapRef.current) {
      fitHighlight(mapRef.current, companies, highlightRef.current, is3D, true);
      return;
    }
    mapRef.current?.fitBounds(complex.bbox, { padding: 32, ...(is3D ? VIEW_3D : { pitch: 0, bearing: 0 }), animate: !reducedMotion() });
  };

  return (
    <div className="relative size-full min-h-[420px] overflow-hidden bg-bg">
      {/* MapLibre CSS가 컨테이너를 position: relative로 덮어쓰므로 inset 대신 크기를 직접 준다 */}
      <div ref={containerRef} className="absolute! inset-0 size-full" role="region" aria-label={`${complex.name} 건물 3D 지도`} />

      {status !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p role="status" className="rounded-md bg-surface px-4 py-2.5 text-sm shadow-[0_0_0_1px_var(--color-line)]">
            {status === "error" ? "건물 데이터를 불러오지 못했습니다. 새로고침해 주세요." : "건물 외곽선을 불러오는 중…"}
          </p>
        </div>
      ) : null}

      <div className="absolute right-4 bottom-10 flex flex-col overflow-hidden rounded-md border border-line-strong bg-surface text-sm shadow-[0_8px_24px_-12px_rgb(0_0_0/0.3)]">
        <button type="button" onClick={() => zoomBy(1)} aria-label="확대" className="grid size-10 place-items-center border-b border-line hover:bg-sunken">
          +
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="축소" className="grid size-10 place-items-center border-b border-line hover:bg-sunken">
          −
        </button>
        <button type="button" onClick={toggle3D} aria-pressed={is3D} className="num grid h-10 w-10 place-items-center border-b border-line text-[12px] font-semibold hover:bg-sunken">
          {is3D ? "3D" : "2D"}
        </button>
        <button type="button" onClick={resetView} aria-label="단지 전체 보기" className="grid size-10 place-items-center hover:bg-sunken">
          <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function applySelection(
  map: MapLibreMap,
  companies: Company[],
  selectedId: string | null,
  markers: Map<string, Marker>,
  animate: boolean,
) {
  for (const c of companies) {
    map.setFeatureState({ source: "buildings", id: c.buildingOsmId }, { selected: c.id === selectedId });
    markers.get(c.id)?.getElement().toggleAttribute("data-selected", c.id === selectedId);
  }
  const selected = companies.find((c) => c.id === selectedId);
  if (selected) {
    map.easeTo({
      center: selected.location,
      zoom: Math.max(map.getZoom(), 16),
      pitch: map.getPitch() > 0 ? 58 : 0,
      duration: animate && !reducedMotion() ? 700 : 0,
    });
  }
}

function applyHighlight(map: MapLibreMap, companies: Company[], highlight: MapHighlight | undefined, markers: Map<string, Marker>) {
  const group = new Set(highlight?.groupIds ?? []);
  const excluded = new Set(highlight?.excludedIds ?? []);
  const collector = highlight?.collectorId;
  for (const c of companies) {
    const isGroup = group.has(c.id);
    const isCollector = c.id === collector;
    const isExcluded = excluded.has(c.id);
    map.setFeatureState(
      { source: "buildings", id: c.buildingOsmId },
      { group: isGroup, collector: isCollector, excluded: isExcluded },
    );
    const el = markers.get(c.id)?.getElement();
    if (!el) continue;
    const dot = el.querySelector<HTMLElement>(".rs-pin-dot");
    el.toggleAttribute("data-group", isGroup);
    el.toggleAttribute("data-excluded", isExcluded);
    // 핀 스타일은 globals.css(.rs-pin)를 건드리지 않고 인라인으로 덧칠한다.
    // 핀 루트의 opacity는 MapLibre Marker가 직접 관리하므로 점(dot)에만 흐림을 준다.
    if (dot) {
      dot.style.opacity = !highlight || isGroup || isCollector ? "" : isExcluded ? "0.3" : "0.5";
      dot.style.background = isGroup ? MARKER : "";
      dot.style.boxShadow = isGroup ? "0 0 0 2px var(--color-ink), 0 0 0 4px var(--color-surface)" : "";
      dot.style.width = isGroup || isCollector ? "12px" : "";
      dot.style.height = isGroup || isCollector ? "12px" : "";
    }
    const label = el.getAttribute("aria-label")?.replace(/ · (AI 묶음 그룹|수거 업체|제외)$/, "") ?? c.name;
    const suffix = isGroup ? " · AI 묶음 그룹" : isCollector ? " · 수거 업체" : isExcluded ? " · 제외" : "";
    el.setAttribute("aria-label", `${label}${suffix}`);
  }
}

function fitHighlight(map: MapLibreMap, companies: Company[], highlight: MapHighlight | undefined, is3D = true, animate = false) {
  if (!highlight || highlight.fit === false) return;
  const ids = new Set(highlight.groupIds);
  const points = companies.filter((c) => ids.has(c.id)).map((c) => c.location);
  if (points.length === 0) return;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const pad = 0.0015;
  map.fitBounds(
    [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad],
    { padding: 64, maxZoom: 16.5, ...(is3D ? VIEW_3D : { pitch: 0, bearing: 0 }), duration: animate && !reducedMotion() ? 700 : 0 },
  );
}
