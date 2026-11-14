import "server-only";
import type { Organization } from "@/lib/domain";
import type { Member } from "@/lib/session/types";
import type { CurrentUser } from "../session";
import { collection, newId, nowIso } from "./db";

/**
 * 회사 멤버. 백엔드 연동 전까지 쓰는 모의 저장소(.mock-db/members.json).
 * Member 계약에 없는 값(userId, owner)은 저장소 안에서만 쓴다.
 */
export type StoredMember = Member & {
  /** 로그인한 사용자와 연결된 멤버면 Auth.js 사용자 id */
  userId?: string;
  /** 회사를 등록한 소유자. 소유자는 항상 관리자이며 제거할 수 없다. */
  owner?: boolean;
};

export const members = collection<StoredMember>("members");

/** 소유자 멤버 id는 회사마다 하나로 고정해, 동시에 처음 방문해도 같은 행으로 취급한다. */
function ownerMemberId(orgId: string) {
  return `mem_owner_${orgId}`;
}

/** 같은 id가 두 번 들어간 경우(동시 시드)를 걸러 낸다. */
function uniqueById(rows: StoredMember[]) {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** 처음 방문하면 현재 사용자를 소유자이자 관리자로 등록한다. */
export async function ensureOwnerMember(org: Organization, user: CurrentUser) {
  const id = ownerMemberId(org.id);
  const existing = await members.get(id);
  if (existing) return existing;
  return members.insert({
    id,
    orgId: org.id,
    userId: user.id,
    owner: true,
    name: user.name,
    email: user.email ?? "",
    role: "관리자",
    status: "active",
    invitedAt: org.createdAt,
  });
}

const ROLE_ORDER: Record<Member["role"], number> = { 관리자: 0, 승인권자: 1, 담당자: 2 };

export async function listMembers(orgId: string) {
  const rows = uniqueById(await members.filter((m) => m.orgId === orgId));
  return rows.sort(
    (a, b) =>
      Number(Boolean(b.owner)) - Number(Boolean(a.owner)) ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.invitedAt.localeCompare(b.invitedAt),
  );
}

export async function findMember(orgId: string, memberId: string) {
  return members.find((m) => m.orgId === orgId && m.id === memberId);
}

/** 현재 사용자가 이 회사에서 가진 멤버 행 */
export async function findMemberForUser(orgId: string, userId: string) {
  return members.find((m) => m.orgId === orgId && m.userId === userId);
}

export async function inviteMember(orgId: string, email: string, role: Member["role"]) {
  return members.insert({
    id: newId("mem"),
    orgId,
    name: "",
    email,
    role,
    status: "invited",
    invitedAt: nowIso(),
  });
}

export async function setMemberRole(memberId: string, role: Member["role"]) {
  return members.update(memberId, (m) => ({ ...m, role }));
}

export async function removeMember(orgId: string, memberId: string) {
  return members.remove((m) => m.orgId === orgId && m.id === memberId && !m.owner);
}

export async function removeMembersOfOrg(orgId: string) {
  return members.remove((m) => m.orgId === orgId);
}
