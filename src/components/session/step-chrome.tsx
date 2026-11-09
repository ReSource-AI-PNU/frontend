import Link from "next/link";
import type { ReactNode } from "react";
import { goToStep } from "@/lib/server/session-actions";
import { FLOW_STEPS, type FlowStep } from "@/lib/session/types";
import { ArrowRightIcon } from "../icons";
import { buttonClass } from "../ui/button";

/** 단계 화면 머리말. eyebrow에 담당 에이전트를 적는다. */
export function StepHeader({ step, title, description, aside }: { step: FlowStep; title: string; description?: ReactNode; aside?: ReactNode }) {
  const meta = FLOW_STEPS.find((s) => s.slug === step);
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-label text-muted">{meta?.agent} 에이전트</p>
        <h1 className="mt-1 text-h1">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}

/**
 * 단계 화면 하단: 이전 단계 링크 + 다음 단계 1차 버튼(화면당 먹색 버튼 하나).
 * 다음 단계 결과가 없으면 goToStep이 계산한 뒤 이동한다.
 */
export function StepFooter({
  sessionId,
  step,
  nextLabel,
  disabled,
  disabledHint,
  extra,
}: {
  sessionId: string;
  step: FlowStep;
  nextLabel?: string;
  disabled?: boolean;
  disabledHint?: string;
  extra?: ReactNode;
}) {
  const i = FLOW_STEPS.findIndex((s) => s.slug === step);
  const prev = FLOW_STEPS[i - 1];
  const next = FLOW_STEPS[i + 1];
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
      {prev ? (
        <Link href={`/session/${sessionId}/${prev.slug}`} className={buttonClass("ghost")}>
          <span aria-hidden="true">←</span>
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {disabled && disabledHint ? <p className="text-sm text-muted">{disabledHint}</p> : null}
        {extra}
        {next ? (
          <form action={goToStep.bind(null, sessionId, next.slug)}>
            <button type="submit" disabled={disabled} className={buttonClass("primary")}>
              {nextLabel ?? next.label}
              <ArrowRightIcon />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
