import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { devLoginEnabled } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { safeRedirect } from "@/lib/auth/account";
import { readSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "회원가입" };

const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Forms({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  // 이미 로그인했으면 돌아갈 곳(없으면 찾기 화면)으로 보낸다
  const session = await readSession();
  if (session?.user?.id) {
    const target = safeRedirect(pick(sp.callbackUrl), "/app");
    redirect(/^\/(login|signup)(\/|\?|$)/.test(target) ? "/app" : target);
  }
  return (
    <AuthForms
      mode="signup"
      callbackUrl={pick(sp.callbackUrl)}
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
