import type { Metadata } from "next";
import { devLoginEnabled, entraConfigured } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <AuthShell title="회원가입" description="가입하고 회사만 등록하면 바로 받아 줄 곳을 찾을 수 있습니다.">
      <AuthForms mode="signup" entraConfigured={entraConfigured} devLoginEnabled={devLoginEnabled} />
    </AuthShell>
  );
}
