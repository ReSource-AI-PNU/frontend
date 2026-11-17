import type { ReactNode } from "react";

export type ChipTone = "done" | "warn" | "stop" | "neutral";

const TONES: Record<ChipTone, string> = {
  // 초록은 이익 숫자에만 쓴다(DESIGN.md 색 규칙 3). 긍정 상태는 먹색 채움으로 표시한다.
  done: "bg-ink text-on-ink",
  warn: "bg-warn-bg text-warn",
  stop: "bg-loss-bg text-loss",
  neutral: "bg-sunken text-ink-2",
};

/** 판정·대화·승인 상태 칩. 색만으로 구분하지 않도록 항상 낱말을 함께 쓴다. */
export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[13px] font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
