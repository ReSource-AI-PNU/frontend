"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useEscape } from "@/components/use-escape";
import { ClaimText } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import type { useDiagnosis } from "@/components/v3/use-diagnosis";
import { josa } from "@/lib/josa";
import { MESSAGE_LABEL } from "@/lib/v3/format";
import { AI_NAME, REVIEWER_NAME } from "@/lib/v3/labels";
import { evidenceOf, threadLabel, typingText, withinVendorRange, type TalkThread, type Typing } from "@/lib/v3/live";
import type { DiagnosisView, ThreadMessage } from "@/lib/v3/types";
import { ReviewNote } from "./agent-talk";
import { Dots } from "./dots";

type Diagnosis = ReturnType<typeof useDiagnosis>;
type StageLike = { stage: number; label: string; status: string };

/**
 * 발표 화면(2026-11-19 멘토링 "발표할 때 AI 에이전트들이 대화하는 시뮬레이션 과정이 보이면 좋다").
 *
 * 끝난 찾기의 저장된 기록을 큰 화면에 처음부터 다시 재생한다. 실제로 일어난 일만 보인다: 작성 중 → 근거 확인 중 →
 * (돌려보냈으면) 다시 쓰는 중 → 보냄, 그리고 합의 뒤 계약 검토 담당의 검토. 지어낸 대사나 숫자는 없다.
 * 세 화자를 위치로 가른다: 회사 측 AI는 왼쪽 `sunken`, 업체 측 AI는 오른쪽 테두리, 계약 검토 담당은 가운데 `ground`.
 * 잠시 멈춤, 빠르기(보통 · 빠르게), 처음부터, 업체 고르기를 둔다. Esc나 닫기로 나간다.
 */
export function PresentMode({
  d,
  view,
  threads,
  stages,
  emitterName,
  caption,
  followId,
  onClose,
}: {
  d: Diagnosis;
  view: DiagnosisView;
  /** 화면에 그릴 대화(src/lib/v3/live.ts presentThreads) */
  threads: TalkThread[];
  stages: StageLike[];
  emitterName: string;
  /** 지금 일어나는 일 한 줄(없으면 단계 제목) */
  caption: string;
  /** 마지막으로 움직인 대화 */
  followId: string | null;
  onClose: () => void;
}) {
  const stream = d.stream;
  const replaying = stream.active && stream.target?.mode === "replay";
  const [picked, setPicked] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEscape(true, onClose);

  const opened = threads.filter((item) => item.messages.length > 0 || item.typing || item.review);
  const thread =
    opened.find((item) => item.id === picked) ?? (replaying ? opened.find((item) => item.id === followId) : undefined) ?? opened[0] ?? null;
  const stored = thread ? (view.approvals.find((item) => item.threadId === thread.id)?.review ?? null) : null;
  const review = thread ? (thread.review ?? (replaying ? null : stored)) : null;
  const typingKey = thread?.typing ? `${thread.typing.side}:${thread.typing.phase}` : "";
  const reviewed = Boolean(review);

  // 새 말풍선과 쓰는 중 표시가 보이게 아래로 내린다(움직임 줄이기면 바로)
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [thread?.id, thread?.messages.length, typingKey, reviewed]);

  const restart = () => {
    setPicked(null);
    stream.setPaused(false);
    d.replay();
  };
  const speedButton = (value: number, label: string) => (
    <button
      type="button"
      aria-pressed={stream.speed === value}
      onClick={() => stream.setSpeed(value)}
      className={`min-h-9 rounded-md px-3 text-[13px] ${stream.speed === value ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="발표 화면" className="fixed inset-0 z-40 flex flex-col bg-bg [animation:rs-rise_240ms_var(--ease-out)_both]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-6 py-3">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">AI끼리 조건을 맞추는 과정</p>
        <ol aria-label="진행 단계" className="flex flex-wrap gap-1.5">
          {stages.map((item) => (
            <li
              key={item.stage}
              className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-[12px] ${
                item.status === "running"
                  ? "bg-ink font-semibold text-on-ink"
                  : item.status === "needs_check"
                    ? "bg-warn-bg text-warn"
                    : item.status === "done"
                      ? "bg-sunken text-ink-2"
                      : "border border-line text-muted"
              }`}
            >
              {item.status === "done" ? <CheckIcon className="size-3" /> : null}
              {item.stage}. {item.label}
            </li>
          ))}
        </ol>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {replaying ? (
            <Button variant="secondary" size="sm" onClick={() => stream.setPaused(!stream.paused)}>
              {stream.paused ? "이어 보기" : "잠시 멈춤"}
            </Button>
          ) : null}
          <div role="group" aria-label="빠르기" className="flex rounded-md bg-sunken p-1">
            {speedButton(1, "보통")}
            {speedButton(2, "빠르게")}
          </div>
          <Button variant="ghost" size="sm" onClick={restart} disabled={!d.canReplay && !replaying}>
            처음부터
          </Button>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="발표 화면 닫기"
            className="grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 px-6 pt-5" aria-live="polite">
        {replaying && !stream.paused ? <Dots label="재생 중" /> : null}
        <p className="text-[22px] leading-snug font-semibold tracking-[-0.025em] text-balance">
          {stream.paused ? "잠시 멈췄습니다." : replaying ? caption : "대화를 모두 보여 드렸습니다. 양쪽 담당자가 승인하면 위탁 계약서 초안이 만들어집니다."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 pt-4 text-[13px]">
        <p className="text-left">
          <span className="block text-[15px] font-semibold">{AI_NAME.company}</span>
          <span className="text-muted">{josa(emitterName, "을/를")} 대변합니다</span>
        </p>
        <p className="text-center">
          <span className="block text-[15px] font-semibold">{REVIEWER_NAME}</span>
          <span className="text-muted">어느 편도 아니고, 승인 전에 규칙으로 다시 대조합니다</span>
        </p>
        <p className="text-right">
          <span className="block text-[15px] font-semibold">{AI_NAME.vendor}</span>
          <span className="text-muted">{josa(thread?.vendorName ?? "처리 업체", "을/를")} 대변합니다</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <ol className="mx-auto w-full max-w-[1100px] space-y-6">
          {thread
            ? thread.messages.map((message) => {
                const mine = message.author ? message.author.side === "company" : message.from === view.session.emitterOrgId;
                return <BigBubble key={message.id} message={message} mine={mine} fresh={replaying} />;
              })
            : null}
          {thread?.typing ? <BigTyping typing={thread.typing} left={thread.typing.side === "company"} /> : null}
          {review ? <ReviewNote review={review} fresh={replaying} className="mx-auto max-w-[760px]" /> : null}
          {!thread ? (
            <li className="flex items-center gap-2.5 text-[17px] text-ink-2">
              <Dots label="준비 중" />
              업체와 대화가 열리면 여기에 나타납니다.
            </li>
          ) : null}
        </ol>
        <div ref={endRef} />
      </div>

      {opened.length > 0 ? (
        <nav aria-label="업체별 대화" className="flex shrink-0 gap-5 overflow-x-auto border-t border-line px-6">
          {opened.map((item) => {
            const active = item.id === thread?.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setPicked(item.id)}
                className={`-mt-px flex min-h-12 shrink-0 items-center gap-1.5 border-t-2 text-[15px] whitespace-nowrap ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {item.vendorName}
                <span className="text-[13px] font-normal text-muted">
                  {threadLabel(item, { working: replaying, sessionStatus: view.session.status })}
                </span>
              </button>
            );
          })}
        </nav>
      ) : null}
      <p className="px-6 pb-3 text-[13px] text-muted">
        AI가 보내는 숫자와 조항은 모두 근거를 확인한 뒤에만 나갑니다. 숫자를 누르면 근거가 열립니다.
      </p>
    </div>
  );
}

function BigBubble({ message, mine, fresh }: { message: ThreadMessage; mine: boolean; fresh: boolean }) {
  const { openEvidence } = useV3();
  const evidence = evidenceOf(message);
  const rewritten = (message.validation.attempts ?? 1) > 1;
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"} ${fresh ? "[animation:rs-rise_320ms_var(--ease-out)_both]" : ""}`}>
      <div className="max-w-[72%]">
        <p className={`mb-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted ${mine ? "" : "justify-end"}`}>
          <span className="font-semibold text-ink-2">{message.author?.label ?? (mine ? AI_NAME.company : AI_NAME.vendor)}</span>
          <span>{MESSAGE_LABEL[message.type] ?? message.type}</span>
        </p>
        <div className={`rounded-2xl px-5 py-4 text-[19px] leading-relaxed ${mine ? "bg-sunken" : "border border-line bg-surface"}`}>
          <ClaimText text={message.text} claims={message.claims} />
        </div>
        <p className={`mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted ${mine ? "" : "justify-end"}`}>
          {!message.validation.ok ? (
            <span className="font-semibold text-loss">근거 확인 실패</span>
          ) : evidence.count > 0 ? (
            <button
              type="button"
              disabled={evidence.ids.length === 0}
              onClick={() => openEvidence(evidence.ids, "이 메시지의 근거")}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-3 text-ink-2 hover:border-ink hover:text-ink [&_svg]:size-3.5"
            >
              <CheckIcon />
              근거 {evidence.count}개 확인
            </button>
          ) : null}
          {withinVendorRange(message) ? <span>업체가 정한 범위 안에서 제안</span> : null}
          {message.validation.ok && rewritten ? <span>근거 확인에서 돌려보낸 뒤 다시 써서 보냄</span> : null}
        </p>
      </div>
    </li>
  );
}

function BigTyping({ typing, left }: { typing: Typing; left: boolean }) {
  const text = typingText(typing);
  return (
    <li className={`flex ${left ? "justify-start" : "justify-end"}`}>
      <div>
        <p className={`mb-1.5 text-[13px] font-semibold text-ink-2 ${left ? "" : "text-right"}`}>{typing.label}</p>
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-3 rounded-2xl px-5 py-4 text-[17px] text-ink-2 ${left ? "bg-sunken" : "border border-line bg-surface"}`}
        >
          <Dots label={text} />
          <span>{text}</span>
        </div>
      </div>
    </li>
  );
}
