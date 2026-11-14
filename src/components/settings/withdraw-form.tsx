"use client";

import { useActionState, useId, useState } from "react";
import { withdrawAccount } from "@/lib/server/account-actions";
import { settingsInputClass } from "./invite-form";

/** 위험 행동 전용 버튼. 손실색으로 채우고, 조건을 채우기 전에는 비활성으로 둔다. */
const dangerButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-transparent bg-loss px-[18px] text-[15px] font-semibold text-on-ink transition-colors duration-150 ease-out hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted disabled:opacity-100";

export function WithdrawForm({ orgName }: { orgName: string }) {
  const [state, action, pending] = useActionState(withdrawAccount, undefined);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const id = useId();
  const nameMatches = typed.trim() === orgName;
  const ready = nameMatches && ack && !pending;

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-semibold">
          확인을 위해 회사명 <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-semibold text-ink select-all">{orgName}</span>을(를)
          그대로 입력해 주세요.
        </label>
        <input
          id={`${id}-name`}
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-name-help`}
          className={`${settingsInputClass} max-w-md`}
        />
        <p id={`${id}-name-help`} className="text-[13px] text-muted" aria-live="polite">
          {typed.length === 0 ? "띄어쓰기와 괄호까지 똑같이 입력해야 합니다." : nameMatches ? "회사명이 일치합니다." : "아직 회사명과 다릅니다."}
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="acknowledge"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-ink"
        />
        <span>위 삭제 대상을 확인했고, 지운 데이터는 되돌릴 수 없다는 점을 이해했습니다.</span>
      </label>
      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-2.5 text-sm text-ink">
          {state.error}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={!ready} className={dangerButton}>
          {pending ? "삭제하는 중…" : "회원 탈퇴하고 회사 데이터 모두 삭제"}
        </button>
      </div>
    </form>
  );
}
