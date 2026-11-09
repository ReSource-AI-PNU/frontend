"use client";

import { startTransition, useActionState, useState } from "react";
import { changeMemberRole, removeMember } from "@/lib/server/member-actions";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { MEMBER_ROLES, type MemberRole } from "./roles";

export type MemberView = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: "active" | "invited";
  owner: boolean;
  isMe: boolean;
  invitedAt: string;
};

function CopyInviteLink({ memberId, email }: { memberId: string; email: string }) {
  const [message, setMessage] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={async () => {
          const url = `${window.location.origin}/signup?invite=${encodeURIComponent(memberId)}`;
          try {
            await navigator.clipboard.writeText(url);
            setFallbackUrl(null);
            setMessage("복사했습니다.");
          } catch {
            // 클립보드 권한이 없으면 링크를 보여 주고 직접 복사하게 한다
            setFallbackUrl(url);
            setMessage("자동 복사가 막혀 있습니다. 아래 링크를 직접 복사해 주세요.");
          }
        }}
        className={buttonClass("ghost", "sm", "underline underline-offset-4")}
        aria-label={`${email} 초대 링크 복사`}
      >
        초대 링크 복사
      </button>
      <span aria-live="polite" className="text-[12px] text-muted">
        {message}
      </span>
      {fallbackUrl ? (
        <input
          readOnly
          value={fallbackUrl}
          aria-label={`${email} 초대 링크`}
          onFocus={(e) => e.currentTarget.select()}
          className="num h-[34px] w-full min-w-0 rounded-md border border-line-strong bg-sunken px-2 text-[12px] text-ink"
        />
      ) : null}
    </span>
  );
}

export function MemberRow({ member, canManage }: { member: MemberView; canManage: boolean }) {
  const [role, setRole] = useState<MemberRole>(member.role);
  const [confirming, setConfirming] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRole, undefined);
  const [removeState, removeAction, removePending] = useActionState(removeMember, undefined);
  const editable = canManage && !member.owner;
  const message = removeState?.error ?? roleState?.error;
  const label = member.name || member.email;

  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="px-5 py-3.5 text-left font-semibold">
        <span className="flex flex-wrap items-center gap-2">
          {member.name || <span className="font-normal text-muted">가입 전</span>}
          {member.isMe ? <span className="text-[12px] font-normal text-muted">(나)</span> : null}
          {member.owner ? <Badge>소유자</Badge> : null}
        </span>
      </th>
      <td className="px-5 py-3.5 text-ink-2">
        <span className="break-all">{member.email || "—"}</span>
      </td>
      <td className="px-5 py-3.5">
        {editable ? (
          // form 대신 직접 호출한다. React 19는 폼 액션이 끝나면 폼을 초기화해 제어되는 select의 표시값이 첫 옵션으로 돌아가기 때문이다.
          <div className="flex items-center gap-2">
            <label htmlFor={`role-${member.id}`} className="sr-only">
              {label}의 역할
            </label>
            <select
              id={`role-${member.id}`}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="h-[34px] rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-ink focus:outline-none"
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {role !== member.role ? (
              <button
                type="button"
                disabled={rolePending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("memberId", member.id);
                  fd.set("role", role);
                  startTransition(() => roleAction(fd));
                }}
                className={buttonClass("secondary", "sm")}
              >
                {rolePending ? "바꾸는 중…" : "변경"}
              </button>
            ) : null}
          </div>
        ) : (
          <span>{member.role}</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        {member.status === "active" ? <Badge>활성</Badge> : <Badge tone="warn">초대됨</Badge>}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-end gap-1">
          {member.status === "invited" && canManage ? <CopyInviteLink memberId={member.id} email={member.email} /> : null}
          {editable && !member.isMe ? (
            confirming ? (
              <form action={removeAction} className="flex items-center gap-1">
                <input type="hidden" name="memberId" value={member.id} />
                <button
                  type="submit"
                  disabled={removePending}
                  className={buttonClass("ghost", "sm", "text-loss hover:bg-loss-bg")}
                  aria-label={`${label} 제거 확정`}
                >
                  {removePending ? "제거하는 중…" : "정말 제거"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
                  취소
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={buttonClass("ghost", "sm", "text-muted hover:text-loss")}
                aria-label={`${label} 제거`}
              >
                제거
              </button>
            )
          ) : null}
        </div>
        {message ? (
          <p role="alert" className="mt-1 text-right text-[13px] text-loss">
            {message}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
