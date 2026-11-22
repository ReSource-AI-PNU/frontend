import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5l3 3 6-7" strokeWidth={1.8} />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" strokeWidth={1.4} />
      <path d="M8 7.2v3.8M8 5v.1" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 10.5V2.5M4.5 6L8 2.5 11.5 6M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.4} {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.4} {...props}>
      <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 12.75v-9.5M4 7l4-4 4 4" strokeWidth={1.8} />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 4.5h10.5M2.75 8h10.5M2.75 11.5h10.5" />
    </Icon>
  );
}

/** 두 에이전트의 대화 */
export function TalkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 3.5h7a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H6L3.5 11V9h-1a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M12.5 6.5h1a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1h-1v2L10 12H8" />
    </Icon>
  );
}

/** 단가(가격표) */
export function PriceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 3.5a1 1 0 0 1 1-1h4.1a1 1 0 0 1 .7.3l5.2 5.2a1 1 0 0 1 0 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L2.8 8.3a1 1 0 0 1-.3-.7z" />
      <circle cx="5.6" cy="5.6" r="0.9" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25L13.5 13.5" />
    </Icon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.75 4.25a1 1 0 0 1 1-1h3l1.5 1.75h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

export function StampIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.25a2 2 0 0 0-2 2c0 1.5 1 2 1 3.5H4.5a1.5 1.5 0 0 0-1.5 1.5v1.5h10V9.25a1.5 1.5 0 0 0-1.5-1.5H9c0-1.5 1-2 1-3.5a2 2 0 0 0-2-2zM3 13.5h10" />
    </Icon>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.25 1.75h6.5l3 3v9.5h-9.5z" />
      <path d="M5.75 11.75v-2M8 11.75v-4M10.25 11.75v-3" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" />
    </Icon>
  );
}

export function FactoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.75 13.5V7l3.5 2.25V7l3.5 2.25V3.5h3v10zM1 13.5h14" />
    </Icon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 4h7.5v6.5H1.5zM9 6.25h3l2.5 2.25v2H9z" />
      <circle cx="4.5" cy="11.75" r="1.25" />
      <circle cx="11.75" cy="11.75" r="1.25" />
    </Icon>
  );
}

/** 받은 문의 */
export function InboxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 9.25l1.6-5.1a1 1 0 0 1 .95-.65h6.9a1 1 0 0 1 .95.65L14 9.25V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      <path d="M2 9.25h3.25l1 1.5h3.5l1-1.5H14" />
    </Icon>
  );
}

/** 홈 */
export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.25 7.25L8 2.5l5.75 4.75V13a.75.75 0 0 1-.75.75H9.75v-3.5h-3.5v3.5H3a.75.75 0 0 1-.75-.75z" />
    </Icon>
  );
}

/** 서류 */
export function DocIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 1.75h5.5l3 3v9.5h-8.5z" />
      <path d="M6 8h4.5M6 10.5h4.5" />
    </Icon>
  );
}

/** 오른쪽 꺾쇠 */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.25 3.75L10.5 8l-4.25 4.25" />
    </Icon>
  );
}

/** AI 신뢰도(공개 평가 결과) */
export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.75l5.25 2v4c0 3.25-2.25 5.5-5.25 6.5-3-1-5.25-3.25-5.25-6.5v-4z" />
      <path d="M5.75 8l1.6 1.6 2.9-3.1" />
    </Icon>
  );
}
