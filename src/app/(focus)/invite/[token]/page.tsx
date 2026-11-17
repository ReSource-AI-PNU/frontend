import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvite } from "@/components/onboarding/accept-invite";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { inviteTokenFrom } from "@/lib/auth/account";
import { getWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "회사 초대" };

/** 초대 링크로 들어온 곳. 로그인했으면 수락 단추, 아니면 로그인·가입을 거쳐 이 화면으로 돌아오게 한다. */
async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  // Next.js가 이미 한 번 풀어 준 값이다. 다시 풀지 않는다
  const { token: raw } = await params;
  const token = inviteTokenFrom(raw);
  if (!token) {
    return (
      <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
        초대 링크가 올바르지 않습니다. 초대한 분께 링크를 다시 요청해 주세요.
      </p>
    );
  }
  const workspace = await getWorkspace();
  const back = encodeURIComponent(`/invite/${token}`);
  if (!workspace) {
    return (
      <div className="grid gap-3">
        <ButtonLink href={`/signup?callbackUrl=${back}`} className="!min-h-12 w-full">
          가입하고 수락하기
        </ButtonLink>
        <ButtonLink href={`/login?callbackUrl=${back}`} variant="secondary" className="w-full">
          이미 계정이 있으면 로그인
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">{workspace.user.name}</span>
        {workspace.user.email ? ` (${workspace.user.email})` : ""} 계정으로 수락합니다.
      </p>
      <AcceptInvite token={token} />
    </div>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <AuthShell title="회사에 초대받았습니다" description="수락하면 그 회사의 멤버가 되어 함께 일할 수 있습니다.">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Invite params={params} />
      </Suspense>
    </AuthShell>
  );
}
