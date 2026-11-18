"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Membership } from "@/lib/auth/account";
import { checkDue, ORG_NOTICE_COOKIE, sameMemberships } from "@/lib/auth/membership-sync";
import { syncMemberships } from "@/lib/server/company-actions";

/**
 * 세션 쿠키의 소속을 백엔드와 맞춘다(src/lib/auth/membership-sync.ts). 화면을 그릴 때 서버가 백엔드에서 다시 읽고
 * (src/lib/server/workspace.ts), 여기서는 그 뒤의 일을 한다.
 */

function openApp() {
  window.location.assign(new URL("/app", window.location.origin).href);
}

/** 이 창에서 마지막으로 소속을 읽은 때. 화면을 그릴 때 서버가 읽었으므로 처음 띄운 때로 둔다 */
let lastCheck = 0;

/** 이 창이 그린 소속이 바뀌었다고 같은 브라우저의 다른 창에 알린다(localStorage의 storage 이벤트) */
const CHANGED_SIGNAL = "rsai-memberships-changed";

/**
 * 로그인한 화면에 늘 둔다(아무것도 그리지 않는다).
 *  - persist: 서버가 그릴 때 쿠키가 낡은 것을 알았다(다른 사람이 회사 이름을 바꿨다 등). 바로 쿠키를 고친다.
 *  - 화면을 옮기거나 창으로 돌아오면 MEMBERSHIP_CHECK_MS마다 다시 읽는다. 사이드바는 레이아웃이라 화면을 옮겨도 서버가 다시
 *    그리지 않으므로, 보이는 소속이 낡았으면 화면을 다시 그리고, 보던 회사에서 빠졌으면 찾기 화면을 새로 연다.
 *  - 이 창에서 소속이 바뀌면(회사 이름을 고쳤다 등) 같은 브라우저의 다른 창에 알리고, 알림을 받은 창은 간격을 기다리지 않고
 *    다음 화면 이동이나 창으로 돌아올 때 바로 다시 읽는다.
 */
export function MembershipWatch({ memberships, persist }: { memberships: Membership[]; persist: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(memberships);
  const busy = useRef(false);

  useEffect(() => {
    const before = shown.current;
    shown.current = memberships;
    if (before === memberships || sameMemberships(before, memberships)) return;
    try {
      window.localStorage.setItem(CHANGED_SIGNAL, String(Date.now()));
    } catch {
      // 저장소를 쓸 수 없으면 다른 창은 간격대로 다시 읽는다
    }
  }, [memberships]);

  const check = useCallback(
    async (force: boolean) => {
      const now = Date.now();
      if (busy.current || (!force && !checkDue(lastCheck, now))) return;
      busy.current = true;
      lastCheck = now;
      try {
        const result = await syncMemberships(shown.current);
        if (result === "gone") openApp();
        else if (result === "changed") router.refresh();
      } catch {
        // 닿지 못하면 다음에 다시 본다
      } finally {
        busy.current = false;
      }
    },
    [router],
  );

  useEffect(() => {
    lastCheck = Date.now();
    if (persist) void check(true);
  }, [persist, check]);

  useEffect(() => {
    void check(false);
  }, [pathname, check]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    const onSignal = (event: StorageEvent) => {
      if (event.key === CHANGED_SIGNAL) lastCheck = 0;
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("storage", onSignal);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("storage", onSignal);
    };
  }, [check]);

  return null;
}

const RESYNC_AT = "rsai-membership-resync";
/** 방금 세션을 고치고 다시 열었는데 또 여기로 오면 되풀이하지 않는다(백엔드가 잠시 답하지 않을 때) */
const RESYNC_GAP_MS = 15_000;

function resyncedRecently(): boolean {
  try {
    return Date.now() - Number(window.sessionStorage.getItem(RESYNC_AT) ?? 0) < RESYNC_GAP_MS;
  } catch {
    return false;
  }
}

function markResync(value: number | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(RESYNC_AT);
    else window.sessionStorage.setItem(RESYNC_AT, String(value));
  } catch {
    // 저장소를 쓸 수 없으면 되풀이 막기 없이 간다
  }
}

/**
 * 세션의 회사로는 API를 부를 수 없을 때(그 회사에서 빠졌다) 화면 대신 그린다. 회사 화면을 그리지 않으므로 브라우저가 403을
 * 받는 요청을 보내지 않는다. 세션을 고치고(안내를 적어 둔다) 찾기 화면을 새로 연다. 남은 회사가 없으면 회사 등록으로 간다.
 */
export function MembershipResync() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let alive = true;
    if (resyncedRecently()) {
      const timer = window.setTimeout(() => setStuck(true), 0);
      return () => window.clearTimeout(timer);
    }
    void syncMemberships()
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        markResync(Date.now());
        openApp();
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!stuck) return <PageSkeleton />;
  return (
    <div role="status" className="flex min-h-dvh flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">잠시 연결이 원활하지 않습니다</h1>
      <p className="mt-2 text-[15px] text-ink-2">소속 회사를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <Button
        variant="secondary"
        className="mt-6"
        onClick={() => {
          markResync(null);
          openApp();
        }}
      >
        다시 시도
      </Button>
    </div>
  );
}

/**
 * 회사에서 나왔거나 빠졌다는 안내(한 번만). 서버가 쿠키에서 읽어 넘기고, 여기서 보인 뒤 쿠키를 지운다.
 * 다른 화면으로 옮기거나 닫으면 사라진다.
 */
export function OrgNoticeBanner({ text, inline = false }: { text: string; inline?: boolean }) {
  const pathname = usePathname();
  const [at] = useState(pathname);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    document.cookie = `${ORG_NOTICE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }, []);

  if (closed || pathname !== at) return null;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 text-sm text-ink-2 ${inline ? "rounded-lg bg-sunken pl-4 pr-1" : "border-b border-line bg-ground px-5 py-1"}`}
    >
      <p className="min-w-0 flex-1 py-2.5">{text}</p>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={() => setClosed(true)}
        className={`grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-ink ${inline ? "" : "-mr-2 hover:bg-sunken"}`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
