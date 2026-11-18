/**
 * 처리 업체의 노선·차량 입력. PUT /vendors/{orgId}의 fleet(차고지, 적재 무게·부피, km당 운송비)과
 * guardrails.days(수거할 수 있는 요일)를 고친다. 순수 함수라 node --test로 검사한다(tests/fleet.test.ts).
 *
 * 차량 대수(fleet.count)와 다니는 산업단지(fleet.complexes)는 계약의 VendorProfile에 아직 없는 값이다.
 * 지금 백엔드는 fleet을 그대로 합쳐 저장하므로 함께 보내고, 백엔드가 받지 않으면(400·422로 거절하거나 저장한 응답에
 * 없으면) 그 두 칸을 숨기고 나머지만 다시 저장한다(fleetExtrasKept).
 */

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 차고지 고르기에서 "지금 위치 그대로"(저장된 차고지가 산업단지 중심과 맞지 않을 때) */
export const KEEP_DEPOT = "keep";

export type FleetRecord = {
  depot?: [number, number] | null;
  capacityKg?: number | null;
  capacityM3?: number | null;
  costPerKm?: number | null;
  /** 차량 대수(업체 입력) */
  count?: number | null;
  /** 다니는 산업단지 ID(data/complexes.json) */
  complexes?: string[];
  evidence?: string[];
};

export type FleetDraft = {
  depot: string;
  capacityKg: string;
  capacityM3: string;
  costPerKm: string;
  count: string;
  complexes: string[];
  days: string[];
};

type Complex = { id: string; center: [number, number] };

const numText = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");

function sameSpot(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/** 저장된 차고지 좌표가 산업단지 중심과 같으면 그 ID, 없으면 "", 다르면 KEEP_DEPOT */
export function depotChoice(depot: FleetRecord["depot"], complexes: Complex[]): string {
  if (!Array.isArray(depot) || depot.length !== 2) return "";
  return complexes.find((item) => sameSpot(item.center, depot))?.id ?? KEEP_DEPOT;
}

export function fleetDraft(fleet: FleetRecord | null, days: string[], complexes: Complex[]): FleetDraft {
  return {
    depot: depotChoice(fleet?.depot, complexes),
    capacityKg: numText(fleet?.capacityKg),
    capacityM3: numText(fleet?.capacityM3),
    costPerKm: numText(fleet?.costPerKm),
    count: numText(fleet?.count),
    complexes: Array.isArray(fleet?.complexes) ? fleet.complexes.filter((id) => typeof id === "string") : [],
    days: [...days],
  };
}

export type FleetErrors = Partial<Record<"capacityKg" | "capacityM3" | "costPerKm" | "count", string>>;

const parse = (value: string) => {
  const cleaned = value.replace(/,/g, "").trim();
  return cleaned === "" ? null : Number(cleaned);
};

/** 빈 칸은 그대로 둔다(아직 모르는 값). 적은 값만 검사한다. */
export function fleetErrors(draft: FleetDraft): FleetErrors {
  const errors: FleetErrors = {};
  const positive = (key: "capacityKg" | "capacityM3", label: string) => {
    const value = parse(draft[key]);
    if (value !== null && !(Number.isFinite(value) && value > 0)) errors[key] = `${label}은 0보다 큰 숫자로 적어 주세요.`;
  };
  positive("capacityKg", "적재 무게");
  positive("capacityM3", "적재 부피");
  const cost = parse(draft.costPerKm);
  if (cost !== null && !(Number.isFinite(cost) && cost >= 0)) errors.costPerKm = "운송비는 0 이상의 숫자로 적어 주세요.";
  const count = parse(draft.count);
  if (count !== null && !(Number.isInteger(count) && count >= 1 && count <= 999)) errors.count = "차량 대수는 1 이상의 정수로 적어 주세요.";
  return errors;
}

/** 요일을 월~일 순서로 정렬한다. 목록에 없는 값(예전에 쓴 글)은 뒤에 그대로 둔다. */
export function sortDays(days: string[]): string[] {
  const unique = [...new Set(days.map((day) => day.trim()).filter(Boolean))];
  const order = (day: string) => {
    const index = (WEEKDAYS as readonly string[]).indexOf(day);
    return index === -1 ? WEEKDAYS.length : index;
  };
  return unique.sort((a, b) => order(a) - order(b));
}

export function toggleDay(days: string[], day: string): string[] {
  return sortDays(days.includes(day) ? days.filter((item) => item !== day) : [...days, day]);
}

/**
 * 저장할 fleet. 빈 칸은 보내지 않는다(백엔드는 fleet을 합쳐 저장하므로 비운 값은 지우지 않고, 빈 값을 근거로 등록하지도 않는다).
 * extras가 false면 차량 대수와 다니는 산업단지를 싣지 않는다.
 */
export function fleetBody(
  draft: FleetDraft,
  previous: FleetRecord | null,
  complexes: Complex[],
  extras: boolean,
): FleetRecord | null {
  const body: FleetRecord = {};
  if (draft.depot === KEEP_DEPOT) {
    if (Array.isArray(previous?.depot)) body.depot = previous.depot;
  } else if (draft.depot) {
    const complex = complexes.find((item) => item.id === draft.depot);
    if (complex) body.depot = complex.center;
  }
  for (const key of ["capacityKg", "capacityM3", "costPerKm"] as const) {
    const value = parse(draft[key]);
    if (value !== null && Number.isFinite(value)) body[key] = value;
  }
  if (extras) {
    const count = parse(draft.count);
    if (count !== null && Number.isFinite(count)) body.count = count;
    if (draft.complexes.length > 0 || (previous?.complexes?.length ?? 0) > 0) body.complexes = [...draft.complexes];
  }
  return Object.keys(body).length > 0 ? body : null;
}

/** 보낸 차량 대수·다니는 산업단지가 저장한 응답에 남았는지. 보내지 않았으면 판단하지 않는다(true). */
export function fleetExtrasKept(sent: FleetRecord | null, saved: FleetRecord | null | undefined): boolean {
  if (!sent) return true;
  if (sent.count !== undefined && saved?.count !== sent.count) return false;
  if (sent.complexes !== undefined && !Array.isArray(saved?.complexes)) return false;
  return true;
}
