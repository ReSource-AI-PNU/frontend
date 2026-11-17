import type { ReactNode } from "react";

/**
 * 요약 먼저, 자세한 내용은 "상세 보기"로 펼친다(DESIGN.md 컴포넌트 규칙 "상세 보기").
 * 숫자·결론·해야 할 일은 이 부품 밖에 두고, 표·조문 요지·계산 가정·설명 문단만 안에 넣는다.
 * 브라우저 기본 <details>라 자바스크립트 없이 열리고, 키보드와 화면 낭독기에서도 그대로 동작한다.
 * hint: 접혀 있을 때 버튼 옆에 붙는 짧은 정보량 표시(예: "근거 5개").
 */
export function MoreDetails({
  children,
  label = "상세 보기",
  closeLabel = "간단히 보기",
  hint,
  defaultOpen = false,
  className = "",
}: {
  children: ReactNode;
  label?: string;
  closeLabel?: string;
  hint?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen || undefined} className={`group/more ${className}`}>
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[13.5px] [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-ink-2 group-hover/more:text-ink">
          <span className="group-open/more:hidden">{label}</span>
          <span className="hidden group-open/more:inline">{closeLabel}</span>
        </span>
        {hint ? <span className="text-muted group-open/more:hidden">{hint}</span> : null}
        <svg
          viewBox="0 0 16 16"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-muted transition-transform duration-150 group-open/more:rotate-180 motion-reduce:transition-none"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}
