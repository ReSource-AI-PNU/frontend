import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/site-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireOrganization } from "@/lib/server/organization";

/** 로그인과 온보딩을 모두 마친 사용자만 앱 화면을 본다. */
async function OrganizationGate({ children }: { children: ReactNode }) {
  await requireOrganization();
  return children;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <div role="note" className="border-b border-line bg-sunken px-4 py-3 text-sm font-semibold text-ink">
        시연 환경: 식별·규정·매칭·협상·학습과 실행 기록은 모의 결과이며 외부 발송은 모의 메일함에만 기록됩니다. 경제 미리보기는 가상 데이터로 계산합니다.
      </div>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <OrganizationGate>{children}</OrganizationGate>
        </Suspense>
      </main>
    </>
  );
}
