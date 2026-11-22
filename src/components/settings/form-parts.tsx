import type { ReactNode } from "react";

/** 설정 화면의 입력 칸. 회사 등록 화면과 같은 모양이다(높이 48px, 틀리면 빨간 테두리). */
export const inputClass =
  "min-h-12 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-muted aria-invalid:border-loss disabled:bg-sunken disabled:text-muted";

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  return message ? (
    <p id={id} role="alert" className="mt-1.5 text-[13px] text-loss">
      {message}
    </p>
  ) : null;
}

/** 저장 결과 한 줄. 실패는 빨간 글씨, 나머지는 보조 글씨다. */
export function FormNote({ tone = "muted", children }: { tone?: "muted" | "error"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-sm ${tone === "error" ? "text-loss" : "text-muted"}`}>
      {children}
    </p>
  );
}

/**
 * 되돌리기 어려운 행동의 확인 상자(DESIGN.md "승인 게이트"). 먹색 1px 테두리 상자 안에 대상과 확인 항목을 나열하고,
 * 실행 단추는 이 상자 안에만 둔다.
 */
export function ApprovalGate({
  title,
  items,
  children,
  className = "",
}: {
  title: ReactNode;
  items: ReactNode[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label="확인" className={`grid gap-3 rounded-lg border border-ink bg-surface p-4 sm:p-5 ${className}`}>
      <p className="font-semibold">{title}</p>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-ink-2 marker:text-muted">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}
