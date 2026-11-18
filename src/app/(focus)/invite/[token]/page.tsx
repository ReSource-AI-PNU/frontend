import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvite } from "@/components/onboarding/accept-invite";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KIND_LABEL, inviteExpiry, inviteLookupFailure, inviteTokenFrom, parseInviteInfo, type InviteInfo } from "@/lib/auth/account";
import { BackendError, callBackend } from "@/lib/server/backend";
import { getWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "회사 초대" };

type Lookup = { state: "ok"; info: InviteInfo } | { state: "invalid" } | { state: "unknown" };

/** 수락하기 전에 초대한 회사와 유효한지 읽는다(GET /invites/{token}, 프런트 서버에서만 부른다) */
async function lookUp(token: string): Promise<Lookup> {
  try {
    const info = parseInviteInfo(await callBackend(`/invites/${encodeURIComponent(token)}`));
    if (!info) return { state: "unknown" };
    return info.valid ? { state: "ok", info } : { state: "invalid" };
  } catch (error) {
    return error instanceof BackendError ? { state: inviteLookupFailure(error.status, error.code) } : { state: "unknown" };
  }
}

/** 쓸 수 없는 초대(만료, 이미 씀, 없는 링크). 수락 단추를 두지 않는다 */
function Invalid({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="grid gap-4">
      <div role="alert" className="rounded-lg border border-line bg-ground px-4 py-4">
        <p className="font-semibold">이 초대 링크는 쓸 수 없습니다</p>
        <p className="mt-1 text-sm text-ink-2">만료되었거나 이미 사용된 링크입니다. 초대한 분께 새 링크를 요청해 주세요.</p>
      </div>
      <ButtonLink href={signedIn ? "/app" : "/"} variant="secondary" className="w-full">
        {signedIn ? "내 화면으로" : "처음 화면으로"}
      </ButtonLink>
    </div>
  );
}

/** 초대한 회사와 유효 기한 */
function Inviter({ info, expiry }: { info: InviteInfo; expiry: string | null }) {
  return (
    <div className="rounded-lg border border-line px-4 py-4">
      <p className="text-[13px] text-muted">초대한 회사</p>
      <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em]">
        {info.orgName ?? "회사 이름 확인 필요"}
        {info.kind ? <span className="ml-2 text-[13px] font-normal text-muted">{KIND_LABEL[info.kind]}</span> : null}
      </p>
      {expiry ? <p className="mt-1 text-[13px] text-ink-2">이 링크는 {expiry} 쓸 수 있습니다.</p> : null}
    </div>
  );
}

/** 초대 링크로 들어온 곳. 초대한 회사와 유효한지 먼저 보이고, 로그인했으면 수락 단추, 아니면 로그인·가입을 거쳐 돌아오게 한다. */
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
  const [workspace, lookup] = await Promise.all([getWorkspace(), lookUp(token)]);
  const expiry = lookup.state === "ok" ? inviteExpiry(lookup.info.expiresAt, new Date()) : null;
  if (lookup.state === "invalid" || expiry?.expired) return <Invalid signedIn={Boolean(workspace)} />;
  const inviter = lookup.state === "ok" ? <Inviter info={lookup.info} expiry={expiry?.text ?? null} /> : null;
  const back = encodeURIComponent(`/invite/${token}`);
  if (!workspace) {
    return (
      <div className="grid gap-4">
        {inviter}
        <div className="grid gap-3">
          <ButtonLink href={`/signup?callbackUrl=${back}`} className="!min-h-12 w-full">
            가입하고 수락하기
          </ButtonLink>
          <ButtonLink href={`/login?callbackUrl=${back}`} variant="secondary" className="w-full">
            이미 계정이 있으면 로그인
          </ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {inviter}
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
    <AuthShell title="회사 초대" description="초대한 회사를 확인한 뒤 수락하면 그 회사의 구성원이 되어 함께 일할 수 있습니다.">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Invite params={params} />
      </Suspense>
    </AuthShell>
  );
}
