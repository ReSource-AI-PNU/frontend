"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { LOGIN_MESSAGE, safeRedirect, signupMessage, type LoginFailure } from "@/lib/auth/account";
import { BackendError, callBackend } from "./backend";

export type AuthFormState = { error?: string; values?: { name?: string; email?: string } } | undefined;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function loginMessage(error: AuthError): string {
  const code = error instanceof CredentialsSignin ? error.code : null;
  return code && code in LOGIN_MESSAGE ? LOGIN_MESSAGE[code as LoginFailure] : LOGIN_MESSAGE.unavailable;
}

/** 이메일·비밀번호 로그인. 성공하면 Auth.js가 돌아갈 주소로 보낸다(NEXT_REDIRECT는 그대로 던진다). */
export async function signInWithPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요.", values: { email } };
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirect(formData.get("callbackUrl"), "/app"),
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: loginMessage(error), values: { email } };
    throw error;
  }
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40, "이름은 40자까지 입력할 수 있습니다."),
  email: z.email("이메일 형식을 확인해 주세요.").max(254),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상으로 정해 주세요.")
    .max(200, "비밀번호가 너무 깁니다."),
});

/** 가입: 백엔드에 계정을 만들고 같은 이메일·비밀번호로 바로 로그인한다. 처음이면 회사 등록으로 간다. */
export async function signUpWithPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { name: text(formData, "name").trim(), email: text(formData, "email").trim() };
  if (formData.get("agree") !== "on") return { error: "이용약관과 개인정보 수집·이용에 동의해 주세요.", values };
  const password = text(formData, "password");
  if (password !== text(formData, "passwordConfirm")) return { error: "비밀번호 확인이 맞지 않습니다.", values };
  const parsed = signupSchema.safeParse({ ...values, password });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력한 내용을 확인해 주세요.", values };
  try {
    await callBackend("/accounts/signup", { method: "POST", body: parsed.data });
  } catch (error) {
    if (error instanceof BackendError) return { error: signupMessage(error.status, error.code), values };
    throw error;
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirect(formData.get("callbackUrl"), "/onboarding"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "가입은 끝났습니다. 로그인 화면에서 다시 로그인해 주세요.", values };
    }
    throw error;
  }
}

export async function signInWithMicrosoft(formData: FormData) {
  const mode = formData.get("mode");
  const fallback = mode === "signup" ? "/onboarding" : "/app";
  await signIn(
    "microsoft-entra-id",
    { redirectTo: safeRedirect(formData.get("callbackUrl"), fallback) },
    mode === "signup" ? { prompt: "create" } : undefined,
  );
}

/** 로컬 개발·E2E용(auth.ts의 devLoginEnabled). 운영(bff)에서는 provider가 없어 실패한다. */
export async function signInWithDevAccount(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    await signIn("dev", {
      name: formData.get("name"),
      email: formData.get("email"),
      redirectTo: safeRedirect(formData.get("callbackUrl"), "/app"),
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "이름과 이메일 형식을 확인해 주세요." };
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
