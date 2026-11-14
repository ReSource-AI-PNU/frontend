import "server-only";
import { KAU_PER_T, kauOf } from "@/lib/carbon";
import { findComplex } from "@/lib/complexes";
import { MIN_KG } from "@/lib/pickup";
import type { Company, Organization, WasteItem } from "@/lib/domain";
import type {
  BundleGroup,
  ClassifyResult,
  CostCarbonResult,
  Detection,
  DocumentDraft,
  FeasibilityResult,
  KnowledgeCard,
  MatchingResult,
  ProposalResult,
  Question,
  Reason,
  RegulationItem,
  RegulationResult,
  Route,
  Session,
  Stream,
  StreamDecision,
  StreamOrigin,
  StreamPartner,
  StreamRoute,
} from "@/lib/session/types";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

/**
 * 모의 에이전트. 공장의 폐플라스틱 흐름마다 규칙으로 갈 곳을 정하고 공장 단위로 합친다.
 * 숫자는 모두 시연용 가정값이다(문제 정의 v2, 9장 시연 장면). 실제 값은 인터뷰와 가격조사로 바꾼다.
 */

// ── 흐름 프로필: 시연 공장 네 흐름 + 품목별 일반 프로필 ──────────────────────────

export type SampleVariant = "bale" | "sprue" | "defect" | "purge" | "film" | "scrap" | "pallet" | "box";

type StreamProfile = {
  key: string;
  name: string;
  process: string;
  item: WasteItem;
  detail: string;
  material: string;
  singleMaterial: boolean;
  origin: StreamOrigin;
  sample: SampleVariant;
  defaultKg: number;
  mainBox: [number, number, number, number];
  contaminants: { label: string; ratio: number; box: [number, number, number, number] }[];
};

/** 녹산 PP 사출 공장 (주)한빛정밀(가상)의 네 흐름 */
export const SAMPLE_FACTORY: StreamProfile[] = [
  {
    key: "sprue",
    name: "스프루·러너",
    process: "사출 1·2라인",
    item: "폐플라스틱",
    detail: "PP 사출 스프루·러너",
    material: "PP",
    singleMaterial: true,
    origin: "PIR",
    sample: "sprue",
    defaultKg: 600,
    mainBox: [0.08, 0.2, 0.84, 0.66],
    contaminants: [],
  },
  {
    key: "defect",
    name: "불량 성형품",
    process: "검사 공정",
    item: "폐플라스틱",
    detail: "PP 불량 하우징",
    material: "PP",
    singleMaterial: true,
    origin: "PIR",
    sample: "defect",
    defaultKg: 400,
    mainBox: [0.06, 0.16, 0.88, 0.7],
    contaminants: [
      { label: "종이 라벨", ratio: 0.04, box: [0.3, 0.3, 0.16, 0.14] },
      { label: "금속 인서트", ratio: 0.02, box: [0.62, 0.52, 0.12, 0.12] },
    ],
  },
  {
    key: "purge",
    name: "퍼지·색 혼합",
    process: "색 교체·금형 세척",
    item: "폐플라스틱",
    detail: "PP+ABS 퍼지 덩어리",
    material: "PP+ABS",
    singleMaterial: false,
    origin: "PIR",
    sample: "purge",
    defaultKg: 250,
    mainBox: [0.1, 0.24, 0.8, 0.62],
    contaminants: [
      { label: "ABS 혼입", ratio: 0.35, box: [0.52, 0.34, 0.22, 0.24] },
      { label: "탄화물", ratio: 0.05, box: [0.24, 0.56, 0.14, 0.14] },
    ],
  },
  {
    key: "film",
    name: "원자재 포장 필름",
    process: "원료 입고",
    item: "포장재",
    detail: "LDPE 스트레치 필름",
    material: "LDPE",
    singleMaterial: true,
    origin: "PCR",
    sample: "film",
    defaultKg: 300,
    mainBox: [0.06, 0.2, 0.88, 0.66],
    contaminants: [
      { label: "종이 태그", ratio: 0.02, box: [0.6, 0.3, 0.12, 0.12] },
      { label: "테이프", ratio: 0.01, box: [0.26, 0.58, 0.14, 0.1] },
    ],
  },
];

const GENERIC: Record<WasteItem, StreamProfile> = {
  폐플라스틱: { ...SAMPLE_FACTORY[1], key: "plastic", name: "폐플라스틱", process: "" },
  포장재: { ...SAMPLE_FACTORY[3], key: "packaging", name: "포장재", process: "" },
  "금속 스크랩": {
    key: "metal",
    name: "금속 스크랩",
    process: "",
    item: "금속 스크랩",
    detail: "철 가공 칩",
    material: "Fe",
    singleMaterial: true,
    origin: "PIR",
    sample: "scrap",
    defaultKg: 500,
    mainBox: [0.08, 0.25, 0.84, 0.6],
    contaminants: [{ label: "절삭유", ratio: 0.08, box: [0.3, 0.5, 0.24, 0.18] }],
  },
  폐목재: {
    key: "wood",
    name: "목재 팔레트",
    process: "원료 입고",
    item: "폐목재",
    detail: "목재 팔레트",
    material: "목재",
    singleMaterial: true,
    origin: "PCR",
    sample: "pallet",
    defaultKg: 400,
    mainBox: [0.1, 0.2, 0.8, 0.66],
    contaminants: [{ label: "못·철물", ratio: 0.06, box: [0.22, 0.4, 0.16, 0.14] }],
  },
};

/** 업로드한 흐름 이름으로 프로필을 고른다(실제로는 식별 모델이 정한다) */
export function profileFor(name: string, fallback: WasteItem): StreamProfile {
  // 금속·목재를 먼저 본다("스크랩"의 "랩"이 필름 규칙에 걸리지 않도록)
  if (/철|금속|칩|스크랩|scrap/i.test(name)) return GENERIC["금속 스크랩"];
  if (/팔레트|목재|나무/i.test(name)) return GENERIC.폐목재;
  if (/스프루|러너|sprue|runner/i.test(name)) return SAMPLE_FACTORY[0];
  if (/불량|파손|defect/i.test(name)) return SAMPLE_FACTORY[1];
  if (/퍼지|혼합|덩어리|purge/i.test(name)) return SAMPLE_FACTORY[2];
  if (/필름|스트레치|비닐|랩핑|마대|톤백|포장/i.test(name)) return SAMPLE_FACTORY[3];
  return GENERIC[fallback];
}

export function buildStream(id: string, profile: StreamProfile, opts: { name?: string; media: Stream["media"]; kg?: number; modelVersion: string }): Stream {
  const detections: Detection[] = [
    { id: `${id}_main`, label: profile.detail, kind: "item", confidence: profile.singleMaterial ? 0.93 : 0.81, box: profile.mainBox, source: "ai" },
    ...profile.contaminants.map((c, i) => ({
      id: `${id}_c${i + 1}`,
      label: c.label,
      kind: "contaminant" as const,
      confidence: 0.82 - i * 0.07,
      box: c.box,
      ratio: c.ratio,
      source: "ai" as const,
    })),
  ];
  const kg = opts.kg ?? profile.defaultKg;
  const classify: ClassifyResult = {
    item: profile.item,
    detail: profile.detail,
    material: profile.material,
    singleMaterial: profile.singleMaterial,
    confidence: detections[0].confidence,
    estimatedKg: Math.round((kg * 0.97) / 10) * 10,
    frames: 24,
    detections,
    model: { name: "rtdetr-waste", version: opts.modelVersion },
    durationMs: 3600,
  };
  return {
    id,
    name: opts.name?.trim() || profile.name,
    process: profile.process,
    media: opts.media,
    classify,
    origin: profile.origin,
    originSource: "ai",
    monthlyKg: kg,
    monthlyKgConfirmed: false,
  };
}

export function sampleMedia(profile: StreamProfile): Stream["media"] {
  return [{ id: `sample_${profile.key}`, kind: "sample", name: `녹산_${profile.name.replace(/\s/g, "")}_시연.jpg`, url: `sample:${profile.sample}` }];
}

/** 처음부터 묻는 질문. 흐름별 발생량은 흐름 화면에서 직접 확정한다 */
export function initialQuestions(streams: Stream[]): Question[] {
  const qs: Question[] = [
    {
      id: "analysis",
      step: "regulation",
      text: "매각할 흐름의 성분분석표가 있나요?",
      why: "순환자원 인정 신청과 일부 매입처는 유해물질 기준 충족 증빙을 요구합니다.",
      kind: "choice",
      options: ["있음", "없음"],
    },
  ];
  for (const s of streams.filter((x) => x.origin === "PCR")) {
    qs.push({
      id: `pcr-proof:${s.id}`,
      step: "regulation",
      streamId: s.id,
      text: `${s.name}의 입고 기록(원자재 납품서·포장 사양)이 있나요?`,
      why: "공장이 쓰고 버린 포장재를 사용 후(PCR) 재생원료로 팔려면 출처를 증명해야 합니다.",
      kind: "choice",
      options: ["있음", "없음"],
    });
  }
  return qs;
}

// ── 가격·탄소 가정값 ──────────────────────────────────────────────────────

const LABOR_PER_HOUR = 15000;

/** 혼합 사업장폐기물로 소각 위탁할 때 kg당 손익(처리비라 음수) */
const INCINERATE_PER_KG: Record<WasteItem, number> = { 폐플라스틱: -250, 포장재: -250, "금속 스크랩": -250, 폐목재: -120 };
const LANDFILL_PER_KG: Record<WasteItem, number> = { 폐플라스틱: -230, 포장재: -230, "금속 스크랩": -180, 폐목재: -120 };
/** 단일 재질·이물 제거 후 매각 단가 */
const SELL_PER_KG: Record<WasteItem, number> = { 폐플라스틱: 300, 포장재: 150, "금속 스크랩": 260, 폐목재: 40 };
/** 신재 PP 대체 가치(신재 약 1,300원/kg − 분쇄·관리비). 혼합 비율 10% 이내 가정 */
const REUSE_PER_KG = 900;
const PYROLYSIS_PER_KG = -80;
/** 단지 묶음 순회 수거의 운반비 분담(kg당) */
const BUNDLE_TRANSPORT_PER_KG = 50;
/** 소량 단독 매각 시 출장비 때문에 깎이는 단가(kg당) */
const SOLO_PENALTY_PER_KG = 190;

/** tCO₂e/t, 신재 대비 (+ 배출, − 회피) */
const CARBON: Record<StreamRoute | "landfill", number> = { incinerate: 0.78, landfill: 0.51, sell: -1.5, bundle: -1.45, reuse: -1.6, pyrolysis: -0.3 };

export { MIN_KG } from "@/lib/pickup";

function contamination(s: Stream) {
  return s.classify.detections.filter((d) => d.kind === "contaminant" && !d.removed).reduce((sum, d) => sum + (d.ratio ?? 0), 0);
}

/** 재질이 섞였는지: 식별 결과 + 사람이 지운 혼입 박스 반영 */
function mixed(s: Stream) {
  if (!s.classify.singleMaterial) {
    const mixDet = s.classify.detections.find((d) => d.kind === "contaminant" && /혼입|혼합/.test(d.label));
    return mixDet ? !mixDet.removed && (mixDet.ratio ?? 0) > 0.05 : true;
  }
  return false;
}

/** 규칙 엔진: 흐름 하나의 갈 곳 */
export function chooseRoute(s: Stream): { route: StreamRoute; reason: string } {
  const c = contamination(s);
  const item = s.classify.item;
  if (item === "금속 스크랩") return { route: "sell", reason: "금속 스크랩은 시장이 활발해 소량도 매입처가 있습니다." };
  if (mixed(s)) return { route: "pyrolysis", reason: `${s.classify.material} 재질이 섞여 기계적 재활용이 어렵습니다. 소각보다 싼 열분해 위탁이 낫습니다.` };
  if (s.origin === "PCR") {
    const { minKg } = MIN_KG[item];
    return s.monthlyKg < minKg
      ? { route: "bundle", reason: `공장이 쓰고 버린 ${s.classify.material} 포장재라 사용 후(PCR) 원료가 됩니다. 월 ${s.monthlyKg}kg은 혼자 팔기엔 적어 같은 단지 기업과 묶습니다.` }
      : { route: "sell", reason: `사용 후(PCR) 포장재이고 물량이 충분해 단독 매각이 가능합니다.` };
  }
  if (item === "폐플라스틱" && c < 0.02) return { route: "reuse", reason: `깨끗한 단일 ${s.classify.material}라 분쇄해서 같은 공정에 다시 넣을 수 있습니다(신재 대비 10% 이내 혼합).` };
  if (c < 0.12) return { route: "sell", reason: `단일 ${s.classify.material}이고 이물이 ${Math.round(c * 100)}%라, 이물을 떼면 재생원료 업체에 팔 수 있습니다.` };
  return { route: "incinerate", reason: `이물이 ${Math.round(c * 100)}%로 많아 매입 기준을 넘습니다. 이물을 줄이기 전까지는 소각이 불가피합니다.` };
}

function perKgFor(route: StreamRoute, s: Stream) {
  const item = s.classify.item;
  switch (route) {
    case "reuse":
      return REUSE_PER_KG;
    case "sell":
      return SELL_PER_KG[item];
    case "bundle":
      return SELL_PER_KG[item];
    case "pyrolysis":
      return PYROLYSIS_PER_KG;
    case "incinerate":
      return INCINERATE_PER_KG[item];
  }
}

function actionFor(route: StreamRoute, s: Stream): StreamDecision["action"] {
  const dets = s.classify.detections.filter((d) => d.kind === "contaminant" && !d.removed && !/혼입|혼합/.test(d.label));
  if (route === "sell" && dets.length) {
    return { title: `${dets.map((d) => d.label).join("·")}을 떼고 따로 모으세요`, laborHours: 2, laborCost: 2 * LABOR_PER_HOUR };
  }
  if (route === "bundle") return { title: `${s.name}을 마대에 따로 모으세요`, laborHours: 1, laborCost: LABOR_PER_HOUR };
  if (route === "reuse") return { title: "색별로 분리해 분쇄기에 넣으세요", laborHours: 2, laborCost: 2 * LABOR_PER_HOUR };
  return undefined;
}

function ladderFor(route: StreamRoute, s: Stream): StreamDecision["ladder"] {
  const now = INCINERATE_PER_KG[s.classify.item];
  if (route === "reuse") return [{ label: "현재(혼합 소각)", perKg: now }, { label: "분리해 매각", perKg: SELL_PER_KG[s.classify.item] }, { label: "분쇄 재투입", perKg: REUSE_PER_KG }];
  if (route === "sell") return [{ label: "현재(혼합 소각)", perKg: now }, { label: "이물 일부 제거", perKg: Math.round(SELL_PER_KG[s.classify.item] / 2) }, { label: "이물 제거 후 매각", perKg: SELL_PER_KG[s.classify.item] }];
  if (route === "bundle") return [{ label: "현재(혼합 소각)", perKg: now }, { label: "분리해 단독 매각", perKg: SELL_PER_KG[s.classify.item] - SOLO_PENALTY_PER_KG }, { label: "단지 묶음 매각", perKg: SELL_PER_KG[s.classify.item] - BUNDLE_TRANSPORT_PER_KG }];
  if (route === "pyrolysis") return [{ label: "현재(혼합 소각)", perKg: now }, { label: "열분해 위탁", perKg: PYROLYSIS_PER_KG }];
  return [{ label: "현재(혼합 소각)", perKg: now }];
}

function decide(s: Stream, override?: StreamRoute): StreamDecision {
  const ai = chooseRoute(s);
  const route = override ?? ai.route;
  const kg = s.monthlyKg;
  const t = kg / 1000;
  const now = INCINERATE_PER_KG[s.classify.item];
  const after = perKgFor(route, s);
  const action = actionFor(route, s);
  const transport = route === "bundle" ? BUNDLE_TRANSPORT_PER_KG * kg : 0;
  const all: StreamRoute[] = ["reuse", "sell", "bundle", "pyrolysis", "incinerate"];
  const alternatives = all
    .filter((r) => r !== route)
    .filter((r) => !(r === "reuse" && (s.classify.item !== "폐플라스틱" || s.origin === "PCR")))
    .filter((r) => !(r === "bundle" && s.origin !== "PCR"))
    .map((r) => ({
      route: r,
      perKg: perKgFor(r, s) - (r === "bundle" ? BUNDLE_TRANSPORT_PER_KG : 0) - (r === "sell" && s.origin === "PCR" && kg < MIN_KG[s.classify.item].minKg ? SOLO_PENALTY_PER_KG : 0),
      note:
        r === "reuse"
          ? "같은 공정에 다시 넣으려면 단일 재질·무오염이어야 합니다."
          : r === "sell"
            ? mixed(s)
              ? "재질이 섞여 매입처가 받지 않습니다."
              : kg < MIN_KG[s.classify.item].minKg && s.origin === "PCR"
                ? "혼자 팔면 출장비 때문에 단가가 깎입니다."
                : "이물을 떼야 매입 기준을 맞춥니다."
            : r === "bundle"
              ? "같은 단지 기업과 순회 수거로 묶습니다."
              : r === "pyrolysis"
                ? "재질이 섞인 흐름에 맞는 경로입니다."
                : "지금처럼 혼합 폐기물로 위탁합니다.",
    }));
  return {
    streamId: s.id,
    route,
    reason: override && override !== ai.route ? `담당자가 ${STREAM_ROUTE_LABEL[override]}을(를) 골랐습니다. AI 추천은 ${STREAM_ROUTE_LABEL[ai.route]}입니다.` : ai.reason,
    currentPerKg: now,
    afterPerKg: route === "bundle" ? after - BUNDLE_TRANSPORT_PER_KG : after,
    monthlyNow: Math.round(now * kg),
    monthlyAfter: Math.round(after * kg - transport - (action?.laborCost ?? 0)),
    carbonNowT: Math.round(CARBON.incinerate * t * 100) / 100,
    carbonAfterT: Math.round(CARBON[route] * t * 100) / 100,
    action,
    ladder: ladderFor(route, s),
    alternatives,
    aiRoute: override && override !== ai.route ? ai.route : undefined,
  };
}

export function buildFeasibility(session: Session, cards: KnowledgeCard[], overrides: Record<string, StreamRoute> = {}): FeasibilityResult {
  const decisions = session.streams.map((s) => decide(s, overrides[s.id]));
  const totalNow = decisions.reduce((a, d) => a + d.monthlyNow, 0);
  const totalAfter = decisions.reduce((a, d) => a + d.monthlyAfter, 0);
  const carbonNowT = Math.round(decisions.reduce((a, d) => a + d.carbonNowT, 0) * 100) / 100;
  const carbonAfterT = Math.round(decisions.reduce((a, d) => a + d.carbonAfterT, 0) * 100) / 100;
  const items = new Set(session.streams.map((s) => s.classify.item));
  const reasons: Reason[] = [
    { text: "부산권역 PP 압축품 300원/kg, LDPE 필름 150원/kg", source: "재활용가능자원 가격조사(가정값)" },
    { text: "혼합 사업장폐기물 소각 위탁 250원/kg(톤당 25만 원)", source: "업체 인터뷰 평균(가정값)" },
    { text: "공정 부산물은 재생원료 의무 실적에 들어가지 않습니다. 공장이 쓰고 버린 포장재는 사용 후 원료로 인정될 여지가 있습니다(해석 확인 필요).", source: "재생원료 사용의무 고시 별표2 비고3, EU PPWR 제7조" },
  ];
  for (const card of cards.filter((c) => items.has(c.item) && c.status === "adopted").slice(0, 2)) {
    reasons.push({ text: `${card.condition} → ${card.judgment}`, source: `${card.orgName} · 동의 ${card.agrees.length}명`, knowledgeCardId: card.id });
  }
  return {
    decisions,
    totalNow,
    totalAfter,
    carbonNowT,
    carbonAfterT,
    reasons,
    note: "재투입은 신재 대비 10% 이내로 섞는다고 가정했습니다. 그 이상은 물성 시험이 필요합니다.",
  };
}

// ── 규정 ─────────────────────────────────────────────────────────────

export function buildRegulation(session: Session): RegulationResult {
  const f = session.feasibility;
  const byStream = new Map(session.streams.map((s) => [s.id, s]));
  const answer = (id: string) => session.questions.find((q) => q.id === id)?.answer;
  const items: RegulationItem[] = [];
  for (const d of f?.decisions ?? []) {
    const s = byStream.get(d.streamId);
    if (!s) continue;
    if (d.route === "reuse") {
      items.push({
        id: `reuse:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 공정 재투입`,
        status: "ok",
        result: "가능",
        citation: "「폐기물관리법」 제2조(정의) 관련 해석 · 사업장 내 원료 재사용",
        excerpt: "같은 사업장 공정에 원료로 다시 쓰는 부산물은 외부로 배출하지 않으므로 위탁 처리 대상이 아닙니다. 보관 기간과 장부 기록은 지킵니다.",
      });
    }
    if (d.route === "sell") {
      items.push({
        id: `sell:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 매입처 허가 범위`,
        status: "ok",
        result: "허가 품목 일치",
        citation: "「폐기물관리법」 제25조 폐기물처리업 허가 · 재활용 유형",
        excerpt: "매입처가 폐합성수지 재활용 허가를 갖고 있어 위탁할 수 있습니다. 인계는 올바로시스템 전자인계서로 합니다.",
      });
      items.push({
        id: `circular:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 순환자원 인정`,
        status: answer("analysis") === "있음" ? "ok" : "ask",
        result: answer("analysis") === "있음" ? "신청 가능" : "성분분석표 필요",
        citation: "「순환경제사회 전환 촉진법」 순환자원 인정 요건",
        excerpt: "유해물질 기준, 경제성, 방치 우려가 없을 것 등을 충족하면 순환자원으로 인정받아 폐기물 규제에서 벗어납니다.",
      });
    }
    if (d.route === "pyrolysis") {
      items.push({
        id: `pyro:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 열분해 위탁`,
        status: "ok",
        result: "가능",
        citation: "「폐기물관리법 시행규칙」 재활용 유형(열분해유 생산)",
        excerpt: "열분해 재활용 허가를 가진 업체에 위탁합니다. 혼합 재질도 받지만 염소계(PVC) 혼입은 피해야 합니다.",
      });
    }
    if (d.route === "bundle") {
      const proof = answer(`pcr-proof:${s.id}`);
      items.push({
        id: `pcr:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 사용 후(PCR) 출처 증빙`,
        status: proof === "있음" ? "ok" : "ask",
        result: proof === "있음" ? "증빙 가능" : proof === "없음" ? "일반 재생원료로 매각" : "정보 부족",
        citation: "재생원료 사용의무 고시(기후에너지환경부고시 제2025-165호) 별표2 비고3",
        excerpt: "재생원료 사용 실적은 최종 소비자가 쓴 뒤 나온 원료만 인정하고, 공정부산물은 제외합니다. 공장이 원자재 포장재로 쓰고 버린 필름은 사용 후 원료로 볼 여지가 있으나 해석 확인이 필요합니다.",
      });
      items.push({
        id: `bundle:${s.id}`,
        streamId: s.id,
        label: `${s.name} · 단지 내 순회 수거`,
        status: "ok",
        result: "가능 (각사 개별 계약)",
        citation: "「폐기물관리법」 제18조제5항, 시행규칙 제21조제1항제7호의2, 공동처리 업무처리지침",
        excerpt: "같은 산업단지 사업장은 공동 수집·운반이 가능합니다. 공동 보관은 금지되므로 업체가 사업장을 순회하며 사업장마다 계량하고 인계서를 따로 씁니다.",
      });
    }
  }
  const asks = items.filter((i) => i.status === "ask").length;
  return {
    items,
    conclusion:
      asks === 0
        ? { tone: "gain", text: "모든 흐름의 경로가 규정상 가능합니다. 이행 계획대로 진행할 수 있습니다." }
        : { tone: "warn", text: `경로는 모두 가능하지만 확인할 정보가 ${asks}건 남았습니다. 답하지 않으면 보수적인 조건(일반 재생원료 매각)으로 계산합니다.` },
  };
}

// ── 업체·묶음 매칭 ───────────────────────────────────────────────────────

function distanceM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** 단지 밖 열분해 업체. 업체 화면(단지 처리업체 시점)에는 나오지 않고, 결과는 배출 기업 담당자가 기록한다 */
const PYROLYSIS_PARTNERS = [{ id: "ext_namhae_pyro", name: "(주)남해열분해", location: "경남 김해 · 단지에서 약 18km", distanceM: 18000 }];

/**
 * 필름 흐름인가. 수지는 PP·HDPE·LDPE·PET·PS·ABS·PVC 같은 정해진 이름으로 저장된다(backend ① 식별의 답 형식).
 * "PE"로 부분 일치하면 PET(페트)와 HDPE(경질 통)까지 필름으로 잡히므로 이름 전체로 맞춘다.
 */
const FILM_RESINS = new Set(["LDPE", "LLDPE"]);
const isFilm = (s: Stream) => FILM_RESINS.has(s.classify.material.trim().toUpperCase());

/**
 * 같은 묶음에 넣을 수 있는 다른 회사의 흐름인가. 같은 재질·같은 출처끼리만 묶는다.
 * 사용 후 필름(PCR)에 공정 스크랩(PIR)이나 골판지를 섞으면 출처 증빙과 품질이 흐려진다.
 */
export function isPeerStream(s: Stream, w: Company["wasteStreams"][number]) {
  if (isFilm(s)) return s.origin === "PCR" ? /스트레치|포장 필름/.test(w.detail ?? "") : /필름/.test(w.detail ?? "");
  return w.item === s.classify.item && (w.detail ?? "").includes(s.classify.material);
}

/** 도로 계수: 단지 안 도로는 직선거리보다 약 30% 길다고 본다(가정) */
const ROAD_FACTOR = 1.3;

/**
 * 순회 순서. 수거 업체 위치에서 출발해 아직 들르지 않은 사업장 중 가장 가까운 곳으로 간다(가장 가까운 이웃).
 * 사업장이 서너 곳이라 최적 경로와 거의 같다. 실제 서비스에서는 OR-Tools 차량 경로 문제로 푼다(backend#14).
 */
function visitRoute(start: [number, number], group: BundleGroup["group"], companies: Company[], selfId: string | undefined, selfLoc: [number, number]) {
  const loc = new Map(companies.map((c) => [c.id, c.location]));
  const left = group.map((g) => ({ id: g.companyId, at: (g.isSelf ? loc.get(selfId ?? "") : loc.get(g.companyId)) ?? selfLoc }));
  const order: string[] = [];
  let here = start;
  let meters = 0;
  while (left.length) {
    left.sort((a, b) => distanceM(here, a.at) - distanceM(here, b.at));
    const next = left.shift()!;
    meters += distanceM(here, next.at);
    order.push(next.id);
    here = next.at;
  }
  meters += distanceM(here, start);
  return { order, routeM: Math.round((meters * ROAD_FACTOR) / 10) * 10 };
}

export function buildMatching(session: Session, org: Organization, companies: Company[]): MatchingResult {
  const anchor =
    companies.find((c) => c.name.includes("한빛정밀")) ?? companies.find((c) => c.role === "배출") ?? companies[0];
  const self: [number, number] = anchor?.location ?? [0, 0];
  const decisions = session.feasibility?.decisions ?? [];
  const byStream = new Map(session.streams.map((s) => [s.id, s]));
  const collectorsFor = (item: WasteItem) =>
    companies
      .filter((c) => c.role === "처리업체")
      .map((c) => ({ c, d: distanceM(self, c.location) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => ({ ...x, ok: Boolean(x.c.permits?.includes(item) || (item === "포장재" && x.c.permits?.includes("폐플라스틱"))) }));

  const bundles: BundleGroup[] = [];
  const partners: StreamPartner[] = [];
  for (const d of decisions) {
    const s = byStream.get(d.streamId);
    if (!s) continue;
    const item = s.classify.item;
    if (d.route === "bundle") {
      const { minKg, truckKg } = MIN_KG[item];
      const film = isFilm(s);
      const compatible = (w: Company["wasteStreams"][number]) => isPeerStream(s, w);
      const peers = companies
        .filter((c) => c.id !== anchor?.id && c.role === "배출")
        .map((c) => ({ c, kg: c.wasteStreams.filter(compatible).reduce((a, w) => a + w.monthlyKg, 0), d: distanceM(self, c.location) }))
        .filter((x) => x.kg > 0)
        .sort((a, b) => a.d - b.d);
      const group: BundleGroup["group"] = [{ companyId: anchor?.id ?? "self", name: org.name, kg: s.monthlyKg, distanceM: 0, isSelf: true }];
      let total = s.monthlyKg;
      for (const p of peers) {
        if (total >= minKg && group.length >= 3) break;
        group.push({ companyId: p.c.id, name: p.c.name, kg: p.kg, distanceM: p.d });
        total += p.kg;
      }
      const cols = collectorsFor(film ? "폐플라스틱" : item);
      const licensed = cols.find((x) => x.ok) ?? cols[0];
      const visit = visitRoute(licensed?.c.location ?? self, group, companies, anchor?.id, self);
      bundles.push({
        streamId: s.id,
        mode: "순회 수거",
        item,
        minKg,
        truckKg,
        fillRate: Math.round((total / truckKg) * 100) / 100,
        soloFillRate: Math.round((s.monthlyKg / truckKg) * 100) / 100,
        group,
        totalKg: total,
        collector: { companyId: licensed?.c.id ?? "", name: licensed?.c.name ?? "처리업체 없음", distanceM: licensed?.d ?? 0, permits: licensed?.c.permits ?? [] },
        excluded: cols.filter((x) => !x.ok).map((x) => ({ companyId: x.c.id, name: x.c.name, reason: `${film ? "폐플라스틱(필름)" : item} 허가 품목 없음` })),
        schedule: "매월 둘째·넷째 주 화요일 오전, 사업장별 순회",
        costShare: group.map((g) => ({ companyId: g.companyId, name: g.name, sharePct: Math.round((g.kg / total) * 1000) / 10 })),
        visitOrder: visit.order,
        routeM: visit.routeM,
      });
    } else if (d.route === "sell") {
      // 필름은 법정 분류로 폐합성수지라, 단독 매각이어도 폐플라스틱 허가가 있는 업체에만 보낸다
      const cols = collectorsFor(isFilm(s) ? "폐플라스틱" : item);
      const buyer = cols.find((x) => x.ok) ?? cols[0];
      if (buyer) partners.push({ streamId: s.id, route: "sell", companyId: buyer.c.id, name: buyer.c.name, distanceM: buyer.d, location: "같은 단지", note: `${s.classify.material} 재생원료 매입 · 허가 품목 ${(buyer.c.permits ?? []).join("·")}` });
    } else if (d.route === "pyrolysis") {
      const p = PYROLYSIS_PARTNERS[0];
      partners.push({ streamId: s.id, route: "pyrolysis", companyId: p.id, name: p.name, distanceM: p.distanceM, location: p.location, note: "혼합 플라스틱 열분해유 생산 · 반입비 80원/kg(가정)" });
    }
  }
  return { complexId: session.complexId, selfLocation: self, bundles, partners };
}

// ── 비용·탄소 ─────────────────────────────────────────────────────────

export function buildCostCarbon(session: Session): CostCarbonResult {
  const decisions = session.feasibility?.decisions ?? [];
  const byStream = new Map(session.streams.map((s) => [s.id, s]));
  const carbon = (n: number) => Math.round(n * 100) / 100;

  const optimal = decisions.map((d) => ({ streamId: d.streamId, route: d.route, monthlyKrw: d.monthlyAfter, carbonT: d.carbonAfterT }));
  // 묶음이 없으면 소량 포장재는 업체가 오지 않아 지금처럼 소각한다
  const noBundle = decisions.map((d) => (d.route === "bundle" ? { streamId: d.streamId, route: "incinerate" as StreamRoute, monthlyKrw: d.monthlyNow, carbonT: d.carbonNowT } : { streamId: d.streamId, route: d.route, monthlyKrw: d.monthlyAfter, carbonT: d.carbonAfterT }));
  const now = decisions.map((d) => ({ streamId: d.streamId, route: "incinerate" as StreamRoute, monthlyKrw: d.monthlyNow, carbonT: d.carbonNowT }));
  const landfill = decisions.map((d) => {
    const s = byStream.get(d.streamId)!;
    return { streamId: d.streamId, route: "incinerate" as StreamRoute, monthlyKrw: Math.round(LANDFILL_PER_KG[s.classify.item] * s.monthlyKg), carbonT: carbon((CARBON.landfill * s.monthlyKg) / 1000) };
  });
  // 흐름별 값을 그대로 더한다. 반올림하면 경로 판정의 공장 합계와 어긋난다
  const sum = (rows: Route["breakdown"]) => ({ krw: Math.round(rows.reduce((a, r) => a + r.monthlyKrw, 0)), t: carbon(rows.reduce((a, r) => a + r.carbonT, 0)) });
  const make = (id: Route["id"], name: string, description: string, condition: string, rows: Route["breakdown"], recommended = false): Route => {
    const { krw, t } = sum(rows);
    return { id, name, description, monthlyKrw: krw, carbonT: t, kauKrw: kauOf(t), condition, recommended, breakdown: rows };
  };
  const routes: Route[] = [
    make("A", "흐름별 최적안", decisions.map((d) => `${byStream.get(d.streamId)?.name} ${STREAM_ROUTE_LABEL[d.route]}`).join(" · "), "분리 보관 구역, 분쇄기 사용, 단지 3개사 순회 수거 동의", optimal, true),
    make("B", "묶음 없이 개별 처리", "단지 묶음이 없으면 소량 포장재는 지금처럼 소각", "업체가 소량 포장재를 받지 않음", noBundle),
    make("C", "현행 유지 (전부 혼합 소각)", "모든 흐름을 혼합 사업장폐기물로 위탁", "없음", now),
    make("D", "전부 매립", "매립 가능 지역까지 운송", "매립장 잔여 용량 부족(부산 약 5년 뒤 포화 예상)", landfill),
  ];
  return {
    baseline: "신재 대비",
    routes,
    assumptions: [
      { label: "소각 위탁비", value: "혼합 사업장폐기물 톤당 25만 원(업체 인터뷰 평균, 가정)" },
      { label: "매각 단가", value: "PP 압축품 300원/kg, LDPE 필름 150원/kg(재활용가능자원 가격조사 기준 가정)" },
      { label: "재투입 가치", value: "신재 PP 약 1,300원/kg − 분쇄·관리비 → 900원/kg, 신재 대비 10% 이내 혼합" },
      { label: "열분해 반입비", value: "80원/kg(가정)" },
      { label: "순회 수거", value: "1톤 트럭, 운반비 kg당 50원을 물량 비례로 분담" },
      { label: "탄소", value: "신재 대비 회피: 매각 −1.5, 재투입 −1.6, 열분해 −0.3 / 소각 +0.78, 매립 +0.51 tCO₂e/t" },
      { label: "KAU", value: `2026-11 종가 ${KAU_PER_T.toLocaleString("ko-KR")}원/t(가정)` },
      { label: "인건비", value: `${LABOR_PER_HOUR.toLocaleString("ko-KR")}원/시간` },
    ],
  };
}

// ── 이행안과 서류 ───────────────────────────────────────────────────────

export function buildProposal(session: Session, org: Organization): ProposalResult {
  const routes = session.costCarbon?.routes ?? [];
  const best = routes.find((r) => r.recommended) ?? routes[0];
  const current = routes.find((r) => r.id === "C");
  const f = session.feasibility;
  const m = session.matching;
  const byStream = new Map(session.streams.map((s) => [s.id, s]));
  const complexName = findComplex(session.complexId)?.name ?? "산업단지";
  const diff = best && current ? best.monthlyKrw - current.monthlyKrw : 0;
  const totalKg = session.streams.reduce((a, s) => a + s.monthlyKg, 0);
  const won = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ko-KR")}원`;
  const streamLines = (f?.decisions ?? []).map((d) => {
    const s = byStream.get(d.streamId);
    return `${s?.name}(${s?.monthlyKg}kg/월): ${STREAM_ROUTE_LABEL[d.route]}${d.action ? `, ${d.action.title}` : ""}`;
  });

  const documents: DocumentDraft[] = [
    {
      id: "plan",
      kind: "plan",
      title: "폐플라스틱 순환 이행 계획서",
      to: `${org.name} 내부 결재`,
      external: false,
      fields: [
        { label: "대상", value: `${session.streams.length}개 흐름 · 월 ${totalKg.toLocaleString("ko-KR")}kg` },
        { label: "월 손익", value: `${won(current?.monthlyKrw ?? 0)} → ${won(best?.monthlyKrw ?? 0)} (개선 ${won(diff)})` },
        { label: "탄소", value: `월 ${current?.carbonT ?? 0} → ${best?.carbonT ?? 0} tCO₂e` },
        { label: "흐름별 경로", value: streamLines.join(" / ") },
        { label: "준비", value: "흐름별 분리 보관 구역 4곳 표시, 분쇄기 가동 일정, 포장 필름 전용 마대" },
        { label: "일정", value: "1주차 분리 보관 시작 · 2주차 매입처 견적 · 4주차 첫 순회 수거" },
      ],
      body: `${org.name}은(는) 지금 폐플라스틱 ${session.streams.length}개 흐름을 모두 혼합 사업장폐기물로 소각 위탁하고 있다. 흐름별로 나눠 재투입·매각·단지 묶음 매각·열분해로 보내면 월 ${won(diff)}, 연 ${won(diff * 12)}이 개선된다. 이 계획은 AI 진단 결과이며, 단가는 견적 회신으로 확정한다.`,
    },
    {
      id: "grant",
      kind: "grant",
      title: "지원사업 신청 초안 (스마트생태공장·순환경제 이행지원)",
      to: "기후에너지환경부 · 한국환경공단 (2027년 공고 예정)",
      external: false,
      fields: [
        { label: "신청 기업", value: `${org.name} · ${org.industry}` },
        { label: "소재지", value: complexName },
        { label: "현황", value: `폐플라스틱 월 ${totalKg.toLocaleString("ko-KR")}kg 전량 혼합 소각` },
        { label: "개선 내용", value: "흐름별 분리 보관, 사출 스프루 분쇄 재투입 설비, 단지 순회 수거 참여, 혼합 퍼지 열분해 위탁" },
        { label: "기대 효과", value: `처리비·원료비 연 ${won(diff * 12)} 개선, 탄소 연 ${Math.round(((current?.carbonT ?? 0) - (best?.carbonT ?? 0)) * 12 * 10) / 10} tCO₂e 감축` },
        { label: "소요 설비(예시)", value: "분쇄기 1대, 분리 보관 랙, 계량 저울" },
      ],
      body: "정부 사업장 폐플라스틱 기술진단(2026년 10곳)과 같은 항목(공정별 발생량, 종류·성상, 주변 재활용시설, 이행 방안)으로 작성한 신청 초안이다. 공고가 나오면 양식에 맞춰 옮긴다. 지원 금액과 자격 요건은 공고문으로 확인해야 한다.",
    },
  ];
  for (const b of m?.bundles ?? []) {
    const s = byStream.get(b.streamId);
    documents.push({
      id: `pickup:${b.streamId}`,
      kind: "pickup",
      title: "순회 수거 요청서",
      to: b.collector.name,
      external: true,
      streamId: b.streamId,
      fields: [
        { label: "품목", value: `${s?.classify.detail} (사용 후 포장재)` },
        { label: "참여 사업장", value: `${complexName} ${b.group.length}곳 (사업장별 물량은 계약 시 공개)` },
        { label: "월 합계", value: `${b.totalKg.toLocaleString("ko-KR")}kg · 1톤 트럭 적재율 ${Math.round(b.fillRate * 100)}%` },
        { label: "수거 방식", value: "순회 수거 · 각 사업장 개별 계약 · 사업장별 계량과 전자인계서" },
        { label: "수거 주기", value: b.schedule },
        {
          label: "순회 순서(제안)",
          value: `${b.collector.name} 출발 → ${(b.visitOrder ?? b.group.map((g) => g.companyId)).map((id, i) => `${i + 1}. ${b.group.find((g) => g.companyId === id)?.name ?? id}`).join(" → ")} → 복귀${b.routeM ? ` · 약 ${(b.routeM / 1000).toFixed(1)}km` : ""}`,
        },
        { label: "희망 단가", value: "LDPE 필름 kg당 150원 이상(운반비 별도 분담)" },
      ],
      body: `${b.collector.name} 담당자님께. ${complexName} 내 ${b.group.length}개 사업장이 원자재 포장 필름을 사업장별로 분리 보관하고 있습니다. 매월 정해진 날 한 번에 순회해 주실 수 있는지, 매입 단가와 사업장별 계량·인계 방식을 회신해 주시기 바랍니다.`,
    });
  }
  for (const p of m?.partners.filter((x) => x.route === "sell") ?? []) {
    const s = byStream.get(p.streamId);
    documents.push({
      id: `quote:${p.streamId}`,
      kind: "quote",
      title: "매각 견적 요청서",
      to: p.name,
      external: true,
      streamId: p.streamId,
      fields: [
        { label: "품목", value: `${s?.classify.detail} (${s?.classify.material} 단일, 공정 부산물)` },
        { label: "월 물량", value: `${s?.monthlyKg.toLocaleString("ko-KR")}kg` },
        { label: "상태", value: "이물(라벨·인서트) 제거 후 마대 포장" },
        { label: "첨부", value: "AI 식별 결과, 사진" },
      ],
      body: `${p.name} 담당자님께. ${s?.classify.detail}을(를) 매월 ${s?.monthlyKg}kg 내놓으려 합니다. 이물 제거 후 상태 기준 매입 단가와 수거 주기를 회신해 주시기 바랍니다.`,
    });
  }
  for (const p of m?.partners.filter((x) => x.route === "pyrolysis") ?? []) {
    const s = byStream.get(p.streamId);
    documents.push({
      id: `pyro:${p.streamId}`,
      kind: "quote",
      title: "열분해 위탁 요청서",
      to: p.name,
      external: true,
      streamId: p.streamId,
      fields: [
        { label: "품목", value: `${s?.classify.detail} (${s?.classify.material} 혼합, 공정 부산물)` },
        { label: "월 물량", value: `${s?.monthlyKg.toLocaleString("ko-KR")}kg` },
        { label: "상태", value: "PVC 등 염소계 혼입 없음 확인 후 마대 포장" },
        { label: "희망 조건", value: "반입비 kg당 80원 이하, 운반 포함 여부 회신" },
        { label: "첨부", value: "AI 식별 결과, 사진" },
      ],
      body: `${p.name} 담당자님께. ${s?.classify.detail}을(를) 매월 ${s?.monthlyKg}kg 열분해로 위탁하려 합니다. 반입 기준(재질·이물·염소 함량)과 kg당 반입비, 수거 주기를 회신해 주시기 바랍니다.`,
    });
  }
  if (m?.bundles.length) {
    const b = m.bundles[0];
    documents.push({
      id: "joint",
      kind: "joint",
      title: "공동처리 신고서 초안 (선택)",
      to: "부산 강서구청 환경과",
      external: false,
      optional: true,
      streamId: b.streamId,
      fields: [
        { label: "근거", value: "「폐기물관리법」 제18조제5항, 시행규칙 제21조제1항제9호(소량 배출 사업장)" },
        { label: "참여 사업장", value: b.group.map((g) => g.name).join(", ") },
        { label: "대표자", value: `${org.name} (입주기업협의회 위임 가능)` },
        { label: "비용 분담", value: b.costShare.map((c) => `${c.name} ${c.sharePct}%`).join(", ") },
      ],
      body: "기본은 각사 개별 계약의 순회 수거라 이 신고는 필요 없다. 대표자가 신고·인계를 대행하길 원할 때만, 구청의 소량 배출 사업장 인정을 받아 제출한다. 공동 보관은 금지된다.",
    });
  }
  return {
    recommended: best?.id ?? "A",
    alternatives: routes.filter((r) => r.id !== best?.id && r.id !== "D").map((r) => r.id),
    summary: `흐름별 최적안을 추천합니다. 지금처럼 전부 소각할 때보다 월 ${won(diff)}, 연 ${won(diff * 12)}이 개선되고, 탄소는 월 ${Math.round(((current?.carbonT ?? 0) - (best?.carbonT ?? 0)) * 100) / 100}t 줄어듭니다.`,
    documents,
  };
}

/** 흐름 경로를 담당자가 직접 바꾼 기록을 feasibility에서 읽는다 */
export function routeOverrides(session: Session): Record<string, StreamRoute> {
  const o: Record<string, StreamRoute> = {};
  for (const d of session.feasibility?.decisions ?? []) if (d.aiRoute) o[d.streamId] = d.route;
  return o;
}
