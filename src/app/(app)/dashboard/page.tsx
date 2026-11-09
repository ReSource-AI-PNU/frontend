import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BarSeries } from "@/components/charts/bar-series";
import { CategoryBars } from "@/components/charts/category-bars";
import { ChartFigure } from "@/components/charts/chart-figure";
import { formatDate, formatMonthDay } from "@/components/dashboard/format-date";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ArrowRightIcon } from "@/components/icons";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { WASTE_ITEMS } from "@/lib/domain";
import { formatNumber, formatSigned } from "@/lib/format";
import { bucketByMonth, buildDemoHistory, sessionsToHistory, type HistoryRecord } from "@/lib/server/mock/history";
import { listSessionsForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "대시보드" };

const won = (n: number) => `${formatSigned(n)}원`;

function SignedCell({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className={value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-2"}>
      <span className="num font-semibold">{formatSigned(value)}</span>
      {suffix}
    </span>
  );
}

function SourceTag({ r }: { r: HistoryRecord }) {
  if (r.demo) return <span className="text-[12px] text-muted">시연용</span>;
  return (
    <Link href={`/session/${r.sessionId}`} className="text-[12px] font-semibold underline underline-offset-4">
      실제 세션
    </Link>
  );
}

async function DashboardPageContent() {
  const { org, sessions } = await listSessionsForCurrentOrg();
  const now = new Date();
  const demo = buildDemoHistory(org, now);
  const real = sessionsToHistory(sessions);
  const records = [...real, ...demo].sort((a, b) => b.date.localeCompare(a.date));
  const months = bucketByMonth(records, now);

  const totalSaving = records.reduce((s, r) => s + r.savingKrw, 0);
  const totalCarbon = Math.round(records.reduce((s, r) => s + r.carbonSavedT, 0) * 100) / 100;
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const rejected = records.filter((r) => r.accepted === false).length;

  const priced = records.filter((r) => r.predictedPerKg !== null && r.actualPerKg !== null);
  const judged = records.filter((r) => r.accepted !== null);
  const meanAbsErr = priced.length ? Math.round(priced.reduce((s, r) => s + Math.abs(r.actualPerKg! - r.predictedPerKg!), 0) / priced.length) : null;
  const meanBias = priced.length ? Math.round(priced.reduce((s, r) => s + (r.actualPerKg! - r.predictedPerKg!), 0) / priced.length) : null;
  const meanPct = priced.length
    ? Math.round((priced.reduce((s, r) => s + Math.abs(r.actualPerKg! - r.predictedPerKg!) / Math.max(1, Math.abs(r.predictedPerKg!)), 0) / priced.length) * 1000) / 10
    : null;
  const agreement = judged.length ? Math.round((judged.filter((r) => r.accepted).length / judged.length) * 100) : null;

  const byItem = WASTE_ITEMS.map((item) => ({ item, value: records.filter((r) => r.item === item).reduce((s, r) => s + r.kg, 0) }));
  const recentPriced = records.filter((r) => r.predictedPerKg !== null && r.accepted !== null).slice(0, 6);
  const realCount = real.length;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1">대시보드</h1>
          <p className="mt-1 text-sm text-muted">
            {org.name}의 최근 7개월 처리 이력입니다. 현행처럼 혼합 소각했을 때와 비교해 줄인 비용과 탄소를 누적합니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone="neutral">시연용 이력 포함</Badge>
          <p className="text-right text-[12px] text-muted">
            지난 6개월은 시연용 이력이고, 실제 세션 {realCount}건을 합쳤습니다.
          </p>
        </div>
      </header>

      <KpiRow
        hero={{
          label: "누적 절감 비용",
          value: formatSigned(totalSaving),
          unit: "원",
          tone: totalSaving > 0 ? "gain" : totalSaving < 0 ? "loss" : "ink",
          delta: (
            <>
              이번 달 <span className="font-semibold tabular-nums">{won(thisMonth.savingKrw)}</span> · 지난달{" "}
              <span className="font-semibold tabular-nums">{won(lastMonth.savingKrw)}</span>
            </>
          ),
        }}
        items={[
          {
            label: "누적 절감 탄소",
            value: totalCarbon.toFixed(2),
            unit: "tCO₂e",
            delta: `이번 달 ${thisMonth.carbonSavedT.toFixed(2)} t 감축`,
          },
          {
            label: "처리 건수",
            value: formatNumber(records.length),
            unit: "건",
            delta: `매입 거절 ${rejected}건 포함`,
          },
          {
            label: "단가 예측 오차 (평균)",
            value: meanAbsErr === null ? "—" : `±${formatNumber(meanAbsErr)}`,
            unit: meanAbsErr === null ? undefined : "원/kg",
            delta: meanPct === null ? "실제 결과가 쌓이면 계산합니다." : `예상 단가 대비 ${meanPct}% · ${priced.length}건 기준`,
          },
        ]}
      />

      <section aria-labelledby="monthly" className="grid gap-8 lg:grid-cols-2">
        <h2 id="monthly" className="sr-only">
          월별 추이
        </h2>
        <ChartFigure
          title="월별 절감액"
          subtitle="현행(혼합 소각) 대비, 단위 원. 0 아래는 손해 본 달입니다."
          table={{
            caption: "월별 절감액 (원)",
            columns: ["월", "절감액 (원)", "처리 건수"],
            numeric: [false, true, true],
            rows: months.map((m) => [m.label, formatSigned(m.savingKrw), `${m.count}건`]),
          }}
        >
          <BarSeries
            format="krw"
            signed
            ariaLabel={`월별 절감액. ${months[0].label} ${won(months[0].savingKrw)}에서 ${thisMonth.label} ${won(thisMonth.savingKrw)}까지.`}
            data={months.map((m) => ({ label: m.label, value: m.savingKrw, note: `${m.count}건${m.demo ? " · 시연용 포함" : ""}` }))}
          />
        </ChartFigure>
        <ChartFigure
          title="월별 탄소 감축"
          subtitle="현행(혼합 소각) 대비 줄인 양, 단위 tCO₂e"
          table={{
            caption: "월별 탄소 감축 (tCO₂e)",
            columns: ["월", "감축량 (tCO₂e)", "처리 건수"],
            numeric: [false, true, true],
            rows: months.map((m) => [m.label, m.carbonSavedT.toFixed(2), `${m.count}건`]),
          }}
        >
          <BarSeries
            format="tco2"
            ariaLabel={`월별 탄소 감축. ${months[0].label} ${months[0].carbonSavedT.toFixed(2)}톤에서 ${thisMonth.label} ${thisMonth.carbonSavedT.toFixed(2)}톤까지.`}
            data={months.map((m) => ({ label: m.label, value: m.carbonSavedT, note: `${m.count}건${m.demo ? " · 시연용 포함" : ""}` }))}
          />
        </ChartFigure>
      </section>

      <section className="grid gap-8 border-t border-line pt-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ChartFigure
            title="품목별 처리량"
            subtitle="최근 7개월 합계, 단위 kg"
            table={{
              caption: "품목별 처리량 (kg)",
              columns: ["품목", "처리량 (kg)"],
              numeric: [false, true],
              rows: byItem.map((r) => [r.item, formatNumber(r.value)]),
            }}
          >
            <CategoryBars data={byItem} unit="kg" ariaLabel={`품목별 처리량. ${byItem.map((r) => `${r.item} ${formatNumber(r.value)}킬로그램`).join(", ")}.`} />
          </ChartFigure>
        </div>

        <div className="lg:col-span-7">
          <div className="mb-3">
            <h3 className="text-[15px] font-semibold">예측 정확도</h3>
            <p className="text-[13px] text-muted">
              AI가 예상한 작업 후 단가와 처리업체가 기록한 실제 단가를 비교합니다.
              {meanBias !== null ? ` 평균적으로 실제 단가가 예상보다 ${formatNumber(Math.abs(meanBias))}원/kg ${meanBias < 0 ? "낮았습니다" : meanBias > 0 ? "높았습니다" : "같았습니다"}.` : ""}
              {agreement !== null ? ` 매입 여부 예측은 ${agreement}% 맞았습니다.` : ""}
            </p>
          </div>
          {recentPriced.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
              아직 실제 결과가 기록된 처리 건이 없습니다. 처리업체가 수거 후 결과를 남기면 여기에 나타납니다.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">최근 처리 건의 예상 단가와 실제 단가 비교</caption>
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">일자</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">품목</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">예상 (원/kg)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">실제 (원/kg)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">오차 (원/kg)</th>
                  <th scope="col" className="py-2 font-semibold">출처</th>
                </tr>
              </thead>
              <tbody>
                {recentPriced.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="num py-2.5 pr-3 text-ink-2">{formatMonthDay(r.date)}</td>
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                      {r.detail}
                    </th>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="num rounded-sm bg-marker px-1 text-marker-ink">{formatSigned(r.predictedPerKg!)}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {r.actualPerKg !== null ? <span className="num font-semibold">{formatSigned(r.actualPerKg)}</span> : <span className="font-semibold">매입 거절</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {r.actualPerKg !== null ? <span className="num text-ink-2">{formatSigned(r.actualPerKg - r.predictedPerKg!)}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-2.5">
                      <SourceTag r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[12px] text-muted">형광펜 숫자는 AI 예상값, 먹색 숫자는 업체가 기록한 실제 값입니다.</p>
        </div>
      </section>

      <section aria-labelledby="recent" className="border-t border-line pt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent" className="text-[15px] font-semibold">
              최근 처리 이력
            </h2>
            <p className="text-[13px] text-muted">실제 세션은 누르면 해당 세션으로 이동합니다.</p>
          </div>
          <ButtonLink href="/session" variant="ghost" size="sm">
            세션 전체 보기
            <ArrowRightIcon />
          </ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">최근 처리 이력 8건. 일자, 품목, 물량, 경로, 절감액, 상태, 출처 순서입니다.</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">일자</th>
                <th scope="col" className="py-2 pr-3 font-semibold">품목</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">물량 (kg)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">경로</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">절감액 (원)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">상태</th>
                <th scope="col" className="py-2 font-semibold">출처</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  <td className="num py-2.5 pr-3 text-ink-2">{formatDate(r.date)}</td>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                    {r.item}
                    <span className="ml-1.5 text-[12px] font-normal text-muted">{r.detail}</span>
                  </th>
                  <td className="num py-2.5 pr-3 text-right">{formatNumber(r.kg)}</td>
                  <td className="py-2.5 pr-3 text-ink-2">{r.route}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <SignedCell value={r.savingKrw} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={r.state === "완료" ? "gain" : r.state === "거절" ? "loss" : "warn"}>{r.state}</Badge>
                  </td>
                  <td className="py-2.5">
                    <SourceTag r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          계산 가정: 절감액은 품목별 시세와 혼합 사업장폐기물 처리비(업체 인터뷰 평균), 인건비 시간당 15,000원으로 계산한 가정값입니다. 탄소는 신재 대비 회피량과 소각 배출계수를 씁니다.
        </p>
      </section>
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}
