import { answerQuestion } from "@/lib/server/session-actions";
import type { Question } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

/**
 * 에이전트의 되묻기. 사진만으로 알 수 없는 정보를 묻고 왜 필요한지 함께 밝힌다.
 * 답하면 그 뒤 단계 결과가 다시 계산된다.
 */
export function QuestionCard({ sessionId, q }: { sessionId: string; q: Question }) {
  const action = answerQuestion.bind(null, sessionId, q.id);
  const answered = Boolean(q.answer);

  const form =
    q.kind === "number" ? (
      <form action={action} className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            name="answer"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={q.answer ?? q.suggested}
            aria-label={q.text}
            className="num h-10 w-36 rounded-md border border-line-strong bg-surface pr-14 pl-3 text-right text-[15px] focus:border-ink focus:outline-none"
          />
          {q.unit ? <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">{q.unit}</span> : null}
        </div>
        <button type="submit" className={buttonClass("secondary", "sm")}>
          {answered ? "바꾸기" : "답하기"}
        </button>
      </form>
    ) : (
      <form action={action} className="flex flex-wrap gap-2">
        {q.options?.map((o) => (
          <button
            key={o}
            type="submit"
            name="answer"
            value={o}
            aria-pressed={q.answer === o}
            className="h-9 rounded-full border border-line-strong px-3.5 text-[13px] hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
          >
            {o}
            {!q.answer && q.suggested === o ? <span className="ml-1 text-muted">(추정)</span> : null}
          </button>
        ))}
      </form>
    );

  return (
    <div data-answered={answered || undefined} className="grid gap-2.5 border-b border-line py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{q.text}</p>
          <p className="text-[13px] text-muted">{q.why}</p>
        </div>
        {answered ? (
          <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-semibold">
            답변 <span className="font-normal">{q.answer}{q.kind === "number" && q.unit ? ` ${q.unit}` : ""}</span>
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-marker px-2.5 py-1 text-[12px] font-semibold text-marker-ink">답 필요</span>
        )}
      </div>
      {form}
    </div>
  );
}
