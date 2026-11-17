"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLink } from "@/components/brand";
import {
  CloseIcon,
  FolderIcon,
  GearIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  StampIcon,
} from "@/components/icons";
import { useV3 } from "@/components/v3/context";

const ROLE_LABEL = { emitter: "배출 기업", vendor: "처리 업체", admin: "운영" } as const;
const ROLE_ORDER = ["emitter", "vendor", "admin"] as const;

/**
 * 로그인한 뒤의 틀. 왼쪽에는 "새로 찾기"와 화면 셋, 맨 아래에 보는 회사(시연용)와 계정만 둔다.
 * 본문은 가운데 한 줄 폭으로 그린다. 좁은 화면에서는 사이드바가 서랍이 된다.
 */
export function AgentShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  const { mode, fixture, reconnect, orgs, org, setOrgId, setSessionId } = useV3();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = [
    { href: "/app", label: "찾기", icon: SearchIcon, exact: true },
    { href: "/app/materials", label: org.role === "vendor" ? "매입 기준·자료" : "자료", icon: FolderIcon, exact: false },
    { href: "/app/approval", label: "승인·서류", icon: StampIcon, exact: false },
    ...(org.role === "admin" ? [{ href: "/app/admin", label: "운영", icon: GearIcon, exact: false }] : []),
  ];
  const active = (href: string, exact: boolean) => pathname === href || (!exact && pathname.startsWith(`${href}/`));

  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-3 py-3">
      <div className="flex h-11 items-center justify-between px-1.5">
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

      {org.role === "emitter" ? (
        <button
          type="button"
          disabled={mode !== "live"}
          onClick={() => {
            setSessionId(null);
            setOpen(false);
            router.push("/app");
          }}
          className="mt-2 flex min-h-10 items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-muted"
        >
          <PlusIcon />
          새로 찾기
        </button>
      ) : null}

      <nav aria-label="화면" className="mt-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const current = active(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink aria-[current=page]:bg-sunken aria-[current=page]:font-semibold aria-[current=page]:text-ink"
                >
                  <item.icon className="text-muted" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-2 pt-4">
        <label className="block px-1.5 text-[12px] text-muted">
          보는 회사 (시연용)
          <select
            value={org.id}
            disabled={mode === "loading"}
            onChange={(event) => setOrgId(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm font-semibold text-ink"
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
        <p className="flex items-center gap-1.5 px-1.5 text-[12px] text-muted">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${mode === "live" ? "bg-brand" : mode === "fixture" ? "bg-warn" : "bg-line-strong"}`}
          />
          {mode === "live" ? "서버 연결됨" : mode === "fixture" ? "예시 데이터" : "연결하는 중"}
          {org.synthetic ? " · 가상 회사" : ""}
        </p>
        <div className="border-t border-line pt-2">{account}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-line bg-ground lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-[280px] max-w-[84vw] bg-ground shadow-[0_0_60px_-10px_rgb(15_21_18/0.5)]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden">
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
          <p role="status" className="border-b border-line bg-warn-bg px-5 py-2.5 text-sm text-warn">
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
