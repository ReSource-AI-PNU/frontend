/**
 * 처리 흐름도(결과 아래): 폐기물 → 오염 등급 → 처리 방식 → 받는 곳. 띠 굵기는 한 달 발생량이다.
 * 배치만 계산하는 순수 함수다(tests/flow.test.ts). 그리기는 components/agent/flow-chart.tsx.
 *
 * - 색은 오염 등급 하나만 뜻한다(순서형 파랑, dataviz 검증기 통과: 라이트 #86b6ef→#0d366b, 다크 #184f95→#9ec5f4).
 * - 발생량을 모르는 폐기물은 숫자를 지어내지 않고 가는 띠(MIN_BAND)로 그리고 "발생량 확인 필요"로 적는다.
 */

export const GRADE_ORDER = ["A", "B", "C", "등외", "확인 필요"] as const;
export type GradeKey = (typeof GRADE_ORDER)[number];
export const ROUTE_ORDER = ["reuse", "sell", "treat", "keep", "none"] as const;
export const ROUTE_NAME: Record<string, string> = {
  reuse: "공정 재투입",
  sell: "매각",
  treat: "위탁 처리",
  keep: "지금 방식 그대로",
  none: "정해지지 않음",
};

export type FlowInput = {
  id: string;
  name: string;
  kg: number | null;
  grade: string | null;
  route: string | null;
  receiver: string | null;
};

export type FlowNode = {
  key: string;
  column: number;
  label: string;
  value: number;
  x: number;
  y: number;
  h: number;
  grade?: GradeKey;
};
export type FlowBand = {
  streamId: string;
  column: number;
  grade: GradeKey;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
};
export type FlowLayout = {
  width: number;
  height: number;
  nodes: FlowNode[];
  bands: FlowBand[];
  unknownKg: string[];
};

export const NODE_W = 12;
export const PAD = 14;
export const MIN_BAND = 4;

export function gradeKey(grade: string | null): GradeKey {
  return (GRADE_ORDER as readonly string[]).includes(grade ?? "") ? (grade as GradeKey) : "확인 필요";
}

export function gradeLabel(grade: GradeKey): string {
  if (grade === "확인 필요") return "등급 확인 필요";
  return grade === "등외" ? "등외" : `${grade}등급`;
}

function routeKey(route: string | null): string {
  return route && route in ROUTE_NAME ? route : "none";
}

function receiverLabel(item: FlowInput): string {
  if (item.route === "reuse") return "우리 공장";
  if (item.route === "keep" || !item.route) return item.receiver ?? "지금 처리하는 곳";
  return item.receiver ?? "정해지지 않음";
}

function order<T>(list: readonly T[], value: T): number {
  const index = list.indexOf(value);
  return index < 0 ? list.length : index;
}

export function layoutFlow(items: FlowInput[], width: number, height: number): FlowLayout {
  const known = items.filter((item) => item.kg != null && item.kg > 0);
  const unknownKg = items.filter((item) => !(item.kg != null && item.kg > 0)).map((item) => item.id);
  const total = known.reduce((sum, item) => sum + (item.kg ?? 0), 0);

  // 열마다 노드(같은 값이면 하나). 폐기물은 등급·처리 방식 순으로 세워 띠가 덜 엇갈리게 한다
  const sorted = [...items].sort(
    (a, b) =>
      order(GRADE_ORDER, gradeKey(a.grade)) - order(GRADE_ORDER, gradeKey(b.grade)) ||
      order(ROUTE_ORDER, routeKey(a.route)) - order(ROUTE_ORDER, routeKey(b.route)) ||
      a.name.localeCompare(b.name, "ko"),
  );
  const keyOf = (item: FlowInput, column: number): string => {
    if (column === 0) return `s:${item.id}`;
    if (column === 1) return `g:${gradeKey(item.grade)}`;
    if (column === 2) return `r:${routeKey(item.route)}`;
    return `v:${receiverLabel(item)}`;
  };
  const labelOf = (item: FlowInput, column: number): string => {
    if (column === 0) return item.name;
    if (column === 1) return gradeLabel(gradeKey(item.grade));
    if (column === 2) return ROUTE_NAME[routeKey(item.route)];
    return receiverLabel(item);
  };

  const columns: { key: string; label: string; members: FlowInput[] }[][] = [[], [], [], []];
  for (const item of sorted) {
    for (let column = 0; column < 4; column += 1) {
      const key = keyOf(item, column);
      const found = columns[column].find((node) => node.key === key);
      if (found) found.members.push(item);
      else
        columns[column].push({
          key,
          label: labelOf(item, column),
          members: [item],
        });
    }
  }

  const bandOf = (item: FlowInput, scale: number) => (item.kg != null && item.kg > 0 ? Math.max(item.kg * scale, MIN_BAND) : MIN_BAND);
  const tallest = Math.max(...columns.map((column) => column.length));
  const scale = total > 0 ? Math.max(height - PAD * (tallest - 1) - MIN_BAND * unknownKg.length, 40) / total : 0;
  const xs = [0, 1, 2, 3].map((column) => ((width - NODE_W) * column) / 3);

  const nodes: FlowNode[] = [];
  const at = new Map<string, FlowNode>();
  columns.forEach((column, index) => {
    const heights = column.map((node) => node.members.reduce((sum, item) => sum + bandOf(item, scale), 0));
    const used = heights.reduce((a, b) => a + b, 0) + PAD * (column.length - 1);
    let y = Math.max((height - used) / 2, 0);
    column.forEach((node, i) => {
      const placed: FlowNode = {
        key: node.key,
        column: index,
        label: node.label,
        value: node.members.reduce((sum, item) => sum + (item.kg ?? 0), 0),
        x: xs[index],
        y,
        h: heights[i],
        ...(index === 1 ? { grade: gradeKey(node.members[0].grade) } : {}),
      };
      nodes.push(placed);
      at.set(node.key, placed);
      y += heights[i] + PAD;
    });
  });

  // 띠: 노드마다 들어오는 쪽과 나가는 쪽의 자리를 폐기물 순서대로 쌓는다
  const outOffset = new Map<string, number>();
  const inOffset = new Map<string, number>();
  const bands: FlowBand[] = [];
  for (let column = 0; column < 3; column += 1) {
    const ordered = [...sorted].sort((a, b) => {
      const ta = at.get(keyOf(a, column + 1))!;
      const tb = at.get(keyOf(b, column + 1))!;
      return ta.y - tb.y;
    });
    for (const item of ordered) {
      const from = at.get(keyOf(item, column))!;
      const to = at.get(keyOf(item, column + 1))!;
      const h = bandOf(item, scale);
      const y0 = from.y + (outOffset.get(from.key) ?? 0);
      const y1 = to.y + (inOffset.get(to.key) ?? 0);
      outOffset.set(from.key, (outOffset.get(from.key) ?? 0) + h);
      inOffset.set(to.key, (inOffset.get(to.key) ?? 0) + h);
      bands.push({
        streamId: item.id,
        column,
        grade: gradeKey(item.grade),
        x0: from.x + NODE_W,
        y0,
        x1: to.x,
        y1,
        h,
      });
    }
  }
  return { width, height, nodes, bands, unknownKg };
}

/** 띠 하나의 SVG 경로(위 가장자리와 아래 가장자리를 같은 곡선으로 잇는다) */
export function bandPath(band: FlowBand): string {
  const mid = (band.x0 + band.x1) / 2;
  const { x0, x1, y0, y1, h } = band;
  return `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} L${x1},${y1 + h} C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h} Z`;
}
