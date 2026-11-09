import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-[26px] place-items-center rounded-md bg-ink font-mono text-xs font-semibold text-on-ink after:absolute after:-right-[3px] after:-bottom-[3px] after:size-2 after:rounded-[2px] after:border-2 after:border-bg after:bg-marker after:content-['']"
    >
      R:
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex h-15 items-center gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-[-0.02em] whitespace-nowrap">
          <BrandMark />
          Re:Source AI
        </Link>
        <nav aria-label="주 메뉴" className="mr-auto">
          <Suspense fallback={<NavList pathname={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
