import { Suspense, type ReactNode } from "react";
import { Account } from "@/components/agent/account";
import { AgentShell } from "@/components/agent/shell";
import { PageSkeleton } from "@/components/ui/skeleton";
import { V3Provider } from "@/components/v3/context";
import { requireWorkspace } from "@/lib/server/workspace";

/**
 * 로그인과 회사 등록을 마친 사람만 본다. 지금 회사는 세션의 활성 회사이고, 화면에서 다른 회사를 고를 수 없다
 * (바꿀 때는 소속 회사 가운데서 서버 액션으로 세션을 고친다).
 */
async function Workspace({ children }: { children: ReactNode }) {
  const { user, memberships, active } = await requireWorkspace();
  return (
    <V3Provider
      key={active.orgId}
      org={{ id: active.orgId, name: active.orgName, role: active.kind }}
      memberships={memberships}
    >
      <AgentShell account={<Account user={user} />}>{children}</AgentShell>
    </V3Provider>
  );
}

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
