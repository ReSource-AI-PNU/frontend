"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BlockedNotice } from "@/components/v3/blocked-notice";
import { useV3 } from "@/components/v3/context";
import { JudgementGraph } from "@/components/v3/judgement-graph";
import { ResultSheet } from "@/components/v3/result-sheet";
import { StreamTable } from "@/components/v3/stream-table";
import type { useDiagnosis } from "@/components/v3/use-diagnosis";
import { api } from "@/lib/v3/api";
import { THREAD_LABEL, formatClaim, sessionLabel } from "@/lib/v3/format";
import type { DiagnosisView, Question, Stage, ViewStream } from "@/lib/v3/types";
import { AgentTalk } from "./agent-talk";
import { ResultCard } from "./result-card";

type Diagnosis = ReturnType<typeof useDiagnosis>;

const STAGE_BAR: Record<Stage["status"], string> = {
  waiting: "bg-line",
  running: "lane lane-run",
  done: "bg-brand",
  needs_check: "bg-warn",
};
const DOC_LABEL = { request: "요청서", plan: "이행 계획서" } as const;

function Me({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-sunken px-4 py-3">{children}</div>
    </div>
  );
}

function Agent({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[26px_minmax(0,1fr)] gap-x-3.5">
      <BrandMark className="mt-0.5" />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}

/** 대회 6단계. 실제 순서라 번호 대신 왼쪽에서 오른쪽으로 놓고, 색과 함께 낱말로도 상태를 적는다. */
function Steps({ stages }: { stages: Stage[] }) {
  return (
    <ol aria-label="진행 단계" className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6">
      {stages.map((stage) => (
        <li key={stage.stage}>
          <span aria-hidden="true" className={`block h-1 rounded-full ${STAGE_BAR[stage.status]}`} />
          <span
            className={`mt-1.5 block text-[12px] leading-snug ${stage.status === "waiting" ? "text-muted" : "font-semibold text-ink-2"}`}
          >
            {stage.label}
            {stage.status === "needs_check" ? <span className="block font-normal text-warn">확인 필요</span> : null}
            {stage.status === "running" ? <span className="block font-normal text-muted">진행 중</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const field =
  "min-h-11 min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken";

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
      <p className="text-[17px] leading-snug font-semibold">
        찾기 전에 {current.length}가지만 확인할게요.
        <span className="block text-[15px] font-normal text-ink-2">모르면 ‘모름’을 누르세요. 모름도 답으로 치고 다시 묻지 않습니다.</span>
      </p>
      <ul className="mt-4 space-y-4">
        {current.map((question) => {
          const stream = streams.find((item) => item.id === question.streamId);
          const draft = drafts[question.id] ?? "";
          const setDraft = (value: string) => setDrafts((before) => ({ ...before, [question.id]: value }));
          const parsed = question.answerType === "number" ? Number(draft) : draft.trim();
          const valid = draft.trim() !== "" && (question.answerType !== "number" || Number.isFinite(parsed as number));
          return (
            <li key={question.id}>
              <label htmlFor={`q-${question.id}`} className="block text-[15px]">
                {stream ? <span className="mr-1.5 font-semibold">{stream.name}</span> : null}
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
                <Button type="submit" size="sm" variant="secondary" disabled={disabled || !valid} className="!min-h-11 !px-4">
                  답하기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onAnswer(question.id, "unknown")}
                  className="!min-h-11 !px-4"
                >
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
  const mine = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.emitter : item.vendor);
  const theirs = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.vendor : item.emitter);
  const pending = view.approvals.filter((item) => !mine(item) && !item.blocked);
  const waiting = view.approvals.filter((item) => mine(item) && !theirs(item));
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  if (view.approvals.length === 0) return null;
  const confirmed = view.session.status === "confirmed";
  return (
    <div>
      <p className="text-[17px] font-semibold">
        {confirmed
          ? "양쪽이 모두 승인해 확정됐습니다."
          : pending.length > 0
            ? "조건이 괜찮으면 승인해 주세요."
            : "승인했습니다. 상대 쪽 승인을 기다리는 중입니다."}
      </p>
      {!confirmed ? (
        <p className="mt-1 text-sm text-ink-2">양쪽 담당자가 모두 승인해야 확정되고, 그 뒤에 요청서와 이행 계획서를 만듭니다.</p>
      ) : null}
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {view.approvals.map((approval) => {
          const thread = view.threads.find((item) => item.id === approval.threadId);
          const counterpart = isEmitter ? (thread?.vendorName ?? "업체") : nameOf(view.session.emitterOrgId);
          const done = mine(approval) && theirs(approval);
          return (
            <li key={approval.threadId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{counterpart}</p>
                <p className="text-[13px] text-muted">{approval.streamIds.map(streamName).join(", ")}</p>
              </div>
              {done ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-brand">
                  <CheckIcon /> 확정
                </span>
              ) : approval.blocked ? (
                <span className="text-sm font-semibold text-warn">승인이 막혔습니다</span>
              ) : mine(approval) ? (
                <span className="text-sm text-ink-2">내 승인 완료 · 상대 승인 전</span>
              ) : (
                <Button size="sm" variant="secondary" disabled={!d.canAct || d.busy} onClick={() => d.approve(approval.threadId)}>
                  승인
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {pending.length > 1 ? (
        <div className="mt-4">
          <Button disabled={!d.canAct || d.busy} onClick={() => d.approveAll(pending.map((item) => item.threadId))}>
            {d.busy ? "승인하는 중" : `${pending.length}건 모두 승인`}
          </Button>
        </div>
      ) : null}
      {!confirmed && pending.length === 0 && waiting.length > 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          시연에서는 왼쪽 아래 ‘보는 회사’를 {isEmitter ? "업체" : "배출 기업"}로 바꾸면 상대 쪽 승인을 해 볼 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}

function Documents({ view }: { view: DiagnosisView }) {
  if (view.documents.length === 0) return null;
  return (
    <div>
      <p className="text-[17px] font-semibold">서류 {view.documents.length}건을 만들었습니다.</p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {view.documents.map((document) => (
          <li key={document.id}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <span className="rounded-full bg-sunken px-2 py-0.5 text-[12px] font-semibold text-ink-2">
                  {DOC_LABEL[document.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{document.title}</span>
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
    </div>
  );
}

/**
 * 찾기 한 건의 화면. 위에서 아래로 한 줄로 읽는다: 내가 맡긴 흐름, 진행 단계, (필요하면) 질문, 결과, 승인, 서류.
 * 두 에이전트의 대화는 맨 아래 띠에서 펼친다. 표와 판단 그래프는 "자세히"에 접어 둔다.
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
  const openTalk = (id: string) => {
    setThreadId(id);
    setTalkOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-13 z-10 flex min-h-13 items-center gap-3 border-b border-line bg-bg px-5 lg:top-0">
        <p className="min-w-0 truncate text-sm">
          <span className="font-semibold">{isEmitter ? emitterName : `${emitterName}에서 온 문의`}</span>
          <span className="ml-2 text-muted">{sessionLabel(status, phase, started)}</span>
        </p>
        <span className="ml-auto text-[12px] text-muted tabular-nums">기준일 {view.session.today}</span>
        {d.canAct ? (
          <button
            type="button"
            disabled={d.busy}
            onClick={d.reload}
            className="min-h-9 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink disabled:text-muted"
          >
            새로 고침
          </button>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-[760px] space-y-8 px-5 pt-8 pb-12">
        {isEmitter ? (
          <Me>
            <p className="text-[15px]">
              흐름 {view.streams.length}개를 받아 줄 곳을 찾아 주세요.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {view.streams.map((stream) => (
                <li key={stream.id} className="rounded-full bg-surface px-2.5 py-1 text-[13px] text-ink-2">
                  {stream.name}
                  {stream.monthlyKg ? <span className="ml-1.5 tabular-nums text-muted">{formatClaim(stream.monthlyKg)}</span> : null}
                </li>
              ))}
            </ul>
          </Me>
        ) : null}

        <Agent>
          <Steps stages={view.stages} />

          {d.error ? (
            <p role="alert" className="rounded-lg bg-loss-bg px-3.5 py-2.5 text-sm text-loss">
              {d.error}
            </p>
          ) : null}

          {running ? (
            <p className="text-[17px] font-semibold">업체를 찾아 조건을 맞추는 중입니다.</p>
          ) : !started && isEmitter ? (
            <div>
              <p className="text-[17px] font-semibold">아직 찾기를 시작하지 않았습니다.</p>
              <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
                에이전트로 찾기
              </Button>
            </div>
          ) : null}

          {isEmitter ? (
            <Questions questions={view.questions} streams={view.streams} disabled={!d.canAct || d.busy} onAnswer={d.answerAndContinue} />
          ) : null}
          {isEmitter && answered.length > 0 && openQuestions.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <CheckIcon className="text-brand" />
              질문 {answered.length}개에 답했습니다
              {answered.some((item) => item.unknown) ? ` (모름 ${answered.filter((item) => item.unknown).length}개)` : ""}.
            </p>
          ) : null}

          {canContinue && started && !running ? (
            <div>
              <p className="text-[17px] font-semibold">이어서 찾을 수 있습니다.</p>
              <Button className="mt-3" disabled={!d.canAct || d.busy} onClick={d.run}>
                이어서 찾기
              </Button>
            </div>
          ) : null}

          {!isEmitter && !view.result ? (
            <p className="text-[17px] font-semibold">{emitterName}의 찾기가 진행 중입니다. 조건이 맞으면 여기에 문의가 나타납니다.</p>
          ) : null}

          {ended || closed.length > 0 ? (
            <div role="status" className="rounded-lg bg-warn-bg px-3.5 py-3 text-sm text-warn">
              {ended ? (
                <p className="font-semibold">합의한 곳이 남지 않아 찾기를 마쳤습니다. 아래 사유를 보고 자료를 고쳐 다시 찾아 보세요.</p>
              ) : null}
              <ul className={ended ? "mt-1 space-y-0.5" : "space-y-0.5"}>
                {closed.map((item) => (
                  <li key={item.id}>
                    <span className="font-semibold">
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
            <ResultCard result={view.result} streams={view.streams} role={view.viewer.role} onOpenTalk={openTalk} />
          ) : null}

          {view.result ? <Approvals view={view} d={d} nameOf={nameOf} /> : null}
          <Documents view={view} />

          {isEmitter && d.canAct && (status === "confirmed" || ended) ? (
            <Button variant="secondary" disabled={d.busy} onClick={d.forget}>
              새로 찾기
            </Button>
          ) : null}

          {started ? (
            <details className="group border-t border-line pt-2">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                <ChevronDownIcon className="transition-transform group-open:rotate-180" />
                자세히 보기: 흐름 표, 판단 그래프, 전체 결과표
              </summary>
              <div className="mt-3 space-y-8">
                <section aria-label="흐름" className="overflow-hidden rounded-xl border border-line">
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
                <section aria-label="전체 결과표" className="overflow-hidden rounded-xl border border-line">
                  <ResultSheet
                    result={view.result}
                    streams={view.streams}
                    unresolved={view.unresolved}
                    role={view.viewer.role}
                    vendorName={nameOf}
                  />
                </section>
              </div>
            </details>
          ) : null}
        </Agent>
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
