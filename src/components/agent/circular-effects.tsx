"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import {
  CIRCULAR_METRICS, METRIC_LABEL, METRIC_NOTE,
  kgText, metricRangeText, scenarioOf, sourceBaseline, sourceHead,
  type CircularMetricKey,
} from "@/lib/v3/circular";
import type { Circular, CircularTotal } from "@/lib/v3/types";

function effectLabel(metric: CircularMetricKey, massEstimate: boolean): string {
  return massEstimate && metric === "energy" ? "예상 원료 생산 에너지 절감량" : METRIC_LABEL[metric];
}

function MetricTile({ metric, total, massEstimate }: {
  metric: CircularMetricKey;
  total?: CircularTotal;
  massEstimate: boolean;
}) {
  const text = metricRangeText(metric, total?.total, total?.upper);
  const label = effectLabel(metric, massEstimate);
  const notes = {
    ...METRIC_NOTE,
    ghg: "에너지 회수 소각과 기계적 재활용의 문헌 배출 차이",
    energy: "같은 양의 신재와 재생원료를 만드는 데 드는 에너지 차이",
  };
  const note = (massEstimate ? notes : METRIC_NOTE)[metric];
  return (
    <div className="border-t border-line-strong pt-3">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">
        {total?.total && text ? (
          <ClaimValue claim={total.total} display={text} title={`${label} 추정 계산`} />
        ) : total?.status === "zero" ? (
          <span className="text-ink-2">변화 없음</span>
        ) : (
          <span className="text-ink-2 text-[18px]">적용 가능한 문헌값 없음</span>
        )}
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        {total?.total ? "문헌·입력값 기반 추정" : null}
        {total?.status === "partial" && total.countedKg ? (
          <> · <ClaimValue claim={total.countedKg} display={kgText(total.countedKg) ?? undefined} className="!font-normal" /> 기준 부분합</>
        ) : null}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">{note}</p>
    </div>
  );
}

function Sources({ circular }: { circular: Circular }) {
  const { openEvidence } = useV3();
  if (circular.sources.length === 0) return null;
  return (
    <MoreDetails label="출처와 적용 조건 보기" hint={`자료 ${circular.sources.length}건`}>
      <ul className="space-y-3 text-[14px]">
        {circular.sources.map((source) => (
          <li key={source.id} className="rounded-xl bg-ground px-4 py-3">
            <p className="font-medium">
              <button
                type="button"
                className="text-left underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                onClick={() => openEvidence([source.id], source.title)}
              >
                {source.title}
              </button>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">{source.source}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {sourceHead(source)}
              {source.originalUnit || source.unit ? ` · 단위 ${source.originalUnit ?? source.unit}` : ""}
              {sourceBaseline(source) ? ` · ${sourceBaseline(source)}` : ""}
            </p>
            {source.conditions.length > 0 ? (
              <>
                <p className="mt-2 text-[12.5px] text-muted">적용 조건</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
                  {source.conditions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {source.caveats.length > 0 ? (
              <>
                <p className="mt-2 text-[12.5px] text-muted">쓸 때 주의</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
                  {source.caveats.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </MoreDetails>
  );
}

/** 월별 추정 효과와 계산 근거. 세 지표는 단위가 달라 합산하지 않는다. */
export function CircularEffects({ circular }: { circular: Circular }) {
  const a = scenarioOf(circular, "A");
  if (!a) return null;
  const reference = circular.reference;
  const totals = reference?.totals ?? a.totals;
  const monthlyKg = reference?.monthlyKg;
  return (
    <section aria-label="자원순환 효과" className="border-t border-line pt-6">
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
        {monthlyKg ? (
          <>매칭된 월 <ClaimValue claim={monthlyKg} display={kgText(monthlyKg) ?? undefined} />을 기계적으로 재활용할 경우의 문헌 추정치입니다.</>
        ) : (
          <>월 발생량과 연구 자료를 바탕으로 계산한 예상 효과입니다.</>
        )}
      </p>
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {CIRCULAR_METRICS.map((metric) => <MetricTile key={metric} metric={metric} total={totals[metric]} massEstimate={Boolean(monthlyKg)} />)}
      </div>
      <MoreDetails label="추정 기준과 계산 내역 보기" className="mt-3">
        <div className="space-y-3 rounded-xl bg-ground px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          {monthlyKg ? (
            <p>온실가스는 에너지 회수 소각과 비교합니다. 에너지는 재생원료와 신재의 생산 단계만 비교합니다. 각 값은 해외 연구 조건으로 환산한 참고 추정치입니다. 범위는 재질·등급별 문헌 시나리오를 나타냅니다.</p>
          ) : (
            <p>각 값은 해외 연구 조건으로 환산한 참고 추정치입니다.</p>
          )}
          {reference?.rows.map((row) => (
            <p key={`${row.streamId}-${row.metric}`}>
              <span className="font-medium">{row.streamName ?? row.streamId} · {effectLabel(row.metric, Boolean(monthlyKg))}</span>{" — "}
              {row.value ? <ClaimValue claim={row.value} display={metricRangeText(row.metric, row.value, row.upper) ?? undefined} /> : row.status === "zero" ? "변화 없음" : row.reason || "적용 계수 없음"}
              {row.value && row.assumptions.length > 0 ? <span className="block text-muted">{row.assumptions.join(" · ")}</span> : null}
            </p>
          ))}
          {CIRCULAR_METRICS.map((metric) => {
            const total = totals[metric];
            return total?.heldStreams.length ? <p key={metric}>{effectLabel(metric, Boolean(monthlyKg))} 계산 제외: {total.heldStreams.map((row) => row.streamName ?? row.streamId).join(", ")}. 제외 항목을 0으로 계산하지 않습니다.</p> : null;
          })}
          {circular.excluded.length > 0 ? <p>계산 제외: {circular.excluded.map((row) => `${row.streamName ?? row.streamId} (${row.reason ?? "입력 확인 필요"})`).join(", ")}</p> : null}
        </div>
      </MoreDetails>
      <Sources circular={circular} />
    </section>
  );
}
