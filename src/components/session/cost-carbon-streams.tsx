import { formatNumber, formatSigned } from "@/lib/format";
import type { Route, StreamRoute } from "@/lib/session/types";
import { RouteBadge } from "./stream-badges";

const signTone = (v: number) => (v > 0 ? "text-gain font-semibold" : v < 0 ? "text-loss" : "text-ink");

export type StreamBreakdownRow = {
  streamId: string;
  name: string;
  monthlyKg: number;
  route: StreamRoute;
  /** 흐름별 최적안(A)의 월 손익·탄소 */
  krwA: number;
  carbonA: number;
  /** 현행 전부 소각(C)의 월 손익 */
  krwC: number;
};

/**
 * 흐름별 내역 표. 행 = 흐름, 열 = A의 경로 배지·월 손익·탄소, C의 월 손익, 차이(A − C).
 * 공장 전체 차이가 어느 흐름에서 오는지 보이도록 차이 열에 작은 막대를 함께 그린다.
 * 막대는 숫자 옆 보조 표시라 aria-hidden이고, 값은 같은 칸의 숫자로 읽힌다(색만으로 말하지 않는다).
 */
export function CostCarbonStreams({ rows, routeA, routeC }: { rows: StreamBreakdownRow[]; routeA: Route; routeC: Route }) {
  const maxDiff = Math.max(1, ...rows.map((r) => Math.abs(r.krwA - r.krwC)));
  const totalDiff = routeA.monthlyKrw - routeC.monthlyKrw;
  const th = "pb-2 pl-4 text-right font-[550] whitespace-nowrap";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <caption className="sr-only">
          흐름별 내역. 흐름마다 {routeA.id}. {routeA.name}의 경로와 월 손익·순 탄소, {routeC.id}. {routeC.name}의 월 손익, 그리고 둘의 차이
        </caption>
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th scope="col" rowSpan={2} className="pb-2 align-bottom font-[550]">
              흐름
            </th>
            <th scope="colgroup" colSpan={3} className="border-b border-line pb-1.5 pl-4 font-[550] text-ink">
              {routeA.id}. {routeA.name}
            </th>
            <th scope="colgroup" className="border-b border-line pb-1.5 pl-4 text-right font-[550] text-ink">
              {routeC.id}. 현행
            </th>
            <th scope="col" rowSpan={2} className={`${th} align-bottom`}>
              차이 {routeA.id} − {routeC.id} (원/월)
            </th>
          </tr>
          <tr className="border-b border-ink text-left text-[12px] text-muted">
            <th scope="col" className="pt-1.5 pb-2 pl-4 font-[550]">
              경로
            </th>
            <th scope="col" className={`${th} pt-1.5`}>
              월 손익 (원)
            </th>
            <th scope="col" className={`${th} pt-1.5`}>
              순 탄소 (tCO₂e/월)
            </th>
            <th scope="col" className={`${th} pt-1.5`}>
              월 손익 (원)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.krwA - r.krwC;
            return (
              <tr key={r.streamId} className="border-b border-line">
                <th scope="row" className="py-3 text-left font-normal">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="block text-[12.5px] text-muted tabular-nums">월 {formatNumber(r.monthlyKg)}kg</span>
                </th>
                <td className="py-3 pl-4">
                  <RouteBadge route={r.route} size="sm" />
                </td>
                <td className={`num py-3 pl-4 text-right text-[15px] ${signTone(r.krwA)}`}>{formatSigned(r.krwA)}</td>
                <td className="num py-3 pl-4 text-right text-[15px]">{formatSigned(r.carbonA, 2)}</td>
                <td className={`num py-3 pl-4 text-right text-[15px] ${signTone(r.krwC)}`}>{formatSigned(r.krwC)}</td>
                <td className="py-3 pl-4">
                  <span className="flex items-center justify-end gap-2.5">
                    <span aria-hidden="true" className="flex h-2.5 w-16 justify-start">
                      <span
                        className="h-full rounded-r-sm"
                        style={{ width: `${(Math.abs(diff) / maxDiff) * 100}%`, background: diff >= 0 ? "var(--color-chart-gain)" : "var(--color-chart-loss)" }}
                      />
                    </span>
                    <span className={`num min-w-[88px] text-right text-[15px] ${signTone(diff)}`}>{formatSigned(diff)}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <th scope="row" className="py-3 text-left">
              공장 전체
            </th>
            <td className="py-3" />
            <td className={`num py-3 pl-4 text-right text-[15px] ${signTone(routeA.monthlyKrw)}`}>{formatSigned(routeA.monthlyKrw)}</td>
            <td className="num py-3 pl-4 text-right text-[15px]">{formatSigned(routeA.carbonT, 2)}</td>
            <td className={`num py-3 pl-4 text-right text-[15px] ${signTone(routeC.monthlyKrw)}`}>{formatSigned(routeC.monthlyKrw)}</td>
            <td className={`num py-3 pl-4 text-right text-[15px] ${signTone(totalDiff)}`}>{formatSigned(totalDiff)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[12.5px] text-muted">
        공장 전체 줄은 흐름별 값을 그대로 더한 값으로, 위 비교표와 같습니다. 차이 막대는 흐름끼리 크기를 견주는 보조 표시입니다.
      </p>
    </div>
  );
}
