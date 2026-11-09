"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "업로드" },
  { href: "/session", label: "세션" },
  { href: "/dashboard", label: "대시보드" },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-15 items-center px-2 text-sm whitespace-nowrap sm:px-3 text-muted transition-colors hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 sm:aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-[-1px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-ink aria-[current=page]:after:content-['']"
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** 현재 경로를 강조한다. 동적 세그먼트에서는 Suspense 안에서 렌더링해야 한다. */
export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}
