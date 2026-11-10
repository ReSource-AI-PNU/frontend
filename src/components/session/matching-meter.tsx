"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { formatNumber } from "@/lib/format";

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * 트럭 적재율 막대 (문제 정의 v2: 최소 물량은 품목별 변수, 화면에는 "트럭 적재율"로 보여 준다).
 * 단독일 때와 순회 수거로 묶었을 때를 같은 눈금에 놓는다. 회색 바탕 칸이 트럭 한 대(100%)이고,
 * 먹색 세로선이 트럭 가득, 최소 물량이 다르면 회색 세로선을 하나 더 긋는다.
 * 묶음은 AI가 고른 그룹이므로 형광펜, 단독은 중립색(muted)이다. 값은 막대 옆 열에 직접 적는다.
 * confirmed를 주면 셋째 줄에 참여 동의를 받은 물량을 먹색(사람이 정한 값)으로 그린다.
 * 묶음이 하나씩 차오르는 연출에서는 scaleMax로 눈금을 고정해, 값이 바뀌어도 눈금이 흔들리지 않게 한다.
 * 마우스를 올리거나 포커스 후 방향키를 누르면 툴팁이 뜨고, 같은 값을 "표로 보기"에서도 볼 수 있다.
 */
export function TruckFillMeter({
  soloKg,
  totalKg,
  truckKg,
  minKg,
  soloFillRate,
  fillRate,
  members,
  confirmed,
  scaleMax,
}: {
  soloKg: number;
  totalKg: number;
  truckKg: number;
  minKg: number;
  soloFillRate: number;
  fillRate: number;
  members: number;
  confirmed?: { kg: number; rate: number; members: number };
  scaleMax?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const tipId = useId();
  const minRate = truckKg > 0 ? minKg / truckKg : 1;
  // 눈금 끝: 트럭 한 대·최소 물량·묶음 중 큰 값에 여유를 조금 둔다
  const max = Math.max(1, minRate, fillRate, soloFillRate, scaleMax ?? 0, confirmed?.rate ?? 0) * 1.06;
  const at = (r: number) => `${(Math.min(Math.max(r, 0), max) / max) * 100}%`;
  const tons = (truckKg / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const sameLine = Math.abs(minRate - 1) < 0.001;

  const rows = [
    { key: "solo", label: "단독", sub: "내 회사만", kg: soloKg, rate: soloFillRate, bar: "bg-muted" },
    { key: "bundle", label: `묶음 ${members}개사`, sub: confirmed ? "AI 제안" : "순회 수거", kg: totalKg, rate: fillRate, bar: "bg-marker shadow-[inset_0_0_0_1px_var(--color-ink)]" },
    ...(confirmed ? [{ key: "confirmed", label: `확정 ${confirmed.members}개사`, sub: "참여 동의 기준", kg: confirmed.kg, rate: confirmed.rate, bar: "bg-ink" }] : []),
  ];
  const status = (kg: number) => (kg >= minKg ? "최소 물량 충족" : `최소 물량에 ${formatNumber(minKg - kg)}kg 모자람`);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (["ArrowDown", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.min(rows.length - 1, a + 1)));
    } else if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.max(0, a - 1)));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  return (
    <figure className="grid gap-2">
      <div
        role="img"
        tabIndex={0}
        aria-label={`${tons}톤 트럭 적재율. 단독 ${pct(soloFillRate)}(월 ${formatNumber(soloKg)}kg), 묶음 ${members}개사 ${pct(fillRate)}(월 ${formatNumber(totalKg)}kg)${confirmed ? `, 참여 동의 기준 ${confirmed.members}개사 ${pct(confirmed.rate)}(월 ${formatNumber(confirmed.kg)}kg)` : ""}. 최소 물량은 ${formatNumber(minKg)}kg입니다.`}
        aria-describedby={active !== null ? tipId : undefined}
        onKeyDown={onKey}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setActive((a) => a ?? 0);
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="relative grid gap-2.5 rounded-sm pt-7 pb-1"
      >
        {/* 기준선: 라벨 열(88px) + 간격(12px) 뒤, 값 열(112px) 앞의 막대 영역 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[124px] left-[100px] z-[1]">
          {!sameLine ? (
            <div className="absolute top-5 bottom-0 border-l border-line-strong" style={{ left: at(minRate) }}>
              <span className="absolute -top-5 left-1.5 text-[12px] whitespace-nowrap text-muted">최소 {formatNumber(minKg)}kg</span>
            </div>
          ) : null}
          <div className="absolute top-5 bottom-0 border-l border-ink" style={{ left: at(1) }}>
            <span className="absolute -top-5 right-1.5 text-[12px] whitespace-nowrap text-ink">
              {sameLine ? `${tons}톤 트럭 가득 = 최소 물량` : `${tons}톤 트럭 가득`}
            </span>
          </div>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.key}
            onPointerEnter={() => setActive(i)}
            onPointerMove={() => setActive(i)}
            className={`grid grid-cols-[88px_minmax(0,1fr)_112px] items-center gap-3 transition-opacity duration-150 ${active !== null && active !== i ? "opacity-50" : ""}`}
          >
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-ink">{r.label}</span>
              <span className="block text-[12px] text-muted">{r.sub}</span>
            </span>
            <div className="relative h-6">
              {/* 트럭 한 대 칸 */}
              <div aria-hidden="true" className="absolute inset-y-0 left-0 rounded-r-[4px] bg-sunken" style={{ width: at(1) }} />
              <div
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-700 ease-out motion-reduce:transition-none ${r.bar}`}
                style={{ width: at(r.rate) }}
              />
              {active === i ? (
                <div
                  id={tipId}
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] leading-snug shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]"
                  style={{ left: at(r.rate) }}
                >
                  <p className="num text-[15px] font-semibold text-ink">{pct(r.rate)}</p>
                  <p className="mt-0.5 text-ink-2">
                    {r.label} · 월 {formatNumber(r.kg)}kg
                  </p>
                  <p className={`mt-0.5 text-[12px] ${r.kg >= minKg ? "text-ink-2" : "text-loss"}`}>{status(r.kg)}</p>
                </div>
              ) : null}
            </div>
            <span className="flex items-baseline gap-1.5">
              <span className="num text-[15px] font-semibold">{pct(r.rate)}</span>
              <span className="num text-[12px] text-muted">{formatNumber(r.kg)}kg</span>
            </span>
          </div>
        ))}

      </div>

      <figcaption className="text-[12.5px] text-muted">
        회색 칸이 {tons}톤 트럭 한 대({formatNumber(truckKg)}kg)입니다. 최소 물량 {formatNumber(minKg)}kg은 업체가 한 번 출장할 만한 물량으로, 품목별
        가정값입니다.
        {fillRate > 1 ? ` 묶음 물량은 트럭 ${Math.ceil(fillRate)}대분이라, 업체가 차를 더 보내거나 순회를 나눠 돕니다.` : ""}
      </figcaption>

      <details className="text-[13px]">
        <summary className="w-fit cursor-pointer text-muted underline-offset-4 hover:text-ink hover:underline">표로 보기</summary>
        <table className="mt-2 w-full border-collapse">
          <caption className="sr-only">단독과 묶음의 트럭 적재율</caption>
          <thead>
            <tr className="border-b border-ink text-left text-[12px] text-muted">
              <th scope="col" className="pb-1.5 font-[550]">
                구분
              </th>
              <th scope="col" className="pb-1.5 pl-3 text-right font-[550]">
                월 물량 (kg)
              </th>
              <th scope="col" className="pb-1.5 pl-3 text-right font-[550]">
                적재율 (%)
              </th>
              <th scope="col" className="pb-1.5 pl-3 font-[550]">
                최소 물량 대비
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {r.label}
                </th>
                <td className="num py-1.5 pl-3 text-right">{formatNumber(r.kg)}</td>
                <td className="num py-1.5 pl-3 text-right">{Math.round(r.rate * 100)}</td>
                <td className="py-1.5 pl-3 text-ink-2">{status(r.kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
