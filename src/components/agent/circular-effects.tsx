"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { ClaimValue, Glue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { StatusChip } from "@/components/v3/status-chip";
import {
  BASELINE_NAME,
  CIRCULAR_METRICS,
  DISCLAIMER,
  LANDFILL_NOTE,
  METRIC_LABEL,
  METRIC_NOTE,
  ROUTE_NAME,
  SCENARIO_NOTE,
  TRANSPORT_NOTE,
  baselineSummary,
  bundleSentence,
  kgText,
  metricStatusText,
  metricText,
  scenarioOf,
  sourceBaseline,
  sourceHead,
  totalStatusText,
  type CircularMetricKey,
} from "@/lib/v3/circular";
import { signedWon } from "@/lib/v3/money";
import type { Circular, CircularRow, CircularScenario, CircularTotal } from "@/lib/v3/types";

function Held({ total }: { total: CircularTotal | undefined }) {
  if (!total || (total.status !== "partial" && total.status !== "hold")) return null;
  return (
    <span className="block text-[12.5px] text-muted">
      산정 보류{" "}
      {total.heldKg ? <ClaimValue claim={total.heldKg} display={kgText(total.heldKg) ?? undefined} className="!font-normal" /> : null}
      {total.heldStreams.length > 0 ? ` (${total.heldStreams.map((item) => item.streamName ?? item.streamId).join(", ")})` : ""}
    </span>
  );
}

/** 요약 칸 하나: 지표 이름, 값(없으면 "산정 보류"), 부분합이면 산정한 물량과 보류 물량 */
function MetricTile({ metric, scene }: { metric: CircularMetricKey; scene: CircularScenario }) {
  const total = scene.totals[metric];
  const text = metricText(metric, total?.total);
  return (
    <div className="border-t border-line-strong pt-3">
      <p className="text-label text-muted">{METRIC_LABEL[metric]}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">
        {total?.total && text ? (
          <ClaimValue claim={total.total} display={text} title={`${scene.label} ${METRIC_LABEL[metric]}`} />
        ) : total?.status === "zero" ? (
          <span className="text-ink-2">변화 없음</span>
        ) : (
          <span className="text-warn">산정 보류</span>
        )}
      </p>
      {metric === "virgin" && scene.virginByMaterial.length > 0 ? (
        <p className="mt-0.5 text-[13px] text-ink-2">
          {scene.virginByMaterial.map((item, index) => (
            <span key={item.material}>
              {index > 0 ? " · " : ""}신재 {item.material}{" "}
              <ClaimValue claim={item.total} display={metricText("virgin", item.total) ?? undefined} className="!font-normal" />
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-0.5 text-[12.5px] text-muted">
        {total?.status === "partial" && total.countedKg ? (
          <>
            <Glue>
              <ClaimValue claim={total.countedKg} display={kgText(total.countedKg) ?? undefined} className="!font-normal" />만
            </Glue>{" "}
            산정한 부분합
          </>
        ) : total?.status === "hold" ? null : (
          totalStatusText(total)
        )}
      </p>
      <Held total={total} />
      <p className="mt-1 text-[12px] leading-snug text-muted">{METRIC_NOTE[metric]}</p>
    </div>
  );
}

function MetricInline({ metric, row }: { metric: CircularMetricKey; row: CircularRow }) {
  const item = row[metric];
  const text = metricText(metric, item.value);
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted">{metric === "ghg" ? "감축" : metric === "energy" ? "에너지" : "신재 대체"} </span>
      {item.value && text ? (
        <>
          <ClaimValue claim={item.value} display={metric === "virgin" && row.virginMaterial ? `${row.virginMaterial} ${text}` : text} className="!font-normal" />
          <span className="text-[12px] text-muted"> ({metricStatusText(item)})</span>
        </>
      ) : (
        <span className={item.status === "hold" ? "text-warn" : "text-ink-2"}>{metricStatusText(item)}</span>
      )}
    </span>
  );
}

/** 폐기물 한 줄: 경로, 무엇을 대신하는지 한 문장, 세 지표. 설명 넷과 미확인 항목은 접어 둔다 */
function StreamEffect({ row }: { row: CircularRow }) {
  const { openEvidence } = useV3();
  // 같은 사유는 지표 이름을 묶어 한 번만 적는다(공정 스크랩이면 세 지표가 같은 사유다)
  const reasons: { metrics: CircularMetricKey[]; reason: string }[] = [];
  for (const metric of CIRCULAR_METRICS) {
    if (row[metric].status !== "hold" || !row[metric].reason) continue;
    const same = reasons.find((item) => item.reason === row[metric].reason);
    if (same) same.metrics.push(metric);
    else reasons.push({ metrics: [metric], reason: row[metric].reason });
  }
  const basis = Array.from(new Set(CIRCULAR_METRICS.flatMap((m) => row[m].evidence)));
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-medium">{row.streamName ?? row.streamId}</p>
        <StatusChip tone="neutral">{ROUTE_NAME[row.route]}</StatusChip>
        {row.baseline ? (
          <span className="text-[13px] text-muted">
            지금 {BASELINE_NAME[row.baseline]}
            {row.baselineAssumed ? "(가정)" : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{row.explain.effect}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13.5px]">
        {CIRCULAR_METRICS.map((metric) => (
          <MetricInline key={metric} metric={metric} row={row} />
        ))}
      </p>
      {row.resources.length > 0 ? (
        <p className="mt-0.5 text-[13px] text-muted">
          원료 절감 참고값(세계 평균):{" "}
          {row.resources.map((item, index) => (
            <span key={item.name}>
              {index > 0 ? " · " : ""}
              {item.name} <ClaimValue claim={item.value} display={kgText(item.value) ?? undefined} className="!font-normal" />
            </span>
          ))}
        </p>
      ) : null}
      <MoreDetails label="효과 설명 보기" hint={row.unconfirmed.length > 0 ? `미확인 ${row.unconfirmed.length}가지` : undefined}>
        <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-ground px-4 py-3 text-[14px] sm:grid-cols-[8.5rem_1fr]">
          <dt className="text-muted">기대효과</dt>
          <dd className="text-ink-2">{row.explain.effect}</dd>
          <dt className="text-muted">효과가 생기는 이유</dt>
          <dd className="text-ink-2">{row.explain.why}</dd>
          <dt className="text-muted">필요한 실행조건</dt>
          <dd className="text-ink-2">{row.explain.conditions}</dd>
          <dt className="text-muted">계산 근거</dt>
          <dd className="text-ink-2">
            {row.explain.basis}{" "}
            {basis.length > 0 ? (
              <button
                type="button"
                className="text-[13px] text-muted underline underline-offset-4 hover:text-ink"
                onClick={() => openEvidence(basis, `${row.streamName ?? "폐기물"} 자원순환 효과의 근거`)}
              >
                근거
              </button>
            ) : null}
          </dd>
          {reasons.length > 0 ? (
            <>
              <dt className="text-muted">산정 보류 사유</dt>
              <dd className="text-ink-2">
                <ul className="space-y-1">
                  {reasons.map((item) => (
                    <li key={item.metrics.join("-")}>
                      <span className="font-medium text-ink">
                        {item.metrics.length === CIRCULAR_METRICS.length ? "세 지표 모두" : item.metrics.map((m) => METRIC_LABEL[m]).join(", ")}
                      </span>{" "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {row.unconfirmed.length > 0 ? (
            <>
              <dt className="text-muted">미확인 항목</dt>
              <dd className="text-ink-2">
                <ul className="list-disc space-y-0.5 pl-4">
                  {row.unconfirmed.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
        </dl>
      </MoreDetails>
    </li>
  );
}

function ScenarioCell({ scene, metric }: { scene: CircularScenario; metric: CircularMetricKey }) {
  if (!scene.available) return <span className="text-muted">계산하지 않음</span>;
  const total = scene.totals[metric];
  if (scene.id === "C") return <span className="text-ink-2">0 (기준선)</span>;
  const text = metricText(metric, total?.total);
  return (
    <>
      {total?.total && text ? (
        <ClaimValue claim={total.total} display={text} className="!font-normal whitespace-nowrap" />
      ) : total?.status === "zero" ? (
        <span className="text-ink-2">{scene.id === "D" && metric === "virgin" ? "없음 (원료 회수 없음)" : "변화 없음"}</span>
      ) : (
        <span className="text-warn">산정 보류</span>
      )}
      {total?.status === "partial" ? <span className="block text-[12px] text-muted">부분합</span> : null}
      {total?.status === "partial" || total?.status === "hold" ? (
        <span className="block text-[12px] text-muted">
          보류 {total.heldKg ? <ClaimValue claim={total.heldKg} display={kgText(total.heldKg) ?? undefined} className="!font-normal" /> : null}
        </span>
      ) : null}
    </>
  );
}

/** A·B·C·D를 한 표로. 결론(어느 것이 낫다)을 미리 정하지 않고 계산 결과와 보류 물량을 그대로 보인다 */
function ScenarioTable({ circular }: { circular: Circular }) {
  const scenes = (["A", "B", "C", "D"] as const)
    .map((id) => scenarioOf(circular, id))
    .filter((item): item is CircularScenario => Boolean(item));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <caption className="sr-only">시나리오별 월 손익과 자원순환 효과</caption>
        <thead>
          <tr className="border-b border-line-strong text-left text-label text-muted">
            <th className="py-2 pr-3 font-semibold">항목</th>
            {scenes.map((scene) => (
              <th key={scene.id} className="py-2 pr-3 font-semibold">
                {scene.id}. {scene.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="align-top tabular-nums">
          <tr className="border-b border-line">
            <th scope="row" className="py-2.5 pr-3 text-left font-normal text-muted">
              현행 대비 월 손익
            </th>
            {scenes.map((scene) => (
              <td key={scene.id} className="py-2.5 pr-3">
                {scene.id === "C" ? (
                  <span className="text-ink-2">0 (기준선)</span>
                ) : scene.money ? (
                  <ClaimValue claim={scene.money} signed display={signedWon(scene.money)} className="!font-normal" />
                ) : (
                  <span className="text-warn">확인 필요</span>
                )}
                {scene.moneyReason ? <span className="block text-[12px] text-muted">{scene.moneyReason}</span> : null}
              </td>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th scope="row" className="py-2.5 pr-3 text-left font-normal text-muted">
              재활용 경로로 가는 물량
            </th>
            {scenes.map((scene) => (
              <td key={scene.id} className="py-2.5 pr-3">
                {!scene.available ? (
                  <span className="text-muted">계산하지 않음</span>
                ) : scene.circularKg ? (
                  <ClaimValue claim={scene.circularKg} display={`${kgText(scene.circularKg)}/월`} className="!font-normal" />
                ) : (
                  <span className="text-ink-2">없음</span>
                )}
              </td>
            ))}
          </tr>
          {(["ghg", "energy", "virgin"] as const).map((metric) => (
            <tr key={metric} className="border-b border-line">
              <th scope="row" className="py-2.5 pr-3 text-left font-normal text-muted">
                {METRIC_LABEL[metric]}
              </th>
              {scenes.map((scene) => (
                <td key={scene.id} className="py-2.5 pr-3">
                  <ScenarioCell scene={scene} metric={metric} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

/**
 * 자원순환 효과(배출 기업만). 경제성 결과 아래에서 "이 폐기물이 어떤 경로로 순환하고, 무엇을 대체하며,
 * 어떤 효과를 내는가"를 보인다. 요약(세 지표) → 폐기물별 설명 → 시나리오 비교 → 출처 순서다.
 */
export function CircularEffects({ circular }: { circular: Circular }) {
  const a = scenarioOf(circular, "A");
  const c = scenarioOf(circular, "C");
  if (!a) return null;
  return (
    <section aria-label="자원순환 효과" className="border-t border-line pt-6">
      <h2 className="text-[20px] leading-snug font-semibold tracking-[-0.02em]">자원순환 효과</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
        흐름별 최적안으로 바꾸면 현행({baselineSummary(circular)}) 대비 아래 효과를 기대할 수 있습니다.
        {a.circularKg ? (
          <>
            {" "}
            한 달에{" "}
            <Glue>
              <ClaimValue claim={a.circularKg} display={kgText(a.circularKg) ?? undefined} className="text-ink" />이
            </Glue>{" "}
            공정 재투입이나 재활용 업체로 갑니다.
          </>
        ) : null}
      </p>

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {CIRCULAR_METRICS.map((metric) => (
          <MetricTile key={metric} metric={metric} scene={a} />
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{DISCLAIMER}</p>

      <h3 className="mt-6 text-[16px] font-semibold">폐기물마다 어떻게 순환하나요</h3>
      <ul className="mt-1 divide-y divide-line border-b border-line">
        {a.rows.map((row) => (
          <StreamEffect key={row.streamId} row={row} />
        ))}
      </ul>
      {circular.excluded.length > 0 ? (
        <p className="mt-2 text-[13px] text-muted">
          계산에서 뺀 폐기물:{" "}
          {circular.excluded.map((item) => `${item.streamName ?? item.streamId}(${item.reason ?? "확인 필요"})`).join(", ")}
        </p>
      ) : null}

      <h3 className="mt-6 text-[16px] font-semibold">시나리오 비교</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
        {bundleSentence(circular)}
        {circular.bundle.kg ? (
          <>
            {" "}
            그 물량은 한 달{" "}
            <Glue>
              <ClaimValue claim={circular.bundle.kg} display={kgText(circular.bundle.kg) ?? undefined} className="!font-normal" />
              입니다.
            </Glue>
          </>
        ) : null}{" "}
        {TRANSPORT_NOTE}
      </p>
      <div className="mt-3">
        <ScenarioTable circular={circular} />
      </div>
      <ul className="mt-3 space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
        {c?.baselineEmission ? (
          <li>
            <span className="font-medium text-ink">C. 현행 유지</span> 감축량 0은 지금 처리 단계 배출(
            <ClaimValue claim={c.baselineEmission} display={metricText("ghg", c.baselineEmission) ?? undefined} className="!font-normal" />
            , 국내 처리 공정 계수, 신재 대체·에너지 회수 미반영)이 그대로 남는다는 뜻입니다.
          </li>
        ) : null}
        <li>
          <span className="font-medium text-ink">D. 전부 매립</span> {LANDFILL_NOTE}
        </li>
      </ul>
      <MoreDetails label="시나리오 설명 보기" className="mt-1">
        <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-ground px-4 py-3 text-[14px] sm:grid-cols-[9rem_1fr]">
          {circular.scenarios.map((scene) => (
            <div key={scene.id} className="contents">
              <dt className="font-medium text-ink">
                {scene.id}. {scene.label}
              </dt>
              <dd className="text-ink-2">
                {SCENARIO_NOTE[scene.id]}
                {!scene.available && scene.reason ? ` ${scene.reason}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      </MoreDetails>

      <Sources circular={circular} />
    </section>
  );
}
