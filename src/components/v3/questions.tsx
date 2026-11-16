"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Question, ViewStream } from "@/lib/v3/types";

/** 담당자에게 묻는 질문. 한 묶음에 최대 3개, 최대 2묶음이다. "모름"도 답이다. */
export function Questions({
  questions,
  streams,
  disabled,
  onAnswer,
}: {
  questions: Question[];
  streams: ViewStream[];
  disabled: boolean;
  onAnswer: (questionId: string, value: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = questions.filter((item) => !item.answered);
  if (open.length === 0) return null;
  const batch = Math.min(...open.map((item) => item.batch));
  const current = open.filter((item) => item.batch === batch);
  return (
    <section aria-label="담당자 확인 질문" className="border-b border-ink bg-warn-bg px-5 py-4">
      <p className="text-label text-warn">
        확인이 필요합니다 · 질문 묶음 {batch}/2 · {current.length}개
      </p>
      <ul className="mt-3 space-y-3">
        {current.map((question) => {
          const stream = streams.find((item) => item.id === question.streamId);
          const draft = drafts[question.id] ?? "";
          return (
            <li key={question.id}>
              <label htmlFor={`q-${question.id}`} className="text-sm font-semibold">
                {stream ? `[${stream.name}] ` : ""}
                {question.text}
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id={`q-${question.id}`}
                  value={draft}
                  disabled={disabled}
                  onChange={(event) =>
                    setDrafts((before) => ({ ...before, [question.id]: event.target.value }))
                  }
                  className="min-h-[34px] min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm"
                  placeholder="답을 입력하세요"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || draft.trim() === ""}
                  onClick={() => onAnswer(question.id, draft.trim())}
                >
                  답하기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onAnswer(question.id, "unknown")}
                >
                  모름
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {disabled ? (
        <p className="mt-3 text-[13px] text-warn">예시 데이터에서는 답을 보낼 수 없습니다.</p>
      ) : null}
    </section>
  );
}
