"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/v3/api";
import { PHASE_LABEL, THREAD_LABEL, formatDateTime, sessionLabel as labelOf } from "@/lib/v3/format";
import { JudgementGraph } from "./judgement-graph";
import { Questions } from "./questions";
import { ResultSheet } from "./result-sheet";
import { StageBar } from "./stage-bar";
import { StreamTable } from "./stream-table";
import { Timeline } from "./timeline";
import { useV3 } from "./context";
import { useDiagnosis } from "./use-diagnosis";

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
  const started = view.stages.some((item) => item.status !== "waiting");
  const sessionLabel = labelOf(view.session.status, view.session.phase, started);
  // 합의 없이 끝났거나, 합의한 대화가 모두 담당자에게 넘어가 승인할 대화가 남지 않은 진단
  const ended = view.session.status === "idle" && view.session.phase === "done";
  const closed = view.threads.filter((item) => item.status === "handoff" || item.status === "declined");
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
            <span className="font-semibold text-ink">{sessionLabel}</span> · 진행 단계{" "}
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
          {isEmitter && d.canAct && (view.session.status === "confirmed" || ended) ? (
            <Button variant="secondary" disabled={d.busy} onClick={d.start}>
              새 진단 시작
            </Button>
          ) : null}
          {view.session.status === "awaiting_approval" ? (
            <Link href="/v3/approval" className={buttonClass("primary", "md")}>
              승인 화면으로
            </Link>
          ) : isEmitter && view.session.status !== "confirmed" && !ended ? (
            <Button
              disabled={!d.canAct || d.busy || view.session.status === "running" || openQuestions > 0}
              onClick={d.run}
              title={openQuestions > 0 ? "담당자 질문에 먼저 답하세요" : undefined}
            >
              {view.session.status === "running" || d.busy ? "실행 중" : started ? "이어서 실행" : "실행"}
            </Button>
          ) : null}
        </div>
      </header>
      {d.error ? (
        <p role="alert" className="border-b border-line bg-loss-bg px-4 py-2.5 text-sm text-loss sm:px-6 lg:px-8">
          {d.error}
        </p>
      ) : null}

      {ended || closed.length > 0 ? (
        <div role="status" className="border-b border-line bg-warn-bg px-4 py-2.5 text-sm text-warn sm:px-6 lg:px-8">
          {ended ? (
            <p className="font-semibold">
              승인할 합의가 남지 않아 진단이 끝났습니다. 아래 대화의 사유를 확인한 뒤 담당자가 직접 처리하거나 자료를
              고쳐 새 진단을 시작하세요.
            </p>
          ) : null}
          <ul className={ended ? "mt-1 space-y-0.5" : "space-y-0.5"}>
            {closed.map((item) => (
              <li key={item.id}>
                <span className="font-semibold">
                  {item.vendorName} · {THREAD_LABEL[item.status]}
                </span>
                {item.statusReason ? ` · ${item.statusReason}` : ""}
              </li>
            ))}
          </ul>
        </div>
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
        <StreamTable
          streams={view.streams}
          unresolved={view.unresolved}
          corrections={view.feedback.corrections}
          onCorrect={
            isEmitter && d.canAct
              ? async (body) => {
                  await api.recordCorrection(view.session.id, org.id, body);
                  d.reload();
                }
              : undefined
          }
        />
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
                {events.map((event) => {
                  const hidden = event.detail.hiddenEvidenceCount;
                  return (
                    <li key={event.seq} className="grid grid-cols-[4.5rem_1fr] gap-2 px-5 py-2">
                      <span className="font-mono text-muted">{formatDateTime(event.at, "time")}</span>
                      <span>
                        <span className="font-semibold">{ACTOR_LABEL[event.actor] ?? event.actor}</span>{" "}
                        {event.summary}
                        {typeof hidden === "number" && hidden > 0 ? (
                          <span className="block text-[12px] text-muted">
                            상대 조직의 근거 <span className="font-mono">{hidden}</span>건은 보이지 않습니다
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </details>
        </section>
      </div>

      <section aria-label="결과 한 장">
        <h2 className="border-b border-line px-5 py-3 text-label text-muted">결과 한 장</h2>
        <ResultSheet
          result={view.result}
          streams={view.streams}
          unresolved={view.unresolved}
          role={view.viewer.role}
          vendorName={nameOf}
        />
      </section>
    </div>
  );
}
