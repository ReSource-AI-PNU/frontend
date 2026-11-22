/**
 * 같은 단지 평면도의 계산(투영, 화면 범위, 그릴 회사 고르기). 순수 함수만 둔다(tests/complex-plan.test.ts).
 * 지도는 위도에 따른 경도 축소(cos)만 넣은 단순 평면 투영이다. 단지 하나(수 km)에서는 왜곡이 눈에 띄지 않는다.
 */
import type { ComplexCandidate, ComplexPartners, ComplexPlan } from "./types.ts";
import type { PlanBuilding } from "./vworld.ts";

/** 평면도 좌표계의 폭(SVG viewBox 단위). 높이는 범위의 비율로 정한다 */
export const PLAN_WIDTH = 1000;

export type PlanRole = "self" | "takes" | "uses";

export type Projection = {
  width: number;
  height: number;
  /** [경도, 위도] → [x, y] (평면도 단위, 위가 북쪽) */
  point: (lonLat: readonly [number, number]) => [number, number];
  /** 건물 꼭짓점([경도, 위도] 목록) → SVG path d */
  ring: (points: [number, number][]) => string;
};

export function projection(plan: Pick<ComplexPlan, "bbox">): Projection | null {
  if (!plan.bbox) return null;
  const [x0, y0, x1, y1] = plan.bbox;
  const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const unit = PLAN_WIDTH / ((x1 - x0) * kx);
  const height = (y1 - y0) * unit;
  const point = ([lon, lat]: readonly [number, number]): [number, number] => [(lon - x0) * kx * unit, (y1 - lat) * unit];
  const ring = (points: [number, number][]) => {
    const parts = points.map((lonLat, i) => {
      const [x, y] = point(lonLat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return parts.length > 0 ? `${parts.join("")}Z` : "";
  };
  return { width: PLAN_WIDTH, height, point, ring };
}

/** 좌표가 건물 안인가(짝홀 규칙) */
function inside([x, y]: readonly [number, number], ring: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) hit = !hit;
  }
  return hit;
}

function meters(a: readonly [number, number], b: readonly [number, number]): number {
  const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot((a[0] - b[0]) * 111_320 * Math.cos(lat), (a[1] - b[1]) * 110_540);
}

/** 좌표가 든 건물, 없으면 nearM(기본 40m) 안에서 가장 가까운 건물(꼭짓점 평균 기준). 없으면 null */
export function buildingOf(point: readonly [number, number], buildings: PlanBuilding[], nearM = 40): string | null {
  for (const building of buildings) if (building.rings.some((ring) => inside(point, ring))) return building.id;
  let best: string | null = null;
  let bestM = nearM;
  for (const building of buildings) {
    const ring = building.rings[0];
    const center: [number, number] = [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
    const m = meters(point, center);
    if (m < bestM) {
      best = building.id;
      bestM = m;
    }
  }
  return best;
}

export type PlanNode = {
  id: string;
  name: string;
  role: PlanRole;
  /** 평면도 단위 좌표 */
  x: number;
  y: number;
  buildingId: string | null;
  /** 이 회사가 후보인 폐기물 ID */
  streamIds: string[];
  candidate: ComplexCandidate | null;
};

/**
 * 그릴 회사. 우리 회사 하나와, 위치를 찾은 후보(받는 곳이 쓰는 곳보다 앞). streamId를 주면 그 폐기물의 후보만 둔다.
 * 같은 회사가 어떤 폐기물에는 받는 곳, 다른 폐기물에는 쓰는 곳이면 받는 곳으로 본다.
 */
export function planNodes(plan: ComplexPlan, partners: ComplexPartners, streamId: string | null, buildings: PlanBuilding[] = []): PlanNode[] {
  const proj = projection(plan);
  if (!proj) return [];
  const byId = new Map<string, { candidate: ComplexCandidate; role: PlanRole; streamIds: string[] }>();
  for (const stream of partners.streams) {
    if (streamId && stream.streamId !== streamId) continue;
    for (const candidate of [...stream.takes, ...stream.uses]) {
      const found = byId.get(candidate.id);
      if (found) {
        if (!found.streamIds.includes(stream.streamId)) found.streamIds.push(stream.streamId);
        if (candidate.role === "takes") found.role = "takes";
        continue;
      }
      byId.set(candidate.id, { candidate, role: candidate.role, streamIds: [stream.streamId] });
    }
  }
  const nodes: PlanNode[] = [];
  if (plan.self) {
    const [x, y] = proj.point(plan.self.location);
    const buildingId = plan.self.buildingId ?? buildingOf(plan.self.location, buildings);
    nodes.push({ id: "__self__", name: "우리 회사", role: "self", x, y, buildingId, streamIds: [], candidate: null });
  }
  const rank: Record<PlanRole, number> = { self: 0, takes: 1, uses: 2 };
  const partnersOut = [...byId.entries()]
    .flatMap(([id, item]) => {
      const place = plan.places[id];
      if (!place) return [];
      const [x, y] = proj.point(place.location);
      const buildingId = place.buildingId ?? buildingOf(place.location, buildings);
      return [{ id, name: item.candidate.name, role: item.role, x, y, buildingId, streamIds: item.streamIds, candidate: item.candidate }];
    })
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, "ko"));
  return [...nodes, ...partnersOut];
}

/** 건물 ID → 그 건물에 든 회사의 역할(우리 회사 > 받는 곳 > 쓰는 곳) */
export function buildingRoles(nodes: PlanNode[]): Map<string, PlanRole> {
  const rank: Record<PlanRole, number> = { self: 0, takes: 1, uses: 2 };
  const out = new Map<string, PlanRole>();
  for (const node of nodes) {
    if (!node.buildingId) continue;
    const before = out.get(node.buildingId);
    if (!before || rank[node.role] < rank[before]) out.set(node.buildingId, node.role);
  }
  return out;
}

export type ViewBox = { x: number; y: number; width: number; height: number };

/** 평면도 전체(비율은 clampView와 같은 범위로 맞춘다) */
export function fullView(proj: Projection): ViewBox {
  return clampView(proj, proj.width / 2, proj.height / 2, proj.width, proj.height);
}

/**
 * 후보 주변만: 받는 곳 점(없으면 쓰는 곳까지)을 덮고 사방에 여백(폭의 margin 비율, 최소 minSize)을 둔다. 후보가 없으면 null.
 * 쓰는 곳은 단지 곳곳에 흩어져 있어 함께 덮으면 전체와 같아진다. 전체 범위 밖으로 나가지 않게 자른다.
 */
export function partnerView(nodes: PlanNode[], proj: Projection, margin = 0.18, minSize = 220): ViewBox | null {
  const takes = nodes.filter((node) => node.role === "takes");
  const points = takes.length > 0 ? takes : nodes.filter((node) => node.role !== "self");
  if (points.length === 0) return null;
  const xs = points.map((node) => node.x);
  const ys = points.map((node) => node.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const width = Math.max(Math.max(...xs) - Math.min(...xs), minSize) * (1 + 2 * margin);
  const height = Math.max(Math.max(...ys) - Math.min(...ys), minSize * 0.6) * (1 + 2 * margin);
  return clampView(proj, cx, cy, width, height);
}

/** 화면 비율을 가로:세로 1:0.4~1:0.7로 맞추고 전체 범위 안으로 자른다(겹쳐 둔 핀 단추의 백분율 위치가 어긋나지 않게) */
export function clampView(proj: Projection, cx: number, cy: number, width: number, height: number): ViewBox {
  let w = Math.max(width, height / 0.7);
  let h = Math.max(height, w * 0.4);
  w = Math.min(w, proj.width);
  h = Math.min(h, proj.height);
  const x = Math.min(Math.max(cx - w / 2, 0), proj.width - w);
  const y = Math.min(Math.max(cy - h / 2, 0), proj.height - h);
  return { x, y, width: w, height: h };
}

/** 평면도 좌표 → 지금 보이는 범위 안의 백분율 위치(겹쳐 둔 핀 단추용). 범위 밖이면 null */
export function percentIn(view: ViewBox, x: number, y: number): { left: number; top: number } | null {
  const left = ((x - view.x) / view.width) * 100;
  const top = ((y - view.y) / view.height) * 100;
  if (left < -1 || left > 101 || top < -1 || top > 101) return null;
  return { left, top };
}

/** 핀 옆에 붙일 짧은 설명: 생산품에서 읽은 첫 품목(14자까지) */
export function shortItem(candidate: ComplexCandidate | null): string | null {
  const first = candidate?.items[0] ?? candidate?.product ?? null;
  if (!first) return null;
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}

export const ROLE_LABEL: Record<PlanRole, string> = {
  self: "우리 회사",
  takes: "받아서 재생원료로 만드는 곳",
  uses: "재생원료를 쓸 수 있는 곳",
};

/** 핀 단추의 화면 낭독 이름: "동양피앤씨 유한회사 · 받아서 재생원료로 만드는 곳 · 재생PE" */
export function nodeLabel(node: PlanNode): string {
  if (node.role === "self") return "우리 회사";
  const item = shortItem(node.candidate);
  return [node.name, ROLE_LABEL[node.role], item].filter(Boolean).join(" · ");
}

/** 평면도에 없는 후보 안내. 위치를 찾지 못한 곳도 아래 목록에는 있다 */
export function missingLine(plan: ComplexPlan): string | null {
  return plan.missing.length > 0 ? `위치를 찾지 못한 ${plan.missing.length}곳은 평면도에 없고 아래 목록에만 있습니다.` : null;
}

export function planSourceLine(plan: ComplexPlan): string {
  return `위치·건물: ${plan.sources.join(", ")}. 표시한 곳은 연결 후보이며 실제 거래가 아닙니다.`;
}

export type LabelSide = "right" | "left" | "top" | "bottom";
export type LabelBox = { id: string; left: number; top: number; width: number; height: number };

/**
 * 이름표 자리 고르기. 점(백분율 위치)마다 오른쪽 → 왼쪽 → 위 → 아래 순서로, 이미 놓인 이름표·핀·평면도 가장자리와
 * 겹치지 않는 첫 자리를 고른다. 놓을 곳이 없으면 null(이름표를 숨긴다. 이름은 단추의 화면 낭독 이름에 있다).
 * items는 우선순위 순서(고른 회사, 우리 회사, 받는 곳, 쓰는 곳)로 준다. 크기는 px다.
 */
export function placeLabels(
  items: { id: string; left: number; top: number; width: number; height: number; force?: boolean }[],
  boxWidth: number,
  boxHeight: number,
  pin = 10,
  gap = 4,
): Map<string, LabelSide | null> {
  const placed: LabelBox[] = items.map((item) => ({
    id: `pin:${item.id}`,
    left: (item.left / 100) * boxWidth - pin,
    top: (item.top / 100) * boxHeight - pin,
    width: pin * 2,
    height: pin * 2,
  }));
  const overlaps = (a: LabelBox, b: LabelBox) =>
    a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  const out = new Map<string, LabelSide | null>();
  for (const item of items) {
    const x = (item.left / 100) * boxWidth;
    const y = (item.top / 100) * boxHeight;
    const boxes: Record<LabelSide, LabelBox> = {
      right: { id: item.id, left: x + pin + gap, top: y - item.height / 2, width: item.width, height: item.height },
      left: { id: item.id, left: x - pin - gap - item.width, top: y - item.height / 2, width: item.width, height: item.height },
      top: { id: item.id, left: x - item.width / 2, top: y - pin - gap - item.height, width: item.width, height: item.height },
      bottom: { id: item.id, left: x - item.width / 2, top: y + pin + gap, width: item.width, height: item.height },
    };
    const sides = ["right", "left", "top", "bottom"] as const;
    const inside = (box: LabelBox) =>
      box.left >= 0 && box.top >= 0 && box.left + box.width <= boxWidth && box.top + box.height <= boxHeight;
    let chosen: LabelSide | null =
      sides.find((side) => inside(boxes[side]) && !placed.some((other) => other.id !== `pin:${item.id}` && overlaps(boxes[side], other))) ?? null;
    // force(고른 회사)는 겹치더라도 평면도 안의 첫 자리에 둔다
    if (!chosen && item.force) chosen = sides.find((side) => inside(boxes[side])) ?? "right";
    if (chosen) placed.push(boxes[chosen]);
    out.set(item.id, chosen);
  }
  return out;
}

/** 이름표 크기 어림(px): 글자 수 × 글자 폭 + 여백. 두 줄(이름, 품목)이면 높이가 늘어난다 */
export function labelSize(name: string, item: string | null): { width: number; height: number } {
  const chars = Math.max(name.length, item?.length ?? 0);
  return { width: Math.min(chars * 12 + 14, 200), height: item ? 34 : 22 };
}

/**
 * 화면 밖에 있는 점(우리 회사)으로 가는 방향 표시 자리: 보이는 범위의 가운데에서 그 점으로 그은 선이 가장자리와 만나는
 * 곳(백분율, 가장자리에서 조금 안쪽). 점이 범위 안이면 null.
 */
export function edgeMarker(view: ViewBox, x: number, y: number, inset = 6): { left: number; top: number } | null {
  if (percentIn(view, x, y)) return null;
  const cx = view.x + view.width / 2;
  const cy = view.y + view.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const tx = dx === 0 ? Infinity : (view.width / 2) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (view.height / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  const left = ((cx + dx * t - view.x) / view.width) * 100;
  const top = ((cy + dy * t - view.y) / view.height) * 100;
  return { left: Math.min(Math.max(left, inset), 100 - inset), top: Math.min(Math.max(top, inset), 100 - inset) };
}
