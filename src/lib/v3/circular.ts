/**
 * 자원순환 효과(백엔드 judge/circular.py)를 화면 문장으로 옮기는 순수 함수.
 * 세 지표(감축량·에너지 절감·신재 대체)는 서로 다른 성과라 합치지 않고, 산정 보류를 0으로 적지 않는다.
 */
import { josa } from "../josa.ts";
import { formatNumber } from "./format.ts";
import type { Circular, CircularMetric, CircularRoute, CircularScenario, CircularTotal, Claim } from "./types.ts";

export type CircularMetricKey = "ghg" | "energy" | "virgin";
export const CIRCULAR_METRICS: CircularMetricKey[] = ["ghg", "energy", "virgin"];

export const METRIC_LABEL: Record<CircularMetricKey, string> = {
  ghg: "예상 온실가스 감축량",
  energy: "예상 전 과정 에너지 절감량",
  virgin: "신재 원료 대체량",
};

/** 지표 이름 아래에 붙는 한 줄 풀이 */
export const METRIC_NOTE: Record<CircularMetricKey, string> = {
  ghg: "현행 처리 대비, 원료 생산부터 처리까지 전 과정 배출의 차이",
  energy: "새 원료 생산과 기존 처리에 드는 에너지의 순절감. 전기요금 절감액이 아닙니다",
  virgin: "재생원료를 써서 새로 만들 필요가 없어진 원료의 양",
};

export const ROUTE_NAME: Record<CircularRoute, string> = {
  reuse: "공정 재투입",
  recycle: "재활용 업체",
  pyrolysis: "열분해",
  landfill: "매립",
  keep: "현행 유지",
  unknown: "처리 방식 확인 필요",
};

export const BASELINE_NAME: Record<string, string> = {
  incineration: "소각",
  landfill: "매립",
  recycle: "재활용(판매)",
  unknown: "확인 필요",
};

export const SCENARIO_NOTE: Record<CircularScenario["id"], string> = {
  A: "공정 재투입·재활용 업체 매각·열분해·묶음 수거를 폐기물마다 골라 조합한 배정입니다.",
  B: "같은 업체로 합쳐 최소 물량을 채우는 묶음 없이, 폐기물마다 혼자 업체 기준을 채워야 할 때입니다.",
  C: "지금 처리를 그대로 둡니다. 감축량을 재는 기준선(0)이며, 배출이나 에너지 사용이 없다는 뜻이 아닙니다.",
  D: "비교용 시나리오입니다. 원료 회수와 신재 대체가 없고, 실제로 받아 줄 매립장은 따로 확인해야 합니다.",
};

export const METHOD_NAME = { literature: "문헌 추정", site: "현장 추정" } as const;

export const DISCLAIMER =
  "세 값은 서로 다른 성과라 합치지 않습니다. 문헌 추정은 해외 연구 시나리오 값이며 이 사업장의 실측이나 인증 감축량이 아닙니다. 회사의 공식 배출량에서 빼거나 배출권으로 팔 수 있는 값도 아닙니다.";

function numeric(claim: Claim | null | undefined): number | null {
  return claim && typeof claim.value === "number" ? claim.value : null;
}

/** 지표 값의 화면 글. 감축·절감·대체는 양수가 좋은 쪽이고, 음수면 낱말로 늘어남을 밝힌다. 값이 없으면 null */
export function metricText(metric: CircularMetricKey, claim: Claim | null | undefined): string | null {
  const value = numeric(claim);
  if (value === null) return null;
  const size = Math.abs(value);
  let text: string;
  if (metric === "ghg") {
    text = size < 0.1 && size > 0 ? `${formatNumber(Math.round(size * 1000))} kgCO2e/월` : `${formatNumber(Math.round(size * 100) / 100)} tCO2e/월`;
  } else if (metric === "energy") {
    text = `${formatNumber(Math.round(size * 10) / 10)} GJ/월`;
  } else {
    text = `${formatNumber(Math.round(size))} kg/월`;
  }
  if (value >= 0) return text;
  const worse = { ghg: "늘어남", energy: "더 씀", virgin: "잃음" }[metric];
  return `${text} ${worse}`;
}

/** 같은 문헌 지표의 두 시나리오를 한 줄로 표시한다. */
export function metricRangeText(
  metric: CircularMetricKey,
  lower: Claim | null | undefined,
  upper?: Claim | null,
): string | null {
  const first = metricText(metric, lower);
  const last = metricText(metric, upper);
  if (!first || !last || first === last) return first;
  const [number, ...unit] = first.split(" ");
  const lastUnit = last.split(" ").slice(1).join(" ");
  return unit.length === 1 && unit[0] === lastUnit
    ? `${number}~${last}`
    : `${first} ~ ${last}`;
}

export function kgText(claim: Claim | null | undefined): string | null {
  const value = numeric(claim);
  return value === null ? null : `${formatNumber(Math.round(value))} kg`;
}

/** 합계 칸의 상태 낱말. partial이면 부분합이라고 밝힌다 */
export function totalStatusText(total: CircularTotal | undefined): string {
  if (!total) return "계산하지 않음";
  return {
    estimated: "산정함",
    partial: "산정한 폐기물만 더한 부분합",
    hold: "산정 보류",
    zero: "변화 없음",
  }[total.status];
}

/** 폐기물 한 줄의 지표 상태 낱말 */
export function metricStatusText(metric: CircularMetric): string {
  if (metric.status === "hold") return "산정 보류";
  if (metric.status === "zero") return "변화 없음";
  return metric.method ? METHOD_NAME[metric.method] : "산정함";
}

export function scenarioOf(circular: Circular, id: CircularScenario["id"]): CircularScenario | undefined {
  return circular.scenarios.find((item) => item.id === id);
}

/** 기준선(현행) 요약. 예: "소각 4가지" */
export function baselineSummary(circular: Circular): string {
  const parts = Object.entries(circular.baselines)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${BASELINE_NAME[key] ?? key} ${count}가지`);
  return parts.join(" · ") || "확인 필요";
}

/** 묶음 수거 문장(B와 A의 차이). 숫자는 화면이 claim으로 따로 그린다 */
export function bundleSentence(circular: Circular): string {
  const bundle = circular.bundle;
  if (!bundle.available) return "폐기물·업체 조합이 많아 묶음 없는 배정을 따로 계산하지 않았습니다.";
  if (bundle.streams.length === 0) {
    return "이 공장은 폐기물마다 따로 보내도 업체 최소 물량을 채워, 묶음 수거로 더 재활용되는 물량이 없습니다.";
  }
  const names = bundle.streams.map((item) => item.streamName ?? item.streamId).join(", ");
  return `묶음 수거가 성사되면 소량이라 업체 최소 물량을 혼자 채우지 못하던 ${josa(names, "을/를")} 재활용 경로로 전환할 수 있습니다.`;
}

export const TRANSPORT_NOTE =
  "묶음 수거가 운송 배출을 늘 줄이지는 않습니다. 운송 효과는 거리·차량·적재율·방문 횟수로 따로 비교해야 합니다.";

export const LANDFILL_NOTE =
  "매립은 온실가스 수치가 소각보다 낮게 나올 수 있지만 원료를 회수하지 않아 신재를 대신하지 못하고, 소각에서 얻던 전기·열도 잃습니다. 탄소 수치만으로 자원순환에 더 낫다고 보지 않으며 추천하지 않습니다.";

/** 출처 한 줄 머리: "EU · 2021 · Annex 5 (B), 인쇄 p.44" */
export function sourceHead(source: Circular["sources"][number]): string {
  return [source.country ?? source.region, source.year ? String(source.year) : null, source.table].filter(Boolean).join(" · ");
}

export function sourceBaseline(source: Circular["sources"][number]): string | null {
  if (!source.baseline) return null;
  return `기준선: ${source.baseline === "incineration" ? "에너지 회수 소각" : (BASELINE_NAME[source.baseline] ?? source.baseline)}`;
}
