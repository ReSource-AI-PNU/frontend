import { WASTE_ITEMS, type Company, type WasteItem } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { Badge } from "../ui/badge";

/** 처리업체 1회 방문 최소 물량 (가정값). pipeline.ts·complex-explorer.tsx와 같은 값이다. */
const MIN_PICKUP_KG = 2000;

export type AiBundle = {
  sessionId: string;
  item: WasteItem;
  detail: string;
  totalKg: number;
  members: { name: string; kg: number }[];
  schedule: string;
  done: boolean;
};

function kgOf(c: Company, item: WasteItem) {
  return c.wasteStreams.filter((w) => w.item === item).reduce((s, w) => s + w.monthlyKg, 0);
}

/**
 * 단지 내 수거 가능한 묶음(읽기 전용, 이슈 fe#11).
 * 위: AI가 이 업체를 수거 업체로 골라 승인까지 된 묶음(형광펜 = AI 표시).
 * 아래: 허가 품목별로 단지 배출 기업의 월 물량을 합친 잠재 묶음.
 */
export function BundleBoard({ vendor, companies, aiBundles }: { vendor: Company; companies: Company[]; aiBundles: AiBundle[] }) {
  const permits = WASTE_ITEMS.filter((i) => vendor.permits?.includes(i));
  const emitters = companies.filter((c) => c.role === "배출");
  const pools = permits.map((item) => {
    const members = emitters.map((c) => ({ c, kg: kgOf(c, item) })).filter((x) => x.kg > 0).sort((a, b) => b.kg - a.kg);
    return { item, members, total: members.reduce((s, x) => s + x.kg, 0) };
  });

  return (
    <section aria-labelledby="bundles" className="grid gap-5 border-t border-line pt-8">
      <div>
        <h2 id="bundles" className="text-h2">
          단지 내 수거 가능한 묶음
        </h2>
        <p className="text-[13px] text-muted">
          읽기 전용입니다. 1회 방문 최소 물량은 월 <span className="tabular-nums">{formatNumber(MIN_PICKUP_KG)}</span>kg(가정값)으로 봅니다.
        </p>
      </div>

      {aiBundles.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-label text-muted">AI가 이 업체로 묶은 그룹</h3>
          <ul className="divide-y divide-line border-y border-line">
            {aiBundles.map((b) => (
              <li key={b.sessionId} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="ai">AI 묶음</Badge>
                    <span className="font-semibold">
                      {b.item} · {b.detail}
                    </span>
                    <span className="text-muted">{b.schedule}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {b.members.map((m) => `${m.name} ${formatNumber(m.kg)}kg`).join(" · ")}
                  </p>
                </div>
                <p className="text-sm md:text-right">
                  <span className="num font-semibold">{formatNumber(b.totalKg)}</span> kg/월 · {b.done ? "수거 완료" : "수거 대기"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pools.length === 0 ? (
        <p className="text-sm text-muted">이 업체의 허가 품목이 등록되어 있지 않습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="mb-2 text-left text-label text-muted">허가 품목별 잠재 묶음</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">품목</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">배출 기업 (곳)</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">월 합계 (kg)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">최소 물량 대비</th>
                <th scope="col" className="py-2 font-semibold">물량이 큰 기업</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => {
                const ratio = Math.min(1, p.total / MIN_PICKUP_KG);
                const ok = p.total >= MIN_PICKUP_KG;
                return (
                  <tr key={p.item} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-3 pr-3 text-left font-semibold">
                      {p.item}
                    </th>
                    <td className="num py-3 pr-3 text-right">{p.members.length}</td>
                    <td className="num py-3 pr-3 text-right font-semibold">{formatNumber(p.total)}</td>
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                          <span className="block h-full bg-ink-2" style={{ width: `${ratio * 100}%` }} />
                        </span>
                        <span className="text-[13px]">{ok ? "1회 수거 가능" : "물량 부족"}</span>
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-ink-2">
                      {p.members
                        .slice(0, 3)
                        .map((x) => `${x.c.name} ${formatNumber(x.kg)}kg`)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-muted">기업과 물량은 시연용 가상 데이터입니다.</p>
    </section>
  );
}
