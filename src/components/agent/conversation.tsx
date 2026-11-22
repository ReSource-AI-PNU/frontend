"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, FactoryIcon, GearIcon, PlusIcon, ReportIcon, StampIcon, TalkIcon, TruckIcon } from "@/components/icons";
import { Fold, FoldGroup } from "@/components/ui/fold";
import { Button, buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { useInView, useMediaQuery } from "@/components/use-media";
import { BlockedNotice } from "@/components/v3/blocked-notice";
import { useV3 } from "@/components/v3/context";
import { ContractReviewBox, needsAck, reviewBlocked } from "@/components/v3/contract-review";
import { JudgementGraph } from "@/components/v3/judgement-graph";
import { ResultSheet } from "@/components/v3/result-sheet";
import { StreamTable } from "@/components/v3/stream-table";
import type { useDiagnosis } from "@/components/v3/use-diagnosis";
import { api } from "@/lib/v3/api";
import { metricRangeText, scenarioOf } from "@/lib/v3/circular";
import { THREAD_LABEL, carbonText, clearedApprovalsText, currentBundle, placedCount, questionIntro } from "@/lib/v3/format";
import { DOC_LABEL, REVIEWER_NAME } from "@/lib/v3/labels";
import { pickupTodo } from "@/lib/v3/pickup";
import { feedText, isTalking, liveTitle, presentStages, presentThreads, typingText, type TalkThread } from "@/lib/v3/live";
import {
  NARROW_QUERY,
  NO_NOTICE,
  noticeChange,
  noticePlacement,
  noticeText,
  pendingQuestionIds,
  sameMark,
  shouldCloseTalk,
  type NoticeMark,
} from "@/lib/v3/question-notice";
import type { Circular, DiagnosisView, Question, Stage, ViewStream } from "@/lib/v3/types";
import { permitLine, permitPaper, permitTodo } from "@/lib/v3/permit";
import { AgentStage } from "./agent-stage";
import { PermitChip } from "./permit-check";
import { AgentTalk, QuestionNotice } from "./agent-talk";
import { FlowChart } from "./flow-chart";
import { RunLog } from "./run-log";
import { ImprovementsSection } from "./improvements";
import { RegulationSection } from "./regulation";
import { OutsideVendorsSection } from "./outside-vendors";
import { ComplexPartnersSection } from "./complex-partners";
import { Dots } from "./dots";
import { CircularEffects } from "./circular-effects";
import { PresentMode } from "./present-mode";
import { ResultCard } from "./result-card";
import { VendorComparison } from "./vendor-comparison";
import { AdaptivePanel } from "@/components/v3/adaptive-panel";
import { findHref, type FindPart, FIND_PARTS } from "@/components/agent/nav-pages";

export { Dots };

type Diagnosis = ReturnType<typeof useDiagnosis>;


function Me({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-sunken px-4 py-2.5 text-[15px]">{children}</div>
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
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
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
function LiveThreads({ threads, onOpen, title }: { threads: TalkThread[]; onOpen: (id: string) => void; title?: string }) {
  if (threads.length === 0) return null;
  return (
    <section aria-label="업체별 대화">
      <h2 className="text-[15px] font-medium">{title ?? `업체 ${threads.length}곳과 대화하고 있습니다`}</h2>
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

/** 찾기의 하위 화면에 아직 보일 것이 없을 때 */
function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-[15px] text-ink-2">{children}</p>;
}

const field =
  "min-h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken";
const segment =
  "flex min-h-[38px] cursor-pointer items-center rounded-sm px-3 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink";

function Questions({
  questions,
  summary,
  streams,
  disabled,
  onAnswer,
}: {
  questions: Question[];
  /** 진단 뷰의 questionBatch(머리 문장 intro, 덧붙임 note) */
  summary: DiagnosisView["questionBatch"];
  streams: ViewStream[];
  disabled: boolean;
  onAnswer: (questionId: string, value: string | number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // 현행 처리비 질문: 지금 팔고 돈을 받으면 "판매"로 고른다(백엔드가 '판매'가 붙은 답을 판매 단가로 읽는다)
  const [selling, setSelling] = useState<Record<string, boolean>>({});
  // 묶음 하나(답한 것 포함)를 기준으로 머리말을 쓰고, 그 가운데 답하지 않은 질문만 그린다
  const bundle = currentBundle(questions);
  const current = bundle.filter((item) => !item.answered);
  if (current.length === 0) return null;
  const head = questionIntro(bundle, summary);
  return (
    <div>
      {/* 답하기가 꺼져 있을 때(진행 중) "답하러 가기"는 이 머리말에 초점을 둔다 */}
      <h2 tabIndex={-1} data-question-head="" className="text-[22px] leading-snug font-semibold tracking-[-0.025em]">
        {head.intro}
      </h2>
      <p className="mt-1.5 text-[15px] text-ink-2">
        모르면 ‘모름’을 누르세요. 다시 묻지 않고 그대로 진행합니다.
        {head.note ? <span className="mt-0.5 block text-[13px] text-muted">{head.note}</span> : null}
      </p>
      <ul className="mt-6 space-y-6">
        {current.map((question) => {
          const stream = streams.find((item) => item.id === question.streamId);
          const draft = drafts[question.id] ?? "";
          const setDraft = (value: string) => setDrafts((before) => ({ ...before, [question.id]: value }));
          const parsed = question.answerType === "number" ? Number(draft) : draft.trim();
          const valid = draft.trim() !== "" && (question.answerType !== "number" || Number.isFinite(parsed as number));
          const isCost = question.field === "currentCost";
          const sold = isCost && Boolean(selling[question.id]);
          return (
            <li key={question.id}>
              <label htmlFor={`q-${question.id}`} className="block text-[15px] font-medium">
                {stream && !question.text.includes(stream.name) ? (
                  <span className="mb-0.5 block text-[13px] font-normal text-muted">{stream.name}</span>
                ) : null}
                {question.text.replace(/\bmoisturePct\b/g, "수분").replace(/\bcontaminationPct\b/g, "오염도").replace(/\bmonthlyKg\b/g, "월 발생량").replace(/\s*모르면 '모름'으로 답해 주세요\.?$/, "")}
              </label>
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (valid && !disabled) onAnswer(question.id, sold ? `판매 kg당 ${parsed}원` : parsed);
                }}
              >
                {isCost ? (
                  <div role="radiogroup" aria-label="돈을 내나요, 받나요" className="inline-flex rounded-md bg-sunken p-[3px]">
                    {[
                      { sell: false, label: "내는 돈" },
                      { sell: true, label: "판매(받는 돈)" },
                    ].map((item) => (
                      <label key={item.label}>
                        <input
                          type="radio"
                          name={`cost-${question.id}`}
                          checked={sold === item.sell}
                          disabled={disabled}
                          onChange={() => setSelling((before) => ({ ...before, [question.id]: item.sell }))}
                          className="peer sr-only"
                        />
                        <span className={segment}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
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
  const { readOnly, basePath } = useV3();
  const isEmitter = view.viewer.role === "emitter";
  const [each, setEach] = useState(false);
  const mine = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.emitter : item.vendor);
  const theirs = (item: DiagnosisView["approvals"][number]) => (isEmitter ? item.vendor : item.emitter);
  // 계약 검토 담당이 막은 합의는 승인할 수 없다(양쪽 모두)
  // 허가증 원문 대조가 끝나지 않은 경로가 있는 합의는 배출 기업이 승인(확정)할 수 없다(서버도 409로 막는다)
  const holds = (item: DiagnosisView["approvals"][number]) => Boolean(item.permitHold) && !(item.emitter && item.vendor);
  const pending = view.approvals.filter(
    (item) => !mine(item) && !item.blocked && !reviewBlocked(item.review) && !(isEmitter && holds(item)),
  );
  const held = view.approvals.filter(holds);
  const stopped = view.approvals.filter((item) => !mine(item) && reviewBlocked(item.review));
  // 확인할 것이 남은 검토가 있으면 담당자가 확인했다고 골라야 승인 단추가 켜진다
  const toCheck = pending.filter((item) => needsAck(item.review));
  const [checked, setChecked] = useState(false);
  const waiting = view.approvals.filter((item) => mine(item) && !theirs(item));
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  const vendorOf = (item: DiagnosisView["approvals"][number]) =>
    view.threads.find((thread) => thread.id === item.threadId)?.vendorName ?? "업체";
  if (view.approvals.length === 0) return null;
  const confirmed = view.session.status === "confirmed";
  const other = isEmitter ? "업체" : "배출 기업";
  const untouched = pending.length === view.approvals.length;
  const showList = each || !untouched || held.length > 0;
  const disabled = !d.canAct || d.busy;
  const unchecked = toCheck.length > 0 && !checked;
  const counterpartOf = (threadId: string) => {
    const thread = view.threads.find((item) => item.id === threadId);
    return isEmitter ? (thread?.vendorName ?? "업체") : nameOf(view.session.emitterOrgId);
  };
  const reviewed = view.approvals.filter((item) => item.review && !(mine(item) && theirs(item)));
  // 승인 전에 확인할 수거·운반(노선 밖 수거 확인, 정해지지 않은 운반비). 합의마다 센다
  const todoOf = (threadId: string) =>
    (view.result?.assignments ?? [])
      .filter((item) => item.threadId === threadId)
      .reduce((count, item) => count + pickupTodo(item).length, 0);
  const todoTotal = pending.reduce((count, item) => count + todoOf(item.threadId), 0);

  return (
    <section aria-label="승인">
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em]">
        {confirmed
          ? "양쪽이 승인해 확정됐습니다."
          : pending.length > 0
            ? isEmitter
              ? "이 조건으로 진행할까요?"
              : "이 조건으로 받으시겠어요?"
            : held.length > 0 && isEmitter && waiting.length === 0
              ? "허가증 원문 대조가 끝나야 확정할 수 있습니다."
              : `승인했습니다. ${other} 승인을 기다리고 있습니다.`}
      </h2>

      {held.length > 0 && !confirmed ? (
        <div className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-sm">
          <p className="font-medium text-ink">허가증 원문 대조가 끝나지 않은 경로는 확정하지 않습니다.</p>
          <MoreDetails label="대조할 것 보기" hint={`${held.length}곳`}>
          <p className="mt-0.5 text-ink-2">
            {isEmitter
              ? "결과표에서 그 줄을 펼쳐 업체가 올린 허가증 원문과 품목·처리 방법을 대조해 기록하면 승인할 수 있습니다."
              : "배출 기업 담당자가 허가증 원문을 대조하면 확정됩니다. 허가증을 아직 올리지 않았으면 자료 화면에서 올려 주세요."}
          </p>
          <ul className="mt-2 space-y-2">
            {held.flatMap((item) =>
              (item.permits ?? [])
                .filter((permit) => permit.status !== "met")
                .map((permit) => (
                  <li key={`${item.threadId}-${permit.streamId}`}>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-ink">
                        {streamName(permit.streamId)} → {vendorOf(item)}
                      </span>
                      <PermitChip permit={permit} />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">
                      {permitTodo(permit).length > 0
                        ? `${permitPaper(permit)} · 확인할 항목: ${permitTodo(permit).join(", ")}`
                        : permitLine(permit)}
                    </span>
                  </li>
                )),
            )}
          </ul>
          </MoreDetails>
        </div>
      ) : null}

      {pending.length > 0 && todoTotal > 0 ? (
        <p className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-sm text-ink-2">
          <span className="font-medium text-warn">승인 전에 확인할 수거·운반 {todoTotal}개</span>{" "}
          <Link href={`${basePath}/approval`} className="font-medium text-ink underline underline-offset-4">
            승인·서류에서 보기
          </Link>
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

      {reviewed.length > 0 && !confirmed ? (
        <div className="mt-5 rounded-xl bg-ground px-4 py-4">
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-ink-2">{REVIEWER_NAME}</span> · 승인 전에 두 AI가 합의한 조건을 항목마다 다시 대조했습니다
          </p>
          <ul className="mt-2 space-y-1.5">
            {reviewed.map((item) => {
              const review = item.review!;
              const checks = review.items.filter((entry) => entry.status === "check").map((entry) => entry.title);
              const blocks = review.items.filter((entry) => entry.status === "block").map((entry) => entry.title);
              return (
                <li key={item.threadId} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[14px]">
                  <span className="font-medium">{counterpartOf(item.threadId)}</span>
                  {blocks.length > 0 ? (
                    <span className="text-loss">막힘 · {blocks.join(", ")}</span>
                  ) : checks.length > 0 ? (
                    <span className="text-warn">확인할 것 · {checks.join(", ")}</span>
                  ) : (
                    <span className="text-ink-2">모두 맞음</span>
                  )}
                </li>
              );
            })}
          </ul>
          <MoreDetails className="mt-1" label="검토 내용 보기">
            <div className="mt-1 space-y-3">
              {reviewed.map((item) => (
                <div key={item.threadId}>
                  <p className="text-[13px] font-semibold text-ink-2">{counterpartOf(item.threadId)}</p>
                  <ContractReviewBox review={item.review!} className="mt-1 !bg-surface" />
                </div>
              ))}
            </div>
          </MoreDetails>
          {stopped.length > 0 ? (
            <p className="mt-2 text-[13px] font-medium text-loss">
              막힌 합의({stopped.map((item) => counterpartOf(item.threadId)).join(", ")})는 막힌 항목이 풀릴 때까지 양쪽 모두 승인할 수 없습니다.
            </p>
          ) : null}
          {toCheck.length > 0 && !readOnly ? (
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] text-ink">
              <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-4 accent-ink" />
              계약 검토의 확인할 것을 읽고 확인했습니다
            </label>
          ) : null}
        </div>
      ) : null}

      {pending.length > 0 && !readOnly ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button disabled={disabled || unchecked} onClick={() => d.approveAll(pending.map((item) => item.threadId))} className="!min-h-12 !px-6 !text-[16px]">
            {d.busy ? "승인하는 중" : "승인하고 진행"}
          </Button>
          {pending.length > 1 && !showList ? (
            <button type="button" onClick={() => setEach(true)} className="min-h-11 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
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
                  {(approval.permits ?? []).length > 0 ? (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                      {(approval.permits ?? []).map((permit) => (
                        <span key={permit.streamId} className="inline-flex items-center gap-1.5">
                          {approval.permits && approval.permits.length > 1 ? streamName(permit.streamId) : "허가"}
                          <PermitChip permit={permit} />
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {!done && todoOf(approval.threadId) > 0 ? (
                    <p className="text-[13px] text-warn">수거·운반 확인할 것 {todoOf(approval.threadId)}개</p>
                  ) : null}
                </div>
                {done ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gain">
                    <CheckIcon /> 확정
                  </span>
                ) : approval.blocked ? (
                  <span className="text-sm font-medium text-warn">승인이 막혔습니다</span>
                ) : reviewBlocked(approval.review) ? (
                  <span className="text-sm font-medium text-loss">계약 검토에서 막혔습니다</span>
                ) : isEmitter && holds(approval) && !mine(approval) ? (
                  <span className="text-sm font-medium text-warn">허가증 대조 뒤 승인</span>
                ) : mine(approval) ? (
                  <span className="text-sm text-muted">{other} 승인 기다리는 중</span>
                ) : readOnly ? (
                  <span className="text-sm text-muted">승인 전</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || (needsAck(approval.review) && !checked)}
                    onClick={() => d.approve(approval.threadId)}
                  >
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
        <Link href={`${basePath}/approval/documents`} className="underline underline-offset-4 hover:text-ink">
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
/** 처리 단계 탄소를 계산하지 못했을 때 접는 칸에 보일 한 줄. 문헌 기반 예상 감축량이 있으면 그것을 적는다 */
function circularSummary(circular: Circular): string | undefined {
  // 펼쳤을 때 맨 앞에 보이는 값과 같은 것을 쓴다(src/components/agent/circular-effects.tsx)
  const totals = circular.reference?.totals ?? scenarioOf(circular, "A")?.totals;
  const text = metricRangeText("ghg", totals?.ghg?.total, totals?.ghg?.upper);
  return text ? `재활용 추정 · ${text}` : undefined;
}

/**
 * part는 찾기 한 건의 어느 화면인지다(nav-pages.ts FIND_PARTS). 진행·결과(main)가 찾기 첫 주소이고, 자세한 내용·AI끼리 나눈 대화·
 * 승인·서류·판단 표·근거는 각자 주소를 가진 화면이다. 찾기 레이아웃이 이 화면을 계속 그려 두므로, 하위 화면을 옮겨 다녀도 실시간 진행과
 * 대화 패널이 끊기지 않는다(app/(agent)/app/find/layout.tsx).
 */
export function Conversation({ d, part = "main" }: { d: Diagnosis; part?: FindPart }) {
  const { orgs, basePath, readOnly } = useV3();
  const router = useRouter();
  const view = d.view as DiagnosisView;
  const stream = d.stream;
  const live = stream.state;
  const holding = stream.holding;
  const replaying = stream.active && stream.target?.mode === "replay";
  // 실행 중에는 AI 작업실이 대화를 그림으로 보여 주므로 대화 패널을 저절로 열지 않는다(작업실을 가리지 않게).
  // 업체 캐릭터나 업체별 대화 줄을 누르면 그 대화가 열린다
  const [talkOpen, setTalkOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  // 발표 화면: 끝난 찾기를 큰 화면에 다시 재생한다(멈춤·빠르기·처음부터)
  const [presenting, setPresenting] = useState(false);

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
  const lastFeed = stream.active ? (live?.feed[live.feed.length - 1] ?? null) : null;
  const liveLine = lastFeed ? feedText(lastFeed) || null : null;
  // 맨 위 한 줄과 대화 단추는 지금 단계와 마지막 활동으로 정한다(식별·분류 중에는 업체에 묻는다고 쓰지 않는다)
  const runningStage = stages.find((item) => item.status === "running")?.stage ?? (stream.active ? (live?.stage ?? null) : null);
  const talkingNow = stream.active && isTalking(live);
  const title = liveTitle({ stage: runningStage, live: stream.active ? live : null, replaying });

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
  // 받아 줄 곳이 하나도 없으면 바꾼 뒤와 비교할 것이 없다. 효과와 흐름은 보이지 않고 지금 비용만 둔다
  const hasRoute = result !== null && placedCount(result.assignments) > 0;
  // 받은 견적이 있는 폐기물 수(업체 견적 비교 접는 칸의 오른쪽 값)
  const quoted = result ? result.assignments.filter((item) => item.vendorOrgId && item.unitPrice).length : 0;
  const liveThreads = threads.filter((item) => item.messages.length > 0 || item.typing);
  const openTalk = (id: string) => {
    setThreadId(id);
    setTalkOpen(true);
  };
  // "AI끼리 나눈 대화" 화면으로 오면 대화 패널을 연다(다른 화면에서 옮겨 올 때마다). 렌더 중에 앞의 화면과 견주어 고친다
  const [shownPart, setShownPart] = useState<FindPart | null>(null);
  if (shownPart !== part) {
    setShownPart(part);
    if (part === "talk" && view.threads.length > 0) setTalkOpen(true);
  }
  // 찾기 레이아웃이 화면을 계속 그려 두므로, 하위 화면을 옮기면 다른 화면처럼 맨 위에서 시작하게 직접 올린다
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [part]);
  const replay = () => {
    setThreadId(null);
    d.replay();
  };
  const present = () => {
    setTalkOpen(false);
    setPresenting(true);
    stream.setPaused(false);
    stream.setSpeed(1);
    d.replay();
  };
  // 업체 대화 화면의 "발표 화면으로 다시 보기"(?present=1)로 들어오면 한 번 바로 연다
  const autoPresent = useRef(false);
  useEffect(() => {
    if (autoPresent.current || working || !d.canReplay) return;
    if (new URLSearchParams(window.location.search).get("present") !== "1") return;
    autoPresent.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // 효과 안에서 곧바로 상태를 바꾸지 않고(react-hooks/set-state-in-effect) 다음 틱에 연다
    window.setTimeout(present, 0);
    // present는 렌더마다 새로 만든다. 한 번만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, d.canReplay]);
  const closePresent = () => {
    setPresenting(false);
    stream.setPaused(false);
    if (replaying) d.stopReplay();
  };

  // 담당자 답이 필요한 질문이 대화 패널 뒤에 가리지 않게 한다(src/lib/v3/question-notice.ts).
  // 새 질문이 오거나 남은 질문에 이제 답할 수 있게 되면, 좁은 화면에서는 패널을 닫는다. 렌더 중에 앞서 알린 것과 견주어 고친다
  const narrow = useMediaQuery(NARROW_QUERY);
  const pendingIds = pendingQuestionIds(questions, { isEmitter, replaying, readOnly });
  const answerable = !working && d.canAct && !d.busy;
  const mark: NoticeMark = { ids: pendingIds, answerable };
  const [noticed, setNoticed] = useState<NoticeMark>(NO_NOTICE);
  if (!sameMark(noticed, mark)) {
    setNoticed(mark);
    if (shouldCloseTalk(noticeChange(noticed, mark), { talkOpen, narrow })) setTalkOpen(false);
  }
  const [questionsNode, setQuestionsNode] = useState<HTMLDivElement | null>(null);
  // 휴대폰 머리줄(52px)과 화면 아래 대화 단추 자리를 뺀 곳에 질문 칸이 보이는지
  const formInView = useInView(questionsNode, pendingIds.length > 0 && !talkOpen, "-60px 0px -96px 0px");
  const placement = noticePlacement({ pending: pendingIds.length, talkOpen, formInView });
  const goToQuestions = () => {
    setTalkOpen(false);
    // 질문 칸은 진행·결과 화면에 있다. 다른 화면에서는 그리로 옮긴다
    if (part !== "main") {
      router.push(findHref(basePath, "main"));
      return;
    }
    // 패널이 닫힌 뒤에 질문 칸으로 내려가 첫 입력 칸(답하기가 꺼져 있으면 머리말)에 초점을 둔다
    requestAnimationFrame(() => {
      if (!questionsNode) return;
      const target =
        questionsNode.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled)") ??
        questionsNode.querySelector<HTMLElement>("[data-question-head]");
      target?.focus({ preventScroll: true });
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      questionsNode.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    });
  };
  const notice = pendingIds.length > 0 ? { count: pendingIds.length, answerable, onGo: goToQuestions } : null;
  const noticeWords = notice ? noticeText(notice.count, notice.answerable) : null;

  return (
    <div className="flex flex-1 flex-col">
      {/* 화면 읽기 프로그램에는 질문이 오는 대로 알린다(패널이 열려 있으면 패널 안에서 알린다) */}
      <p role="status" aria-live="polite" className="sr-only">
        {noticeWords && !talkOpen ? `${noticeWords.title}. ${noticeWords.detail}.` : ""}
      </p>
      {notice && placement.page ? (
        // 질문 칸이 화면 밖이면 본문 맨 위에 붙여 둔다. 높이 0인 자리에 띄워 본문을 밀지 않는다
        <div className="pointer-events-none sticky top-13 z-10 h-0 lg:top-0">
          <div className="pointer-events-auto mx-auto w-full max-w-[760px] px-5 pt-3 [animation:rs-rise_240ms_var(--ease-out)_both]">
            <QuestionNotice {...notice} />
          </div>
        </div>
      ) : null}
      {!isEmitter && !readOnly ? (
        <div className="flex justify-end px-3 pt-3">
          <Link
            href={`${basePath}/inquiries`}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
          >
            다른 문의 보기
          </Link>
        </div>
      ) : null}
      {/* 새로 찾기는 진행·결과 화면에만 둔다(하위 화면에서 누르면 보던 화면이 비어 버린다) */}
      {isEmitter && d.canAct && !working && part === "main" ? (
        <div className="flex justify-end px-3 pt-3">
          <button
            type="button"
            disabled={d.busy}
            onClick={d.forget}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <PlusIcon className="size-3.5" />
            새로 찾기
          </button>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[820px] flex-1 space-y-7 px-5 pt-6 pb-10">
        {part === "main" ? null : (
          <header>
            <p className="text-[13px] text-muted">
              {isEmitter ? `이번 찾기 · 폐기물 ${view.streams.length}가지` : `${emitterName}의 문의`} · {view.streams.map((item) => item.name).join(", ")}
            </p>
            <h1 className="text-[24px] leading-tight font-bold tracking-[-0.03em]">{FIND_PARTS.find((item) => item.part === part)?.label}</h1>
          </header>
        )}

        {part === "main" ? (
          <>
            {isEmitter ? (
              <Me>
                폐기물 {view.streams.length}가지를 받아 줄 곳을 찾아 주세요.
                <span className="mt-0.5 block text-[13px] text-muted">{view.streams.map((item) => item.name).join(", ")}</span>
              </Me>
            ) : null}

            <Progress
              stages={stages}
              running={working}
              title={title}
              line={liveLine}
              action={
                replaying ? (
                  <button type="button" onClick={stream.skip} className="min-h-11 text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">
                    건너뛰기
                  </button>
                ) : null
              }
            />

            {working && stream.active && live ? <AgentStage live={live} onOpen={openTalk} /> : null}

            {working ? <LiveThreads threads={liveThreads} onOpen={openTalk} /> : null}

            {readOnly && d.canReplay && !working ? (
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button variant="secondary" onClick={replay}>
                    두 AI의 대화 다시 보기
                  </Button>
                  <button type="button" onClick={present} className="min-h-11 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
                    발표 화면으로 크게 보기
                  </button>
                </div>
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
              <div ref={setQuestionsNode} id="questions" className="scroll-mt-20">
                <Questions
                  questions={questions}
                  summary={holding ? null : view.questionBatch}
                  streams={view.streams}
                  disabled={!d.canAct || d.busy}
                  onAnswer={d.answerAndContinue}
                />
                {working && openQuestions.length > 0 ? (
                  <p className="mt-3 text-[13px] text-muted">진행이 끝나면 답할 수 있습니다.</p>
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

            {isEmitter && !readOnly ? <AdaptivePanel key={view.session.id} view={view} busy={d.busy || working} /> : null}

            {blocked.map((approval) => (
              <BlockedNotice
                key={approval.threadId}
                codes={approval.blockedCodes}
                reason={approval.blockedReason}
                canRerun={isEmitter && d.canAct}
                cleared={clearedApprovalsText(approval)}
                busy={d.busy || working}
                onRerun={d.run}
                vendorName={view.threads.find((item) => item.id === approval.threadId)?.vendorName}
              />
            ))}

            {result ? (
              <div>
                <ResultCard
                  result={result}
                  streams={view.streams}
                  role={view.viewer.role}
                  counterpart={emitterName}
                  onOpenTalk={openTalk}
                  onPermitCheck={isEmitter && d.canAct && !readOnly && status === "awaiting_approval" ? d.recordPermitCheck : undefined}
                  busy={d.busy}
                  threads={view.threads}
                  approvals={view.approvals}
                />
              </div>
            ) : null}

            {result && !holding && (view.approvals.length > 0 || view.documents.length > 0) ? (
              <nav aria-label="다음 할 일" className="flex flex-wrap gap-2">
                {view.approvals.length > 0 ? (
                  <Link href={findHref(basePath, "approve")} className={buttonClass("secondary", "md")}>
                    {status === "confirmed" ? "승인 상태 보기" : "승인하러 가기"}
                  </Link>
                ) : null}
                {view.documents.length > 0 ? (
                  <Link href={findHref(basePath, "documents")} className={buttonClass("secondary", "md")}>
                    서류 {view.documents.length}건 보기
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : null}

        {part === "details" ? (
          <>
            {/* 결과 표 아래의 자세한 내용은 모두 접어 둔다. 제목과 한 줄 값만 보이고, 누르면 펼쳐진다 */}
            {result && isEmitter && !holding ? (
              <FoldGroup className="[&_section]:border-0 [&_section]:pt-0">
                {/* 받은 견적 비교는 결과 표의 자세한 내용이라 다른 것처럼 접어 둔다(AGENTS.md 화면 규칙 "접기") */}
                {!readOnly && !d.org.demo && !d.org.synthetic && quoted > 0 ? (
                  <Fold title="업체 견적 비교" summary={`${quoted}가지`} icon={<TalkIcon />}>
                    <VendorComparison assignments={result.assignments} streams={view.streams} threads={view.threads} onOpenTalk={openTalk} />
                  </Fold>
                ) : null}
                {hasRoute && result.circular ? (
                  <Fold
                    title="자원순환 효과"
                    summary={circularSummary(result.circular) ?? carbonText(result.totals.carbon, true)}
                    icon={<ReportIcon />}
                  >
                    <CircularEffects circular={result.circular} />
                  </Fold>
                ) : null}
                {hasRoute && view.streams.length > 0 ? (
                  <Fold title="처리 흐름" summary={`${view.streams.length}가지`} icon={<TruckIcon />}>
                    <FlowChart result={result} streams={view.streams} />
                  </Fold>
                ) : null}
                {result.regulation && result.regulation.length > 0 ? (
                  <Fold
                    title="법령 요건"
                    summary={
                      view.approvals.some((item) => item.permitHold) ? (
                        <span className="font-semibold text-warn">허가증 대조 {view.approvals.filter((item) => item.permitHold).length}곳</span>
                      ) : undefined
                    }
                    icon={<StampIcon />}
                  >
                    <RegulationSection sections={result.regulation} streams={view.streams} />
                  </Fold>
                ) : null}
                {result.improvements && result.improvements.length > 0 ? (
                  <Fold title="분리 개선 안내" summary={`${result.improvements.length}가지`} icon={<ArrowUpIcon />}>
                    <ImprovementsSection items={result.improvements} streams={view.streams} />
                  </Fold>
                ) : null}
                {result.outsideVendors ? (
                  <Fold title="가입하지 않은 업체" icon={<FactoryIcon />}>
                    <OutsideVendorsSection
                      outside={result.outsideVendors}
                      streams={view.streams}
                      sessionId={view.session.id}
                      orgId={d.org.id}
                      onSearchAgain={d.canAct ? d.forget : undefined}
                    />
                  </Fold>
                ) : null}
                {result.complexPartners ? (
                  <Fold title="같은 단지 공개 명부" icon={<FactoryIcon />}>
                    <ComplexPartnersSection
                      partners={result.complexPartners}
                      outside={result.outsideVendors ?? null}
                      streams={view.streams}
                      sessionId={view.session.id}
                      orgId={d.org.id}
                      onSearchAgain={d.canAct ? d.forget : undefined}
                    />
                  </Fold>
                ) : null}
                {view.events.length > 0 && !working ? (
                  <Fold title="AI가 한 일" summary={`기록 ${view.events.length}건`} icon={<GearIcon />}>
                    <RunLog events={view.events} />
                  </Fold>
                ) : null}
              </FoldGroup>
            ) : (
              <Empty>{isEmitter ? "결과가 나오면 업체 견적 비교, 자원순환 효과, 처리 흐름, 법령 요건 같은 자세한 내용을 볼 수 있습니다." : "자세한 내용은 배출 기업의 화면입니다."}</Empty>
            )}
          </>
        ) : null}

        {part === "talk" ? (
          liveThreads.length > 0 ? (
            <LiveThreads threads={liveThreads} onOpen={openTalk} title={working ? undefined : `업체 ${liveThreads.length}곳과 나눈 대화`} />
          ) : (
            <Empty>아직 AI끼리 나눈 대화가 없습니다. 찾기를 시작하면 업체마다 대화가 여기에 모입니다.</Empty>
          )
        ) : null}

        {part === "approve" ? (
          result ? (
            <Approvals view={view} d={d} nameOf={nameOf} />
          ) : (
            <Empty>결과가 나오면 여기에서 승인합니다.</Empty>
          )
        ) : null}

        {part === "documents" ? (
          !holding && view.documents.length > 0 ? (
            <Documents view={view} />
          ) : (
            <Empty>양쪽이 승인하면 요청서, 이행 계획서, 계약서 초안이 만들어집니다.</Empty>
          )
        ) : null}

        {part === "trace" ? (
          <>
            {result && !working ? (
              <div>
                <p className="text-[13px] text-muted">판단 과정 전체 (자료 표, 판단 그래프, 계산표)</p>
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
              </div>
            ) : (
              <Empty>결과가 나오면 판단 과정 전체(자료 표, 판단 그래프, 계산표)를 볼 수 있습니다.</Empty>
            )}
          </>
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
        talking={talkingNow}
        title={title}
        sessionStatus={holding ? "running" : status}
        liveLine={liveLine}
        freshIds={freshIds}
        replay={{ can: d.canReplay, active: replaying, start: replay, skip: stream.skip, present }}
        notice={placement.panel ? notice : null}
      />
      {presenting ? (
        <PresentMode
          d={d}
          view={view}
          threads={threads}
          stages={stages}
          emitterName={emitterName}
          caption={liveLine ?? title}
          followId={followId}
          onClose={closePresent}
        />
      ) : null}
    </div>
  );
}
