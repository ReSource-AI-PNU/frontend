"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, TalkIcon } from "@/components/icons";
import { ClaimText } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { EventDetail } from "@/components/v3/event-detail";
import {
  MESSAGE_LABEL,
  THREAD_LABEL,
  formatDateTime,
  modelLabel,
  rejectionLabel,
} from "@/lib/v3/format";
import type { DiagnosisView, ThreadMessage } from "@/lib/v3/types";

const ACTOR_LABEL: Record<string, string> = {
  company_agent: "공장 쪽 AI",
  vendor_agent: "업체 쪽 AI",
  validator: "근거 검증기",
  tool: "판단 도구",
  system: "시스템",
};
function Bubble({ message, mine, name }: { message: ThreadMessage; mine: boolean; name: string }) {
  const { validation } = message;
  const rejections = validation.rejections ?? [];
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[92%]">
        <p className={`mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted ${mine ? "" : "justify-end"}`}>
          <span className="font-medium text-ink-2">{name} AI</span>
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
        <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] ${mine ? "" : "justify-end"}`}>
          {validation.ok ? (
            <span className="flex items-center gap-1 text-muted">
              <CheckIcon className="size-3.5" />
              근거 확인됨
            </span>
          ) : (
            <span className="font-semibold text-loss">근거 확인 실패</span>
          )}
          {(validation.attempts ?? 1) > 1 ? <span className="text-muted">· {(validation.attempts ?? 1) - 1}번 다시 씀</span> : null}
          {message.model ? <span className="text-muted">· {modelLabel(message.model)}</span> : null}
        </p>
        {rejections.length > 0 ? (
          <ul className={`mt-1 space-y-0.5 text-[12px] text-muted ${mine ? "" : "text-right"}`}>
            {rejections.map((rejection, index) => (
              <li key={`${rejection.code}-${index}`}>거부된 초안: {rejectionLabel(rejection.code, rejection.message)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * 두 에이전트가 주고받은 대화. 평소에는 화면 아래 가운데의 단추 하나로 접혀 있고, 누르면 오른쪽에서 패널이 열린다.
 * 숫자를 누르면 근거가 열린다.
 */
export function AgentTalk({
  view,
  emitterName,
  open,
  onOpenChange,
  threadId,
  onThreadChange,
}: {
  view: DiagnosisView;
  emitterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string | null;
  onThreadChange: (id: string) => void;
}) {
  const { openEvidence } = useV3();
  const [showEvents, setShowEvents] = useState(false);
  const opened = view.threads.filter((item) => item.messages.length > 0);
  const skipped = view.threads.filter((item) => item.messages.length === 0 && item.statusReason);
  const thread = opened.find((item) => item.id === threadId) ?? opened[0] ?? null;
  const total = opened.reduce((sum, item) => sum + item.messages.length, 0);
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (total === 0 && !open) return null;

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
          AI끼리 나눈 대화 보기
          {total > 0 ? <span className="text-muted tabular-nums">{total}</span> : null}
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
            <header className="flex items-center gap-3 px-5 pt-4 pb-2">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">AI끼리 나눈 대화</h2>
                <p className="text-[13px] text-muted">공장 쪽 AI와 업체 쪽 AI가 주고받은 그대로입니다. 숫자를 누르면 근거가 열립니다.</p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => onOpenChange(false)}
                aria-label="대화 닫기"
                className="ml-auto grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
              >
                <CloseIcon />
              </button>
            </header>

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
                      <span className="text-[12px] font-normal text-muted">{THREAD_LABEL[item.status]}</span>
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
                      {thread.streamIds.map(streamName).join(", ") || "다룬 폐기물 없음"} · {thread.turns}번 주고받음 · 업체 쪽 답변{" "}
                      {modelLabel(thread.vendorModel)}
                    </p>
                    {thread.statusReason ? (
                      <p
                        className="mt-3 rounded-xl bg-ground px-3.5 py-2.5 text-sm text-ink-2"
                      >
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
                    ) : null}
                    <ol className="mt-5 space-y-5">
                      {thread.messages.map((message) => {
                        const mine = message.from === view.session.emitterOrgId;
                        return (
                          <Bubble key={message.id} message={message} mine={mine} name={mine ? emitterName : thread.vendorName} />
                        );
                      })}
                    </ol>
                  </>
                ) : (
                  <p className="text-sm text-muted">아직 주고받은 메시지가 없습니다.</p>
                )}

                {skipped.length > 0 ? (
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
                            <span className="font-semibold">{ACTOR_LABEL[event.actor] ?? event.actor}</span> {event.summary}
                            <EventDetail event={event} streamName={streamName} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
