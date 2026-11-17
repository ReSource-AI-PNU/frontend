import { Suspense, type ReactNode } from "react";
import { Account } from "@/components/agent/account";
import { AgentShell } from "@/components/agent/shell";
import { PageSkeleton } from "@/components/ui/skeleton";
import { V3Provider } from "@/components/v3/context";
import { requireOrganization } from "@/lib/server/organization";

/** 로그인과 회사 등록을 마친 사람만 에이전트 화면을 본다. */
async function OrganizationGate({ children }: { children: ReactNode }) {
  await requireOrganization();
  return children;
}

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <V3Provider>
      <AgentShell
        account={
          <Suspense fallback={<span className="block h-12 rounded-lg bg-sunken" aria-hidden="true" />}>
            <Account />
          </Suspense>
        }
      >
        <Suspense fallback={<PageSkeleton />}>
          <OrganizationGate>{children}</OrganizationGate>
        </Suspense>
      </AgentShell>
    </V3Provider>
  );
}
