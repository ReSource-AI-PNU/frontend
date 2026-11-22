"use client";

import { useState, type HTMLAttributes, type ReactNode } from "react";

/**
 * 접어 두는 칸. 닫혀 있을 때는 제목과 한 줄 값만 보이고, 누르면 자세한 내용이 펼쳐진다.
 * 화면마다 중요한 것(숫자·해야 할 일)만 밖에 두고, 설명·표·근거 목록은 이 안에 넣는다.
 * 닫힌 내용은 그리지 않는다(화면 낭독기와 키보드가 지나가지 않게).
 */
export function Fold({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
  className = "",
}: {
  title: string;
  /** 닫혀 있을 때 오른쪽에 보이는 한 줄(숫자나 상태) */
  summary?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`group/fold ${className}`} data-open={open || undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((before) => !before)}
        className="rs-press flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-sunken sm:px-5"
      >
        {icon ? <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 [&_svg]:size-4">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
        {summary ? <span className="shrink-0 text-[13px] text-ink-2 tabular-nums">{summary}</span> : null}
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
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? <div className="px-4 pt-2 pb-6 [animation:rs-unfold_260ms_var(--ease-out)_both] sm:px-5">{children}</div> : null}
    </div>
  );
}

/** 접는 칸 여러 개를 한 묶음으로 */
export function FoldGroup({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; className?: string }) {
  return (
    <div {...rest} className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}
