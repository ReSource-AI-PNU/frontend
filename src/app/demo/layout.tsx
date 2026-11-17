import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AgentShell } from "@/components/agent/shell";
import { BrandLink } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { V3Provider } from "@/components/v3/context";
import { demoCompany } from "@/lib/server/demo";

export const metadata: Metadata = { title: { default: "체험하기", template: "%s · 체험하기 · Re:Source AI" } };

/** 체험 화면을 열 수 없을 때(서버에 닿지 못함). 가입과 로그인은 그대로 할 수 있다. */
function Unavailable() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex h-15 items-center px-5">
        <BrandLink href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 text-center">
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.03em]">지금은 체험 화면을 열 수 없습니다</h1>
        <p className="mt-2 max-w-[440px] text-[15px] text-ink-2">잠시 후 다시 시도해 주세요. 가입과 로그인은 지금도 할 수 있습니다.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <ButtonLink href="/demo" variant="secondary">
            다시 시도
          </ButtonLink>
          <ButtonLink href="/signup">가입하기</ButtonLink>
        </div>
        <Link href="/" className="mt-6 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          처음 화면으로
        </Link>
      </main>
    </div>
  );
}

/**
 * 체험하기: 로그인 없이 시연 회사 한 곳(GET /demo/orgs의 배출 기업)을 읽기 전용으로 둘러본다.
 * 화면은 로그인한 화면과 같은 부품을 쓰고, 통로는 /api/v3-demo(GET만)를 부른다.
 */
async function DemoWorkspace({ children }: { children: ReactNode }) {
  // 요청마다 서버에 묻는다(빌드할 때 정해 두지 않는다)
  await connection();
  const company = await demoCompany();
  if (!company) return <Unavailable />;
  return (
    <V3Provider demo org={{ id: company.id, name: company.name, role: company.kind }}>
      <AgentShell>{children}</AgentShell>
    </V3Provider>
  );
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DemoWorkspace>{children}</DemoWorkspace>
    </Suspense>
  );
}
