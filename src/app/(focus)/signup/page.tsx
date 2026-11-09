import type { Metadata } from "next";
import { devLoginEnabled, entraConfigured } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <AuthShell title="회원가입" description="가입한 뒤 회사 정보와 산업단지를 등록하면 바로 판정을 시작할 수 있습니다.">
      <AuthForms mode="signup" entraConfigured={entraConfigured} devLoginEnabled={devLoginEnabled} />
    </AuthShell>
  );
}
