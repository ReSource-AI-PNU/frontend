import Link from "next/link";
import { Suspense } from "react";
import { BrandLink, BrandMark } from "./brand";
import { NavLinks, NavList } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { ButtonLink } from "./ui/button";
import { UserMenu } from "./user-menu";

function HeaderFrame({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex h-15 items-center gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">{children}</div>
    </header>
  );
}

/** 로그인 후 앱 화면 */
export function AppHeader() {
  return (
    <HeaderFrame>
      <BrandLink href="/app" />
      <nav aria-label="주 메뉴" className="mr-auto overflow-x-auto">
        <Suspense fallback={<NavList pathname={null} />}>
          <NavLinks />
        </Suspense>
      </nav>
      <ThemeToggle />
      <Suspense fallback={<span className="size-9 rounded-full bg-sunken" aria-hidden="true" />}>
        <UserMenu />
      </Suspense>
    </HeaderFrame>
  );
}

/** 로그인 전 소개 화면 */
export function MarketingHeader() {
  return (
    <HeaderFrame>
      <BrandLink />
      <nav aria-label="소개 메뉴" className="mr-auto hidden items-center gap-1 text-sm text-muted md:flex">
        <Link href="/#problem" className="rounded-md px-3 py-2 hover:text-ink">
          왜 필요한가
        </Link>
        <Link href="/#streams" className="rounded-md px-3 py-2 hover:text-ink">
          시연 공장
        </Link>
        <Link href="/#how" className="rounded-md px-3 py-2 hover:text-ink">
          진단 절차
        </Link>
        <Link href="/#loop" className="rounded-md px-3 py-2 hover:text-ink">
          현장 지식
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <ThemeToggle />
        <ButtonLink href="/login" variant="ghost" size="sm">
          로그인
        </ButtonLink>
        <ButtonLink href="/signup" variant="secondary" size="sm">
          시작하기
        </ButtonLink>
      </div>
    </HeaderFrame>
  );
}

/** 로그인·가입·온보딩처럼 한 가지 일에 집중하는 화면 */
export function FocusHeader() {
  return (
    <HeaderFrame>
      <BrandLink />
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </HeaderFrame>
  );
}

export { BrandLink, BrandMark };
