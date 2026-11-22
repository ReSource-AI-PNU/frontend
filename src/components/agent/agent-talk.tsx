"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, TalkIcon } from "@/components/icons";
import { useEscape } from "@/components/use-escape";
import { ClaimText, ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { EventDetail } from "@/components/v3/event-detail";
import { josa } from "@/lib/josa";
import { evidenceOf, threadLabel, typingText, withinVendorRange, type TalkThread, type Typing } from "@/lib/v3/live";
import { MESSAGE_LABEL, formatDateTime, formatNumber } from "@/lib/v3/format";
import { AI_NAME, REVIEWER_NAME, eventSummary } from "@/lib/v3/labels";
import { noticeText } from "@/lib/v3/question-notice";
import { PICKUP_STATUS_LABEL } from "@/lib/v3/pickup";
import type { DiagnosisView, ThreadMessage } from "@/lib/v3/types";

type MessagePickup = NonNullable<NonNullable<NonNullable<ThreadMessage["meta"]>["terms"]>["pickup"]>;
import { Dots } from "./dots";

const ACTOR_LABEL: Record<string, string> = {
  company_agent: AI_NAME.company,
  vendor_agent: AI_NAME.vendor,
  validator: "근거 검증기",
  contract_reviewer: REVIEWER_NAME,
  tool: "판단 도구",
  system: "시스템",
};

const chip =
  "inline-flex min-h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[12px] text-ink-2 [&_svg]:size-3.5";

type ReviewLike = { status: string; summary: string; items: { key: string; title: string; status: string; text: string }[] };
const REVIEW_CHIP: Record<string, string> = {
  block: "bg-loss-bg text-loss",
  check: "bg-warn-bg text-warn",
};
const REVIEW_WORD: Record<string, string> = { block: "막힘", check: "확인할 것" };

/**
 * 계약 검토 담당의 말(세 번째 화자). 어느 편도 아니라 가운데에 둔다: `ground` 바탕과 가는 선, 위에 이름을 적는다.
 * 막힘·확인할 것은 항목 이름을 칩으로 보이고, 통과는 개수만 적는다(자세한 문장은 승인 상자에 있다).
 */
export function ReviewNote({ review, fresh, className = "" }: { review: ReviewLike; fresh: boolean; className?: string }) {
  const urgent = review.items.filter((item) => item.status !== "ok");
  const passed = review.items.length - urgent.length;
  return (
    <li className={`${fresh ? "[animation:rs-rise_320ms_var(--ease-out)_both]" : ""} ${className}`}>
      <div className="mx-auto max-w-[96%] rounded-xl border border-line bg-ground px-4 py-3">
        <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          <span className="font-medium text-ink-2">{REVIEWER_NAME}</span>
          <span>양쪽 합의 조건 대조</span>
        </p>
        <p className="text-[15px] leading-relaxed">{review.summary}</p>
        {urgent.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {urgent.map((item) => (
              <li key={item.key} className={`inline-flex min-h-6 items-center rounded-[6px] px-2 text-[13px] font-medium ${REVIEW_CHIP[item.status] ?? ""}`}>
                {REVIEW_WORD[item.status]} · {item.title}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-[12px] text-muted">
          {passed > 0 ? `통과 ${passed}가지 · ` : ""}
          {review.status === "blocked" ? "막힌 항목이 풀릴 때까지 양쪽 모두 승인할 수 없습니다." : "사람이 승인하기 전에 규칙으로 다시 대조했습니다."}
        </p>
      </div>
    </li>
  );
}

/**
 * 말풍선 하나. 누가 썼는지는 백엔드가 준 작성자 표시(author.label: 회사 측 AI · 업체 측 AI · 자동 안내)로 적고,
 * 모델·구현 이름은 쓰지 않는다. 표시가 없는 예전 뷰는 보낸 쪽으로 정한다.
 * 아래에 "근거 n개 확인"(누르면 근거가 열린다)과, 업체 측 AI가 업체가 정한 범위 안에서 낸 조건이면 그 표시를 단다.
 */
/**
 * 업체 조건 답의 수거·운반 견적을 한 줄로: 수거 상태 · 운반비(회당 금액 × 월 횟수 또는 월 금액, 근거가 열리는 값).
 * 본문의 "수거·운반:" 문장과 같은 값이다. 금액·횟수가 빠졌으면 무엇이 빠졌는지 `warn`으로 적는다.
 */
function PickupQuote({ pickup, claims }: { pickup: MessagePickup; claims: ThreadMessage["claims"] }) {
  const fee = claims.find((claim) => claim.id === pickup.feeClaimId) ?? null;
  const count = claims.find((claim) => claim.id === pickup.pickupsClaimId) ?? null;
  const unconfirmed = pickup.status === "check" || pickup.status === "unknown" || pickup.status === "unavailable";
  return (
    <p className="mt-2 text-[13px] text-ink-2">
      수거·운반 견적 · <span className={unconfirmed ? "text-warn" : undefined}>{PICKUP_STATUS_LABEL[pickup.status]}</span>
      {pickup.status === "unavailable" ? null : pickup.basis === "included" ? (
        " · 운반비 단가에 포함"
      ) : pickup.basis === "separate" && fee ? (
        <>
          {" · 운반비 "}
          {pickup.unit === "per_month" ? "한 달 " : "회당 "}
          <ClaimValue claim={fee} display={typeof fee.value === "number" ? `${formatNumber(fee.value)}원` : undefined} className="!font-normal" />
          {pickup.unit === "per_month" ? null : count ? (
            <>
              {" × "}
              <ClaimValue claim={count} display={typeof count.value === "number" ? `월 ${formatNumber(count.value)}회` : undefined} className="!font-normal" />
            </>
          ) : (
            <span className="text-warn"> · 월 수거 횟수 확인 필요</span>
          )}
          {pickup.paidBy === "emitter" ? " (공장 부담)" : null}
        </>
      ) : (
        <span className="text-warn"> · 운반비 {pickup.basis === "separate" ? "금액 확인 필요" : "미정"}</span>
      )}
    </p>
  );
}

export function Bubble({
  message,
  mine,
  name,
  fresh,
  clamp = false,
}: {
  message: ThreadMessage;
  mine: boolean;
  name: string;
  fresh: boolean;
  /** 긴 말은 몇 줄만 보이고 "더 보기"로 편다(업체 대화 화면) */
  clamp?: boolean;
}) {
  const { openEvidence } = useV3();
  const [more, setMore] = useState(false);
  const long = clamp && message.text.length > 150;
  const { validation } = message;
  const evidence = evidenceOf(message);
  const rewritten = (validation.attempts ?? 1) > 1;
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"} ${fresh ? "[animation:rs-rise_320ms_var(--ease-out)_both]" : ""}`}>
      <div className="max-w-[92%]">
        <p className={`mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted ${mine ? "" : "justify-end"}`}>
          <span className="font-medium text-ink-2">{message.author?.label ?? (mine ? AI_NAME.company : AI_NAME.vendor)}</span>
          <span>{name}</span>
          <span>{MESSAGE_LABEL[message.type] ?? message.type}</span>
        </p>
        <div
          className={`rounded-xl px-4 py-3 text-[15px] leading-relaxed ${mine ? "bg-sunken" : "border border-line bg-surface"}`}
        >
          <div className={long && !more ? "line-clamp-3" : undefined}>
            <ClaimText text={message.text} claims={message.claims} />
          </div>
          {long ? (
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((before) => !before)}
              className="mt-1 min-h-9 text-[13px] font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              {more ? "접기" : "더 보기"}
            </button>
          ) : null}
          {message.meta?.terms?.pickup ? <PickupQuote pickup={message.meta.terms.pickup} claims={message.claims} /> : null}
          {message.meta?.terms && message.meta.terms.days.length > 0 ? (
            <p className="mt-2 text-[13px] text-ink-2">수거 요일 {message.meta.terms.days.join("·")}</p>
          ) : null}
        </div>
        <p className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] ${mine ? "" : "justify-end"}`}>
          {!validation.ok ? (
            <span className="font-semibold text-loss">근거 확인 실패</span>
          ) : evidence.count > 0 ? (
            <button
              type="button"
              disabled={evidence.ids.length === 0}
              onClick={() => openEvidence(evidence.ids, "이 메시지의 근거")}
              className={`${chip} hover:border-ink hover:text-ink disabled:hover:border-line`}
            >
              <CheckIcon />
              근거 {evidence.count}개 확인
            </button>
          ) : null}
          {withinVendorRange(message) ? <span className={chip}>업체가 정한 범위 안에서 제안</span> : null}
          {validation.ok && rewritten ? <span className="text-muted">다시 써서 보냄</span> : null}
        </p>
      </div>
    </li>
  );
}

/** 말풍선이 나오기 전, 쓰는 쪽 AI의 지금 상태(작성 중 → 근거 확인 중 → 다시 쓰는 중) */
function TypingBubble({ typing, left }: { typing: Typing; left: boolean }) {
  const text = typingText(typing);
  return (
    <li className={`flex ${left ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[92%]">
        <p className={`mb-1 text-[12px] font-medium text-ink-2 ${left ? "" : "text-right"}`}>{typing.label}</p>
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-3 text-[14px] text-ink-2 ${left ? "bg-sunken" : "border border-line bg-surface"}`}
        >
          <Dots label={text} />
          <span>{text}</span>
        </div>
      </div>
    </li>
  );
}

/**
 * 담당자 답이 필요한 질문 알림 한 줄("담당자 답이 필요합니다 · 답하러 가기"). 대화 패널 맨 위와, 패널이 닫혀 있고
 * 질문 칸이 화면 밖일 때 본문 맨 위에 둔다. 누르면 패널을 닫고 질문 칸으로 간다.
 */
export function QuestionNotice({ count, answerable, onGo }: { count: number; answerable: boolean; onGo: () => void }) {
  const text = noticeText(count, answerable);
  return (
    <div className="flex flex-wrap items-center gap-x-3 rounded-xl bg-warn-bg py-1 pr-2 pl-4 shadow-[0_6px_20px_-12px_rgb(0_0_0/0.35)]">
      <p className="min-w-0 flex-1 py-1.5 text-[14px] leading-snug">
        <span className="font-semibold text-warn">{text.title}</span>
        <span className="text-ink-2"> · {text.detail}</span>
      </p>
      <button
        type="button"
        onClick={onGo}
        className="min-h-11 shrink-0 rounded-lg px-2.5 text-[14px] font-semibold text-ink underline underline-offset-4 hover:bg-surface"
      >
        {text.action}
      </button>
    </div>
  );
}

/** 두 AI의 이름. 백엔드 작성자 표시(author.label, vendorAuthor.label)가 있으면 그 낱말을 쓴다 */
function sideNames(thread: TalkThread, vendorAuthor?: { label: string } | null): { company: string; vendor: string } {
  const agent = (side: "company" | "vendor") =>
    thread.messages.find((message) => message.author?.side === side && message.author.kind === "agent")?.author?.label;
  return { company: agent("company") ?? AI_NAME.company, vendor: agent("vendor") ?? vendorAuthor?.label ?? AI_NAME.vendor };
}

/** 대화마다 두 AI가 누구를 대변하는지 */
function Sides({ emitterName, vendorName, names }: { emitterName: string; vendorName: string; names: { company: string; vendor: string } }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-2.5 text-[12px] leading-snug">
      <p>
        <span className="block font-medium text-ink">{names.company}</span>
        <span className="block text-muted">{josa(emitterName, "을/를")} 대변합니다</span>
      </p>
      <p className="text-right">
        <span className="block font-medium text-ink">{names.vendor}</span>
        <span className="block text-muted">{josa(vendorName, "을/를")} 대변합니다</span>
      </p>
    </div>
  );
}

/**
 * 두 에이전트가 주고받은 대화. 평소에는 화면 아래 가운데의 단추 하나로 접혀 있고, 누르면 오른쪽에서 패널이 열린다.
 * 실행 중에는 말풍선이 오는 대로 나타나고, 그 전에 쓰는 쪽 AI의 상태(작성 중·근거 확인 중·다시 쓰는 중)가 보인다.
 * 숫자를 누르면 근거가 열린다.
 */
export function AgentTalk({
  view,
  threads,
  emitterName,
  open,
  onOpenChange,
  threadId,
  onThreadChange,
  followId,
  working,
  talking,
  title,
  sessionStatus,
  liveLine,
  freshIds,
  replay,
  notice,
}: {
  view: DiagnosisView;
  /** 뷰의 대화와 스트림으로 받은 것을 합친 것(src/lib/v3/live.ts presentThreads) */
  threads: TalkThread[];
  emitterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string | null;
  onThreadChange: (id: string) => void;
  /** 실행 중에 고르지 않았으면 따라가는 대화(마지막으로 움직인 대화) */
  followId: string | null;
  /** AI가 일하는 중(실행 또는 다시 보기) */
  working: boolean;
  /** 지금 두 AI가 대화하는 중(마지막 활동이 대화에 붙어 있음) */
  talking: boolean;
  /** 진행 화면 맨 위 한 줄(지금 단계에 맞춘 말). 진행 기록이 아직 없을 때 패널에도 쓴다 */
  title: string;
  /** 진단 상태. 실행이 끝났는데 열려 있는 대화를 무엇으로 적을지 정한다 */
  sessionStatus: string | null;
  /** 지금 일어나는 일 한 줄 */
  liveLine: string | null;
  /** 스트림으로 막 받은 메시지(들어올 때 살짝 떠오른다) */
  freshIds: Set<string>;
  /** present: 발표 화면(큰 화면 다시 재생)을 연다 */
  replay: { can: boolean; active: boolean; start: () => void; skip: () => void; present?: () => void };
  /** 담당자 답이 필요한 질문이 남았으면 패널 맨 위에 알린다(src/lib/v3/question-notice.ts) */
  notice?: { count: number; answerable: boolean; onGo: () => void } | null;
}) {
  const [showEvents, setShowEvents] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const opened = threads.filter((item) => item.messages.length > 0 || item.typing);
  const skipped = view.threads.filter((item) => item.messages.length === 0 && item.statusReason && !opened.some((open) => open.id === item.id));
  const thread =
    opened.find((item) => item.id === threadId) ?? (working ? opened.find((item) => item.id === followId) : undefined) ?? opened[0] ?? null;
  const total = opened.reduce((sum, item) => sum + item.messages.length, 0);
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  const typingKey = thread?.typing ? `${thread.typing.side}:${thread.typing.phase}:${thread.typing.reason ?? ""}` : "";

  // Esc는 맨 위 패널만 닫는다. 근거 패널이 위에 열려 있으면 그것이 먼저 닫힌다
  useEscape(open, () => onOpenChange(false));

  // 실행 중에는 새 말풍선과 쓰는 중 표시가 보이게 아래로 내린다
  useEffect(() => {
    if (!open || !working) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [open, working, thread?.id, thread?.messages.length, typingKey]);

  if (total === 0 && !open && !working) return null;
  // 대화가 아직 하나도 열리지 않았으면 단추를 두지 않는다(식별·분류 중에는 볼 대화가 없다)
  const showButton = opened.length > 0 || !working;
  const tabLabel = (item: TalkThread) => threadLabel(item, { working, sessionStatus });

  return (
    <>
      {showButton ? (
        <div className="pointer-events-none sticky bottom-0 z-10 flex justify-center bg-gradient-to-t from-bg from-40% to-transparent px-5 pt-8 pb-5">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-expanded={open}
            className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface pr-4 pl-3.5 text-sm font-medium shadow-[0_6px_20px_-10px_rgb(0_0_0/0.3)] transition-colors hover:border-ink"
          >
            <TalkIcon className="text-muted" />
            {talking ? "AI끼리 대화하는 중" : "AI끼리 나눈 대화 보기"}
            {talking ? <Dots label="대화하는 중" /> : total > 0 ? <span className="text-muted tabular-nums">{total}</span> : null}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-30">
          <button type="button" aria-label="대화 닫기" className="absolute inset-0 bg-ink/25" onClick={() => onOpenChange(false)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="AI끼리 나눈 대화"
            className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-bg shadow-[0_0_60px_rgb(0_0_0/0.18)] [animation:rs-panel_240ms_var(--ease-out)_both]"
          >
            <header className="flex items-start gap-3 px-5 pt-4 pb-2">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">AI끼리 나눈 대화</h2>
                <p className="text-[13px] text-ink-2">AI가 보내는 숫자와 조항은 모두 근거를 확인한 뒤에만 나갑니다.</p>
                <p className="text-[13px] text-muted">숫자를 누르면 근거가 열립니다.</p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => onOpenChange(false)}
                aria-label="대화 닫기"
                className="-mr-1 ml-auto grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
              >
                <CloseIcon />
              </button>
            </header>

            {/* 질문은 본문에 있어 패널 뒤에 가린다. 맨 위에 알리고 누르면 패널을 닫고 질문 칸으로 간다 */}
            <div role="status" aria-live="polite" className={notice ? "px-5 pb-2" : undefined}>
              {notice ? <QuestionNotice {...notice} /> : null}
            </div>

            {working || replay.can ? (
              <div className="flex min-h-10 items-center gap-2 px-5 pb-2 text-[13px]">
                {working ? (
                  <>
                    <Dots label="진행 중" />
                    <span className="min-w-0 flex-1 truncate text-ink-2" aria-live="polite">
                      {liveLine ?? (replay.active ? "지난 대화를 다시 보여 드립니다." : title)}
                    </span>
                    {replay.active ? (
                      <button type="button" onClick={replay.skip} className="min-h-11 shrink-0 rounded-md px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
                        건너뛰기
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={replay.start} className="-ml-2 min-h-11 rounded-md px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
                      처음부터 다시 보기
                    </button>
                    {replay.present ? (
                      <button type="button" onClick={replay.present} className="min-h-11 rounded-md px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
                        발표 화면으로 크게 보기
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {opened.length > 0 ? (
              <div role="tablist" aria-label="업체별 대화" className="flex shrink-0 gap-5 overflow-x-auto border-b border-line px-5">
                {opened.map((item) => {
                  const active = item.id === thread?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onThreadChange(item.id)}
                      className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 text-sm whitespace-nowrap ${active ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
                    >
                      {item.vendorName}
                      <span className="text-[12px] font-normal text-muted">{tabLabel(item)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 py-5">
                {thread ? (
                  <>
                    <p className="text-[13px] text-muted">
                      {thread.streamIds.map(streamName).join(", ") || "다룬 폐기물"} · {thread.messages.length}번 주고받음
                    </p>
                    <Sides
                      emitterName={emitterName}
                      vendorName={thread.vendorName}
                      names={sideNames(thread, view.threads.find((item) => item.id === thread.id)?.vendorAuthor)}
                    />
                    {thread.statusReason ? (
                      <StatusReason thread={thread} />
                    ) : !working && thread.outcomeText ? (
                      <p className="mt-3 rounded-xl bg-ground px-3.5 py-2.5 text-sm text-ink-2">{thread.outcomeText}</p>
                    ) : null}
                    <ol className="mt-5 space-y-5">
                      {thread.messages.map((message) => {
                        const mine = message.author ? message.author.side === "company" : message.from === view.session.emitterOrgId;
                        return (
                          <Bubble
                            key={message.id}
                            message={message}
                            mine={mine}
                            name={mine ? emitterName : thread.vendorName}
                            fresh={freshIds.has(message.id)}
                          />
                        );
                      })}
                      {thread.typing ? <TypingBubble typing={thread.typing} left={thread.typing.side === "company"} /> : null}
                      {(() => {
                        // 실행·다시 보기 중에는 스트림으로 받은 검토만, 끝났으면 승인 상자의 지금 검토를 쓴다
                        const stored = view.approvals.find((item) => item.threadId === thread.id)?.review ?? null;
                        const review = thread.review ?? (working ? null : stored);
                        return review ? <ReviewNote review={review} fresh={Boolean(thread.review) && working} /> : null;
                      })()}
                    </ol>
                    <div ref={endRef} />
                  </>
                ) : working ? (
                  <p className="flex items-center gap-2.5 text-sm text-ink-2">
                    <Dots label="준비 중" />
                    {title} 업체와 대화가 열리면 여기에 나타납니다.
                  </p>
                ) : (
                  <p className="text-sm text-muted">아직 주고받은 메시지가 없습니다.</p>
                )}

                {skipped.length > 0 && !working ? (
                  <div className="mt-8 border-t border-line pt-4">
                    <h3 className="text-[13px] text-muted">묻지 않은 업체</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                      {skipped.map((item) => (
                        <li key={item.id}>
                          <span className="font-medium text-ink">{item.vendorName}</span> · {item.statusReason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!working ? (
                  <div className="mt-6 border-t border-line pt-3">
                    <button
                      type="button"
                      aria-expanded={showEvents}
                      onClick={() => setShowEvents((before) => !before)}
                      className="flex min-h-11 items-center gap-1 text-[13px] text-muted hover:text-ink"
                    >
                      <ChevronDownIcon className={showEvents ? "rotate-180" : ""} />
                      실행 기록 {view.events.length}건
                    </button>
                    {showEvents ? (
                      <ol className="mt-1 divide-y divide-line text-[13px]">
                        {view.events.map((event) => (
                          <li key={event.seq} className="grid grid-cols-[4.5rem_1fr] gap-2 py-2">
                            <span className="tabular-nums text-muted">{formatDateTime(event.at, "time")}</span>
                            <span>
                              <span className="font-semibold">{ACTOR_LABEL[event.actor] ?? "시스템"}</span> {eventSummary(event.summary, event.detail)}
                              <EventDetail event={event} streamName={streamName} />
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function StatusReason({ thread }: { thread: TalkThread }) {
  const { openEvidence } = useV3();
  return (
    <p className="mt-3 rounded-xl bg-ground px-3.5 py-2.5 text-sm text-ink-2">
      {thread.statusReason}{" "}
      {thread.reasonEvidence.length > 0 ? (
        <button
          type="button"
          className="font-semibold underline decoration-dotted underline-offset-4"
          onClick={() => openEvidence(thread.reasonEvidence, "이 대화 상태의 근거")}
        >
          근거 보기
        </button>
      ) : null}
    </p>
  );
}
