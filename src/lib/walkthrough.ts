/**
 * 걸으며 진단(현장 워크스루). 담당자가 공장을 돌며 말한 문장에서 흐름 이름·공정·월 발생량·출처를 뽑아 흐름 카드를 만든다.
 * 빠진 정보는 되묻는다. 시연 워크스루와 직접 말하기가 같은 규칙을 쓴다.
 * 실제 서비스에서는 Azure AI Speech로 받아쓰고, Azure OpenAI가 같은 모양(WalkDraft)으로 뽑는다. 이 파일은 규칙 기반 모의다.
 */

import { josa } from "./josa";

export type SampleFrame = "sprue" | "defect" | "purge" | "film" | "scrap" | "pallet" | "bale";

export type WalkDraft = {
  id: string;
  name: string;
  process: string;
  monthlyKg?: number;
  /** 월 발생량을 어떻게 셈했는가. 예: "하루 25kg × 24일" */
  kgBasis?: string;
  origin?: "PIR" | "PCR";
  /** 출처를 말로 확인했는가(human), 공정 단어로 추정했는가(ai) */
  originSource?: "human" | "ai";
  frame: SampleFrame;
  /** 필름처럼 출처를 따로 물어야 하는 흐름 */
  film: boolean;
};

export type WalkLine = { who: "person" | "agent"; text: string; marks?: string[] };

export type WalkState = { drafts: WalkDraft[]; lines: WalkLine[]; asking?: "kg" | "origin" };

/** 한 달 근무일(가정). "하루 n킬로"를 월 발생량으로 바꿀 때 쓴다 */
export const WORK_DAYS = 24;

const DIGIT: Record<string, number> = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
const UNIT: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };

/** "25", "1,200", "이십오", "이백오십", "2백" 같은 수를 읽는다 */
export function parseKoreanNumber(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, "");
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const ch of t) {
    if (/\d/.test(ch)) {
      cur = cur * 10 + Number(ch);
      seen = true;
    } else if (ch in DIGIT) {
      cur = DIGIT[ch];
      seen = true;
    } else if (ch in UNIT) {
      total += (cur || 1) * UNIT[ch];
      cur = 0;
      seen = true;
    } else return null;
  }
  return seen ? total + cur : null;
}

const NUM = "([0-9][0-9,.]*|[영공일이삼사오육륙칠팔구십백천]+)";
const QTY = new RegExp(`(하루|일주일|한 ?주|한 ?달|월)\\s*에?\\s*${NUM}\\s*(킬로그램|킬로|키로|kg|톤)`);

/** 낱말 단위로 맞춘다("스크랩" 안의 "랩"이 필름으로 잡히지 않게) */
const tokens = (text: string) => text.split(/[\s,.!?·()]+/).filter(Boolean);
const startsWithAny = (text: string, words: string[]) => tokens(text).some((t) => words.some((w) => t.startsWith(w)));

const FILM_WORDS = ["스트레치", "필름", "비닐", "랩필름", "랩핑"];
const PCR_WORDS = /입고|원자재|원료 들어|납품|감겨 온|감았던|포장해서 온/;
const PIR_WORDS = /사출|불량|퍼지|검사|라인|공정에서|생산에서|금형/;

function nameOf(text: string): { name: string; frame: SampleFrame; film: boolean } | null {
  if (/스프루|러너/.test(text)) return { name: "스프루·러너", frame: "sprue", film: false };
  if (/불량/.test(text)) return { name: "불량 성형품", frame: "defect", film: false };
  if (/퍼지/.test(text)) return { name: "퍼지·색 혼합", frame: "purge", film: false };
  if (startsWithAny(text, FILM_WORDS)) return { name: PCR_WORDS.test(text) ? "원자재 포장 필름" : "포장 필름", frame: "film", film: true };
  if (startsWithAny(text, ["마대", "톤백"])) return { name: "PP 마대", frame: "film", film: true };
  if (/스크랩|절삭 ?칩/.test(text) && /철|금속|칩/.test(text)) return { name: "금속 스크랩", frame: "scrap", film: false };
  if (/목재|나무/.test(text) && /팔레트|파렛트/.test(text)) return { name: "폐목재 팔레트", frame: "pallet", film: false };
  return null;
}

function processOf(text: string): string | null {
  const line = text.match(/(사출|압출|프레스|가공)\s*([0-9][0-9,\s·]*)?\s*라인/);
  if (line) {
    const nums = (line[2] ?? "").match(/\d+/g);
    return nums ? `${line[1]} ${nums.join("·")}라인` : `${line[1]} 라인`;
  }
  if (/검사/.test(text)) return "검사 공정";
  if (/색 ?(바꿀|교체)|금형 ?세척/.test(text)) return "색 교체·금형 세척";
  if (/입고|원료 들어/.test(text)) return "원료 입고";
  return null;
}

function quantityOf(text: string): { kg: number; basis: string; span: string } | null {
  const m = text.match(QTY);
  if (!m) return null;
  const n = parseKoreanNumber(m[2]);
  if (n === null) return null;
  const perUnit = m[3] === "톤" ? n * 1000 : n;
  const period = m[1].replace(/\s/g, "");
  const factor = period === "하루" ? WORK_DAYS : period === "일주일" || period === "한주" ? 4 : 1;
  const kg = Math.round(perUnit * factor);
  const basis = factor === 1 ? `한 달 ${perUnit.toLocaleString("ko-KR")}kg` : period === "하루" ? `하루 ${perUnit}kg × ${WORK_DAYS}일` : `일주일 ${perUnit}kg × 4주`;
  return { kg, basis, span: m[0] };
}

const ASK = {
  kg: (d: WalkDraft) => `${josa(d.name, "은/는")} 한 달에 얼마나 나오나요? 하루 양으로 말해 주셔도 됩니다.`,
  origin: (d: WalkDraft) => `이 ${josa(d.name.replace("원자재 ", ""), "은/는")} 입고된 원자재를 감쌌던 건가요, 생산 공정에서 나온 건가요?`,
};

let seq = 0;
const nextId = () => `wd${++seq}`;

/**
 * 말 한 줄을 반영한다. 새 흐름 이름이 나오면 카드를 새로 만들고, 아니면 지금 카드를 채운다.
 * 반영한 뒤 빠진 정보가 있으면 되묻는 줄(agent)을 붙인다.
 */
export function applyUtterance(state: WalkState, text: string): WalkState {
  const drafts = state.drafts.map((d) => ({ ...d }));
  const marks: string[] = [];
  let current = drafts.at(-1);

  // 되묻기에 대한 답(출처)
  if (state.asking === "origin" && current) {
    if (/아니|생산|공정/.test(text) && !PCR_WORDS.test(text)) {
      current.origin = "PIR";
      current.originSource = "human";
      marks.push("생산", "공정");
    } else if (/네|맞|감겨|입고|원자재|원료/.test(text)) {
      current.origin = "PCR";
      current.originSource = "human";
      if (current.name === "포장 필름") current.name = "원자재 포장 필름";
      marks.push(...["감겨 온", "입고", "원자재", "원료"].filter((w) => text.includes(w)));
    }
  }

  const named = nameOf(text);
  if (named && (!current || (current.name !== named.name && !(state.asking && current.name.includes(named.name))))) {
    current = { id: nextId(), name: named.name, process: "", frame: named.frame, film: named.film };
    drafts.push(current);
  }
  if (!current) {
    return { ...state, lines: [...state.lines, { who: "person", text }, { who: "agent", text: "어떤 흐름인지 이름부터 말해 주세요. 예: 사출 라인 스프루, 원료 입고 스트레치 필름" }] };
  }
  if (named) marks.push(...[/스프루/, /러너/, /불량 성형품|불량/, /퍼지/, /스트레치 필름|필름/, /마대/].map((re) => text.match(re)?.[0]).filter((x): x is string => Boolean(x)));

  const proc = processOf(text);
  if (proc && !current.process) {
    current.process = proc;
    const span = text.match(/(사출|압출|프레스|가공)\s*[0-9,\s·]*라인|검사|색 ?바꿀|색 ?교체|금형 ?세척|입고/)?.[0];
    if (span) marks.push(span);
  }
  const qty = quantityOf(text);
  if (qty) {
    current.monthlyKg = qty.kg;
    current.kgBasis = qty.basis;
    marks.push(qty.span);
  }
  if (!current.origin) {
    if (current.film && PCR_WORDS.test(text)) {
      current.origin = "PCR";
      current.originSource = "human";
      if (current.name === "포장 필름") current.name = "원자재 포장 필름";
    } else if (!current.film && PIR_WORDS.test(text)) {
      current.origin = "PIR";
      current.originSource = "ai";
    }
  }

  const lines: WalkLine[] = [...state.lines, { who: "person", text, marks: [...new Set(marks)] }];
  let asking: WalkState["asking"];
  if (!current.monthlyKg) asking = "kg";
  else if (current.film && current.originSource !== "human") asking = "origin";
  if (asking) lines.push({ who: "agent", text: ASK[asking](current) });
  return { drafts, lines, asking };
}

/** 시연 워크스루: 녹산 (주)한빛정밀을 한 바퀴 돌며 한 말(시연용 대본). 되묻기는 규칙이 스스로 만든다 */
export const DEMO_SCRIPT: string[] = [
  "여기 사출 1, 2라인 옆 박스가 스프루하고 러너 모아 두는 데예요. 하루에 이십오 킬로 정도 나와요.",
  "검사에서 걸린 불량 성형품이요. 라벨 붙은 것도 섞여 있고, 한 달에 사백 킬로쯤 됩니다.",
  "이건 색 바꿀 때 나오는 퍼지 덩어리예요. ABS가 좀 섞여요.",
  "한 달에 이백오십 킬로요.",
  "여기는 스트레치 필름 모아 둔 거예요. 한 달에 삼백 킬로.",
  "원료 들어올 때 팔레트에 감겨 온 거예요.",
];

/** 대본 전체를 미리 돌려 차례마다의 상태를 만든다(재생은 이 목록을 앞에서부터 보여 준다) */
export function demoTimeline(): WalkState[] {
  seq = 0;
  const out: WalkState[] = [];
  let state: WalkState = { drafts: [], lines: [] };
  for (const text of DEMO_SCRIPT) {
    state = applyUtterance(state, text);
    out.push(state);
  }
  return out;
}

export function emptyWalk(): WalkState {
  return { drafts: [], lines: [] };
}
