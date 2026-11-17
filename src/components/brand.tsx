import Link from "next/link";

/** 서비스 표지. 오른쪽 아래 노란 점은 공장 통로의 안전선에서 가져왔다. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-brand text-[12px] font-extrabold tracking-[-0.04em] text-on-brand after:absolute after:-right-[3px] after:-bottom-[3px] after:size-2 after:rounded-[2px] after:border-2 after:border-bg after:bg-lane after:content-[''] ${className}`}
    >
      R:
    </span>
  );
}

export function BrandLink({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2.5 font-bold tracking-[-0.02em] whitespace-nowrap ${className}`}
    >
      <BrandMark />
      Re:Source AI
    </Link>
  );
}
