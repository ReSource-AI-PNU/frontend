"use client";

import type { Stage, StageStatus } from "@/lib/v3/types";

const NUM = ["①", "②", "③", "④", "⑤", "⑥"];
const LABEL: Record<StageStatus, string> = {
  waiting: "대기",
  running: "진행",
  done: "완료",
  needs_check: "확인 필요",
};
const TONE: Record<StageStatus, string> = {
  waiting: "text-muted",
  running: "text-ink",
  done: "text-ink",
  needs_check: "text-warn",
};
const MARK: Record<StageStatus, string> = {
  waiting: "border border-line-strong bg-surface",
  running: "bg-marker ring-1 ring-ink",
  done: "bg-ink",
  needs_check: "bg-warn",
};

/** 대회 6단계 진행 막대. 누르면 그 단계의 메시지와 기록만 걸러 본다. */
export function StageBar({
  stages,
  selected,
  onSelect,
}: {
  stages: Stage[];
  selected: number | null;
  onSelect: (stage: number | null) => void;
}) {
  return (
    <nav aria-label="대회 6단계 진행" className="border-b border-line bg-surface">
      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage) => {
          const active = selected === stage.stage;
          return (
            <li key={stage.stage} className="border-r border-line last:border-r-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : stage.stage)}
                className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-sunken ${active ? "bg-sunken shadow-[inset_0_-2px_0_var(--color-ink)]" : ""}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden="true" className="font-mono">
                    {NUM[stage.stage - 1]}
                  </span>
                  {stage.label}
                </span>
                <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${TONE[stage.status]}`}>
                  <span aria-hidden="true" className={`size-2 rounded-full ${MARK[stage.status]}`} />
                  {LABEL[stage.status]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {selected ? (
        <p className="border-t border-line px-4 py-2 text-[13px] text-muted">
          {NUM[selected - 1]} 단계만 보고 있습니다.{" "}
          <button type="button" className="font-semibold text-ink underline" onClick={() => onSelect(null)}>
            전체 보기
          </button>
        </p>
      ) : null}
    </nav>
  );
}
