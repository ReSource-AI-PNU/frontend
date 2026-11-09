"use server";

import { revalidatePath } from "next/cache";
import { nowIso } from "./mock/db";
import {
  compareModels,
  datasets,
  ensureLearningSeeds,
  models,
  syncTrainingRuns,
  trainingRuns,
  unusedAcceptedLabels,
} from "./mock/learning";
import { getCurrentUser } from "./session";
import { labelTasks } from "./sessions";

/*
 * 관리자 학습 콘솔의 서버 액션. 권한은 지금은 로그인한 사용자 모두에게 연다(시연).
 * 백엔드가 생기면 관리자 역할 확인을 여기서 한다.
 */

type Result = { ok: true; message?: string } | { error: string } | undefined;

const PATH = "/admin/learning";

export async function reviewLabel(taskId: string, decision: "accepted" | "rejected") {
  const user = await getCurrentUser();
  if (decision !== "accepted" && decision !== "rejected") return;
  await labelTasks.update(taskId, (t) => (t.status === "pending" ? { ...t, status: decision, reviewer: user.name } : t));
  revalidatePath(PATH);
}

/** 검수에서 수락했지만 아직 어느 버전에도 들어가지 않은 라벨로 새 데이터셋 버전을 만든다. */
export async function createDatasetVersion(_prev: Result, formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  await ensureLearningSeeds();
  const all = await datasets.all();
  const fresh = unusedAcceptedLabels(await labelTasks.all(), all);
  if (fresh.length === 0) return { error: "새로 수락한 라벨이 없습니다. 라벨 검수 큐에서 먼저 수락해 주세요." };
  const latest = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const nextNo = Math.max(0, ...all.map((d) => Number(/^ds-v(\d+)$/.exec(d.id)?.[1] ?? 0))) + 1;
  const fromCorrections = fresh.filter((t) => t.source === "현장 수정").length;
  const fromOutcomes = fresh.filter((t) => t.source === "업체 실제 결과").length;
  const note = String(formData.get("note") ?? "").trim().slice(0, 80);
  const id = `ds-v${nextNo}`;
  await datasets.insert({
    id,
    createdAt: nowIso(),
    images: (latest?.images ?? 0) + fresh.length,
    newLabels: fresh.length,
    fromCorrections,
    fromOutcomes,
    note: note || `검수 라벨 ${fresh.length}건 반영`,
    labelTaskIds: fresh.map((t) => t.id),
    createdBy: user.name,
  });
  revalidatePath(PATH);
  return { ok: true, message: `${id}를 만들었습니다. 이제 이 버전으로 재학습을 시작할 수 있습니다.` };
}

/** 가장 최근 데이터셋 버전으로 재학습을 시작한다(모의: 시간이 지나면 끝나고 후보 모델이 생긴다). */
export async function startTraining(): Promise<Result> {
  const user = await getCurrentUser();
  await ensureLearningSeeds();
  await syncTrainingRuns();
  const runs = await trainingRuns.all();
  if (runs.some((r) => r.status === "running" || r.status === "queued")) return { error: "이미 진행 중인 학습이 있습니다." };
  const latest = [...(await datasets.all())].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return { error: "데이터셋 버전이 없습니다." };
  if (runs.some((r) => r.datasetVersion === latest.id && r.status === "succeeded")) {
    return { error: `${latest.id}로는 이미 학습했습니다. 새 데이터셋 버전을 먼저 만들어 주세요.` };
  }
  const production = await models.find((m) => m.status === "production");
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  await trainingRuns.insert({
    id: `tr-${stamp}`,
    startedAt: now.toISOString(),
    datasetVersion: latest.id,
    baseModel: production?.version ?? "v3.2",
    status: "running",
    progress: 0,
    triggeredBy: user.name,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/** 배포 승인 게이트. 지표가 나아진 후보만 운영 모델로 올린다. */
export async function deployCandidate(modelId: string, _prev: Result, formData: FormData): Promise<Result> {
  await getCurrentUser();
  if (formData.get("confirm") !== "on") return { error: "지표 비교를 확인했다는 항목에 체크해 주세요." };
  const all = await models.all();
  const candidate = all.find((m) => m.id === modelId && m.status === "candidate");
  const production = all.find((m) => m.status === "production");
  if (!candidate || !production) return { error: "배포할 후보 모델을 찾을 수 없습니다." };
  const { passed } = compareModels(production, candidate);
  if (!passed) return { error: "지표가 나아지지 않은 후보는 배포할 수 없습니다." };
  await models.update(production.id, (m) => ({ ...m, status: "archived" }));
  await models.update(candidate.id, (m) => ({ ...m, status: "production" }));
  revalidatePath(PATH);
  return { ok: true, message: `${candidate.version}을 운영 모델로 배포했습니다.` };
}
