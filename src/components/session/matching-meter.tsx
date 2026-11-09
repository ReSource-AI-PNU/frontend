import { formatNumber } from "@/lib/format";

/**
 * 최소 수거 물량 대비 막대. 내 회사 단독과 묶음 합계를 같은 눈금에 놓고 최소 물량 선을 긋는다.
 * 묶음 합계는 AI가 고른 그룹이므로 형광펜, 단독은 중립색(muted)이다. 값은 막대 옆에 직접 적는다.
 */
export function MatchingMeter({ selfKg, totalKg, minKg }: { selfKg: number; totalKg: number; minKg: number }) {
  // 막대 끝 값 라벨이 들어갈 자리를 남긴다
  const max = Math.max(totalKg, minKg, selfKg) * 1.3;
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const rows = [
    { key: "self", label: "내 회사 단독", kg: selfKg, bar: "bg-muted" },
    { key: "group", label: "묶음 합계", kg: totalKg, bar: "bg-marker shadow-[inset_0_0_0_1px_var(--color-ink)]" },
  ];
  return (
    <figure className="grid gap-2">
      <div
        role="img"
        aria-label={`최소 수거 물량 ${formatNumber(minKg)}kg 대비 내 회사 단독 ${formatNumber(selfKg)}kg, 묶음 합계 ${formatNumber(totalKg)}kg`}
        className="relative grid gap-3 py-5"
      >
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
            <span className="text-[13px] text-ink-2">{r.label}</span>
            <div className="relative h-5">
              <div className={`h-full rounded-r-[4px] ${r.bar}`} style={{ width: pct(r.kg) }} />
              <span className="num absolute top-1/2 -translate-y-1/2 pl-2 text-[13px] font-semibold" style={{ left: pct(r.kg) }}>
                {formatNumber(r.kg)}
              </span>
            </div>
          </div>
        ))}
        {/* 최소 물량 선: 라벨 열(88px) + 간격(12px) 뒤의 막대 영역 기준 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-[100px]">
          <div className="absolute inset-y-0 border-l border-ink" style={{ left: pct(minKg) }}>
            <span className="absolute -top-0.5 right-1.5 text-[12px] whitespace-nowrap text-ink tabular-nums">
              최소 {formatNumber(minKg)}kg
            </span>
          </div>
        </div>
      </div>
      <figcaption className="text-[12.5px] text-muted">
        단위는 kg/월입니다. 내 회사는 최소 물량의 {Math.round((selfKg / minKg) * 100)}%이고, 묶음 합계는 {Math.round((totalKg / minKg) * 100)}%입니다.
      </figcaption>
    </figure>
  );
}
