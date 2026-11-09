"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEMBER_ROLES } from "@/components/settings/roles";
import {
  ensureOwnerMember,
  findMember,
  findMemberForUser,
  inviteMember as insertInvite,
  listMembers,
  removeMember as deleteMember,
  setMemberRole,
} from "./mock/members";
import { requireOrganization } from "./organization";
import { getCurrentUser } from "./session";

const MAX_MEMBERS = 50;

export type InviteState =
  | { ok?: string; error?: string; fieldErrors?: { email?: string; role?: string }; values?: { email: string; role: string } }
  | undefined;

export type MemberActionState = { ok?: string; error?: string } | undefined;

/** 관리자만 멤버를 관리할 수 있다. 처음 방문 전에 액션이 불려도 소유자 행이 있도록 시드를 먼저 확인한다. */
async function requireAdmin() {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  await ensureOwnerMember(org, user);
  const me = await findMemberForUser(org.id, user.id);
  if (!me || me.role !== "관리자" || me.status !== "active") return { error: "멤버를 관리할 권한이 없습니다. 관리자에게 요청해 주세요." } as const;
  return { user, org, me } as const;
}

const inviteSchema = z.object({
  email: z.email("이메일 형식을 확인해 주세요.").max(120, "이메일이 너무 깁니다."),
  role: z.enum(MEMBER_ROLES, "역할을 골라 주세요."),
});

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const values = {
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? ""),
  };
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error, values };

  const parsed = inviteSchema.safeParse({ ...values, email: values.email.toLowerCase() });
  if (!parsed.success) {
    const fieldErrors: { email?: string; role?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "email" | "role";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const current = await listMembers(ctx.org.id);
  if (current.some((m) => m.email.toLowerCase() === parsed.data.email)) {
    return { fieldErrors: { email: "이미 멤버이거나 초대한 이메일입니다." }, values };
  }
  if (current.length >= MAX_MEMBERS) {
    return { error: `멤버는 ${MAX_MEMBERS}명까지 둘 수 있습니다.`, values };
  }

  await insertInvite(ctx.org.id, parsed.data.email, parsed.data.role);
  revalidatePath("/settings/members");
  return { ok: `${parsed.data.email}을(를) ${parsed.data.role}(으)로 초대했습니다. 아래 표에서 초대 링크를 복사해 전달해 주세요.` };
}

export async function changeMemberRole(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const memberId = String(formData.get("memberId") ?? "");
  const role = z.enum(MEMBER_ROLES).safeParse(formData.get("role"));
  if (!role.success) return { error: "역할을 다시 골라 주세요." };

  const target = await findMember(ctx.org.id, memberId);
  if (!target) return { error: "멤버를 찾을 수 없습니다. 화면을 새로 고쳐 주세요." };
  if (target.owner) return { error: "소유자는 항상 관리자입니다. 역할을 바꿀 수 없습니다." };
  if (target.role === role.data) return { ok: "역할이 그대로입니다." };

  await setMemberRole(target.id, role.data);
  revalidatePath("/settings/members");
  return { ok: `역할을 ${role.data}(으)로 바꿨습니다.` };
}

export async function removeMember(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const memberId = String(formData.get("memberId") ?? "");

  const target = await findMember(ctx.org.id, memberId);
  if (!target) return { error: "멤버를 찾을 수 없습니다. 화면을 새로 고쳐 주세요." };
  if (target.owner) return { error: "소유자는 제거할 수 없습니다. 회사를 정리하려면 계정 화면에서 탈퇴해 주세요." };
  if (target.id === ctx.me.id) return { error: "자기 자신은 제거할 수 없습니다." };

  await deleteMember(ctx.org.id, target.id);
  revalidatePath("/settings/members");
  return { ok: "멤버를 제거했습니다." };
}
