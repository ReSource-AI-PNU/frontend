"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, TalkIcon } from "@/components/icons";
import { ClaimText } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { EventDetail } from "@/components/v3/event-detail";
import {
  MESSAGE_LABEL,
  THREAD_LABEL,
  formatClaim,
  formatDateTime,
  modelLabel,
  rejectionLabel,
} from "@/lib/v3/format";
import type { Claim, DiagnosisView, Thread, ThreadMessage } from "@/lib/v3/types";

const ACTOR_LABEL: Record<string, string> = {
  company_agent: "회사 측 에이전트",
  vendor_agent: "업체 측 에이전트",
  validator: "근거 검증기",
  tool: "판단 도구",
  system: "시스템",
};
const DOT: Record<Thread["status"], string> = {
  not_opened: "border border-line-strong",
  open: "bg-lane",
  agreed: "bg-brand",
  declined: "bg-loss",
  handoff: "bg-warn",
  confirmed: "bg-brand",
};

/** 미리보기 한 줄용. {{claimId}} 자리를 값으로 바꾼 글 */
function plain(text: string, claims: Claim[]) {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  return text
    .replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_, id: string) => formatClaim(byId.get(id)) ?? "확인 필요")
    .replace(/\s+/g, " ");
}

function Bubble({ message, mine, name }: { message: ThreadMessage; mine: boolean; name: string }) {
  const { validation } = message;
  const rejections = validation.rejections ?? [];
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[min(100%,640px)]">
        <p className={`mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted ${mine ? "" : "justify-end"}`}>
          <span className="font-semibold text-ink-2">{name} 측 에이전트</span>
          <span>{MESSAGE_LABEL[message.type] ?? message.type}</span>
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${mine ? "rounded-tl-md bg-sunken" : "rounded-tr-md bg-brand-bg"}`}
        >
          <ClaimText text={message.text} claims={message.claims} />
          {message.meta?.terms && message.meta.terms.days.length > 0 ? (
            <p className="mt-2 text-[13px] text-ink-2">수거 요일 {message.meta.terms.days.join("·")}</p>
          ) : null}
        </div>
        <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] ${mine ? "" : "justify-end"}`}>
          {validation.ok ? (
            <span className="flex items-center gap-1 text-brand">
              <CheckIcon className="size-3.5" />
              근거 확인 통과
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
 * 두 에이전트가 주고받은 대화. 평소에는 화면 맨 아래의 얇은 띠로 접혀 있고, 누르면 아래에서 올라온다.
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
  const last = opened
    .flatMap((item) => item.messages.map((message) => ({ message, item })))
    .sort((a, b) => a.message.createdAt.localeCompare(b.message.createdAt) || a.message.seq - b.message.seq)
    .at(-1);
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (view.threads.length === 0 && view.events.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-bg/92 backdrop-blur">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-expanded={open}
          className="mx-auto flex min-h-14 w-full max-w-[760px] items-center gap-3 px-5 text-left"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-bg text-brand">
            <TalkIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              에이전트 대화
              <span className="ml-2 font-normal text-muted tabular-nums">
                {opened.length > 0 ? `업체 ${opened.length}곳 · 메시지 ${total}개` : "아직 주고받은 메시지가 없습니다"}
              </span>
            </span>
            {last ? (
              <span className="block truncate text-[13px] text-ink-2">
                {last.message.from === view.session.emitterOrgId ? emitterName : last.item.vendorName}:{" "}
                {plain(last.message.text, last.message.claims)}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon className="size-5 shrink-0 rotate-180 text-muted" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:left-[264px]">
          <button type="button" aria-label="대화 닫기" className="absolute inset-0 bg-ink/30" onClick={() => onOpenChange(false)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="에이전트 대화"
            className="absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-2xl border-t border-line bg-bg shadow-[0_-24px_60px_-24px_rgb(15_21_18/0.45)] [animation:rs-sheet_260ms_var(--ease-out)_both]"
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-3">
              <h2 className="text-[17px] font-bold tracking-[-0.02em]">에이전트 대화</h2>
              <p className="text-[13px] text-muted">숫자를 누르면 근거가 열립니다</p>
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
              <div role="tablist" aria-label="업체별 대화" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
                {opened.map((item) => {
                  const active = item.id === thread?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onThreadChange(item.id)}
                      className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap ${active ? "border-ink bg-ink font-semibold text-on-ink" : "border-line-strong text-ink-2 hover:border-ink"}`}
                    >
                      <span aria-hidden="true" className={`size-2 rounded-full ${DOT[item.status]}`} />
                      {item.vendorName}
                      <span className={active ? "text-on-ink/70" : "text-muted"}>{THREAD_LABEL[item.status]}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[820px] px-5 py-5">
                {thread ? (
                  <>
                    <p className="text-[13px] text-muted">
                      다룬 흐름 {thread.streamIds.map(streamName).join(", ") || "없음"} · {thread.turns}/{thread.maxTurns}번
                      주고받음 · 업체 측 답변 {modelLabel(thread.vendorModel)}
                    </p>
                    {thread.statusReason ? (
                      <p
                        className={`mt-3 rounded-lg px-3.5 py-2.5 text-sm ${thread.status === "declined" ? "bg-loss-bg text-loss" : "bg-warn-bg text-warn"}`}
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
                    <h3 className="text-[13px] font-semibold text-ink-2">대화를 열지 않은 곳</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                      {skipped.map((item) => (
                        <li key={item.id}>
                          <span className="font-semibold text-ink">{item.vendorName}</span> · {item.statusReason}
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
                    className="flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
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
