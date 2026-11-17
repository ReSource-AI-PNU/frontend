import type { Metadata } from "next";
import { Suspense } from "react";
import { devLoginEnabled, entraConfigured } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "회원가입" };

const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Forms({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  return (
    <AuthForms
      mode="signup"
      callbackUrl={pick(sp.callbackUrl)}
      entraConfigured={entraConfigured}
      devLoginEnabled={devLoginEnabled}
    />
  );
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell title="회원가입" description="이메일로 가입하고 회사를 등록하면 바로 시작할 수 있습니다.">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Forms searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
