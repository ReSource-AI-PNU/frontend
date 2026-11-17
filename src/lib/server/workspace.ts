import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Membership } from "@/lib/auth/account";

export type Workspace = {
  user: { id: string; name: string; email: string | null };
  memberships: Membership[];
  /** 지금 보는 회사. 소속이 없으면 null */
  active: Membership | null;
};

/** 세션을 읽으므로 반드시 Suspense 경계 안에서 호출한다. 로그인하지 않았으면 null. */
export async function getWorkspace(): Promise<Workspace | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const memberships = session.memberships ?? [];
  const active = memberships.find((item) => item.orgId === session.activeOrgId) ?? memberships[0] ?? null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? "사용자",
      email: session.user.email ?? null,
    },
    memberships,
    active,
  };
}

/** 로그인과 회사 등록을 마친 사람만. 아니면 로그인이나 회사 등록으로 보낸다. */
export async function requireWorkspace(): Promise<Workspace & { active: Membership }> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!workspace.active) redirect("/onboarding");
  return workspace as Workspace & { active: Membership };
}
