/**
 * 자료 화면의 현행 처리비 입력. 순수 함수만 둔다(tests/billing.test.ts).
 * 2026-11-19 배출 사업장 설문에서 "처리비를 차량·횟수 단위로 계약해서 kg 단가는 모른다"는 답이 나와,
 * kg당 금액 말고도 계약한 꼴(회당 금액 × 월 횟수, 월 정액) 그대로 받는다. kg당으로 바꾸는 계산은 백엔드가 하고 근거를 남긴다.
 */
import type { Billing, StreamRecord } from "./types.ts";

export type BillingMode = "per_kg" | "per_trip" | "monthly";

export const BILLING_MODES: { mode: BillingMode; label: string }[] = [
  { mode: "per_kg", label: "kg당" },
  { mode: "per_trip", label: "회당" },
  { mode: "monthly", label: "월 정액" },
];

export type BillingFields = {
  mode: BillingMode;
  perKg: string;
  perTrip: string;
  trips: string;
  monthly: string;
};

type CurrentTreatment = NonNullable<StreamRecord["currentTreatment"]>;

const plain = (value: number) => String(Math.round(value * 100) / 100);

/** 저장된 현행 처리에서 입력 칸의 처음 값을 정한다. 회당·월 정액으로 저장했으면 그 꼴로 연다 */
export function initialFields(current: StreamRecord["currentTreatment"]): BillingFields {
  const billing = current?.billing ?? null;
  const empty = { perKg: "", perTrip: "", trips: "", monthly: "" };
  if (billing?.kind === "per_trip") {
    return { ...empty, mode: "per_trip", perTrip: plain(billing.krwPerTrip), trips: plain(billing.tripsPerMonth) };
  }
  if (billing?.kind === "monthly") return { ...empty, mode: "monthly", monthly: plain(billing.krwPerMonth) };
  return {
    ...empty,
    mode: "per_kg",
    perKg: current?.unitCostKrwPerKg != null ? plain(current.unitCostKrwPerKg) : "",
  };
}

/**
 * 담당자가 적은 금액을 읽는다. "300000", "300,000", "30만", "30만원", "1.5만"을 받는다.
 * 비었으면 null, 읽지 못하면 NaN이다.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, "").replace(/원$/, "");
  if (cleaned === "") return null;
  const match = /^(\d+(?:\.\d+)?)(만)?$/.exec(cleaned);
  if (!match) return Number.NaN;
  const value = Number(match[1]) * (match[2] ? 10000 : 1);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** 한 달 수거 횟수. "2", "2회", "2번"을 받는다 */
export function parseCount(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(/[회번]$/, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return /^\d+(?:\.\d+)?$/.test(cleaned) && Number.isFinite(value) ? value : Number.NaN;
}

export type TreatmentInput =
  | { ok: true; currentTreatment: CurrentTreatment | null }
  | { ok: false; message: string };

/**
 * 입력 칸을 PUT 본문의 currentTreatment로 바꾼다. 처리 방법을 비우면 null(혼합 소각 가정값을 쓴다).
 * 회당·월 정액은 billing만 보내고 kg당 금액은 백엔드가 월 발생량으로 다시 계산한다.
 */
export function treatmentInput(
  method: string,
  fields: BillingFields,
  stream: Pick<StreamRecord, "monthlyKg" | "currentTreatment">,
): TreatmentInput {
  const name = method.trim();
  if (!name) return { ok: true, currentTreatment: null };
  const evidence = stream.currentTreatment?.evidence ?? [];
  if (fields.mode === "per_kg") {
    const cost = parseAmount(fields.perKg);
    if (cost === null) {
      return {
        ok: false,
        message: "kg당 금액을 적거나 계약 방식(회당, 월 정액)을 골라 주세요. 금액을 모르면 처리 방법을 비워 두면 됩니다.",
      };
    }
    if (Number.isNaN(cost) || cost < 0) return { ok: false, message: "kg당 금액은 숫자로 적어 주세요." };
    return { ok: true, currentTreatment: { method: name, unitCostKrwPerKg: cost, billing: null, evidence } };
  }
  if (stream.monthlyKg == null || stream.monthlyKg <= 0) {
    return {
      ok: false,
      message: "한 달 발생량을 알아야 kg당 처리비로 바꿀 수 있습니다. 측정값 CSV에 월 발생량을 넣거나 kg당 금액으로 적어 주세요.",
    };
  }
  let billing: Billing;
  if (fields.mode === "per_trip") {
    const perTrip = parseAmount(fields.perTrip);
    const trips = parseCount(fields.trips);
    if (perTrip === null || Number.isNaN(perTrip) || perTrip <= 0) {
      return { ok: false, message: "한 번 수거할 때 내는 금액을 숫자로 적어 주세요. 예: 300000 또는 30만" };
    }
    if (trips === null || Number.isNaN(trips) || trips <= 0) {
      return { ok: false, message: "한 달에 몇 번 수거하는지 적어 주세요. 예: 2" };
    }
    billing = { kind: "per_trip", krwPerTrip: perTrip, tripsPerMonth: trips };
  } else {
    const monthly = parseAmount(fields.monthly);
    if (monthly === null || Number.isNaN(monthly) || monthly <= 0) {
      return { ok: false, message: "한 달에 내는 금액을 숫자로 적어 주세요. 예: 600000 또는 60만" };
    }
    billing = { kind: "monthly", krwPerMonth: monthly };
  }
  return { ok: true, currentTreatment: { method: name, unitCostKrwPerKg: null, billing, evidence } };
}

const won = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

/** 저장된 계약을 사람이 읽는 꼴로. 예: "회당 300,000원 × 월 2회", "월 정액 600,000원" */
export function billingText(billing: Billing): string {
  if (billing.kind === "per_trip") {
    return `회당 ${won(billing.krwPerTrip)} × 월 ${Number(billing.tripsPerMonth.toFixed(2))}회`;
  }
  return `월 정액 ${won(billing.krwPerMonth)}`;
}

/** 입력 아래 안내. 저장한 계약이 있으면 kg당으로 바꾼 값을 근거와 함께 보인다(값은 화면에서 근거로 연다) */
export function billingHint(mode: BillingMode): string {
  if (mode === "per_trip") return "계약한 대로 적으면 한 달 발생량으로 나눠 kg당 처리비로 바꿉니다.";
  if (mode === "monthly") return "한 달에 내는 금액을 적으면 한 달 발생량으로 나눠 kg당 처리비로 바꿉니다.";
  return "비워 두면 혼합 소각으로 가정하고, 결과에 ‘가정’이라고 표시합니다.";
}
