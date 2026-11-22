/**
 * 같은 산업단지의 자원순환 후보(결과 한 장의 complexPartners)의 화면 문구와 묶음. 순수 함수만 둔다(tests/complex.test.ts).
 * 후보는 회사가 신고한 생산품과 공공 허가 명부로 찾은 곳이다. 다른 회사의 물량은 쓰지 않았고, 그 회사들에 아무것도
 * 보내지 않았으며, 단가를 몰라 한 달 차이 계산에 넣지 않았다는 사실을 화면에 그대로 적는다.
 */
import type { ComplexCandidate, ComplexPartners } from "./types.ts";

/** 칩 색. StatusChip의 tone과 같은 이름이다 */
export type ComplexTone = "neutral" | "warn";

export type ComplexGroup = {
  streamIds: string[];
  takes: ComplexCandidate[];
  uses: ComplexCandidate[];
  takesTotal: number;
  usesTotal: number;
  reason: string | null;
};

/** 후보가 같은 폐기물끼리 묶는다(재질이 같으면 같은 곳이 나온다). 순서는 처음 나온 폐기물 순이다 */
export function groupComplex(partners: ComplexPartners): ComplexGroup[] {
  const groups: ComplexGroup[] = [];
  const byKey = new Map<string, ComplexGroup>();
  for (const stream of partners.streams) {
    const ids = [...stream.takes, ...stream.uses].map((item) => item.id);
    const key = ids.length > 0 ? `${ids.join("|")}#${stream.takesTotal}#${stream.usesTotal}` : `none:${stream.streamId}`;
    const found = byKey.get(key);
    if (found) {
      found.streamIds.push(stream.streamId);
      continue;
    }
    const group = {
      streamIds: [stream.streamId],
      takes: stream.takes,
      uses: stream.uses,
      takesTotal: stream.takesTotal,
      usesTotal: stream.usesTotal,
      reason: stream.reason,
    };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

/** 화면에 보이는 서로 다른 회사 수(받는 곳과 쓰는 곳을 함께 센다) */
export function uniquePartners(partners: ComplexPartners): number {
  return new Set(partners.streams.flatMap((stream) => [...stream.takes, ...stream.uses].map((item) => item.id))).size;
}

export function complexHeadline(partners: ComplexPartners): string {
  if (!partners.complex) return "같은 산업단지의 자원순환 후보";
  const count = uniquePartners(partners);
  return count > 0
    ? `${partners.complex.name} 안의 자원순환 후보 ${count}곳`
    : `${partners.complex.name} 안에서는 맞는 곳을 찾지 못했습니다`;
}

export const COMPLEX_LEAD =
  "같은 단지 회사가 신고한 생산품과 공공 허가 명부로 찾은 곳입니다. 다른 회사의 물량은 쓰지 않았고, 이 회사들에 아무것도 보내지 않았습니다. 단가를 몰라 한 달 차이 계산에는 넣지 않았습니다.";

export const TAKES_TITLE = "받아서 재생원료로 만드는 곳";
export const USES_TITLE = "재생원료를 쓸 수 있는 곳";
export const USES_NOTE =
  "폐기물을 바로 넘기는 곳이 아니라, 재활용 업체가 만든 재생원료를 쓸 수 있는 곳입니다. 재활용 업체와 이야기할 때 같은 단지의 판로로 알려 줄 수 있습니다.";
/** 허가 명부에 없는 곳의 안내(사업장폐기물은 그 폐기물의 재활용 허가·신고가 있는 곳에만 넘길 수 있다) */
export const UNLISTED_NOTE =
  "공공 허가 명부에서 찾지 못했습니다. 폐기물을 넘기려면 이 회사가 이 폐기물의 재활용 허가나 신고를 갖고 있는지 먼저 확인해 주세요.";

/** 받는 곳의 허가 칩. 허가 명부의 처리 품목까지 맞을 때만 무채색이다 */
export function permitChip(candidate: ComplexCandidate): { tone: ComplexTone; label: string } {
  switch (candidate.permit?.status) {
    case "listed":
      return { tone: "neutral", label: "허가 품목 맞음" };
    case "listed_check":
      return { tone: "warn", label: "재활용업 허가 · 처리 품목 확인 필요" };
    default:
      return { tone: "warn", label: "재활용 허가 확인 필요" };
  }
}

/** 생산품에 적힌 재질이 이 폐기물과 같은지 */
export function resinChip(candidate: ComplexCandidate): { tone: ComplexTone; label: string } {
  return candidate.resinMatch === "named"
    ? { tone: "neutral", label: `${candidate.resins.join("·")} 생산품` }
    : { tone: "warn", label: "재질 확인 필요" };
}

/** 후보 줄의 설명: 생산품 원문(따옴표) · 허가 업종. 허가 명부에만 있는 곳은 업종만 */
export function candidateLine(candidate: ComplexCandidate): string {
  const parts = [];
  if (candidate.product) parts.push(`생산품 “${candidate.product}”`);
  if (candidate.permit?.business) parts.push(candidate.permit.business);
  return parts.join(" · ");
}

/** 견적 요청서를 만들 수 있는 곳(허가 명부에 있는 받는 곳)의 명부 업체 ID */
export function quoteVendorId(candidate: ComplexCandidate): string | null {
  return candidate.role === "takes" ? (candidate.permit?.vendorId ?? null) : null;
}

/** 허가 명부 업체 하나가 받는 곳 후보인 폐기물 ID(견적 요청서에서 고를 수 있는 폐기물) */
export function complexStreamIds(partners: ComplexPartners, vendorId: string): string[] {
  return partners.streams
    .filter((stream) => stream.takes.some((item) => quoteVendorId(item) === vendorId))
    .map((stream) => stream.streamId);
}

/** 보이지 않은 나머지 수. "그 밖에 3곳이 더 있습니다" */
export function moreLine(total: number, shown: number): string | null {
  return total > shown ? `그 밖에 ${total - shown}곳이 더 있습니다.` : null;
}

export function complexSourceLine(partners: ComplexPartners): string {
  const { factories, registry } = partners.source;
  const range = registry.asOfRange;
  const when = range && range.length === 2 ? `(기준일 ${range[0]}~${range[1]})` : "";
  const stats = partners.stats
    ? ` 단지 집계: ${partners.stats.source.name}(${partners.stats.dataYear}년 실적, 공표 ${partners.stats.source.publishedOn}).`
    : "";
  return `출처: ${factories.name}(기준일 ${factories.asOf}), ${registry.name}${when}. ${factories.note}${stats}`;
}

/** 단지 집계 문장의 앞말. 단지 전체 합계이고 회사별 값이 아니라는 것을 숨기지 않는다 */
export function complexStatsLead(stats: NonNullable<ComplexPartners["stats"]>): string {
  return `이 단지 공장들이 ${stats.dataYear}년에 내보낸 폐합성수지(단지 전체 합계)`;
}
