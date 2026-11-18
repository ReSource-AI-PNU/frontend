import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/server/auth-actions";

function initials(name: string) {
  const text = name.trim();
  return /^[가-힣]/.test(text) ? text.slice(-2) : text.slice(0, 2).toUpperCase();
}

/** 사이드바 맨 아래의 계정. 누르면 설정·화면 모드·로그아웃이 열린다. */
export function Account({ user }: { user: { name: string; email: string | null } }) {
  return (
    <div>
      <button
        type="button"
        popoverTarget="account-menu"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sunken"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-on-ink">
          {initials(user.name)}
        </span>
        <span className="min-w-0 text-[13px] leading-tight">
          <span className="block truncate font-semibold">{user.name}</span>
          {user.email ? <span className="block truncate text-muted">{user.email}</span> : null}
        </span>
      </button>
      <div
        id="account-menu"
        popover="auto"
        className="fixed top-auto right-auto bottom-[68px] left-3 m-0 h-fit w-60 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-surface p-1.5 text-sm text-ink shadow-[0_16px_40px_-16px_rgb(15_21_18/0.35)]"
      >
        <Link href="/settings" className="flex min-h-11 items-center rounded-lg px-2.5 hover:bg-sunken">
          회사 정보·구성원
        </Link>
        <Link href="/settings/account" className="flex min-h-11 items-center rounded-lg px-2.5 hover:bg-sunken">
          내 계정
        </Link>
        <div className="flex min-h-11 items-center justify-between px-2.5">
          <span>화면 모드</span>
          <ThemeToggle />
        </div>
        <form action={signOutAction} className="mt-1 border-t border-line pt-1">
          <button
            type="submit"
            className="flex min-h-10 w-full items-center rounded-lg px-2.5 text-left text-loss hover:bg-sunken"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
