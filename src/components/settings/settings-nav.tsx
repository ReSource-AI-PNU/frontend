"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "회사 정보" },
  { href: "/settings/members", label: "멤버" },
  { href: "/settings/account", label: "계정" },
] as const;

export function SettingsNavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto border-b border-line lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-11 items-center px-3 text-sm whitespace-nowrap text-muted transition-colors hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink max-lg:aria-[current=page]:after:absolute max-lg:aria-[current=page]:after:inset-x-3 max-lg:aria-[current=page]:after:-bottom-px max-lg:aria-[current=page]:after:h-0.5 max-lg:aria-[current=page]:after:bg-ink max-lg:aria-[current=page]:after:content-[''] lg:rounded-md lg:hover:bg-sunken lg:aria-[current=page]:bg-surface lg:aria-[current=page]:shadow-[inset_3px_0_0_var(--color-ink)]"
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
