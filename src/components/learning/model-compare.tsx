import { josa, particle } from "@/lib/josa";
import { compareModels, LATENCY_TOLERANCE, METRICS, type MetricKey } from "@/lib/server/mock/learning";
import type { ModelVersion } from "@/lib/session/types";
import { Badge } from "../ui/badge";
import { DeployGate } from "./deploy-gate";

const MINUS = "−";

function fmt(key: MetricKey, v: number) {
  if (key === "mAP50") return v.toFixed(3);
  if (key === "latencyMs") return `${Math.round(v)}`;
  return `${(v * 100).toFixed(1)}`;
}

function fmtDelta(key: MetricKey, d: number) {
  const sign = d > 0 ? "+" : d < 0 ? MINUS : "±";
  const abs = Math.abs(d);
  if (key === "mAP50") return `${sign}${abs.toFixed(3)}`;
  if (key === "latencyMs") return `${sign}${Math.round(abs)}`;
  return `${sign}${(abs * 100).toFixed(1)}`;
}

const UNIT: Record<MetricKey, string> = { mAP50: "", contaminationMae: " (%p)", verdictAgreement: " (%)", latencyMs: " (ms)" };

/** 운영 모델과 후보 모델의 지표 비교표 + 배포 승인 게이트 */
export function ModelCompare({ production, candidate }: { production: ModelVersion; candidate: ModelVersion | null }) {
  if (!candidate) {
    return (
      <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
        비교할 후보 모델이 없습니다. 지금 운영 중인 모델은 <span className="num font-semibold text-ink">{production.version}</span>입니다. 새 데이터셋으로 재학습하면 후보가 생깁니다.
      </p>
    );
  }
  const { diffs, passed } = compareModels(production, candidate);
  const checks = [
    ...METRICS.filter((m) => m.core).map((m) => ({ label: `${josa(m.label, "이/가")} 나아졌습니다`, ok: diffs.find((d) => d.key === m.key)!.improved })),
    {
      label: "지연 시간 증가가 10% 이내입니다",
      ok: candidate.metrics.latencyMs <= production.metrics.latencyMs * (1 + LATENCY_TOLERANCE),
    },
  ];
  // 통과하지 못한 항목은 "나아지지 않았습니다"로 문장을 바꾼다
  const sentences = checks.map((c) => ({ ...c, label: c.ok ? c.label : c.label.replace("나아졌습니다", "나아지지 않았습니다").replace("10% 이내입니다", "10%를 넘었습니다") }));

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="overflow-x-auto lg:col-span-7">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <caption className="mb-2 text-left text-[13px] text-muted">
            검증 세트(현장 사진 612장, 시연용 가정값) 기준. 오염 비율 오차와 지연 시간은 낮을수록 좋습니다.
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">지표</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                운영 <span className="num">{production.version}</span>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                후보 <span className="num">{candidate.version}</span>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">변화</th>
              <th scope="col" className="py-2 font-semibold">판단</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const d = diffs.find((x) => x.key === m.key)!;
              return (
                <tr key={m.key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 pr-3 text-left font-medium">
                    {m.label}
                    {UNIT[m.key]}
                    {!m.core ? <span className="block text-[12px] font-normal text-muted">참고 지표 · 10% 이내 허용</span> : null}
                  </th>
                  <td className="num py-3 pr-3 text-right text-ink-2">{fmt(m.key, production.metrics[m.key])}</td>
                  <td className="num py-3 pr-3 text-right font-semibold">{fmt(m.key, candidate.metrics[m.key])}</td>
                  <td className="num py-3 pr-3 text-right">{fmtDelta(m.key, d.delta)}</td>
                  <td className="py-3">
                    {d.improved ? <Badge tone="gain">나아짐</Badge> : d.worse ? <Badge tone="loss">나빠짐</Badge> : <Badge tone="neutral">같음</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[12px] text-muted">
          후보 <span className="num">{candidate.version}</span>
          {particle(candidate.version, "은/는")} 데이터셋 <span className="num">{candidate.datasetVersion}</span>
          {particle(candidate.datasetVersion, "으로/로")} 학습했습니다. 판정 일치율은 처리업체가 기록한 실제 결과와 AI 판정이 같은 비율입니다.
        </p>
      </div>
      <div className="lg:col-span-5">
        <DeployGate
          candidateId={candidate.id}
          candidateVersion={candidate.version}
          productionVersion={production.version}
          checks={sentences}
          passed={passed}
        />
      </div>
    </div>
  );
}
