"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { signInWithDevAccount, signInWithMicrosoft } from "@/lib/server/auth-actions";
import { InfoIcon } from "../icons";
import { buttonClass } from "../ui/button";

type Mode = "login" | "signup";

const ERROR_TEXT: Record<string, string> = {
  Configuration: "로그인 설정에 문제가 있습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.",
  AccessDenied: "이 계정으로는 들어갈 수 없습니다.",
  Verification: "인증 링크가 만료되었습니다. 다시 시도해 주세요.",
  CredentialsSignin: "이름과 이메일 형식을 확인해 주세요.",
};

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" width={18} height={18} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-marker)_70%,transparent)] focus:outline-none";

export function AuthForms({
  mode,
  callbackUrl,
  error,
  entraConfigured,
  devLoginEnabled,
}: {
  mode: Mode;
  callbackUrl?: string;
  error?: string;
  entraConfigured: boolean;
  devLoginEnabled: boolean;
}) {
  const [agreed, setAgreed] = useState(mode === "login");
  const [devState, devAction, devPending] = useActionState(signInWithDevAccount, undefined);
  const id = useId();
  const errorText = devState?.error ?? (error ? (ERROR_TEXT[error] ?? "로그인하지 못했습니다. 다시 시도해 주세요.") : null);
  const verb = mode === "signup" ? "가입" : "로그인";

  return (
    <div className="grid gap-6">
      {errorText ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
          {errorText}
        </p>
      ) : null}

      {mode === "signup" ? (
        <label className="flex items-start gap-3 rounded-md border border-line-strong bg-surface px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-[18px] accent-ink"
          />
          <span>
            <span className="font-semibold">(필수)</span> 서비스 이용약관과 개인정보 수집·이용에 동의합니다.
            <span className="block text-[13px] text-muted">
              수집 항목: 이름, 이메일, 회사명, 사업자등록번호, 사업장 위치. 탈퇴 시 지체 없이 파기합니다.
            </span>
          </span>
        </label>
      ) : null}

      <form action={signInWithMicrosoft}>
        <input type="hidden" name="mode" value={mode} />
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <button
          type="submit"
          disabled={!entraConfigured || !agreed}
          className={buttonClass("secondary", "md", "w-full")}
        >
          <MicrosoftLogo />
          Microsoft 계정으로 {verb}
        </button>
        {!entraConfigured ? (
          <p className="mt-2 text-[13px] text-muted">
            Entra External ID가 아직 연결되지 않았습니다. <code className="num text-[12px]">AUTH_MICROSOFT_ENTRA_ID_*</code>{" "}
            환경 변수를 설정하면 켜집니다.
          </p>
        ) : null}
      </form>

      {devLoginEnabled ? (
        <>
          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span className="h-px flex-1 bg-line" />
            또는 시연용 계정
            <span className="h-px flex-1 bg-line" />
          </div>
          <form action={devAction} className="grid gap-4">
            <input type="hidden" name="mode" value={mode} />
            {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-name`} className="text-sm font-semibold">
                이름
              </label>
              <input id={`${id}-name`} name="name" required maxLength={40} autoComplete="name" placeholder="김담당" className={inputClass} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-email`} className="text-sm font-semibold">
                업무용 이메일
              </label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="manager@company.co.kr"
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={devPending || !agreed} className={buttonClass("primary", "md", "w-full")}>
              {devPending ? `${verb} 중…` : `시연용 계정으로 ${verb}`}
            </button>
            <p className="flex items-start gap-2 text-[13px] text-muted [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <InfoIcon />
              비밀번호 없이 들어가는 개발·시연 전용 계정입니다. 운영 배포에서는 꺼집니다.
            </p>
          </form>
        </>
      ) : null}

      {!entraConfigured && !devLoginEnabled ? (
        <p className="rounded-md bg-warn-bg px-3.5 py-3 text-sm">
          사용할 수 있는 로그인 수단이 없습니다. <code className="num text-[12px]">.env.local</code>을 확인해 주세요.
        </p>
      ) : null}

      <p className="text-sm text-muted">
        {mode === "login" ? (
          <>
            처음이신가요?{" "}
            <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
              회원가입
            </Link>
          </>
        ) : (
          <>
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
              로그인
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
