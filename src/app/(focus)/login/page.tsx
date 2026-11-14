import type { Metadata } from "next";
import { Suspense } from "react";
import { devLoginEnabled, entraConfigured } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "로그인" };

async function Forms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <AuthForms
      mode="login"
      callbackUrl={pick(sp.callbackUrl)}
      error={pick(sp.error)}
      entraConfigured={entraConfigured}
      devLoginEnabled={devLoginEnabled}
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="로그인" description="회사 계정으로 들어와 판정 이력과 묶음 수거 제안을 이어서 확인합니다.">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Forms searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
