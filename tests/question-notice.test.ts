/**
 * 담당자 답이 필요한 질문 알림(src/lib/v3/question-notice.ts). 실행 중에 온 질문 묶음이 대화 패널 뒤에 가리지 않게 한다.
 * 실행: node --test tests/question-notice.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_NOTICE,
  noticeChange,
  noticePlacement,
  noticeText,
  pendingQuestionIds,
  sameMark,
  shouldCloseTalk,
  type NoticeMark,
} from "../src/lib/v3/question-notice.ts";

const emitter = { isEmitter: true, replaying: false, readOnly: false };
const q = (id: string, batch: number, answered = false) => ({ id, batch, answered });

test("알릴 질문: 배출 기업이 자기 회사로 볼 때, 지금 묶음에서 답하지 않은 질문만", () => {
  const questions = [q("a", 1, true), q("b", 1), q("c", 2)];
  assert.deepEqual(pendingQuestionIds(questions, emitter), ["b"], "앞 묶음이 끝나기 전에는 다음 묶음을 알리지 않는다");
  assert.deepEqual(pendingQuestionIds([q("a", 1, true), q("c", 2), q("d", 2)], emitter), ["c", "d"]);
  assert.deepEqual(pendingQuestionIds([q("a", 1, true)], emitter), [], "다 답했으면 알리지 않는다");
  // 업체 화면, 다시 보기, 체험하기에서는 답할 사람이 없다
  assert.deepEqual(pendingQuestionIds(questions, { ...emitter, isEmitter: false }), []);
  assert.deepEqual(pendingQuestionIds(questions, { ...emitter, replaying: true }), []);
  assert.deepEqual(pendingQuestionIds(questions, { ...emitter, readOnly: true }), []);
  // 묶음 번호가 없는 예전 질문은 답하지 않은 것 전부
  assert.deepEqual(pendingQuestionIds([{ id: "x", answered: false }, { id: "y", answered: true }], emitter), ["x"]);
});

test("새로 알릴 일: 처음 보는 질문이 오면 arrived, 실행이 끝나 답할 수 있게 되면 answerable", () => {
  const running: NoticeMark = { ids: ["b"], answerable: false };
  assert.equal(noticeChange(NO_NOTICE, running), "arrived", "실행 중에 질문 묶음(question 이벤트)이 왔다");
  assert.equal(noticeChange(running, { ids: ["b"], answerable: true }), "answerable", "진행이 끝나 답하기가 켜졌다");
  assert.equal(noticeChange(running, running), null);
  assert.equal(noticeChange({ ids: ["b"], answerable: true }, { ids: ["b", "c"], answerable: true }), "arrived");
  assert.equal(noticeChange({ ids: ["b", "c"], answerable: true }, { ids: ["c"], answerable: true }), null, "답해서 줄어든 것은 알리지 않는다");
  assert.equal(noticeChange({ ids: ["c"], answerable: true }, { ids: ["c"], answerable: false }), null, "답을 보내는 동안 꺼진 것은 알리지 않는다");
  assert.equal(noticeChange(running, NO_NOTICE), null, "남은 질문이 없으면 알리지 않는다");
  // 렌더 중에 고칠지 정하는 비교는 값으로 한다
  assert.equal(sameMark({ ids: ["b"], answerable: false }, { ids: ["b"], answerable: false }), true);
  assert.equal(sameMark({ ids: ["b"], answerable: false }, { ids: ["b"], answerable: true }), false);
  assert.equal(sameMark({ ids: ["b"], answerable: true }, { ids: ["c"], answerable: true }), false);
});

test("좁은 화면에서는 새로 알릴 일이 생기면 열린 대화 패널을 닫는다(넓은 화면은 패널 맨 위에 알린다)", () => {
  assert.equal(shouldCloseTalk("arrived", { talkOpen: true, narrow: true }), true);
  assert.equal(shouldCloseTalk("answerable", { talkOpen: true, narrow: true }), true);
  assert.equal(shouldCloseTalk("arrived", { talkOpen: true, narrow: false }), false);
  assert.equal(shouldCloseTalk("arrived", { talkOpen: false, narrow: true }), false);
  assert.equal(shouldCloseTalk(null, { talkOpen: true, narrow: true }), false, "이미 알린 질문으로 다시 닫지 않는다(사용자가 다시 연 패널)");
});

test("알림 자리: 패널이 열려 있으면 패널 맨 위, 닫혀 있으면 질문 칸이 화면 밖일 때만 본문 맨 위", () => {
  assert.deepEqual(noticePlacement({ pending: 2, talkOpen: true, formInView: true }), { panel: true, page: false });
  assert.deepEqual(noticePlacement({ pending: 2, talkOpen: false, formInView: false }), { panel: false, page: true });
  assert.deepEqual(noticePlacement({ pending: 2, talkOpen: false, formInView: true }), { panel: false, page: false });
  assert.deepEqual(noticePlacement({ pending: 0, talkOpen: true, formInView: false }), { panel: false, page: false });
});

test("알림 글: '담당자 답이 필요합니다 · 답하러 가기', 진행 중이면 언제 답할 수 있는지 덧붙인다", () => {
  assert.deepEqual(noticeText(2, true), { title: "담당자 답이 필요합니다", detail: "질문 2가지", action: "답하러 가기" });
  assert.equal(noticeText(1, false).detail, "질문 1가지 · 진행이 끝나면 답할 수 있습니다");
});
