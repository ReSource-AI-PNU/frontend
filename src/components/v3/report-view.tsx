"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { api } from "@/lib/v3/api";
import { ROUTE_LABEL } from "@/lib/v3/format";
import { signedWon, won } from "@/lib/v3/money";
import {
  EMPTY_LEAD,
  PERIODS,
  PLANNED_LEAD,
  REPORT_LEAD,
  baselineNote,
  carbonGapNote,
  csvName,
  periodRange,
  periodText,
  reportCsv,
  reportHeadline,
  type PeriodKey,
} from "@/lib/v3/report";
import type { Claim, Report } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

const segment =
  "flex min-h-[38px] cursor-pointer items-center rounded-sm px-3.5 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink";
const th = "px-3 py-2 text-left text-[12px] font-medium whitespace-nowrap text-muted";
const td = "px-3 py-2.5 align-top";

function Stat({ label, claim, display, note }: { label: string; claim: Claim | null; display?: string; note?: string }) {
  return (
    <div className="min-w-0 border-t border-line pt-3">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 font-mono text-[22px] leading-tight tracking-[-0.02em] tabular-nums sm:text-[26px]">
        {claim ? (
          <ClaimValue claim={claim} display={display} className="text-left whitespace-nowrap" />
        ) : (
          <span className="text-[17px] text-muted">없음</span>
        )}
      </p>
      {note ? <p className="mt-0.5 text-[12px] text-muted">{note}</p> : null}
    </div>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Records({ report }: { report: Report }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line print:overflow-visible print:rounded-none">
      <table className="w-full min-w-[720px] text-[14px] tabular-nums print:min-w-0 print:text-[11px]">
        <caption className="sr-only">검수 기록별 실적</caption>
        <thead className="bg-ground">
          <tr>
            <th className={th}>검수일</th>
            <th className={th}>폐기물</th>
            <th className={th}>받은 곳</th>
            <th className={th}>실제 등급</th>
            <th className={`${th} text-right`}>실제 무게</th>
            <th className={`${th} text-right`}>실제 단가</th>
            <th className={`${th} text-right`}>금액</th>
            <th className={`${th} text-right`}>탄소 변화</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.records.map((item) => (
            <tr key={item.id}>
              <td className={`${td} font-mono text-[13px] whitespace-nowrap print:text-[11px]`}>{item.inspectedOn}</td>
              <td className={`${td} whitespace-nowrap`}>{item.streamName ?? item.streamLabel}</td>
              <td className={`${td} whitespace-nowrap`}>
                {item.vendorName}
                {item.process ? <span className="block text-[12px] text-muted">{item.process}</span> : null}
              </td>
              <td className={td}>{item.grade ?? <span className="text-muted">기록 없음</span>}</td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.kg} title={`${item.inspectedOn} 실제 무게`} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.unitPrice} price title={`${item.inspectedOn} 실제 단가`} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.amount} signed display={signedWon(item.amount)} title={`${item.inspectedOn} 금액`} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                {item.carbon ? (
                  <ClaimValue claim={item.carbon} title={`${item.inspectedOn} 탄소 변화`} />
                ) : (
                  <span className="text-[13px] text-muted">계산하지 않음</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Planned({ report }: { report: Report }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line print:overflow-visible print:rounded-none">
      <table className="w-full min-w-[640px] text-[14px] tabular-nums print:min-w-0 print:text-[11px]">
        <caption className="sr-only">확정한 합의의 한 달 예상</caption>
        <thead className="bg-ground">
          <tr>
            <th className={th}>폐기물</th>
            <th className={th}>받는 곳</th>
            <th className={`${th} text-right`}>합의 단가</th>
            <th className={`${th} text-right`}>한 달 손익(예상)</th>
            <th className={`${th} text-right`}>한 달 탄소 변화(예상)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.planned.map((item) => (
            <tr key={`${item.sessionId}:${item.streamId}`}>
              <td className={`${td} whitespace-nowrap`}>{item.streamName ?? item.streamLabel}</td>
              <td className={`${td} whitespace-nowrap`}>
                {item.vendorName}
                {item.route ? <span className="block text-[12px] text-muted">{ROUTE_LABEL[item.route] ?? item.route}</span> : null}
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.unitPrice} title={`${item.streamName ?? item.streamLabel} 합의 단가`} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.monthlyAfter} signed display={signedWon(item.monthlyAfter)} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                <ClaimValue claim={item.carbon} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 배출 기업의 재활용·탄소 실적. 원청·고객사에 낼 수 있게 인쇄와 CSV를 둔다 */
export function ReportView() {
  const { org, mode, basePath } = useV3();
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [today, setToday] = useState<string | null>(null);
  const range = today ? periodRange(period, today) : { from: null, to: null };
  const isEmitter = org.role === "emitter";
  const remote = useRemote(`report:${org.id}:${range.from}:${range.to}`, mode === "live" && isEmitter, async () => {
    const report = await api.getReport(org.id, range.from, range.to);
    setToday((before) => before ?? report.generatedOn);
    return report;
  });
  const report = remote.data;

  if (!isEmitter) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-5 pt-10 pb-16">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">실적</h1>
        <p className="mt-2 text-[15px] text-ink-2">실적 리포트는 폐기물을 내보내는 회사의 화면입니다.</p>
      </div>
    );
  }

  const carbonGap = report ? carbonGapNote(report.records) : null;
  const baseline = report ? baselineNote(report.records) : null;
  const revenue = report?.totals?.revenue ?? null;
  const fee = report?.totals?.fee ?? null;

  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pt-10 pb-16 print:max-w-none print:px-0 print:pt-0">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">재활용 실적</h1>
        <p className="mt-1 text-[14px] text-muted">
          {org.name}
          {report ? ` · ${periodText(report.period)} · ${report.generatedOn} 기준` : ""}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2 print:hidden">{REPORT_LEAD}</p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <fieldset>
          <legend className="sr-only">기간</legend>
          <div className="inline-flex flex-wrap rounded-md bg-sunken p-[3px]">
            {PERIODS.map((item) => (
              <label key={item.key}>
                <input
                  type="radio"
                  name="report-period"
                  value={item.key}
                  checked={period === item.key}
                  onChange={() => setPeriod(item.key)}
                  disabled={!today && item.key !== "all"}
                  className="peer sr-only"
                />
                <span className={segment}>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="secondary" size="sm" disabled={!report || report.records.length === 0} onClick={() => report && download(csvName(org.name, report.period), reportCsv(report))}>
            CSV 내려받기
          </Button>
          <Button size="sm" disabled={!report} onClick={() => window.print()}>
            인쇄
          </Button>
        </div>
      </div>

      {remote.loading || mode === "loading" ? <p className="text-sm text-muted">실적을 모으는 중입니다.</p> : null}
      {remote.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-loss">
          {remote.error}
          <Button variant="secondary" size="sm" onClick={remote.reload}>
            다시 시도
          </Button>
        </div>
      ) : null}

      {report ? (
        <div className="space-y-10">
          <section aria-label="요약">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{reportHeadline(report)}</h2>
            {report.totals ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <Stat label="반출 무게" claim={report.totals.kg} />
                  <Stat label="매각 수익(받은 돈)" claim={revenue} display={won(revenue)} />
                  <Stat label="처리비(낸 돈)" claim={fee} display={won(fee)} />
                  <Stat
                    label="탄소 변화"
                    claim={report.totals.carbon}
                    note={report.totals.carbon && Number(report.totals.carbon.value) < 0 ? "−는 지금 처리보다 줄어든 양" : undefined}
                  />
                </div>
                {carbonGap || baseline ? (
                  <ul className="mt-3 space-y-1 text-[13px] leading-relaxed text-muted">
                    {carbonGap ? <li>{carbonGap}</li> : null}
                    {baseline ? <li>{baseline}</li> : null}
                  </ul>
                ) : null}
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-line-strong px-5 py-6 print:hidden">
                <p className="text-[15px] text-ink-2">{EMPTY_LEAD}</p>
                <Link href={basePath} className={`${buttonClass("secondary", "sm")} mt-3`}>
                  찾기 화면으로
                </Link>
              </div>
            )}
          </section>

          {report.records.length > 0 ? (
            <section aria-label="검수 기록">
              <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.02em]">검수 기록</h2>
              <Records report={report} />
              <MoreDetails className="mt-1 print:hidden" label="계산 방법 보기" closeLabel="접기">
                <p className="pb-2 text-[13px] leading-relaxed text-muted">
                  금액은 실제 무게 × 실제 단가입니다(+는 받은 돈, −는 낸 돈). 탄소 변화는 실제 무게 × (보낸 곳의 처리 방식 배출계수 −
                  지금 처리 방식 배출계수)이고, 배출계수는 환경성적표지 기준값을 씁니다. 실제 무게·단가·등급은 업체가 검수 뒤 기록한
                  값입니다.
                </p>
              </MoreDetails>
            </section>
          ) : null}

          {report.planned.length > 0 ? (
            <section aria-label="확정한 합의의 예상">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em]">확정한 합의 · 한 달 예상</h2>
              <p className="mt-1 mb-3 text-[13px] text-muted">{PLANNED_LEAD}</p>
              <Planned report={report} />
            </section>
          ) : null}

          <p className="hidden text-[11px] text-muted print:block">
            Re:Source AI가 {report.generatedOn}에 만든 실적입니다. 숫자마다 업체 검수 기록과 계산 근거가 남아 있습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
