"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { MoreDetails } from "@/components/ui/more-details";
import { eventSummary } from "@/lib/v3/labels";
import { actorLabel, RUN_KIND_LABEL, summarizeRun } from "@/lib/v3/run-log";
import type { RunEvent } from "@/lib/v3/types";

const TICK = "color-mix(in oklab, var(--color-chart-1) 38%, transparent)";

/**
 * AI가 한 일: 찾기 한 번에 남은 실행 기록을 그림으로 보여 준다. 숫자 줄, 누가 어느 차례에 움직였는지(가로축은 기록 순서),
 * 판단 도구별 호출 횟수, 도구가 낸 판정. 모두 기록에서 센 값이고 만든 값이 없다.
 * 줄 위에 마우스를 올리거나 포커스를 두고 좌우 방향키를 누르면 그 기록 한 건이 아래에 적힌다. 같은 내용은 "기록 전체 보기"에 글로 있다.
 */
export function RunLog({ events }: { events: RunEvent[] }) {
  const run = useMemo(() => summarizeRun(events), [events]);
  const [at, setAt] = useState<number | null>(null);
  const total = run.total;
  if (total === 0) return null;
  const picked = at === null ? null : events[at];
  const maxTool = run.tools[0]?.count ?? 1;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setAt((before) => Math.max(0, Math.min(total - 1, (before ?? -1) + (event.key === "ArrowRight" ? 1 : -1))));
  };

  const stats: { label: string; value: string; note: string }[] = [
    { label: "실행 기록", value: `${total}`, note: "이번 찾기에 남은 건수" },
    { label: "판단 도구 호출", value: `${run.toolCalls}`, note: `${run.toolKinds}가지 도구` },
    {
      label: "근거 검증",
      value: `${run.validationsPassed} / ${run.validations}`,
      note: run.validationsPassed === run.validations ? "모두 통과" : `${run.validations - run.validationsPassed}건은 돌려보내 다시 씀`,
    },
    { label: "AI 메시지", value: `${run.messages}`, note: "두 AI가 주고받은 글" },
    { label: "담당자 질문", value: `${run.questions}`, note: "사람에게 물은 것" },
  ];

  return (
    <div className="space-y-8 pb-2">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((item) => (
          <div key={item.label}>
            <dt className="text-[13px] text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-[24px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{item.value}</dd>
            <dd className="text-[12.5px] text-muted">{item.note}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="text-[14px] font-semibold">누가 어느 차례에 움직였나</h3>
        <div
          tabIndex={0}
          role="group"
          aria-label={`실행 기록 ${total}건의 차례. 좌우 방향키로 한 건씩 봅니다`}
          onKeyDown={onKey}
          onMouseLeave={() => setAt(null)}
          className="mt-3 rounded-md outline-offset-4"
        >
          {run.lanes.map((lane) => (
            <div key={lane.key} className="grid h-7 grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[13px]">
              <span className="truncate">{lane.label}</span>
              <div
                className="relative h-[18px] overflow-hidden rounded-sm border border-line"
                onMouseMove={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  setAt(Math.max(0, Math.min(total - 1, Math.floor(((event.clientX - box.left) / box.width) * total))));
                }}
              >
                {lane.at.map((tick) => (
                  <span
                    key={tick.index}
                    className="absolute inset-y-0"
                    style={{
                      left: `${(tick.index / total) * 100}%`,
                      width: `max(2px, ${100 / total}%)`,
                      background: tick.message ? "var(--color-chart-1)" : TICK,
                    }}
                  />
                ))}
                {at !== null ? <span className="pointer-events-none absolute inset-y-0 w-px bg-ink" style={{ left: `${((at + 0.5) / total) * 100}%` }} /> : null}
              </div>
              <span className="text-right text-muted tabular-nums">{lane.count}</span>
            </div>
          ))}
          <div className="mt-1 grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] gap-3 text-[12px] text-muted">
            <span />
            <span className="flex justify-between">
              <span>기록 1번</span>
              <span>기록 순서</span>
              <span>{total}번</span>
            </span>
            <span />
          </div>
        </div>
        <p aria-live="polite" className="mt-2 min-h-10 text-[13px] text-muted">
          {picked ? (
            <>
              <span className="font-semibold text-ink tabular-nums">기록 {picked.seq}번</span> · {actorLabel(picked.actor)} · {RUN_KIND_LABEL[picked.kind]}
              <span className="block truncate">{eventSummary(picked.summary, picked.detail)}</span>
            </>
          ) : (
            "줄 위에 마우스를 올리면 그 기록이 보입니다. 진한 칸은 AI가 보낸 메시지입니다."
          )}
        </p>
      </section>

      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        <section>
          <h3 className="text-[14px] font-semibold">판단 도구별 호출 횟수</h3>
          <ul className="mt-3 space-y-1.5">
            {run.tools.map((tool) => (
              <li key={tool.id} className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-3 text-[13px]">
                <span className="truncate">{tool.label}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 rounded-r-sm rounded-l-[2px]" style={{ width: `${(tool.count / maxTool) * 82}%`, background: TICK }} />
                  <span className="text-muted tabular-nums">{tool.count}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {run.statuses.length > 0 ? (
          <section>
            <h3 className="text-[14px] font-semibold">판단 도구가 낸 판정</h3>
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {run.statuses.map((status, index) => (
                <span key={status.key} style={{ flexGrow: status.count, background: "var(--color-chart-1)", opacity: [1, 0.5, 0.25, 0.12][index] ?? 0.12 }} />
              ))}
            </div>
            <dl className="mt-3 space-y-1 text-[13px]">
              {run.statuses.map((status) => (
                <div key={status.key} className="flex justify-between">
                  <dt>{status.label}</dt>
                  <dd className="text-muted tabular-nums">{status.count}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <MoreDetails label="기록 전체 보기" closeLabel="기록 접기" hint={`${total}건`}>
        <ol className="mt-2 divide-y divide-line text-[13px]">
          {events.map((event) => (
            <li key={event.seq} className="grid grid-cols-[2.5rem_6rem_minmax(0,1fr)] gap-2 py-2">
              <span className="text-muted tabular-nums">{event.seq}</span>
              <span className="font-semibold">{actorLabel(event.actor)}</span>
              <span>{eventSummary(event.summary, event.detail)}</span>
            </li>
          ))}
        </ol>
      </MoreDetails>
    </div>
  );
}
