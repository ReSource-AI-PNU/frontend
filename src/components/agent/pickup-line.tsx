"use client";

import { ClaimValue } from "@/components/v3/claim";
import { josa } from "@/lib/josa";
import { formatNumber } from "@/lib/v3/format";
import { numberOf, won } from "@/lib/v3/money";
import { feeKind, pickupStatusText, pickupUnconfirmed, roomAgainstName } from "@/lib/v3/pickup";
import type { Assignment, Claim, Pickup } from "@/lib/v3/types";

function Count({ claim }: { claim: Claim | null }) {
  const value = numberOf(claim);
  return claim && value !== null ? <ClaimValue claim={claim} display={`월 ${formatNumber(value)}회`} className="!font-normal" /> : null;
}

/** 운반비 견적의 계산식: "회당 30,000원 × 월 2회" 또는 "한 달 70,000원". 값마다 근거가 열린다 */
export function FeeFormula({ pickup }: { pickup: Pickup }) {
  if (!pickup.fee) return null;
  if (pickup.unit === "per_month") {
    return (
      <>
        한 달 <ClaimValue claim={pickup.fee} display={won(pickup.fee)} className="!font-normal" />
      </>
    );
  }
  return (
    <>
      회당 <ClaimValue claim={pickup.fee} display={won(pickup.fee)} className="!font-normal" />
      {pickup.pickups ? (
        <>
          {" × "}
          <Count claim={pickup.pickups} />
        </>
      ) : (
        <span className="text-warn"> · 월 수거 횟수 확인 필요</span>
      )}
    </>
  );
}

/**
 * 결과 표 "조건" 칸의 한 줄: 수거 상태 · 운반비. 수거가 확인되지 않았거나 운반비가 정해지지 않았으면 `warn` 글자다.
 * 노선 밖이라 노선 수거의 "운반비 포함"을 이 공장에 쓰지 않았으면 둘 다 보인다.
 */
export function PickupBrief({ pickup, committed }: { pickup: Pickup; committed?: boolean }) {
  const kind = feeKind(pickup);
  const status = (
    <span className={pickupUnconfirmed(pickup) ? "text-warn" : undefined}>{pickupStatusText(pickup, committed)}</span>
  );
  let fee: React.ReactNode = null;
  if (kind === "included") fee = "운반비 포함";
  else if (kind === "monthly" && pickup.monthly)
    fee = (
      <>
        운반비 한 달 <ClaimValue claim={pickup.monthly} display={won(pickup.monthly)} className="!font-normal" /> 별도
      </>
    );
  else if (kind === "monthly") fee = pickup.paidBy === "vendor" ? "운반비 별도(업체 부담)" : "운반비 별도(공장 부담)";
  else if (kind === "missing") fee = <span className="text-warn">운반비 별도 · 금액 확인 필요</span>;
  else if (kind === "undecided")
    fee =
      pickup.status === "check" && !pickup.detail && pickup.routeBasis === "included" ? (
        "운반비 포함(노선 수거 조건)"
      ) : (
        <span className="text-warn">운반비 미정</span>
      );
  return (
    <span className="block text-[13px] text-muted">
      {fee}
      {fee ? " · " : null}
      {status}
      {pickup.detail ? <span className="block">{pickup.detail}</span> : null}
    </span>
  );
}

/** 결과 줄을 펼친 순비용 내역의 수거·운반 두 줄(dt/dd). */
export function TransportRows({ assignment, onOpenTalk }: { assignment: Assignment; onOpenTalk?: () => void }) {
  const pickup = assignment.pickup;
  if (!pickup) return null;
  const kind = feeKind(pickup);
  return (
    <>
      <dt className="text-ink-2">수거</dt>
      <dd className={`text-right ${pickupUnconfirmed(pickup) ? "text-warn" : "text-ink-2"}`}>{pickupStatusText(pickup)}</dd>
      <dt className="text-ink-2">운반비</dt>
      <dd className="text-right">
        {kind === "included" ? (
          <span className="text-ink-2">업체 단가에 포함</span>
        ) : kind === "monthly" && assignment.transport ? (
          <ClaimValue claim={assignment.transport} display={`−${won(assignment.transport)}`} className="!font-normal" />
        ) : (
          <span className="text-warn">확인 필요</span>
        )}
      </dd>
      {kind === "monthly" || pickup.fee || kind === "undecided" ? (
        <dd className="col-span-2 -mt-1 text-right text-[13px] text-muted">
          {kind === "monthly" || pickup.fee ? (
            <>
              견적 <FeeFormula pickup={pickup} />
              {pickup.monthly && kind === "monthly" ? (
                <>
                  {" = 업체 월 "}
                  <ClaimValue claim={pickup.monthly} display={won(pickup.monthly)} className="!font-normal" />
                </>
              ) : null}
              {pickup.paidBy === "emitter" ? " · 공장 부담" : null}
            </>
          ) : pickup.status === "check" && !pickup.detail && pickup.routeBasis === "included" ? (
            "노선 수거는 운반비 포함이지만 이 공장은 노선 밖이라 운반비가 정해지지 않았습니다"
          ) : (
            "업체가 이 공장의 운반비를 밝히지 않았습니다"
          )}
          {pickup.seq !== null && onOpenTalk ? (
            <>
              {" · "}
              <button type="button" onClick={onOpenTalk} className="underline underline-offset-4 hover:text-ink">
                업체 답 {pickup.seq}번째 메시지
              </button>
            </>
          ) : null}
        </dd>
      ) : null}
    </>
  );
}

/** 운반비가 정해지지 않은 줄: 운반비가 한 달 얼마를 넘으면 다음 선택지가 나은지 한 문장으로. */
export function RoomNote({
  assignment,
  vendorName,
}: {
  assignment: Assignment;
  vendorName: (id: string) => string | null | undefined;
}) {
  const pickup = assignment.pickup;
  if (!pickup || !assignment.transportPending) return null;
  const against = roomAgainstName(pickup, vendorName);
  return (
    <p className="mb-4 rounded-lg bg-warn-bg px-3 py-2 text-[14px] leading-relaxed text-ink-2">
      <span className="font-medium text-warn">별도 운반비 반영 전 금액입니다.</span>{" "}
      {pickup.room ? (
        <>
          운반비가 한 달{" "}
          <ClaimValue claim={pickup.room} display={won(pickup.room)} className="!font-normal" />을 넘으면{" "}
          {josa(against, "이/가")} 낫습니다.
        </>
      ) : (
        "업체가 운반비를 밝히면 다시 계산합니다."
      )}
    </p>
  );
}
