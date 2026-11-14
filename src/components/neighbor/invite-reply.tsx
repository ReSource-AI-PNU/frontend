"use client";

import { startTransition, useActionState, useState } from "react";
import { respondBundleInvite } from "@/lib/server/session-actions";
import { buttonClass } from "../ui/button";

type ReplyState = { error?: string; ok?: true } | undefined;

/**
 * 묶음 참여 제안에 대한 회신(이웃 기업). 참여하면 그 기업 물량이 확정 물량에 더해지고,
 * 참여하지 않으면 이유를 받아 묶음을 다시 짤 때 쓴다. 이미 회신했으면 "회신 바꾸기"로 다시 고를 수 있다.
 */
export function InviteReply({ messageId, companyName, replied }: { messageId: string; companyName: string; replied: boolean }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(respondBundleInvite.bind(null, messageId), undefined);
  const [declining, setDeclining] = useState(false);
  const [open, setOpen] = useState(!replied);

  const submit = (decision: "accepted" | "declined", form: HTMLFormElement) => {
    const data = new FormData(form);
    data.set("decision", decision);
    startTransition(() => action(data));
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit text-[13px] font-semibold underline underline-offset-4 hover:text-ink-2">
        회신 바꾸기
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(declining ? "declined" : "accepted", e.currentTarget);
      }}
      className="grid gap-3"
    >
      {declining ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">참여하지 않는 이유</span>
          <textarea
            name="reason"
            rows={2}
            maxLength={200}
            required
            placeholder="예: 필름을 이미 다른 업체에 팔고 있다 / 화요일 오전에는 하역장이 막힌다"
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px] placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <span className="text-[12.5px] text-muted">이유는 제안한 기업에 그대로 보입니다. 묶음을 다시 짤 때 씁니다.</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {declining ? (
          <>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "보내는 중…" : "참여하지 않음으로 회신"}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className={buttonClass("ghost")}>
              취소
            </button>
          </>
        ) : (
          <>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "보내는 중…" : `${companyName}도 참여합니다`}
            </button>
            <button type="button" onClick={() => setDeclining(true)} className={buttonClass("secondary")}>
              참여하지 않습니다
            </button>
          </>
        )}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      <p className="text-[12.5px] text-muted">
        참여해도 계약은 수거 업체와 각 사업장이 따로 맺습니다. 회신은 제안한 기업의 화면에 바로 반영됩니다.
      </p>
    </form>
  );
}
