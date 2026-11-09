import "server-only";
import type { DatasetVersion, LabelTask, ModelVersion, TrainingRun } from "@/lib/session/types";
import { collection, nowIso } from "./db";

/**
 * 재학습 루프의 모의 저장소: 데이터셋 버전 · 학습 실행 · 모델 버전.
 * 학습은 실제로 돌지 않는다. 시작 시각으로부터 TRAINING_MS가 지나면 끝난 것으로 보고 후보 모델을 만든다.
 * 지표는 데이터셋에 들어간 검수 라벨 수로 결정적으로 계산한 가정값이다.
 */
export type DatasetRecord = DatasetVersion & { labelTaskIds: string[]; createdBy: string };

export const datasets = collection<DatasetRecord>("datasets");
export const trainingRuns = collection<TrainingRun>("training-runs");
export const models = collection<ModelVersion>("models");

export const MODEL_NAME = "rtdetr-waste";
export const TRAINING_MS = 24_000;

/** 배포 게이트 규칙. 핵심 지표 3개가 모두 나아지고, 지연 시간 증가가 10% 이내여야 한다. */
export const LATENCY_TOLERANCE = 0.1;

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export async function ensureLearningSeeds() {
  await datasets.seed(() => [
    { id: "ds-v7", createdAt: daysAgo(96), images: 3960, newLabels: 210, fromCorrections: 180, fromOutcomes: 30, note: "녹산·사상 단지 시범 수집분", labelTaskIds: [], createdBy: "ML 담당" },
    { id: "ds-v8", createdAt: daysAgo(64), images: 4480, newLabels: 520, fromCorrections: 410, fromOutcomes: 110, note: "테이프·라벨 박스 보강", labelTaskIds: [], createdBy: "ML 담당" },
    { id: "ds-v9", createdAt: daysAgo(21), images: 4820, newLabels: 340, fromCorrections: 290, fromOutcomes: 50, note: "금속 칩 절삭유 이미지 추가", labelTaskIds: [], createdBy: "ML 담당" },
  ]);
  await models.seed(() => [
    { id: "mdl-v3.1", name: MODEL_NAME, version: "v3.1", createdAt: daysAgo(92), datasetVersion: "ds-v7", status: "archived", metrics: { mAP50: 0.802, contaminationMae: 0.036, verdictAgreement: 0.861, latencyMs: 112 } },
    { id: "mdl-v3.2", name: MODEL_NAME, version: "v3.2", createdAt: daysAgo(60), datasetVersion: "ds-v8", status: "production", metrics: { mAP50: 0.824, contaminationMae: 0.031, verdictAgreement: 0.874, latencyMs: 108 } },
    // 판정 일치율이 떨어져 배포 게이트를 통과하지 못한 후보
    { id: "mdl-v3.3-rc1", name: MODEL_NAME, version: "v3.3-rc1", createdAt: daysAgo(20), datasetVersion: "ds-v9", status: "candidate", metrics: { mAP50: 0.836, contaminationMae: 0.029, verdictAgreement: 0.859, latencyMs: 111 } },
  ]);
  await trainingRuns.seed(() => [
    { id: "tr-0907", startedAt: daysAgo(93), finishedAt: daysAgo(92), datasetVersion: "ds-v7", baseModel: "v3.0", status: "succeeded", progress: 1, resultModelId: "mdl-v3.1", triggeredBy: "ML 담당" },
    { id: "tr-1009", startedAt: daysAgo(61), finishedAt: daysAgo(60), datasetVersion: "ds-v8", baseModel: "v3.1", status: "succeeded", progress: 1, resultModelId: "mdl-v3.2", triggeredBy: "ML 담당" },
    { id: "tr-1019", startedAt: daysAgo(21), finishedAt: daysAgo(20), datasetVersion: "ds-v9", baseModel: "v3.2", status: "succeeded", progress: 1, resultModelId: "mdl-v3.3-rc1", triggeredBy: "ML 담당" },
  ]);
}

export function runProgress(run: TrainingRun, now = Date.now()) {
  if (run.status !== "running" && run.status !== "queued") return run.progress;
  return Math.min(1, Math.max(0, (now - Date.parse(run.startedAt)) / TRAINING_MS));
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** 데이터셋 구성으로 후보 지표를 정한다. 현장 수정은 검출·오염 비율을, 업체 실제 결과는 판정 일치율을 끌어올린다. */
export function candidateMetrics(base: ModelVersion["metrics"], ds: DatasetVersion): ModelVersion["metrics"] {
  const corr = Math.min(ds.fromCorrections, 12);
  const out = Math.min(ds.fromOutcomes, 6);
  return {
    mAP50: r3(Math.min(0.97, base.mAP50 + 0.006 + corr * 0.0025 + out * 0.001)),
    contaminationMae: r4(Math.max(0.008, base.contaminationMae - 0.001 - corr * 0.0004)),
    verdictAgreement: r3(Math.min(0.99, base.verdictAgreement + 0.004 + out * 0.005 + corr * 0.001)),
    latencyMs: base.latencyMs + 2 + (ds.images % 3),
  };
}

function nextVersion(production: string, existing: ModelVersion[]) {
  const m = /^v(\d+)\.(\d+)/.exec(production);
  const major = m ? Number(m[1]) : 3;
  const minor = m ? Number(m[2]) + 1 : 3;
  const prefix = `v${major}.${minor}`;
  const rc = existing.filter((x) => x.version.startsWith(`${prefix}-rc`)).length + 1;
  return `${prefix}-rc${rc}`;
}

/** 끝난 학습을 마무리하고 후보 모델을 만든다. 페이지를 열 때마다 부른다. */
export async function syncTrainingRuns() {
  const now = Date.now();
  const running = await trainingRuns.filter((r) => r.status === "running" || r.status === "queued");
  for (const run of running) {
    if (runProgress(run, now) < 1) continue;
    const all = await models.all();
    const production = all.find((x) => x.status === "production");
    const ds = await datasets.get(run.datasetVersion);
    if (!production || !ds) {
      await trainingRuns.update(run.id, (r) => ({ ...r, status: "failed", finishedAt: nowIso(), progress: 1 }));
      continue;
    }
    const version = nextVersion(production.version, all);
    const id = `mdl-${version}`;
    // 쓰기는 순서대로 처리되므로, 먼저 실행 상태를 바꾼 요청 하나만 후보 모델을 만든다
    let claimed = false as boolean;
    await trainingRuns.update(run.id, (r) => {
      if (r.status !== "running" && r.status !== "queued") return r;
      claimed = true;
      return { ...r, status: "succeeded", progress: 1, finishedAt: nowIso(), resultModelId: id };
    });
    if (!claimed) continue;
    for (const old of all.filter((x) => x.status === "candidate")) {
      await models.update(old.id, (x) => ({ ...x, status: "archived" }));
    }
    await models.insert({
      id,
      name: MODEL_NAME,
      version,
      createdAt: nowIso(),
      datasetVersion: ds.id,
      status: "candidate",
      metrics: candidateMetrics(production.metrics, ds),
    });
  }
}

export type MetricKey = keyof ModelVersion["metrics"];

export const METRICS: { key: MetricKey; label: string; better: "higher" | "lower"; core: boolean; unit: "ratio" | "ms" }[] = [
  { key: "mAP50", label: "검출 정확도 (mAP50)", better: "higher", core: true, unit: "ratio" },
  { key: "contaminationMae", label: "오염 비율 오차 (MAE)", better: "lower", core: true, unit: "ratio" },
  { key: "verdictAgreement", label: "판정 일치율 (업체 실제 결과 대비)", better: "higher", core: true, unit: "ratio" },
  { key: "latencyMs", label: "지연 시간 (사진 1장)", better: "lower", core: false, unit: "ms" },
];

export type MetricDiff = { key: MetricKey; improved: boolean; worse: boolean; delta: number };

export function compareModels(prod: ModelVersion, cand: ModelVersion) {
  const diffs: MetricDiff[] = METRICS.map((m) => {
    const delta = cand.metrics[m.key] - prod.metrics[m.key];
    const improved = m.better === "higher" ? delta > 0 : delta < 0;
    const worse = m.better === "higher" ? delta < 0 : delta > 0;
    return { key: m.key, improved, worse, delta };
  });
  const coreOk = METRICS.filter((m) => m.core).every((m) => diffs.find((d) => d.key === m.key)?.improved);
  const latencyOk = cand.metrics.latencyMs <= prod.metrics.latencyMs * (1 + LATENCY_TOLERANCE);
  const blockers: string[] = [];
  for (const m of METRICS.filter((x) => x.core)) {
    if (!diffs.find((d) => d.key === m.key)?.improved) blockers.push(`${m.label}가 운영 모델보다 나아지지 않았습니다.`);
  }
  if (!latencyOk) blockers.push(`지연 시간이 운영 모델보다 ${Math.round(LATENCY_TOLERANCE * 100)}% 넘게 늘었습니다.`);
  return { diffs, passed: coreOk && latencyOk, blockers };
}

/** 아직 어느 데이터셋에도 들어가지 않은, 검수에서 수락한 라벨 */
export function unusedAcceptedLabels(tasks: LabelTask[], ds: DatasetRecord[]) {
  const used = new Set(ds.flatMap((d) => d.labelTaskIds));
  return tasks.filter((t) => t.status === "accepted" && !used.has(t.id));
}
