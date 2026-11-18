/**
 * 가입하지 않은 처리 업체 후보(공공데이터 허가 명부)의 화면 문구와 묶음. 순수 함수만 둔다(tests/outside.test.ts).
 * 후보는 AI가 대화하지 않았고 손익 계산에도 넣지 않았다는 사실을 화면에 그대로 적는다.
 */
import type { OutsideCandidate, OutsideVendors } from "./types.ts";

export type OutsideGroup = {
  streamIds: string[];
  candidates: OutsideCandidate[];
  total: number;
  reason: string | null;
};

/** 후보 목록이 같은 폐기물끼리 묶는다(재질이 같으면 같은 업체가 나온다). 순서는 처음 나온 폐기물 순이다 */
export function groupOutside(outside: OutsideVendors): OutsideGroup[] {
  const groups: OutsideGroup[] = [];
  const byKey = new Map<string, OutsideGroup>();
  for (const stream of outside.streams) {
    const key = stream.candidates.length > 0 ? stream.candidates.map((item) => item.id).join("|") : `none:${stream.streamId}`;
    const found = byKey.get(key);
    if (found) {
      found.streamIds.push(stream.streamId);
      continue;
    }
    const group = {
      streamIds: [stream.streamId],
      candidates: stream.candidates,
      total: stream.total,
      reason: stream.reason,
    };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

export function uniqueCandidates(outside: OutsideVendors): number {
  return new Set(outside.streams.flatMap((stream) => stream.candidates.map((item) => item.id))).size;
}

export function outsideHeadline(count: number): string {
  return count > 0 ? `가입하지 않은 업체 ${count}곳도 찾았습니다` : "가입하지 않은 업체 가운데 맞는 곳을 찾지 못했습니다";
}

export const OUTSIDE_LEAD =
  "공공데이터에 공개된 폐기물처리업 허가 정보로 찾은 곳입니다. 아직 가입하지 않아 AI가 대화하지 않았고 한 달 차이 계산에도 넣지 않았습니다. 견적 요청서를 만들어 직접 물어볼 수 있습니다.";

export function matchLabel(candidate: OutsideCandidate): string {
  return candidate.match === "confirmed" ? "허가 품목 맞음" : "처리 품목 확인 필요";
}

export function phoneText(candidate: OutsideCandidate): string {
  if (candidate.phone) return candidate.phone;
  return candidate.agency ? `전화번호 없음 · ${candidate.agency}에 문의` : "전화번호 없음";
}

export function sourceLine(outside: OutsideVendors): string {
  const range = outside.source.asOfRange;
  const when = range && range.length === 2 ? `, 기준일 ${range[0]}~${range[1]}` : "";
  return `출처: ${outside.source.name}${when}. 지자체가 올린 정보라 명부에 없는 업체도 있고, 처리 품목이 바뀌었을 수 있습니다.`;
}

/** 복사할 글. 회신 연락처는 담당자가 적은 것을 끝에 붙인다(앱은 담당자 전화번호를 저장하지 않는다) */
export function copyText(rendered: string, contact: string): string {
  const line = contact.trim() ? `연락처: ${contact.trim()}` : "연락처: (보내기 전에 적어 주세요)";
  return `${rendered.trimEnd()}\n${line}\n`;
}

export function groupTitle(names: string[]): string {
  if (names.length === 0) return "폐기물";
  return names.length > 2 ? `${names.slice(0, 2).join(" · ")} 외 ${names.length - 2}가지` : names.join(" · ");
}
