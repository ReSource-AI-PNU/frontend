"use client";

import {
  FEE_UNITS,
  OFF_ROUTE_CHOICES,
  offRouteText,
  type OffRouteDraft,
  type OffRouteErrors,
  type TransportTerms,
} from "@/lib/v3/transport-terms";
import { useV3 } from "./context";

const field =
  "min-h-11 min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";
const segment =
  "flex min-h-[38px] cursor-pointer items-center rounded-sm px-4 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink";

/**
 * 업체 자료 화면의 "노선 밖 공장 수거". 노선이 지나지 않는 공장을 따로 수거하러 가는지와 추가 운반비를 정한다.
 * 저장은 위 VendorForm의 저장 단추가 함께 한다(transport.offRoute). 저장한 조건은 누가·언제 정했는지 근거로 열린다.
 */
export function OffRouteTerms({
  saved,
  draft,
  onChange,
  errors,
  canAct,
}: {
  saved: TransportTerms | null | undefined;
  draft: OffRouteDraft;
  onChange: (draft: OffRouteDraft) => void;
  errors: OffRouteErrors;
  canAct: boolean;
}) {
  const { openEvidence } = useV3();
  const savedText = offRouteText(saved?.offRoute);
  const savedEvidence = saved?.offRoute?.evidence ?? [];
  return (
    <div className="mt-8">
      <h3 className="text-[15px] font-semibold">노선 밖 공장 수거</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        위 노선이 지나지 않는 공장에서 문의가 오면 이 조건으로 답합니다. 공장의 결과표와 승인 화면에 수거 여부와 운반비로
        보이고, 정하지 않으면 공장 화면에 “별도 수거 확인 필요”로 남습니다.
      </p>
      <p className="mt-2 text-sm text-ink-2">
        {savedText ? (
          <>
            저장한 조건: <span className="font-medium text-ink">{savedText}</span>
            {savedEvidence.length > 0 ? (
              <>
                {" "}
                <button
                  type="button"
                  className="text-[13px] text-muted underline underline-offset-4 hover:text-ink"
                  onClick={() => openEvidence(savedEvidence, "노선 밖 공장 수거 조건")}
                >
                  근거
                </button>
              </>
            ) : null}
          </>
        ) : (
          "아직 정하지 않았습니다."
        )}
      </p>
      <fieldset className="mt-3" disabled={!canAct}>
        <legend className="sr-only">노선 밖 공장을 따로 수거하러 가나요</legend>
        <ul className="divide-y divide-line border-y border-line">
          {OFF_ROUTE_CHOICES.map((item) => (
            <li key={item.value}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
                <input
                  type="radio"
                  name="off-route"
                  value={item.value}
                  checked={draft.choice === item.value}
                  onChange={() => onChange({ ...draft, choice: item.value })}
                  className="mt-1 size-4 accent-ink"
                />
                <span>
                  <span className="block text-[15px] font-medium">{item.label}</span>
                  <span className="block text-[13px] text-muted">{item.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {draft.choice === "paid" ? (
          <div className="mt-3 rounded-xl bg-ground px-4 py-4">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <div>
                <p className="text-[13px] font-medium text-ink-2">추가 운반비</p>
                <div className="mt-1.5 inline-flex rounded-md bg-sunken p-[3px]">
                  {FEE_UNITS.map((unit) => (
                    <label key={unit.value}>
                      <input
                        type="radio"
                        name="off-route-unit"
                        value={unit.value}
                        checked={draft.unit === unit.value}
                        onChange={() => onChange({ ...draft, unit: unit.value })}
                        className="peer sr-only"
                      />
                      <span className={segment}>{unit.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
                {draft.unit === "per_pickup" ? "한 번 수거할 때" : "한 달에"}
                <span className="flex items-center gap-2">
                  <input
                    value={draft.fee}
                    onChange={(event) => onChange({ ...draft, fee: event.target.value })}
                    inputMode="decimal"
                    placeholder="예: 3만"
                    aria-invalid={Boolean(errors.fee)}
                    className={`${field} w-32 tabular-nums`}
                  />
                  <span className="text-sm font-normal text-ink-2">원</span>
                </span>
              </label>
              {draft.unit === "per_pickup" ? (
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
                  한 달 수거 횟수
                  <span className="flex items-center gap-2">
                    <input
                      value={draft.pickups}
                      onChange={(event) => onChange({ ...draft, pickups: event.target.value })}
                      inputMode="numeric"
                      placeholder="모름"
                      aria-invalid={Boolean(errors.pickups)}
                      className={`${field} w-20 tabular-nums`}
                    />
                    <span className="text-sm font-normal text-ink-2">번</span>
                  </span>
                </label>
              ) : null}
            </div>
            <p className="mt-2.5 text-[13px] text-muted">
              추가 운반비는 공장이 냅니다. 한 달 수거 횟수를 비우면 공장 화면에 “월 수거 횟수 확인 필요”와 운반비를 넣기 전
              금액으로 보입니다.
            </p>
            {errors.fee || errors.pickups ? (
              <p role="alert" className="mt-1.5 text-[13px] text-loss">
                {errors.fee ?? errors.pickups}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
