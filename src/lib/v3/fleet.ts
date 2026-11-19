/**
 * 처리 업체의 노선·차량 입력. PUT /vendors/{orgId}의 fleet을 고친다(backend docs/v3/CONTRACT.md 9장 "노선·차량").
 * 순수 함수라 node --test로 검사한다(tests/fleet.test.ts).
 *
 *   fleet: {depot: [경도, 위도], capacityKg, capacityM3, costPerKm, vehicleCount,
 *           serviceAreas: ["부산 강서구", "경남 김해시"], maxPickupKm: 40,
 *           routes: [{name, days: ["화", "목"], regions: [...], complexes: [...]}]}
 *
 * - 보낸 항목만 바꾸고 null이면 그 항목을 지운다. 모르는 항목이나 범위 밖의 값이 하나라도 있으면 요청 전체가 422다.
 * - evidence는 서버가 정하므로 보내지 않는다.
 * - 계산에는 depot·capacityKg·capacityM3·costPerKm만 쓰고, vehicleCount와 routes는 저장해 보여 주기만 한다.
 * - 노선의 운행 요일(routes[].days)과 업체 측 AI가 지킬 수거 요일(guardrails.days)은 따로다.
 * - 수거 가능 지역(serviceAreas)과 최대 수거 거리(maxPickupKm)는 "어디까지 수거하러 가는지"다(2026-11-19 멘토링).
 *   결과의 수거 가능 지역 확인과 계약 검토 담당이 공장 지역·거리와 견준다. 밖이면 계약 검토에서 승인이 막힌다.
 */
import { josa } from "../josa.ts";

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 차고지 고르기에서 "지금 위치 그대로"(저장된 차고지가 산업단지 가운데와 맞지 않을 때) */
export const KEEP_DEPOT = "keep";

export const MAX_ROUTES = 30;
const MAX_PLACES = 30;
/** 최대 수거 거리(km)의 위 한계. 백엔드 fleet.NUMBERS의 maxPickupKm과 같다 */
const MAX_PICKUP_KM = 1_000;

export type Route = { name: string; days: string[]; regions: string[]; complexes: string[] };

export type FleetRecord = {
  depot?: [number, number] | null;
  capacityKg?: number | null;
  capacityM3?: number | null;
  costPerKm?: number | null;
  vehicleCount?: number | null;
  /** 수거 가능 지역(시·도, 시·군·구, 산업단지 이름) */
  serviceAreas?: string[] | null;
  /** 차고지에서 수거하러 가는 최대 거리(km) */
  maxPickupKm?: number | null;
  routes?: Route[] | null;
  /** 서버가 정한다. 받기만 하고 보내지 않는다 */
  evidence?: string[];
};

/** 노선 하나의 입력. regions는 쉼표로 적은 글, complexes는 산업단지 이름 목록이다. key는 화면의 목록 열쇠다. */
export type RouteDraft = { key: string; name: string; days: string[]; regions: string; complexes: string[] };

export type FleetDraft = {
  depot: string;
  capacityKg: string;
  capacityM3: string;
  costPerKm: string;
  vehicleCount: string;
  /** 쉼표로 적은 수거 가능 지역 */
  serviceAreas: string;
  maxPickupKm: string;
  routes: RouteDraft[];
};

type Complex = { id: string; center: [number, number] };

const numText = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function sameSpot(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/** 저장된 차고지 좌표가 산업단지 가운데와 같으면 그 ID, 없으면 "", 다르면 KEEP_DEPOT */
export function depotChoice(depot: FleetRecord["depot"], complexes: Complex[]): string {
  if (!Array.isArray(depot) || depot.length !== 2) return "";
  return complexes.find((item) => sameSpot(item.center, depot))?.id ?? KEEP_DEPOT;
}

export function emptyRoute(key: string): RouteDraft {
  return { key, name: "", days: [], regions: "", complexes: [] };
}

export function fleetDraft(fleet: FleetRecord | null, complexes: Complex[]): FleetDraft {
  const routes = Array.isArray(fleet?.routes) ? fleet.routes : [];
  return {
    depot: depotChoice(fleet?.depot, complexes),
    capacityKg: numText(fleet?.capacityKg),
    capacityM3: numText(fleet?.capacityM3),
    costPerKm: numText(fleet?.costPerKm),
    vehicleCount: numText(fleet?.vehicleCount),
    serviceAreas: strings(fleet?.serviceAreas).join(", "),
    maxPickupKm: numText(fleet?.maxPickupKm),
    routes: routes.map((route, index) => ({
      key: `r${index}`,
      name: typeof route?.name === "string" ? route.name : "",
      days: sortDays(strings(route?.days)),
      regions: strings(route?.regions).join(", "),
      complexes: strings(route?.complexes),
    })),
  };
}

const parse = (value: string) => {
  const cleaned = value.replace(/,/g, "").trim();
  return cleaned === "" ? null : Number(cleaned);
};

/** 쉼표로 적은 수거 지역을 목록으로(앞뒤 빈칸을 떼고 겹침을 뺀다) */
export function regionList(text: string): string[] {
  return [...new Set(text.split(",").map((item) => item.trim()).filter(Boolean))];
}

export type FleetErrors = Partial<
  Record<"capacityKg" | "capacityM3" | "costPerKm" | "vehicleCount" | "routes" | "serviceAreas" | "maxPickupKm", string>
> & {
  /** 노선마다 첫 번째 문제(노선 순서와 같은 자리) */
  route?: (string | undefined)[];
};

/** 백엔드(app/v3/fleet.py)와 같은 범위로 검사한다. 빈 칸은 아직 모르는 값으로 둔다. */
export function fleetErrors(draft: FleetDraft): FleetErrors {
  const errors: FleetErrors = {};
  const range = (key: "capacityKg" | "capacityM3" | "costPerKm", label: string, min: number, inclusive: boolean, max: number) => {
    const value = parse(draft[key]);
    if (value === null) return;
    const above = inclusive ? value >= min : value > min;
    if (!Number.isFinite(value) || !above || value > max) {
      errors[key] = `${josa(label, "은/는")} ${inclusive ? `${min} 이상` : `${min}보다 크고`} ${max.toLocaleString("ko-KR")} 이하의 숫자로 적어 주세요.`;
    }
  };
  range("capacityKg", "적재 무게", 0, false, 100_000);
  range("capacityM3", "적재 부피", 0, false, 1_000);
  range("costPerKm", "운송비", 0, true, 1_000_000);
  const count = parse(draft.vehicleCount);
  if (count !== null && !(Number.isInteger(count) && count >= 1 && count <= 1_000)) {
    errors.vehicleCount = "차량 대수는 1에서 1,000 사이의 정수로 적어 주세요.";
  }
  const areas = regionList(draft.serviceAreas);
  if (areas.length > MAX_PLACES) errors.serviceAreas = `수거 가능 지역은 ${MAX_PLACES}곳까지 적을 수 있습니다.`;
  else if (areas.some((area) => area.length > 50)) errors.serviceAreas = "수거 가능 지역은 한 곳에 50자까지 적을 수 있습니다.";
  const reach = parse(draft.maxPickupKm);
  if (reach !== null && !(Number.isFinite(reach) && reach > 0 && reach <= MAX_PICKUP_KM)) {
    errors.maxPickupKm = `최대 수거 거리는 0보다 크고 ${MAX_PICKUP_KM.toLocaleString("ko-KR")} 이하의 km로 적어 주세요.`;
  }
  if (draft.routes.length > MAX_ROUTES) errors.routes = `노선은 ${MAX_ROUTES}개까지 둘 수 있습니다.`;
  const names = draft.routes.map((route) => route.name.trim());
  const route = draft.routes.map((item, index) => {
    const name = names[index];
    const regions = regionList(item.regions);
    if (!name) return "노선 이름을 적어 주세요.";
    if (name.length > 50) return "노선 이름은 50자까지 적을 수 있습니다.";
    if (names.indexOf(name) !== index) return "다른 노선과 이름이 같습니다. 노선마다 다른 이름을 적어 주세요.";
    if (item.days.length === 0) return "운행 요일을 하나 이상 골라 주세요.";
    if (regions.length === 0 && item.complexes.length === 0) return "수거 지역이나 산업단지를 하나 이상 정해 주세요.";
    if (regions.length > MAX_PLACES || item.complexes.length > MAX_PLACES) return `수거 지역과 산업단지는 각각 ${MAX_PLACES}곳까지 적을 수 있습니다.`;
    if (regions.some((region) => region.length > 50)) return "수거 지역은 한 곳에 50자까지 적을 수 있습니다.";
    return undefined;
  });
  if (route.some(Boolean)) errors.route = route;
  return errors;
}

export function hasFleetErrors(errors: FleetErrors): boolean {
  return Object.entries(errors).some(([key, value]) => (key === "route" ? (value as unknown[]).some(Boolean) : Boolean(value)));
}

/** 요일을 월~일 순서로, 겹침 없이. 목록에 없는 값은 버린다(백엔드가 받지 않는다). */
export function sortDays(days: string[]): string[] {
  return WEEKDAYS.filter((day) => days.includes(day));
}

export function toggleDay(days: string[], day: string): string[] {
  return sortDays(days.includes(day) ? days.filter((item) => item !== day) : [...days, day]);
}

/**
 * 저장할 fleet. 적은 값은 보내고, 있던 값을 비웠으면 null로 지우고, 처음부터 비어 있던 항목은 보내지 않는다.
 * 차고지를 "그대로"로 두면 보내지 않는다. 바꿀 것이 없으면 null(fleet을 보내지 않는다).
 */
export function fleetBody(draft: FleetDraft, previous: FleetRecord | null, complexes: Complex[]): FleetRecord | null {
  const body: FleetRecord = {};
  const had = (key: keyof FleetRecord) => previous?.[key] !== undefined && previous?.[key] !== null;
  if (draft.depot !== KEEP_DEPOT) {
    const complex = complexes.find((item) => item.id === draft.depot);
    if (complex) body.depot = complex.center;
    else if (had("depot")) body.depot = null;
  }
  for (const key of ["capacityKg", "capacityM3", "costPerKm", "vehicleCount", "maxPickupKm"] as const) {
    const value = parse(draft[key]);
    if (value !== null && Number.isFinite(value)) body[key] = value;
    else if (had(key)) body[key] = null;
  }
  const areas = regionList(draft.serviceAreas);
  if (areas.length > 0) body.serviceAreas = areas;
  else if (Array.isArray(previous?.serviceAreas) && previous.serviceAreas.length > 0) body.serviceAreas = null;
  if (draft.routes.length > 0) {
    body.routes = draft.routes.map((route) => ({
      name: route.name.trim(),
      days: sortDays(route.days),
      regions: regionList(route.regions),
      complexes: [...new Set(route.complexes)],
    }));
  } else if (Array.isArray(previous?.routes) && previous.routes.length > 0) {
    body.routes = null;
  }
  return Object.keys(body).length > 0 ? body : null;
}
