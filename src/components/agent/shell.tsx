"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLink } from "@/components/brand";
import {
  CloseIcon,
  FolderIcon,
  GearIcon,
  HomeIcon,
  InboxIcon,
  MenuIcon,
  PlusIcon,
  ReportIcon,
  SearchIcon,
  StampIcon,
  TalkIcon,
} from "@/components/icons";
import { InstallHint } from "@/components/pwa/install-hint";
import { Button, ButtonLink } from "@/components/ui/button";
import { useEscape } from "@/components/use-escape";
import { useV3 } from "@/components/v3/context";
import { KIND_LABEL } from "@/lib/auth/account";

// 지금 화면은 옅은 파랑 바탕에 파랑 글자다
const row =
  "rs-press flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14.5px] text-ink-2 hover:bg-sunken hover:text-ink";

type NavItem = { href: string; label: string; icon: typeof SearchIcon; exact: boolean };

/** 회사의 종류에 따라 왼쪽 메뉴가 달라진다. 처리 업체는 받은 문의·대화·승인·업체 정보다. */
function navItems(role: "emitter" | "vendor" | "admin", base: string, demo: boolean): NavItem[] {
  // 홈(할 일)과 거래(진행 단계, 두 AI의 대화, 서류)가 먼저다. 찾기는 새 거래를 여는 곳이다
  if (role === "vendor") {
    return [
      { href: base, label: "홈", icon: HomeIcon, exact: true },
      { href: `${base}/deals`, label: "거래", icon: TalkIcon, exact: false },
      ...(demo ? [] : [{ href: `${base}/inquiries`, label: "받은 문의", icon: InboxIcon, exact: false }]),
      { href: `${base}/approval`, label: "승인·서류", icon: StampIcon, exact: false },
      { href: `${base}/materials`, label: "업체 정보", icon: FolderIcon, exact: false },
    ];
  }
  return [
    { href: base, label: "홈", icon: HomeIcon, exact: true },
    ...(role === "emitter" ? [{ href: `${base}/deals`, label: "거래", icon: TalkIcon, exact: false }] : []),
    { href: `${base}/find`, label: "찾기", icon: SearchIcon, exact: false },
    { href: `${base}/approval`, label: "승인·서류", icon: StampIcon, exact: false },
    ...(role === "emitter" ? [{ href: `${base}/materials`, label: "자료", icon: FolderIcon, exact: false }] : []),
    // 원청·고객사에 낼 재활용·탄소 실적(2026-11-19 배출 사업장 설문)
    ...(role === "emitter" ? [{ href: `${base}/report`, label: "실적", icon: ReportIcon, exact: false }] : []),
    ...(role === "admin" && !demo ? [{ href: `${base}/admin`, label: "운영", icon: GearIcon, exact: false }] : []),
  ];
}

/** 사이드바 아래의 지금 회사. 소속이 둘 이상이면 바꿀 수 있고, 회사를 더 등록할 수도 있다. */
function CompanySwitcher() {
  const { org, memberships, setOrgId, switching } = useV3();
  return (
    <div className="px-2.5 pb-1">
      {memberships.length > 1 ? (
        <label className="block">
          <span className="block text-[12px] text-muted">회사</span>
          <select
            value={org.id}
            disabled={switching}
            onChange={(event) => setOrgId(event.target.value)}
            className="mt-0.5 min-h-11 w-full min-w-0 cursor-pointer truncate rounded-md bg-transparent text-[14px] font-medium text-ink hover:text-ink-2"
          >
            {memberships.map((item) => (
              <option key={item.orgId} value={item.orgId}>
                {item.orgName} · {KIND_LABEL[item.kind]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="min-w-0">
          <span className="block truncate text-[14px] font-medium">{org.name}</span>
          <span className="block text-[12px] text-muted">{KIND_LABEL[org.role]}</span>
        </p>
      )}
      <Link
        href="/onboarding"
        className="-ml-1 mt-1 flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[13px] text-muted hover:text-ink"
      >
        <PlusIcon className="size-3.5" />
        회사 추가
      </Link>
    </div>
  );
}

/** 체험하기 사이드바 아래: 지금 보는 시연 회사와 가입 단추 */
function DemoFooter() {
  const { org } = useV3();
  return (
    <div className="space-y-3 px-2.5 pb-2">
      <p className="min-w-0">
        <span className="block truncate text-[14px] font-medium">{org.name}</span>
        <span className="block text-[12px] text-muted">{KIND_LABEL[org.role]}</span>
      </p>
      <ButtonLink href="/signup" className="w-full">
        가입하고 시작하기
      </ButtonLink>
      <Link href="/login" className="flex min-h-11 items-center justify-center text-[13px] text-ink-2 hover:text-ink">
        로그인
      </Link>
    </div>
  );
}

/** 서버에 닿지 못했을 때 본문 대신 보이는 화면 */
function Offline() {
  const { reconnect } = useV3();
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">잠시 연결이 원활하지 않습니다</h1>
      <p className="mt-2 text-[15px] text-ink-2">잠시 후 다시 시도해 주세요. 입력해 둔 내용은 서버에 남아 있습니다.</p>
      <Button variant="secondary" className="mt-6" onClick={reconnect}>
        다시 시도
      </Button>
    </div>
  );
}

/**
 * 로그인한 뒤(또는 체험하기)의 틀. 왼쪽에는 화면 몇 개, 맨 아래에 지금 회사와 계정을 둔다.
 * 본문은 가운데 한 줄 폭으로 그린다. 좁은 화면에서는 사이드바가 서랍이 된다.
 * notice는 본문 위에 한 번 보이는 안내다(회사에서 나왔거나 빠졌을 때).
 */
export function AgentShell({ account, notice, simulation, children }: {
  account?: ReactNode;
  notice?: ReactNode;
  simulation?: boolean;
  children: ReactNode;
}) {
  const { mode, org, readOnly, basePath } = useV3();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));

  const items = navItems(org.role, basePath, readOnly);
  const active = (href: string, exact: boolean) => pathname === href || (!exact && pathname.startsWith(`${href}/`));
  // 설정 화면은 서버가 그리므로 연결 상태와 상관없이 보인다
  const offline = mode === "offline" && (pathname === basePath || pathname.startsWith(`${basePath}/`));

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto px-2.5 py-3">
      <div className="flex h-10 items-center justify-between px-2">
        <BrandLink href={readOnly ? "/" : "/app"} />
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="grid size-11 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink lg:hidden"
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
                  className={`${row} aria-[current=page]:bg-accent-bg aria-[current=page]:font-semibold aria-[current=page]:text-ink`}
                >
                  <item.icon className={current ? "text-accent" : "text-muted"} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto pt-4">
        <Link
          href="/trust"
          onClick={() => setOpen(false)}
          className="mb-2 flex min-h-11 items-center rounded-md px-2.5 text-[13px] text-muted hover:text-ink"
        >
          AI 신뢰도 · 공개 평가 결과
        </Link>
        {readOnly ? (
          <DemoFooter />
        ) : (
          <>
            <CompanySwitcher />
            <div className="mt-1 border-t border-line pt-2">{account}</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-bg" data-active-org={org.id}>
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-ground lg:block print:!hidden">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[86vw] bg-ground shadow-[0_0_60px_rgb(0_0_0/0.25)]">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-13 items-center gap-1 bg-bg px-2 lg:hidden print:!hidden">
          <button
            type="button"
            aria-label="메뉴 열기"
            className="grid size-11 place-items-center rounded-lg hover:bg-sunken"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </button>
          <BrandLink href={readOnly ? "/" : "/app"} />
          <span className="ml-auto min-w-0 truncate px-2 text-[13px] text-muted">{org.name}</span>
        </div>
        {readOnly ? (
          <p
            role="note"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-ground px-5 py-2.5 text-sm text-ink-2"
          >
            <span>
              <span className="font-medium text-ink">체험 중</span> · 둘러보기 전용입니다.
            </span>
            <Link href="/signup" className="-my-2.5 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
              가입하기
            </Link>
          </p>
        ) : null}
        {simulation ? (
          <p role="note" className="bg-ground px-5 py-2.5 text-sm text-ink-2">
            <span className="font-medium text-ink">협상 테스트</span> · 예시 폐기물을 등록하고 가상 업체의 견적을 비교하세요.
          </p>
        ) : null}
        {readOnly ? null : notice}
        {readOnly ? null : <InstallHint />}
        <main className="flex min-w-0 flex-1 flex-col">{offline ? <Offline /> : children}</main>
      </div>
    </div>
  );
}
