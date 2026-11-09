"use client";

import { useOptimistic, useTransition } from "react";
import { formatSigned } from "@/lib/format";
import { selectRoute } from "@/lib/server/session-actions";
import type { Route } from "@/lib/session/types";

/**
 * 추천안 1개 + 대안 카드. 실제 라디오 input으로 동작한다(키보드 방향키로도 고를 수 있다).
 * AI 추천은 형광펜 배지, 사람이 고른 카드는 먹색 테두리로 표시한다.
 */
export function ProposalRoutes({
  sessionId,
  routes,
  recommendedId,
  selectedId,
  disabled,
}: {
  sessionId: string;
  routes: Route[];
  recommendedId: Route["id"];
  selectedId: Route["id"];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(selectedId);
  const alternatives = routes.filter((r) => r.id !== recommendedId);

  return (
    <fieldset aria-busy={pending} disabled={disabled}>
      <legend className="sr-only">처리 방안 선택. 고른 방안으로 견적 요청서를 보냅니다.</legend>
      <div className="grid gap-3 md:grid-cols-3">
        {routes.map((r) => {
          const isRec = r.id === recommendedId;
          const tag = isRec ? "AI 추천" : `대안 ${alternatives.indexOf(r) + 1}`;
          const selected = r.id === current;
          return (
            <label
              key={r.id}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-surface p-5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                selected ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line hover:border-line-strong"
              } ${disabled ? "cursor-default" : ""}`}
            >
              <input
                type="radio"
                name="proposal-route"
                value={r.id}
                checked={selected}
                onChange={() => {
                  if (r.id === current) return;
                  startTransition(async () => {
                    setCurrent(r.id);
                    await selectRoute(sessionId, r.id);
                  });
                }}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold ${isRec ? "bg-marker text-marker-ink" : "bg-sunken text-ink-2"}`}
                >
                  {tag}
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full border ${selected ? "border-ink bg-ink text-on-ink" : "border-line-strong"}`}
                >
                  {selected ? (
                    <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 6.3l2.3 2.2L9.5 3.5" />
                    </svg>
                  ) : null}
                </span>
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.02em]">
                {r.id}. {r.name}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className={`num text-[26px] leading-none font-semibold tracking-[-0.03em] ${r.monthlyKrw > 0 ? "text-gain" : r.monthlyKrw < 0 ? "text-loss" : ""}`}>
                  {formatSigned(r.monthlyKrw)}
                </span>
                <span className="text-[13px] text-muted">원/월 {r.monthlyKrw >= 0 ? "수익" : "지출"}</span>
              </span>
              <span className="text-[13px] text-ink-2 tabular-nums">탄소 {formatSigned(r.carbonT, 2)} tCO₂e/월</span>
              <span className="border-t border-line pt-2 text-[13px] text-muted">{r.condition === "없음" ? "추가 조건이 없습니다." : r.condition}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
