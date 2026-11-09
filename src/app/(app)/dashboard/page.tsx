import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BarSeries } from "@/components/charts/bar-series";
import { ChartFigure } from "@/components/charts/chart-figure";
import { formatDate, formatMonthDay } from "@/components/dashboard/format-date";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { RouteShareBars } from "@/components/dashboard/route-share-bars";
import { ArrowRightIcon } from "@/components/icons";
import { RouteBadge } from "@/components/session/stream-badges";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber, formatSigned } from "@/lib/format";
import {
  bucketByMonth,
  buildDemoHistory,
  routeShares,
  sessionsToHistory,
  type HistoryRecord,
  type HistoryState,
} from "@/lib/server/mock/history";
import { listSessionsForCurrentOrg } from "@/lib/server/sessions";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

export const metadata: Metadata = { title: "대시보드" };

const won = (n: number) => `${formatSigned(n)}원`;

const STATE_TONE: Record<HistoryState, BadgeTone> = {
  완료: "gain",
  거절: "loss",
  "수거 대기": "warn",
  "자체 처리": "neutral",
  "현행 유지": "neutral",
};

function SignedCell({ value }: { value: number }) {
  return <span className={`num font-semibold ${value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-2"}`}>{formatSigned(value)}</span>;
}

function SourceTag({ r }: { r: HistoryRecord }) {
  if (r.demo) return <span className="text-[12px] text-muted">시연용</span>;
  return (
    <Link href={`/session/${r.sessionId}`} className="text-[12px] font-semibold underline underline-offset-4">
      실제 진단
    </Link>
  );
}

function StreamCell({ r }: { r: HistoryRecord }) {
  return (
    <>
      {r.stream}
      <span className="ml-1.5 text-[12px] font-normal text-muted">{r.detail}</span>
    </>
  );
}

const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;

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

  const shares = routeShares(records);
  const totalKg = shares.reduce((s, r) => s + r.kg, 0);
  const incinerated = shares.find((r) => r.route === "incinerate")?.kg ?? 0;
  const diverted = totalKg - incinerated;
  const rejected = records.filter((r) => r.accepted === false).length;

  const priced = records.filter((r) => r.predictedPerKg !== null && r.actualPerKg !== null);
  const judged = records.filter((r) => r.accepted !== null);
  const meanAbsErr = priced.length ? Math.round(priced.reduce((s, r) => s + Math.abs(r.actualPerKg! - r.predictedPerKg!), 0) / priced.length) : null;
  const meanBias = priced.length ? Math.round(priced.reduce((s, r) => s + (r.actualPerKg! - r.predictedPerKg!), 0) / priced.length) : null;
  const meanPct = priced.length
    ? Math.round((priced.reduce((s, r) => s + Math.abs(r.actualPerKg! - r.predictedPerKg!) / Math.max(1, Math.abs(r.predictedPerKg!)), 0) / priced.length) * 1000) / 10
    : null;
  const agreement = judged.length ? Math.round((judged.filter((r) => r.accepted).length / judged.length) * 100) : null;

  // 흐름별 합계. 같은 폐플라스틱이라도 흐름과 출처에 따라 갈 곳이 다르므로 품목이 아니라 흐름으로 나눈다
  const byStream = [
    ...records
      .reduce((map, r) => {
        const cur = map.get(r.stream) ?? { stream: r.stream, detail: r.detail, origin: r.origin, kg: 0 };
        cur.kg += r.kg;
        return map.set(r.stream, cur);
      }, new Map<string, { stream: string; detail: string; origin: string; kg: number }>())
      .values(),
  ].sort((a, b) => b.kg - a.kg);
  const maxStreamKg = Math.max(1, ...byStream.map((r) => r.kg));
  const recentPriced = records.filter((r) => r.predictedPerKg !== null && r.accepted !== null).slice(0, 6);
  const realSessions = new Set(real.map((r) => r.sessionId)).size;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-h1">대시보드</h1>
          <p className="mt-1 text-sm text-muted">
            {org.name}의 최근 7개월 폐플라스틱 흐름별 처리 이력입니다. 지금처럼 전부 혼합 소각했을 때와 비교해 줄인 비용과 탄소를 누적합니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone="neutral">시연용 이력 포함</Badge>
          <p className="text-right text-[12px] text-muted">
            지난 6개월은 시연 공장 네 흐름 기준의 시연용 이력이고, 발송·수거를 마친 실제 진단 {realSessions}건을 흐름별로 합쳤습니다.
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
            label: "소각 대신 다른 경로로",
            value: totalKg > 0 ? pct(diverted / totalKg) : "—",
            delta: `처리량 ${formatNumber(totalKg)}kg 중 ${formatNumber(diverted)}kg · 매입 거절 ${rejected}건 포함`,
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
          subtitle="현행(전부 혼합 소각) 대비, 단위 원. 0 아래는 손해 본 달입니다."
          table={{
            caption: "월별 절감액 (원)",
            columns: ["월", "절감액 (원)", "처리한 흐름"],
            numeric: [false, true, true],
            rows: months.map((m) => [m.label, formatSigned(m.savingKrw), `${m.count}개`]),
          }}
        >
          <BarSeries
            format="krw"
            signed
            ariaLabel={`월별 절감액. ${months[0].label} ${won(months[0].savingKrw)}에서 ${thisMonth.label} ${won(thisMonth.savingKrw)}까지.`}
            data={months.map((m) => ({ label: m.label, value: m.savingKrw, note: `흐름 ${m.count}개${m.demo ? " · 시연용 포함" : ""}` }))}
          />
        </ChartFigure>
        <ChartFigure
          title="월별 탄소 감축"
          subtitle="현행(전부 혼합 소각) 대비 줄인 양, 단위 tCO₂e"
          table={{
            caption: "월별 탄소 감축 (tCO₂e)",
            columns: ["월", "감축량 (tCO₂e)", "처리한 흐름"],
            numeric: [false, true, true],
            rows: months.map((m) => [m.label, m.carbonSavedT.toFixed(2), `${m.count}개`]),
          }}
        >
          <BarSeries
            format="tco2"
            ariaLabel={`월별 탄소 감축. ${months[0].label} ${months[0].carbonSavedT.toFixed(2)}톤에서 ${thisMonth.label} ${thisMonth.carbonSavedT.toFixed(2)}톤까지.`}
            data={months.map((m) => ({ label: m.label, value: m.carbonSavedT, note: `흐름 ${m.count}개${m.demo ? " · 시연용 포함" : ""}` }))}
          />
        </ChartFigure>
      </section>

      <section aria-labelledby="volume" className="grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
        <h2 id="volume" className="sr-only">
          처리량
        </h2>
        <ChartFigure
          title="경로별 처리량"
          subtitle="최근 7개월 합계 대비 비중, 단위 kg. 업체가 매입을 거절한 물량은 소각으로 셉니다."
          table={{
            caption: "경로별 처리량 (kg)과 비중",
            columns: ["경로", "처리량 (kg)", "비중", "흐름 수"],
            numeric: [false, true, true, true],
            rows: shares.map((r) => [STREAM_ROUTE_LABEL[r.route], formatNumber(r.kg), pct(r.share), `${r.streams}개`]),
          }}
        >
          <RouteShareBars
            data={shares}
            ariaLabel={`경로별 처리량. ${shares.map((r) => `${STREAM_ROUTE_LABEL[r.route]} ${formatNumber(r.kg)}킬로그램 ${pct(r.share)}`).join(", ")}.`}
          />
        </ChartFigure>
        <ChartFigure
          title="흐름별 처리량"
          subtitle="최근 7개월 합계, 단위 kg. 출처(PIR·PCR)에 따라 팔 수 있는 곳이 달라집니다."
          table={{
            caption: "흐름별 처리량 (kg)",
            columns: ["흐름", "재질", "출처", "처리량 (kg)"],
            numeric: [false, false, false, true],
            rows: byStream.map((r) => [r.stream, r.detail, r.origin, formatNumber(r.kg)]),
          }}
        >
          <div role="img" aria-label={`흐름별 처리량. ${byStream.map((r) => `${r.stream} ${formatNumber(r.kg)}킬로그램`).join(", ")}.`} className="grid gap-1">
            {byStream.map((r) => (
              <div key={r.stream} aria-hidden="true" className="grid h-[34px] grid-cols-[124px_minmax(0,1fr)] items-center gap-3 px-1">
                <span className="truncate text-[13px] text-ink-2">{r.stream}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3.5 shrink-0 rounded-r-[4px] bg-ink-2" style={{ width: `${(r.kg / maxStreamKg) * 62}%`, minWidth: r.kg > 0 ? 2 : 0 }} />
                  <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">{formatNumber(r.kg)}kg</span>
                  <span className="text-[12px] whitespace-nowrap text-muted">{r.origin}</span>
                </span>
              </div>
            ))}
          </div>
        </ChartFigure>
      </section>

      <section aria-labelledby="accuracy" className="border-t border-line pt-8">
        <div className="mb-3 max-w-3xl">
          <h2 id="accuracy" className="text-[15px] font-semibold">
            예측 정확도
          </h2>
          <p className="text-[13px] text-muted">
            매각·묶음 매각·열분해처럼 업체가 받아 가는 흐름에서, AI가 예상한 kg당 손익과 업체가 기록한 실제 단가를 비교합니다.
            {meanBias !== null ? ` 평균적으로 실제 단가가 예상보다 ${formatNumber(Math.abs(meanBias))}원/kg ${meanBias < 0 ? "낮았습니다" : meanBias > 0 ? "높았습니다" : "같았습니다"}.` : ""}
            {agreement !== null ? ` 매입 여부 예측은 ${agreement}% 맞았습니다.` : ""}
          </p>
        </div>
        {recentPriced.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
            아직 실제 결과가 기록된 흐름이 없습니다. 처리업체가 수거 후 결과를 남기면 여기에 나타납니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">최근 흐름의 예상 단가와 실제 단가 비교</caption>
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">일자</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">흐름</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">경로</th>
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
                      <StreamCell r={r} />
                    </th>
                    <td className="py-2.5 pr-3">
                      <RouteBadge route={r.route} size="sm" />
                    </td>
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
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted">형광펜 숫자는 AI 예상값, 먹색 숫자는 업체가 기록한 실제 값입니다.</p>
      </section>

      <section aria-labelledby="recent" className="border-t border-line pt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent" className="text-[15px] font-semibold">
              최근 처리 이력
            </h2>
            <p className="text-[13px] text-muted">흐름 하나의 한 달 처리가 한 줄입니다. 실제 진단은 누르면 해당 진단으로 이동합니다.</p>
          </div>
          <ButtonLink href="/session" variant="ghost" size="sm">
            진단 이력 전체 보기
            <ArrowRightIcon />
          </ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <caption className="sr-only">최근 처리 이력 10줄. 일자, 흐름, 물량, 경로, 절감액, 상태, 출처 순서입니다.</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">일자</th>
                <th scope="col" className="py-2 pr-3 font-semibold">흐름</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">물량 (kg)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">경로</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">절감액 (원)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">상태</th>
                <th scope="col" className="py-2 font-semibold">출처</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  <td className="num py-2.5 pr-3 text-ink-2">{formatDate(r.date)}</td>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                    <StreamCell r={r} />
                  </th>
                  <td className="num py-2.5 pr-3 text-right">{formatNumber(r.kg)}</td>
                  <td className="py-2.5 pr-3">
                    <RouteBadge route={r.route} size="sm" />
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <SignedCell value={r.savingKrw} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={STATE_TONE[r.state]}>{r.state}</Badge>
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
          계산 가정: 절감액은 혼합 사업장폐기물 소각 위탁비 250원/kg을 기준으로, 재투입 가치 900원/kg, PP 매각 300원/kg, LDPE 필름 150원/kg(묶음 운반비 50원/kg 분담), 열분해 반입비 80원/kg, 인건비 시간당 15,000원으로 계산한 시연용 가정값입니다. 탄소는 신재 대비 회피량과 소각 배출계수를 씁니다.
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
