/**
 * 회사 정보 고치기, 구성원 관리, 비밀번호 바꾸기, 계정 지우기의 입력 검사와 오류 해석.
 * 네트워크를 부르지 않으므로 node --test로 검사한다(tests/manage.test.ts).
 *
 * 백엔드 계약(계정·조직 관리):
 *   PATCH  /orgs/{orgId}                    {name?, bizNo?, region?, address?, location?: [lng, lat]} → 조직 (소유자)
 *   DELETE /orgs/{orgId}/members/{userId}   → 204 (소유자, 또는 자기 자신이 나갈 때). 마지막 소유자는 빼지 못한다 → 409
 *   POST   /orgs/{orgId}/owners/{userId}    → 구성원을 소유자로 정한다 (소유자)
 *   POST   /accounts/password               {currentPassword, newPassword} → 204. 401 INVALID_CREDENTIALS, 429
 *   DELETE /accounts/me                     {password} → 204. 다른 구성원이 있는 회사의 유일한 소유자면 409 TRANSFER_OWNERSHIP_FIRST
 * 오류 본문은 {error: {code, message}}다.
 */
import { isValidBizNo, normalizeBizNo } from "../bizno.ts";
import type { MemberRole, Membership } from "./account.ts";

export const UNAVAILABLE_MESSAGE = "잠시 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 아직 열리지 않은 기능인지(백엔드가 그 주소를 배포하기 전). 404·405·501이면서 업무 오류 코드가 없을 때다.
 * 업무상 404(없는 구성원 등)는 MEMBER_NOT_FOUND처럼 코드가 따로 있으므로 여기에 들지 않는다.
 */
export function isUnsupported(status: number, code: string | null): boolean {
  if (status === 405 || status === 501) return true;
  if (status !== 404) return false;
  return !code || /^\d+$/.test(code) || code === "NOT_FOUND";
}

// ── 회사 정보 ─────────────────────────────────────────────

/** 사업자등록번호 입력 검사. 선택 항목이라 비어 있으면 null. 숫자와 붙임표·띄어쓰기만 받는다. */
export function bizNoError(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/[^\d\s-]/.test(text)) return "사업자등록번호는 숫자와 -만 입력해 주세요.";
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 10) return "사업자등록번호 10자리를 모두 입력해 주세요.";
  if (!isValidBizNo(digits)) return "사업자등록번호가 맞는지 다시 확인해 주세요.";
  return null;
}

export type CompanyInput = { name: string; bizNo: string; address: string; complexId: string };
export type CompanyErrors = Partial<Record<keyof CompanyInput, string>>;

/** 지역 고르기에서 "지금 값 그대로"(저장된 지역이 산업단지 목록에 없을 때) */
export const KEEP_REGION = "keep";

export function companyErrors(input: CompanyInput): CompanyErrors {
  const errors: CompanyErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "회사 이름을 2자 이상 입력해 주세요.";
  else if (name.length > 60) errors.name = "회사 이름은 60자까지 입력할 수 있습니다.";
  const biz = bizNoError(input.bizNo);
  if (biz) errors.bizNo = biz;
  if (input.address.trim().length > 120) errors.address = "주소는 120자까지 입력할 수 있습니다.";
  return errors;
}

/** 산업단지 고르기에 쓰는 만큼만(data/complexes.json의 항목) */
export type ComplexRef = { id: string; name: string; region: string; center: [number, number] };

/** 회사 등록 때 저장하는 지역 글: "부산 녹산국가산업단지" */
export function complexRegion(complex: Pick<ComplexRef, "region" | "name">): string {
  return `${complex.region} ${complex.name}`;
}

/** 저장된 지역 글이 산업단지 하나와 맞으면 그 ID. 지역이 비어 있으면 ""(산업단지 밖), 맞는 것이 없으면 KEEP_REGION */
export function complexIdFor(region: string | null, complexes: ComplexRef[]): string {
  const text = (region ?? "").trim();
  if (!text) return "";
  const found = complexes.find((item) => complexRegion(item) === text || item.name === text);
  return found ? found.id : KEEP_REGION;
}

export type CompanyPatch = {
  name: string;
  bizNo: string | null;
  address: string | null;
  region?: string | null;
  location?: [number, number] | null;
};

/**
 * PATCH /orgs/{orgId}에 보낼 본문. 비운 선택 항목은 null로 보내 지운다.
 * 지역을 "지금 값 그대로"로 두면 지역과 위치를 보내지 않는다.
 */
export function companyPatch(input: CompanyInput, complexes: ComplexRef[]): CompanyPatch {
  const bizNo = normalizeBizNo(input.bizNo);
  const address = input.address.trim();
  const body: CompanyPatch = { name: input.name.trim(), bizNo: bizNo || null, address: address || null };
  if (input.complexId === KEEP_REGION) return body;
  const complex = complexes.find((item) => item.id === input.complexId);
  return complex
    ? { ...body, region: complexRegion(complex), location: complex.center }
    : { ...body, region: null, location: null };
}

export function companyFailure(status: number, code: string | null): string {
  if (status === 403) return "회사 정보는 소유자만 고칠 수 있습니다.";
  if (status === 409 || code === "BIZNO_TAKEN") return "이미 다른 회사가 쓰는 사업자등록번호입니다. 번호를 다시 확인해 주세요.";
  if (status === 400 || status === 422) return "입력한 내용을 다시 확인해 주세요.";
  return UNAVAILABLE_MESSAGE;
}

// ── 구성원 ───────────────────────────────────────────────

export type MemberRow = { userId: string; memberRole: MemberRole };

/**
 * 회사에서 나갈 수 있는지. 마지막 소유자는 빠질 수 없다(백엔드 409).
 *  - last_owner: 다른 구성원이 있는데 소유자가 나 혼자다. 먼저 다른 구성원을 소유자로 정해야 한다.
 *  - alone: 회사에 나 혼자다.
 */
export function leaveBlock(userId: string, members: MemberRow[]): "last_owner" | "alone" | null {
  const me = members.find((item) => item.userId === userId);
  if (!me || me.memberRole !== "owner") return null;
  if (members.some((item) => item.userId !== userId && item.memberRole === "owner")) return null;
  return members.some((item) => item.userId !== userId) ? "last_owner" : "alone";
}

export type MemberAction = "remove" | "leave" | "owner";

export function memberFailure(action: MemberAction, status: number, code: string | null): string {
  if (status === 409) {
    return action === "owner"
      ? "이미 소유자입니다. 화면을 새로 고쳐 주세요."
      : "회사에는 소유자가 한 명은 있어야 합니다. 다른 구성원을 먼저 소유자로 정해 주세요.";
  }
  if (status === 403) return "회사 소유자만 할 수 있습니다.";
  if (status === 404) return "이미 회사에서 빠진 사람입니다. 화면을 새로 고쳐 주세요.";
  if (status === 429 || code === "RATE_LIMITED") return "요청이 많았습니다. 잠시 후 다시 시도해 주세요.";
  return UNAVAILABLE_MESSAGE;
}

// ── 비밀번호 ─────────────────────────────────────────────

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** 새 비밀번호 규칙: 가입과 같다(8자 이상, 200자까지). 빈 칸만 이어진 비밀번호는 받지 않는다. */
export function newPasswordError(value: string): string | null {
  if (value.length < PASSWORD_MIN) return `새 비밀번호는 ${PASSWORD_MIN}자 이상으로 정해 주세요.`;
  if (value.length > PASSWORD_MAX) return "비밀번호가 너무 깁니다.";
  if (!value.trim()) return "빈칸만으로는 비밀번호를 만들 수 없습니다.";
  return null;
}

export type PasswordInput = { current: string; next: string; confirm: string };
export type PasswordErrors = Partial<Record<keyof PasswordInput, string>>;

export function passwordErrors(input: PasswordInput): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!input.current) errors.current = "지금 쓰는 비밀번호를 입력해 주세요.";
  const next = newPasswordError(input.next);
  if (next) errors.next = next;
  else if (input.current && input.next === input.current) errors.next = "지금 쓰는 비밀번호와 다르게 정해 주세요.";
  if (!errors.next && input.confirm !== input.next) errors.confirm = "새 비밀번호 확인이 맞지 않습니다.";
  return errors;
}

/** 비밀번호를 바꾸지 못했을 때. 지금 비밀번호가 틀리면 그 칸에 적는다. */
export function passwordFailure(status: number, code: string | null): { field?: "current" | "next"; message: string } {
  if (status === 401 || code === "INVALID_CREDENTIALS") return { field: "current", message: "지금 쓰는 비밀번호가 맞지 않습니다." };
  if (status === 429) return { message: "시도가 많았습니다. 잠시 후 다시 시도해 주세요." };
  if (status === 400 || status === 422) {
    return { field: "next", message: `새 비밀번호를 다시 확인해 주세요. ${PASSWORD_MIN}자 이상이어야 합니다.` };
  }
  return { message: UNAVAILABLE_MESSAGE };
}

// ── 계정 지우기 ──────────────────────────────────────────

export type DeleteFailure = "transfer" | "password" | "rate_limited" | "unsupported" | "unavailable";

export function deleteFailure(status: number, code: string | null): DeleteFailure {
  if (code === "TRANSFER_OWNERSHIP_FIRST") return "transfer";
  if (status === 401 || code === "INVALID_CREDENTIALS" || status === 400 || status === 422) return "password";
  if (status === 429) return "rate_limited";
  if (isUnsupported(status, code)) return "unsupported";
  return "unavailable";
}

export const DELETE_MESSAGE: Record<Exclude<DeleteFailure, "transfer">, string> = {
  password: "비밀번호가 맞지 않습니다. 다시 입력해 주세요.",
  rate_limited: "시도가 많았습니다. 잠시 후 다시 시도해 주세요.",
  unsupported: "지금은 계정을 지울 수 없습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: UNAVAILABLE_MESSAGE,
};

/** 탈퇴를 막는 회사(다른 구성원이 있는데 소유자가 나 혼자인 회사) */
export type Blocker = { orgId: string; orgName: string };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * 409 TRANSFER_OWNERSHIP_FIRST 본문에서 막는 회사를 읽는다. 백엔드가 회사를 어떻게 싣는지 아직 정해지지 않아
 * error.orgs([{orgId|id, orgName|name}]), error.orgIds, error.orgId, error.details 아래 같은 이름을 모두 받는다.
 * 이름이 없으면 내 소속에서 찾는다. 회사를 싣지 않았으면 빈 목록이다(그때는 soleOwnerOrgs로 직접 찾는다).
 */
export function blockersFromError(body: unknown, memberships: Membership[]): Blocker[] {
  if (!body || typeof body !== "object") return [];
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return [];
  const sources = [error as Record<string, unknown>];
  const details = (error as { details?: unknown }).details;
  if (details && typeof details === "object" && !Array.isArray(details)) sources.push(details as Record<string, unknown>);
  const found = new Map<string, string>();
  const add = (orgId: string, orgName: string) => {
    if (!orgId || found.has(orgId)) return;
    found.set(orgId, orgName || memberships.find((item) => item.orgId === orgId)?.orgName || orgId);
  };
  for (const source of sources) {
    if (Array.isArray(source.orgs)) {
      for (const item of source.orgs) {
        if (typeof item === "string") add(text(item), "");
        else if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          add(text(row.orgId) || text(row.id), text(row.orgName) || text(row.name));
        }
      }
    }
    if (Array.isArray(source.orgIds)) for (const id of source.orgIds) add(text(id), "");
    add(text(source.orgId), text(source.orgName));
  }
  return [...found].map(([orgId, orgName]) => ({ orgId, orgName }));
}

/**
 * 내 소속과 회사마다의 구성원 목록으로 탈퇴를 막는 회사를 찾는다. 구성원 목록을 읽지 못한 회사(null)는
 * 내가 소유자이면 막는 회사로 본다(확인하지 못한 것을 지워도 된다고 보지 않는다).
 */
export function soleOwnerOrgs(
  userId: string,
  memberships: Membership[],
  membersByOrg: Record<string, MemberRow[] | null>,
): Blocker[] {
  return memberships
    .filter((item) => item.memberRole === "owner")
    .filter((item) => {
      const members = membersByOrg[item.orgId];
      return members === null || members === undefined ? true : leaveBlock(userId, members) === "last_owner";
    })
    .map((item) => ({ orgId: item.orgId, orgName: item.orgName }));
}
