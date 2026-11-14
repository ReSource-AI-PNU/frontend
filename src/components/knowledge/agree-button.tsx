"use client";

import { useOptimistic, useTransition } from "react";
import { toggleAgree } from "@/lib/server/session-actions";
import { CheckIcon } from "../icons";

/** 현장 지식 카드 동의. 누른 상태는 aria-pressed와 체크 표시로 함께 알린다(색만으로 구분하지 않는다). */
export function AgreeButton({ cardId, agreed, count }: { cardId: string; agreed: boolean; count: number }) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ agreed, count });

  return (
    <button
      type="button"
      aria-pressed={state.agreed}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic({ agreed: !state.agreed, count: state.count + (state.agreed ? -1 : 1) });
          await toggleAgree(cardId);
        })
      }
      className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors [&_svg]:size-3.5 ${
        state.agreed ? "border-ink bg-sunken text-ink" : "border-line-strong bg-surface text-ink hover:border-ink"
      }`}
    >
      {state.agreed ? <CheckIcon /> : null}
      {state.agreed ? "동의함" : "동의"}
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}
