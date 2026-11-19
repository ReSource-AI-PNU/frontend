/**
 * 실시간 진행(GET /sessions/{id}/stream, 백엔드 계약 8장 "실시간 진행")을 읽고 화면 상태로 모으는 순수 함수.
 * 네트워크도 React도 부르지 않는다(tests/live-stream.test.ts). 연결과 재연결은 live-client.ts가 한다.
 *
 * 이벤트(data는 JSON 한 줄, id는 seq)
 *   activity  두 AI·근거 검증·판단 도구가 한 일 한 줄. kind: drafting, validating, rejected, rewriting, sent, handoff,
 *             tool, question, status. sent·handoff에는 GET /sessions/{id}가 주는 것과 같은 message가 실린다.
 *   status    진단 상태·단계·단계별 상태
 *   question  담당자에게 묻는 묶음(배출 기업만 받는다)
 *   done      실행이 끝났고 기록을 다 보냈다
 *   error     서버가 스트림을 닫았다(code, message)
 * 화면에는 text, reasons(사용자 말로 쓴 거부 분류)만 쓰고 내부 거부 코드(codes, 운영 조직에만 온다)는 쓰지 않는다.
 * 실행이 멈출 때 대화마다 끝 상태(kind "status", threadOutcome: agreed·confirmed·declined·handoff·not_selected·ended·
 * waiting, text는 그 문장)가 오면 그 대화의 표시로 쓴다(뷰를 다시 읽기 전에도 탭이 "조건을 묻는 중"에 머물지 않게).
 * 진단 뷰의 threads[].outcome·outcomeText와 같은 값이다.
 */
import { josa } from "../josa.ts";
import { AI_NAME, REVIEWER_NAME as REVIEWER_LABEL, plainIds } from "./labels.ts";
import type { Question, ThreadMessage, ThreadOutcome, ThreadStatus } from "./types";

/* ── SSE 읽기 ─────────────────────────────────────────────────────── */

/** SSE 한 덩어리(빈 줄로 끝나는 묶음) */
export type RawSse = { event: string; data: string; id: string | null; retry: number | null };

/**
 * 조각으로 오는 SSE 글을 덩어리로 나눈다(HTML 표준 "event stream interpretation"). 조각 경계가 줄 가운데여도 된다.
 * 주석(":"로 시작, 백엔드의 15초 빈 줄)은 버린다. id가 있는 덩어리만 이어 받을 지점이 된다.
 */
export class SseParser {
  private buffer = "";
  private event = "";
  private data: string[] = [];
  private id: string | null = null;
  private retry: number | null = null;
  /** 줄 끝 \r 뒤에 \n이 이어 올 수 있어 다음 조각을 볼 때까지 기다린다 */
  private pendingCR = false;

  push(chunk: string): RawSse[] {
    let text = chunk;
    if (this.pendingCR && text.startsWith("\n")) text = text.slice(1);
    this.pendingCR = false;
    this.buffer += text;
    const out: RawSse[] = [];
    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer);
      if (!match) break;
      const line = this.buffer.slice(0, match.index);
      if (match[0] === "\r" && match.index + 1 === this.buffer.length) this.pendingCR = true;
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const done = this.line(line);
      if (done) out.push(done);
    }
    return out;
  }

  private line(line: string): RawSse | null {
    if (line === "") {
      if (this.data.length === 0 && !this.event) {
        this.retry = null;
        return null;
      }
      const ready: RawSse = { event: this.event || "message", data: this.data.join("\n"), id: this.id, retry: this.retry };
      this.event = "";
      this.data = [];
      this.retry = null;
      return ready;
    }
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
    else if (field === "id" && !value.includes("\0")) this.id = value;
    else if (field === "retry" && /^\d+$/.test(value)) {
      this.retry = Number(value);
      // retry만 있는 덩어리도 알린다(연결 간격을 바꾼다)
      if (this.data.length === 0 && !this.event) {
        const only: RawSse = { event: "", data: "", id: null, retry: this.retry };
        return only;
      }
    }
    return null;
  }
}

/* ── 이벤트 모양 ──────────────────────────────────────────────────── */

export type LiveSide = "company" | "vendor";
export type LiveAuthor = { side: LiveSide | null; kind: "agent" | "system"; label: string };
export type ActivityKind =
  | "drafting"
  | "validating"
  | "rejected"
  | "rewriting"
  | "sent"
  | "handoff"
  | "tool"
  | "question"
  | "status"
  | "review";

/**
 * 계약 검토 담당의 검토 한 번(kind "review", 백엔드 agents/reviewer.py). 두 AI가 합의한 뒤 승인 전에 조건을 다시 대조한
 * 결과다. summary는 검토 문장, items는 항목마다 상태(block 막힘 · check 확인할 것 · ok 통과)다.
 */
export type LiveReview = {
  status: "blocked" | "needs_check" | "clear";
  summary: string;
  items: { key: string; title: string; status: "block" | "check" | "ok"; text: string }[];
};

export type LiveActivity = {
  type: "activity";
  seq: number | null;
  at: string | null;
  stage: number | null;
  actor: string;
  kind: ActivityKind | (string & {});
  threadId: string | null;
  vendorOrgId: string | null;
  vendorName: string | null;
  author: LiveAuthor | null;
  text: string;
  /** sent·handoff에 실린 메시지(보는 조직이 볼 수 있을 때만) */
  message: ThreadMessage | null;
  /** rejected의 사유 분류(사용자 말). 예: "근거에 없는 숫자" */
  reasons: string[];
  /** sent 메시지에서 근거를 확인한 숫자·조항 수 */
  evidenceCount: number | null;
  attempt: number | null;
  /** 이 대화의 끝 상태(실행이 멈출 때 대화마다 온다). 없으면 null */
  threadOutcome: ThreadOutcome | null;
  /** kind "review"면 계약 검토 담당의 검토. 아니면 없다 */
  review?: LiveReview | null;
};
export type LiveStage = { stage: number; key: string | null; label: string | null; status: string };
export type LiveStatus = { type: "status"; seq: number | null; status: string | null; phase: string | null; stages: LiveStage[] | null };
export type LiveQuestions = { type: "question"; seq: number | null; stage: number | null; questions: Question[] };
export type LiveDone = { type: "done"; status: string | null; lastSeq: number | null };
export type LiveFailure = { type: "error"; code: string; message: string };
export type LiveEvent = LiveActivity | LiveStatus | LiveQuestions | LiveDone | LiveFailure;

type Json = Record<string, unknown>;
const isObj = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const SIDE_OF_ACTOR: Record<string, LiveSide> = { company_agent: "company", vendor_agent: "vendor" };
const AUTHOR_LABEL: Record<LiveSide, string> = AI_NAME;
const THREAD_OUTCOMES = new Set<string>(["agreed", "confirmed", "declined", "handoff", "not_selected", "ended", "waiting"]);

/** 대화의 끝 상태(threadOutcome). 모르는 값은 null */
function threadOutcomeOf(data: Json): ThreadOutcome | null {
  const given = str(data.threadOutcome);
  return given && THREAD_OUTCOMES.has(given) ? (given as ThreadOutcome) : null;
}

/** 작성자 표시. 백엔드는 {side, kind, label}을 주고, 계약 초안은 글자("회사 측 AI")만 준다. 둘 다 받는다 */
const REVIEW_STATUS = new Set(["blocked", "needs_check", "clear"]);
const ITEM_STATUS = new Set(["block", "check", "ok"]);

/** 검토 기록을 읽는다. 모양이 맞지 않는 항목은 버린다 */
export function reviewOf(raw: unknown, summary: string): LiveReview | null {
  if (!isObj(raw)) return null;
  const status = str(raw.status);
  if (!status || !REVIEW_STATUS.has(status)) return null;
  const items = (Array.isArray(raw.items) ? raw.items : []).flatMap((item) => {
    if (!isObj(item)) return [];
    const key = str(item.key);
    const title = str(item.title);
    const itemStatus = str(item.status);
    if (!key || !title || !itemStatus || !ITEM_STATUS.has(itemStatus)) return [];
    return [{ key, title, status: itemStatus as LiveReview["items"][number]["status"], text: str(item.text) ?? "" }];
  });
  return { status: status as LiveReview["status"], summary: str(raw.summary) ?? summary, items };
}

function authorOf(raw: unknown, actor: string): LiveAuthor | null {
  if (isObj(raw)) {
    const side = raw.side === "company" || raw.side === "vendor" ? raw.side : (SIDE_OF_ACTOR[actor] ?? null);
    const kind = raw.kind === "system" ? "system" : "agent";
    const label = str(raw.label) ?? (side ? AUTHOR_LABEL[side] : "자동 안내");
    return { side, kind, label };
  }
  const label = str(raw);
  const fromActor = SIDE_OF_ACTOR[actor] ?? null;
  if (label) {
    const side = label.startsWith("회사") ? "company" : label.startsWith("업체") ? "vendor" : fromActor;
    return { side, kind: label === "자동 안내" ? "system" : "agent", label };
  }
  return fromActor ? { side: fromActor, kind: "agent", label: AUTHOR_LABEL[fromActor] } : null;
}

function messageOf(raw: unknown): ThreadMessage | null {
  if (!isObj(raw)) return null;
  // 말풍선에 꼭 필요한 것만 확인한다. 나머지 모양은 GET /sessions/{id}의 메시지와 같다(schema.ts)
  if (typeof raw.id !== "string" || typeof raw.text !== "string" || typeof raw.seq !== "number") return null;
  const claims = Array.isArray(raw.claims) ? raw.claims : [];
  const validation = isObj(raw.validation) ? raw.validation : { ok: true };
  return { ...raw, claims, validation, streamIds: Array.isArray(raw.streamIds) ? raw.streamIds : [] } as ThreadMessage;
}

function stagesOf(raw: unknown): LiveStage[] | null {
  if (Array.isArray(raw)) {
    const list = raw.flatMap((item) => {
      if (!isObj(item) || num(item.stage) === null || !str(item.status)) return [];
      return [{ stage: item.stage as number, key: str(item.key), label: str(item.label), status: item.status as string }];
    });
    return list.length > 0 ? list : null;
  }
  // {"1": "done", "4": "running"} 모양도 받는다(이름은 화면의 단계 목록에서 찾는다)
  if (isObj(raw)) {
    const list = Object.entries(raw).flatMap(([key, value]) =>
      /^\d+$/.test(key) && typeof value === "string" ? [{ stage: Number(key), key: null, label: null, status: value }] : [],
    );
    return list.length > 0 ? list.sort((a, b) => a.stage - b.stage) : null;
  }
  return null;
}

function questionsOf(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Question => isObj(item) && typeof item.id === "string" && typeof item.text === "string");
}

/** SSE 덩어리 하나를 화면 이벤트로. 모르는 이벤트, 읽을 수 없는 data는 null */
export function toLiveEvent(raw: RawSse): LiveEvent | null {
  if (!raw.event || (raw.event === "message" && raw.data === "")) return null;
  let data: unknown = null;
  try {
    data = raw.data ? JSON.parse(raw.data) : {};
  } catch {
    return null;
  }
  if (!isObj(data)) return null;
  const seq = num(data.seq) ?? (raw.id !== null && /^\d+$/.test(raw.id) ? Number(raw.id) : null);
  switch (raw.event) {
    case "activity": {
      const actor = str(data.actor) ?? "system";
      const kind = str(data.kind) ?? "status";
      const reasons = Array.isArray(data.reasons)
        ? data.reasons.filter((item): item is string => typeof item === "string" && item !== "")
        : str(data.reason)
          ? [data.reason as string]
          : [];
      return {
        type: "activity",
        seq,
        at: str(data.at),
        stage: num(data.stage),
        actor,
        kind,
        threadId: str(data.threadId),
        vendorOrgId: str(data.vendorOrgId),
        vendorName: str(data.vendorName),
        author: authorOf(data.author, actor),
        text: str(data.text) ?? "",
        message: messageOf(data.message),
        reasons,
        evidenceCount: num(data.evidenceCount),
        attempt: num(data.attempt),
        threadOutcome: threadOutcomeOf(data),
        review: kind === "review" ? reviewOf(data.review, str(data.text) ?? "") : null,
      };
    }
    case "status":
      return { type: "status", seq, status: str(data.status), phase: str(data.phase), stages: stagesOf(data.stages) };
    case "question":
      return { type: "question", seq, stage: num(data.stage), questions: questionsOf(data.questions) };
    case "done":
      return { type: "done", status: str(data.status), lastSeq: num(data.lastSeq) };
    case "error":
      return { type: "error", code: str(data.code) ?? "STREAM_ERROR", message: str(data.message) ?? "" };
    default:
      return null;
  }
}

/* ── 화면 상태 ────────────────────────────────────────────────────── */

/** 말풍선이 나오기 전, 쓰는 쪽 AI의 지금 상태 */
export type Typing = { side: LiveSide; label: string; phase: "drafting" | "validating" | "rewriting"; reason: string | null };

export type LiveThread = {
  id: string;
  vendorOrgId: string | null;
  vendorName: string | null;
  /** 스트림으로 받은 메시지(뷰를 다시 읽기 전까지 말풍선으로 그린다) */
  messages: ThreadMessage[];
  typing: Typing | null;
  /** 이 대화에서 근거 확인이 돌려보낸 횟수 */
  rejections: number;
  /** 이 대화의 마지막 한 줄(예: "업체 측 AI가 제안을 보냈습니다.") */
  lastText: string | null;
  handoff: boolean;
  /** 실행이 멈출 때 받은 이 대화의 끝 상태와 그 문장 */
  outcome: ThreadOutcome | null;
  outcomeText: string | null;
  /** 계약 검토 담당이 이 대화의 합의 조건을 대조한 마지막 결과 */
  review: LiveReview | null;
  /** 마지막으로 바뀐 순서(목록 정렬) */
  touched: number;
};

export type FeedLine = { seq: number | null; at: string | null; stage: number | null; kind: string; text: string; threadId: string | null };

export type LiveState = {
  lastSeq: number;
  status: string | null;
  phase: string | null;
  stages: LiveStage[] | null;
  /** 지금 일하는 단계(마지막 활동의 단계) */
  stage: number | null;
  threads: Record<string, LiveThread>;
  order: string[];
  feed: FeedLine[];
  questions: Question[];
  done: boolean;
  error: LiveFailure | null;
};

export const FEED_LIMIT = 80;

export function initialLive(): LiveState {
  return {
    lastSeq: 0,
    status: null,
    phase: null,
    stages: null,
    stage: null,
    threads: {},
    order: [],
    feed: [],
    questions: [],
    done: false,
    error: null,
  };
}

/**
 * 다시 쓰는 중 문구. 사유가 명사로 끝나면 "근거에 없는 숫자가 있어 다시 쓰는 중",
 * 서술("…맞지 않음", "…오류")로 끝나면 "다시 쓰는 중 · 사유"로 쓴다.
 */
export function rewriteText(reason: string | null): string {
  if (!reason) return "다시 쓰는 중";
  if (/(음|함|류|패|됨)$/.test(reason)) return `다시 쓰는 중 · ${reason}`;
  return `${josa(reason, "이/가")} 있어 다시 쓰는 중`;
}

/** 말풍선 자리에 보일 지금 상태: 작성 중 → 근거 확인 중 → (거부되면) …있어 다시 쓰는 중 */
export function typingText(typing: Typing): string {
  if (typing.phase === "drafting") return "작성 중";
  if (typing.phase === "validating") return "근거 확인 중";
  return rewriteText(typing.reason);
}

/* ── 지금 하는 일을 한 줄로 ──────────────────────────────────────── */

/** 대회 6단계마다 화면 위에 적는 지금 하는 일 */
export const STAGE_TITLE: Record<number, string> = {
  1: "폐기물을 살펴보고 있습니다.",
  2: "받아 줄 수 있는 길을 따져 보고 있습니다.",
  3: "지켜야 할 규정을 확인하고 있습니다.",
  4: "받을 수 있는 업체를 찾고 있습니다.",
  5: "비용과 탄소를 견주고 있습니다.",
  6: "가장 나은 조합을 고르고 있습니다.",
};

/** 두 AI가 대화하는 중인지: 마지막 활동이 대화에 붙어 있거나 어느 대화에서 AI가 쓰는 중이다 */
export function isTalking(live: LiveState | null): boolean {
  if (!live || live.done) return false;
  if (Object.values(live.threads).some((thread) => thread.typing)) return true;
  const last = live.feed[live.feed.length - 1];
  return Boolean(last?.threadId) && last?.kind !== "tool";
}

/** 담당자 답을 기다리는지: 마지막 활동이 질문이거나 진단 상태가 답변 대기다 */
export function isWaitingAnswers(live: LiveState | null): boolean {
  if (!live || live.done) return false;
  return live.status === "awaiting_answers" || live.feed[live.feed.length - 1]?.kind === "question";
}

/**
 * 진행 화면 맨 위 한 줄. 지금 단계와 마지막 활동으로 정한다: 식별·분류 중에는 업체에 묻는다고 쓰지 않는다.
 * stage는 지금 도는 단계(없으면 null)다.
 */
export function liveTitle(input: { stage: number | null; live: LiveState | null; replaying?: boolean }): string {
  if (input.replaying) return "지난 찾기를 처음부터 다시 보여 드립니다.";
  if (isWaitingAnswers(input.live)) return "담당자 답을 기다리고 있습니다.";
  if (isTalking(input.live)) return "업체에 조건을 물어보고 있습니다.";
  return (input.stage !== null ? STAGE_TITLE[input.stage] : null) ?? "받아 줄 곳을 찾기 시작했습니다.";
}

/** 진행 기록 한 줄을 화면 말로. 판단 도구 줄의 머리("판단 도구 · ")를 떼고 내부 ID를 이름으로 바꾼다 */
export function feedText(line: Pick<FeedLine, "kind" | "text">): string {
  const text = plainIds(line.text, "판단 도구");
  return line.kind === "tool" ? text.replace(/^판단 도구\s*·\s*/, "") : text;
}

const TYPING_SHORT = { drafting: "작성 중", validating: "근거 확인 중", rewriting: "다시 쓰는 중" } as const;

/** 대화의 끝 상태(threadOutcome)를 탭에 쓰는 짧은 말 */
const OUTCOME_WORD: Record<ThreadOutcome, string> = {
  agreed: "조건이 맞음",
  confirmed: "확정",
  declined: "거절",
  handoff: "담당자가 이어받음",
  not_selected: "최적안에 들지 않음",
  ended: "합의 없이 끝남",
  waiting: "담당자 답을 기다림",
};

const THREAD_WORD: Record<string, string> = {
  not_opened: "아직 묻지 않음",
  open: "조건을 묻는 중",
  agreed: "조건이 맞음",
  declined: "거절",
  handoff: "담당자가 이어받음",
  confirmed: "확정",
};

/**
 * 대화 탭과 목록의 상태 낱말. 쓰는 중이면 그 단계, 실행이 멈췄으면 백엔드가 준 끝 상태(outcome), 아니면 대화 상태.
 * 끝 상태가 없는데(예전 서버) 실행이 끝났고 아직 "open"인 대화는 묻는 중이 아니므로 담당자 답을 기다리는지(질문 대기)
 * 합의 없이 멈췄는지로 적는다.
 */
export function threadLabel(
  thread: { status: ThreadStatus; typing: Typing | null; outcome?: ThreadOutcome | null },
  context: { working: boolean; sessionStatus: string | null },
): string {
  if (thread.typing) return TYPING_SHORT[thread.typing.phase];
  if (!context.working && thread.outcome) return OUTCOME_WORD[thread.outcome];
  if (thread.status !== "open") return THREAD_WORD[thread.status] ?? "";
  if (context.working) return THREAD_WORD.open;
  return context.sessionStatus === "awaiting_answers" ? "담당자 답을 기다리는 중" : "합의 없이 멈춤";
}

function sideOf(event: LiveActivity): LiveSide | null {
  return event.author?.side ?? SIDE_OF_ACTOR[event.actor] ?? null;
}

function withThread(state: LiveState, event: LiveActivity): { threads: Record<string, LiveThread>; order: string[]; thread: LiveThread } | null {
  if (!event.threadId) return null;
  const before = state.threads[event.threadId];
  const thread: LiveThread = before
    ? {
        ...before,
        vendorName: before.vendorName ?? event.vendorName,
        vendorOrgId: before.vendorOrgId ?? event.vendorOrgId,
      }
    : {
        id: event.threadId,
        vendorOrgId: event.vendorOrgId,
        vendorName: event.vendorName,
        messages: [],
        typing: null,
        rejections: 0,
        lastText: null,
        handoff: false,
        outcome: null,
        outcomeText: null,
        review: null,
        touched: 0,
      };
  const order = before ? state.order : [...state.order, event.threadId];
  return { threads: { ...state.threads, [event.threadId]: thread }, order, thread };
}

function addMessage(list: ThreadMessage[], message: ThreadMessage): ThreadMessage[] {
  if (list.some((item) => item.id === message.id)) return list;
  return [...list, message].sort((a, b) => a.seq - b.seq);
}

/** 이벤트 하나를 상태에 더한다. 이미 받은 seq는 다시 더하지 않는다(이어 받기·다시 붙기) */
export function reduceLive(state: LiveState, event: LiveEvent): LiveState {
  if (event.type === "done") {
    const threads = Object.fromEntries(Object.entries(state.threads).map(([id, thread]) => [id, { ...thread, typing: null }]));
    return { ...state, threads, done: true, status: event.status ?? state.status, lastSeq: Math.max(state.lastSeq, event.lastSeq ?? 0) };
  }
  if (event.type === "error") return { ...state, error: event };
  if (event.seq !== null && event.seq <= state.lastSeq) return state;
  const lastSeq = event.seq ?? state.lastSeq;
  if (event.type === "status") {
    return {
      ...state,
      lastSeq,
      status: event.status ?? state.status,
      phase: event.phase ?? state.phase,
      stages: event.stages ?? state.stages,
      done: false,
    };
  }
  if (event.type === "question") {
    const known = new Set(state.questions.map((item) => item.id));
    return { ...state, lastSeq, questions: [...state.questions, ...event.questions.filter((item) => !known.has(item.id))] };
  }

  const line: FeedLine = { seq: event.seq, at: event.at, stage: event.stage, kind: event.kind, text: event.text, threadId: event.threadId };
  const feed = event.text ? [...state.feed, line].slice(-FEED_LIMIT) : state.feed;
  const base: LiveState = { ...state, lastSeq, feed, stage: event.stage ?? state.stage, done: false };
  const found = withThread(base, event);
  if (!found) return base;
  const side = sideOf(event);
  const label = event.author?.label ?? (side ? AUTHOR_LABEL[side] : "AI");
  // 대화 한 줄 요약에는 판단 도구 줄을 쓰지 않는다(두 AI가 한 일만)
  const summary = event.kind !== "tool" && event.text ? event.text : found.thread.lastText;
  let thread: LiveThread = {
    ...found.thread,
    touched: lastSeq,
    lastText: summary,
    outcome: event.threadOutcome ?? found.thread.outcome,
    outcomeText: event.threadOutcome ? event.text || null : found.thread.outcomeText,
  };
  switch (event.kind) {
    case "drafting":
      if (side) thread = { ...thread, typing: { side, label, phase: "drafting", reason: null } };
      break;
    case "validating":
      if (side) thread = { ...thread, typing: { side, label, phase: "validating", reason: thread.typing?.reason ?? null } };
      break;
    case "rejected":
      thread = {
        ...thread,
        rejections: thread.rejections + 1,
        typing: side ? { side, label, phase: "rewriting", reason: event.reasons[0] ?? null } : thread.typing,
      };
      break;
    case "rewriting":
      if (side) thread = { ...thread, typing: { side, label, phase: "rewriting", reason: thread.typing?.reason ?? null } };
      break;
    case "sent":
    case "handoff":
      thread = {
        ...thread,
        typing: null,
        handoff: thread.handoff || event.kind === "handoff",
        messages: event.message ? addMessage(thread.messages, event.message) : thread.messages,
      };
      break;
    case "review":
      if (event.review) thread = { ...thread, typing: null, review: event.review };
      break;
    default:
      break;
  }
  return { ...base, threads: { ...found.threads, [thread.id]: thread }, order: found.order };
}

/* ── 보여 주는 빠르기 ─────────────────────────────────────────────── */

/**
 * 이벤트 하나를 보여 준 뒤 다음 것까지 두는 최소 간격(밀리초). 규칙 정책은 실행이 1초 안에 끝나므로, 몰려 온 기록을
 * 읽을 수 있는 빠르기로 풀어 보여 준다. 기록이 띄엄띄엄 오면 기다림이 더해지지 않는다.
 * replay(체험하기 다시 보기)는 조금 더 천천히 보여 준다. 밀린 것이 많으면 줄인다.
 */
export function paceMs(event: LiveEvent, mode: "live" | "replay", backlog = 0): number {
  if (event.type !== "activity") return event.type === "question" ? (mode === "replay" ? 600 : 200) : mode === "replay" ? 250 : 80;
  const table: Record<string, [number, number]> = {
    drafting: [450, 800],
    validating: [500, 900],
    rejected: [700, 1200],
    rewriting: [450, 800],
    sent: [650, 1100],
    handoff: [650, 1100],
    tool: [90, 220],
    question: [300, 600],
    status: [200, 450],
  };
  const [live, replay] = table[event.kind] ?? [150, 300];
  const base = mode === "replay" ? replay : live;
  const scale = backlog > 40 ? 0.3 : backlog > 15 ? 0.6 : 1;
  return Math.round(base * scale);
}

/** 오래된 기록인지(다시 붙었을 때 지난 기록은 기다리지 않고 바로 그린다) */
export function isHistory(event: LiveEvent, now: number, windowMs = 5000): boolean {
  if (event.type !== "activity" || !event.at) return false;
  const at = Date.parse(event.at);
  return Number.isFinite(at) && now - at > windowMs;
}

/* ── 재연결 간격 ──────────────────────────────────────────────────── */

/**
 * attempt번째(0부터) 다시 붙기 전에 기다릴 시간. base(서버가 retry:로 알려 준 값, 없으면 1초)에서 두 배씩 늘리고
 * max에서 멈춘다. 여러 창이 한꺼번에 붙지 않게 절반에서 전부 사이로 흔든다(random은 시험에서 고정한다).
 */
export function retryDelay(attempt: number, base = 1000, max = 15_000, random: () => number = Math.random): number {
  const full = Math.min(max, base * 2 ** Math.max(0, attempt));
  return Math.round(full * (0.5 + 0.5 * random()));
}

/* ── 뷰와 합치기 ──────────────────────────────────────────────────── */

/** 대화 패널에 그릴 대화 하나(뷰의 대화 + 스트림으로 막 받은 메시지·상태) */
export type TalkThread = {
  id: string;
  vendorOrgId: string;
  vendorName: string;
  status: ThreadStatus;
  statusReason: string | null;
  reasonEvidence: string[];
  streamIds: string[];
  turns: number;
  messages: ThreadMessage[];
  typing: Typing | null;
  rejections: number;
  lastText: string | null;
  /** 실행이 멈춘 뒤의 끝 상태와 문장(뷰의 threads[].outcome·outcomeText, 없으면 스트림의 threadOutcome) */
  outcome: ThreadOutcome | null;
  outcomeText: string | null;
  /** 스트림으로 받은 계약 검토 담당의 검토(받지 않았으면 null. 끝난 찾기는 화면이 뷰의 approvals[].review를 쓴다) */
  review: LiveReview | null;
};

type ViewThreadLike = {
  id: string;
  vendorOrgId: string;
  vendorName: string;
  status: ThreadStatus;
  statusReason: string | null;
  reasonEvidence: string[];
  streamIds: string[];
  turns: number;
  messages: ThreadMessage[];
  outcome?: ThreadOutcome | null;
  outcomeText?: string | null;
};

/** 끝 상태 가운데 대화 상태로도 쓰는 것(합의·확정·거절·담당자 인계) */
function statusOfOutcome(outcome: ThreadOutcome | null): ThreadStatus | null {
  return outcome === "agreed" || outcome === "confirmed" || outcome === "declined" || outcome === "handoff" ? outcome : null;
}

/**
 * 대화 상태: 뷰가 정한 상태(합의·거절 등)가 먼저다. 뷰가 아직 "open"이면 스트림이 알려 준 끝 상태, 담당자 인계 순으로 쓴다.
 */
function mergedStatus(view: ThreadStatus, extra: LiveThread | undefined): ThreadStatus {
  if (view !== "open" || !extra) return view;
  return statusOfOutcome(extra.outcome) ?? (extra.handoff ? "handoff" : view);
}

/**
 * 뷰의 대화와 스트림으로 받은 것을 합친다. 메시지는 ID로 한 번만 넣고 seq 순으로 둔다.
 * 뷰에 아직 없는 대화(실행 중에 막 연 대화)는 스트림의 업체 이름으로 만든다.
 */
export function mergeThreads(viewThreads: ViewThreadLike[], live: LiveState | null): TalkThread[] {
  const out: TalkThread[] = viewThreads.map((thread) => {
    const extra = live?.threads[thread.id];
    let messages = thread.messages;
    for (const message of extra?.messages ?? []) messages = addMessage(messages, message);
    return {
      ...thread,
      status: mergedStatus(thread.status, extra),
      messages,
      typing: extra?.typing ?? null,
      rejections: extra?.rejections ?? 0,
      lastText: extra?.lastText ?? null,
      outcome: thread.outcome ?? extra?.outcome ?? null,
      outcomeText: thread.outcomeText ?? extra?.outcomeText ?? null,
      review: extra?.review ?? null,
    };
  });
  if (!live) return out;
  for (const id of live.order) {
    if (out.some((item) => item.id === id)) continue;
    const extra = live.threads[id];
    out.push({
      id,
      vendorOrgId: extra.vendorOrgId ?? "",
      vendorName: extra.vendorName ?? "업체",
      status: statusOfOutcome(extra.outcome) ?? (extra.handoff ? "handoff" : "open"),
      statusReason: null,
      reasonEvidence: [],
      streamIds: [],
      turns: extra.messages.length,
      messages: extra.messages,
      typing: extra.typing,
      rejections: extra.rejections,
      lastText: extra.lastText,
      outcome: extra.outcome,
      outcomeText: extra.outcomeText,
      review: extra.review,
    });
  }
  return out;
}

/**
 * 화면에 그릴 대화. baseline(실행 전에 있던 메시지 ID)이 있으면 실행이 끝날 때까지 뷰의 메시지 가운데 그것만 두고
 * 스트림으로 받은 것을 차례로 더한다. 아직 아무 일도 없는 대화는 빼고, 결과 상태(합의 등)는 끝난 뒤에 보인다.
 */
export function presentThreads(viewThreads: ViewThreadLike[], live: LiveState | null, baseline: Set<string> | null): TalkThread[] {
  if (!baseline) return mergeThreads(viewThreads, live);
  const masked = viewThreads.map((thread) => ({ ...thread, messages: thread.messages.filter((message) => baseline.has(message.id)) }));
  return mergeThreads(masked, live)
    .filter((thread) => thread.messages.length > 0 || Boolean(live?.threads[thread.id]))
    .map((thread) => {
      const extra = live?.threads[thread.id];
      if (!extra) return thread;
      // 실행 중에는 뷰의 끝 상태(지난 실행의 것)를 쓰지 않고 이번 스트림의 것만 쓴다
      return {
        ...thread,
        status: statusOfOutcome(extra.outcome) ?? (extra.handoff ? "handoff" : "open"),
        statusReason: null,
        reasonEvidence: [],
        turns: thread.messages.length,
        outcome: extra.outcome,
        outcomeText: extra.outcomeText,
      };
    });
}

type StageLike = { stage: number; key: string; label: string; status: "waiting" | "running" | "done" | "needs_check" };

/**
 * 단계 목록: 스트림으로 받은 단계 상태가 있으면 그것을, 없으면 baseline(실행 전) 또는 뷰의 것을 쓴다. 이름은 뷰의 것.
 * 실행 중에 도는 단계가 없다고 오면(백엔드는 단계를 마칠 때 상태를 고친다) 마지막 활동의 단계를 도는 중으로 보인다.
 */
export function presentStages<T extends StageLike>(viewStages: T[], live: LiveState | null, baseline: T[] | null): T[] {
  const shown = stagesFrom(viewStages, live, baseline);
  const current = live && !live.done ? live.stage : null;
  if (current === null || shown.some((item) => item.status === "running")) return shown;
  return shown.map((item) => (item.stage === current && item.status === "waiting" ? { ...item, status: "running" as T["status"] } : item));
}

function stagesFrom<T extends StageLike>(viewStages: T[], live: LiveState | null, baseline: T[] | null): T[] {
  const from = live?.stages;
  const base = baseline && baseline.length > 0 ? baseline : viewStages;
  if (!from) return base;
  const known = new Set(["waiting", "running", "done", "needs_check"]);
  const names = new Map(viewStages.map((item) => [item.stage, item]));
  const out = from.flatMap((item) => {
    const named = names.get(item.stage);
    if (!named) return [];
    const status = (known.has(item.status) ? item.status : named.status) as T["status"];
    return [{ ...named, label: item.label ?? named.label, status }];
  });
  return out.length > 0 ? out : base;
}

/** 근거 n개: 메시지의 숫자·조항(claim) 수와 그 근거 ID들 */
export function evidenceOf(message: Pick<ThreadMessage, "claims">): { count: number; ids: string[] } {
  const ids = [...new Set(message.claims.flatMap((claim) => claim.evidence))];
  return { count: message.claims.length, ids };
}

const OFFER_TYPES = new Set(["offer", "counter", "conditional", "confirm"]);

/**
 * 업체 측 AI가 업체가 정한 범위(가드레일) 안에서 낸 조건인지. 업체 쪽 조건 메시지는 조건(meta.terms)을 실어야
 * 하고, 범위를 벗어나면 근거 확인에서 돌려보내므로(GUARDRAIL_*) 조건이 실린 채 통과한 메시지만 그렇다고 본다.
 */
export function withinVendorRange(message: Pick<ThreadMessage, "type" | "meta" | "validation" | "author">): boolean {
  if (message.author?.side !== "vendor" || message.author.kind !== "agent") return false;
  if (!OFFER_TYPES.has(message.type)) return false;
  return Boolean(message.meta?.terms && message.meta.terms.items.length > 0 && message.validation.ok);
}

/* ── 저장된 대화로 다시 보기 ──────────────────────────────────────── */

/** 초안 거부 코드 → 화면의 사유 분류(백엔드 app/v3/live.py REASONS와 같은 낱말) */
const REASON_OF_CODE: Record<string, string> = {
  NUMBER_OUTSIDE_PLACEHOLDER: "근거에 없는 숫자",
  UNKNOWN_PLACEHOLDER: "근거에 없는 값",
  UNKNOWN_CLAIM_REF: "근거에 없는 값",
  CLAIM_WITHOUT_EVIDENCE: "근거에 없는 값",
  EVIDENCE_NOT_FOUND: "근거에 없는 값",
  UNUSED_CLAIM: "본문과 값이 맞지 않음",
  VALUE_MISMATCH: "근거와 다른 값",
  UNIT_MISMATCH: "근거와 다른 값",
  QUOTE_MISMATCH: "원문과 다른 조항 인용",
  EVIDENCE_FORBIDDEN: "볼 수 없는 근거",
  EVIDENCE_EXPIRED: "기한이 지난 근거",
  TYPE_NOT_ALLOWED: "지금 보낼 수 없는 종류",
  APPROVAL_REQUIRED: "지금 보낼 수 없는 종류",
  THREAD_RULE: "대화 규칙에 맞지 않음",
  UNKNOWN_STREAM: "대화에 없는 폐기물",
  PERMIT_MISMATCH: "허가 품목이 맞지 않음",
  UNBACKED_TERM: "근거 없는 조건 낱말",
  TOO_MANY_TOOL_ROUNDS: "응답 형식 오류",
  INVALID_OUTPUT: "응답 형식 오류",
};

export function reasonOfCode(code: string): string {
  if (code.startsWith("GUARDRAIL_")) return "업체 기준 밖의 조건";
  if (code.startsWith("OTHER_EMITTER")) return "다른 회사 정보";
  return REASON_OF_CODE[code] ?? "검사를 통과하지 못함";
}


const TYPE_WORD: Record<string, string> = {
  inquiry: "문의",
  question: "질문",
  answer: "답변",
  offer: "제안",
  counter: "수정 제안",
  conditional: "조건부 제안",
  decline: "거절",
  handoff: "담당자 넘김",
  confirm: "확정",
};

type ReplayStage = { stage: number; key: string; label: string; status: string };
type ReplayView = {
  session: { emitterOrgId: string; status: string };
  stages: ReplayStage[];
  threads: ViewThreadLike[];
  /** 승인 상자의 계약 검토. 있으면 그 대화의 마지막 메시지 뒤에 검토 기록을 더한다 */
  approvals?: { threadId: string; review?: { status: string; summary: string; items: { key: string; title: string; status: string; text: string }[] } | null }[];
};

/**
 * 스트림 기록이 없는 찾기(이 기능 전에 돈 시연 찾기 등)를 저장된 대화로 다시 보여 줄 이벤트.
 * 메시지마다 작성 중 → 근거 확인 → (거부됐으면 다시 쓰기) → 보냄 순서이고, 거부 횟수와 사유는 메시지의 검증 기록
 * (validation.attempts, rejections)에서만 가져온다. 기록에 없는 일은 만들지 않는다.
 */
export function replayFromView(view: ReplayView): LiveEvent[] {
  const out: LiveEvent[] = [];
  let seq = 0;
  const next = () => ++seq;
  const stageList = (current: number | null, final = false): LiveStage[] =>
    view.stages.map((item) => ({
      stage: item.stage,
      key: item.key,
      label: item.label,
      status: final ? item.status : current === null || item.stage > current ? "waiting" : item.stage === current ? "running" : "done",
    }));
  out.push({ type: "status", seq: next(), status: "running", phase: null, stages: stageList(0) });

  const all = view.threads.flatMap((thread) => thread.messages.map((message) => ({ thread, message })));
  all.sort((a, b) => a.message.createdAt.localeCompare(b.message.createdAt) || a.message.seq - b.message.seq);
  const opened = new Set<string>();
  let stage: number | null = 0;
  for (const { thread, message } of all) {
    if (message.stage !== stage) {
      stage = message.stage;
      out.push({ type: "status", seq: next(), status: "running", phase: null, stages: stageList(stage) });
    }
    const side: LiveSide = message.author?.side ?? (message.from === view.session.emitterOrgId ? "company" : "vendor");
    const system = message.author?.kind === "system";
    const label = message.author?.label ?? AUTHOR_LABEL[side];
    const base = {
      type: "activity" as const,
      threadOutcome: null,
      at: null,
      stage: message.stage,
      threadId: thread.id,
      vendorOrgId: thread.vendorOrgId,
      vendorName: thread.vendorName,
      author: { side, kind: system ? ("system" as const) : ("agent" as const), label },
      message: null,
      reasons: [] as string[],
      evidenceCount: null,
      attempt: null,
    };
    const actor = side === "company" ? "company_agent" : "vendor_agent";
    if (!opened.has(thread.id)) {
      opened.add(thread.id);
      out.push({ ...base, seq: next(), actor: "system", kind: "status", author: null, text: `${josa(thread.vendorName, "와/과")} 대화를 엽니다.` });
    }
    if (!system) {
      out.push({ ...base, seq: next(), actor, kind: "drafting", text: `${josa(label, "이/가")} ${side === "company" ? "메시지를" : "답을"} 쓰고 있습니다.` });
      const attempts = Math.max(1, message.validation.attempts ?? 1);
      const rejections = message.validation.rejections ?? [];
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        out.push({ ...base, seq: next(), actor: "validator", kind: "validating", text: "보내기 전에 숫자와 조항을 근거와 대조하고 있습니다.", attempt });
        if (attempt === attempts) break;
        const codes = rejections.filter((item) => (item.attempt ?? 1) === attempt).map((item) => item.code);
        const reasons = [...new Set((codes.length > 0 ? codes : rejections.map((item) => item.code)).map(reasonOfCode))];
        const shown = reasons.length > 0 ? reasons : ["검사를 통과하지 못함"];
        out.push({ ...base, seq: next(), actor: "validator", kind: "rejected", reasons: shown, text: `근거 확인에서 돌려보냈습니다: ${shown.join(", ")}.`, attempt });
        out.push({ ...base, seq: next(), actor, kind: "rewriting", text: `${josa(label, "이/가")} 근거를 다시 확인해 고쳐 쓰고 있습니다.`, attempt: attempt + 1 });
      }
    }
    const handoff = message.type === "handoff";
    const what = josa(TYPE_WORD[message.type] ?? "메시지", "을/를");
    out.push({
      ...base,
      seq: next(),
      actor,
      kind: handoff ? "handoff" : "sent",
      text: handoff ? `${side === "company" ? "회사" : "업체"} 측 담당자에게 넘겼습니다.` : `${josa(label, "이/가")} ${what} 보냈습니다.`,
      message,
      evidenceCount: handoff ? null : message.claims.length,
    });
  }
  // 계약 검토 담당의 검토: 두 AI가 합의한 뒤, 사람이 승인하기 전에 나온다
  for (const approval of view.approvals ?? []) {
    const thread = view.threads.find((item) => item.id === approval.threadId);
    const review = reviewOf(approval.review, approval.review?.summary ?? "");
    if (!thread || !review) continue;
    out.push({
      type: "activity",
      seq: next(),
      at: null,
      stage: 6,
      actor: "contract_reviewer",
      kind: "review",
      threadId: thread.id,
      vendorOrgId: thread.vendorOrgId,
      vendorName: thread.vendorName,
      author: { side: null, kind: "system", label: REVIEWER_LABEL },
      text: review.summary,
      message: null,
      reasons: [],
      evidenceCount: null,
      attempt: null,
      threadOutcome: null,
      review,
    });
  }
  out.push({ type: "status", seq: next(), status: view.session.status, phase: null, stages: stageList(null, true) });
  out.push({ type: "done", status: view.session.status, lastSeq: seq });
  return out;
}
