/**
 * 담당자 답이 필요한 질문 알림. 실행 중에 질문 묶음(question 이벤트)이 오거나 진단 뷰에 답하지 않은 질문이 남았는데
 * 대화 패널이 열려 있으면 질문이 패널 뒤에 가려 보이지 않는다. 그래서
 *  - 좁은 화면(패널이 본문을 다 덮는 폭)에서는 새로 알릴 일이 생기면 패널을 닫고,
 *  - 패널이 열려 있으면 패널 맨 위에, 닫혀 있고 질문 칸이 화면 밖이면 본문 맨 위에 붙는 알림
 *    ("담당자 답이 필요합니다 · 답하러 가기")을 둔다. 누르면 질문 칸으로 가서 첫 입력 칸에 초점을 둔다.
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/question-notice.test.ts).
 */
import { currentBundle } from "./format.ts";

export type NoticeQuestion = { id: string; answered: boolean; batch?: number | null };

/** 대화 패널(최대 640px)이 본문을 거의 다 덮는 폭. 이보다 좁으면 새 질문이 올 때 패널을 닫는다 */
export const NARROW_QUERY = "(max-width: 1023px)";

/**
 * 알릴 질문: 배출 기업이 자기 회사로 보는 화면(체험하기·다시 보기가 아님)에서 지금 묶음의 답하지 않은 질문.
 * 질문 칸이 그리는 것과 같은 묶음(currentBundle)이다.
 */
export function pendingQuestionIds(
  questions: NoticeQuestion[],
  viewer: { isEmitter: boolean; replaying: boolean; readOnly: boolean },
): string[] {
  if (!viewer.isEmitter || viewer.replaying || viewer.readOnly) return [];
  return currentBundle(questions)
    .filter((item) => !item.answered)
    .map((item) => item.id);
}

/** 앞서 알린 상태: 알린 질문과 그때 답할 수 있었는지 */
export type NoticeMark = { ids: string[]; answerable: boolean };

export const NO_NOTICE: NoticeMark = { ids: [], answerable: false };

export function sameMark(a: NoticeMark, b: NoticeMark): boolean {
  return a.answerable === b.answerable && a.ids.length === b.ids.length && a.ids.every((id, index) => id === b.ids[index]);
}

/**
 * 앞서 알린 것과 견주어 새로 알릴 일. 처음 보는 질문이 왔으면 "arrived", 남은 질문에 이제 답할 수 있게 됐으면
 * (실행이 끝났으면) "answerable", 없으면 null. 질문에 답해 줄어든 것은 알릴 일이 아니다.
 */
export function noticeChange(before: NoticeMark, now: NoticeMark): "arrived" | "answerable" | null {
  if (now.ids.length === 0) return null;
  const known = new Set(before.ids);
  if (now.ids.some((id) => !known.has(id))) return "arrived";
  if (now.answerable && !before.answerable) return "answerable";
  return null;
}

/** 새로 알릴 일이 생겼을 때 대화 패널을 닫는지: 좁은 화면에서는 패널이 질문을 다 가린다 */
export function shouldCloseTalk(change: "arrived" | "answerable" | null, screen: { talkOpen: boolean; narrow: boolean }): boolean {
  return change !== null && screen.talkOpen && screen.narrow;
}

/**
 * 알림을 둘 곳. 패널이 열려 있으면 패널 맨 위(본문은 패널과 어두운 막 뒤에 있다), 닫혀 있으면 질문 칸이 화면 밖일 때만
 * 본문 맨 위에 붙인다(질문 칸이 보이면 같은 말을 두 번 하지 않는다).
 */
export function noticePlacement(input: { pending: number; talkOpen: boolean; formInView: boolean }): { panel: boolean; page: boolean } {
  if (input.pending === 0) return { panel: false, page: false };
  return { panel: input.talkOpen, page: !input.talkOpen && !input.formInView };
}

/** 알림 글. 실행 중이면 답하기가 꺼져 있으므로 언제 답할 수 있는지 덧붙인다 */
export function noticeText(count: number, answerable: boolean): { title: string; detail: string; action: string } {
  return {
    title: "담당자 답이 필요합니다",
    detail: answerable ? `질문 ${count}가지` : `질문 ${count}가지 · 진행이 끝나면 답할 수 있습니다`,
    action: "답하러 가기",
  };
}
