import {
  FolderIcon,
  GearIcon,
  HomeIcon,
  ReportIcon,
  SearchIcon,
  StampIcon,
  TalkIcon,
} from "@/components/icons";

export type Role = "emitter" | "vendor" | "admin";

/**
 * 둘째 칸(소메뉴)의 줄 하나. 누르면 다른 주소(화면)를 연다.
 * under에 있는 주소 아래의 화면(예: 폐기물 하나, 업체 하나의 승인)도 이 줄에 속한다.
 */
export type PageLink = { href: string; label: string; under?: string[] };
export type PageGroup = { label: string; links: PageLink[] };

/** 첫째 칸(아이콘 줄)의 갈래 하나. 소메뉴의 주소 가운데 하나에 있으면 이 갈래가 지금 갈래다 */
export type Section = {
  key: string;
  label: string;
  icon: typeof SearchIcon;
  href: string;
  groups: PageGroup[];
};

/** 찾기 한 건의 화면들. 찾기 갈래(배출 기업·운영자)와 업체의 거래 갈래가 함께 쓴다 */
export type FindPart = "main" | "details" | "talk" | "approve" | "documents" | "trace";

export const FIND_PARTS: { part: FindPart; path: string; label: string; emitterOnly?: boolean }[] = [
  { part: "main", path: "", label: "진행·결과" },
  { part: "details", path: "/details", label: "자세한 내용", emitterOnly: true },
  { part: "talk", path: "/talk", label: "AI끼리 나눈 대화" },
  { part: "approve", path: "/approve", label: "승인" },
  { part: "documents", path: "/documents", label: "서류" },
  { part: "trace", path: "/trace", label: "판단 표·근거" },
];

/** 찾기 화면 주소에서 어느 화면인지 읽는다(/app/find/talk → talk) */
export function findPartOf(pathname: string, base: string): FindPart {
  const rest = pathname.startsWith(`${base}/find`) ? pathname.slice(`${base}/find`.length) : "";
  return FIND_PARTS.find((item) => item.path === rest)?.part ?? "main";
}

export function findHref(base: string, part: FindPart): string {
  return `${base}/find${FIND_PARTS.find((item) => item.part === part)?.path ?? ""}`;
}

/** 승인 화면: 업체(대화) 하나의 승인 */
export const approvalHref = (base: string, threadId: string) => `${base}/approval/vendors/${encodeURIComponent(threadId)}`;
/** 자료 화면: 폐기물 하나 */
export const streamHref = (base: string, streamId: string) => `${base}/materials/streams/${encodeURIComponent(streamId)}`;

const link = (href: string, label: string, under?: string[]): PageLink => (under ? { href, label, under } : { href, label });

function findLinks(base: string, emitter: boolean): PageLink[] {
  return FIND_PARTS.filter((item) => emitter || !item.emitterOnly).map((item) => link(`${base}/find${item.path}`, item.label));
}

/**
 * 회사의 종류에 따라 갈래와 소메뉴가 달라진다. 홈(할 일)과 거래(진행 단계, 두 AI의 대화, 서류)가 먼저이고, 찾기는 새 거래를 여는 곳이다.
 * 처리 업체는 받은 문의·단가와 문의 한 건의 화면이 거래 갈래에 들어간다. 운영자는 운영이 더해진다.
 * 체험하기(demo)에는 쓰기만 하는 화면(받은 문의, 단가·사전 문의, AI 도우미)이 없다.
 */
export function navSections(role: Role, base: string, demo: boolean): Section[] {
  const home: Section = {
    key: "home",
    label: "홈",
    icon: HomeIcon,
    href: base,
    groups: [
      { label: "오늘", links: [link(base, "할 일"), link(`${base}/active-deals`, "진행 중인 거래")] },
      { label: "기록", links: [link(`${base}/activity`, "최근 바뀐 것"), link(`${base}/documents`, "서류 모음")] },
    ],
  };
  const approval: Section = {
    key: "approval",
    label: "승인·서류",
    icon: StampIcon,
    href: `${base}/approval`,
    groups: [
      {
        label: "승인",
        links: [link(`${base}/approval`, "업체별 승인", [`${base}/approval/vendors`]), link(`${base}/approval/unmatched`, "조건이 맞지 않은 곳")],
      },
      { label: "서류", links: [link(`${base}/approval/documents`, "요청서 · 이행 계획서 · 계약서")] },
    ],
  };
  const deals = (role: "emitter" | "vendor"): Section => {
    const groups: PageGroup[] = [
      {
        label: "거래",
        links: [link(`${base}/deals`, "모든 거래"), ...(role === "vendor" && !demo ? [link(`${base}/inquiries`, "받은 문의")] : [])],
      },
    ];
    // 업체는 찾기 갈래가 없다. 받은 문의 한 건의 화면(대화, 승인, 서류)을 거래 갈래에서 연다
    if (role === "vendor") groups.push({ label: "이번 문의", links: findLinks(base, false) });
    if (!demo) {
      groups.push({
        label: "단가·사전 문의",
        links:
          role === "vendor"
            ? [
                link(`${base}/conditions`, "공개할 매입 조건"),
                link(`${base}/conditions/quotes`, "거래별 단가 확인"),
                link(`${base}/conditions/photos`, "수거 전 확인 사진"),
              ]
            : [
                link(`${base}/conditions`, "범위 단가를 공개한 업체"),
                link(`${base}/conditions/weights`, "계량 기록으로 물량 채우기"),
                link(`${base}/conditions/quotes`, "거래별 단가 확인"),
                link(`${base}/conditions/photos`, "수거 전 확인 사진"),
              ],
      });
    }
    return { key: "deals", label: "거래", icon: TalkIcon, href: `${base}/deals`, groups };
  };
  if (role === "vendor") {
    return [
      home,
      deals("vendor"),
      approval,
      {
        key: "materials",
        label: "업체 정보",
        icon: FolderIcon,
        href: `${base}/materials`,
        groups: [
          {
            label: "업체 정보",
            links: [
              link(`${base}/materials`, "허가 품목"),
              link(`${base}/materials/criteria`, "매입 기준표"),
              link(`${base}/materials/scope`, "AI가 지킬 범위"),
              link(`${base}/materials/fleet`, "노선·차량"),
            ],
          },
          ...(demo ? [] : [{ label: "도우미", links: [link(`${base}/materials/assistant`, "AI 도우미로 등록")] }]),
          { label: "기록", links: [link(`${base}/materials/memory`, "거래한 배출 기업 기록")] },
        ],
      },
    ];
  }
  const find: Section = {
    key: "find",
    label: "찾기",
    icon: SearchIcon,
    href: `${base}/find`,
    groups: [{ label: "이번 찾기", links: findLinks(base, true) }],
  };
  if (role === "admin") {
    return [home, find, approval, ...(demo ? [] : [{ key: "admin", label: "운영", icon: GearIcon, href: `${base}/admin`, groups: [] }])];
  }
  return [
    home,
    deals("emitter"),
    find,
    approval,
    {
      key: "materials",
      label: "자료",
      icon: FolderIcon,
      href: `${base}/materials`,
      groups: [
        { label: "폐기물", links: [link(`${base}/materials`, "폐기물 목록", [`${base}/materials/streams`])] },
        { label: "보관장", links: [link(`${base}/materials/scan`, "3D 스캔")] },
        { label: "기록", links: [link(`${base}/materials/memory`, "우리 회사 기록")] },
      ],
    },
    // 원청·고객사에 낼 재활용·탄소 실적(2026-11-19 배출 사업장 설문)
    {
      key: "report",
      label: "실적",
      icon: ReportIcon,
      href: `${base}/report`,
      groups: [
        {
          label: "재활용 실적",
          links: [
            link(`${base}/report`, "요약"),
            link(`${base}/report/inspections`, "검수 기록"),
            link(`${base}/report/plan`, "확정한 합의 · 한 달 예상"),
          ],
        },
      ],
    },
  ];
}

/** 갈래에 들지 않는 설정 화면의 둘째 칸 */
export const SETTINGS: Section = {
  key: "settings",
  label: "설정",
  icon: GearIcon,
  href: "/settings",
  groups: [
    {
      label: "설정",
      links: [link("/settings", "회사 정보"), link("/settings/members", "구성원"), link("/settings/account", "계정")],
    },
  ],
};

const under = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

/** 소메뉴 줄이 지금 주소를 가리키는지. 같은 주소면 page, 그 아래 화면(상세)이면 true */
export function linkCurrent(pathname: string, item: PageLink): "page" | "true" | undefined {
  if (pathname === item.href) return "page";
  return item.under?.some((path) => under(pathname, path)) ? "true" : undefined;
}

/** 지금 주소가 속한 갈래 */
export function currentSection(sections: Section[], pathname: string): Section | null {
  const all = [...sections, SETTINGS];
  return (
    all.find((section) => section.groups.some((group) => group.links.some((item) => linkCurrent(pathname, item)))) ??
    // 소메뉴에 없는 화면(운영처럼 소메뉴가 없는 갈래)은 갈래 첫 주소 아래인지로 본다. 홈은 첫 주소 하나만 본다
    all.find((section) => section.key !== "home" && under(pathname, section.href)) ??
    null
  );
}

/**
 * 예전에는 소메뉴가 같은 화면 안의 구역(#구역)으로 내려갔다. 그 주소(즐겨찾기, 보낸 링크)로 들어오면 구역의 새 주소로 넘긴다.
 * 넘길 곳이 없으면 null(그 화면에 그대로 둔다).
 */
export function legacyHashTarget(pathname: string, hash: string, base: string): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return null;
  const fixed: Record<string, Record<string, string>> = {
    [base]: {
      tasks: base,
      "active-deals": `${base}/active-deals`,
      records: `${base}/activity`,
    },
    [`${base}/find`]: {
      result: `${base}/find`,
      "result-more": `${base}/find/details`,
      talk: `${base}/find/talk`,
      approve: `${base}/find/approve`,
      "find-documents": `${base}/find/documents`,
      trace: `${base}/find/trace`,
    },
    [`${base}/approval`]: {
      unmatched: `${base}/approval/unmatched`,
      documents: `${base}/approval/documents`,
    },
    [`${base}/report`]: {
      summary: `${base}/report`,
      inspections: `${base}/report/inspections`,
      plan: `${base}/report/plan`,
    },
    [`${base}/materials`]: {
      permits: `${base}/materials`,
      criteria: `${base}/materials/criteria`,
      scope: `${base}/materials/scope`,
      fleet: `${base}/materials/fleet`,
      assistant: `${base}/materials/assistant`,
      memory: `${base}/materials/memory`,
      scan: `${base}/materials/scan`,
    },
    [`${base}/conditions`]: {
      "public-terms": `${base}/conditions`,
      "range-vendors": `${base}/conditions`,
      "weigh-csv": `${base}/conditions/weights`,
      quotes: `${base}/conditions/quotes`,
      "pickup-photos": `${base}/conditions/photos`,
    },
  };
  const target = fixed[pathname]?.[id];
  if (target) return target;
  if (pathname === `${base}/approval` && id.startsWith("approve-")) return approvalHref(base, id.slice("approve-".length));
  if (pathname === `${base}/materials` && id.startsWith("stream-")) return streamHref(base, id.slice("stream-".length));
  return null;
}
