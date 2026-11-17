"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
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
import type { DiagnosisView, Question, Stage, ViewStream } from "@/lib/v3/types";
import { AgentTalk } from "./agent-talk";
import { ResultCard } from "./result-card";

type Diagnosis = ReturnType<typeof useDiagnosis>;

const DOC_LABEL = { request: "요청서", plan: "이행 계획서" } as const;

export function Dots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-ink [animation:rs-dot_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}

function Me({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] bg-sunken px-4 py-2.5 text-[15px]">{children}</div>
    </div>
  );
}

/**
 * 대회 6단계. 도는 동안에는 세로 목록으로 지금 어디인지 보여 주고, 끝나면 한 줄로 접는다.
 */
function Progress({ stages, running }: { stages: Stage[]; running: boolean }) {
  const done = stages.filter((item) => item.status === "done" || item.status === "needs_check").length;
  const flagged = stages.filter((item) => item.status === "needs_check");
  const list = (
    <ol aria-label="확인 과정" className="space-y-2.5 text-[15px]">
      {stages.map((stage) => (
        <li key={stage.stage} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2.5">
          {stage.status === "running" ? (
            <Dots label="진행 중" />
          ) : stage.status === "waiting" ? (
            <span aria-hidden="true" className="ml-0.5 size-2 rounded-full border border-line-strong" />
          ) : (
            <CheckIcon className={stage.status === "needs_check" ? "text-warn" : "text-ink-2"} />
          )}
          <span className={stage.status === "waiting" ? "text-muted" : stage.status === "running" ? "font-medium" : "text-ink-2"}>
            {stage.label}
            {stage.status === "needs_check" ? <span className="ml-2 text-[13px] text-warn">사람이 확인할 것이 남았습니다</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
  if (running) {
    return (
      <div>
        <p className="mb-4 text-[17px] font-medium">업체에 조건을 물어보고 있습니다.</p>
        {list}
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

      {pending.length > 0 ? (
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
          {" · "}시연에서는 왼쪽 아래 ‘시연 회사’를 {isEmitter ? "처리 업체" : "배출 기업"}로 바꾸면 상대 쪽 승인을 해 볼 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}

function Documents({ view }: { view: DiagnosisView }) {
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
        <Link href="/app/approval" className="underline underline-offset-4 hover:text-ink">
          승인·서류에서 자세히 보기
        </Link>
      </p>
    </section>
  );
}

/**
 * 찾기 한 건의 화면. 위에서 아래로 한 줄로 읽는다: 내가 맡긴 일, (필요하면) 질문, 결과 표, 승인, 서류.
 * AI끼리 나눈 대화는 화면 아래 단추로 연다. 판단 표와 그래프는 맨 아래에 접어 둔다.
 */
export function Conversation({ d }: { d: Diagnosis }) {
  const { orgs } = useV3();
  const view = d.view as DiagnosisView;
  const [talkOpen, setTalkOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const nameOf = (orgId: string | null) =>
    orgs.find((item) => item.id === orgId)?.name ??
    view.threads.find((item) => item.vendorOrgId === orgId)?.vendorName ??
    orgId ??
    "확인 필요";
  const isEmitter = view.viewer.role === "emitter";
  const emitterName = nameOf(view.session.emitterOrgId);
  const { status, phase } = view.session;
  const started = view.stages.some((item) => item.status !== "waiting");
  const openQuestions = view.questions.filter((item) => !item.answered);
  const answered = view.questions.filter((item) => item.answered);
  const ended = status === "idle" && phase === "done";
  const running = status === "running" || (d.busy && status !== "awaiting_approval" && status !== "confirmed");
  const closed = view.threads.filter((item) => item.status === "handoff" || item.status === "declined");
  const blocked = view.approvals.filter((item) => item.blocked);
  const canContinue = isEmitter && status === "idle" && !ended && openQuestions.length === 0;
  const unknown = answered.filter((item) => item.unknown).length;
  const openTalk = (id: string) => {
    setThreadId(id);
    setTalkOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col">
      {isEmitter && d.canAct && !running ? (
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

        <Progress stages={view.stages} running={running} />

        {d.error ? (
          <p role="alert" className="text-sm text-loss">
            {d.error}
          </p>
        ) : null}

        {!running && !started && isEmitter ? (
          <div>
            <p className="text-[17px] font-medium">아직 찾기를 시작하지 않았습니다.</p>
            <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
              받아 줄 곳 찾기
            </Button>
          </div>
        ) : null}

        {isEmitter && !running ? (
          <Questions questions={view.questions} streams={view.streams} disabled={!d.canAct || d.busy} onAnswer={d.answerAndContinue} />
        ) : null}
        {isEmitter && answered.length > 0 && openQuestions.length === 0 && !view.result ? (
          <p className="text-sm text-muted">
            질문 {answered.length}개에 답했습니다{unknown > 0 ? ` (모름 ${unknown}개)` : ""}.
          </p>
        ) : null}

        {canContinue && started && !running ? (
          <div>
            <p className="text-[17px] font-medium">이어서 찾을 수 있습니다.</p>
            <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
              이어서 찾기
            </Button>
          </div>
        ) : null}

        {!isEmitter && !view.result ? (
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
            busy={d.busy || status === "running"}
            onRerun={d.run}
            vendorName={view.threads.find((item) => item.id === approval.threadId)?.vendorName}
          />
        ))}

        {view.result ? (
          <ResultCard result={view.result} streams={view.streams} role={view.viewer.role} counterpart={emitterName} onOpenTalk={openTalk} />
        ) : null}

        {view.result ? <Approvals view={view} d={d} nameOf={nameOf} /> : null}
        <Documents view={view} />

        {view.result && !running ? (
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
                <ResultSheet result={view.result} streams={view.streams} unresolved={view.unresolved} role={view.viewer.role} vendorName={nameOf} />
              </section>
            </div>
          </details>
        ) : null}
      </div>

      <AgentTalk
        view={view}
        emitterName={emitterName}
        open={talkOpen}
        onOpenChange={setTalkOpen}
        threadId={threadId}
        onThreadChange={setThreadId}
      />
    </div>
  );
}
