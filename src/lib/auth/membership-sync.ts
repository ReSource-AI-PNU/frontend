/**
 * 세션 쿠키에 적어 둔 소속(회사 이름, 역할, 소속 회사)과 백엔드(GET /accounts/me)의 소속을 견준다.
 * 로그인한 뒤 다른 사람이 회사 이름을 바꾸거나, 나를 회사에서 빼거나, 소유자로 정하면 쿠키의 값이 낡는다.
 * 네트워크를 부르지 않으므로 node --test로 검사한다(tests/membership-sync.test.ts).
 *
 * 쓰는 곳:
 *  - src/lib/server/workspace.ts: 화면을 그릴 때 백엔드 값으로 그리고, 보던 회사에서 빠졌으면 API를 부르기 전에 세션부터 고친다.
 *  - src/lib/server/company-actions.ts의 syncMemberships: 세션을 고치고 화면이 다시 그려야 하는지 알려 준다.
 *  - src/components/agent/membership-sync.tsx: 화면 이동이나 창으로 돌아올 때 MEMBERSHIP_CHECK_MS마다 다시 읽는다.
 */
import { parseMemberships, type Membership } from "./account.ts";
import { josa } from "../josa.ts";

/** 화면 이동·창으로 돌아올 때 소속을 다시 읽는 최소 간격 */
export const MEMBERSHIP_CHECK_MS = 30_000;

const keyOf = (item: Membership) => [item.orgId, item.orgName, item.kind, item.memberRole].join("\u0000");

/** 두 소속 목록이 같은지(순서는 보지 않는다). 회사 이름, 하는 일, 역할 가운데 하나라도 다르면 다르다 */
export function sameMemberships(a: Membership[], b: Membership[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(keyOf).sort();
  const right = b.map(keyOf).sort();
  return left.every((key, index) => key === right[index]);
}

export type MembershipCheck = {
  /** 쿠키의 소속이 백엔드와 다르다 */
  changed: boolean;
  /** 보던 회사(activeOrgId)가 백엔드 소속에 없다: 회사에서 빠졌다. 쿠키에 적힌 그 회사(이름을 알리는 데 쓴다) */
  gone: Membership | null;
};

export function checkMemberships(saved: Membership[], fresh: Membership[], activeOrgId: string | null): MembershipCheck {
  const before = saved.find((item) => item.orgId === activeOrgId) ?? null;
  const gone = before && !fresh.some((item) => item.orgId === before.orgId) ? before : null;
  return { changed: !sameMemberships(saved, fresh), gone };
}

/** 화면이 보낸 소속(서버 액션 인자). 믿지 않고 모양만 맞춘다(견주기에만 쓴다) */
export function shownMemberships(raw: unknown): Membership[] | null {
  return Array.isArray(raw) ? parseMemberships(raw) : null;
}

/** 마지막으로 읽은 뒤 MEMBERSHIP_CHECK_MS가 지났는지 */
export function checkDue(lastAt: number, now: number, every = MEMBERSHIP_CHECK_MS): boolean {
  return now - lastAt >= every;
}

// ── 한 번만 보이는 안내 ─────────────────────────────────

/**
 * 회사에서 나왔거나 빠졌을 때 다음 화면에 한 번 보이는 안내. 서버 액션이 짧게 사는 쿠키에 적고, 다음 화면(찾기 또는 회사 등록)이
 * 읽어 보인 뒤 브라우저가 지운다.
 */
export const ORG_NOTICE_COOKIE = "rsai-org-notice";
/** 안내 쿠키가 사는 시간(초). 다음 화면이 뜨기 전에 끝나지 않을 만큼만 */
export const ORG_NOTICE_MAX_AGE = 120;

export type OrgNotice = {
  /** left: 내가 나왔다. removed: 소유자가 뺐다(또는 회사가 지워졌다) */
  kind: "left" | "removed";
  orgName: string;
};

/**
 * 안내 문장. 남은 회사로 옮겨 보이면 그 회사를 덧붙인다.
 *   "(주)미소환경에서 나왔습니다. 지금은 (주)새길자원을 보고 있습니다."
 *   "(주)미소환경의 구성원이 아닙니다. 소유자에게 문의해 주세요."
 */
export function orgNoticeText(notice: OrgNotice, viewing: string | null = null): string {
  const head =
    notice.kind === "left"
      ? `${notice.orgName}에서 나왔습니다.`
      : `${notice.orgName}의 구성원이 아닙니다. 소유자에게 문의해 주세요.`;
  return viewing && viewing !== notice.orgName ? `${head} 지금은 ${josa(viewing, "을/를")} 보고 있습니다.` : head;
}

export function encodeOrgNotice(notice: OrgNotice): string {
  return JSON.stringify({ kind: notice.kind, orgName: notice.orgName.slice(0, 120) });
}

/** 쿠키 값을 읽는다. 모양이 틀리면 null(안내를 보이지 않는다) */
export function parseOrgNotice(raw: unknown): OrgNotice | null {
  if (typeof raw !== "string" || raw.length > 600) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const kind = value?.kind;
    const orgName = typeof value?.orgName === "string" ? value.orgName.trim() : "";
    if ((kind !== "left" && kind !== "removed") || !orgName) return null;
    return { kind, orgName: orgName.slice(0, 120) };
  } catch {
    return null;
  }
}
