"use client";

import { useState } from "react";
import { MESSAGE_LABEL, THREAD_LABEL } from "@/lib/v3/format";
import type { Thread, ThreadMessage, ThreadStatus } from "@/lib/v3/types";
import { ClaimText } from "./claim";
import { useV3 } from "./context";
import { StatusChip, type ChipTone } from "./status-chip";

const THREAD_TONE: Record<ThreadStatus, ChipTone> = {
  not_opened: "neutral",
  open: "neutral",
  agreed: "done",
  declined: "stop",
  handoff: "warn",
  confirmed: "done",
};
const NUM = ["①", "②", "③", "④", "⑤", "⑥"];

function ValidationNote({ message }: { message: ThreadMessage }) {
  const { validation } = message;
  const attempts = validation.attempts ?? 1;
  const rejections = validation.rejections ?? [];
  return (
    <div className="mt-2 text-[12px]">
      <span className={`font-semibold ${validation.ok ? "text-ink" : "text-loss"}`}>
        {validation.ok ? "✓ 근거 확인 통과" : "✕ 근거 확인 실패"}
      </span>
      {attempts > 1 ? <span className="text-muted"> · 다시 쓴 횟수 {attempts - 1}회</span> : null}
      {rejections.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-muted">
          {rejections.map((rejection, index) => (
            <li key={`${rejection.code}-${index}`}>
              <span className="font-mono">{rejection.code}</span> {rejection.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** 에이전트 간 대화. 말풍선이 아니라 차례별 장부로 그린다(DESIGN.md 협상 장부 규칙). */
export function Timeline({
  threads,
  emitterOrgId,
  emitterName,
  stage,
}: {
  threads: Thread[];
  emitterOrgId: string;
  emitterName: string;
  stage: number | null;
}) {
  const { openEvidence } = useV3();
  const [picked, setPicked] = useState<string | null>(null);
  const thread = threads.find((item) => item.id === picked) ?? threads[0];

  if (!thread) {
    return <p className="p-5 text-sm text-muted">아직 열린 대화가 없습니다.</p>;
  }
  const messages = stage ? thread.messages.filter((item) => item.stage === stage) : thread.messages;

  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" aria-label="업체별 대화" className="flex gap-1 overflow-x-auto border-b border-line px-3">
        {threads.map((item) => {
          const active = item.id === thread.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(item.id)}
              className={`shrink-0 px-3 py-3 text-sm whitespace-nowrap ${active ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:text-ink"}`}
            >
              {item.vendorName}
              <span className="ml-1.5 text-[12px] text-muted">{THREAD_LABEL[item.status]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-[13px]">
        <StatusChip tone={THREAD_TONE[thread.status]}>{THREAD_LABEL[thread.status]}</StatusChip>
        <span className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-[12px]">
          업체 측 모델 {thread.vendorModel.provider === "ollama" ? "Ollama" : "Foundry"} ·{" "}
          {thread.vendorModel.name}
        </span>
        <span className="ml-auto font-mono text-muted">
          {thread.turns}/{thread.maxTurns}턴
        </span>
      </div>

      {thread.statusReason ? (
        <div className="border-b border-line bg-sunken px-5 py-3 text-sm">
          {thread.statusReason}{" "}
          {thread.reasonEvidence.length > 0 ? (
            <button
              type="button"
              className="font-semibold underline decoration-dotted underline-offset-4"
              onClick={() => openEvidence(thread.reasonEvidence, "대화를 열지 않은 근거")}
            >
              근거 보기
            </button>
          ) : null}
        </div>
      ) : null}

      <ol className="divide-y divide-line">
        {messages.length === 0 ? (
          <li className="px-5 py-6 text-sm text-muted">
            {thread.messages.length === 0
              ? "주고받은 메시지가 없습니다."
              : "이 단계에 해당하는 메시지가 없습니다."}
          </li>
        ) : null}
        {messages.map((message) => {
          const fromEmitter = message.from === emitterOrgId;
          return (
            <li key={message.id} className="grid grid-cols-[2.25rem_1fr] gap-x-3 px-5 py-4">
              <span className="pt-0.5 font-mono text-[13px] text-muted">
                {String(message.seq).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <span aria-hidden="true" className="size-2 rounded-full bg-marker ring-1 ring-ink" />
                  <span className="font-semibold">
                    {fromEmitter ? emitterName : thread.vendorName} 측 에이전트
                  </span>
                  <span className="rounded-sm border border-line-strong px-1.5 font-semibold">
                    {MESSAGE_LABEL[message.type] ?? message.type}
                  </span>
                  <span className="font-mono text-muted">{NUM[message.stage - 1]}</span>
                  {message.streamIds.length > 0 ? (
                    <span className="font-mono text-[12px] text-muted">
                      {message.streamIds.join(", ")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed">
                  <ClaimText text={message.text} claims={message.claims} />
                </p>
                <ValidationNote message={message} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
