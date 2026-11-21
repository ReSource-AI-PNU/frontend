/**
 * 업체 정보 AI 도우미의 순수 함수(화면 글, 초안 묶기, 저장할 항목 고르기).
 * 네트워크도 React도 부르지 않는다(tests/onboarding.test.ts).
 */
import type { OnboardingCheck, OnboardingDraftItem, OnboardingSection, OnboardingState } from "./types";

/** 초안 묶음의 순서와 이름. 업체 정보 화면의 순서(허가 품목 → AI가 지킬 범위 → 노선·차량)를 따른다 */
export const SECTION_ORDER: OnboardingSection[] = ["permits", "process", "guardrails", "fleet"];
export const SECTION_LABEL: Record<OnboardingSection, string> = {
  permits: "허가 품목",
  process: "처리 방식",
  guardrails: "AI가 지킬 범위",
  fleet: "노선·차량",
};

/** 초안을 묶음 순서대로 나눈다. 빈 묶음은 뺀다 */
export function groupDraft(draft: OnboardingDraftItem[]): { section: OnboardingSection; label: string; items: OnboardingDraftItem[] }[] {
  return SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABEL[section],
    items: draft.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
}

/** 맨 위 한 줄 요약. 탐색에 나오면 그 사실만, 아니면 남은 항목 이름을 적는다 */
export function checkSummary(checks: OnboardingCheck[], discoverable: boolean): string {
  if (discoverable) return "배출 기업이 찾기를 하면 이 업체가 후보로 나옵니다.";
  const left = checks.filter((check) => !check.done);
  if (left.length === 0) return "업체 탐색에 나오려면 허가 품목이나 매입 기준이 필요합니다.";
  return `업체 탐색에 나오려면 ${left.length}가지가 남았습니다 · ${left.map((check) => check.label).join(", ")}`;
}

/** 대화와 초안을 처음에 펼쳐 둘지. 아직 탐색에 나오지 않거나 확인할 초안이 있으면 펼친다 */
export function startOpen(state: Pick<OnboardingState, "discoverable" | "draft">): boolean {
  return !state.discoverable || state.draft.length > 0;
}

/** 저장할 항목: 초안에 있는 항목 가운데 담당자가 빼지 않은 것. 새로 들어온 항목은 골라 둔 채로 시작한다 */
export function selectedKeys(draft: OnboardingDraftItem[], unselected: Set<string>): string[] {
  return draft.map((item) => item.key).filter((key) => !unselected.has(key));
}

/** 말풍선 위 작성자. 모델 없이 정해 둔 안내 문장이면 "자동 안내"라고 밝힌다(DESIGN.md 정직한 이름) */
export function authorLabel(model: OnboardingState["model"], aiName: string): string {
  return model?.provider === "rule" ? "자동 안내" : aiName;
}
