"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { acceptInvite } from "@/lib/server/company-actions";

/** 초대 수락 단추. 실패하면 이유를 한 줄로 적는다. */
export function AcceptInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "!min-h-12 w-full")}>
        {pending ? "수락하는 중" : "초대 수락하고 들어가기"}
      </button>
    </form>
  );
}
