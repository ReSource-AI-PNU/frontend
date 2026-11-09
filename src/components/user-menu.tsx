import Link from "next/link";
import { findOrganizationByOwner } from "@/lib/server/mock-store";
import { getOptionalUser } from "@/lib/server/session";
import { signOutAction } from "@/lib/server/auth-actions";
import { COMPLEXES } from "@/lib/complexes";

function initials(name: string) {
  const t = name.trim();
  return /^[가-힣]/.test(t) ? t.slice(-2) : t.slice(0, 2).toUpperCase();
}

/** 세션을 읽는다. Suspense 안에서 렌더링한다. */
export async function UserMenu() {
  const user = await getOptionalUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm font-semibold">
        로그인
      </Link>
    );
  }
  const org = await findOrganizationByOwner(user.id);
  const complex = org ? COMPLEXES.find((c) => c.id === org.complexId) : null;

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget="user-menu"
        className="flex h-9 items-center gap-2 rounded-md pr-1 pl-1 text-left transition-colors hover:bg-sunken"
      >
        <span className="grid size-7 place-items-center rounded-full bg-ink text-[11px] font-semibold text-on-ink">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate text-[13px] leading-tight md:block">
          <span className="block truncate font-semibold">{org?.name ?? user.name}</span>
          <span className="block truncate text-muted">{complex?.shortName ?? "회사 정보 미등록"}</span>
        </span>
      </button>
      <div
        id="user-menu"
        popover="auto"
        className="fixed top-[64px] right-4 bottom-auto left-auto m-0 h-fit w-64 rounded-lg border border-line bg-surface p-2 text-sm text-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] sm:right-6 lg:right-8"
      >
        <div className="border-b border-line px-2 pt-1 pb-3">
          <p className="font-semibold">{user.name}</p>
          {user.email ? <p className="truncate text-[13px] text-muted">{user.email}</p> : null}
        </div>
        <ul className="py-1">
          <li>
            <Link href="/onboarding" className="flex min-h-10 items-center rounded-md px-2 hover:bg-sunken">
              회사 정보 수정
            </Link>
          </li>
          {complex ? (
            <li>
              <Link href={`/complex/${complex.id}`} className="flex min-h-10 items-center rounded-md px-2 hover:bg-sunken">
                내 산업단지 보기
              </Link>
            </li>
          ) : null}
        </ul>
        <form action={signOutAction} className="border-t border-line pt-1">
          <button type="submit" className="flex min-h-10 w-full items-center rounded-md px-2 text-left text-loss hover:bg-sunken">
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
