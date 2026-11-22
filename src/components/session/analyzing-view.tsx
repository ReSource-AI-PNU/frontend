"use client";

import { useEffect, useState, useTransition } from "react";
import { finishAnalyzing } from "@/lib/server/session-actions";
import type { Stream } from "@/lib/session/types";
import { CheckIcon } from "../icons";
import { buttonClass } from "../ui/button";
import { DetectionBox, MediaView } from "./session-photo";
import { OriginChip } from "./stream-badges";

const PER_STREAM_MS = 1100;
const TAIL_MS = 900;

/**
 * 분석 진행 화면. 흐름을 하나씩 분석하며 사진 위에 박스를 그리고, 오른쪽 목록에 재질과 출처 판정을 채운다.
 * 끝나면 흐름 식별 화면으로 넘어간다. 모션 감소 설정이면 바로 결과를 보여 준다.
 */
export function AnalyzingView({ sessionId, streams }: { sessionId: string; streams: Stream[] }) {
  // done = 분석을 마친 흐름 수, phase = 지금 흐름의 단계(0 품목, 1 이물)
  const [done, setDone] = useState(0);
  const [phase, setPhase] = useState(0);
  const [pending, startTransition] = useTransition();
  const finished = done >= streams.length;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const t = setTimeout(() => setDone(streams.length), 0);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    streams.forEach((_, i) => {
      timers.push(setTimeout(() => setPhase(1), i * PER_STREAM_MS + PER_STREAM_MS * 0.45));
      timers.push(
        setTimeout(() => {
          setDone(i + 1);
          setPhase(0);
        }, (i + 1) * PER_STREAM_MS),
      );
    });
    timers.push(setTimeout(() => startTransition(() => finishAnalyzing(sessionId)), streams.length * PER_STREAM_MS + TAIL_MS));
    return () => timers.forEach(clearTimeout);
  }, [streams, sessionId]);

  const current = streams[Math.min(done, streams.length - 1)];
  const visible = finished
    ? current.classify.detections
    : current.classify.detections.filter((d) => (d.kind === "item" ? true : phase >= 1));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <figure className="relative aspect-[4/3] overflow-hidden rounded-lg bg-photo">
        {current.media[0] ? <MediaView key={current.id} media={current.media[0]} label={`${current.name} 사진`} /> : null}
        {visible.map((d) => (
          <DetectionBox key={d.id} d={d} />
        ))}
        {!finished ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full motion-safe:animate-[rs-scan_1.1s_linear_infinite]">
            <div className="h-px w-full bg-marker shadow-[0_0_12px_2px_var(--color-marker)]" />
          </div>
        ) : null}
        <figcaption className="absolute bottom-2.5 left-3 rounded-sm bg-photo/40 px-2 py-0.5 text-[12px] text-white/80">
          {current.name} · {current.process || "공정 미지정"}
        </figcaption>
      </figure>

      <div>
        <p className="text-label text-muted">① 식별·분류 에이전트</p>
        <h1 className="mt-1 text-h1">{finished ? "흐름 분석을 마쳤습니다" : `흐름 ${streams.length}개를 분석하고 있습니다`}</h1>
        <p className="mt-1 text-sm text-muted">흐름마다 재질, 단일 재질 여부, 이물, 출처(공정 부산물·사용 후 포장재)를 판정합니다.</p>
        <ol className="mt-6 border-t border-line" aria-live="polite">
          {streams.map((s, i) => {
            const state = i < done ? "done" : i === done && !finished ? "active" : "todo";
            const contam = s.classify.detections.filter((d) => d.kind === "contaminant").length;
            return (
              <li key={s.id} data-state={state} className="grid gap-1.5 border-b border-line py-3.5 data-[state=todo]:text-muted">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid size-[22px] shrink-0 place-items-center rounded-full border text-[12px] [&_svg]:size-3 ${state === "done" ? "border-ink bg-ink text-on-ink" : state === "active" ? "border-ink motion-safe:animate-pulse" : "border-line-strong"}`}
                    >
                      {state === "done" ? <CheckIcon /> : <span className="num">{i + 1}</span>}
                    </span>
                    <span className={state === "active" ? "font-semibold" : ""}>{s.name}</span>
                  </span>
                  {state === "done" ? <OriginChip origin={s.origin} source="ai" /> : null}
                </div>
                {state === "done" ? (
                  <p className="pl-[34px] text-[13px] text-ink-2">
                    <span className="num">{s.classify.material}</span> · {s.classify.singleMaterial ? "단일 재질" : "재질 혼합"} · 이물 {contam}종 · 추정 <span className="num">{s.monthlyKg}</span>kg/월
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[12px] text-muted">
          모델 <span className="num">{streams[0]?.classify.model.name} {streams[0]?.classify.model.version}</span> · 흐름당 프레임 24장
        </p>
        {finished ? (
          <button type="button" disabled={pending} onClick={() => startTransition(() => finishAnalyzing(sessionId))} className={`${buttonClass("primary")} mt-6`}>
            {pending ? "여는 중…" : "흐름 식별 결과 보기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
