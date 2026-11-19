/**
 * 처리 업체의 운반 조건 중 "수거 노선 밖 공장"의 별도 수거 조건. PUT /vendors/{orgId}의 transport.offRoute를 고친다
 * (백엔드 app/v3/transport_input.py, 판단은 app/v3/judge/pickup.py). 순수 함수라 node --test로 검사한다
 * (tests/transport-terms.test.ts).
 *
 *   transport.offRoute = {status: "visit" | "unavailable", basis: "included" | "separate" | "undecided",
 *                         feePerPickupKrw | feePerMonthKrw, pickupsPerMonth}
 *
 * 화면의 선택지는 넷이다: 수거 불가, 추가비 없이 수거, 추가비를 받고 수거(회당 또는 한 달 금액, 월 횟수는 모르면 비움),
 * 수거는 가능하지만 비용 미정. 따로 받는 운반비는 공장(배출 기업)이 낸다. evidence는 서버가 정하므로 보내지 않는다.
 */
import { parseAmount, parseCount } from "./billing.ts";

export type FeeBasis = "included" | "separate" | "undecided";

export type TransportSection = {
  basis?: FeeBasis | null;
  paidBy?: "vendor" | "emitter" | null;
  feePerPickupKrw?: number | null;
  feePerMonthKrw?: number | null;
  pickupsPerMonth?: number | null;
  /** 서버가 정한다. 받기만 하고 보내지 않는다 */
  evidence?: string[];
  feeEvidence?: string[];
  pickupsEvidence?: string[];
};

export type OffRouteTerms = TransportSection & { status: "visit" | "unavailable" };

export type TransportTerms = TransportSection & { offRoute?: OffRouteTerms | null };

/** 화면 선택지. ""는 아직 정하지 않음(저장된 조건이 없음) */
export type OffRouteChoice = "" | "unavailable" | "free" | "paid" | "undecided";
export type FeeUnit = "per_pickup" | "per_month";

export type OffRouteDraft = { choice: OffRouteChoice; unit: FeeUnit; fee: string; pickups: string };

export const OFF_ROUTE_CHOICES: { value: Exclude<OffRouteChoice, "">; label: string; hint: string }[] = [
  { value: "unavailable", label: "수거 불가", hint: "노선 밖 공장은 수거하러 가지 않습니다. 그 공장의 추천과 합계에서 빠집니다." },
  { value: "free", label: "추가비 없이 수거", hint: "따로 가지만 매입 단가 그대로 받습니다(운반비 포함)." },
  { value: "paid", label: "추가 운반비를 받고 수거", hint: "공장이 내는 운반비가 한 달 손익에 들어갑니다." },
  { value: "undecided", label: "수거는 가능, 비용 미정", hint: "공장 화면에 운반비를 넣기 전 금액으로 보입니다." },
];

export const FEE_UNITS: { value: FeeUnit; label: string }[] = [
  { value: "per_pickup", label: "회당" },
  { value: "per_month", label: "한 달" },
];

const numText = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");

/** 저장된 조건으로 입력 칸을 채운다 */
export function offRouteDraft(terms: TransportTerms | null | undefined): OffRouteDraft {
  const off = terms?.offRoute;
  const empty: OffRouteDraft = { choice: "", unit: "per_pickup", fee: "", pickups: "" };
  if (!off || (off.status !== "visit" && off.status !== "unavailable")) return empty;
  if (off.status === "unavailable") return { ...empty, choice: "unavailable" };
  const basis = off.basis ?? (off.paidBy === "vendor" ? "included" : off.paidBy === "emitter" ? "separate" : "undecided");
  if (basis === "included") return { ...empty, choice: "free" };
  if (basis === "undecided") return { ...empty, choice: "undecided" };
  const monthly = typeof off.feePerMonthKrw === "number";
  return {
    choice: "paid",
    unit: monthly ? "per_month" : "per_pickup",
    fee: numText(monthly ? off.feePerMonthKrw : off.feePerPickupKrw),
    pickups: monthly ? "" : numText(off.pickupsPerMonth),
  };
}

export type OffRouteErrors = { fee?: string; pickups?: string };

/** 입력 칸 검사(백엔드 transport_input.py와 같은 범위). 문제가 없으면 빈 객체 */
export function offRouteErrors(draft: OffRouteDraft): OffRouteErrors {
  if (draft.choice !== "paid") return {};
  const errors: OffRouteErrors = {};
  const fee = parseAmount(draft.fee);
  if (fee === null) errors.fee = "추가 운반비를 적어 주세요. 아직 모르면 ‘수거는 가능, 비용 미정’을 고릅니다.";
  else if (!Number.isFinite(fee) || fee <= 0 || fee > 10_000_000) errors.fee = "추가 운반비는 0보다 크고 1,000만 원 이하로 적어 주세요.";
  if (draft.unit === "per_pickup") {
    const count = parseCount(draft.pickups);
    if (count !== null && (!Number.isFinite(count) || count <= 0 || count > 100)) {
      errors.pickups = "한 달 수거 횟수는 0보다 크고 100 이하로 적어 주세요. 모르면 비워 둡니다.";
    }
  }
  return errors;
}

export function hasOffRouteErrors(errors: OffRouteErrors) {
  return Boolean(errors.fee || errors.pickups);
}

/**
 * 보낼 offRoute. 아직 정하지 않았으면(choice "") 저장된 조건이 있을 때만 null(지움)을, 없으면 undefined(보내지 않음)를 준다.
 * 검사를 통과한 입력만 넘긴다.
 */
export function offRouteBody(draft: OffRouteDraft, saved: TransportTerms | null | undefined): OffRouteTerms | null | undefined {
  switch (draft.choice) {
    case "":
      return saved?.offRoute ? null : undefined;
    case "unavailable":
      return { status: "unavailable" };
    case "free":
      return { status: "visit", basis: "included" };
    case "undecided":
      return { status: "visit", basis: "undecided" };
    case "paid": {
      const fee = parseAmount(draft.fee) as number;
      if (draft.unit === "per_month") return { status: "visit", basis: "separate", feePerMonthKrw: fee };
      const count = parseCount(draft.pickups);
      return { status: "visit", basis: "separate", feePerPickupKrw: fee, ...(count === null ? {} : { pickupsPerMonth: count }) };
    }
  }
}

/**
 * PUT 본문의 transport. 노선 수거 조건(최상위)은 저장된 그대로 돌려보내고(같은 조건이면 서버가 근거를 바꾸지 않는다)
 * offRoute만 바꾼다. 보낼 것이 없으면 undefined.
 */
export function transportBody(saved: TransportTerms | null | undefined, draft: OffRouteDraft): TransportTerms | undefined {
  const off = offRouteBody(draft, saved);
  const base: TransportTerms = {};
  for (const key of ["basis", "paidBy", "feePerPickupKrw", "feePerMonthKrw", "pickupsPerMonth"] as const) {
    const value = saved?.[key];
    if (value !== null && value !== undefined) (base as Record<string, unknown>)[key] = value;
  }
  if (off === undefined) return Object.keys(base).length > 0 ? base : undefined;
  return { ...base, offRoute: off };
}

const won = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

/** 저장한 조건 한 줄. 업체 화면의 "저장한 조건"과 근거 이름에 같은 말을 쓴다 */
export function offRouteText(off: OffRouteTerms | null | undefined): string | null {
  if (!off) return null;
  if (off.status === "unavailable") return "수거 불가";
  const draft = offRouteDraft({ offRoute: off });
  if (draft.choice === "free") return "추가비 없이 수거(운반비 포함)";
  if (draft.choice === "undecided") return "수거는 가능, 추가 운반비 미정";
  if (typeof off.feePerMonthKrw === "number") return `추가 운반비 한 달 ${won(off.feePerMonthKrw)}(공장 부담)`;
  if (typeof off.feePerPickupKrw === "number") {
    const count = typeof off.pickupsPerMonth === "number" ? ` × 한 달 ${off.pickupsPerMonth}회` : " · 한 달 수거 횟수 미정";
    return `추가 운반비 회당 ${won(off.feePerPickupKrw)}(공장 부담)${count}`;
  }
  return "추가 운반비를 따로 받음(금액 미정)";
}
