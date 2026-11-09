import type { ReactNode } from "react";

/**
 * tone: 손익·상태 색. ai는 형광펜이며 AI가 표시한 것에만 쓴다.
 * reuse / recycle / dispose: 판정 3단계 (재사용 · 재활용 · 폐기).
 */
export type BadgeTone =
  | "gain"
  | "loss"
  | "warn"
  | "ai"
  | "neutral"
  | "reuse"
  | "recycle"
  | "dispose";

const tones: Record<BadgeTone, string> = {
  gain: "bg-gain-bg text-gain",
  loss: "bg-loss-bg text-loss",
  warn: "bg-warn-bg text-warn",
  ai: "bg-marker text-marker-ink",
  neutral: "bg-sunken text-ink-2",
  reuse: "bg-gain text-on-ink",
  recycle: "bg-gain-bg text-gain",
  dispose: "bg-loss-bg text-loss",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const verdictLabel = { reuse: "재사용 가능", recycle: "재활용 가능", dispose: "폐기 처리" } as const;

export type Verdict = keyof typeof verdictLabel;

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge tone={verdict}>{verdictLabel[verdict]}</Badge>;
}
