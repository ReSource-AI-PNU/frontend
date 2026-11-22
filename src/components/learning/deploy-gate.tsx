"use client";

import { startTransition, useActionState } from "react";
import { deployCandidate } from "@/lib/server/learning-actions";
import { buttonClass } from "../ui/button";

/**
 * 배포 승인 게이트. DESIGN.md 승인 게이트 규칙처럼 먹색 1px 테두리 상자 안에 확인 항목과 버튼을 둔다.
 * 지표가 나아지지 않았으면 버튼이 꺼지고 이유를 보여 준다.
 */
export function DeployGate({
  candidateId,
  candidateVersion,
  productionVersion,
  checks,
  passed,
}: {
  candidateId: string;
  candidateVersion: string;
  productionVersion: string;
  checks: { label: string; ok: boolean }[];
  passed: boolean;
}) {
  const [state, action, pending] = useActionState(deployCandidate.bind(null, candidateId), undefined);
  const done = state && "ok" in state;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 rounded-lg border border-ink bg-surface p-5"
      aria-labelledby="gate-title"
    >
      <div>
        <h3 id="gate-title" className="text-[16px] font-semibold">
          배포 승인 게이트
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          핵심 지표 3개가 모두 운영 모델보다 나아지고, 지연 시간 증가가 10% 이내일 때만 배포할 수 있습니다.
        </p>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-grid size-[18px] shrink-0 place-items-center rounded-full text-[12px] font-bold ${c.ok ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss"}`}
            >
              {c.ok ? "✓" : "×"}
            </span>
            <span>
              <span className="sr-only">{c.ok ? "통과: " : "미통과: "}</span>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-3 border-t border-line pt-3 text-sm">
        <input type="checkbox" name="confirm" disabled={!passed || done} className="size-4 accent-[var(--color-ink)]" />
        <span>
          지표 비교를 확인했고, 운영 모델을 <span className="font-semibold whitespace-nowrap">{productionVersion}</span>에서{" "}
          <span className="font-semibold whitespace-nowrap">{candidateVersion}</span>(으)로 바꿉니다.
        </span>
      </label>
      {state && "error" in state ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="rounded-md bg-gain-bg px-3 py-2 text-sm">
          {state.message} 다음 판정부터 새 모델을 씁니다.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {passed ? "모든 조건을 통과했습니다." : "통과하지 못한 조건이 있어 배포할 수 없습니다. 검수 라벨을 더 모아 다시 학습하세요."}
        </p>
        <button type="submit" disabled={!passed || pending || done} className={buttonClass("primary")}>
          {pending ? "배포하는 중…" : "운영 모델로 배포"}
        </button>
      </div>
    </form>
  );
}
