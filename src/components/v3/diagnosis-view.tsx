"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PHASE_LABEL } from "@/lib/v3/format";
import { JudgementGraph } from "./judgement-graph";
import { Questions } from "./questions";
import { ResultSheet } from "./result-sheet";
import { StageBar } from "./stage-bar";
import { StreamTable } from "./stream-table";
import { Timeline } from "./timeline";
import { useV3 } from "./context";
import { useDiagnosis } from "./use-diagnosis";

const SESSION_LABEL = {
  idle: "실행 전",
  running: "에이전트 대화 중",
  awaiting_answers: "담당자 답변 대기",
  awaiting_approval: "승인 대기",
  confirmed: "확정",
} as const;

const ACTOR_LABEL: Record<string, string> = {
  company_agent: "회사 측 에이전트",
  vendor_agent: "업체 측 에이전트",
  validator: "근거 검증기",
  tool: "판단 도구",
  system: "시스템",
};

export function DiagnosisView() {
  const { orgs, mode, fixture } = useV3();
  const d = useDiagnosis();
  const [stage, setStage] = useState<number | null>(null);
  const { view, org } = d;

  if (d.loading) {
    return <p className="p-8 text-sm text-muted">진단을 불러오는 중입니다.</p>;
  }

  if (!view) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {d.error ? (
          <p role="alert" className="mb-4 rounded-md bg-loss-bg px-4 py-3 text-sm text-loss">
            {d.error}{" "}
            <button type="button" className="font-semibold underline" onClick={d.forget}>
              저장된 진단 번호 지우기
            </button>
          </p>
        ) : null}
        <EmptyState
          title={mode === "fixture" ? "이 관점의 예시 데이터가 없습니다" : "진행 중인 진단이 없습니다"}
          description={
            mode === "fixture"
              ? `예시 데이터는 ${orgs.find((item) => item.id === fixture?.meta.emitterOrgId)?.name ?? "배출 기업 한 곳"}의 관점 하나만 담고 있습니다. 관점을 그쪽으로 바꾸거나, 백엔드를 띄우고 다시 연결하세요.`
              : org.role === "emitter"
                ? "자료를 올린 뒤 진단을 시작하면, 회사 측 에이전트가 맞는 업체의 에이전트와 근거를 확인하며 대화합니다."
                : "배출 기업이 진단을 시작하면 이 화면에 대화가 나타납니다. 진단은 배출 기업 관점에서 시작합니다."
          }
          action={
            mode === "live" && org.role === "emitter" ? (
              <Button disabled={d.busy} onClick={d.start}>
                진단 시작
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const nameOf = (orgId: string | null) =>
    orgs.find((item) => item.id === orgId)?.name ??
    view.threads.find((item) => item.vendorOrgId === orgId)?.vendorName ??
    orgId ??
    "확인 필요";
  const isEmitter = view.viewer.role === "emitter";
  const openQuestions = view.questions.filter((item) => !item.answered).length;
  const events = stage
    ? view.events.filter((event) => (event.detail as { stage?: number }).stage === stage)
    : view.events;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-h1">진단·연결</h1>
          <p className="text-sm text-muted">
            {nameOf(view.session.emitterOrgId)} ·{" "}
            <span className="font-semibold text-ink">{SESSION_LABEL[view.session.status]}</span> · 진행 단계{" "}
            {PHASE_LABEL[view.session.phase] ?? view.session.phase} ·{" "}
            <span className="font-mono text-[12px]">
              {view.session.id} · 기준일 {view.session.today}
            </span>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {d.canAct ? (
            <Button variant="ghost" size="sm" disabled={d.busy} onClick={d.reload}>
              다시 읽기
            </Button>
          ) : null}
          {isEmitter && d.canAct && view.session.status === "confirmed" ? (
            <Button variant="secondary" disabled={d.busy} onClick={d.start}>
              새 진단 시작
            </Button>
          ) : null}
          {isEmitter && view.session.status !== "confirmed" ? (
            <Button
              disabled={!d.canAct || d.busy || view.session.status === "running" || openQuestions > 0}
              onClick={d.run}
              title={openQuestions > 0 ? "담당자 질문에 먼저 답하세요" : undefined}
            >
              {view.session.status === "running" || d.busy
                ? "실행 중"
                : view.session.status === "idle"
                  ? "실행"
                  : "이어서 실행"}
            </Button>
          ) : null}
        </div>
      </header>
      {d.error ? (
        <p role="alert" className="border-b border-line bg-loss-bg px-4 py-2.5 text-sm text-loss sm:px-6 lg:px-8">
          {d.error}
        </p>
      ) : null}

      <StageBar stages={view.stages} selected={stage} onSelect={setStage} />
      {isEmitter ? (
        <Questions
          questions={view.questions}
          streams={view.streams}
          canAct={d.canAct}
          busy={d.busy}
          onAnswer={d.answer}
        />
      ) : null}

      <section aria-label="흐름" className="border-b border-line">
        <h2 className="border-b border-line px-5 py-3 text-label text-muted">
          흐름 {view.streams.length}개 · ① 식별·분류
        </h2>
        <StreamTable streams={view.streams} unresolved={view.unresolved} />
      </section>

      <div className="grid flex-1 border-b border-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="대화 타임라인" className="min-w-0 border-b border-line lg:border-r lg:border-b-0">
          <h2 className="border-b border-line px-5 py-3 text-label text-muted">대화 타임라인</h2>
          <Timeline
            threads={view.threads}
            streams={view.streams}
            emitterOrgId={view.session.emitterOrgId}
            emitterName={nameOf(view.session.emitterOrgId)}
            stage={stage}
          />
        </section>
        <section aria-label="판단 그래프" className="min-w-0">
          <h2 className="border-b border-line px-5 py-3 text-label text-muted">판단 그래프</h2>
          <JudgementGraph nodes={view.graph.nodes} edges={view.graph.edges} />
          <details className="border-t border-line">
            <summary className="cursor-pointer px-5 py-3 text-label text-muted">
              실행 기록 ({events.length}건)
            </summary>
            {events.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-muted">남은 실행 기록이 없습니다.</p>
            ) : (
              <ol className="max-h-72 divide-y divide-line overflow-y-auto text-[13px]">
                {events.map((event) => (
                  <li key={event.seq} className="grid grid-cols-[4.5rem_1fr] gap-2 px-5 py-2">
                    <span className="font-mono text-muted">{event.at.slice(11, 19)}</span>
                    <span>
                      <span className="font-semibold">{ACTOR_LABEL[event.actor] ?? event.actor}</span>{" "}
                      {event.summary}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        </section>
      </div>

      <section aria-label="결과 한 장">
        <h2 className="border-b border-line px-5 py-3 text-label text-muted">결과 한 장</h2>
        {view.viewer.role === "vendor" && !view.result ? (
          <p className="p-5 text-sm text-muted">
            결과 한 장은 배출 기업에게만 보입니다. 업체는 자기 대화와 승인 화면에서 조건을 확인합니다.
          </p>
        ) : (
          <ResultSheet
            result={view.result}
            streams={view.streams}
            unresolved={view.unresolved}
            vendorName={nameOf}
          />
        )}
      </section>
    </div>
  );
}
