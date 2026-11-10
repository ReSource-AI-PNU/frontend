import type { Metadata } from "next";
import Link from "next/link";
import { DivergingBars } from "@/components/charts/diverging-bars";
import { CostCarbonStreams, type StreamBreakdownRow } from "@/components/session/cost-carbon-streams";
import { CostCarbonTable } from "@/components/session/cost-carbon-table";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CARBON_BASE_LABEL, rebaseCarbon, type CarbonBase } from "@/lib/carbon";
import { formatNumber, formatSigned } from "@/lib/format";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

export const metadata: Metadata = { title: "비용·탄소 비교" };

/** AI가 짚은 핵심 수치에 긋는 형광펜 밑줄. 글자 뒤를 칠하지 않아 다크 테마에서도 읽힌다 */
const MARK = "underline decoration-marker decoration-[5px] underline-offset-[1px] [text-decoration-skip-ink:none]";

/** 받침에 맞춰 "로/으로"를 붙인다(ㄹ 받침은 "로") */
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}

/** 탄소 기준별 설명. 시나리오끼리의 차이는 기준과 관계없이 같다 */
const BASE_NOTE: Record<CarbonBase, string> = {
  virgin: "재활용·재투입으로 새 수지를 만들지 않아 피한 배출까지 셉니다. 음수면 그만큼 배출을 줄인 것입니다.",
  landfill: "같은 흐름을 모두 매립했을 때(시나리오 D)를 0으로 놓고, 그보다 얼마나 더·덜 배출하는지 봅니다. 시나리오끼리의 차이는 신재 대비와 같습니다.",
};

export default async function CostCarbonPage({ params, searchParams }: PageProps<"/session/[id]/cost-carbon">) {
  const { id } = await params;
  const sp = await searchParams;
  const base: CarbonBase = sp.base === "landfill" ? "landfill" : "virgin";
  const { session } = await getSessionForCurrentOrg(id);
  const result = session.costCarbon;
  const disagree = (
    <DisagreeDialog
      step="cost-carbon"
      item={session.streams[0]?.classify.item ?? "폐플라스틱"}
      sessionId={session.id}
      placeholder={{ condition: "예: 분쇄기를 돌리면 전기료가 월 5만 원 더 든다", judgment: "예: 재투입 손익에서 월 5만 원을 뺀다" }}
    />
  );

  if (!result || result.routes.length === 0) {
    return (
      <div className="grid gap-6">
        <StepHeader step="cost-carbon" title="비용·탄소 비교" aside={disagree} />
        <EmptyState
          title="아직 시나리오별 비용과 탄소를 계산하지 않았습니다."
          description="흐름별 최적안, 묶음 없이 개별 처리, 현행 전부 소각, 전부 매립의 네 시나리오를 공장 월 손익과 순 탄소로 비교하고, 차이가 어느 흐름에서 오는지 나눠 봅니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "cost-carbon")}>
                <button type="submit" className={buttonClass("primary")}>
                  비용·탄소 계산
                </button>
              </form>
              <Link href={`/session/${session.id}/matching`} className={buttonClass("ghost")}>
                업체·묶음 매칭으로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const hasLandfill = result.routes.some((r) => r.id === "D");
  const routes = rebaseCarbon(result.routes, hasLandfill ? base : "virgin");
  const baseLabel = CARBON_BASE_LABEL[hasLandfill ? base : "virgin"];
  const recommended = routes.find((r) => r.recommended) ?? routes[0];
  const routeA = routes.find((r) => r.id === "A") ?? recommended;
  const current = routes.find((r) => r.id === "C");
  const selectedId = session.selectedRoute ?? recommended.id;
  const diff = current ? routeA.monthlyKrw - current.monthlyKrw : 0;
  const carbonDiff = current ? current.carbonT - routeA.carbonT : 0;
  const locked = Boolean(session.approval);

  const krwData = routes.map((r) => ({ id: r.id, label: `${r.id}. ${r.name}`, value: r.monthlyKrw, note: r.description, emphasis: r.recommended }));
  const co2Data = routes.map((r) => ({ id: r.id, label: `${r.id}. ${r.name}`, value: r.carbonT, note: r.description, emphasis: r.recommended }));
  const krwSummary = `시나리오별 공장 월 손익. ${routes.map((r) => `${r.id} ${r.name} ${formatSigned(r.monthlyKrw)}원`).join(", ")}.`;
  const co2Summary = `시나리오별 순 탄소. ${routes.map((r) => `${r.id} ${r.name} ${formatSigned(r.carbonT, 2)}톤`).join(", ")}. 음수는 줄어드는 배출입니다.`;

  // 흐름별 내역: A와 C의 breakdown을 흐름 순서대로 맞춘다
  const nameOf = new Map(session.streams.map((s) => [s.id, s]));
  const cOf = new Map((current?.breakdown ?? []).map((b) => [b.streamId, b]));
  const streamRows: StreamBreakdownRow[] = routeA.breakdown.map((b) => {
    const s = nameOf.get(b.streamId);
    return {
      streamId: b.streamId,
      name: s?.name ?? "흐름",
      monthlyKg: s?.monthlyKg ?? 0,
      route: b.route,
      krwA: b.monthlyKrw,
      carbonA: b.carbonT,
      krwC: cOf.get(b.streamId)?.monthlyKrw ?? 0,
    };
  });
  const top = [...streamRows].sort((a, b) => b.krwA - b.krwC - (a.krwA - a.krwC))[0];
  const topDiff = top ? top.krwA - top.krwC : 0;

  return (
    <div>
      <StepHeader
        step="cost-carbon"
        title="비용·탄소 비교"
        description={`공장의 흐름 ${session.streams.length}개를 합쳐 시나리오 ${routes.length}개를 월 손익과 순 탄소로 비교했습니다. 탄소는 ${baseLabel} 기준이며, 숫자는 모두 시연용 가정값입니다.`}
        aside={disagree}
      />

      {current && routeA.id !== current.id ? (
        <p className="mt-5 max-w-3xl text-[17px] leading-relaxed tabular-nums">
          흐름별 최적안과 현행의 차이는 <b className={`font-semibold ${MARK}`}>월 {formatNumber(diff)}원</b>,{" "}
          <b className={`font-semibold ${MARK}`}>연 {formatNumber(diff * 12)}원</b>입니다. 현행 전부 소각은 월 {formatSigned(current.monthlyKrw)}원,
          흐름별 최적안은 월 {formatSigned(routeA.monthlyKrw)}원이고, 탄소는 월 {carbonDiff.toFixed(2)}톤 덜 배출합니다.
        </p>
      ) : null}

      <section aria-labelledby="routes-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="routes-title" className="text-h2">
            시나리오별 비교
          </h2>
          <p className="text-[13px] text-muted">
            {locked ? "발송을 마친 진단이라 시나리오를 바꿀 수 없습니다." : "행을 누르면 다음 단계의 서류와 발송 대상이 그 시나리오로 바뀝니다."}
          </p>
        </div>
        {hasLandfill ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label="탄소 기준" className="inline-flex rounded-md bg-sunken p-[3px]">
              {(["virgin", "landfill"] as CarbonBase[]).map((b) => (
                <Link
                  key={b}
                  href={b === "virgin" ? `/session/${session.id}/cost-carbon` : `/session/${session.id}/cost-carbon?base=landfill`}
                  scroll={false}
                  aria-current={base === b ? "true" : undefined}
                  className="flex h-8 items-center rounded-sm px-3 text-[13px] text-muted hover:text-ink aria-[current=true]:bg-surface aria-[current=true]:font-semibold aria-[current=true]:text-ink aria-[current=true]:shadow-[0_1px_0_var(--color-line-strong)]"
                >
                  탄소 {CARBON_BASE_LABEL[b]}
                </Link>
              ))}
            </nav>
            <p className="max-w-2xl text-[13px] text-ink-2">{BASE_NOTE[base]}</p>
          </div>
        ) : null}
        <CostCarbonTable sessionId={session.id} routes={routes} selectedId={selectedId} disabled={locked} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-8">
        <section aria-labelledby="chart-krw-title">
          <h2 id="chart-krw-title" className="text-label text-muted">
            시나리오별 공장 월 손익 (원/월)
          </h2>
          <DivergingBars
            className="mt-3"
            data={krwData}
            ariaLabel={krwSummary}
            unit="원/월"
            labelWidth={150}
            captions={{ negative: "지출", positive: "수익" }}
            tableView={{ categoryHeader: "시나리오", valueHeader: "월 손익 (원)" }}
          />
        </section>
        <section aria-labelledby="chart-co2-title">
          <h2 id="chart-co2-title" className="text-label text-muted">
            시나리오별 순 탄소 (tCO₂e/월, {baseLabel})
          </h2>
          <DivergingBars
            className="mt-3"
            data={co2Data}
            ariaLabel={co2Summary}
            goodWhen="negative"
            fractionDigits={2}
            unit="tCO₂e/월"
            labelWidth={150}
            captions={{ negative: "줄어드는 배출", positive: "늘어나는 배출" }}
            tableView={{ categoryHeader: "시나리오", valueHeader: "순 탄소 (tCO₂e/월)" }}
          />
        </section>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">두 차트는 위 비교표와 같은 값입니다. 단위가 달라 한 차트에 겹치지 않고 나눠 그렸습니다.</p>

      {current ? (
        <section aria-labelledby="streams-title" className="mt-12">
          <h2 id="streams-title" className="text-h2">
            흐름별 내역
          </h2>
          <p className="mt-1 mb-4 max-w-3xl text-[15px] text-ink-2 tabular-nums">
            {top && topDiff > 0 ? (
              <>
                차이가 가장 큰 흐름은 <b className="font-semibold text-ink">{top.name}</b>입니다. 현행 소각을 {withRo(STREAM_ROUTE_LABEL[top.route])} 바꾸면 월{" "}
                {formatSigned(topDiff)}원이 달라집니다.
              </>
            ) : (
              "흐름마다 현행 소각과 최적안의 차이를 나눠 보여 줍니다."
            )}
          </p>
          <CostCarbonStreams rows={streamRows} routeA={routeA} routeC={current} />
        </section>
      ) : null}

      <section aria-labelledby="assumptions-title" className="mt-12 max-w-3xl">
        <h2 id="assumptions-title" className="text-h2">
          계산 가정
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <caption className="sr-only">비용과 탄소 계산에 쓴 가정값</caption>
          <tbody>
            {result.assumptions.map((a) => (
              <tr key={a.label} className="border-t border-line">
                <th scope="row" className="w-28 py-2.5 pr-4 text-left align-top font-normal text-muted">
                  {a.label}
                </th>
                <td className="py-2.5 text-ink-2 tabular-nums">{a.value}</td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <th scope="row" className="py-2.5 pr-4 text-left align-top font-normal text-muted">
                탄소 기준
              </th>
              <td className="py-2.5 text-ink-2">
                지금은 {baseLabel} 기준으로 보고 있습니다. {BASE_NOTE[hasLandfill ? base : "virgin"]} KAU 환산은 줄인 탄소를 배출권 가격으로 바꾼 참고값입니다.
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[12.5px] text-muted">모든 단가와 계수는 시연용 가정값입니다. 실제 견적과 정산 결과가 들어오면 다시 계산합니다.</p>
      </section>

      <StepFooter sessionId={session.id} step="cost-carbon" nextLabel="이행안 만들기" />
    </div>
  );
}
