"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/lib/server/company-actions";
import { buttonClass } from "../ui/button";

const ymd = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 초대 링크 만들기(소유자). 만든 링크를 복사해 메신저나 메일로 전합니다. */
export function InviteLink() {
  const [state, action, pending] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState(false);
  const expires = state?.expiresAt ? new Date(state.expiresAt) : null;

  const copy = async () => {
    if (!state?.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surface p-5">
      <div>
        <p className="text-sm font-semibold">함께 일할 사람 초대</p>
        <p className="mt-1 text-[13px] text-muted">
          초대 링크를 만들어 메신저나 메일로 전해 주세요. 받은 사람이 가입하거나 로그인한 뒤 수락하면 이 회사의 구성원이 됩니다.
        </p>
      </div>
      {state?.link ? (
        <div className="grid gap-2">
          <div className="flex min-w-0 gap-2">
            <input
              readOnly
              value={state.link}
              aria-label="초대 링크"
              onFocus={(event) => event.target.select()}
              className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-ground px-3 text-[14px] tabular-nums"
            />
            <button type="button" onClick={copy} className={buttonClass("secondary", "md", "shrink-0")}>
              {copied ? "복사했습니다" : "복사"}
            </button>
          </div>
          {expires && !Number.isNaN(expires.getTime()) ? (
            <p className="text-[13px] text-muted">{ymd.format(expires)}까지 쓸 수 있습니다.</p>
          ) : null}
        </div>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-[13px] text-loss">
          {state.error}
        </p>
      ) : null}
      <form action={action}>
        <button type="submit" disabled={pending} className={buttonClass(state?.link ? "ghost" : "secondary", "md")}>
          {pending ? "만드는 중" : state?.link ? "새 링크 만들기" : "초대 링크 만들기"}
        </button>
      </form>
    </div>
  );
}
