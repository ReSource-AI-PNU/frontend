import { WASTE_ITEMS, type WasteItem } from "@/lib/domain";
import { formatNumber } from "@/lib/format";

/** 품목 범주형 색. 순서 고정: 폐플라스틱·금속 스크랩·폐목재·포장재 (globals.css --color-chart-1~4) */
export const ITEM_COLOR: Record<WasteItem, string> = {
  폐플라스틱: "var(--color-chart-1)",
  "금속 스크랩": "var(--color-chart-2)",
  폐목재: "var(--color-chart-3)",
  포장재: "var(--color-chart-4)",
};

/**
 * 품목별 가로 막대. 모든 막대에 품목 이름과 값을 직접 붙인다
 * (라이트 모드에서 chart-3·4는 대비가 낮아 색만으로 읽히면 안 된다).
 */
export function CategoryBars({
  data,
  unit,
  ariaLabel,
}: {
  data: { item: WasteItem; value: number }[];
  unit: string;
  ariaLabel: string;
}) {
  const rows = WASTE_ITEMS.map((item) => ({ item, value: data.find((d) => d.item === item)?.value ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div role="img" aria-label={ariaLabel}>
      <ul className="grid gap-3" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.item} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3" title={`${r.item} ${formatNumber(r.value)}${unit}`}>
            <span className="text-[13px] text-ink-2">{r.item}</span>
            <span className="flex items-center gap-2">
              <span
                className="h-3.5 rounded-r-[4px]"
                style={{ width: `${(r.value / max) * 82}%`, minWidth: r.value > 0 ? 2 : 0, background: ITEM_COLOR[r.item] }}
              />
              <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">
                {formatNumber(r.value)}
                {unit}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
