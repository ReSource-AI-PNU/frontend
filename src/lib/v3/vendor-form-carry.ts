/**
 * 업체 정보 폼을 다시 그릴 때 담당자가 고쳐 둔 칸을 지키는 규칙.
 * AI 도우미에서 저장하면 폼을 새 저장값으로 다시 그린다. 이때 담당자가 아래 폼에 적어 놓고 아직 저장하지 않은 칸은
 * 그대로 두고, 도우미가 방금 저장한 항목의 칸만 새 값으로 바꾼다. 네트워크도 React도 부르지 않는다
 * (tests/vendor-form-carry.test.ts).
 */

/** 폼 칸의 글. fleet은 노선·차량 칸마다의 글(노선 목록 포함), prices는 매입 기준 ID → 단가 글 */
export type VendorFormDraft = {
  floor: string;
  ceiling: string;
  days: string;
  pickups: string;
  decline: string;
  process: string;
  fallbackGrade: string;
  fleet: Record<string, unknown>;
  offRoute: unknown;
  prices: Record<string, string>;
};

const GUARDRAIL_FIELD: Record<string, keyof VendorFormDraft> = {
  "guardrails.floorPriceKrwPerKg": "floor",
  "guardrails.ceilingPriceKrwPerKg": "ceiling",
  "guardrails.days": "days",
  "guardrails.minPickupsPerMonth": "pickups",
  "guardrails.autoDecline": "decline",
  process: "process",
};

/**
 * 도우미가 저장한 초안 키 → 새 저장값으로 바꿀 폼 칸. 노선·차량은 "fleet.칸", 매입 기준은 "prices".
 * 허가 품목은 폼 칸이 아니라 목록이라 여기 없다(목록은 늘 저장값으로 그린다).
 */
export function refreshedFields(keys: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys) {
    if (key in GUARDRAIL_FIELD) out.add(GUARDRAIL_FIELD[key]);
    else if (key.startsWith("fleet.")) out.add(key);
    else if (key === "criteria") out.add("prices");
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 다시 그릴 폼의 첫 값.
 * - start: 지난번 폼을 그릴 때의 저장값(여기서 달라진 칸이 담당자가 고친 칸이다)
 * - current: 지금 폼에 적혀 있는 값
 * - fresh: 새 저장값
 * - refreshed: 도우미가 방금 저장한 칸(refreshedFields). 이 칸은 고쳐 두었어도 새 저장값으로 바꾼다
 */
export function carryEdits(
  start: VendorFormDraft,
  current: VendorFormDraft,
  fresh: VendorFormDraft,
  refreshed: Set<string>,
): VendorFormDraft {
  const pick = <K extends keyof VendorFormDraft>(field: K, name: string = field): VendorFormDraft[K] =>
    !refreshed.has(name) && !same(current[field], start[field]) ? current[field] : fresh[field];
  const fleet: Record<string, unknown> = { ...fresh.fleet };
  for (const key of new Set([...Object.keys(fresh.fleet), ...Object.keys(current.fleet)])) {
    const edited = !same(current.fleet[key], start.fleet[key]);
    if (edited && !refreshed.has(`fleet.${key}`)) fleet[key] = current.fleet[key];
  }
  return {
    floor: pick("floor"),
    ceiling: pick("ceiling"),
    days: pick("days"),
    pickups: pick("pickups"),
    decline: pick("decline"),
    process: pick("process"),
    fallbackGrade: pick("fallbackGrade"),
    offRoute: pick("offRoute"),
    fleet,
    // 단가는 고친 글만 들고 있다(없으면 저장값을 쓴다). 매입 기준을 새로 저장했으면 고친 글을 버린다
    prices: refreshed.has("prices") ? {} : current.prices,
  };
}
