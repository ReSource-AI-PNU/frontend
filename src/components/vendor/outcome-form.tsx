"use client";

import { startTransition, useActionState, useState } from "react";
import { recordOutcome } from "@/lib/server/session-actions";
import { buttonClass } from "../ui/button";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none";

export type OutcomePrediction = {
  /** 예: "PP 단일 · 공정 부산물(PIR)" */
  gradeLabel: string;
  /** AI 예상 kg당 손익(StreamDecision.afterPerKg) */
  perKg: number | null;
  /** 예상 단가 아래 작은 설명. 예: 묶음 운반비 분담 후 */
  perKgNote?: string;
  /** 이 흐름의 월 물량(배출 기업 한 곳 기준) */
  kg: number;
};

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ko-KR")}`;
}

/**
 * 수거 후 실제 결과 기록(처리업체). 흐름 하나(묶음·매각) 기준으로 AI 예상값(형광펜)과 업체가 적는 실제 값(먹)을 나란히 둔다.
 * 저장하면 진단이 "수거 완료"가 되고, 라벨 검수 큐에 "업체 실제 결과" 작업이 생긴다.
 */
export function OutcomeForm({
  sessionId,
  streamId,
  streamName,
  prediction,
  primary,
}: {
  sessionId: string;
  streamId: string;
  streamName: string;
  prediction: OutcomePrediction;
  primary: boolean;
}) {
  const [state, action, pending] = useActionState(recordOutcome.bind(null, sessionId, "처리업체"), undefined);
  const [accepted, setAccepted] = useState<"yes" | "no">("yes");
  const id = `${sessionId}-${streamId}`;

  if (state && "ok" in state) {
    return (
      <p role="status" className="rounded-md bg-gain-bg px-4 py-3 text-sm">
        {streamName} 흐름의 실제 결과를 기록했습니다. 담당자 화면과 대시보드에 반영되고, 관리자 라벨 검수 큐에 올라갔습니다.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4"
      aria-label={`${streamName} 수거 후 실제 결과 기록`}
    >
      <input type="hidden" name="streamId" value={streamId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">매입 여부</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["yes", "매입함"],
              ["no", "매입 거절"],
            ] as const
          ).map(([v, label]) => (
            <label
              key={v}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-sunken"
            >
              <input type="radio" name="accepted" value={v} checked={accepted === v} onChange={() => setAccepted(v)} className="accent-[var(--color-ink)]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{streamName} 흐름의 AI 예상값과 실제 값 비교 입력</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            <th scope="col" className="py-2 pr-3 font-semibold">항목</th>
            <th scope="col" className="py-2 pr-3 font-semibold">AI 예상</th>
            <th scope="col" className="py-2 font-semibold">실제 (업체 기록)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <th scope="row" className="py-2.5 pr-3 text-left font-medium">
              <label htmlFor={`${id}-grade`}>등급·재질</label>
            </th>
            <td className="py-2.5 pr-3">
              <span className="rounded-sm bg-marker px-1.5 py-0.5 text-marker-ink">{prediction.gradeLabel}</span>
            </td>
            <td className="py-2.5">
              <input id={`${id}-grade`} name="actualGrade" required maxLength={20} placeholder="예: B등급, 압축 PP 2급" className={inputClass} />
            </td>
          </tr>
          <tr className="border-b border-line">
            <th scope="row" className="py-2.5 pr-3 text-left font-medium">
              <label htmlFor={`${id}-perkg`}>단가 (원/kg)</label>
            </th>
            <td className="py-2.5 pr-3">
              {prediction.perKg !== null ? (
                <span className="num rounded-sm bg-marker px-1.5 py-0.5 text-marker-ink">{signed(prediction.perKg)}</span>
              ) : (
                <span className="text-muted">—</span>
              )}
              {prediction.perKgNote ? <span className="mt-1 block text-[12px] text-muted">{prediction.perKgNote}</span> : null}
            </td>
            <td className="py-2.5">
              <input
                id={`${id}-perkg`}
                name="actualPerKg"
                type="number"
                inputMode="numeric"
                required
                min={-5000}
                max={5000}
                step={1}
                defaultValue={accepted === "no" ? 0 : (prediction.perKg ?? undefined)}
                key={accepted}
                className={`${inputClass} num`}
                aria-describedby={`${id}-perkg-help`}
              />
              <span id={`${id}-perkg-help`} className="mt-1 block text-[12px] text-muted">
                업체가 배출 기업에 준 금액은 +, 처리비를 받았으면 −로 적습니다.
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row" className="py-2.5 pr-3 text-left font-medium">
              <label htmlFor={`${id}-kg`}>수거량 (kg)</label>
            </th>
            <td className="py-2.5 pr-3">
              <span className="num rounded-sm bg-marker px-1.5 py-0.5 text-marker-ink">{prediction.kg.toLocaleString("ko-KR")}</span>
            </td>
            <td className="py-2.5">
              <input
                id={`${id}-kg`}
                name="actualKg"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={1000000}
                step={1}
                defaultValue={prediction.kg}
                className={`${inputClass} num`}
                aria-describedby={`${id}-kg-help`}
              />
              <span id={`${id}-kg-help`} className="mt-1 block text-[12px] text-muted">
                순회 수거라면 이 사업장에서 계량한 양만 적습니다.
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">{accepted === "no" ? "거절 이유" : "메모 (선택)"}</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={200}
          required={accepted === "no"}
          placeholder={accepted === "no" ? "예: 이물 15%, 라벨 미제거" : "예: 수분 감량 3% 정산"}
          className={inputClass}
        />
      </label>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">이 기록은 다음 모델 학습에 쓰입니다. 실제 결과는 AI 판정을 고치는 가장 강한 정답 신호입니다.</p>
        <button type="submit" disabled={pending} className={buttonClass(primary ? "primary" : "secondary")}>
          {pending ? "기록하는 중…" : "실제 결과 기록"}
        </button>
      </div>
    </form>
  );
}
