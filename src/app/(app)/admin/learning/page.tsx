import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { formatDate, formatDateTime } from "@/components/dashboard/format-date";
import { DatasetPanel } from "@/components/learning/dataset-panel";
import { KnowledgeReview } from "@/components/learning/knowledge-review";
import { LabelQueue } from "@/components/learning/label-queue";
import { LoopFlow } from "@/components/learning/loop-flow";
import { ModelCompare } from "@/components/learning/model-compare";
import { TrainingPanel } from "@/components/learning/training-panel";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  compareModels,
  datasets,
  ensureLearningSeeds,
  models,
  runProgress,
  syncTrainingRuns,
  TRAINING_MS,
  trainingRuns,
  unusedAcceptedLabels,
} from "@/lib/server/mock/learning";
import { requireOrganization } from "@/lib/server/organization";
import { ensureSeeds, knowledgeCards, labelTasks } from "@/lib/server/sessions";
import type { ModelVersion } from "@/lib/session/types";

export const metadata: Metadata = { title: "학습 콘솔" };

const MODEL_STATUS: Record<ModelVersion["status"], { label: string; tone: "gain" | "warn" | "neutral" | "ai" }> = {
  production: { label: "운영", tone: "gain" },
  candidate: { label: "후보", tone: "warn" },
  training: { label: "학습 중", tone: "neutral" },
  archived: { label: "보관", tone: "neutral" },
};

function Section({ id, no, title, description, children }: { id: string; no: number; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-20 gap-4 border-t border-line pt-8">
      <div>
        <h2 id={`${id}-h`} className="flex items-baseline gap-2 text-h2">
          <span className="num text-[15px] text-muted">{no}</span>
          {title}
        </h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

async function LearningConsolePageContent() {
  await requireOrganization();
  await ensureSeeds();
  await ensureLearningSeeds();
  await syncTrainingRuns();

  const [tasks, cards, dsAll, runsAll, modelsAll] = await Promise.all([
    labelTasks.all(),
    knowledgeCards.all(),
    datasets.all(),
    trainingRuns.all(),
    models.all(),
  ]);

  const pending = tasks.filter((t) => t.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviewed = tasks.filter((t) => t.status !== "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const reviewCards = cards
    .filter((c) => c.status === "proposed" || c.status === "reviewing")
    .sort((a, b) => b.agrees.length - a.agrees.length || b.createdAt.localeCompare(a.createdAt));

  const dsSorted = [...dsAll].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ready = unusedAcceptedLabels(tasks, dsAll);
  const latestDs = dsSorted[0];
  const runs = [...runsAll].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const active = runs.find((r) => r.status === "running" || r.status === "queued");
  const latestTrained = latestDs ? runs.some((r) => r.datasetVersion === latestDs.id && r.status === "succeeded") : true;
  const production = modelsAll.find((m) => m.status === "production");
  const candidate = [...modelsAll].filter((m) => m.status === "candidate").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const gate = production && candidate ? compareModels(production, candidate) : null;
  const versionOf = new Map(modelsAll.map((m) => [m.id, m.version]));

  const canStart = !active && !!latestDs && !latestTrained;
  const blocker = active
    ? `${active.id} 학습이 진행 중입니다. 끝나면 후보 모델이 생깁니다.`
    : latestTrained
      ? `최신 데이터셋 ${latestDs?.id ?? ""}로는 이미 학습했습니다. 검수한 라벨로 새 버전을 먼저 만드세요.`
      : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-h1">학습 콘솔</h1>
          <p className="mt-1 text-sm text-muted">
            현장 담당자의 수정과 처리업체의 실제 결과를 검수해 데이터셋으로 묶고, 재학습한 후보 모델이 운영 모델보다 나아졌을 때만 배포합니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone="neutral">관리자 전용(시연에서는 모두 접근)</Badge>
          <p className="text-[12px] text-muted">
            운영 모델 <span className="num font-semibold text-ink">{production ? `${production.name} ${production.version}` : "없음"}</span>
          </p>
        </div>
      </header>

      <LoopFlow
        stages={[
          {
            href: "#labels",
            label: "현장 수정·실제 결과",
            value: `${pending.length}건 대기`,
            note: `현장 ${pending.filter((t) => t.source === "현장 수정").length} · 업체 ${pending.filter((t) => t.source === "업체 실제 결과").length}`,
            attention: pending.length > 0,
          },
          {
            href: "#labels",
            label: "검수",
            value: `수락 ${ready.length}건`,
            note: "데이터셋에 넣을 수 있음",
          },
          {
            href: "#datasets",
            label: "데이터셋",
            value: latestDs?.id ?? "없음",
            note: ready.length > 0 ? "새 버전을 만들 수 있음" : `이미지 ${latestDs?.images.toLocaleString("ko-KR") ?? 0}장`,
            attention: ready.length > 0,
          },
          {
            href: "#training",
            label: "학습",
            value: active ? `학습 중 ${Math.round(runProgress(active) * 100)}%` : canStart ? "시작 가능" : "대기",
            note: active ? `${active.datasetVersion} 사용` : runs[0] ? `마지막 ${runs[0].id}` : "기록 없음",
            attention: canStart,
          },
          {
            href: "#compare",
            label: "비교",
            value: candidate ? `후보 ${candidate.version}` : "후보 없음",
            note: gate ? (gate.passed ? "게이트 통과" : "게이트 미통과") : "재학습 후 생김",
          },
          {
            href: "#compare",
            label: "배포",
            value: production?.version ?? "없음",
            note: gate?.passed ? "승인 대기" : "운영 중",
            attention: !!gate?.passed,
          },
        ]}
      />

      <Section
        id="labels"
        no={1}
        title="라벨 검수 큐"
        description="현장 담당자가 고친 박스·라벨·오염 비율과, 처리업체가 기록한 실제 결과입니다. 취소선이 AI 원래 값, 먹색 굵은 글씨가 사람이 고친 값입니다. 수락한 라벨만 다음 데이터셋에 들어갑니다."
      >
        <LabelQueue pending={pending} reviewed={reviewed} />
      </Section>

      <Section
        id="knowledge"
        no={2}
        title="현장 지식 카드 검토"
        description="담당자들이 남긴 판단 기준(암묵지)입니다. 채택한 카드는 같은 품목의 다음 판정에서 근거로 인용되고, 반려한 카드는 목록에만 남습니다."
      >
        <KnowledgeReview cards={reviewCards} />
      </Section>

      <Section id="datasets" no={3} title="데이터셋 버전" description="검수에서 수락한 라벨을 묶어 학습용 버전을 만듭니다. 버전은 지우지 않고 쌓아 두어, 어떤 모델이 어떤 데이터로 학습했는지 추적합니다.">
        <DatasetPanel
          ready={ready.length}
          readyCorrections={ready.filter((t) => t.source === "현장 수정").length}
          readyOutcomes={ready.filter((t) => t.source === "업체 실제 결과").length}
          rows={dsSorted.map((d) => ({
            id: d.id,
            createdAt: d.createdAt,
            createdLabel: formatDate(d.createdAt),
            images: d.images,
            newLabels: d.newLabels,
            fromCorrections: d.fromCorrections,
            fromOutcomes: d.fromOutcomes,
            note: d.note,
            createdBy: d.createdBy,
            trained: runs.some((r) => r.datasetVersion === d.id && r.status === "succeeded"),
          }))}
        />
      </Section>

      <Section id="training" no={4} title="학습 실행" description="최신 데이터셋으로 운영 모델을 이어서 학습합니다. 끝나면 후보 모델이 생기고 아래에서 운영 모델과 비교합니다.">
        <TrainingPanel
          runs={runs.map((r) => ({
            ...r,
            progress: runProgress(r),
            startedLabel: formatDateTime(r.startedAt),
            resultVersion: r.resultModelId ? versionOf.get(r.resultModelId) : undefined,
          }))}
          canStart={canStart}
          blocker={blocker}
          nextDataset={latestDs?.id}
          baseModel={production?.version}
          durationMs={TRAINING_MS}
        />
      </Section>

      <Section
        id="compare"
        no={5}
        title="모델 비교와 배포"
        description="같은 검증 세트로 운영 모델과 후보 모델을 비교합니다. 나아진 지표와 나빠진 지표를 함께 보고, 게이트를 통과한 후보만 사람이 승인해 배포합니다."
      >
        {production ? <ModelCompare production={production} candidate={candidate} /> : <p className="text-sm text-muted">운영 모델이 없습니다.</p>}
        <details className="mt-2">
          <summary className="min-h-[34px] cursor-pointer text-[13px] font-semibold text-ink-2">모델 버전 기록 {modelsAll.length}개 보기</summary>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {[...modelsAll]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="num font-semibold">
                      {m.name} {m.version}
                    </span>
                    <span className="ml-2 text-[12px] text-muted">
                      데이터셋 {m.datasetVersion} · <span className="tabular-nums">{formatDate(m.createdAt)}</span>
                    </span>
                  </span>
                  <Badge tone={MODEL_STATUS[m.status].tone}>{MODEL_STATUS[m.status].label}</Badge>
                </li>
              ))}
          </ul>
        </details>
      </Section>

      <p className="text-[12px] text-muted">
        학습·지표·데이터셋 수치는 시연용 모의 값입니다. 실제 학습은 백엔드 학습 파이프라인이 생기면 연결합니다. 여기서 배포한 운영 모델은 다음에 시작하는 판정부터 쓰입니다.
      </p>
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function LearningConsolePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LearningConsolePageContent />
    </Suspense>
  );
}
