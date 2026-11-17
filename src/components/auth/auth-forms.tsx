"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { LOGIN_MESSAGE, type LoginFailure } from "@/lib/auth/account";
import { signInWithDevAccount, signInWithPassword, signUpWithPassword } from "@/lib/server/auth-actions";
import { ArrowRightIcon } from "../icons";
import { buttonClass } from "../ui/button";

type Mode = "login" | "signup";

/** Auth.js가 로그인 화면으로 돌려보낼 때 붙이는 ?error= 값 */
const ERROR_TEXT: Record<string, string> = {
  Configuration: "지금은 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  AccessDenied: "이 계정으로는 들어갈 수 없습니다.",
  Verification: "인증 링크가 만료되었습니다. 다시 시도해 주세요.",
};

function errorFromUrl(error?: string, code?: string): string | null {
  if (!error) return null;
  if (error === "CredentialsSignin") return LOGIN_MESSAGE[(code ?? "invalid") as LoginFailure] ?? LOGIN_MESSAGE.invalid;
  return ERROR_TEXT[error] ?? "로그인하지 못했습니다. 다시 시도해 주세요.";
}

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-marker)_70%,transparent)] focus:outline-none";

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

/** 로그인·가입 화면 맨 아래. 가입 없이 시연 회사를 읽기 전용으로 둘러본다. */
export function TryDemo() {
  return (
    <Link
      href="/demo"
      className="group flex min-h-14 items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">체험하기</span>
        <span className="block text-[13px] text-muted">가입 없이 시연 회사 둘러보기</span>
      </span>
      <ArrowRightIcon className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function DevLogin({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(signInWithDevAccount, undefined);
  const id = useId();
  return (
    <details className="group rounded-md border border-dashed border-line-strong px-3.5 py-2 text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] text-muted [&::-webkit-details-marker]:hidden">
        개발용 빠른 로그인
      </summary>
      <form action={action} className="mt-2 grid gap-3 pb-2">
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <Field id={`${id}-name`} name="name" label="이름" required maxLength={40} autoComplete="name" />
        <Field id={`${id}-email`} name="email" label="업무용 이메일" type="email" required autoComplete="email" />
        {state?.error ? (
          <p role="alert" className="text-[13px] text-loss">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClass("secondary", "md", "w-full")}>
          {pending ? "들어가는 중" : "개발용 계정으로 들어가기"}
        </button>
      </form>
    </details>
  );
}

export function AuthForms({
  mode,
  callbackUrl,
  error,
  errorCode,
  devLoginEnabled,
}: {
  mode: Mode;
  callbackUrl?: string;
  error?: string;
  errorCode?: string;
  devLoginEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(mode === "signup" ? signUpWithPassword : signInWithPassword, undefined);
  const [agreed, setAgreed] = useState(false);
  const id = useId();
  const errorText = state?.error ?? errorFromUrl(error, errorCode);
  const verb = mode === "signup" ? "가입" : "로그인";
  const otherQuery = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4">
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        {errorText ? (
          <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
            {errorText}
          </p>
        ) : null}
        {mode === "signup" ? (
          <Field
            id={`${id}-name`}
            name="name"
            label="이름"
            required
            maxLength={40}
            autoComplete="name"
            placeholder="김담당"
            defaultValue={state?.values?.name ?? ""}
          />
        ) : null}
        <Field
          id={`${id}-email`}
          name="email"
          label="이메일"
          type="email"
          required
          autoComplete="email"
          placeholder="manager@company.co.kr"
          defaultValue={state?.values?.email ?? ""}
        />
        <Field
          id={`${id}-password`}
          name="password"
          label="비밀번호"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          hint={mode === "signup" ? "8자 이상으로 정해 주세요." : undefined}
        />
        {mode === "signup" ? (
          <>
            <Field
              id={`${id}-password-confirm`}
              name="passwordConfirm"
              label="비밀번호 확인"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <label className="flex items-start gap-3 rounded-md border border-line-strong bg-surface px-3.5 py-3 text-sm">
              <input
                type="checkbox"
                name="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-[18px] shrink-0 accent-ink"
              />
              <span className="min-w-0">
                <span className="font-semibold">(필수)</span>{" "}
                <Link href="/terms" className="font-semibold text-ink underline underline-offset-4">
                  서비스 이용약관
                </Link>
                과{" "}
                <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
                  개인정보 수집·이용
                </Link>
                에 동의합니다.
                <span className="block text-[13px] text-muted">
                  수집 항목: 이름, 이메일, 회사명, 사업자등록번호, 사업장 위치, 업로드한 사진·영상·문서, 접속 기록. 탈퇴하면 지체 없이
                  파기하며, 접속 기록은 법령에 따라 3개월 보관합니다.
                </span>
              </span>
            </label>
          </>
        ) : null}
        <button
          type="submit"
          disabled={pending || (mode === "signup" && !agreed)}
          className={buttonClass("primary", "md", "mt-1 w-full")}
        >
          {pending ? `${verb}하는 중` : mode === "signup" ? "가입하기" : "로그인"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {mode === "login" ? (
          <>
            처음이신가요?{" "}
            <Link href={`/signup${otherQuery}`} className="font-semibold text-ink underline underline-offset-4">
              회원가입
            </Link>
          </>
        ) : (
          <>
            이미 계정이 있으신가요?{" "}
            <Link href={`/login${otherQuery}`} className="font-semibold text-ink underline underline-offset-4">
              로그인
            </Link>
          </>
        )}
      </p>

      {devLoginEnabled ? <DevLogin callbackUrl={callbackUrl} /> : null}

      <div className="border-t border-line pt-6">
        <TryDemo />
        <p className="mt-3 text-[13px] text-muted">
          AI를 어떻게 시험했는지 궁금하다면{" "}
          <Link href="/trust" className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
            AI 신뢰도
          </Link>
          에서 공개 평가 결과를 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}
