import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { devLoginEnabled } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { safeRedirect } from "@/lib/auth/account";
import { readSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "로그인" };

const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Forms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  // 이미 로그인했으면 돌아갈 곳(없으면 찾기 화면)으로 보낸다
  const session = await readSession();
  if (session?.user?.id) {
    const target = safeRedirect(pick(sp.callbackUrl), "/app");
    redirect(/^\/(login|signup)(\/|\?|$)/.test(target) ? "/app" : target);
  }
  return (
    <AuthForms
      mode="login"
      callbackUrl={pick(sp.callbackUrl)}
      error={pick(sp.error)}
      errorCode={pick(sp.code)}
      devLoginEnabled={devLoginEnabled}
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="로그인" description="회사 계정으로 들어와 받아 줄 곳을 이어서 찾습니다.">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Forms searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
