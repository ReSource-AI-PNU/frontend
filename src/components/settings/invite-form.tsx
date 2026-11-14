"use client";

import { useActionState, useId } from "react";
import { inviteMember } from "@/lib/server/member-actions";
import { CheckIcon } from "../icons";
import { buttonClass } from "../ui/button";
import { MEMBER_ROLES } from "./roles";

export const settingsInputClass =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-marker)_70%,transparent)] focus:outline-none aria-invalid:border-loss";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, undefined);
  const id = useId();
  const fe = state?.fieldErrors ?? {};
  const values = state?.values;

  return (
    <form action={action} noValidate className="grid gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-start">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm font-semibold">
            초대할 사람의 이메일
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="colleague@company.co.kr"
            defaultValue={values?.email}
            aria-invalid={Boolean(fe.email)}
            aria-describedby={fe.email ? `${id}-email-error` : undefined}
            className={settingsInputClass}
          />
          {fe.email ? (
            <p id={`${id}-email-error`} role="alert" className="text-[13px] text-loss">
              {fe.email}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-role`} className="text-sm font-semibold">
            역할
          </label>
          <select
            id={`${id}-role`}
            name="role"
            defaultValue={values?.role ?? "담당자"}
            aria-invalid={Boolean(fe.role)}
            className={settingsInputClass}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {fe.role ? (
            <p role="alert" className="text-[13px] text-loss">
              {fe.role}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <span aria-hidden="true" className="hidden text-sm sm:block">
            &nbsp;
          </span>
          <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
            {pending ? "초대하는 중…" : "초대하기"}
          </button>
        </div>
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-2.5 text-sm text-ink">
          {state.error}
        </p>
      ) : null}
      <p role="status" className="flex items-start gap-2 text-sm text-ink-2 empty:hidden [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
        {state?.ok ? (
          <>
            <CheckIcon />
            {state.ok}
          </>
        ) : null}
      </p>
    </form>
  );
}
