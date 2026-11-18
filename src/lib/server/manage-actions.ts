"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut, unstable_update } from "@/auth";
import {
  blockersFromError,
  companyErrors,
  companyFailure,
  companyPatch,
  DELETE_MESSAGE,
  deleteFailure,
  isUnsupported,
  memberFailure,
  passwordErrors,
  passwordFailure,
  soleOwnerOrgs,
  type Blocker,
  type CompanyErrors,
  type CompanyInput,
  type PasswordErrors,
} from "@/lib/auth/manage";
import { COMPLEXES } from "@/lib/complexes";
import { BackendError, callBackend } from "./backend";
import { markUnsupported } from "./capabilities";
import { membersOf, type Member } from "./company-data";

/**
 * 회사 정보 고치기, 구성원 관리, 비밀번호 바꾸기, 계정 지우기(설정 화면). 백엔드 계약은 src/lib/auth/manage.ts 머리말에 있다.
 * 백엔드가 아직 열지 않은 기능(404·405)이면 capabilities에 적고 { unsupported: true }를 돌려준다(화면이 그 단추를 숨긴다).
 */

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

const ORG_CHANGED = "다른 창에서 회사를 바꿨습니다. 화면을 새로 고쳐 주세요.";
const DEV_ACCOUNT = "개발용 계정은 비밀번호와 계정을 바꿀 수 없습니다.";

// ── 회사 정보 ─────────────────────────────────────────────

export type CompanyEditState =
  | { errors?: CompanyErrors; error?: string; saved?: boolean; unsupported?: boolean; values?: CompanyInput }
  | undefined;

/** 회사 정보 고치기(소유자): PATCH /orgs/{orgId}. 저장하면 세션의 회사 이름도 다시 읽는다. */
export async function updateCompany(_prev: CompanyEditState, formData: FormData): Promise<CompanyEditState> {
  const session = await sessionUser();
  const orgId = text(formData, "orgId");
  const values: CompanyInput = {
    name: text(formData, "name"),
    bizNo: text(formData, "bizNo"),
    address: text(formData, "address"),
    complexId: text(formData, "complexId"),
  };
  if (!orgId || orgId !== session.activeOrgId) return { error: ORG_CHANGED, values };
  const me = session.memberships.find((item) => item.orgId === orgId);
  if (me?.memberRole !== "owner") return { error: companyFailure(403, null), values };
  const errors = companyErrors(values);
  if (Object.keys(errors).length > 0) return { errors, values };
  try {
    await callBackend(`/orgs/${encodeURIComponent(orgId)}`, {
      method: "PATCH",
      body: companyPatch(values, COMPLEXES),
      userId: session.user.id,
      orgId,
    });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    if (isUnsupported(error.status, error.code)) {
      markUnsupported("orgEdit");
      return { unsupported: true, values };
    }
    return { error: companyFailure(error.status, error.code), values };
  }
  // 회사 이름이 바뀌었을 수 있으므로 소속을 다시 읽는다(사이드바의 회사 이름)
  await unstable_update({ activeOrgId: orgId });
  refresh();
  return { saved: true, values };
}

// ── 구성원 ───────────────────────────────────────────────

export type MemberActionState = { error?: string; done?: "remove" | "owner"; unsupported?: boolean } | undefined;

/**
 * 구성원 빼기(소유자) 또는 회사에서 나가기(나 자신): DELETE /orgs/{orgId}/members/{userId}.
 * 내가 나갔으면 소속을 다시 읽고 찾기 화면으로 간다(남은 회사가 없으면 회사 등록으로 간다).
 */
export async function removeMember(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const session = await sessionUser();
  const orgId = text(formData, "orgId");
  const userId = text(formData, "userId");
  const self = userId === session.user.id;
  if (!orgId || orgId !== session.activeOrgId) return { error: ORG_CHANGED };
  const me = session.memberships.find((item) => item.orgId === orgId);
  if (!me || !userId) return { error: memberFailure("remove", 404, null) };
  if (!self && me.memberRole !== "owner") return { error: memberFailure("remove", 403, null) };
  try {
    await callBackend(`/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      userId: session.user.id,
      orgId,
    });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    if (isUnsupported(error.status, error.code)) {
      markUnsupported("memberRemove");
      return { unsupported: true };
    }
    return { error: memberFailure(self ? "leave" : "remove", error.status, error.code) };
  }
  if (self) {
    await unstable_update({});
    redirect("/app");
  }
  refresh();
  return { done: "remove" };
}

/**
 * 구성원을 소유자로 정하기(소유자): POST /orgs/{orgId}/owners/{userId}.
 * 지금 보는 회사가 아니어도 내가 소유자인 회사면 된다(계정을 지우기 전에 소유자를 넘길 때).
 */
export async function makeOwner(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const session = await sessionUser();
  const orgId = text(formData, "orgId");
  const userId = text(formData, "userId");
  const me = session.memberships.find((item) => item.orgId === orgId);
  if (!me || !userId) return { error: memberFailure("owner", 404, null) };
  if (me.memberRole !== "owner") return { error: memberFailure("owner", 403, null) };
  try {
    await callBackend(`/orgs/${encodeURIComponent(orgId)}/owners/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: {},
      userId: session.user.id,
      orgId,
    });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    if (isUnsupported(error.status, error.code)) {
      markUnsupported("ownerGrant");
      return { unsupported: true };
    }
    return { error: memberFailure("owner", error.status, error.code) };
  }
  refresh();
  return { done: "owner" };
}

// ── 비밀번호 ─────────────────────────────────────────────

export type PasswordState = { errors?: PasswordErrors; error?: string; saved?: boolean; unsupported?: boolean } | undefined;

/** 비밀번호 바꾸기: POST /accounts/password {currentPassword, newPassword}. 입력한 비밀번호는 돌려주지 않는다. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await sessionUser();
  if (session.user.id.startsWith("dev:")) return { error: DEV_ACCOUNT };
  const input = { current: text(formData, "currentPassword"), next: text(formData, "newPassword"), confirm: text(formData, "newPasswordConfirm") };
  const errors = passwordErrors(input);
  if (Object.keys(errors).length > 0) return { errors };
  try {
    await callBackend("/accounts/password", {
      method: "POST",
      body: { currentPassword: input.current, newPassword: input.next },
      userId: session.user.id,
    });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    if (isUnsupported(error.status, error.code)) {
      markUnsupported("passwordChange");
      return { unsupported: true };
    }
    const failure = passwordFailure(error.status, error.code);
    return failure.field ? { errors: { [failure.field]: failure.message } } : { error: failure.message };
  }
  return { saved: true };
}

// ── 계정 지우기 ──────────────────────────────────────────

/** 탈퇴를 막는 회사와 소유자로 정할 수 있는 다른 구성원 */
export type TransferTarget = Blocker & { candidates: Pick<Member, "userId" | "name" | "email">[] | null };

export type DeleteAccountState =
  | { errors?: { password?: string; agree?: string }; error?: string; transfer?: TransferTarget[]; unsupported?: boolean }
  | undefined;

/**
 * 계정 지우기: DELETE /accounts/me {password}. 지우면 로그아웃하고 첫 화면(?account=deleted)으로 간다.
 * 다른 구성원이 있는 회사의 유일한 소유자면 409 TRANSFER_OWNERSHIP_FIRST다. 그 회사와 소유자로 정할 사람을 돌려준다.
 */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const session = await sessionUser();
  if (session.user.id.startsWith("dev:")) return { error: DEV_ACCOUNT };
  const password = text(formData, "password");
  const errors: { password?: string; agree?: string } = {};
  if (!password) errors.password = "비밀번호를 입력해 주세요.";
  if (formData.get("agree") !== "on") errors.agree = "지워지는 것과 남는 것을 확인했다고 표시해 주세요.";
  if (Object.keys(errors).length > 0) return { errors };
  try {
    await callBackend("/accounts/me", { method: "DELETE", body: { password }, userId: session.user.id });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    const failure = deleteFailure(error.status, error.code);
    if (failure === "transfer") return { transfer: await transferTargets(session.user.id, session.memberships, error.body) };
    if (failure === "unsupported") markUnsupported("accountDelete");
    if (failure === "password") return { errors: { password: DELETE_MESSAGE.password } };
    return failure === "unsupported" ? { unsupported: true, error: DELETE_MESSAGE.unsupported } : { error: DELETE_MESSAGE[failure] };
  }
  // 세션 쿠키를 지우고 첫 화면으로 간다(NEXT_REDIRECT를 던진다)
  await signOut({ redirectTo: "/?account=deleted" });
}

async function transferTargets(
  userId: string,
  memberships: Awaited<ReturnType<typeof sessionUser>>["memberships"],
  body: unknown,
): Promise<TransferTarget[]> {
  // 백엔드가 막는 회사를 알려 주면 그 회사만, 아니면 내가 소유자인 회사의 구성원을 읽어 직접 찾는다
  const named = blockersFromError(body, memberships);
  const orgIds = named.length > 0 ? named.map((item) => item.orgId) : memberships.filter((item) => item.memberRole === "owner").map((item) => item.orgId);
  const lists: Record<string, Member[] | null> = Object.fromEntries(
    await Promise.all(orgIds.map(async (orgId) => [orgId, await membersOf(userId, orgId)] as const)),
  );
  const blockers = named.length > 0 ? named : soleOwnerOrgs(userId, memberships, lists);
  return blockers.map((blocker) => {
    const members = lists[blocker.orgId] ?? null;
    return {
      ...blocker,
      candidates: members
        ? members.filter((item) => item.userId !== userId).map(({ userId: id, name, email }) => ({ userId: id, name, email }))
        : null,
    };
  });
}
