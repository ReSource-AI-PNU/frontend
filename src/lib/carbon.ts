import type { Route } from "@/lib/session/types";

/** 배출권(KAU) 가격. 줄인 탄소를 금액으로 바꾸는 참고값(가정) */
export const KAU_PER_T = 9000;

export const kauOf = (carbonT: number) => Math.round((-carbonT * KAU_PER_T) / 10) * 10;

export type CarbonBase = "virgin" | "landfill";

export const CARBON_BASE_LABEL: Record<CarbonBase, string> = { virgin: "신재 대비", landfill: "매립 대비" };

/**
 * 탄소 기준을 바꿔 본다. 저장된 값은 신재 대비(재활용으로 피한 신재 생산까지 셈)다.
 * 매립 대비는 같은 흐름을 매립했을 때(시나리오 D)와의 차이라, D가 0이 되고 나머지는 D보다 얼마나 더·덜 배출하는지가 된다.
 * 시나리오끼리의 차이는 기준과 관계없이 같다.
 */
export function rebaseCarbon(routes: Route[], base: CarbonBase): Route[] {
  const landfill = routes.find((r) => r.id === "D");
  if (base === "virgin" || !landfill) return routes;
  const lf = new Map(landfill.breakdown.map((b) => [b.streamId, b.carbonT]));
  const round = (n: number) => Math.round(n * 100) / 100;
  return routes.map((r) => {
    const carbonT = round(r.carbonT - landfill.carbonT);
    return {
      ...r,
      carbonT,
      kauKrw: kauOf(carbonT),
      breakdown: r.breakdown.map((b) => ({ ...b, carbonT: round(b.carbonT - (lf.get(b.streamId) ?? 0)) })),
    };
  });
}
