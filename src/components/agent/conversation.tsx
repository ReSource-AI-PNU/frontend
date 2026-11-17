"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BlockedNotice } from "@/components/v3/blocked-notice";
import { useV3 } from "@/components/v3/context";
import { JudgementGraph } from "@/components/v3/judgement-graph";
import { ResultSheet } from "@/components/v3/result-sheet";
import { StreamTable } from "@/components/v3/stream-table";
import type { useDiagnosis } from "@/components/v3/use-diagnosis";
import { api } from "@/lib/v3/api";
import { THREAD_LABEL } from "@/lib/v3/format";
import { presentStages, presentThreads, typingText, type TalkThread } from "@/lib/v3/live";
import type { DiagnosisView, Question, Stage, ViewStream } from "@/lib/v3/types";
import { AgentTalk } from "./agent-talk";
import { Dots } from "./dots";
import { ResultCard } from "./result-card";

export { Dots };

type Diagnosis = ReturnType<typeof useDiagnosis>;

const DOC_LABEL = { request: "요청서", plan: "이행 계획서" } as const;

function Me({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] bg-sunken px-4 py-2.5 text-[15px]">{children}</div>
    </div>
  );
}

/**
 * 대회 6단계. 도는 동안에는 세로 목록으로 지금 어디인지 보여 주고, 지금 일어나는 일 한 줄을 그 단계 아래에 적는다.
 * 끝나면 한 줄로 접는다.
 */
function Progress({
  stages,
  running,
  title,
  line,
  action,
}: {
  stages: Stage[];
  running: boolean;
  title: string;
  /** 지금 일어나는 일(실시간 진행의 마지막 한 줄) */
  line: string | null;
  action?: ReactNode;
}) {
  const done = stages.filter((item) => item.status === "done" || item.status === "needs_check").length;
  const flagged = stages.filter((item) => item.status === "needs_check");
  const current = stages.find((item) => item.status === "running")?.stage ?? null;
  const list = (
    <ol aria-label="확인 과정" className="space-y-2.5 text-[15px]">
      {stages.map((stage) => (
        <li key={stage.stage} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-2.5">
          <span className="flex h-[1.65em] items-center">
            {stage.status === "running" ? (
              <Dots label="진행 중" />
            ) : stage.status === "waiting" ? (
              <span aria-hidden="true" className="ml-0.5 size-2 rounded-full border border-line-strong" />
            ) : (
              <CheckIcon className={stage.status === "needs_check" ? "text-warn" : "text-ink-2"} />
            )}
          </span>
          <span className={stage.status === "waiting" ? "text-muted" : stage.status === "running" ? "font-medium" : "text-ink-2"}>
            {stage.label}
            {stage.status === "needs_check" ? <span className="ml-2 text-[13px] text-warn">사람이 확인할 것이 남았습니다</span> : null}
            {running && line && stage.stage === current ? (
              <span key={line} aria-live="polite" className="mt-0.5 block text-[13px] font-normal text-muted [animation:rs-rise_240ms_var(--ease-out)_both]">
                {line}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
  if (running) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[17px] font-medium">{title}</p>
          {action}
        </div>
        {list}
        {line && current === null ? (
          <p aria-live="polite" className="mt-3 text-[13px] text-muted">
            {line}
          </p>
        ) : null}
      </div>
    );
  }
  if (done === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        {done === stages.length ? `${stages.length}단계 확인을 마쳤습니다` : `${stages.length}단계 가운데 ${done}단계까지 확인했습니다`}
        {flagged.length > 0 ? ` · 사람이 확인할 것 ${flagged.length}곳` : ""}
        <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{list}</div>
    </details>
  );
}

const TYPING_SHORT = { drafting: "작성 중", validating: "근거 확인 중", rewriting: "다시 쓰는 중" } as const;

/** 실행 중 업체별 대화의 지금 상태. 누르면 그 대화를 연다 */
function LiveThreads({ threads, onOpen }: { threads: TalkThread[]; onOpen: (id: string) => void }) {
  if (threads.length === 0) return null;
  return (
    <section aria-label="업체별 대화">
      <h2 className="text-[15px] font-medium">업체 {threads.length}곳과 대화하고 있습니다</h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {threads.map((thread) => {
          const line = thread.typing
            ? `${thread.typing.label} · ${typingText(thread.typing)}`
            : (thread.lastText ?? THREAD_LABEL[thread.status] ?? "");
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onOpen(thread.id)}
                className="flex min-h-13 w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-ground"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{thread.vendorName}</span>
                  <span className="block truncate text-[13px] text-muted" aria-live="polite">
                    {line}
                  </span>
                </span>
                {thread.typing ? (
                  <span className="flex shrink-0 items-center gap-2 text-[12px] text-ink-2">
                    <Dots label={TYPING_SHORT[thread.typing.phase]} />
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] text-muted tabular-nums">{thread.messages.length}번</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const field =
  "min-h-11 min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken";

function Questions({
  questions,
  streams,
  disabled,
  onAnswer,
}: {
  questions: Question[];
  streams: ViewStream[];
  disabled: boolean;
  onAnswer: (questionId: string, value: string | number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = questions.filter((item) => !item.answered);
  if (open.length === 0) return null;
  const batch = Math.min(...open.map((item) => item.batch));
  const current = open.filter((item) => item.batch === batch);
  return (
    <div>
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em]">찾기 전에 {current.length}가지만 여쭤볼게요.</h2>
      <p className="mt-1.5 text-[15px] text-ink-2">모르면 ‘모름’을 누르세요. 다시 묻지 않고 그대로 진행합니다.</p>
      <ul className="mt-6 space-y-6">
        {current.map((question) => {
          const stream = streams.find((item) => item.id === question.streamId);
          const draft = drafts[question.id] ?? "";
          const setDraft = (value: string) => setDrafts((before) => ({ ...before, [question.id]: value }));
          const parsed = question.answerType === "number" ? Number(draft) : draft.trim();
          const valid = draft.trim() !== "" && (question.answerType !== "number" || Number.isFinite(parsed as number));
          return (
            <li key={question.id}>
              <label htmlFor={`q-${question.id}`} className="block text-[15px] font-medium">
                {stream && !question.text.includes(stream.name) ? (
                  <span className="mb-0.5 block text-[13px] font-normal text-muted">{stream.name}</span>
                ) : null}
                {question.text.replace(/\s*모르면 '모름'으로 답해 주세요\.?$/, "")}
              </label>
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (valid && !disabled) onAnswer(question.id, parsed);
                }}
              >
                {question.answerType === "choice" && question.choices ? (
                  <select
                    id={`q-${question.id}`}
                    value={draft}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                    className={field}
                  >
                    <option value="">고르세요</option>
                    {question.choices.map((choice) => (
                      <option key={choice}>{choice}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`q-${question.id}`}
                    value={draft}
                    disabled={disabled}
                    inputMode={question.answerType === "number" ? "decimal" : undefined}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={question.answerType === "number" ? "숫자" : "답을 입력하세요"}
                    className={`${field} ${question.answerType === "number" ? "w-28 tabular-nums" : "flex-1"}`}
                  />
                )}
                {question.unit ? <span className="text-sm text-ink-2">{question.unit}</span> : null}
                <Button type="submit" variant="secondary" disabled={disabled || !valid}>
                  답하기
                </Button>
                <Button variant="ghost" disabled={disabled} onClick={() => onAnswer(question.id, "unknown")} className="!text-ink-2">
                  모름
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Approvals({ view, d, nameOf }: { view: DiagnosisView; d: Diagnosis; nameOf: (id: string | null) => string }) {
  const { readOnly } = useV3();
  const isEmitter = view.viewer.role === "emitter";
  const [each, setEach] = useState(false);
  const mine = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.emitter : item.vendor);
  const theirs = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.vendor : item.emitter);
  const pending = view.approvals.filter((item) => !mine(item) && !item.blocked);
  const waiting = view.approvals.filter((item) => mine(item) && !theirs(item));
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  if (view.approvals.length === 0) return null;
  const confirmed = view.session.status === "confirmed";
  const other = isEmitter ? "업체" : "배출 기업";
  const untouched = pending.length === view.approvals.length;
  const showList = each || !untouched;
  const disabled = !d.canAct || d.busy;

  return (
    <section aria-label="승인">
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em]">
        {confirmed
          ? "양쪽이 승인해 확정됐습니다."
          : pending.length > 0
            ? isEmitter
              ? "이 조건으로 진행할까요?"
              : "이 조건으로 받으시겠어요?"
            : `승인했습니다. ${other} 승인을 기다리고 있습니다.`}
      </h2>
      {!confirmed ? (
        <p className="mt-1.5 text-[15px] text-ink-2">
          {pending.length > 0
            ? `승인하면 ${other}${isEmitter && pending.length > 1 ? ` ${pending.length}곳` : ""}에 알립니다. ${other} 담당자도 승인해야 확정되고, 그 뒤에 요청서와 이행 계획서를 만듭니다.`
            : `${other} 담당자가 승인하면 확정되고, 요청서와 이행 계획서가 만들어집니다.`}
        </p>
      ) : null}

      {pending.length > 0 && readOnly ? (
        <p className="mt-5 rounded-xl bg-ground px-4 py-3 text-sm text-ink-2">
          체험 중에는 승인할 수 없습니다. 가입하면 내 회사의 찾기 결과를 이렇게 승인합니다.{" "}
          <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
            가입하기
          </Link>
        </p>
      ) : null}

      {pending.length > 0 && !readOnly ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button disabled={disabled} onClick={() => d.approveAll(pending.map((item) => item.threadId))} className="!min-h-12 !px-6 !text-[16px]">
            {d.busy ? "승인하는 중" : "승인하고 진행"}
          </Button>
          {pending.length > 1 && !showList ? (
            <button type="button" onClick={() => setEach(true)} className="min-h-10 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
              업체별로 따로 승인
            </button>
          ) : null}
        </div>
      ) : null}

      {showList ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {view.approvals.map((approval) => {
            const thread = view.threads.find((item) => item.id === approval.threadId);
            const counterpart = isEmitter ? (thread?.vendorName ?? "업체") : nameOf(view.session.emitterOrgId);
            const done = mine(approval) && theirs(approval);
            return (
              <li key={approval.threadId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{counterpart}</p>
                  <p className="text-[13px] text-muted">{approval.streamIds.map(streamName).join(", ")}</p>
                </div>
                {done ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gain">
                    <CheckIcon /> 확정
                  </span>
                ) : approval.blocked ? (
                  <span className="text-sm font-medium text-warn">승인이 막혔습니다</span>
                ) : mine(approval) ? (
                  <span className="text-sm text-muted">{other} 승인 기다리는 중</span>
                ) : readOnly ? (
                  <span className="text-sm text-muted">승인 전</span>
                ) : (
                  <Button size="sm" variant="secondary" disabled={disabled} onClick={() => d.approve(approval.threadId)}>
                    승인
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!confirmed && pending.length === 0 && waiting.length > 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          <button type="button" disabled={d.busy} onClick={d.reload} className="underline underline-offset-4 hover:text-ink">
            새로 고침
          </button>
          {" · "}
          {isEmitter ? "업체" : "배출 기업"} 담당자가 승인하면 여기에 표시됩니다.
        </p>
      ) : null}
    </section>
  );
}

function Documents({ view }: { view: DiagnosisView }) {
  const { basePath } = useV3();
  if (view.documents.length === 0) return null;
  return (
    <section aria-label="서류">
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em]">서류 {view.documents.length}건을 만들었습니다.</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {view.documents.map((document) => (
          <li key={document.id}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="w-20 shrink-0 text-[13px] text-muted">{DOC_LABEL[document.kind]}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{document.title}</span>
                <ChevronDownIcon className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{document.rendered}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-muted">
        서류는 화면에만 만들고 밖으로 보내지 않습니다.{" "}
        <Link href={`${basePath}/approval`} className="underline underline-offset-4 hover:text-ink">
          승인·서류에서 자세히 보기
        </Link>
      </p>
    </section>
  );
}

/**
 * 찾기 한 건의 화면. 위에서 아래로 한 줄로 읽는다: 내가 맡긴 일, (필요하면) 질문, 결과 표, 승인, 서류.
 * AI끼리 나눈 대화는 화면 아래 단추로 연다. 판단 표와 그래프는 맨 아래에 접어 둔다.
 *
 * 실행 중(또는 다시 보기 중)에는 실시간 진행 스트림으로 6단계와 업체별 대화가 오는 대로 바뀌고, 대화 패널에는 말풍선이
 * 하나씩 나타난다. 이 화면이 시작한 실행은 끝날 때까지 결과를 가리고, 끝나면 진단 뷰를 다시 읽어 전체를 그린다.
 */
export function Conversation({ d }: { d: Diagnosis }) {
  const { orgs, basePath, readOnly } = useV3();
  const view = d.view as DiagnosisView;
  const stream = d.stream;
  const live = stream.state;
  const holding = stream.holding;
  const replaying = stream.active && stream.target?.mode === "replay";
  // 이 화면이 시작한 실행(또는 다시 보기)에서 두 AI의 대화가 처음 열리면 대화 패널을 연다(식별·질문만 하는 실행은 열지 않는다).
  // 렌더 중에 앞 렌더의 값과 견주어 고친다
  const talking = stream.active && stream.target?.mode !== "attach" && (live?.order.length ?? 0) > 0 ? stream.target!.id : null;
  const [talkOpen, setTalkOpen] = useState(() => talking !== null);
  const [openedFor, setOpenedFor] = useState<number | null>(talking);
  if (talking !== null && talking !== openedFor) {
    setOpenedFor(talking);
    setTalkOpen(true);
  }
  const [threadId, setThreadId] = useState<string | null>(null);

  const nameOf = (orgId: string | null) =>
    orgs.find((item) => item.id === orgId)?.name ??
    view.threads.find((item) => item.vendorOrgId === orgId)?.vendorName ??
    orgId ??
    "확인 필요";
  const isEmitter = view.viewer.role === "emitter";
  const emitterName = nameOf(view.session.emitterOrgId);
  const { status, phase } = view.session;
  const baseline = holding ? (stream.target?.baseline ?? null) : null;
  const baselineIds = useMemo(() => (baseline ? new Set(baseline.messageIds) : null), [baseline]);
  const stages = presentStages(view.stages, stream.active ? live : null, baseline?.stages ?? null);
  const threads = useMemo(() => presentThreads(view.threads, live, baselineIds), [view.threads, live, baselineIds]);
  // 실행 중에 막 받은 말풍선만 떠오르며 들어온다(끝난 뒤 패널을 다시 열 때는 움직이지 않는다)
  const freshIds = useMemo(
    () => new Set(stream.active ? Object.values(live?.threads ?? {}).flatMap((item) => item.messages.map((message) => message.id)) : []),
    [live, stream.active],
  );
  const followId = live
    ? (Object.values(live.threads).sort((a, b) => b.touched - a.touched)[0]?.id ?? null)
    : null;
  const liveLine = stream.active ? (live?.feed[live.feed.length - 1]?.text ?? null) : null;

  // 질문 묶음은 오는 대로 보인다. 이 화면이 시작한 실행 중에는 이번에 받은 묶음만
  const questions = useMemo(() => {
    const fromLive = live?.questions ?? [];
    if (holding) return fromLive;
    const known = new Set(view.questions.map((item) => item.id));
    return [...view.questions, ...fromLive.filter((item) => !known.has(item.id))];
  }, [holding, live, view.questions]);

  const started = stages.some((item) => item.status !== "waiting");
  const openQuestions = questions.filter((item) => !item.answered);
  const answered = questions.filter((item) => item.answered);
  const ended = !holding && status === "idle" && phase === "done";
  const working =
    holding || (stream.active && status === "running") || status === "running" || (d.busy && status !== "awaiting_approval" && status !== "confirmed");
  const closed = holding ? [] : view.threads.filter((item) => item.status === "handoff" || item.status === "declined");
  const blocked = holding ? [] : view.approvals.filter((item) => item.blocked);
  const canContinue = isEmitter && status === "idle" && !ended && openQuestions.length === 0;
  const unknown = answered.filter((item) => item.unknown).length;
  const result = holding ? null : view.result;
  const liveThreads = threads.filter((item) => item.messages.length > 0 || item.typing);
  const openTalk = (id: string) => {
    setThreadId(id);
    setTalkOpen(true);
  };
  const replay = () => {
    setThreadId(null);
    d.replay();
  };

  return (
    <div className="flex flex-1 flex-col">
      {!isEmitter && !readOnly ? (
        <div className="flex justify-end px-3 pt-3">
          <Link
            href={`${basePath}/inquiries`}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
          >
            다른 문의 보기
          </Link>
        </div>
      ) : null}
      {isEmitter && d.canAct && !working ? (
        <div className="flex justify-end px-3 pt-3">
          <button
            type="button"
            disabled={d.busy}
            onClick={d.forget}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <PlusIcon className="size-3.5" />
            새로 찾기
          </button>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[760px] flex-1 space-y-10 px-5 pt-6 pb-10">
        {isEmitter ? (
          <Me>
            폐기물 {view.streams.length}가지를 받아 줄 곳을 찾아 주세요.
            <span className="mt-0.5 block text-[13px] text-muted">{view.streams.map((item) => item.name).join(", ")}</span>
          </Me>
        ) : null}

        <Progress
          stages={stages}
          running={working}
          title={replaying ? "지난 찾기를 처음부터 다시 보여 드립니다." : "업체에 조건을 물어보고 있습니다."}
          line={liveLine}
          action={
            replaying ? (
              <button type="button" onClick={stream.skip} className="min-h-9 text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">
                건너뛰기
              </button>
            ) : null
          }
        />

        {working ? <LiveThreads threads={liveThreads} onOpen={openTalk} /> : null}

        {readOnly && d.canReplay && !working ? (
          <div>
            <p className="text-[15px] text-ink-2">공장 쪽 AI와 업체 쪽 AI가 근거를 확인하며 주고받은 과정을 처음부터 볼 수 있습니다.</p>
            <Button variant="secondary" className="mt-3" onClick={replay}>
              두 AI의 대화 다시 보기
            </Button>
          </div>
        ) : null}

        {d.error ? (
          <p role="alert" className="text-sm text-loss">
            {d.error}
          </p>
        ) : null}

        {!working && !started && isEmitter ? (
          <div>
            <p className="text-[17px] font-medium">아직 찾기를 시작하지 않았습니다.</p>
            <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
              받아 줄 곳 찾기
            </Button>
          </div>
        ) : null}

        {isEmitter && !replaying ? (
          <div>
            <Questions
              questions={questions}
              streams={view.streams}
              disabled={!d.canAct || d.busy || working}
              onAnswer={d.answerAndContinue}
            />
            {working && openQuestions.length > 0 ? (
              <p className="mt-3 text-[13px] text-muted">AI가 지금 하던 일을 마치면 답할 수 있습니다.</p>
            ) : null}
          </div>
        ) : null}
        {isEmitter && !holding && answered.length > 0 && openQuestions.length === 0 && !view.result ? (
          <p className="text-sm text-muted">
            질문 {answered.length}개에 답했습니다{unknown > 0 ? ` (모름 ${unknown}개)` : ""}.
          </p>
        ) : null}

        {canContinue && started && !working ? (
          <div>
            <p className="text-[17px] font-medium">이어서 찾을 수 있습니다.</p>
            <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
              이어서 찾기
            </Button>
          </div>
        ) : null}

        {!isEmitter && !result && !working ? (
          <div>
            <p className="text-[17px] font-medium">{emitterName}에서 받아 줄 곳을 찾고 있습니다.</p>
            <p className="mt-1 text-[15px] text-ink-2">
              매입 기준에 맞는 물량이면 여기에 문의가 나타납니다.{" "}
              <button type="button" onClick={d.reload} className="underline underline-offset-4 hover:text-ink">
                새로 고침
              </button>
            </p>
          </div>
        ) : null}

        {ended || closed.length > 0 ? (
          <div role="status" className="rounded-xl bg-ground px-4 py-3.5 text-sm text-ink-2">
            {ended ? <p className="font-medium text-ink">조건이 맞는 곳이 남지 않아 찾기를 마쳤습니다. 아래 사유를 보고 자료를 고쳐 다시 찾아 보세요.</p> : null}
            <ul className={ended ? "mt-1.5 space-y-1" : "space-y-1"}>
              {closed.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-ink">
                    {item.vendorName} · {THREAD_LABEL[item.status]}
                  </span>
                  {item.statusReason ? ` · ${item.statusReason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {blocked.map((approval) => (
          <BlockedNotice
            key={approval.threadId}
            codes={approval.blockedCodes}
            reason={approval.blockedReason}
            canRerun={isEmitter && d.canAct}
            busy={d.busy || working}
            onRerun={d.run}
            vendorName={view.threads.find((item) => item.id === approval.threadId)?.vendorName}
          />
        ))}

        {result ? (
          <ResultCard result={result} streams={view.streams} role={view.viewer.role} counterpart={emitterName} onOpenTalk={openTalk} />
        ) : null}

        {result ? <Approvals view={view} d={d} nameOf={nameOf} /> : null}
        {holding ? null : <Documents view={view} />}

        {result && !working ? (
          <details className="group border-t border-line pt-3">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              판단 과정 전체 보기 (자료 표, 판단 그래프, 계산표)
              <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-8">
              <section aria-label="자료 표" className="overflow-hidden rounded-xl border border-line">
                <StreamTable
                  streams={view.streams}
                  unresolved={view.unresolved}
                  corrections={view.feedback.corrections}
                  onCorrect={
                    isEmitter && d.canAct
                      ? async (body) => {
                          await api.recordCorrection(view.session.id, d.org.id, body);
                          d.reload();
                        }
                      : undefined
                  }
                />
              </section>
              <section aria-label="판단 그래프" className="overflow-hidden rounded-xl border border-line">
                <JudgementGraph nodes={view.graph.nodes} edges={view.graph.edges} />
              </section>
              <section aria-label="계산표" className="overflow-hidden rounded-xl border border-line">
                <ResultSheet result={result} streams={view.streams} unresolved={view.unresolved} role={view.viewer.role} vendorName={nameOf} />
              </section>
            </div>
          </details>
        ) : null}
      </div>

      <AgentTalk
        view={view}
        threads={threads}
        emitterName={emitterName}
        open={talkOpen}
        onOpenChange={setTalkOpen}
        threadId={threadId}
        onThreadChange={setThreadId}
        followId={followId}
        working={working}
        liveLine={liveLine}
        freshIds={freshIds}
        replay={{ can: d.canReplay, active: replaying, start: replay, skip: stream.skip }}
      />
    </div>
  );
}
