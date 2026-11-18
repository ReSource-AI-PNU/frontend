/**
 * 분리 개선 안내(결과 한 장의 improvements)의 화면 문구와 묶음. 순수 함수만 둔다(tests/improve.test.ts).
 * 2026-11-19 배출 사업장 설문의 "사내에서 판매용으로 정확히 분류하기가 어렵다(재질별로 혼입이 생겨 업체가 가져가지 않는다)"에
 * 답한다. 숫자는 화면에서 근거가 붙은 값(ClaimValue)으로 그리고, 여기서는 숫자를 만들지 않는다.
 */
import { josa } from "../josa.ts";
import type { Improvement, ImprovementActionKey } from "./types.ts";

/** 거의 모든 폐기물에 붙는 기록 습관. 폐기물마다 되풀이하지 않고 한 줄로 모은다 */
const COMMON_KEYS: ImprovementActionKey[] = ["measure", "weigh"];

const COMMON_TEXT: Record<string, string> = {
  measure: "오염도와 수분을 한 번 재서 자료 화면에 적어 두면, 업체가 조건부로 받겠다던 것을 확정으로 바꿀 수 있습니다.",
  weigh: "내보낼 때마다 무게를 계량해 기록하면, 업체의 최소 물량 조건을 바로 확인할 수 있습니다.",
};

export type ImproveStream = {
  streamId: string;
  name: string;
  option: Improvement["option"];
  split: Improvement["split"];
  /** 이 폐기물에만 해당하는 할 일(떼어 내기, 재질별로 모으기, 오염도·수분 낮추기) */
  actions: { key: ImprovementActionKey; text: string }[];
};

export type ImprovePlan = {
  headline: string;
  streams: ImproveStream[];
  common: { key: ImprovementActionKey; text: string; names: string[] }[];
};

function gainOf(item: Improvement): number {
  const value = item.option?.monthlyGain?.value;
  return typeof value === "number" ? value : 0;
}

/**
 * 폐기물을 더 받는 길이 있는 것(한 달 차이가 큰 순) → 재질별로 나누는 길이 있는 것 → 할 일만 있는 것 순으로 세운다.
 * 기록 습관(측정, 계량)은 폐기물 이름을 모아 한 줄씩 적는다.
 */
export function planImprovements(items: Improvement[], nameOf: (streamId: string) => string): ImprovePlan {
  const rank = (item: Improvement) => (item.option ? 0 : item.split.length > 0 ? 1 : 2);
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || gainOf(b) - gainOf(a));
  const streams: ImproveStream[] = [];
  const common = new Map<ImprovementActionKey, string[]>();
  for (const item of sorted) {
    const name = nameOf(item.streamId);
    for (const action of item.actions) {
      if (!COMMON_KEYS.includes(action.key)) continue;
      common.set(action.key, [...(common.get(action.key) ?? []), name]);
    }
    const actions = item.actions.filter((action) => !COMMON_KEYS.includes(action.key));
    if (!item.option && item.split.length === 0 && actions.length === 0) continue;
    streams.push({ streamId: item.streamId, name, option: item.option, split: item.split, actions });
  }
  const better = items.filter((item) => gainOf(item) > 0).length;
  const splits = items.filter((item) => item.split.some((part) => part.vendorOrgId)).length;
  const headline =
    better > 0
      ? `손질하면 한 달 손익이 나아지는 폐기물이 ${better}가지 있습니다`
      : splits > 0
        ? "재질별로 나누면 받는 곳이 생기는 폐기물이 있습니다"
        : "폐기물마다 해 두면 좋은 일을 정리했습니다";
  return {
    headline,
    streams,
    common: COMMON_KEYS.filter((key) => common.has(key)).map((key) => ({
      key,
      text: COMMON_TEXT[key],
      names: common.get(key) ?? [],
    })),
  };
}

export const IMPROVE_LEAD =
  "대화한 업체의 매입 기준표에서, 지금보다 더 받는 기준인데 오염도나 수분만 넘어서 못 받는 것을 골랐습니다. 실제로 그 등급을 받을지는 업체의 반입 검수가 정합니다.";

/** 등급 이름. "A" → "A등급", "등외"는 그대로 */
export function gradeText(grade: string | null): string {
  if (!grade) return "기준";
  return /^[A-Za-z0-9]+$/.test(grade) ? `${grade}등급` : grade;
}

/** 낮춰야 할 것. ["오염도", "수분"] → "오염도와 수분" */
export function needsText(needs: string[]): string {
  if (needs.length === 0) return "품질";
  if (needs.length === 1) return needs[0];
  return `${needs.slice(0, -2).map((item) => `${item}, `).join("")}${josa(needs.at(-2) ?? "", "와/과")} ${needs.at(-1)}`;
}

/** 섞인 재질을 나눴을 때 그 재질을 받는 곳이 없을 때의 문장 */
export function splitNobody(material: string): string {
  return `${material}만 따로 모아도 지금 대화한 업체 가운데 받는 곳이 없습니다. 아래 가입하지 않은 업체에 물어볼 수 있습니다.`;
}

export const SPLIT_LEAD = "재질별로 따로 모으면 이렇게 받습니다.";

export const IMPROVE_FOOT =
  "한 달 차이는 그 기준 단가에서 지금 kg당 손익을 빼고 한 달 발생량을 곱한 값입니다. 검수에서 기준 안으로 확인되면 받는 금액이고, 운반비와 손질에 드는 시간은 넣지 않았습니다.";
