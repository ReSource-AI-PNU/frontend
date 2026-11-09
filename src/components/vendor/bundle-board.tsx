import { WASTE_ITEMS, type Company, type WasteItem } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { Badge } from "../ui/badge";

/** 품목별 업체 출장 기준 물량과 수거 차량 적재량(kg). 값은 서버의 pipeline.ts MIN_KG를 페이지가 넘겨준다 */
export type PickupRule = Record<WasteItem, { minKg: number; truckKg: number }>;

export type AiBundle = {
  key: string;
  sessionId: string;
  streamId: string;
  /** 흐름 이름. 예: 원자재 포장 필름 */
  streamName: string;
  item: WasteItem;
  detail: string;
  mode: string;
  totalKg: number;
  truckKg: number;
  /** 묶음 합계 / 트럭 적재량 */
  fillRate: number;
  members: { name: string; kg: number }[];
  schedule: string;
  done: boolean;
};

function kgOf(c: Company, item: WasteItem) {
  return c.wasteStreams.filter((w) => w.item === item).reduce((s, w) => s + w.monthlyKg, 0);
}

function truckName(kg: number) {
  return `${(kg / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}톤 트럭`;
}

/**
 * 단지 내 수거 가능한 묶음(읽기 전용).
 * 위: AI가 이 업체를 순회 수거 업체로 골라 승인까지 된 묶음(형광펜 = AI 표시). 진단의 matching.bundles 기준.
 * 아래: 허가 품목별로 단지 배출 기업의 월 물량을 합친 잠재 묶음과 트럭 적재율.
 */
export function BundleBoard({ vendor, companies, aiBundles, pickup }: { vendor: Company; companies: Company[]; aiBundles: AiBundle[]; pickup: PickupRule }) {
  const permits = WASTE_ITEMS.filter((i) => vendor.permits?.includes(i));
  const emitters = companies.filter((c) => c.role === "배출");
  const pools = permits.map((item) => {
    const members = emitters.map((c) => ({ c, kg: kgOf(c, item) })).filter((x) => x.kg > 0).sort((a, b) => b.kg - a.kg);
    return { item, members, total: members.reduce((s, x) => s + x.kg, 0) };
  });

  return (
    <section aria-labelledby="bundles" className="grid gap-5 border-t border-line pt-8">
      <div className="max-w-3xl">
        <h2 id="bundles" className="text-h2">
          단지 내 수거 가능한 묶음
        </h2>
        <p className="text-[13px] text-muted">
          읽기 전용입니다. 업체 출장 기준 물량과 트럭 크기는 품목별 가정값입니다. 공개된 업체 기준은 0.1~1톤이고, 폐플라스틱·필름은 기준이 확인되지 않아 1톤 트럭으로 가정했습니다.
        </p>
      </div>

      {aiBundles.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-label text-muted">AI가 이 업체로 묶은 순회 수거</h3>
          <ul className="divide-y divide-line border-y border-line">
            {aiBundles.map((b) => (
              <li key={b.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="ai">AI 묶음</Badge>
                    <span className="font-semibold">
                      {b.streamName} · {b.detail}
                    </span>
                    <span className="text-muted">
                      {b.mode} · {b.schedule}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {b.members.map((m) => `${m.name} ${formatNumber(m.kg)}kg`).join(" · ")}
                  </p>
                </div>
                <p className="text-sm md:text-right">
                  <span className="tabular-nums font-semibold">{formatNumber(b.totalKg)}</span>kg/월 · {truckName(b.truckKg)} 적재율{" "}
                  <span className="tabular-nums font-semibold">{Math.round(b.fillRate * 100)}%</span>
                  <span className="block text-[12px] text-muted">{b.done ? "수거 완료" : "수거 대기"}</span>
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
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="mb-2 text-left text-label text-muted">허가 품목별 잠재 묶음</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">품목</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">배출 기업 (곳)</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">월 합계 (kg)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">트럭 적재율</th>
                <th scope="col" className="py-2 font-semibold">물량이 큰 기업</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => {
                const rule = pickup[p.item];
                const fill = p.total / rule.truckKg;
                const ok = p.total >= rule.minKg;
                return (
                  <tr key={p.item} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-3 pr-3 text-left font-semibold">
                      {p.item}
                    </th>
                    <td className="num py-3 pr-3 text-right">{p.members.length}</td>
                    <td className="num py-3 pr-3 text-right font-semibold">{formatNumber(p.total)}</td>
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                          <span className="block h-full bg-ink-2" style={{ width: `${Math.min(1, fill) * 100}%` }} />
                        </span>
                        <span className="text-[13px] whitespace-nowrap">
                          <span className="tabular-nums font-semibold">{Math.round(fill * 100)}%</span>
                          <span className="text-muted"> · {truckName(rule.truckKg)}</span>
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {ok ? "출장 기준 충족" : `출장 기준 ${formatNumber(rule.minKg)}kg까지 ${formatNumber(rule.minKg - p.total)}kg 부족`}
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
      <p className="text-[12px] text-muted">기업과 물량은 시연용 가상 데이터입니다. 적재율 100%가 넘으면 트럭 여러 대 분량입니다.</p>
    </section>
  );
}
