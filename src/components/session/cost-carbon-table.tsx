"use client";

import { useOptimistic, useTransition, type MouseEvent } from "react";
import { formatSigned } from "@/lib/format";
import { selectRoute } from "@/lib/server/session-actions";
import type { Route } from "@/lib/session/types";

const signTone = (v: number) => (v > 0 ? "text-gain font-semibold" : v < 0 ? "text-loss" : "text-ink");

/**
 * 경로 A~D 비교표. 금액은 오른쪽 정렬, 단위는 열 제목에 둔다 (DESIGN.md 비교표).
 * AI 추천 행은 형광펜 13% 바탕 + "AI 추천" 표시, 사람이 고른 행은 왼쪽 먹색 3px 막대와 라디오로 표시한다.
 * 행을 누르면 selectRoute로 선택을 저장한다.
 */
export function CostCarbonTable({
  sessionId,
  routes,
  selectedId,
  disabled,
}: {
  sessionId: string;
  routes: Route[];
  selectedId: Route["id"];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(selectedId);

  const choose = (id: Route["id"]) => {
    if (disabled || id === current) return;
    startTransition(async () => {
      setCurrent(id);
      await selectRoute(sessionId, id);
    });
  };
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: Route["id"]) => {
    if ((e.target as HTMLElement).closest("input, label")) return;
    choose(id);
  };

  return (
    <div className="overflow-x-auto" aria-busy={pending}>
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <caption className="sr-only">처리 경로별 월 손익, 순 탄소, KAU 환산, 실행 조건 비교. 행을 고르면 다음 단계의 서류가 그 경로로 만들어집니다.</caption>
        <thead>
          <tr className="border-b border-ink text-left text-[12px] text-muted">
            <th scope="col" className="pb-2.5 pl-3.5 font-[550]">
              처리 경로
            </th>
            <th scope="col" className="pb-2.5 pl-4 text-right font-[550] whitespace-nowrap">
              월 손익 (원)
            </th>
            <th scope="col" className="pb-2.5 pl-4 text-right font-[550] whitespace-nowrap">
              순 탄소 (tCO₂e/월)
            </th>
            <th scope="col" className="pb-2.5 pl-4 text-right font-[550] whitespace-nowrap">
              KAU 환산 (원/월)
            </th>
            <th scope="col" className="pb-2.5 pl-4 font-[550]">
              실행 조건
            </th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => {
            const selected = r.id === current;
            return (
              <tr
                key={r.id}
                onClick={(e) => onRowClick(e, r.id)}
                className={`border-b border-line align-top transition-colors duration-150 ${r.recommended ? "bg-marker/[0.13]" : ""} ${disabled ? "" : "cursor-pointer hover:bg-sunken/70"}`}
              >
                <td className={`py-3.5 pr-2 pl-3.5 ${selected ? "shadow-[inset_3px_0_0_var(--color-ink)]" : ""}`}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="route"
                      value={r.id}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => choose(r.id)}
                      className="mt-1 size-[18px] shrink-0 accent-ink"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="font-semibold">
                          {r.id}. {r.name}
                        </b>
                        {r.recommended ? <span className="rounded-sm bg-marker px-1.5 text-[11.5px] font-semibold text-marker-ink">AI 추천</span> : null}
                        {selected ? <span className="rounded-sm bg-ink px-1.5 text-[11.5px] font-semibold text-on-ink">선택함</span> : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">{r.description}</span>
                    </span>
                  </label>
                </td>
                <td className={`num py-3.5 pl-4 text-right text-[15px] ${signTone(r.monthlyKrw)}`}>{formatSigned(r.monthlyKrw)}</td>
                <td className="num py-3.5 pl-4 text-right text-[15px]">{formatSigned(r.carbonT, 2)}</td>
                <td className={`num py-3.5 pl-4 text-right text-[15px] ${signTone(r.kauKrw)}`}>{formatSigned(r.kauKrw)}</td>
                <td className="py-3.5 pr-3 pl-4 text-[13px] text-ink-2">{r.condition}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[12.5px] text-muted">
        형광펜 바탕은 AI 추천, 왼쪽 먹색 막대는 담당자가 고른 경로입니다. 월 손익의 +는 수익, −는 지출이고, 순 탄소의 −는 줄어드는 배출입니다.
      </p>
    </div>
  );
}
