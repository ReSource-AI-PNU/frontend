"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Question, ViewStream } from "@/lib/v3/types";

const field =
  "min-h-[34px] min-w-0 rounded-md border border-line-strong bg-surface px-3 text-sm disabled:bg-sunken";

/** 담당자에게 묻는 질문. 한 묶음에 최대 3개, 최대 2묶음이다. "모름"도 답이다. */
export function Questions({
  questions,
  streams,
  canAct,
  busy,
  onAnswer,
}: {
  questions: Question[];
  streams: ViewStream[];
  /** 예시 데이터에서는 false */
  canAct: boolean;
  busy: boolean;
  onAnswer: (questionId: string, value: string | number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = questions.filter((item) => !item.answered);
  if (open.length === 0) return null;
  const batch = Math.min(...open.map((item) => item.batch));
  const current = open.filter((item) => item.batch === batch);
  const disabled = !canAct || busy;
  return (
    <section aria-label="담당자 확인 질문" className="border-b border-ink bg-warn-bg px-5 py-4">
      <p className="text-label text-warn">
        확인이 필요합니다 · 질문 묶음 {batch}/2 · 남은 질문 {current.length}개
      </p>
      <ul className="mt-3 space-y-3">
        {current.map((question) => {
          const stream = streams.find((item) => item.id === question.streamId);
          const draft = drafts[question.id] ?? "";
          const setDraft = (value: string) => setDrafts((before) => ({ ...before, [question.id]: value }));
          const parsed = question.answerType === "number" ? Number(draft) : draft.trim();
          const valid =
            draft.trim() !== "" && (question.answerType !== "number" || Number.isFinite(parsed as number));
          return (
            <li key={question.id}>
              <label htmlFor={`q-${question.id}`} className="text-sm font-semibold">
                {stream ? `[${stream.name}] ` : ""}
                {question.text}
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                    className={`${field} ${question.answerType === "number" ? "w-32 font-mono" : "flex-1"}`}
                    placeholder={question.answerType === "number" ? "숫자" : "답을 입력하세요"}
                  />
                )}
                {question.unit ? <span className="font-mono text-sm text-ink-2">{question.unit}</span> : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || !valid}
                  onClick={() => onAnswer(question.id, parsed)}
                >
                  답하기
                </Button>
                <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAnswer(question.id, "unknown")}>
                  모름
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[13px] text-warn">
        {canAct
          ? "\"모름\"도 답입니다. 모르는 값은 \"확인 필요\"로 남기고 진행하며 같은 질문을 다시 하지 않습니다."
          : "예시 데이터에서는 답을 보낼 수 없습니다."}
      </p>
    </section>
  );
}
