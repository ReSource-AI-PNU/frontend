"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { particle } from "@/lib/josa";
import { startTraining } from "@/lib/server/learning-actions";
import type { TrainingRun } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

export type RunRow = TrainingRun & { startedLabel: string; resultVersion?: string };

const STATUS: Record<TrainingRun["status"], string> = { queued: "대기", running: "학습 중", succeeded: "완료", failed: "실패" };

function phase(p: number) {
  if (p < 0.15) return "데이터 불러오는 중";
  if (p < 0.8) return "학습 중";
  if (p < 1) return "검증 세트 평가 중";
  return "후보 모델 등록 중";
}

/** 진행 중인 학습의 진행률. 시작 시각 기준으로 브라우저에서 올리고, 끝나면 서버에 다시 물어 후보 모델을 받아 온다. */
function LiveProgress({ startedAt, durationMs, initial }: { startedAt: string; durationMs: number; initial: number }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  useEffect(() => {
    const start = Date.parse(startedAt);
    let refreshed = 0;
    const id = setInterval(() => {
      const next = Math.min(1, (Date.now() - start) / durationMs);
      setP(next);
      // 끝나면 2초마다 새로 고쳐 서버가 후보 모델을 만든 결과를 받는다
      if (next >= 1 && Date.now() - refreshed > 2000) {
        refreshed = Date.now();
        router.refresh();
      }
    }, 400);
    return () => clearInterval(id);
  }, [startedAt, durationMs, router]);
  const pct = Math.round(p * 100);
  return (
    <div className="grid gap-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="학습 진행률"
        className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-muted" aria-live="polite">
        <span className="tabular-nums">{pct}%</span> · {phase(p)}
      </p>
    </div>
  );
}

export function TrainingPanel({
  runs,
  canStart,
  blocker,
  nextDataset,
  baseModel,
  durationMs,
}: {
  runs: RunRow[];
  canStart: boolean;
  blocker?: string;
  nextDataset?: string;
  baseModel?: string;
  durationMs: number;
}) {
  const [state, action, pending] = useActionState(async () => startTraining(), undefined);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-md bg-sunken px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="text-sm">
          {canStart ? (
            <p>
              <span className="num font-semibold">{nextDataset}</span>
              {particle(nextDataset ?? "", "으로/로")} 운영 모델 <span className="num font-semibold">{baseModel}</span>
              {particle(baseModel ?? "", "을/를")} 이어서 학습합니다.
              <span className="block text-[13px] text-muted">시연에서는 실제 학습 대신 약 {Math.round(durationMs / 1000)}초 뒤 후보 모델이 생깁니다.</span>
            </p>
          ) : (
            <p className="text-muted">{blocker}</p>
          )}
        </div>
        <form action={action}>
          <button type="submit" disabled={!canStart || pending} className={buttonClass("secondary")}>
            {pending ? "시작하는 중…" : "재학습 시작"}
          </button>
        </form>
      </div>
      {state && "error" in state ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">학습 실행 목록. 최신순입니다.</caption>
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">실행</th>
              <th scope="col" className="py-2 pr-3 font-semibold">시작</th>
              <th scope="col" className="py-2 pr-3 font-semibold">데이터셋</th>
              <th scope="col" className="py-2 pr-3 font-semibold">기반 모델</th>
              <th scope="col" className="w-[220px] py-2 pr-3 font-semibold">상태</th>
              <th scope="col" className="py-2 font-semibold">결과 모델</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="num py-2.5 pr-3 text-left font-semibold">
                  {r.id}
                </th>
                <td className="num py-2.5 pr-3 text-ink-2">{r.startedLabel}</td>
                <td className="num py-2.5 pr-3">{r.datasetVersion}</td>
                <td className="num py-2.5 pr-3">{r.baseModel}</td>
                <td className="py-2.5 pr-3">
                  {r.status === "running" || r.status === "queued" ? (
                    <LiveProgress startedAt={r.startedAt} durationMs={durationMs} initial={r.progress} />
                  ) : (
                    <span className={r.status === "failed" ? "font-semibold text-loss" : ""}>
                      {STATUS[r.status]}
                      <span className="ml-1 text-[12px] text-muted">· {r.triggeredBy}</span>
                    </span>
                  )}
                </td>
                <td className="py-2.5">{r.resultVersion ? <span className="num font-semibold">{r.resultVersion}</span> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
