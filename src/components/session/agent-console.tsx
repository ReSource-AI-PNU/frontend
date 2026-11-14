"use client";

import { useActionState, useEffect, useRef } from "react";
import { AGENT_LABEL, type RunEventView } from "@/lib/run-log-labels";
import { runCommand } from "@/lib/server/session-actions";
import { FLOW_STEPS } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

type CommandState = { message?: string; error?: string } | undefined;

export type ConsoleStatus = { label: string; live: boolean };

const STEP_LABEL = Object.fromEntries(FLOW_STEPS.map((f) => [f.slug, `${f.agent} · ${f.label}`])) as Record<string, string>;

/**
 * 에이전트 실행 콘솔(화면 오른쪽). 에이전트가 무엇을 근거로 어떤 도구를 불러 무엇을 정했는지 시간순으로 보여 준다.
 * 한 줄 요약이 먼저 보이고, 설명·도구·근거가 있는 줄은 눌러서 펼친다(DESIGN.md "상세 보기").
 * AI가 한 일은 형광펜 점, 사람이 한 일(확정·수정·승인·명령·회신)은 먹색 점이다.
 * 아래 명령창은 화면에서 할 수 있는 일을 말로 시키는 곳이고, 외부 발송 승인은 하지 않는다.
 */
export function AgentConsole({
  sessionId,
  events,
  status,
  onClose,
}: {
  sessionId: string;
  events: RunEventView[];
  status: ConsoleStatus;
  onClose?: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [state, action, pending] = useActionState<CommandState, FormData>(runCommand.bind(null, sessionId), undefined);
  const last = events.at(-1)?.id;

  // 새 기록이 들어오면 맨 아래로 내린다
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  const ai = events.filter((e) => e.actor === "ai");
  const stats = [
    `에이전트 ${new Set(ai.map((e) => e.agent)).size}`,
    `도구 호출 ${events.filter((e) => e.kind === "tool").length}`,
    `근거 ${events.reduce((a, e) => a + (e.refs?.length ?? 0), 0)}`,
    `사람 ${events.filter((e) => e.actor === "human").length}`,
  ];

  return (
    <section aria-labelledby="console-title" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="border-b border-line px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="console-title" className="text-[15px] font-semibold">
            에이전트 실행 기록 · 시연
          </h2>
          {onClose ? (
            <button type="button" onClick={onClose} className="min-h-9 rounded-md px-2 text-[13px] text-muted hover:bg-sunken hover:text-ink">
              닫기
            </button>
          ) : null}
        </div>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
          <span
            aria-hidden="true"
            className={`inline-block size-2 rounded-full ${status.live ? "animate-pulse bg-marker shadow-[0_0_0_1px_var(--color-ink)] motion-reduce:animate-none" : "bg-muted"}`}
          />
          {status.label}
        </p>
        <p className="mt-1 text-[12px] text-ink-2">모의 실행 기록입니다. 표시된 모델과 도구는 실제 호출되지 않았습니다.</p>
        <p className="num mt-1 text-[11.5px] text-muted">{stats.join(" · ")}</p>
      </header>

      <ol ref={listRef} aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 ? <li className="px-2 py-3 text-[13px] text-muted">아직 기록이 없습니다.</li> : null}
        {events.map((e, i) => {
          const prev = events[i - 1];
          const heading = e.step && e.step !== prev?.step ? STEP_LABEL[e.step] : null;
          const more = Boolean(e.detail || e.tool || e.refs?.length);
          const line = (
            <span className="grid grid-cols-[52px_10px_minmax(0,1fr)] items-baseline gap-x-2">
              <span className="num text-[11px] text-muted">{e.time}</span>
              <span
                aria-hidden="true"
                className={`mt-[5px] inline-block size-2 self-start rounded-full ${e.actor === "human" ? "bg-ink" : "bg-marker shadow-[0_0_0_1px_var(--color-ink)]"}`}
              />
              <span className="min-w-0">
                <span className="mr-1.5 text-[11.5px] text-muted">
                  {e.actor === "human" ? (e.kind === "command" ? "사람 명령" : "사람") : AGENT_LABEL[e.agent]}
                </span>
                <span className={`text-[13px] ${e.kind === "ask" ? "font-semibold text-warn" : e.kind === "result" || e.actor === "human" ? "text-ink" : "text-ink-2"}`}>
                  {e.title}
                </span>
                {e.tool ? <span className="num block truncate text-[11px] text-muted">{e.tool}</span> : null}
              </span>
            </span>
          );
          return (
            <li key={e.id}>
              {heading ? <p className="mt-3 mb-1 px-2 text-[11.5px] font-semibold text-muted first:mt-1">{heading}</p> : null}
              {more ? (
                <details className="group/ev rounded-md px-2 py-1.5 open:bg-sunken hover:bg-sunken/70">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{line}</summary>
                  <div className="mt-1.5 ml-[72px] grid gap-1.5 pb-1 text-[12.5px] leading-relaxed text-ink-2">
                    {e.detail ? <p>{e.detail}</p> : null}
                    {e.refs?.length ? (
                      <ul className="grid gap-1">
                        {e.refs.map((r) => (
                          <li key={r} className="underline decoration-marker decoration-[3px] underline-offset-2 [text-decoration-skip-ink:none]">
                            {r}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {e.durationMs ? <p className="num text-[11px] text-muted">{(e.durationMs / 1000).toFixed(1)}초</p> : null}
                  </div>
                </details>
              ) : (
                <div className="rounded-md px-2 py-1.5">{line}</div>
              )}
            </li>
          );
        })}
      </ol>

      <form action={action} className="grid gap-2 border-t border-line px-4 py-3">
        <label htmlFor="console-command" className="text-[12.5px] font-semibold">
          에이전트에게 명령
        </label>
        <div className="flex gap-2">
          <input
            id="console-command"
            name="command"
            autoComplete="off"
            maxLength={200}
            placeholder="예: 필름은 매각으로 바꿔 줘"
            className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-[14px] placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <button type="submit" disabled={pending} className={buttonClass("secondary", "sm", "h-10")}>
            {pending ? "실행 중…" : "실행"}
          </button>
        </div>
        <p role="status" className={`min-h-4 text-[12px] ${state?.error ? "text-loss" : "text-ink-2"}`}>
          {state?.error ?? state?.message ?? "경로 바꾸기, 다시 계산, 탄소 기준, 상황 요약을 알아듣습니다. 외부 발송 승인은 하지 않습니다."}
        </p>
      </form>
    </section>
  );
}
