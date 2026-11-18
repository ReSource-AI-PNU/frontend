/**
 * AI 작업실(실시간 진행의 캐릭터 화면)의 상태. 순수 함수만 둔다(tests/stage.test.ts).
 *
 * - 회사 측 AI와 업체 측 AI는 모델이 쓰는 대화 상대다. 업체마다 하나씩 나온다.
 * - 전문 담당 여섯은 대회 6단계의 판단 도구다. 모델이 아니라 계산과 검색으로 판단하고 근거를 남기므로
 *   화면에서도 "AI"라고 부르지 않고 "전문 담당"으로 적는다(정직한 표시).
 */
import { josa } from "../josa.ts";
import { typingText, type FeedLine, type LiveState, type LiveThread } from "./live.ts";

export type SlimeState = "wait" | "idle" | "work" | "talk" | "done";

export const SPECIALISTS = [
  {
    stage: 1,
    name: "오염도 판정",
    role: "사진·측정값으로 재질과 등급을 매깁니다",
  },
  {
    stage: 2,
    name: "경로 판단",
    role: "재투입·매각·열분해 가운데 갈 길을 따집니다",
  },
  {
    stage: 3,
    name: "법률 검토",
    role: "허가 품목과 지켜야 할 조항을 찾습니다",
  },
  { stage: 4, name: "업체 탐색", role: "받을 수 있는 업체를 찾습니다" },
  { stage: 5, name: "비용·탄소", role: "한 달 비용과 탄소를 계산합니다" },
  { stage: 6, name: "배정 최적화", role: "가장 나은 조합을 고릅니다" },
] as const;

export type SpecialistView = {
  stage: number;
  name: string;
  role: string;
  state: SlimeState;
  line: string | null;
};
export type TalkerView = {
  id: string;
  name: string;
  state: SlimeState;
  line: string | null;
  outcome: string | null;
};

const TOOL_PREFIX = "판단 도구 · ";

/** 진행 기록 한 줄을 전문 담당의 말로 바꾼다. "판단 도구 · 업체 찾기: 확인됨" → "업체 찾기를 마쳤습니다" */
export function specialistLine(line: FeedLine): string {
  const text = line.text.trim();
  if (!text.startsWith(TOOL_PREFIX)) return text;
  const [label, status] = text.slice(TOOL_PREFIX.length).split(/:\s*/, 2);
  if (!status || status === "확인됨") return `${josa(label, "을/를")} 마쳤습니다`;
  if (status === "조건부") return `${label} · 조건이 붙었습니다`;
  if (status === "확인 필요") return `${label} · 확인할 것이 남았습니다`;
  if (status === "실패") return `${label} · 담당자 확인이 필요합니다`;
  return `${label} · ${status}`;
}

/** 단계마다 마지막 기록. 대화에 붙은 기록(threadId)은 대화 상대의 말이라 빼고, 단계가 있는 것만 본다 */
function lastByStage(feed: FeedLine[]): Map<number, FeedLine> {
  const found = new Map<number, FeedLine>();
  for (const line of feed) {
    if (line.stage == null || line.threadId) continue;
    found.set(line.stage, line);
  }
  return found;
}

export function specialists(live: LiveState): SpecialistView[] {
  const last = lastByStage(live.feed);
  const status = new Map((live.stages ?? []).map((item) => [item.stage, item.status]));
  return SPECIALISTS.map((item) => {
    const line = last.get(item.stage) ?? null;
    const current = !live.done && live.stage === item.stage;
    const stageStatus = status.get(item.stage);
    let state: SlimeState = "wait";
    if (current) state = line ? "talk" : "work";
    else if (stageStatus === "done" || stageStatus === "needs_check") state = "done";
    else if (stageStatus === "running" || line) state = "idle";
    return { ...item, state, line: line ? specialistLine(line) : null };
  });
}

const OUTCOME_WORD: Record<string, string> = {
  agreed: "합의",
  confirmed: "확정",
  handoff: "담당자 확인",
  declined: "거절",
  closed: "닫힘",
  open: "대화 중",
};

function talkerState(thread: LiveThread, done: boolean): SlimeState {
  if (thread.typing) return thread.typing.phase === "drafting" ? "talk" : "work";
  if (thread.outcome === "agreed" || thread.outcome === "confirmed") return "done";
  if (thread.handoff || thread.outcome === "declined") return "wait";
  return done ? "done" : "idle";
}

function vendorTypingText(typing: NonNullable<LiveThread["typing"]>): string {
  if (typing.phase === "drafting") return "답을 쓰는 중";
  return typingText(typing);
}

/** 업체 측 AI들(대화를 연 순서). 회사 측 AI가 쓰는 중이면 업체 쪽은 기다리는 중이다 */
export function vendors(live: LiveState): TalkerView[] {
  return live.order
    .map((id) => live.threads[id])
    .filter((thread): thread is LiveThread => Boolean(thread))
    .map((thread) => {
      const vendorTyping = thread.typing?.side === "vendor" ? thread : { ...thread, typing: null };
      return {
        id: thread.id,
        name: thread.vendorName ?? "처리 업체",
        state: talkerState(vendorTyping, live.done),
        line: thread.typing?.side === "vendor" ? vendorTypingText(thread.typing) : thread.lastText,
        outcome: thread.outcome ? (OUTCOME_WORD[thread.outcome] ?? null) : null,
      };
    });
}

/** 회사 측 AI. 어느 대화에서든 회사 측이 쓰는 중이면 말하는 중이다 */
export function company(live: LiveState): TalkerView {
  const writing = Object.values(live.threads).find((thread) => thread.typing?.side === "company") ?? null;
  const lastThread = [...Object.values(live.threads)].sort((a, b) => b.touched - a.touched)[0] ?? null;
  let state: SlimeState = live.done ? "done" : "idle";
  let line = lastThread?.lastText ?? null;
  if (writing) {
    state = writing.typing?.phase === "drafting" ? "talk" : "work";
    line = `${writing.vendorName ?? "업체"}에 보낼 글 쓰는 중`;
  } else if (!live.done && live.stage !== null && Object.keys(live.threads).length === 0) {
    state = "work";
    line = "전문 담당의 판단을 모으는 중";
  }
  return { id: "company", name: "회사 측 AI", state, line, outcome: null };
}

/** 대화마다 지금 오가는 쪽(선을 밝힌다). 쓰는 쪽에서 받는 쪽으로 흐른다 */
export function flows(live: LiveState): { threadId: string; from: "company" | "vendor" }[] {
  return live.order
    .map((id) => live.threads[id])
    .filter((thread): thread is LiveThread => Boolean(thread?.typing))
    .map((thread) => ({
      threadId: thread.id,
      from: thread.typing?.side === "company" ? "company" : "vendor",
    }));
}
