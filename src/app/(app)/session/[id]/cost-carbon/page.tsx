import type { Metadata } from "next";
import Link from "next/link";
import { DivergingBars } from "@/components/charts/diverging-bars";
import { CostCarbonTable } from "@/components/session/cost-carbon-table";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, formatSigned } from "@/lib/format";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "비용·탄소 비교" };

/** AI가 짚은 핵심 수치에 긋는 형광펜 밑줄. 글자 뒤를 칠하지 않아 다크 테마에서도 읽힌다 */
const MARK = "underline decoration-marker decoration-[5px] underline-offset-[1px] [text-decoration-skip-ink:none]";

export default async function CostCarbonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const result = session.costCarbon;

  if (!result) {
    return (
      <div className="grid gap-6">
        <StepHeader step="cost-carbon" title="비용·탄소 비교" />
        <EmptyState
          title="아직 경로별 비용과 탄소를 계산하지 않았습니다."
          description="묶음 재활용, 단독 재활용, 현행 유지, 매립의 네 경로를 월 손익과 순 탄소로 비교합니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "cost-carbon")}>
                <button type="submit" className={buttonClass("primary")}>
                  비용·탄소 계산
                </button>
              </form>
              <Link href={`/session/${session.id}/matching`} className={buttonClass("ghost")}>
                묶음 수거 매칭으로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const routes = result.routes;
  const recommended = routes.find((r) => r.recommended) ?? routes[0];
  const current = routes.find((r) => r.id === "C");
  const selectedId = session.selectedRoute ?? recommended.id;
  const diff = current ? recommended.monthlyKrw - current.monthlyKrw : 0;
  const carbonDiff = current ? current.carbonT - recommended.carbonT : 0;
  const locked = Boolean(session.approval);

  const krwData = routes.map((r) => ({ id: r.id, label: `${r.id}. ${r.name}`, value: r.monthlyKrw, note: r.description, emphasis: r.recommended }));
  const co2Data = routes.map((r) => ({ id: r.id, label: `${r.id}. ${r.name}`, value: r.carbonT, note: r.description, emphasis: r.recommended }));
  const krwSummary = `경로별 월 손익. ${routes.map((r) => `${r.id} ${r.name} ${formatSigned(r.monthlyKrw)}원`).join(", ")}.`;
  const co2Summary = `경로별 순 탄소. ${routes.map((r) => `${r.id} ${r.name} ${formatSigned(r.carbonT, 2)}톤`).join(", ")}. 음수는 줄어드는 배출입니다.`;

  return (
    <div>
      <StepHeader
        step="cost-carbon"
        title="비용·탄소 비교"
        description={`처리 경로 ${routes.length}개를 월 손익과 순 탄소로 비교했습니다. 탄소는 ${result.baseline} 기준이며, 숫자는 모두 시연용 가정값입니다.`}
        aside={
          <DisagreeDialog
            step="cost-carbon"
            item={session.classify.item}
            sessionId={session.id}
            placeholder={{ condition: "예: 이 업체는 운송비를 따로 받는다", judgment: "예: 묶음 재활용 손익에서 운송비 월 3만 원을 뺀다" }}
          />
        }
      />

      {current && recommended.id !== current.id ? (
        <p className="mt-5 max-w-3xl text-[17px] leading-relaxed tabular-nums">
          추천 경로 {recommended.id}와 현행 {current.id}의 차이는 <b className={`font-semibold ${MARK}`}>월 {formatNumber(diff)}원</b>,{" "}
          <b className={`font-semibold ${MARK}`}>연 {formatNumber(diff * 12)}원</b>입니다. 탄소는 월 {carbonDiff.toFixed(2)}톤 덜 배출합니다.
        </p>
      ) : null}

      <section aria-labelledby="routes-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="routes-title" className="text-h2">
            경로별 비교
          </h2>
          <p className="text-[13px] text-muted">{locked ? "발송을 마친 세션이라 경로를 바꿀 수 없습니다." : "행을 누르면 다음 단계의 서류 초안이 그 경로로 만들어집니다."}</p>
        </div>
        <CostCarbonTable sessionId={session.id} routes={routes} selectedId={selectedId} disabled={locked} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-8">
        <section aria-labelledby="chart-krw-title">
          <h2 id="chart-krw-title" className="text-label text-muted">
            경로별 월 손익 (원/월)
          </h2>
          <DivergingBars
            className="mt-3"
            data={krwData}
            ariaLabel={krwSummary}
            unit="원/월"
            captions={{ negative: "지출", positive: "수익" }}
          />
        </section>
        <section aria-labelledby="chart-co2-title">
          <h2 id="chart-co2-title" className="text-label text-muted">
            경로별 순 탄소 (tCO₂e/월)
          </h2>
          <DivergingBars
            className="mt-3"
            data={co2Data}
            ariaLabel={co2Summary}
            goodWhen="negative"
            fractionDigits={2}
            unit="tCO₂e/월"
            captions={{ negative: "줄어드는 배출", positive: "늘어나는 배출" }}
          />
        </section>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">두 차트는 위 비교표와 같은 값입니다. 단위가 달라 한 차트에 겹치지 않고 나눠 그렸습니다.</p>

      <section aria-labelledby="assumptions-title" className="mt-10 max-w-3xl">
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
              <td className="py-2.5 text-ink-2">{result.baseline}로 계산했습니다. KAU 환산은 줄인 탄소를 배출권 가격으로 바꾼 참고값입니다.</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[12.5px] text-muted">모든 단가와 계수는 시연용 가정값입니다. 실제 견적과 정산 결과가 들어오면 다시 계산합니다.</p>
      </section>

      <StepFooter sessionId={session.id} step="cost-carbon" nextLabel="최적안 보기" />
    </div>
  );
}
