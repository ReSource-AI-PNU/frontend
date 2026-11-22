"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import {
  CIRCULAR_METRICS, METRIC_LABEL, METRIC_NOTE,
  kgText, metricText, scenarioOf, sourceBaseline, sourceHead,
  type CircularMetricKey,
} from "@/lib/v3/circular";
import type { Circular, CircularTotal } from "@/lib/v3/types";

function MetricTile({ metric, total }: { metric: CircularMetricKey; total?: CircularTotal }) {
  const text = metricText(metric, total?.total);
  return (
    <div className="border-t border-line-strong pt-3">
      <p className="text-label text-muted">{METRIC_LABEL[metric]}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">
        {total?.total && text ? (
          <ClaimValue claim={total.total} display={text} title={`${METRIC_LABEL[metric]} 추정 계산`} />
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
      <p className="mt-1 text-[12px] leading-snug text-muted">{metric === "ghg" ? "비교 기준 대비, 원료 생산부터 처리까지 전 과정 배출의 차이" : METRIC_NOTE[metric]}</p>
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
  const assumptions = Array.from(new Set(reference?.rows.filter((row) => row.value).flatMap((row) => row.assumptions) ?? []));
  return (
    <section aria-label="자원순환 효과" className="border-t border-line pt-6">
      <h2 className="text-[20px] leading-snug font-semibold tracking-[-0.02em]">자원순환 효과</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
        월 발생량과 연구 자료를 바탕으로 계산한 예상 효과입니다.
        {assumptions.length > 0 ? " 미확인 조건에는 문헌의 처리 조건을 적용했습니다." : ""}
      </p>
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {CIRCULAR_METRICS.map((metric) => <MetricTile key={metric} metric={metric} total={totals[metric]} />)}
      </div>
      <MoreDetails label="추정 기준과 계산 내역 보기" className="mt-3">
        <div className="space-y-3 rounded-xl bg-ground px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <p>EU JRC의 온실가스·신재 대체 계수와 미국 EPA WARM의 순에너지 계수를 각각 적용합니다. 해외 연구 조건에 따른 추정이며 사업장의 실측·인증 감축량이 아닙니다. 세 지표는 합산하지 않습니다.</p>
          {assumptions.length > 0 ? <ul className="list-disc space-y-1 pl-4">{assumptions.map((line) => <li key={line}>{line}</li>)}</ul> : null}
          {reference?.rows.map((row) => (
            <p key={`${row.streamId}-${row.metric}`}>
              <span className="font-medium">{row.streamName ?? row.streamId} · {METRIC_LABEL[row.metric]}</span>{" — "}
              {row.value ? <ClaimValue claim={row.value} display={metricText(row.metric, row.value) ?? undefined} /> : row.status === "zero" ? "변화 없음" : row.reason || "적용 계수 없음"}
              {row.value && row.assumptions.length > 0 ? <span className="block text-muted">{row.assumptions.join(" · ")}</span> : null}
            </p>
          ))}
          {CIRCULAR_METRICS.map((metric) => {
            const total = totals[metric];
            return total?.heldStreams.length ? <p key={metric}>{METRIC_LABEL[metric]} 계산 제외: {total.heldStreams.map((row) => row.streamName ?? row.streamId).join(", ")}. 제외 항목을 0으로 계산하지 않습니다.</p> : null;
          })}
          {circular.excluded.length > 0 ? <p>계산 제외: {circular.excluded.map((row) => `${row.streamName ?? row.streamId} (${row.reason ?? "입력 확인 필요"})`).join(", ")}</p> : null}
        </div>
      </MoreDetails>
      <Sources circular={circular} />
    </section>
  );
}
