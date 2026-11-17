"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, TalkIcon } from "@/components/icons";
import { ClaimText } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { EventDetail } from "@/components/v3/event-detail";
import { josa } from "@/lib/josa";
import { evidenceOf, typingText, withinVendorRange, type TalkThread, type Typing } from "@/lib/v3/live";
import { MESSAGE_LABEL, THREAD_LABEL, formatDateTime } from "@/lib/v3/format";
import { eventSummary } from "@/lib/v3/labels";
import type { DiagnosisView, ThreadMessage } from "@/lib/v3/types";
import { Dots } from "./dots";

const ACTOR_LABEL: Record<string, string> = {
  company_agent: "회사 측 AI",
  vendor_agent: "업체 측 AI",
  validator: "근거 검증기",
  tool: "판단 도구",
  system: "시스템",
};

const chip =
  "inline-flex min-h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[12px] text-ink-2 [&_svg]:size-3.5";

/**
 * 말풍선 하나. 누가 썼는지는 백엔드가 준 작성자 표시(author.label: 회사 측 AI · 업체 측 AI · 자동 안내)로 적고,
 * 모델·구현 이름은 쓰지 않는다. 표시가 없는 예전 뷰는 보낸 쪽으로 정한다.
 * 아래에 "근거 n개 확인"(누르면 근거가 열린다)과, 업체 측 AI가 업체가 정한 범위 안에서 낸 조건이면 그 표시를 단다.
 */
function Bubble({ message, mine, name, fresh }: { message: ThreadMessage; mine: boolean; name: string; fresh: boolean }) {
  const { openEvidence } = useV3();
  const { validation } = message;
  const evidence = evidenceOf(message);
  const rewritten = (validation.attempts ?? 1) > 1;
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"} ${fresh ? "[animation:rs-rise_320ms_var(--ease-out)_both]" : ""}`}>
      <div className="max-w-[92%]">
        <p className={`mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted ${mine ? "" : "justify-end"}`}>
          <span className="font-medium text-ink-2">{message.author?.label ?? (mine ? "회사 측 AI" : "업체 측 AI")}</span>
          <span>{name}</span>
          <span>{MESSAGE_LABEL[message.type] ?? message.type}</span>
        </p>
        <div
          className={`rounded-[18px] px-4 py-3 text-[15px] leading-relaxed ${mine ? "bg-sunken" : "border border-line bg-surface"}`}
        >
          <ClaimText text={message.text} claims={message.claims} />
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
          className={`inline-flex items-center gap-2.5 rounded-[18px] px-4 py-3 text-[14px] text-ink-2 ${left ? "bg-sunken" : "border border-line bg-surface"}`}
        >
          <Dots label={text} />
          <span>{text}</span>
        </div>
      </div>
    </li>
  );
}

/** 대화마다 두 AI가 누구를 대변하는지 */
function Sides({ emitterName, vendorName }: { emitterName: string; vendorName: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-2.5 text-[12px] leading-snug">
      <p>
        <span className="block font-medium text-ink">회사 측 AI</span>
        <span className="block text-muted">{josa(emitterName, "을/를")} 대변합니다</span>
      </p>
      <p className="text-right">
        <span className="block font-medium text-ink">업체 측 AI</span>
        <span className="block text-muted">{josa(vendorName, "을/를")} 대변합니다</span>
      </p>
    </div>
  );
}

const TYPING_SHORT = { drafting: "작성 중", validating: "근거 확인 중", rewriting: "다시 쓰는 중" } as const;

function tabStatus(thread: TalkThread): string {
  if (thread.typing) return TYPING_SHORT[thread.typing.phase];
  return THREAD_LABEL[thread.status] ?? "";
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
  liveLine,
  freshIds,
  replay,
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
  /** 지금 일어나는 일 한 줄 */
  liveLine: string | null;
  /** 스트림으로 막 받은 메시지(들어올 때 살짝 떠오른다) */
  freshIds: Set<string>;
  replay: { can: boolean; active: boolean; start: () => void; skip: () => void };
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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // 실행 중에는 새 말풍선과 쓰는 중 표시가 보이게 아래로 내린다
  useEffect(() => {
    if (!open || !working) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [open, working, thread?.id, thread?.messages.length, typingKey]);

  if (total === 0 && !open && !working) return null;

  return (
    <>
      <div className="pointer-events-none sticky bottom-0 z-10 flex justify-center bg-gradient-to-t from-bg from-40% to-transparent px-5 pt-8 pb-5">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-expanded={open}
          className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface pr-4 pl-3.5 text-sm font-medium shadow-[0_6px_20px_-10px_rgb(0_0_0/0.3)] transition-colors hover:border-ink"
        >
          <TalkIcon className="text-muted" />
          {working ? "AI끼리 대화하는 중" : "AI끼리 나눈 대화 보기"}
          {working ? <Dots label="대화하는 중" /> : total > 0 ? <span className="text-muted tabular-nums">{total}</span> : null}
        </button>
      </div>

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
                className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
              >
                <CloseIcon />
              </button>
            </header>

            {working || replay.can ? (
              <div className="flex min-h-10 items-center gap-2 px-5 pb-2 text-[13px]">
                {working ? (
                  <>
                    <Dots label="진행 중" />
                    <span className="min-w-0 flex-1 truncate text-ink-2" aria-live="polite">
                      {liveLine ?? (replay.active ? "지난 대화를 다시 보여 드립니다." : "업체에 조건을 물어보고 있습니다.")}
                    </span>
                    {replay.active ? (
                      <button type="button" onClick={replay.skip} className="min-h-9 shrink-0 rounded-md px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
                        건너뛰기
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button type="button" onClick={replay.start} className="-ml-2 min-h-9 rounded-md px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
                    처음부터 다시 보기
                  </button>
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
                      <span className="text-[12px] font-normal text-muted">{tabStatus(item)}</span>
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
                    <Sides emitterName={emitterName} vendorName={thread.vendorName} />
                    {thread.statusReason ? <StatusReason thread={thread} /> : null}
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
                    </ol>
                    <div ref={endRef} />
                  </>
                ) : working ? (
                  <p className="flex items-center gap-2.5 text-sm text-ink-2">
                    <Dots label="준비 중" />
                    받을 수 있는 업체를 고르고 있습니다. 대화가 열리면 여기에 나타납니다.
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
                      className="flex min-h-10 items-center gap-1 text-[13px] text-muted hover:text-ink"
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
                              <span className="font-semibold">{ACTOR_LABEL[event.actor] ?? "시스템"}</span> {eventSummary(event.summary)}
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
