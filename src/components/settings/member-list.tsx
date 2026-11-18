"use client";

import { useActionState, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { MEMBER_ROLE_LABEL } from "@/lib/auth/account";
import { leaveBlock } from "@/lib/auth/manage";
import { makeOwner, removeMember, type MemberActionState } from "@/lib/server/manage-actions";
import type { Member } from "@/lib/server/company-data";
import { ApprovalGate, FormNote } from "./form-parts";

type Pending = { kind: "remove" | "leave" | "owner"; userId: string } | null;
type Result = (NonNullable<MemberActionState> & { target?: string }) | undefined;

/**
 * 구성원 목록. 소유자는 구성원을 소유자로 정하거나 뺄 수 있고, 누구나 자기 자신은 회사에서 나갈 수 있다.
 * 되돌리기 어려운 행동이라 단추를 누르면 그 줄 아래에 확인 상자(승인 게이트)를 열고, 실행은 상자 안에서만 한다.
 * 백엔드가 아직 그 기능을 받지 않으면(unsupported) 단추를 숨긴다(canRemove·canGrant는 서버가 먼저 알려 준 값).
 */
export function MemberList({
  orgId,
  orgName,
  selfId,
  owner,
  members,
  canRemove,
  canGrant,
}: {
  orgId: string;
  orgName: string;
  selfId: string;
  owner: boolean;
  members: Member[];
  canRemove: boolean;
  canGrant: boolean;
}) {
  const [open, setOpen] = useState<Pending>(null);
  // 결과에 누구에게 한 일인지(target)를 붙여, 실패 이유를 그 사람의 확인 상자에만 적는다
  const [removeState, removeAction, removing] = useActionState(async (prev: Result, formData: FormData): Promise<Result> => {
    const result = await removeMember(prev, formData);
    if (result?.done) setOpen(null);
    return { ...result, target: String(formData.get("userId")) };
  }, undefined);
  const [ownerState, ownerAction, granting] = useActionState(async (prev: Result, formData: FormData): Promise<Result> => {
    const result = await makeOwner(prev, formData);
    if (result?.done) setOpen(null);
    return { ...result, target: String(formData.get("userId")) };
  }, undefined);
  const removeOn = canRemove && !removeState?.unsupported;
  const grantOn = canGrant && !ownerState?.unsupported;
  const block = leaveBlock(selfId, members);
  const busy = removing || granting;

  const toggle = (next: NonNullable<Pending>) =>
    setOpen((current) => (current && current.kind === next.kind && current.userId === next.userId ? null : next));

  return (
    <div className="grid gap-3">
      {removeState?.unsupported ? <FormNote tone="error">지금은 구성원을 빼거나 회사에서 나갈 수 없습니다. 잠시 후 다시 시도해 주세요.</FormNote> : null}
      {ownerState?.unsupported ? <FormNote tone="error">지금은 소유자를 정할 수 없습니다. 잠시 후 다시 시도해 주세요.</FormNote> : null}
      {removeState?.done === "remove" && !open ? <FormNote>구성원에서 뺐습니다.</FormNote> : null}
      {ownerState?.done === "owner" && !open ? <FormNote>소유자로 정했습니다.</FormNote> : null}

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {members.map((member) => {
          const self = member.userId === selfId;
          const canMakeOwner = owner && grantOn && !self && member.memberRole !== "owner";
          const canKick = owner && removeOn && !self;
          const canLeave = self && removeOn && block === null;
          const here = open?.userId === member.userId ? open : null;
          return (
            <li key={member.userId} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {member.name}
                    {self ? <span className="ml-2 text-[13px] font-normal text-muted">나</span> : null}
                  </span>
                  <span className="block truncate text-sm text-muted">{member.email}</span>
                </span>
                <span className="shrink-0 text-sm text-ink-2">{MEMBER_ROLE_LABEL[member.memberRole]}</span>
                {canMakeOwner || canKick || canLeave ? (
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {canMakeOwner ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={here?.kind === "owner"}
                        onClick={() => toggle({ kind: "owner", userId: member.userId })}
                      >
                        소유자로 정하기
                      </Button>
                    ) : null}
                    {canKick ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={here?.kind === "remove"}
                        onClick={() => toggle({ kind: "remove", userId: member.userId })}
                      >
                        빼기
                      </Button>
                    ) : null}
                    {canLeave ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={here?.kind === "leave"}
                        onClick={() => toggle({ kind: "leave", userId: member.userId })}
                      >
                        회사에서 나가기
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {self && removeOn && block ? (
                <p className="mt-1.5 text-[13px] text-muted">
                  {block === "last_owner"
                    ? "소유자가 나 혼자라 지금은 회사에서 나갈 수 없습니다. 다른 구성원을 먼저 소유자로 정해 주세요."
                    : "회사에 나 혼자라 나갈 수 없습니다. 함께 일할 사람을 초대해 소유자로 정한 뒤 나갈 수 있습니다."}
                </p>
              ) : null}

              {here?.kind === "owner" ? (
                <ApprovalGate
                  className="mt-3"
                  title={`${member.name}님을 ${orgName}의 소유자로 정합니다`}
                  items={[
                    "소유자는 회사 정보를 고치고, 구성원을 초대하거나 뺄 수 있습니다.",
                    "한 번 정하면 이 화면에서 구성원으로 되돌릴 수 없습니다.",
                  ]}
                >
                  <GateActions
                    action={ownerAction}
                    orgId={orgId}
                    userId={member.userId}
                    label="소유자로 정하기"
                    pendingLabel="정하는 중"
                    pending={granting}
                    disabled={busy}
                    error={ownerState?.target === member.userId ? ownerState.error : undefined}
                    onCancel={() => setOpen(null)}
                  />
                </ApprovalGate>
              ) : null}
              {here?.kind === "remove" ? (
                <ApprovalGate
                  className="mt-3"
                  title={`${member.name}님을 ${orgName}에서 뺍니다`}
                  items={[
                    `${member.name}님은 이 회사의 자료와 찾기 기록을 더는 볼 수 없습니다.`,
                    "다시 함께 일하려면 새 초대 링크를 보내야 합니다.",
                    `${member.name}님의 계정과 다른 회사 소속은 그대로입니다.`,
                  ]}
                >
                  <GateActions
                    action={removeAction}
                    orgId={orgId}
                    userId={member.userId}
                    label="빼기"
                    pendingLabel="빼는 중"
                    pending={removing}
                    disabled={busy}
                    error={removeState?.target === member.userId ? removeState.error : undefined}
                    onCancel={() => setOpen(null)}
                  />
                </ApprovalGate>
              ) : null}
              {here?.kind === "leave" ? (
                <ApprovalGate
                  className="mt-3"
                  title={`${orgName}에서 나갑니다`}
                  items={[
                    "이 회사의 자료와 찾기 기록을 더는 볼 수 없습니다.",
                    "다시 들어오려면 소유자에게 새 초대 링크를 받아야 합니다.",
                    "내 계정과 다른 회사 소속은 그대로입니다.",
                  ]}
                >
                  <GateActions
                    action={removeAction}
                    orgId={orgId}
                    userId={member.userId}
                    label="나가기"
                    pendingLabel="나가는 중"
                    pending={removing}
                    disabled={busy}
                    error={removeState?.target === member.userId ? removeState.error : undefined}
                    onCancel={() => setOpen(null)}
                  />
                </ApprovalGate>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 확인 상자 안의 실행(먹색)과 취소 단추. 실패하면 그 아래에 이유를 적는다. */
function GateActions({
  action,
  orgId,
  userId,
  label,
  pendingLabel,
  pending,
  disabled,
  error,
  onCancel,
}: {
  action: (formData: FormData) => void;
  orgId: string;
  userId: string;
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled: boolean;
  error?: string;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={disabled} className={buttonClass("primary")}>
          {pending ? pendingLabel : label}
        </button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          취소
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-loss">
          {error}
        </p>
      ) : null}
    </form>
  );
}
