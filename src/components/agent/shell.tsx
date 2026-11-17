"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLink } from "@/components/brand";
import { CloseIcon, FolderIcon, GearIcon, MenuIcon, SearchIcon, StampIcon } from "@/components/icons";
import { useV3 } from "@/components/v3/context";

const ROLE_LABEL = { emitter: "배출 기업", vendor: "처리 업체", admin: "운영" } as const;
const ROLE_ORDER = ["emitter", "vendor", "admin"] as const;
const row =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-ink-2 transition-colors hover:bg-sunken hover:text-ink";

/**
 * 로그인한 뒤의 틀. 왼쪽에는 화면 셋, 맨 아래에 시연 회사와 계정만 둔다.
 * 본문은 가운데 한 줄 폭으로 그린다. 좁은 화면에서는 사이드바가 서랍이 된다.
 */
export function AgentShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  const { mode, fixture, reconnect, orgs, org, setOrgId } = useV3();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = [
    { href: "/app", label: "찾기", icon: SearchIcon, exact: true },
    { href: "/app/materials", label: org.role === "vendor" ? "매입 기준·자료" : "자료", icon: FolderIcon, exact: false },
    { href: "/app/approval", label: "승인·서류", icon: StampIcon, exact: false },
    ...(org.role === "admin" ? [{ href: "/app/admin", label: "운영", icon: GearIcon, exact: false }] : []),
  ];
  const active = (href: string, exact: boolean) => pathname === href || (!exact && pathname.startsWith(`${href}/`));

  const sidebar = (
    <div className="flex h-full flex-col px-2.5 py-3">
      <div className="flex h-10 items-center justify-between px-2">
        <BrandLink href="/app" />
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink lg:hidden"
          onClick={() => setOpen(false)}
        >
          <CloseIcon />
        </button>
      </div>

      <nav aria-label="화면" className="mt-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const current = active(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`${row} aria-[current=page]:bg-sunken aria-[current=page]:font-medium aria-[current=page]:text-ink`}
                >
                  <item.icon className="text-muted" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto pt-4">
        <label className="flex min-h-9 items-center gap-2 px-2.5 text-[13px] text-muted">
          <span className="shrink-0">시연 회사</span>
          <select
            value={org.id}
            disabled={mode === "loading"}
            onChange={(event) => setOrgId(event.target.value)}
            className="min-w-0 flex-1 cursor-pointer truncate rounded-md bg-transparent py-1 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            {ROLE_ORDER.map((role) => {
              const group = orgs.filter((item) => item.role === role);
              return group.length > 0 ? (
                <optgroup key={role} label={ROLE_LABEL[role]}>
                  {group.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        {mode !== "live" ? (
          <p className="px-2.5 pb-1 text-[12px] text-muted">{mode === "fixture" ? "서버에 연결되지 않아 예시를 보여 줍니다" : "연결하는 중"}</p>
        ) : null}
        <div className="mt-1 border-t border-line pt-2">{account}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 bg-ground lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[86vw] bg-ground shadow-[0_0_60px_rgb(0_0_0/0.25)]">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-13 items-center gap-1 bg-bg px-2 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 열기"
            className="grid size-10 place-items-center rounded-lg hover:bg-sunken"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </button>
          <BrandLink href="/app" />
        </div>
        {mode === "fixture" && fixture ? (
          <p role="status" className="bg-ground px-5 py-2.5 text-sm text-ink-2">
            서버에 연결하지 못해 {fixture.meta.capturedOn}에 받아 둔 예시를 보여 줍니다. 회사와 숫자는 가상이고, 여기서는
            찾기·답변·승인을 보낼 수 없습니다.{" "}
            <button type="button" className="font-semibold underline underline-offset-4" onClick={reconnect}>
              다시 연결
            </button>
          </p>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
