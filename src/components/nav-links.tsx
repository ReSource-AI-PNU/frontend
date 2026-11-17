"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 설계안 v3 화면. v2 화면(산업단지·이웃 기업, 현장 지식, 학습 콘솔, 걸으며 진단 등)은
// 주소와 코드는 그대로 두고 주 메뉴에서만 뺐다.
const NAV_ITEMS = [
  { href: "/app", label: "찾기", exact: true },
  { href: "/app/materials", label: "자료", exact: false },
  { href: "/app/approval", label: "승인·서류", exact: false },
  { href: "/app/admin", label: "관리자", exact: false },
] as const;

function isActive(pathname: string | null, href: string, exact: boolean) {
  if (!pathname) return false;
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

export function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-15 items-center px-2 text-sm whitespace-nowrap text-muted transition-colors hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-[-1px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-ink aria-[current=page]:after:content-[''] sm:px-3 sm:aria-[current=page]:after:inset-x-3"
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
