/**
 * 업체가 기록하는 실제 결과(검수 한 건)의 화면 규칙. 순수 함수만 둔다(tests/outcome.test.ts).
 *
 * 검수(계량) 한 건마다 검수 ID가 있다. 같은 날 같은 폐기물을 여러 번 받으면 건마다 따로 기록하고,
 * 이미 기록한 건을 고치는 것은 "정정"이다(앞 판은 이력으로 남는다). 새 반입 등록은 요청 번호(requestId)를
 * 보내 네트워크 재시도나 두 번 누름이 한 건으로 묶이게 한다.
 */
import { formatNumber, formatSignedPrice } from "./format.ts";
import type { Outcome, OutcomeRevision } from "./types.ts";

/** 등록·정정 요청 번호. 보낼 때 만들고, 응답을 받을 때까지 같은 번호로 다시 보낸다(렌더링 중에 부르지 않는다) */
export function newRequestId(): string {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === "function") return `ui-${source.randomUUID()}`;
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  return `ui-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** 표에 적는 검수 번호. 업체가 적은 계량표 번호가 있으면 그것, 없으면 검수 ID 앞 6자리 */
export function inspectionLabel(item: Pick<Outcome, "inspectionId" | "weighTicket" | "legacy">): string {
  if (item.weighTicket) return `계량표 ${item.weighTicket}`;
  if (item.legacy) return "이전 기록";
  return `검수 ${item.inspectionId.replace(/^insp-/, "").slice(0, 6)}`;
}

/** 같은 날 같은 폐기물을 여러 번 받았을 때 그 안에서 몇 번째인지. 한 건뿐이면 null */
export function sameDayOrder(items: Pick<Outcome, "inspectionId" | "streamId" | "inspectedOn">[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = `${item.streamId}|${item.inspectedOn}`;
    groups.set(key, [...(groups.get(key) ?? []), item.inspectionId]);
  }
  const found = new Map<string, string>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    ids.forEach((id, index) => found.set(id, `같은 날 ${ids.length}건 중 ${index + 1}번째`));
  }
  return found;
}

type Values = Pick<
  OutcomeRevision,
  "inspectedOn" | "actualGrade" | "actualUnitPriceKrwPerKg" | "actualKg" | "weighTicket" | "note" | "actualProcess"
>;

export type Change = { label: string; before: string; after: string; part: "grade" | "unitPrice" | "kg" | null };

const show = {
  kg: (value: number | null) => (value === null ? "기록 없음" : `${formatNumber(value)} kg`),
  price: (value: number | null) => (value === null ? "기록 없음" : formatSignedPrice(value)),
  text: (value: string | null) => value || "기록 없음",
};

/** 앞 판과 이 판에서 바뀐 값. 근거가 있는 값(등급·단가·중량)은 part로 어느 근거를 열지 알려 준다 */
export function changesBetween(before: Values, after: Values): Change[] {
  const changes: Change[] = [];
  if (before.inspectedOn !== after.inspectedOn) {
    changes.push({ label: "검수일", before: before.inspectedOn, after: after.inspectedOn, part: null });
  }
  if (before.actualKg !== after.actualKg) {
    changes.push({ label: "실제 중량", before: show.kg(before.actualKg), after: show.kg(after.actualKg), part: "kg" });
  }
  if (before.actualUnitPriceKrwPerKg !== after.actualUnitPriceKrwPerKg) {
    changes.push({
      label: "실제 단가",
      before: show.price(before.actualUnitPriceKrwPerKg),
      after: show.price(after.actualUnitPriceKrwPerKg),
      part: "unitPrice",
    });
  }
  if (before.actualGrade !== after.actualGrade) {
    changes.push({ label: "실제 등급", before: show.text(before.actualGrade), after: show.text(after.actualGrade), part: "grade" });
  }
  if ((before.weighTicket ?? null) !== (after.weighTicket ?? null)) {
    changes.push({ label: "계량표 번호", before: show.text(before.weighTicket), after: show.text(after.weighTicket), part: null });
  }
  if ((before.actualProcess ?? null) !== (after.actualProcess ?? null)) {
    changes.push({
      label: "실제 처리 방식",
      before: show.text(before.actualProcess ?? null),
      after: show.text(after.actualProcess ?? null),
      part: null,
    });
  }
  if ((before.note || "") !== (after.note || "")) {
    changes.push({ label: "메모", before: show.text(before.note), after: show.text(after.note), part: null });
  }
  return changes;
}

/** 가장 최근 정정에서 바뀐 값(정정하지 않은 건이면 빈 목록) */
export function latestChanges(item: Outcome): Change[] {
  const before = item.history[item.history.length - 1];
  return before ? changesBetween(before, item) : [];
}

/**
 * 같은 요청 번호로 다른 내용이 이미 저장되어 있다(응답을 받지 못한 뒤 값을 바꿔 다시 보낸 경우).
 * 새 건을 만들지 않았으니 표를 다시 불러와 확인하고 정정하게 한다.
 */
export const ALREADY_SAVED =
  "조금 전 보낸 기록이 이미 저장되어 있습니다. 표에서 확인하고, 값이 다르면 그 줄의 \"정정\"으로 고쳐 주세요.";

/** 정정하려던 사이 다른 담당자가 먼저 정정했다 */
export const CORRECTED_MEANWHILE = "그 사이 이 검수 기록이 먼저 정정되었습니다. 표를 다시 불러왔으니 최신 값을 보고 다시 정정해 주세요.";

/** 재전송이 한 건으로 처리됐을 때 */
export const REPLAYED = "같은 기록이 이미 저장되어 있어 한 건으로 처리했습니다.";
