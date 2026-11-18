import { Suspense, type ReactNode } from "react";
import { Account } from "@/components/agent/account";
import { MembershipResync, MembershipWatch, OrgNoticeBanner } from "@/components/agent/membership-sync";
import { AgentShell } from "@/components/agent/shell";
import { PageSkeleton } from "@/components/ui/skeleton";
import { V3Provider } from "@/components/v3/context";
import { orgNoticeText } from "@/lib/auth/membership-sync";
import { readOrgNotice } from "@/lib/server/org-notice";
import { requireWorkspace } from "@/lib/server/workspace";

/**
 * 로그인과 회사 등록을 마친 사람만 본다. 지금 회사는 세션의 활성 회사이고, 화면에서 다른 회사를 고를 수 없다
 * (바꿀 때는 소속 회사 가운데서 서버 액션으로 세션을 고친다).
 * 소속은 그릴 때마다 백엔드에서 다시 읽는다. 보던 회사에서 빠졌으면 회사 화면 대신 세션부터 고친다(그대로 그리면 403을 받는다).
 */
async function Workspace({ children }: { children: ReactNode }) {
  const [{ user, memberships, active, stale, resync }, notice] = await Promise.all([requireWorkspace(), readOrgNotice()]);
  if (resync) return <MembershipResync />;
  const noticeText = notice ? orgNoticeText(notice, active.orgName) : null;
  return (
    <V3Provider
      key={active.orgId}
      org={{ id: active.orgId, name: active.orgName, role: active.kind }}
      memberships={memberships}
    >
      <MembershipWatch memberships={memberships} persist={stale} />
      <AgentShell
        account={<Account user={user} />}
        notice={noticeText ? <OrgNoticeBanner key={noticeText} text={noticeText} /> : null}
      >
        {children}
      </AgentShell>
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
