"use client";

import { useState } from "react";
import { FIELD_LABEL, MESSAGE_LABEL, THREAD_LABEL, modelLabel, rejectionLabel } from "@/lib/v3/format";
import type { Thread, ThreadMessage, ThreadStatus, VendorModel, ViewStream } from "@/lib/v3/types";
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

/**
 * 업체 측 에이전트가 실제로 무엇으로 답했는지와, 업체가 고른 모델 설정을 따로 보여 준다.
 * 규칙 정책으로 돌았으면 설정한 모델은 호출되지 않은 것이므로 모델 이름을 답한 쪽에 쓰지 않는다.
 */
function VendorModelNote({ model, hasMessages }: { model: VendorModel; hasMessages: boolean }) {
  const isRule = model.provider === "rule";
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <span
        className={`rounded-full border px-2.5 py-0.5 font-mono font-semibold ${isRule ? "border-warn bg-warn-bg text-warn" : "border-line-strong"}`}
      >
        {hasMessages ? "업체 측 답변" : "업체 측 에이전트"}: {modelLabel(model)}
      </span>
      {model.configured ? (
        <span className="text-muted">
          설정: <span className="font-mono">{modelLabel(model.configured)}</span>
          {isRule ? " (호출하지 않음)" : ""}
        </span>
      ) : null}
    </span>
  );
}

function ValidationNote({ message }: { message: ThreadMessage }) {
  const { validation } = message;
  const attempts = validation.attempts ?? 1;
  const rejections = validation.rejections ?? [];
  // 코드가 쓴 메시지는 정해 둔 문장이고 숫자와 claim이 없다. 모델의 초안이 아니므로 "다시 쓴 횟수"가 아니라 거부된 초안 수를 적는다
  const byCode = message.model?.provider === "code";
  return (
    <div className="mt-2 text-[12px]">
      <span className={`font-semibold ${validation.ok ? "text-ink" : "text-loss"}`}>
        {validation.ok ? "✓ 근거 확인 통과" : "✕ 근거 확인 실패"}
      </span>
      {byCode ? (
        <span className="text-muted"> · 정해 둔 문장이라 숫자와 인용이 없습니다</span>
      ) : attempts > 1 ? (
        <span className="text-muted"> · 다시 쓴 횟수 {attempts - 1}회</span>
      ) : null}
      {validation.recheckedBy ? <span className="text-muted"> · 받은 쪽에서 다시 검증</span> : null}
      {message.model ? <span className="text-muted"> · 작성: {modelLabel(message.model)}</span> : null}
      {rejections.length > 0 ? (
        <div className="mt-1 text-muted">
          <p>
            {byCode ? "이 메시지 앞에 거부된 초안" : "거부된 초안"} · 거부 기록에는 코드와 일반 설명만 남습니다(거부된 값은
            싣지 않습니다)
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {rejections.map((rejection, index) => (
              <li key={`${rejection.code}-${index}`}>
                {typeof rejection.attempt === "number" ? (
                  <span className="font-mono">{rejection.attempt}번째 초안 </span>
                ) : null}
                <span className="font-mono text-ink-2">{rejection.code}</span>{" "}
                {rejectionLabel(rejection.code, rejection.message)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** 에이전트 간 대화. 말풍선이 아니라 차례별 장부로 그린다(DESIGN.md 협상 장부 규칙). */
export function Timeline({
  threads,
  streams,
  emitterOrgId,
  emitterName,
  stage,
}: {
  threads: Thread[];
  streams: ViewStream[];
  emitterOrgId: string;
  emitterName: string;
  stage: number | null;
}) {
  const { openEvidence } = useV3();
  const [picked, setPicked] = useState<string | null>(null);
  // 처음에는 실제로 열린 대화를 먼저 보여 준다
  const thread =
    threads.find((item) => item.id === picked) ??
    threads.find((item) => item.status !== "not_opened") ??
    threads[0];

  if (!thread) {
    return <p className="p-5 text-sm text-muted">아직 열린 대화가 없습니다.</p>;
  }
  const messages = stage ? thread.messages.filter((item) => item.stage === stage) : thread.messages;
  const streamName = (id: string) => streams.find((item) => item.id === id)?.name ?? id;
  const names = (ids: string[]) => ids.map(streamName).join(", ");

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

      <div className="space-y-2 border-b border-line px-5 py-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={THREAD_TONE[thread.status]}>{THREAD_LABEL[thread.status]}</StatusChip>
          <VendorModelNote model={thread.vendorModel} hasMessages={thread.messages.length > 0} />
          <span className="ml-auto font-mono text-muted">
            {thread.turns}/{thread.maxTurns}턴
          </span>
        </div>
        <p className="text-ink-2">
          <span className="text-muted">다룬 흐름</span> {thread.streamIds.length > 0 ? names(thread.streamIds) : "없음"}
          {thread.assignedStreamIds.length > 0 ? (
            <>
              {" · "}
              <span className="text-muted">최적안 배정</span>{" "}
              <span className="font-semibold text-ink">{names(thread.assignedStreamIds)}</span>
            </>
          ) : thread.status !== "not_opened" ? (
            <>
              {" · "}
              <span className="text-muted">최적안에 배정된 흐름 없음</span>
            </>
          ) : null}
        </p>
      </div>

      {thread.statusReason ? (
        <div
          className={`border-b border-line px-5 py-3 text-sm ${thread.status === "declined" ? "bg-loss-bg text-loss" : thread.status === "handoff" ? "bg-warn-bg text-warn" : "bg-sunken"}`}
        >
          {thread.status === "declined" || thread.status === "handoff" ? (
            <span className="font-semibold">{THREAD_LABEL[thread.status]} 사유 · </span>
          ) : null}
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
          const meta = message.meta;
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
                  {message.model?.provider === "code" ? (
                    <span
                      className="rounded-sm border border-warn bg-warn-bg px-1.5 font-mono text-[12px] font-semibold text-warn"
                      title="모델이 아니라 코드가 정해 둔 문장으로 쓴 메시지입니다"
                    >
                      {modelLabel(message.model)}
                    </span>
                  ) : null}
                  <span className="font-mono text-muted">{NUM[message.stage - 1] ?? message.stage}</span>
                  {message.streamIds.length > 0 ? (
                    <span className="text-[12px] text-muted">{names(message.streamIds)}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed">
                  <ClaimText text={message.text} claims={message.claims} />
                </p>
                {meta && (meta.terms || meta.asks.length > 0 || meta.excluded.length > 0 || meta.reason) ? (
                  <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-[12px] text-ink-2">
                    {meta.terms && meta.terms.days.length > 0 ? (
                      <>
                        <dt className="text-muted">수거 요일</dt>
                        <dd>{meta.terms.days.join("·")}</dd>
                      </>
                    ) : null}
                    {meta.asks.length > 0 ? (
                      <>
                        <dt className="text-muted">물은 값</dt>
                        <dd>
                          {meta.asks
                            .map((ask) => `${streamName(ask.streamId)} ${FIELD_LABEL[ask.field] ?? ask.field}`)
                            .join(", ")}
                        </dd>
                      </>
                    ) : null}
                    {meta.excluded.length > 0 ? (
                      <>
                        <dt className="text-muted">{message.model?.provider === "code" ? "뺀 흐름" : "받지 않는 흐름"}</dt>
                        <dd>
                          {meta.excluded.map((item) => (
                            <span key={item.streamId} className="block">
                              {streamName(item.streamId)}
                              {item.reason ? <span className="text-muted"> · {item.reason}</span> : null}
                            </span>
                          ))}
                        </dd>
                      </>
                    ) : null}
                    {meta.reason ? (
                      <>
                        <dt className="text-muted">사유</dt>
                        <dd>{meta.reason}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
                <ValidationNote message={message} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
