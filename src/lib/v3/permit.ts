/**
 * 허가 확인 상태(배정 경로 = 업체 · 폐기물 · 처리 방식)의 화면 문구. 결과표, 승인 카드, 법령 요건 제목이 모두 이 함수를 쓴다.
 * "업체가 입력한 허가 품목이 맞는다"와 "담당자가 허가증 원문을 대조했다"를 가른다. 원문 대조 기록이 있는 경로만 "허가증 대조 완료"다.
 * 순수 함수만 둔다(tests/permit.test.ts).
 */
import { josa } from "../josa.ts";
import type { PermitLevel } from "./types.ts";

export type PermitKey = "verified" | "pending_review" | "registered" | "mismatch";
export type PermitTone = "done" | "warn" | "stop" | "neutral";

export const PERMIT_LABEL: Record<PermitKey, string> = {
  verified: "허가증 대조 완료",
  pending_review: "허가증 검토 대기",
  registered: "등록 품목 일치 · 허가증 원본 확인 필요",
  mismatch: "이 경로로 진행 불가",
};

/** 집계 제목과 칩에 쓰는 짧은 이름 */
export const PERMIT_SHORT: Record<PermitKey, string> = {
  verified: "허가증 대조 완료",
  pending_review: "검토 대기",
  registered: "원본 확인 필요",
  mismatch: "진행 불가",
};

/** 상태 칩 색(DESIGN.md 상태 칩): 완료는 먹 채움, 행동이 필요한 확인은 warn-bg, 대기는 sunken, 불충족은 loss-bg */
export const PERMIT_TONE: Record<PermitKey, PermitTone> = {
  verified: "done",
  pending_review: "neutral",
  registered: "warn",
  mismatch: "stop",
};

const ORDER: PermitKey[] = ["verified", "pending_review", "registered", "mismatch"];

export type PermitState = {
  key: PermitKey;
  label: string;
  short: string;
  tone: PermitTone;
  /** 2026-11-19 이전 결과(원문 대조 기록이라는 개념이 없던 때)라 실제 근거 수준만 적는다 */
  legacy: boolean;
};

/**
 * 서버가 준 허가 상태를 화면 상태로. 예전 결과의 registry·document·self는 원문 대조 기록이 없으므로
 * 서버가 "충족"이라 했어도 "원본 확인 필요"로 그린다(mismatch는 그대로 진행 불가).
 */
export function permitState(permit: Pick<PermitLevel, "level"> | null | undefined): PermitState | null {
  if (!permit) return null;
  const legacy = !ORDER.includes(permit.level as PermitKey);
  const key: PermitKey = legacy ? "registered" : (permit.level as PermitKey);
  return { key, label: PERMIT_LABEL[key], short: PERMIT_SHORT[key], tone: PERMIT_TONE[key], legacy };
}

const LEGACY_SOURCE: Record<string, string> = {
  registry: "공공 허가 명부와 업체 입력",
  document: "업체가 허가증에서 읽은 값",
  self: "업체 입력",
};

/** 실제 근거 수준을 한 마디로: 원문 대조 기록, 업체가 올린 허가증(AI가 읽음), 공공 명부, 업체 입력 */
export function permitSource(permit: PermitLevel): string {
  if (!ORDER.includes(permit.level as PermitKey)) {
    return `${LEGACY_SOURCE[permit.level] ?? "업체 입력"} · 원문 대조 기록 없음(이전 결과)`;
  }
  switch (permit.source) {
    case "check":
      return "담당자의 허가증 원문 대조 기록";
    case "document":
      return permit.document ? "업체가 올린 허가증(AI가 읽음, 담당자 대조 전)" : "업체가 허가증에서 읽은 값(원문 없음)";
    case "registry":
      return "업체 입력과 공공 허가 명부(같은 업체인지 확정하지 못함)";
    default:
      return "업체 입력";
  }
}

/** "폐플라스틱(PP)" */
export function permitScope(permit: Pick<PermitLevel, "wasteItem" | "materials">): string {
  const item = permit.wasteItem ?? "폐기물";
  const materials = permit.materials ?? [];
  return materials.length > 0 ? `${item}(${materials.join(", ")})` : item;
}

/** "2026-11-19" (ISO 시각에서 날짜만) */
function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/** 대조한 사람: "(주)한빛정밀 담당자 김담당" */
export function checkerText(permit: PermitLevel): string {
  const by = permit.check?.checkedBy;
  if (!by) return "담당자";
  return `${by.orgName ?? "배출 기업"} 담당자${by.userName ? ` ${by.userName}` : ""}`;
}

/**
 * 결과표 줄과 승인 카드에 늘 보이는 한 줄.
 * 대조 완료: 누가 · 언제 · 어느 문서 몇 쪽에서 · 무엇(품목과 처리 방식)을 확인했는지. 확인 범위를 그 품목과 처리 방식으로 한정한다.
 * 검토 대기: 업체가 올린 허가증 이름과 해야 할 대조. 원본 확인 필요: 제출받을 문서. 진행 불가: 사유.
 */
export function permitLine(permit: PermitLevel): string {
  const state = permitState(permit);
  if (!state) return "";
  if (state.legacy) return `${permitSource(permit)}. 허가증 원본으로 품목과 처리 방법을 대조해야 합니다.`;
  const scope = josa(permitScope(permit), "와/과");
  const process = josa(permit.process ? `처리 방식 ${permit.process}` : "처리 방법", "을/를");
  switch (state.key) {
    case "verified": {
      const check = permit.check;
      const where = check ? `${check.document ?? "허가증"} ${check.page ?? "?"}쪽` : "허가증 원문";
      return `${josa(checkerText(permit), "이/가")} ${day(check?.checkedAt)} ${where}에서 ${scope} ${process} 대조했다고 기록했습니다. 이 확인은 이 폐기물과 처리 방식에만 해당하며, 발급기관의 진위·유효성 확인을 대신하지 않습니다.`;
    }
    case "pending_review":
      return permit.document
        ? `업체가 올린 ${josa(permit.document.name ?? "허가증", "을/를")} AI가 읽었습니다. 원문에서 ${scope} ${process} 대조해 기록해 주세요.`
        : `업체가 확인한 허가증 값만 있습니다. 원문에서 ${scope} ${process} 대조해 주세요.`;
    case "registered":
      return permitPaper(permit);
    default:
      return permit.text;
  }
}

/** 대조 전에 손에 들어야 할 문서: 업체가 허가증을 올렸으면 그 문서를 대조하고, 아니면 사본을 받아야 한다 */
export function permitPaper(permit: PermitLevel): string {
  if (permit.document) return `대조할 문서: 업체가 올린 ${permit.document.name ?? "허가증"}`;
  return `제출받을 문서: ${permit.todo?.submit ?? "허가증 사본"}`;
}

/** 대조 전이면 확인할 항목(서버가 준 todo). 대조 완료·진행 불가면 빈 목록 */
export function permitTodo(permit: PermitLevel): string[] {
  const state = permitState(permit);
  if (!state || state.key === "verified" || state.key === "mismatch") return [];
  if (permit.todo?.items?.length) return permit.todo.items;
  return ["영업대상 폐기물에 이 폐기물이 들어 있는지", "업종·처리 방법이 처리 방식과 맞는지"];
}

/** 담당자가 원문 대조를 기록할 수 있는가: 업체가 올린(쓸 수 있는) 허가증이 있고 아직 대조 완료가 아니다 */
export function canRecordCheck(permit: PermitLevel | null | undefined): boolean {
  const state = permitState(permit);
  return Boolean(permit && state && !state.legacy && state.key !== "verified" && permit.document);
}

/**
 * 경로마다의 상태를 집계한 한 줄: "허가증 대조 완료 1건 · 원본 확인 필요 2건".
 * 상태를 모르는 경로(배정 업체가 없거나 이전 결과)는 "허가 상태 확인 필요"로 센다.
 */
export function permitTally(permits: (Pick<PermitLevel, "level"> | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const permit of permits) {
    const state = permitState(permit);
    const word = state ? state.short : "허가 상태 확인 필요";
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const words = [...ORDER.map((key) => PERMIT_SHORT[key]), "허가 상태 확인 필요"];
  return words
    .filter((word) => counts.has(word))
    .map((word) => `${word} ${counts.get(word)}건`)
    .join(" · ");
}

/** 모든 경로가 대조 완료인가(하나라도 아니면 확정할 수 없다) */
export function allVerified(permits: (Pick<PermitLevel, "level"> | null | undefined)[]): boolean {
  return permits.length > 0 && permits.every((permit) => permitState(permit)?.key === "verified");
}
