/**
 * 판단 그래프의 자리 잡기. 그리는 쪽(judgement-graph.tsx)과 나눠 두어 테스트에서 따로 돌려 볼 수 있다.
 *
 * 열은 왼쪽부터 흐름 → 기준 → 업체 → 근거 문서다.
 *  - 기준은 그 기준을 가진 업체 옆에 묶어 세우고, 업체는 자기 기준 묶음의 가운데에 둔다(기준 → 업체 선이 엇갈리지 않는다).
 *  - 업체는 배정된 흐름의 위치 평균 순으로, 흐름은 이어진 기준의 위치 평균 순으로 몇 번 번갈아 다시 세워 겹침을 줄인다.
 *  - 흐름에서 업체로 바로 가는 선(허가 품목 없음, 자동 거절)은 기준 묶음 위의 좁은 길(lane)로 지나가 기준 노드를 가로지르지 않는다.
 */
import type { GraphEdge, GraphNode } from "./types";

export const NODE_W = 164;
export const NODE_H = 40;
export const WIDTH = 884;
const TOP = 30;
const GAP = 10;
const LANE = 16;
const GROUP_GAP = 14;

export const COLUMN_X = { stream: 0, criterion: 240, vendor: 480, evidence: 720 } as const;

export type Point = { x: number; y: number };

export type GraphLayout = {
  position: Map<string, Point>;
  /** 업체마다, 흐름에서 바로 오는 선이 기준 열을 지나는 높이 */
  lane: Map<string, number>;
  /** 기준 → 업체 */
  vendorOf: Map<string, string>;
  /** "흐름|업체": 최적안 배정 */
  assigned: Set<string>;
  /** "흐름|업체": 그 업체의 기준과 대조한 선이 있다 */
  viaCriterion: Set<string>;
  streamOrder: string[];
  vendorOrder: string[];
  criterionOrder: string[];
  height: number;
  /** 흐름 → 근거 문서 선이 지나는 맨 아래 길 */
  rail: number;
};

const mean = (values: number[]) =>
  values.length === 0 ? Number.POSITIVE_INFINITY : values.reduce((sum, value) => sum + value, 0) / values.length;

function sortBy<T>(items: T[], score: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => (a.score === b.score ? a.index - b.index : a.score - b.score))
    .map((entry) => entry.item);
}

/** 같은 판단이 여러 번 실려 오면 한 번만 남긴다. */
export function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = [edge.from, edge.to, edge.kind, edge.status, edge.label].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], shownEvidence: GraphNode[]): GraphLayout {
  const type = new Map(nodes.map((node) => [node.id, node.type]));
  const ids = (kind: GraphNode["type"]) => nodes.filter((node) => node.type === kind).map((node) => node.id);
  const criteria = ids("criterion");
  const vendors = ids("vendor");

  const vendorOf = new Map<string, string>();
  const streamCriteria = new Map<string, string[]>();
  const streamVendors = new Map<string, string[]>();
  const assigned = new Set<string>();
  for (const edge of edges) {
    const from = type.get(edge.from);
    const to = type.get(edge.to);
    if (from === "criterion" && to === "vendor") vendorOf.set(edge.from, edge.to);
    if (from === "stream" && to === "criterion") {
      streamCriteria.set(edge.from, [...(streamCriteria.get(edge.from) ?? []), edge.to]);
    }
    if (from === "stream" && to === "vendor") {
      streamVendors.set(edge.from, [...(streamVendors.get(edge.from) ?? []), edge.to]);
      if (edge.kind === "assignment") assigned.add(`${edge.from}|${edge.to}`);
    }
  }
  const viaCriterion = new Set<string>();
  for (const [stream, list] of streamCriteria) {
    for (const criterion of list) {
      const vendor = vendorOf.get(criterion);
      if (vendor) viaCriterion.add(`${stream}|${vendor}`);
    }
  }

  let streamOrder = ids("stream");
  let vendorOrder = vendors;
  let criterionOrder = criteria;
  for (let pass = 0; pass < 3; pass += 1) {
    const streamAt = new Map(streamOrder.map((id, index) => [id, index]));
    const streamsOf = (vendor: string, pairs: Set<string>) =>
      streamOrder.filter((stream) => pairs.has(`${stream}|${vendor}`)).map((stream) => streamAt.get(stream) ?? 0);
    vendorOrder = sortBy(vendorOrder, (vendor) => {
      const own = streamsOf(vendor, assigned);
      if (own.length > 0) return mean(own);
      const matched = streamsOf(vendor, viaCriterion);
      if (matched.length > 0) return mean(matched);
      return mean(
        streamOrder.filter((stream) => streamVendors.get(stream)?.includes(vendor)).map((stream) => streamAt.get(stream) ?? 0),
      );
    });
    const criterionScore = (criterion: string) =>
      mean(
        streamOrder
          .filter((stream) => streamCriteria.get(stream)?.includes(criterion))
          .map((stream) => streamAt.get(stream) ?? 0),
      );
    criterionOrder = [
      ...vendorOrder.flatMap((vendor) =>
        sortBy(
          criteria.filter((criterion) => vendorOf.get(criterion) === vendor),
          criterionScore,
        ),
      ),
      ...criteria.filter((criterion) => !vendorOf.has(criterion)),
    ];
    const criterionAt = new Map(criterionOrder.map((id, index) => [id, index]));
    const perVendor = Math.max(criterionOrder.length, 1) / Math.max(vendorOrder.length, 1);
    streamOrder = sortBy(streamOrder, (stream) => {
      const weighted: number[] = [];
      for (const criterion of streamCriteria.get(stream) ?? []) {
        const at = criterionAt.get(criterion) ?? 0;
        const vendor = vendorOf.get(criterion);
        // 배정된 기준 쪽으로 더 끌어당긴다
        const weight = vendor && assigned.has(`${stream}|${vendor}`) ? 3 : 1;
        for (let count = 0; count < weight; count += 1) weighted.push(at);
      }
      if (weighted.length > 0) return mean(weighted);
      return mean((streamVendors.get(stream) ?? []).map((vendor) => (vendorOrder.indexOf(vendor) + 0.5) * perVendor));
    });
  }

  const position = new Map<string, Point>();
  const lane = new Map<string, number>();
  const hasDirect = new Set([...streamVendors.values()].flat());
  let cursor = TOP;
  for (const vendor of vendorOrder) {
    if (hasDirect.has(vendor)) {
      lane.set(vendor, cursor + LANE / 2);
      cursor += LANE;
    }
    const own = criterionOrder.filter((criterion) => vendorOf.get(criterion) === vendor);
    const start = cursor;
    for (const criterion of own) {
      position.set(criterion, { x: COLUMN_X.criterion, y: cursor });
      cursor += NODE_H + GAP;
    }
    if (own.length === 0) cursor += NODE_H + GAP;
    position.set(vendor, { x: COLUMN_X.vendor, y: (start + cursor - GAP) / 2 - NODE_H / 2 });
    cursor += GROUP_GAP;
  }
  for (const criterion of criterionOrder.filter((item) => !vendorOf.has(item))) {
    position.set(criterion, { x: COLUMN_X.criterion, y: cursor });
    cursor += NODE_H + GAP;
  }
  const step = NODE_H + GAP;
  const inner = Math.max(cursor - TOP, streamOrder.length * step, shownEvidence.length * step, step);

  /** 한 열을 전체 높이에 고르게 편다. */
  const spread = (list: string[], x: number) => {
    const each = inner / Math.max(list.length, 1);
    list.forEach((id, index) => position.set(id, { x, y: TOP + each * index + (each - NODE_H) / 2 }));
  };
  spread(streamOrder, COLUMN_X.stream);

  // 근거 문서는 이어진 노드의 높이 평균 순으로 세운다. 흐름에서 오는 조항은 문서 아래에 둔다.
  const centerOf = (id: string) => (position.get(id)?.y ?? 0) + NODE_H / 2;
  const evidenceOrder = sortBy(
    shownEvidence.map((node) => node.id),
    (id) => {
      const linked = edges.filter((edge) => edge.to === id || edge.from === id).map((edge) => (edge.to === id ? edge.from : edge.to));
      const fromVendor = linked.filter((other) => type.get(other) === "vendor");
      return fromVendor.length > 0 ? mean(fromVendor.map(centerOf)) : inner * 2 + mean(linked.map(centerOf));
    },
  );
  spread(evidenceOrder, COLUMN_X.evidence);

  const rail = TOP + inner + 10;
  return {
    position,
    lane,
    vendorOf,
    assigned,
    viaCriterion,
    streamOrder,
    vendorOrder,
    criterionOrder,
    height: rail + 12,
    rail,
  };
}

/** 선이 서로 엇갈리는 횟수(흐름 → 기준 선끼리). 노드 순서가 겹침을 줄였는지 테스트에서 견준다. */
export function countCrossings(streamOrder: string[], criterionOrder: string[], edges: GraphEdge[]): number {
  const streamAt = new Map(streamOrder.map((id, index) => [id, index]));
  const criterionAt = new Map(criterionOrder.map((id, index) => [id, index]));
  const pairs = dedupeEdges(edges)
    .filter((edge) => streamAt.has(edge.from) && criterionAt.has(edge.to))
    .map((edge) => [streamAt.get(edge.from) ?? 0, criterionAt.get(edge.to) ?? 0] as const);
  let crossings = 0;
  for (let a = 0; a < pairs.length; a += 1) {
    for (let b = a + 1; b < pairs.length; b += 1) {
      if ((pairs[a][0] - pairs[b][0]) * (pairs[a][1] - pairs[b][1]) < 0) crossings += 1;
    }
  }
  return crossings;
}
