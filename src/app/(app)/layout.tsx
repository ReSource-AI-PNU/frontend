import { localPlatformDemo } from "@/lib/platform/server";
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/site-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireOrganization } from "@/lib/server/organization";

/** 로그인과 온보딩을 모두 마친 사용자만 앱 화면을 본다. */
async function OrganizationGate({ children }: { children: ReactNode }) {
  if (!(process.env.PLATFORM_API_URL && await localPlatformDemo())) await requireOrganization();
  return children;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  if (process.env.PLATFORM_API_URL) return <Suspense fallback={<PageSkeleton />}><OrganizationGate>{children}</OrganizationGate></Suspense>;
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <OrganizationGate>{children}</OrganizationGate>
        </Suspense>
      </main>
    </>
  );
}
