"use client";

import { useActionState, useEffect, useRef } from "react";
import type { WasteItem } from "@/lib/domain";
import { createKnowledgeCard } from "@/lib/server/session-actions";
import type { FlowStep } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none";

/**
 * 암묵지 수집. AI와 판단이 갈릴 때 "왜"를 묻고 조건 → 판단 → 근거 형태의 현장 지식 카드(제안됨)로 남긴다.
 * 카드는 /knowledge에서 동의를 모으고, 관리자가 채택하면 다음 판정의 근거로 인용된다.
 */
export function DisagreeDialog({
  step,
  item,
  sessionId,
  triggerLabel = "AI 판단과 다르신가요?",
  placeholder,
}: {
  step: FlowStep;
  item: WasteItem;
  sessionId?: string;
  triggerLabel?: string;
  placeholder?: { condition?: string; judgment?: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createKnowledgeCard, undefined);

  useEffect(() => {
    if (state && "ok" in state) {
      const t = setTimeout(() => ref.current?.close(), 1400);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="text-sm font-semibold underline underline-offset-4 hover:text-ink-2">
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`disagree-${step}`}
        className="m-auto w-[min(520px,calc(100%-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)] backdrop:bg-ink/40"
      >
        <form action={action} className="grid gap-4 p-6">
          <div>
            <p className="text-label text-muted">현장 지식 카드</p>
            <h2 id={`disagree-${step}`} className="mt-1 text-h2">
              현장에서는 어떻게 판단하시나요?
            </h2>
            <p className="mt-1 text-sm text-muted">
              남겨 주신 기준은 다른 담당자의 동의와 검토를 거쳐, 다음 판정에서 근거로 인용됩니다.
            </p>
          </div>
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="item" value={item} />
          {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">어떤 경우에</span>
            <input name="condition" required maxLength={120} placeholder={placeholder?.condition ?? "예: 비 온 다음 날 야외에 둔 베일"} className={inputClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">어떻게 판단하나요</span>
            <input name="judgment" required maxLength={120} placeholder={placeholder?.judgment ?? "예: 한 등급 낮춰 매입한다"} className={inputClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">근거</span>
            <textarea name="rationale" required maxLength={400} rows={3} placeholder="경험, 업체 정산 기록, 반송 사례 등" className={inputClass} />
          </label>
          {state && "error" in state ? (
            <p role="alert" className="text-sm text-loss">
              {state.error}
            </p>
          ) : null}
          {state && "ok" in state ? (
            <p role="status" className="rounded-md bg-gain-bg px-3 py-2 text-sm">
              카드로 남겼습니다. 현장 지식 목록에서 확인할 수 있습니다.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("ghost")}>
              닫기
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "남기는 중…" : "카드로 남기기"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
