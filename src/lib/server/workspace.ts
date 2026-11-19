import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { freshAccount } from "@/auth";
import type { Membership } from "@/lib/auth/account";
import { checkMemberships } from "@/lib/auth/membership-sync";
import { readSession } from "./session";

export type Workspace = {
  user: { id: string; name: string; email: string | null };
  /** 소속 회사. 백엔드에서 방금 읽은 값이다(읽지 못하면 세션 쿠키의 값) */
  memberships: Membership[];
  /** 지금 보는 회사. 소속이 없으면 null. resync이면 세션 쿠키의 회사(이미 빠진 회사일 수 있다) */
  active: Membership | null;
  /**
   * 세션 쿠키의 소속이 백엔드와 다르다(다른 사람이 회사 이름을 바꿨거나 역할·소속이 바뀌었다). 화면은 백엔드 값으로 그렸으므로
   * 쿠키만 고치면 된다(src/components/agent/membership-sync.tsx).
   */
  stale: boolean;
  /**
   * 세션 쿠키의 회사로는 API를 부를 수 없다(그 회사에서 빠졌거나 쿠키에 회사가 없다). 화면을 그리기 전에 세션부터 고쳐야 한다.
   * 그대로 그리면 브라우저의 첫 요청들이 403 NOT_A_MEMBER를 받는다.
   */
  resync: boolean;
};

/**
 * 세션을 읽으므로 반드시 Suspense 경계 안에서 호출한다. 로그인하지 않았으면 null.
 * 소속은 그릴 때마다 백엔드(GET /accounts/me)에서 다시 읽는다. 세션 쿠키의 소속은 로그인하거나 세션을 고칠 때만 바뀌므로
 * 다른 사람이 회사 이름을 바꾸거나 나를 회사에서 빼도 쿠키에는 남아 있다. 한 요청 안(레이아웃과 화면)에서는 한 번만 읽는다.
 */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const session = await readSession();
  if (!session?.user?.id) return null;
  const saved = session.memberships ?? [];
  const activeOrgId = session.activeOrgId ?? null;
  const fresh = await freshAccount(session.user.id);
  const memberships = fresh?.memberships ?? saved;
  const check = fresh ? checkMemberships(saved, fresh.memberships, activeOrgId) : { changed: false, gone: null };
  const active = check.gone ?? memberships.find((item) => item.orgId === activeOrgId) ?? memberships[0] ?? null;
  const resync = Boolean(check.gone) || (active !== null && active.orgId !== activeOrgId);
  return {
    user: {
      id: session.user.id,
      name: fresh?.name || session.user.name || session.user.email || "사용자",
      email: session.user.email ?? null,
    },
    memberships,
    active,
    stale: check.changed && !resync,
    resync,
  };
});

/**
 * 로그인과 회사 등록을 마친 사람만. 아니면 로그인이나 회사 등록으로 보낸다.
 * resync이면 보내지 않고 그대로 돌려준다. 레이아웃이 세션을 고친 뒤 다시 연다(남은 회사가 없으면 그때 회사 등록으로 간다).
 */
export async function requireWorkspace(): Promise<Workspace & { active: Membership }> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!workspace.active) redirect("/onboarding");
  return workspace as Workspace & { active: Membership };
}
