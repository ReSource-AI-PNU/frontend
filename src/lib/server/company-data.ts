import "server-only";
import type { MemberRole } from "@/lib/auth/account";
import { callBackend } from "./backend";
import type { Workspace } from "./workspace";

export type Member = { userId: string; name: string; email: string; memberRole: MemberRole };

/** 회사 멤버(GET /orgs/{orgId}/members). 읽지 못하면 null */
export async function listMembers(workspace: Workspace & { active: NonNullable<Workspace["active"]> }): Promise<Member[] | null> {
  try {
    const rows = await callBackend<unknown>(`/orgs/${encodeURIComponent(workspace.active.orgId)}/members`, {
      userId: workspace.user.id,
      orgId: workspace.active.orgId,
    });
    if (!Array.isArray(rows)) return null;
    return rows.flatMap((row) => {
      const item = row as Record<string, unknown>;
      if (typeof item.userId !== "string") return [];
      return [
        {
          userId: item.userId,
          name: typeof item.name === "string" && item.name ? item.name : "이름 없음",
          email: typeof item.email === "string" ? item.email : "",
          memberRole: item.memberRole === "owner" ? "owner" : "member",
        },
      ];
    });
  } catch {
    return null;
  }
}

export type CompanyDetail = { region: string | null; address: string | null; bizNo: string | null };

/** 회사의 지역·주소·사업자등록번호. 조직 목록(GET /orgs)에서 이 회사를 찾는다. 없거나 읽지 못하면 빈 값 */
export async function companyDetail(workspace: Workspace & { active: NonNullable<Workspace["active"]> }): Promise<CompanyDetail> {
  const empty = { region: null, address: null, bizNo: null };
  try {
    const orgs = await callBackend<unknown>("/orgs", { userId: workspace.user.id, orgId: workspace.active.orgId });
    if (!Array.isArray(orgs)) return empty;
    const org = orgs.find((item) => (item as { id?: unknown }).id === workspace.active.orgId) as Record<string, unknown> | undefined;
    if (!org) return empty;
    const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
    return { region: str(org.region), address: str(org.address), bizNo: str(org.bizNo) };
  } catch {
    return empty;
  }
}
