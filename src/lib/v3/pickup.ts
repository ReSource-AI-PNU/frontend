/**
 * 결과 한 줄의 수거·운반(백엔드 judge/pickup.py)을 화면 말로 푼다. 수거 상태와 운반비 조건은 따로 본다.
 * 네트워크도 React도 부르지 않는 순수 함수다(결과 카드, 승인 화면, 대화 패널이 같이 쓴다).
 */
import type { Assignment, Pickup } from "./types";

export type PickupStatus = Pickup["status"];

export const PICKUP_STATUS_LABEL: Record<PickupStatus, string> = {
  route: "기존 노선 포함",
  check: "별도 수거 확인 필요",
  visit: "업체 수거 가능 확인",
  unavailable: "수거 불가",
  unknown: "수거 방식 미상",
};

/** 수거가 확인되지 않아 담당자가 확인해야 하는 상태 */
export function pickupUnconfirmed(pickup: Pick<Pickup, "status"> | null | undefined): boolean {
  return pickup?.status === "check" || pickup?.status === "unknown" || pickup?.status === "unavailable";
}

/**
 * "기존 노선 포함(화·목 운행)", "별도 수거 확인 필요"처럼 수거 상태 한마디.
 * committed를 주면 수거할 수 있다고 밝힌 상태(노선 포함, 업체 수거 가능)에 실제 수거 확약 여부를 붙인다:
 * 양쪽 승인 전이면 "수거 확약 전", 양쪽 승인으로 확정됐으면 "수거 확약(양쪽 승인)".
 */
export function pickupStatusText(pickup: Pick<Pickup, "status" | "days">, committed?: boolean): string {
  const label = PICKUP_STATUS_LABEL[pickup.status];
  const base = pickup.status === "route" && pickup.days.length > 0 ? `${label}(${pickup.days.join("·")} 운행)` : label;
  if (committed === undefined || (pickup.status !== "route" && pickup.status !== "visit")) return base;
  return `${base} · ${committed ? "수거 확약(양쪽 승인)" : "수거 확약 전"}`;
}

/**
 * 운반비를 어떻게 적을지. 숫자는 화면이 claim으로 그리므로 여기서는 종류만 정한다.
 *  - included: 단가에 포함
 *  - monthly: 별도 운반비가 정해졌다(배출 기업 뷰에는 월 금액 claim이 있다. 업체 뷰는 금액 claim이 비어 있다)
 *  - missing: 따로 받는다는데 금액이나 횟수가 없다(별도 운반비 반영 전)
 *  - undecided: 이 공장에 적용할 운반비가 정해지지 않았다(별도 운반비 반영 전)
 *  - none: 수거 불가라 운반비를 보지 않는다
 */
export type FeeKind = "included" | "monthly" | "missing" | "undecided" | "none";

export function feeKind(pickup: Pickup): FeeKind {
  if (pickup.status === "unavailable") return "none";
  if (pickup.basis === "included") return "included";
  if (pickup.basis === "separate") return pickup.pending ? "missing" : "monthly";
  return "undecided";
}

/** 운반비 방식을 숫자 없이 적은 말. "단가에 포함", "별도(공장 부담)", "미정" */
export function feeWords(pickup: Pickup): string {
  const kind = feeKind(pickup);
  if (kind === "included") return "운반비 단가에 포함";
  if (kind === "monthly" || kind === "missing") return pickup.paidBy === "vendor" ? "운반비 별도(업체 부담)" : "운반비 별도(공장 부담)";
  if (kind === "undecided") return "운반비 미정";
  return "";
}

/**
 * 승인 전에 담당자가 확인할 수거·운반 문장. 수거가 확인되지 않았거나 운반비가 정해지지 않았으면 문장이 나온다.
 * 문장에는 숫자를 쓰지 않는다(숫자는 결과 표의 근거 값으로 본다).
 */
export function pickupTodo(assignment: Pick<Assignment, "pickup" | "transportPending">): string[] {
  const pickup = assignment.pickup;
  if (!pickup) return [];
  const out: string[] = [];
  if (pickup.status === "check") {
    out.push(
      pickup.routeBasis === "included"
        ? "공장 지역이 업체의 수거 노선 밖입니다. 노선 수거는 운반비가 단가에 포함이지만, 따로 수거하러 올 수 있는지와 그때 운반비를 확인하세요."
        : "공장 지역이 업체의 수거 노선 밖입니다. 따로 수거하러 올 수 있는지와 운반비를 확인하세요.",
    );
  } else if (pickup.status === "unknown") {
    out.push("업체가 수거 노선을 밝히지 않았습니다. 이 공장까지 수거하러 오는지 확인하세요.");
  } else if (pickup.status === "unavailable") {
    out.push("업체가 이 공장까지 수거하러 올 수 없다고 밝혔습니다.");
  }
  if (assignment.transportPending && pickup.status !== "unavailable") {
    out.push(
      feeKind(pickup) === "missing"
        ? "운반비를 따로 받는데 금액이나 월 수거 횟수가 없어, 한 달 금액은 별도 운반비 반영 전 값입니다."
        : "운반비가 정해지지 않아 한 달 금액은 별도 운반비 반영 전 값입니다.",
    );
  }
  return out;
}

/** 운반비가 정해지지 않아 손익분기를 견준 상대의 이름. 현행 유지면 "지금 방식" */
export function roomAgainstName(pickup: Pickup, vendorName: (id: string) => string | null | undefined): string {
  const against = pickup.roomAgainst;
  if (!against) return "다른 선택지";
  if (against.vendorOrgId) return vendorName(against.vendorOrgId) ?? "다른 업체";
  return against.route === "reuse" ? "사내 공정 재투입" : "지금 방식";
}
