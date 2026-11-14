"use client";

import { useActionState, useId, useState } from "react";
import { formatSigned } from "@/lib/format";
import { recordOutcome } from "@/lib/server/session-actions";
import { buttonClass } from "../ui/button";

type OutcomeState = { error?: string; ok?: true } | undefined;

/** 실제 결과를 적을 수 있는 흐름(승인한 방안에서 서류를 보낸 묶음·매각·열분해 흐름)과 그 예상값 */
export type OutcomeStream = { id: string; name: string; routeLabel: string; expectedPerKg: number; expectedKg: number };

const inputClass =
  "w-full min-h-11 rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none";

const segment =
  "flex min-h-[34px] cursor-pointer items-center rounded-sm px-4 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink";

/**
 * 수거 후 실제 결과 기록. 흐름을 골라 streamId와 함께 보낸다(recordOutcome).
 * 예상과 실제의 차이는 재학습의 가장 강한 신호가 된다.
 */
export function ProposalOutcomeForm({
  sessionId,
  streams,
  defaultStreamId,
  heading = "수거가 끝나면 실제 결과를 기록해 주세요",
}: {
  sessionId: string;
  streams: OutcomeStream[];
  defaultStreamId?: string;
  heading?: string;
}) {
  const [streamId, setStreamId] = useState(defaultStreamId && streams.some((s) => s.id === defaultStreamId) ? defaultStreamId : streams[0]?.id);
  const [accepted, setAccepted] = useState<"yes" | "no">("yes");
  const [state, action, pending] = useActionState<OutcomeState, FormData>(
    (prev, formData) => recordOutcome(sessionId, "담당자", prev, formData),
    undefined,
  );
  const titleId = useId();
  const current = streams.find((s) => s.id === streamId) ?? streams[0];
  if (!current) return null;

  return (
    <form action={action} aria-labelledby={titleId} className="grid gap-4">
      <div>
        <h2 id={titleId} className="text-h2">
          {heading}
        </h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          업체가 실제로 매긴 등급과 단가는 AI가 다시 배울 때 가장 강한 신호입니다. 예상과 다르면 다음 진단이 그만큼 고쳐집니다.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">어느 흐름의 결과인가요</legend>
        <div className="mt-1.5 inline-flex flex-wrap rounded-md bg-sunken p-[3px]">
          {streams.map((s) => (
            <label key={s.id}>
              <input type="radio" name="streamId" value={s.id} checked={current.id === s.id} onChange={() => setStreamId(s.id)} className="peer sr-only" />
              <span className={segment}>
                {s.name}
                <span className="ml-1.5 text-[12px] font-normal text-muted">{s.routeLabel}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">수거 결과</legend>
        <div className="mt-1.5 inline-flex rounded-md bg-sunken p-[3px]">
          {(
            [
              ["yes", "매입했습니다"],
              ["no", "거절했습니다"],
            ] as const
          ).map(([v, label]) => (
            <label key={v}>
              <input type="radio" name="accepted" value={v} checked={accepted === v} onChange={() => setAccepted(v)} className="peer sr-only" />
              <span className={segment}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">실제 등급</span>
          <input name="actualGrade" required maxLength={20} placeholder={accepted === "yes" ? "예: B등급" : "예: 등급 외"} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">실제 단가 (원/kg)</span>
          <input
            key={`perkg-${current.id}`}
            name="actualPerKg"
            type="number"
            inputMode="numeric"
            required
            min={-5000}
            max={5000}
            step={1}
            placeholder={String(current.expectedPerKg)}
            className={`num ${inputClass}`}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">실제 수거량 (kg)</span>
          <input
            key={`kg-${current.id}`}
            name="actualKg"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={1000000}
            step={1}
            placeholder={String(current.expectedKg)}
            className={`num ${inputClass}`}
          />
        </label>
      </div>
      <p className="-mt-2 text-[12.5px] text-muted tabular-nums">
        {current.name}의 AI 예상은 단가 {formatSigned(current.expectedPerKg)}원/kg, 수거량 {current.expectedKg.toLocaleString("ko-KR")}kg입니다. 처리비를
        낸 경우 단가 앞에 마이너스 부호를 붙여 적습니다.
      </p>

      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">{accepted === "no" ? "거절 사유" : "감량·감가 사유 (있으면)"}</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={200}
          required={accepted === "no"}
          placeholder={accepted === "no" ? "예: 종이 태그가 섞여 매입 기준 초과" : "예: 수분 감량 3% 정산"}
          className={`${inputClass} py-2.5`}
        />
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "기록하는 중…" : "실제 결과 기록"}
        </button>
      </div>
    </form>
  );
}
