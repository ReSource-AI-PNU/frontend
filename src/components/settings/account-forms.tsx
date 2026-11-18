"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { PASSWORD_MIN } from "@/lib/auth/manage";
import {
  changePassword,
  deleteAccount,
  makeOwner,
  type MemberActionState,
  type TransferTarget,
} from "@/lib/server/manage-actions";
import { ApprovalGate, FieldError, FormNote, inputClass } from "./form-parts";

/** 비밀번호 바꾸기. 백엔드가 아직 받지 않으면(unsupported) 폼을 거두고 한 줄만 남긴다. */
export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const errors = state?.errors ?? {};
  if (state?.unsupported) return <FormNote tone="error">지금은 비밀번호를 바꿀 수 없습니다. 잠시 후 다시 시도해 주세요.</FormNote>;

  const field = (id: string, name: string, label: string, autoComplete: string, message?: string, hint?: string) => (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${inputClass} mt-2`}
      />
      {message ? (
        <FieldError id={`${id}-error`} message={message} />
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-line bg-surface p-5 sm:p-6" noValidate>
      {field("password-current", "currentPassword", "지금 쓰는 비밀번호", "current-password", errors.current)}
      {field("password-new", "newPassword", "새 비밀번호", "new-password", errors.next, `${PASSWORD_MIN}자 이상으로 정해 주세요.`)}
      {field("password-confirm", "newPasswordConfirm", "새 비밀번호 확인", "new-password", errors.confirm)}
      {state?.error ? <FormNote tone="error">{state.error}</FormNote> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "바꾸는 중" : "비밀번호 바꾸기"}
        </button>
        {state?.saved && !pending ? <FormNote>비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 씁니다.</FormNote> : null}
      </div>
    </form>
  );
}

/**
 * 계정 지우기. 지워지는 것과 남는 것을 먼저 보이고, 비밀번호와 확인 표시를 받은 뒤 확인 상자(승인 게이트) 안에서만 지운다.
 * 다른 구성원이 있는 회사의 유일한 소유자면(409 TRANSFER_OWNERSHIP_FIRST) 그 회사를 보이고 소유자를 넘기게 한다.
 * 지우면 서버 액션이 로그아웃하고 첫 화면으로 보낸다.
 */
export function DeleteAccount({
  email,
  companies,
  ownedCount,
  aloneOrgNames,
  canGrant,
}: {
  email: string | null;
  /** 속한 회사 수 */
  companies: number;
  /** 내가 소유자인 회사 수 */
  ownedCount: number;
  /** 구성원이 나 하나뿐이라 함께 지워지는 내 회사 이름 */
  aloneOrgNames: string[];
  /** 소유자 정하기를 백엔드가 받는지 */
  canGrant: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const errors = state?.errors ?? {};

  if (state?.unsupported) return <FormNote tone="error">{state.error}</FormNote>;

  return (
    <div className="grid gap-4">
      {/* ── 계정 지우기의 범위 ──
          백엔드 docs/v3/CONTRACT.md 9장 "탈퇴"와 개인정보처리방침(/privacy)의 "파기 절차"와 같은 사실이다. 바꾸면 함께 고친다. */}
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-5 text-sm sm:p-6">
        <div>
          <p className="font-semibold">바로 지워지는 것</p>
          <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-ink-2 marker:text-muted">
            <li>이름, 이메일, 비밀번호(암호화 값)</li>
            <li>회사 소속 정보: 속한 회사 {companies}곳에서 모두 빠집니다</li>
            <li>
              혼자 관리하던 회사에 다른 구성원이 없으면 그 회사의 폐기물 정보, 진단과 대화 기록, 회사만 볼 수 있던 자료도 함께 지워지고 회사
              이름·사업자등록번호·주소는 남지 않습니다
              {aloneOrgNames.length > 0 ? <> (지금은 {aloneOrgNames.join(", ")})</> : null}
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">남는 것</p>
          <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-ink-2 marker:text-muted">
            <li>다른 사람과 함께 쓰는 회사와 그 자료는 그대로 남고, 나만 빠집니다.</li>
            <li>
              거래 상대 회사에 이미 전달된 메시지와 자료(보낸 조건, 허가증·매입 기준, 확정된 거래에 쓰인 업체 조건)는 상대 회사의 기록이라
              남습니다.
            </li>
          </ul>
        </div>
        {ownedCount > 0 ? (
          <p className="text-ink-2">
            다른 구성원이 있는 회사의 소유자가 나 혼자면, 먼저 그 회사의 다른 구성원을 소유자로 정해야 지울 수 있습니다. 그 회사가 들어간
            찾기가 진행 중이면 끝난 뒤에 지울 수 있습니다.
          </p>
        ) : null}
      </div>

      {!open ? (
        <div>
          <Button variant="secondary" onClick={() => setOpen(true)} aria-expanded={false}>
            계정 지우기
          </Button>
        </div>
      ) : (
        <>
          {state?.transfer ? <TransferOwnership targets={state.transfer} canGrant={canGrant} /> : null}
          <form action={action} noValidate>
            <ApprovalGate
              title="계정을 지웁니다"
              items={[
                <>
                  지울 계정: <span className="font-medium text-ink">{email ?? "이 계정"}</span>
                </>,
                `속한 회사 ${companies}곳에서 빠지고, 이 계정으로는 다시 로그인할 수 없습니다.`,
                ...(aloneOrgNames.length > 0
                  ? [`${aloneOrgNames.join(", ")}의 폐기물 정보, 진단과 대화 기록, 회사만 볼 수 있던 자료가 함께 지워집니다.`]
                  : []),
                "지운 계정은 되돌릴 수 없습니다. 같은 이메일로 다시 가입하면 새 계정이 됩니다.",
              ]}
            >
              <div>
                <label htmlFor="delete-password" className="text-sm font-medium">
                  비밀번호
                </label>
                <input
                  id="delete-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "delete-password-error" : undefined}
                  className={`${inputClass} mt-2`}
                />
                <FieldError id="delete-password-error" message={errors.password} />
              </div>
              <div>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm">
                  <input
                    type="checkbox"
                    name="agree"
                    aria-invalid={errors.agree ? true : undefined}
                    aria-describedby={errors.agree ? "delete-agree-error" : undefined}
                    className="mt-0.5 size-5 shrink-0 accent-ink"
                  />
                  <span>지워지는 것과 남는 것을 확인했습니다.</span>
                </label>
                <FieldError id="delete-agree-error" message={errors.agree} />
              </div>
              {state?.error ? <FormNote tone="error">{state.error}</FormNote> : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={buttonClass("primary")}>
                  {pending ? "지우는 중" : "계정 지우기"}
                </button>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  취소
                </Button>
              </div>
            </ApprovalGate>
          </form>
        </>
      )}
    </div>
  );
}

/** 409 TRANSFER_OWNERSHIP_FIRST: 소유자가 나 혼자인 회사마다 다른 구성원을 소유자로 정하게 한다. */
function TransferOwnership({ targets, canGrant }: { targets: TransferTarget[]; canGrant: boolean }) {
  return (
    <div role="alert" className="grid gap-4 rounded-lg bg-warn-bg p-5 text-sm">
      <div>
        <p className="font-semibold text-warn">먼저 소유자를 넘겨 주세요</p>
        <p className="mt-1 text-ink-2">
          {targets.length > 0
            ? "아래 회사는 다른 구성원이 있는데 소유자가 나 혼자입니다. 다른 구성원을 소유자로 정한 뒤 다시 지워 주세요."
            : "다른 구성원이 있는데 소유자가 나 혼자인 회사가 있습니다. 그 회사의 구성원 화면에서 다른 구성원을 소유자로 정한 뒤 다시 지워 주세요."}
        </p>
      </div>
      {targets.length > 0 ? (
        <ul className="grid gap-3">
          {targets.map((target) => (
            <li key={target.orgId} className="rounded-md bg-surface p-4">
              <TransferRow target={target} canGrant={canGrant} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TransferRow({ target, canGrant }: { target: TransferTarget; canGrant: boolean }) {
  const [state, action, pending] = useActionState(
    async (prev: (NonNullable<MemberActionState> & { name?: string }) | undefined, formData: FormData) => {
      const result = await makeOwner(prev, formData);
      const userId = formData.get("userId");
      return { ...result, name: target.candidates?.find((item) => item.userId === userId)?.name };
    },
    undefined,
  );
  const candidates = target.candidates ?? [];
  const selectId = `transfer-${target.orgId}`;

  if (state?.done === "owner") {
    return (
      <p role="status">
        <span className="font-medium">{target.orgName}</span>: {state.name ?? "고른 구성원"}님을 소유자로 정했습니다. 이제 계정을 지울 수
        있습니다.
      </p>
    );
  }
  if (!canGrant || state?.unsupported || target.candidates === null || candidates.length === 0) {
    return (
      <p>
        <span className="font-medium">{target.orgName}</span>: 이 회사로 바꿔{" "}
        <Link href="/settings/members" className="font-medium underline underline-offset-4">
          구성원 화면
        </Link>
        에서 다른 구성원을 소유자로 정해 주세요. 회사는 왼쪽 아래 회사 이름에서 바꿉니다.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="orgId" value={target.orgId} />
      <label htmlFor={selectId} className="font-medium">
        {target.orgName}의 새 소유자
      </label>
      <div className="flex flex-wrap gap-2">
        <select id={selectId} name="userId" className={`${inputClass} !min-h-11 max-w-sm flex-1`}>
          {candidates.map((item) => (
            <option key={item.userId} value={item.userId}>
              {item.name}
              {item.email ? ` (${item.email})` : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={buttonClass("secondary", "md", "shrink-0")}>
          {pending ? "정하는 중" : "소유자로 정하기"}
        </button>
      </div>
      {state?.error ? (
        <p role="alert" className="text-[13px] text-loss">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
