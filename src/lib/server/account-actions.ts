"use server";

import { signOut } from "@/auth";
import { deleteOrgData } from "./account-data";
import { findMemberForUser } from "./mock/members";
import { findOrganizationByOwner } from "./mock-store";
import { getCurrentUser } from "./session";

export type WithdrawState = { error?: string } | undefined;

/**
 * 회원 탈퇴. 회사명을 그대로 입력했을 때만 회사 데이터 전체를 지우고 로그아웃한 뒤 홈으로 보낸다.
 * 회사 소유자만 할 수 있다 (다른 멤버는 소유자에게 제거를 요청한다).
 */
export async function withdrawAccount(_prev: WithdrawState, formData: FormData): Promise<WithdrawState> {
  const user = await getCurrentUser();
  const org = await findOrganizationByOwner(user.id);

  if (org) {
    const me = await findMemberForUser(org.id, user.id);
    if (me && !me.owner) return { error: "회사 소유자만 탈퇴로 회사 데이터를 지울 수 있습니다." };
    const typed = String(formData.get("confirmName") ?? "").trim();
    if (typed !== org.name) return { error: "입력한 회사명이 등록된 회사명과 다릅니다. 띄어쓰기와 괄호까지 똑같이 입력해 주세요." };
    if (formData.get("acknowledge") !== "on") return { error: "삭제 대상과 되돌릴 수 없다는 점을 확인했다는 항목에 체크해 주세요." };
    await deleteOrgData(org, user.id);
  }

  await signOut({ redirectTo: "/" });
  return undefined;
}
