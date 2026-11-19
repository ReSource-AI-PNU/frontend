/**
 * ③ 법령 요건 확인(결과 한 장의 regulation)의 화면 묶음과 문구. 순수 함수만 둔다(tests/regulation.test.ts).
 * 업체 허가는 폐기물마다 판정 결과를 표로, 담당자 할 일은 여러 폐기물에 같은 것이 걸리므로 한 번씩만 보인다.
 * 조항은 근거가 붙은 인용(claim)이라 화면에서 누르면 법령 원문이 열린다.
 */
import type { Claim, Regulation } from "./types.ts";

type Item = Regulation["items"][number];

export const ROUTE_WORD: Record<string, string> = {
  sell: "매각",
  treat: "위탁 처리",
  keep: "지금 방식 그대로",
  reuse: "공정 재투입",
};

export const STATUS_WORD: Record<Item["status"], string> = {
  met: "충족",
  conditional: "확인 필요",
  unmet: "불충족",
  needs_information: "확인 필요",
};

export type PermitRow = { streamId: string; name: string; route: string; status: Item["status"]; note: string; clauses: Claim[] };
export type Todo = {
  key: string;
  title: string;
  action: string;
  applies: string | null;
  clauses: Claim[];
  /** 이 할 일이 걸리는 폐기물 이름. 모든 폐기물에 걸리면 빈 목록 */
  only: string[];
};

export type RegulationPlan = {
  headline: string;
  permits: PermitRow[];
  todos: Todo[];
  related: Claim[];
  reuse: { names: string[]; todos: Todo[] } | null;
};

function todosOf(sections: { name: string; items: Item[] }[]): Todo[] {
  const byKey = new Map<string, Todo & { names: Set<string> }>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind !== "todo") continue;
      const found = byKey.get(item.key);
      if (found) {
        found.names.add(section.name);
        continue;
      }
      byKey.set(item.key, {
        key: item.key,
        title: item.title,
        action: item.action,
        applies: item.applies,
        clauses: item.clauses,
        only: [],
        names: new Set([section.name]),
      });
    }
  }
  const all = sections.map((s) => s.name);
  return [...byKey.values()].map(({ names, ...todo }) => ({
    ...todo,
    only: names.size === new Set(all).size ? [] : all.filter((name) => names.has(name)),
  }));
}

function uniqueClaims(claims: Claim[]): Claim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = claim.evidence[0] ?? claim.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function planRegulation(sections: Regulation[], nameOf: (streamId: string) => string): RegulationPlan {
  const permits: PermitRow[] = [];
  for (const section of sections) {
    const check = section.items.find((item) => item.kind === "check");
    if (!check) continue;
    permits.push({
      streamId: section.streamId,
      name: nameOf(section.streamId),
      route: ROUTE_WORD[section.route ?? ""] ?? "경로 확인 필요",
      status: check.status,
      note: check.note,
      clauses: check.clauses,
    });
  }
  const named = sections.map((section) => ({ name: nameOf(section.streamId), items: section.items }));
  const reuseSections = sections.filter((section) => section.reuse);
  const reuse =
    reuseSections.length > 0
      ? {
          names: reuseSections.map((section) => nameOf(section.streamId)),
          todos: todosOf(reuseSections.map((section) => ({ name: nameOf(section.streamId), items: section.reuse?.items ?? [] }))),
        }
      : null;
  const todos = todosOf(named);
  const blocked = permits.filter((row) => row.status !== "met").length;
  const headline =
    permits.length === 0
      ? "지켜야 할 법령 요건을 정리했습니다"
      : blocked === 0
        ? `받는 업체의 허가는 모두 확인했습니다. 담당자가 챙길 일이 ${todos.length}가지 있습니다`
        : `허가를 확인하지 못한 폐기물이 ${blocked}가지 있습니다`;
  return {
    headline,
    permits,
    todos,
    related: uniqueClaims(sections.flatMap((section) => section.related)),
    reuse,
  };
}

export const REGULATION_LEAD =
  "폐기물관리법과 시행령·시행규칙, 순환경제사회 전환 촉진법에서 이 경로에 걸리는 요건을 골랐습니다. 받는 업체의 허가는 허가증과 공공 허가 명부로 확인했고(업체가 입력만 한 허가는 확인 필요로 둡니다), 나머지는 서비스가 확인할 수 없어 담당자가 챙길 일로 적었습니다. 조항을 누르면 법령 원문이 열립니다.";

export const REGULATION_FOOT =
  "적용 조건(배출량, 지정폐기물 여부 등)은 사업장마다 다릅니다. 정확한 해당 여부는 관할 시·군·구청이나 폐기물 담당 부서에 확인하세요.";
