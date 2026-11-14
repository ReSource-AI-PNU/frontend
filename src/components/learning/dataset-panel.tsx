"use client";

import { startTransition, useActionState } from "react";
import { createDatasetVersion } from "@/lib/server/learning-actions";
import { buttonClass } from "../ui/button";

export type DatasetRow = {
  id: string;
  createdAt: string;
  createdLabel: string;
  images: number;
  newLabels: number;
  fromCorrections: number;
  fromOutcomes: number;
  note: string;
  createdBy: string;
  trained: boolean;
};

/** 데이터셋 버전 목록과 "검수한 라벨로 새 버전 만들기" */
export function DatasetPanel({
  rows,
  ready,
  readyCorrections,
  readyOutcomes,
}: {
  rows: DatasetRow[];
  ready: number;
  readyCorrections: number;
  readyOutcomes: number;
}) {
  const [state, action, pending] = useActionState(createDatasetVersion, undefined);

  return (
    <div className="grid gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
        className="grid gap-3 rounded-md bg-sunken px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)_auto] md:items-end"
      >
        <div className="text-sm">
          <p className="font-semibold">
            새 버전에 넣을 검수 라벨 <span className="tabular-nums">{ready}</span>건
          </p>
          <p className="text-[13px] text-muted">
            현장 수정 <span className="tabular-nums">{readyCorrections}</span>건 · 업체 실제 결과 <span className="tabular-nums">{readyOutcomes}</span>건. 검수에서 수락한 라벨만 들어갑니다.
          </p>
        </div>
        <label className="grid gap-1">
          <span className="text-[12px] font-semibold text-muted">메모 (선택)</span>
          <input
            name="note"
            maxLength={80}
            placeholder="예: 투명 테이프 박스 보강"
            className="min-h-[34px] rounded-md border border-line-strong bg-surface px-3 text-sm focus:border-ink focus:outline-none"
          />
        </label>
        <button type="submit" disabled={pending || ready === 0} className={buttonClass("secondary", "md")}>
          {pending ? "만드는 중…" : "검수한 라벨로 새 버전 만들기"}
        </button>
      </form>
      {state && "error" in state ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state ? (
        <p role="status" className="rounded-md bg-gain-bg px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <caption className="sr-only">데이터셋 버전 목록. 최신순입니다.</caption>
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">버전</th>
              <th scope="col" className="py-2 pr-3 font-semibold">만든 날</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">이미지 (장)</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">새 라벨 (건)</th>
              <th scope="col" className="py-2 pr-3 font-semibold">출처</th>
              <th scope="col" className="py-2 font-semibold">메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 text-left">
                  <span className="num font-semibold">{d.id}</span>
                  {i === 0 ? <span className="ml-2 text-[12px] font-normal text-muted">최신{d.trained ? "" : " · 학습 전"}</span> : null}
                </th>
                <td className="num py-2.5 pr-3 text-ink-2">{d.createdLabel}</td>
                <td className="num py-2.5 pr-3 text-right">{d.images.toLocaleString("ko-KR")}</td>
                <td className="num py-2.5 pr-3 text-right font-semibold">{d.newLabels.toLocaleString("ko-KR")}</td>
                <td className="py-2.5 pr-3 text-[13px] text-ink-2">
                  현장 수정 <span className="tabular-nums">{d.fromCorrections}</span> · 실제 결과 <span className="tabular-nums">{d.fromOutcomes}</span>
                </td>
                <td className="py-2.5 text-[13px] text-ink-2">
                  {d.note}
                  <span className="block text-[12px] text-muted">{d.createdBy}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
