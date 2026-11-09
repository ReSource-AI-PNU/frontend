"use client";

import { useFormStatus } from "react-dom";
import type { Question } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

function SubmitButton({ answered }: { answered: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
      {pending ? "다시 검토하는 중…" : answered ? "답 바꾸고 다시 검토" : "답하고 다시 검토"}
    </button>
  );
}

/**
 * 규정 검토의 되묻기 상자. 형광펜 ? 아이콘은 AI가 정보 부족을 표시한 것이다.
 * 답은 사람이 한 것이므로 먹색으로 남긴다 (DESIGN.md 사람과 AI의 표시 구분).
 */
export function RegulationAsk({ question, action }: { question: Question; action: (formData: FormData) => Promise<void> }) {
  const answered = Boolean(question.answer);
  return (
    <form action={action} className="my-3 grid gap-3 rounded-md bg-sunken p-4" aria-labelledby={`ask-${question.id}`}>
      <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2">
        {answered ? (
          // 사람이 답한 질문은 먹색
          <span aria-hidden="true" className="mt-0.5 grid size-[18px] place-items-center rounded-full bg-ink text-on-ink">
            <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.3l2.3 2.2L9.5 3.5" />
            </svg>
          </span>
        ) : (
          <span aria-hidden="true" className="num mt-0.5 grid size-[18px] place-items-center rounded-full bg-marker text-[11px] font-bold text-marker-ink">
            ?
          </span>
        )}
        <div>
          <p id={`ask-${question.id}`} className="text-sm font-semibold">
            {question.text}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">{question.why}</p>
        </div>
      </div>

      <fieldset className="ml-[30px]">
        <legend className="sr-only">{question.text}</legend>
        <div className="inline-flex rounded-md bg-bg p-[3px] shadow-[inset_0_0_0_1px_var(--color-line)]">
          {(question.options ?? []).map((opt) => (
            <label key={opt} className="relative">
              <input type="radio" name="answer" value={opt} required defaultChecked={question.answer === opt} className="peer sr-only" />
              <span className="flex min-h-[34px] cursor-pointer items-center rounded-sm px-4 text-sm text-muted peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-on-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:text-ink peer-checked:hover:text-on-ink">
                {opt}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-2">
          {answered ? (
            <>
              담당자 답변 <b className="font-semibold text-ink">{question.answer}</b>을(를) 반영해 결론을 다시 계산했습니다. 분석표를 새로 받으면 답을
              바꿔 주세요.
            </>
          ) : (
            "답하면 순환자원 인정 신청과 유해물질 기준 항목을 다시 검토하고, 결론이 바뀔 수 있습니다."
          )}
        </p>
      </fieldset>

      <div className="ml-[30px]">
        <SubmitButton answered={answered} />
      </div>
    </form>
  );
}
