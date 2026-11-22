import { CheckIcon } from "@/components/icons";

/**
 * 진행 단계 막대. 끝난 단계는 파랑 채움에 체크, 지금 단계는 파랑 테두리, 남은 단계는 회색이다.
 * compact는 목록 줄에 넣는 작은 꼴(점과 선만, 이름은 지금 단계만 옆에 적는다).
 */
export function Steps({
  steps,
  done,
  stopped = null,
  compact = false,
  className = "",
}: {
  steps: readonly string[];
  /** 끝난 단계 수. 그 자리의 단계가 지금 단계다 */
  done: number;
  /** 멈춘 까닭(거절 등). 있으면 지금 단계를 빨강으로 보인다 */
  stopped?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const label = stopped ?? (done >= steps.length ? "완료" : `${steps[done]} 단계`);
  if (compact) {
    return (
      <span role="img" aria-label={`진행 ${Math.min(done, steps.length)}/${steps.length} · ${label}`} className={`inline-flex items-center gap-2 ${className}`}>
        <span className="flex items-center" aria-hidden="true">
          {steps.map((step, index) => (
            <span key={step} className="flex items-center">
              {index > 0 ? <span className={`h-0.5 w-3.5 ${index <= done && !stopped ? "bg-accent" : "bg-line-strong"}`} /> : null}
              <span
                className={`size-2 rounded-full ${
                  stopped && index === done ? "bg-loss" : index < done ? "bg-accent" : index === done ? "bg-surface ring-2 ring-accent" : "bg-line-strong"
                }`}
              />
            </span>
          ))}
        </span>
        <span className={`text-[12px] font-medium ${stopped ? "text-loss" : done >= steps.length ? "text-gain" : "text-accent"}`}>{label}</span>
      </span>
    );
  }
  return (
    <ol aria-label={`진행 단계 · ${label}`} className={`flex items-start ${className}`}>
      {steps.map((step, index) => {
        const finished = index < done;
        const current = index === done;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span aria-hidden="true" className={`absolute top-3.5 right-1/2 left-[-50%] h-0.5 ${index <= done && !stopped ? "bg-accent" : "bg-line"}`} />
            ) : null}
            <span
              className={`relative z-[1] grid size-7 place-items-center rounded-full text-[12px] font-semibold tabular-nums [&_svg]:size-3.5 ${
                stopped && current
                  ? "bg-loss text-white"
                  : finished
                    ? "bg-accent text-on-accent"
                    : current
                      ? "border-2 border-accent bg-surface text-accent"
                      : "border border-line-strong bg-surface text-muted"
              }`}
            >
              {finished ? <CheckIcon /> : index + 1}
            </span>
            <span className={`mt-1.5 text-[13px] ${current ? "font-semibold text-ink" : finished ? "text-ink-2" : "text-muted"}`}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
