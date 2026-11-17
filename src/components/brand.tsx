import Link from "next/link";

/**
 * 서비스 표지. 끊긴 고리를 두 점이 잇는 모양이다: 고리는 다시 도는 자원, 두 점은 공장 쪽과 업체 쪽의 두 AI이자
 * "Re:"의 쌍점이다. 고리는 글자색을 따르고, 두 점만 신호 주황(공장 설비의 주황)을 쓴다.
 */
export function BrandMark({ className = "size-[26px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M25.7 18.42A10 10 0 1 1 13.58 6.3" fill="none" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" />
      <circle cx="20.23" cy="6.94" r="2.6" fill="var(--color-signal)" />
      <circle cx="25.06" cy="11.77" r="2.6" fill="var(--color-signal)" />
    </svg>
  );
}

export function BrandLink({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 text-[16px] font-semibold tracking-[-0.025em] whitespace-nowrap ${className}`}
    >
      <BrandMark />
      Re:Source AI
    </Link>
  );
}
