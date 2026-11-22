"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BrandInitial, BrandLink } from "@/components/brand";
import {
  CloseIcon,
  FolderIcon,
  GearIcon,
  HomeIcon,
  MenuIcon,
  PlusIcon,
  ReportIcon,
  SearchIcon,
  ShieldIcon,
  StampIcon,
  TalkIcon,
} from "@/components/icons";
import { InstallHint } from "@/components/pwa/install-hint";
import { Button, ButtonLink } from "@/components/ui/button";
import { useEscape } from "@/components/use-escape";
import { useV3 } from "@/components/v3/context";
import { KIND_LABEL } from "@/lib/auth/account";

type Role = "emitter" | "vendor" | "admin";

/** 둘째 칸의 화면 이동 줄(같은 갈래의 다른 화면) */
type PageLink = { href: string; label: string };

/** 첫째 칸(아이콘 줄)의 갈래 하나. paths 가운데 하나에 있으면 이 갈래가 지금 갈래다 */
type Section = {
  key: string;
  label: string;
  icon: typeof SearchIcon;
  href: string;
  /** 이 갈래에 속하는 화면 주소. 첫 값은 href와 같고, exact면 그 주소 하나만 본다 */
  paths: string[];
  exact?: boolean;
  /** 둘째 칸 맨 위에 두는 같은 갈래의 화면들(하나뿐이면 두지 않는다) */
  pages?: { group: string; links: PageLink[] };
};

/**
 * 회사의 종류에 따라 갈래가 달라진다. 홈(할 일)과 거래(진행 단계, 두 AI의 대화, 서류)가 먼저이고, 찾기는 새 거래를 여는 곳이다.
 * 처리 업체는 받은 문의·단가가 거래 갈래에 들어간다. 운영자는 운영이 더해진다.
 */
function navSections(role: Role, base: string, demo: boolean): Section[] {
  const home: Section = { key: "home", label: "홈", icon: HomeIcon, href: base, paths: [base], exact: true };
  const approval: Section = { key: "approval", label: "승인·서류", icon: StampIcon, href: `${base}/approval`, paths: [`${base}/approval`] };
  const dealLinks = (extra: PageLink[]): Section => {
    const links = [{ href: `${base}/deals`, label: "모든 거래" }, ...extra];
    return {
      key: "deals",
      label: "거래",
      icon: TalkIcon,
      href: `${base}/deals`,
      paths: links.map((item) => item.href),
      pages: links.length > 1 ? { group: "거래", links } : undefined,
    };
  };
  if (role === "vendor") {
    return [
      home,
      dealLinks(
        demo
          ? []
          : [
              { href: `${base}/inquiries`, label: "받은 문의" },
              { href: `${base}/conditions`, label: "단가·사전 문의" },
            ],
      ),
      approval,
      { key: "materials", label: "업체 정보", icon: FolderIcon, href: `${base}/materials`, paths: [`${base}/materials`] },
    ];
  }
  return [
    home,
    ...(role === "emitter" ? [dealLinks(demo ? [] : [{ href: `${base}/conditions`, label: "단가·사전 문의" }])] : []),
    { key: "find", label: "찾기", icon: SearchIcon, href: `${base}/find`, paths: [`${base}/find`] },
    approval,
    ...(role === "emitter"
      ? [
          { key: "materials", label: "자료", icon: FolderIcon, href: `${base}/materials`, paths: [`${base}/materials`] },
          // 원청·고객사에 낼 재활용·탄소 실적(2026-11-19 배출 사업장 설문)
          { key: "report", label: "실적", icon: ReportIcon, href: `${base}/report`, paths: [`${base}/report`] },
        ]
      : []),
    ...(role === "admin" && !demo ? [{ key: "admin", label: "운영", icon: GearIcon, href: `${base}/admin`, paths: [`${base}/admin`] }] : []),
  ];
}

/** 갈래에 들지 않는 설정 화면의 둘째 칸 */
const SETTINGS: Section = {
  key: "settings",
  label: "설정",
  icon: GearIcon,
  href: "/settings",
  paths: ["/settings"],
  pages: {
    group: "설정",
    links: [
      { href: "/settings", label: "회사 정보" },
      { href: "/settings/members", label: "구성원" },
      { href: "/settings/account", label: "계정" },
    ],
  },
};

const within = (pathname: string, path: string, exact?: boolean) => pathname === path || (!exact && pathname.startsWith(`${path}/`));

/** 화면 안 구역 하나(nav-spot.ts의 이름표를 읽은 것) */
type Spot = { id: string; label: string; group: string; meta: string; hidden: boolean };

/**
 * 지금 본문에 그려진 구역 이름표를 읽는다. 본문이 바뀔 때마다(찾기 결과가 들어오거나 폐기물을 더했을 때) 다시 읽되,
 * 한 프레임에 한 번만 읽고 내용이 같으면 다시 그리지 않는다.
 */
function usePageSpots(main: RefObject<HTMLElement | null>, pathname: string) {
  const [spots, setSpots] = useState<Spot[]>([]);
  useEffect(() => {
    const root = main.current;
    if (!root) return;
    let frame = 0;
    let last = "";
    const read = () => {
      frame = 0;
      const next = Array.from(root.querySelectorAll<HTMLElement>("[data-nav-label][id]")).map((el) => ({
        id: el.id,
        label: el.dataset.navLabel ?? "",
        group: el.dataset.navGroup ?? "이 화면",
        meta: el.dataset.navMeta ?? "",
        hidden: el.hidden,
      }));
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setSpots(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-nav-label", "data-nav-meta", "data-nav-group", "hidden"],
    });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [main, pathname]);
  return spots;
}

/** 화면 맨 위에서 가장 가까이 지나간 구역(둘째 칸에서 지금 보는 구역을 표시한다) */
function useCurrentSpot(spots: Spot[]) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const visible = spots.filter((spot) => !spot.hidden);
    if (visible.length === 0) return;
    let frame = 0;
    const pick = () => {
      frame = 0;
      let found: string | null = null;
      for (const spot of visible) {
        const el = document.getElementById(spot.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 140) found = spot.id;
      }
      // 내려서 맨 아래에 닿으면 마지막 구역이다(짧은 마지막 구역이 위에 닿지 못해도). 내릴 것이 없는 화면은 맨 위 구역이다
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 4;
      if (scrollable && window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        found = visible[visible.length - 1].id;
      }
      setCurrent(found ?? visible[0].id);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [spots]);
  // 보이는 구역이 없으면 표시하지 않는다(지난 화면의 값이 남아 있어도)
  return spots.some((spot) => !spot.hidden && spot.id === current) ? current : null;
}

// 첫째 칸: 아이콘 위, 이름 아래. 지금 갈래는 옅은 파랑 바탕이다
const railItem =
  "rs-press flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-[12px] leading-tight text-ink-2 hover:bg-sunken hover:text-ink";
// 둘째 칸: 이름 한 줄. 지금 보는 줄은 굵게 쓰고 왼쪽에 먹색 막대를 둔다(채움으로 가르지 않는다)
const panelItem =
  "rs-press relative flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] text-ink-2 hover:bg-sunken hover:text-ink aria-[current]:font-semibold aria-[current]:text-ink aria-[current]:before:absolute aria-[current]:before:inset-y-2.5 aria-[current]:before:left-0 aria-[current]:before:w-0.5 aria-[current]:before:rounded-[2px] aria-[current]:before:bg-ink aria-[current]:before:content-['']";

function PanelGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="px-3 pt-2 pb-1 text-[12px] font-medium tracking-[0.01em] text-muted">{label}</p>
      <ul className="space-y-px">{children}</ul>
    </div>
  );
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
 * 로그인한 뒤(또는 체험하기)의 틀. 사이드바는 두 칸이다: 첫째 칸은 갈래(홈 · 거래 · 찾기 · 승인·서류 · 자료 · 실적)의 아이콘 줄,
 * 둘째 칸은 지금 갈래의 소메뉴(같은 갈래의 다른 화면과, 지금 화면에 그려진 구역)다. 맨 아래에 지금 회사와 계정을 둔다.
 * 본문은 가운데 한 줄 폭으로 그린다. 좁은 화면에서는 두 칸이 함께 서랍이 된다.
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
  const mainRef = useRef<HTMLElement>(null);

  const sections = navSections(org.role, basePath, readOnly);
  const inSection = (section: Section) => section.paths.some((path, index) => within(pathname, path, index === 0 && section.exact));
  const current = sections.find(inSection) ?? (within(pathname, "/settings") ? SETTINGS : null);
  const spots = usePageSpots(mainRef, pathname);
  const visibleSpots = spots.filter((spot) => spot.label);
  const currentSpot = useCurrentSpot(visibleSpots);
  // 설정 화면은 서버가 그리므로 연결 상태와 상관없이 보인다
  const offline = mode === "offline" && (pathname === basePath || pathname.startsWith(`${basePath}/`));
  const close = () => setOpen(false);

  // 화면 안 구역을 묶음 이름별로 모은다(처음 나온 순서대로)
  const spotGroups: { label: string; spots: Spot[] }[] = [];
  for (const spot of visibleSpots) {
    const group = spotGroups.find((item) => item.label === spot.group);
    if (group) group.spots.push(spot);
    else spotGroups.push({ label: spot.group, spots: [spot] });
  }

  const rail = (
    <nav aria-label="화면" className="flex h-full w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-bg py-3">
      <Link
        href={readOnly ? "/" : "/app"}
        aria-label="BYPRO 처음으로"
        onClick={close}
        className="mb-3 grid size-10 place-items-center rounded-lg bg-ink text-on-ink"
      >
        <BrandInitial className="h-[15px]" />
      </Link>
      <ul className="flex flex-col items-center gap-1">
        {sections.map((section) => {
          const active = current?.key === section.key;
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                onClick={close}
                className={`${railItem} aria-[current=page]:bg-accent-bg aria-[current=page]:font-semibold aria-[current=page]:text-ink`}
              >
                <section.icon className={`size-[18px] ${active ? "text-accent" : "text-muted"}`} />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/trust" onClick={close} className={`${railItem} mt-auto`}>
        <ShieldIcon className="size-[18px] text-muted" />
        AI 신뢰도
      </Link>
    </nav>
  );

  const panel = (
    <div className="flex h-full w-[220px] min-w-0 flex-col overflow-y-auto px-2.5 py-3">
      <div className="flex min-h-10 items-center justify-between gap-2 px-3">
        <p className="min-w-0 truncate text-[15px] font-bold tracking-[-0.01em]">{current?.label ?? org.name}</p>
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="-mr-2 grid size-11 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink lg:hidden"
          onClick={close}
        >
          <CloseIcon />
        </button>
      </div>

      <nav aria-label={`${current?.label ?? "화면"} 소메뉴`} className="mt-2">
        {current?.pages ? (
          <PanelGroup label={current.pages.group}>
            {current.pages.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={close} className={panelItem}>
                  {link.label}
                </Link>
              </li>
            ))}
          </PanelGroup>
        ) : null}
        {spotGroups.map((group) => (
          <PanelGroup key={group.label} label={group.label}>
            {group.spots.map((spot) => (
              <li key={spot.id}>
                <a
                  href={`#${spot.id}`}
                  aria-current={!spot.hidden && currentSpot === spot.id ? "location" : undefined}
                  onClick={close}
                  className={panelItem}
                >
                  <span className="min-w-0 flex-1 truncate">{spot.label}</span>
                  {spot.meta ? <span className="shrink-0 text-[12px] font-normal text-muted tabular-nums">{spot.meta}</span> : null}
                </a>
              </li>
            ))}
          </PanelGroup>
        ))}
      </nav>

      <div className="mt-auto pt-4">
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

  const sidebar = (
    <div className="flex h-full">
      {rail}
      {panel}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-bg" data-active-org={org.id}>
      <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-ground lg:block print:!hidden">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-ink/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 max-w-[92vw] overflow-x-auto bg-ground shadow-[0_0_60px_rgb(0_0_0/0.25)]">{sidebar}</aside>
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
        <main ref={mainRef} className="flex min-w-0 flex-1 flex-col">
          {offline ? <Offline /> : children}
        </main>
      </div>
    </div>
  );
}
