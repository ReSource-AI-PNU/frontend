/**
 * 매입 기준표 검토 화면의 순수 함수(tests/criteria.test.ts).
 *  - AI가 읽은 초안(CriteriaDraft)을 담당자가 고칠 수 있는 줄(CriteriaRowState)로 바꾼다.
 *  - 줄을 검사하고(저장할 수 없는 까닭), 저장 요청(CriteriaRowInput)으로 바꾼다. 서버(criteria_llm.clean_rows)도 같은 검사를 한다.
 *  - 확인할 값이 남은 줄은 처음에 저장 대상이 아니다. 담당자가 값을 정하고 직접 골라야 저장된다.
 */
import { formatNumber } from "./format.ts";
import type { CriteriaDraft, CriteriaDraftRow, CriteriaRowInput } from "./types";

export const MATERIALS = ["PP", "PE", "HDPE", "LDPE", "LLDPE", "PET", "PS", "ABS", "PVC", "PC", "PA"] as const;
export const GRADES = ["A", "B", "C", "등외"] as const;
const PRICE_LIMIT = 10_000;
const QUANTITY_LIMIT = 1_000_000;

export type CriteriaValues = {
  material: string;
  form: string;
  grade: string;
  /** buy 매입(업체가 돈을 줌) | fee 처리비(배출 기업이 돈을 냄) */
  direction: "" | "buy" | "fee";
  /** kg당 원(크기만) */
  price: string;
  minMonthlyKg: string;
  maxContaminationPct: string;
  maxMoisturePct: string;
  collectionFee: "" | "included" | "separate";
  feePerPickup: string;
};
export type CriteriaKey = keyof CriteriaValues;

export type CriteriaRowState = {
  /** 초안의 행 ID(r1…) 또는 직접 더한 줄(n1…) */
  key: string;
  origin: "ai" | "manual";
  /** 저장할 줄로 골랐는지 */
  include: boolean;
  /** 고칠 칸을 펼쳤는지 */
  open: boolean;
  saved: boolean;
  page: number | null;
  /** 문서에 적힌 그 행 */
  quote: string | null;
  values: CriteriaValues;
  /** AI가 읽은 값(고친 칸을 가리고 원래 값을 취소선으로 남긴다). 직접 더한 줄은 null */
  ai: CriteriaValues | null;
  /** 칸마다 문서 근거 한 줄(값 원문, 단위를 찾은 곳, 환산, 쪽). 저장하면 근거 발췌가 된다 */
  sources: Partial<Record<CriteriaKey, string>>;
  /** 칸마다 AI가 확인해 달라고 한 까닭 */
  review: Partial<Record<CriteriaKey, string[]>>;
  /** 범위로 적힌 단가의 두 끝(kg당 원). 담당자가 하나를 고르기 쉽게 단추로 보인다 */
  candidates?: number[] | null;
  /** 코드가 바꾼 단위("320,000 원/톤 → kg당 320원"). 접힌 줄에도 원문 아래에 보인다 */
  conversions?: string[];
};

const EMPTY: CriteriaValues = {
  material: "",
  form: "",
  grade: "",
  direction: "",
  price: "",
  minMonthlyKg: "",
  maxContaminationPct: "",
  maxMoisturePct: "",
  collectionFee: "",
  feePerPickup: "",
};

const num = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function where(page: number | null | undefined) {
  return page ? ` · ${page}쪽` : "";
}

/** 칸의 문서 근거 한 줄. 표 밖(각주·문장)에서 왔으면 그 글을, 환산했으면 환산을 붙인다 */
function sourceLine(parts: (string | null | undefined)[], page: number | null | undefined): string | undefined {
  const text = parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
  return text ? `${text}${where(page)}`.slice(0, 280) : undefined;
}

function rowSources(row: CriteriaDraftRow): CriteriaRowState["sources"] {
  const { price, minMonthlyKg: quantity, maxContaminationPct: dirt, maxMoisturePct: wet, collectionFee: fee } = row;
  const priceRaw = price.raw ? `“${price.raw}”${price.unitRaw && !/[가-힣a-zA-Z/]/.test(price.raw) ? ` ${price.unitRaw}` : ""}` : null;
  return {
    price: sourceLine(
      [
        priceRaw,
        price.unitQuote ? `단위 “${price.unitQuote}”${price.unitPage && price.unitPage !== price.page ? `(${price.unitPage}쪽)` : ""}` : null,
        price.directionQuote ? `“${price.directionQuote}”` : null,
        price.quote && price.quote !== price.raw ? `“${price.quote}”` : null,
        price.note,
      ],
      price.page ?? row.page,
    ),
    minMonthlyKg: sourceLine(
      [quantity.raw ? `“${quantity.raw}”` : null, quantity.quote && quantity.quote !== quantity.raw ? `“${quantity.quote}”` : null, quantity.note],
      quantity.page ?? row.page,
    ),
    maxContaminationPct: sourceLine([dirt.raw ? `“${dirt.raw}”` : null, dirt.quote && dirt.quote !== dirt.raw ? `“${dirt.quote}”` : null], dirt.page ?? row.page),
    maxMoisturePct: sourceLine([wet.raw ? `“${wet.raw}”` : null, wet.quote && wet.quote !== wet.raw ? `“${wet.quote}”` : null], wet.page ?? row.page),
    collectionFee: sourceLine(
      [fee.raw ? `“${fee.raw}”` : null, fee.feeText && fee.feeText !== fee.raw ? `“${fee.feeText}”` : null, fee.quote && fee.quote !== fee.raw ? `“${fee.quote}”` : null],
      fee.page ?? row.page,
    ),
    material: row.material.raw ? `“${row.material.raw}”${where(row.page)}` : undefined,
  };
}

function valuesOf(row: CriteriaDraftRow): CriteriaValues {
  return {
    material: row.material.value ?? "",
    form: row.form.value ?? "",
    grade: row.grade.value ?? "",
    direction: row.price.direction ?? "",
    price: num(row.price.amount),
    minMonthlyKg: num(row.minMonthlyKg.value),
    maxContaminationPct: num(row.maxContaminationPct.value),
    maxMoisturePct: num(row.maxMoisturePct.value),
    collectionFee: row.collectionFee.value ?? "",
    feePerPickup: num(row.collectionFee.feePerPickupKrw),
  };
}

/**
 * 초안의 행을 고칠 수 있는 줄로. 확인할 값이 없는 줄은 저장 대상으로 고르고 접어 두며,
 * 확인할 값이 있는 줄은 고르지 않고 펼쳐 둔다(담당자가 값을 정해야 한다).
 */
export function rowsFromDraft(draft: CriteriaDraft): CriteriaRowState[] {
  return draft.rows.map((row) => {
    const values = valuesOf(row);
    const review: CriteriaRowState["review"] = {
      material: row.material.review,
      form: row.form.review,
      grade: row.grade.review,
      price: row.price.review,
      minMonthlyKg: row.minMonthlyKg.review,
      maxContaminationPct: row.maxContaminationPct.review,
      maxMoisturePct: row.maxMoisturePct.review,
      collectionFee: row.collectionFee.review,
    };
    const flagged = Object.values(review).some((list) => (list?.length ?? 0) > 0);
    return {
      key: row.id,
      origin: "ai",
      include: !flagged && row.ready,
      open: flagged || !row.ready,
      saved: false,
      page: row.page,
      quote: row.quote,
      values,
      ai: { ...values },
      sources: rowSources(row),
      review,
      candidates: row.price.candidates,
      conversions: [row.price.note, row.minMonthlyKg.note].filter((note): note is string => Boolean(note)),
    };
  });
}

export function emptyRow(key: string): CriteriaRowState {
  return { key, origin: "manual", include: true, open: true, saved: false, page: null, quote: null, values: { ...EMPTY }, ai: null, sources: {}, review: {} };
}

/** 빈 칸은 null, 숫자가 아니면 NaN. "1,000"과 " 320 "도 읽는다 */
export function numberInput(text: string): number | null {
  const trimmed = text.replace(/,/g, "").trim();
  if (trimmed === "") return null;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** 저장할 수 없는 까닭(줄 하나). 없으면 빈 목록 */
export function rowProblems(row: CriteriaRowState): string[] {
  const v = row.values;
  const out: string[] = [];
  if (!MATERIALS.includes(v.material as (typeof MATERIALS)[number])) out.push("재질을 골라 주세요.");
  const price = numberInput(v.price);
  if (price === null || Number.isNaN(price) || price < 0) out.push("kg당 단가를 숫자 하나로 적어 주세요.");
  else if (price > PRICE_LIMIT) out.push(`kg당 단가가 ${formatNumber(PRICE_LIMIT)}원을 넘습니다. 톤당 값이면 1,000으로 나눠 적어 주세요.`);
  if (!v.direction) out.push("매입인지 처리비인지 골라 주세요.");
  const quantity = numberInput(v.minMonthlyKg);
  if (quantity !== null && (Number.isNaN(quantity) || quantity < 0 || quantity > QUANTITY_LIMIT)) {
    out.push("한 달 최소 물량은 kg 단위의 숫자로 적어 주세요.");
  }
  for (const [key, label] of [
    ["maxContaminationPct", "오염도 상한"],
    ["maxMoisturePct", "수분 상한"],
  ] as const) {
    const value = numberInput(v[key]);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) out.push(`${label}은 0~100 사이의 숫자로 적어 주세요.`);
  }
  if (v.collectionFee === "separate") {
    const fee = numberInput(v.feePerPickup);
    if (fee !== null && (Number.isNaN(fee) || fee < 0)) out.push("1회 수거비는 숫자로 적어 주세요.");
  }
  if (v.form.trim().length > 40) out.push("형태는 40자 이내로 적어 주세요.");
  return out;
}

const identity = (row: CriteriaRowState) => `${row.values.material}|${row.values.grade}|${row.values.form.replace(/\s+/g, "")}`;

/** 저장할 줄 가운데 재질·등급·형태가 같은 줄(번호는 1부터). 없으면 null */
export function duplicateProblem(rows: CriteriaRowState[]): string | null {
  const seen = new Map<string, number>();
  for (const [index, row] of rows.entries()) {
    if (!row.include || row.saved) continue;
    const key = identity(row);
    const first = seen.get(key);
    if (first !== undefined) return `${first + 1}번째 줄과 ${index + 1}번째 줄의 재질·등급·형태가 같습니다. 한 줄만 고르거나 고쳐 주세요.`;
    seen.set(key, index);
  }
  return null;
}

/** 저장할 줄(골랐고, 아직 저장하지 않았고, 고칠 것이 없는 줄) */
export function savable(rows: CriteriaRowState[]): CriteriaRowState[] {
  return rows.filter((row) => row.include && !row.saved && rowProblems(row).length === 0);
}

/** 서버 항목 이름. 근거 발췌와 "고친 칸" 표시에 쓴다 */
const SERVER_KEY: Partial<Record<CriteriaKey, string>> = {
  material: "material",
  form: "form",
  grade: "grade",
  price: "unitPriceKrwPerKg",
  direction: "unitPriceKrwPerKg",
  minMonthlyKg: "minMonthlyKg",
  maxContaminationPct: "maxContaminationPct",
  maxMoisturePct: "maxMoisturePct",
  collectionFee: "collectionFee",
  feePerPickup: "collectionFeePerPickupKrw",
};

/** AI가 읽은 값과 다른 칸 */
export function editedKeys(row: CriteriaRowState): CriteriaKey[] {
  if (!row.ai) return [];
  const ai = row.ai;
  return (Object.keys(row.values) as CriteriaKey[]).filter((key) => {
    const now = row.values[key].trim();
    const before = ai[key].trim();
    const a = numberInput(now);
    const b = numberInput(before);
    if (a !== null && b !== null && !Number.isNaN(a) && !Number.isNaN(b)) return a !== b;
    return now !== before;
  });
}

/** 저장 요청의 행 하나. 고칠 것이 있는 줄이면 null */
export function rowPayload(row: CriteriaRowState): CriteriaRowInput | null {
  if (rowProblems(row).length > 0) return null;
  const v = row.values;
  const price = numberInput(v.price) as number;
  const value = (text: string) => {
    const parsed = numberInput(text);
    return parsed === null || Number.isNaN(parsed) ? null : parsed;
  };
  const quotes: Record<string, string> = {};
  for (const [key, text] of Object.entries(row.sources) as [CriteriaKey, string | undefined][]) {
    const server = SERVER_KEY[key];
    if (server && text) quotes[server] = text;
  }
  if (quotes.collectionFee && v.collectionFee === "separate") quotes.collectionFeePerPickupKrw = quotes.collectionFee;
  const edited = [...new Set(editedKeys(row).map((key) => SERVER_KEY[key]).filter((key): key is string => Boolean(key)))];
  return {
    draftRow: row.origin === "ai" ? row.key : null,
    material: v.material,
    grade: v.grade || null,
    form: v.form.trim() || null,
    unitPriceKrwPerKg: v.direction === "fee" ? -price : price,
    minMonthlyKg: value(v.minMonthlyKg),
    maxContaminationPct: value(v.maxContaminationPct),
    maxMoisturePct: value(v.maxMoisturePct),
    collectionFee: v.collectionFee || null,
    collectionFeePerPickupKrw: v.collectionFee === "separate" ? value(v.feePerPickup) : null,
    source: { quote: row.quote, page: row.page, quotes },
    edited,
    manual: row.origin === "manual",
  };
}

const FEE_TEXT = { included: "수거비 포함", separate: "수거비 따로" } as const;

/** 접힌 줄의 한 줄 요약: "PP · 사출 스크랩 · A등급 · 매입 kg당 320원 · 최소 월 1,000kg · 이물 3% · 수분 5% · 수거비 포함" */
export function rowSummary(row: CriteriaRowState): string {
  const v = row.values;
  const price = numberInput(v.price);
  const parts = [
    v.material || "재질 확인 필요",
    v.form.trim() || null,
    v.grade ? `${v.grade === "등외" ? "등외" : `${v.grade}등급`}` : null,
    price === null || Number.isNaN(price) || !v.direction
      ? "단가 확인 필요"
      : `${v.direction === "buy" ? "매입" : "처리비"} kg당 ${formatNumber(price)}원`,
  ];
  const quantity = numberInput(v.minMonthlyKg);
  if (quantity !== null && !Number.isNaN(quantity)) parts.push(`최소 월 ${formatNumber(quantity)}kg`);
  const dirt = numberInput(v.maxContaminationPct);
  if (dirt !== null && !Number.isNaN(dirt)) parts.push(`이물 ${formatNumber(dirt)}%`);
  const wet = numberInput(v.maxMoisturePct);
  if (wet !== null && !Number.isNaN(wet)) parts.push(`수분 ${formatNumber(wet)}%`);
  if (v.collectionFee) {
    const fee = numberInput(v.feePerPickup);
    parts.push(
      v.collectionFee === "separate" && fee !== null && !Number.isNaN(fee) ? `수거비 1회 ${formatNumber(fee)}원` : FEE_TEXT[v.collectionFee],
    );
  }
  return parts.filter(Boolean).join(" · ");
}

/** 줄의 확인 사유를 모두 모은다(칸 순서대로) */
export function reviewReasons(row: CriteriaRowState): string[] {
  return Object.values(row.review).flatMap((list) => list ?? []);
}

/** 표 밖 공통 조건 한 줄: "2쪽 · “※ 전 품목 최소 물량 월 1톤” → 1·2·3번째 줄" */
export function commonLine(common: CriteriaDraft["common"][number], rows: CriteriaRowState[]): string {
  const numbers = common.rows.map((id) => rows.findIndex((row) => row.key === id) + 1).filter((n) => n > 0);
  const target = numbers.length === 0 ? "적용 줄 없음" : numbers.length === rows.length ? "모든 줄" : `${numbers.join("·")}번째 줄`;
  return `${common.page ? `${common.page}쪽 · ` : ""}“${common.quote ?? ""}” → ${target}`;
}

/** 초안의 결과 한 줄(요약 먼저). by는 초안을 읽은 방법(ai | rules) */
export function draftHeadline(rows: CriteriaRowState[], by?: string): string {
  const left = rows.filter((row) => !row.saved);
  const flagged = left.filter((row) => reviewReasons(row).length > 0).length;
  const read = rows.filter((row) => row.origin === "ai").length;
  const reader = by === "rules" ? "문서의 표에서" : "AI가";
  const head = read > 0 ? `${reader} 매입 기준 ${read}줄을 읽었습니다.` : "매입 기준을 직접 적습니다.";
  if (left.length === 0) return `${head} 모두 저장했습니다.`;
  return flagged > 0
    ? `${head} 값이 애매해 확인할 줄이 ${flagged}개 있습니다. 확인한 줄만 저장됩니다.`
    : `${head} 문서 원문과 대조한 뒤 저장해 주세요.`;
}
