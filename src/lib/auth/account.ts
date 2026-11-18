/**
 * 계정과 회사 소속(멤버십)을 다루는 순수 함수. 네트워크를 부르지 않으므로 node --test로 검사한다(tests/auth-account.test.ts).
 * 모양은 백엔드 계약을 따른다:
 *   POST /accounts/login, GET /accounts/me → {user: {id, email, name}, memberships: [{orgId, orgName, kind, memberRole}]}
 */

export type MemberKind = "emitter" | "vendor" | "admin";
export type MemberRole = "owner" | "member";

export type Membership = {
  orgId: string;
  orgName: string;
  kind: MemberKind;
  memberRole: MemberRole;
};

export type AccountUser = { id: string; email: string; name: string };

export const KIND_LABEL: Record<MemberKind, string> = {
  emitter: "배출 기업",
  vendor: "처리 업체",
  admin: "운영",
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: "소유자",
  member: "구성원",
};

const KINDS = new Set<string>(["emitter", "vendor", "admin"]);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** 멤버십 하나. 모양이 틀리면 null(그 항목만 버린다). */
export function parseMembership(raw: unknown): Membership | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const orgId = text(item.orgId);
  const kind = text(item.kind);
  if (!orgId || !KINDS.has(kind)) return null;
  return {
    orgId,
    orgName: text(item.orgName) || orgId,
    kind: kind as MemberKind,
    memberRole: item.memberRole === "owner" ? "owner" : "member",
  };
}

export function parseMemberships(raw: unknown): Membership[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: Membership[] = [];
  for (const item of raw) {
    const parsed = parseMembership(item);
    if (parsed && !seen.has(parsed.orgId)) {
      seen.add(parsed.orgId);
      list.push(parsed);
    }
  }
  return list;
}

/** 로그인·내 정보 응답. user.id가 없으면 null이다. */
export function parseAccount(raw: unknown): { user: AccountUser; memberships: Membership[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const user = body.user && typeof body.user === "object" ? (body.user as Record<string, unknown>) : null;
  const id = text(user?.id);
  if (!user || !id) return null;
  const email = text(user.email);
  return {
    user: { id, email, name: text(user.name) || email || "사용자" },
    memberships: parseMemberships(body.memberships),
  };
}

/** 세션의 활성 회사. 바라는 회사가 소속 목록에 있으면 그것, 없으면 첫 번째 소속, 소속이 없으면 null. */
export function pickActiveOrg(memberships: Membership[], preferred?: string | null): string | null {
  if (preferred && memberships.some((item) => item.orgId === preferred)) return preferred;
  return memberships[0]?.orgId ?? null;
}

/**
 * 외부에서 받은 callbackUrl은 경로와 쿼리만 남긴다. 호스트를 버리므로 다른 사이트로 보낼 수 없다(오픈 리다이렉트 방지).
 * Auth.js는 절대 주소(http://host/path)로 넘기므로 절대·상대 둘 다 받는다.
 */
export function safeRedirect(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    const url = new URL(value, "http://placeholder.invalid");
    const path = `${url.pathname}${url.search}`;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/") ? path : fallback;
  } catch {
    return fallback;
  }
}

/** 로그인 실패를 화면 문구의 종류로 가른다. 아이디와 비밀번호 가운데 무엇이 틀렸는지는 알려 주지 않는다. */
export type LoginFailure = "invalid" | "rate_limited" | "unavailable";

export function loginFailure(status: number): LoginFailure {
  if (status === 401 || status === 403 || status === 404 || status === 422) return "invalid";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

export const LOGIN_MESSAGE: Record<LoginFailure, string> = {
  invalid: "이메일 또는 비밀번호가 맞지 않습니다.",
  rate_limited: "로그인 시도가 많았습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: "지금은 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
};

/** 가입 실패 문구 */
export function signupMessage(status: number, code: string | null): string {
  if (status === 409 || code === "EMAIL_TAKEN") return "이미 가입한 이메일입니다. 로그인해 주세요.";
  if (status === 429) return "가입 시도가 많았습니다. 잠시 후 다시 시도해 주세요.";
  if (status === 400 || status === 422) return "이메일 형식과 비밀번호(8자 이상)를 확인해 주세요.";
  return "지금은 가입할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

/** 초대 수락 실패 문구 */
export function inviteMessage(status: number, code: string | null): string {
  if (status === 410 || status === 404 || code === "INVITE_INVALID") {
    return "초대 링크가 만료되었거나 이미 사용되었습니다. 초대한 분께 새 링크를 요청해 주세요.";
  }
  if (status === 401) return "로그인이 필요합니다. 다시 로그인해 주세요.";
  return "지금은 초대를 수락할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

/** GET /invites/{token}: 초대한 회사와 유효한지(수락 전에 보인다) */
export type InviteInfo = { orgName: string | null; kind: MemberKind | null; expiresAt: string | null; valid: boolean };

/** 초대 정보 응답을 읽는다. 모양이 틀리면 null(화면은 정보 없이 수락 단추만 둔다) */
export function parseInviteInfo(raw: unknown): InviteInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const kind = text(item.kind);
  return {
    orgName: text(item.orgName) || null,
    kind: KINDS.has(kind) ? (kind as MemberKind) : null,
    expiresAt: text(item.expiresAt) || null,
    valid: item.valid !== false,
  };
}

/**
 * 초대 정보를 읽지 못했을 때. 410(또는 초대가 없거나 끝났다는 코드)이면 쓸 수 없는 초대이고, 그 밖(서버 오류, 이 주소를 모르는
 * 서버)은 알 수 없으므로 수락 단추를 그대로 둔다.
 */
export function inviteLookupFailure(status: number, code: string | null): "invalid" | "unknown" {
  if (status === 410) return "invalid";
  if (code && /^INVITE_(INVALID|EXPIRED|USED|REVOKED|NOT_FOUND)$/.test(code)) return "invalid";
  return "unknown";
}

const kstExpiry = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** 유효 기한: 지났는지와 "11월 25일 오후 6:00까지"(한국 시각). 읽을 수 없으면 text는 null */
export function inviteExpiry(expiresAt: string | null, now: Date): { expired: boolean; text: string | null } {
  if (!expiresAt) return { expired: false, text: null };
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return { expired: false, text: null };
  return { expired: at.getTime() <= now.getTime(), text: `${kstExpiry.format(at)}까지` };
}

/** 붙여 넣은 초대 링크나 코드에서 토큰만 뽑는다. 토큰으로 쓸 수 없는 글자가 있으면 null. */
export function inviteTokenFrom(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/\/invite\/([^/?#\s]+)/);
  let token = raw;
  if (match) {
    try {
      token = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9_-]{6,200}$/.test(token) ? token : null;
}

/** 초대 링크: ${AUTH_URL}/invite/${token} */
export function inviteLink(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
}
