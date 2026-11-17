"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/**
 * 외부에서 받은 callbackUrl은 경로와 쿼리만 남긴다. 호스트를 버리므로 다른 사이트로 보낼 수 없다 (오픈 리다이렉트 방지).
 * Auth.js는 절대 주소(http://host/path)로 넘기므로 절대·상대 둘 다 받는다.
 */
function safeRedirect(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    const url = new URL(value, "http://placeholder.invalid");
    const path = `${url.pathname}${url.search}`;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/") ? path : fallback;
  } catch {
    return fallback;
  }
}

export async function signInWithMicrosoft(formData: FormData) {
  const mode = formData.get("mode");
  const fallback = mode === "signup" ? "/onboarding" : "/v3";
  await signIn(
    "microsoft-entra-id",
    { redirectTo: safeRedirect(formData.get("callbackUrl"), fallback) },
    mode === "signup" ? { prompt: "create" } : undefined,
  );
}

export type DevSignInState = { error?: string } | undefined;

export async function signInWithDevAccount(_prev: DevSignInState, formData: FormData): Promise<DevSignInState> {
  const mode = formData.get("mode");
  const fallback = mode === "signup" ? "/onboarding" : "/v3";
  try {
    await signIn("dev", {
      name: formData.get("name"),
      email: formData.get("email"),
      redirectTo: safeRedirect(formData.get("callbackUrl"), fallback),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "이름과 이메일 형식을 확인해 주세요." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
