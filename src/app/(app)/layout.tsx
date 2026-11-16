import { Suspense, type ReactNode } from "react";
import { MockNote } from "@/components/mock-note";
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
      <Suspense fallback={null}>
        <MockNote />
      </Suspense>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <OrganizationGate>{children}</OrganizationGate>
        </Suspense>
      </main>
    </>
  );
}
