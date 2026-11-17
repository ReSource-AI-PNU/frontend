"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, unstable_update } from "@/auth";
import { inviteLink, inviteMessage, inviteTokenFrom } from "@/lib/auth/account";
import { isValidBizNo, normalizeBizNo } from "@/lib/bizno";
import { findComplex } from "@/lib/complexes";
import { BackendError, callBackend } from "./backend";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export type CompanyFormState =
  | { errors?: Record<string, string>; error?: string; values?: Record<string, string> }
  | undefined;

const companySchema = z.object({
  kind: z.enum(["emitter", "vendor"], "하는 일을 골라 주세요."),
  name: z.string().trim().min(2, "회사 이름을 2자 이상 입력해 주세요.").max(60, "회사 이름은 60자까지 입력할 수 있습니다."),
  bizNo: z
    .string()
    .transform(normalizeBizNo)
    .refine((value) => value === "" || isValidBizNo(value), "사업자등록번호 10자리를 확인해 주세요."),
  complexId: z.string(),
  address: z.string().trim().max(120, "주소는 120자까지 입력할 수 있습니다."),
});

/**
 * 회사 등록: POST /orgs로 회사를 만들고(만든 사람이 소유자), 세션의 소속을 다시 읽어 새 회사를 활성 회사로 둔다.
 * 사업자등록번호와 주소는 비워도 된다.
 */
export async function createCompany(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const session = await sessionUser();
  const values = {
    kind: text(formData, "kind"),
    name: text(formData, "name"),
    bizNo: text(formData, "bizNo"),
    complexId: text(formData, "complexId"),
    address: text(formData, "address"),
  };
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values };
  }
  const complex = findComplex(parsed.data.complexId);
  const body = {
    name: parsed.data.name,
    kind: parsed.data.kind,
    ...(parsed.data.bizNo ? { bizNo: parsed.data.bizNo } : {}),
    ...(complex ? { region: `${complex.region} ${complex.name}`, location: complex.center } : {}),
    ...(parsed.data.address ? { address: parsed.data.address } : {}),
  };
  let orgId: string | null = null;
  try {
    const created = await callBackend<{ id?: string; orgId?: string }>("/orgs", {
      method: "POST",
      body,
      userId: session.user.id,
    });
    orgId = created?.id ?? created?.orgId ?? null;
  } catch (error) {
    if (error instanceof BackendError && (error.status === 400 || error.status === 422)) {
      return { error: "입력한 내용을 다시 확인해 주세요.", values };
    }
    if (error instanceof BackendError && error.status === 409) {
      return { error: "이미 등록된 회사입니다. 회사에 계신 분께 초대 링크를 요청해 주세요.", values };
    }
    if (error instanceof BackendError) return { error: "지금은 회사를 등록할 수 없습니다. 잠시 후 다시 시도해 주세요.", values };
    throw error;
  }
  await unstable_update({ activeOrgId: orgId });
  redirect("/app");
}

/** 사이드바의 회사 바꾸기. 소속 목록에 있는 회사만 고를 수 있다(auth.ts의 jwt 콜백이 다시 확인한다). */
export async function switchCompany(orgId: string): Promise<void> {
  const session = await sessionUser();
  if (!session.memberships.some((item) => item.orgId === orgId)) return;
  await unstable_update({ activeOrgId: orgId });
}

export type InviteAcceptState = { error?: string } | undefined;

/** 초대 수락: POST /invites/{token}/accept → 그 회사를 활성 회사로 두고 찾기 화면으로 간다. */
export async function acceptInvite(_prev: InviteAcceptState, formData: FormData): Promise<InviteAcceptState> {
  const session = await sessionUser();
  const token = inviteTokenFrom(formData.get("token"));
  if (!token) return { error: inviteMessage(410, "INVITE_INVALID") };
  let orgId: string | null = null;
  try {
    const membership = await callBackend<{ orgId?: string }>(`/invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: {},
      userId: session.user.id,
    });
    orgId = membership?.orgId ?? null;
  } catch (error) {
    if (error instanceof BackendError) return { error: inviteMessage(error.status, error.code) };
    throw error;
  }
  await unstable_update({ activeOrgId: orgId });
  redirect("/app");
}

/** 회사 등록 화면에서 받은 초대 링크(또는 코드)를 붙여 넣으면 초대 화면으로 보낸다. */
export async function openInviteLink(_prev: InviteAcceptState, formData: FormData): Promise<InviteAcceptState> {
  const token = inviteTokenFrom(formData.get("invite"));
  if (!token) return { error: "초대 링크를 다시 확인해 주세요." };
  redirect(`/invite/${encodeURIComponent(token)}`);
}

export type InviteCreateState = { link?: string; expiresAt?: string | null; error?: string } | undefined;

async function siteOrigin(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 초대 링크 만들기(소유자만): POST /orgs/{orgId}/invites → ${AUTH_URL}/invite/${token} */
export async function createInvite(): Promise<InviteCreateState> {
  const session = await sessionUser();
  const orgId = session.activeOrgId;
  const me = session.memberships.find((item) => item.orgId === orgId);
  if (!orgId || me?.memberRole !== "owner") return { error: "초대 링크는 회사 소유자만 만들 수 있습니다." };
  try {
    const invite = await callBackend<{ token?: string; expiresAt?: string }>(`/orgs/${encodeURIComponent(orgId)}/invites`, {
      method: "POST",
      body: {},
      userId: session.user.id,
      orgId,
    });
    if (!invite?.token) return { error: "지금은 초대 링크를 만들 수 없습니다. 잠시 후 다시 시도해 주세요." };
    return { link: inviteLink(await siteOrigin(), invite.token), expiresAt: invite.expiresAt ?? null };
  } catch (error) {
    if (error instanceof BackendError && error.status === 403) return { error: "초대 링크는 회사 소유자만 만들 수 있습니다." };
    if (error instanceof BackendError) return { error: "지금은 초대 링크를 만들 수 없습니다. 잠시 후 다시 시도해 주세요." };
    throw error;
  }
}
