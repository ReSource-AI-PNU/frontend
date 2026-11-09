"use client";

import { useEffect, useState, useTransition } from "react";
import { finishAnalyzing } from "@/lib/server/session-actions";
import type { ClassifyResult, Media } from "@/lib/session/types";
import { CheckIcon } from "../icons";
import { buttonClass } from "../ui/button";
import { DetectionBox, MediaView } from "./session-photo";

const STAGES = [
  { label: "프레임 추출", detail: (c: ClassifyResult) => `${c.frames}장`, ms: 800 },
  { label: "품목 탐지", detail: (c: ClassifyResult) => `${c.model.name} ${c.model.version}`, ms: 1400 },
  { label: "이물질 탐지·추적", detail: () => "ByteTrack", ms: 1400 },
  { label: "수량 추정", detail: (c: ClassifyResult) => `약 ${c.estimatedKg.toLocaleString("ko-KR")}kg`, ms: 800 },
];

/** 분석 진행 화면. 단계가 끝날 때마다 사진 위에 박스가 나타나고, 끝나면 식별 결과로 넘어간다. */
export function AnalyzingView({ sessionId, media, classify }: { sessionId: string; media: Media | undefined; classify: ClassifyResult }) {
  const [done, setDone] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setDone(STAGES.length), 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i >= STAGES.length) return;
      timer = setTimeout(() => {
        i += 1;
        setDone(i);
        tick();
      }, STAGES[i].ms);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (done === STAGES.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => startTransition(() => finishAnalyzing(sessionId)), 700);
      return () => clearTimeout(t);
    }
  }, [done, sessionId]);

  const visible = classify.detections.filter((d) => (d.kind === "item" ? done >= 2 : done >= 3));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <figure className="relative aspect-[4/3] overflow-hidden rounded-lg bg-photo">
        {media ? <MediaView media={media} label="분석 중인 폐기물 사진" /> : null}
        {visible.map((d) => (
          <DetectionBox key={d.id} d={d} />
        ))}
        {done < STAGES.length ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full motion-safe:animate-[rs-scan_2.2s_linear_infinite]">
            <div className="h-px w-full bg-marker shadow-[0_0_12px_2px_var(--color-marker)]" />
          </div>
        ) : null}
        <figcaption className="absolute bottom-2.5 left-3 text-[12px] text-white/60">{media?.name}</figcaption>
      </figure>

      <div>
        <p className="text-label text-muted">① 식별·분류 에이전트</p>
        <h1 className="mt-1 text-h1">{done < STAGES.length ? "사진을 분석하고 있습니다" : "분석을 마쳤습니다"}</h1>
        <p className="mt-1 text-sm text-muted">보통 5초 안팎이 걸립니다. 이 화면을 떠나도 분석은 계속됩니다.</p>
        <ol className="mt-6 border-t border-line" aria-live="polite">
          {STAGES.map((s, i) => {
            const state = i < done ? "done" : i === done ? "active" : "todo";
            return (
              <li key={s.label} data-state={state} className="flex items-center justify-between gap-4 border-b border-line py-3.5 text-sm data-[state=todo]:text-muted">
                <span className="flex items-center gap-3">
                  <span
                    className={`grid size-[22px] place-items-center rounded-full border text-[11px] [&_svg]:size-3 ${state === "done" ? "border-ink bg-ink text-on-ink" : state === "active" ? "border-ink motion-safe:animate-pulse" : "border-line-strong"}`}
                  >
                    {state === "done" ? <CheckIcon /> : <span className="num">{i + 1}</span>}
                  </span>
                  <span className={state === "active" ? "font-semibold" : ""}>{s.label}</span>
                </span>
                <span className="num text-[13px] text-muted">{state === "todo" ? "" : s.detail(classify)}</span>
              </li>
            );
          })}
        </ol>
        {done === STAGES.length ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => finishAnalyzing(sessionId))}
            className={`${buttonClass("primary")} mt-6`}
          >
            {pending ? "여는 중…" : "식별 결과 보기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
