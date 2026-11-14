import { ArrowRightIcon } from "../icons";

export type LoopStage = { href: string; label: string; value: string; note: string; attention?: boolean };

/** 재학습 루프 한 줄 흐름도. 각 단계는 아래 구역으로 가는 링크이며, 손볼 일이 있는 단계는 굵은 테두리와 "할 일" 문구로 표시한다. */
export function LoopFlow({ stages }: { stages: LoopStage[] }) {
  return (
    <nav aria-label="재학습 루프">
      <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((s, i) => (
          <li key={s.label} className="relative bg-surface">
            <a
              href={s.href}
              className={`flex h-full flex-col gap-1 px-4 py-3 hover:bg-bg ${s.attention ? "shadow-[inset_0_-3px_0_var(--color-ink)]" : ""}`}
            >
              <span className="flex items-center gap-1.5 text-[12px] text-muted">
                <span className="num">{i + 1}</span>
                {s.label}
              </span>
              <span className="text-[15px] font-semibold">{s.value}</span>
              <span className="text-[12px] text-muted">
                {s.attention ? <span className="font-semibold text-ink">할 일 · </span> : null}
                {s.note}
              </span>
            </a>
            {i < stages.length - 1 ? (
              <span aria-hidden="true" className="absolute top-1/2 -right-2 z-10 hidden -translate-y-1/2 rounded-full bg-surface p-0.5 text-muted lg:block [&_svg]:size-3">
                <ArrowRightIcon />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
