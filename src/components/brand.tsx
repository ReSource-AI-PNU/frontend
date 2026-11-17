import Link from "next/link";

/** 서비스 표지 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-brand text-[12px] font-bold tracking-[-0.04em] text-on-brand ${className}`}
    >
      R:
    </span>
  );
}

export function BrandLink({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap ${className}`}
    >
      <BrandMark />
      Re:Source AI
    </Link>
  );
}
