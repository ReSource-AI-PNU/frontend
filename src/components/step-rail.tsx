import { CheckIcon } from "./icons";
import { SESSION_STEPS, type SessionStepSlug } from "@/lib/steps";

/**
 * 세션 화면의 좌측 단계 메뉴. 현재 단계 번호는 형광펜으로 표시한다.
 * current가 없으면 모든 단계를 대기 상태로 그린다. 단계 이동 링크는 세션 API(be#2)가 생기면 연결한다.
 */
export function StepRail({ current }: { current?: SessionStepSlug }) {
  const currentNo = SESSION_STEPS.find((s) => s.slug === current)?.no ?? 0;

  return (
    <ol className="grid gap-0.5" aria-label="진행 단계">
      {SESSION_STEPS.map((step) => {
        const state = step.no < currentNo ? "done" : step.no === currentNo ? "current" : "todo";
        return (
          <li
            key={step.slug}
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
            className="group grid min-h-10 grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-md px-2 text-sm text-muted data-[state=current]:bg-surface data-[state=current]:font-semibold data-[state=current]:text-ink data-[state=current]:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=done]:text-ink-2"
          >
            <span className="grid size-[22px] place-items-center rounded-full border border-line-strong font-mono text-[12px] group-data-[state=current]:border-ink group-data-[state=current]:bg-marker group-data-[state=current]:text-marker-ink group-data-[state=done]:border-ink group-data-[state=done]:bg-ink group-data-[state=done]:text-on-ink [&_svg]:size-3">
              {state === "done" ? <CheckIcon /> : step.no}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
