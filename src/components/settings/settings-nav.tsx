"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "회사 정보" },
  { href: "/settings/members", label: "구성원" },
  { href: "/settings/account", label: "계정" },
] as const;

export function SettingsNavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-11 items-center px-3 text-sm whitespace-nowrap text-ink-2 transition-colors hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-ink aria-[current=page]:after:content-['']"
            >
              {tab.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SettingsNav() {
  return <SettingsNavList pathname={usePathname()} />;
}
