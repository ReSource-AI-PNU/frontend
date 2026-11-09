import "server-only";
import { findComplex } from "@/lib/complexes";
import type { Company, Organization, WasteItem } from "@/lib/domain";
import type {
  ClassifyResult,
  CostCarbonResult,
  Detection,
  FeasibilityResult,
  KnowledgeCard,
  MatchingResult,
  ProposalResult,
  Question,
  Reason,
  RegulationResult,
  Route,
  Session,
  Verdict,
} from "@/lib/session/types";

/**
 * 모의 에이전트. 품목별 설정표로 6단계 결과를 결정적으로 만든다.
 * 폐플라스틱 월 800kg 기준 값은 설계안·목업 v2의 시연 시나리오와 같다. 숫자는 모두 가정값이다.
 */
type ItemProfile = {
  detail: string;
  verdict: Verdict;
  mainBox: [number, number, number, number];
  contaminants: { label: string; ratio: number; box: [number, number, number, number] }[];
  threshold: number;
  thresholdLabel: string;
  currentPerKg: number;
  ladder: { label: string; perKg: number }[];
  afterPerKg: number;
  actionTitle: string;
  laborHours: number;
  priceSource: string;
  note: string;
  disposalPerKg: number;
  landfillPerKg: number;
  visitFee: number;
  avoidedTPerT: number;
  incinerationTPerT: number;
  landfillTPerT: number;
  wasteCode: string;
  designatedCircular: boolean;
};

export const ITEM_PROFILES: Record<WasteItem, ItemProfile> = {
  폐플라스틱: {
    detail: "PP 압축품",
    verdict: "recycle",
    mainBox: [0.05, 0.22, 0.9, 0.64],
    contaminants: [
      { label: "테이프", ratio: 0.12, box: [0.4, 0.54, 0.2, 0.15] },
      { label: "금속", ratio: 0.03, box: [0.79, 0.6, 0.1, 0.1] },
    ],
    threshold: 0.1,
    thresholdLabel: "업체 매입 기준 이물질 10%",
    currentPerKg: -250,
    ladder: [
      { label: "현재", perKg: -250 },
      { label: "테이프 제거", perKg: 60 },
      { label: "테이프·라벨 제거", perKg: 300 },
    ],
    afterPerKg: 300,
    actionTitle: "테이프와 라벨을 제거하세요",
    laborHours: 3,
    priceSource: "가격조사 2026-10 · 부산권역 PP 압축품 300원/kg",
    note: "금속 혼입 3%는 수거 업체가 현장에서 선별할 수 있는 수준입니다. 5%를 넘으면 매입 거절 기준에 걸립니다.",
    disposalPerKg: 250,
    landfillPerKg: 230,
    visitFee: 143000,
    avoidedTPerT: 1.5,
    incinerationTPerT: 0.78,
    landfillTPerT: 0.51,
    wasteCode: "51-03 폐합성수지",
    designatedCircular: false,
  },
  "금속 스크랩": {
    detail: "철 가공 칩",
    verdict: "recycle",
    mainBox: [0.08, 0.25, 0.84, 0.6],
    contaminants: [
      { label: "절삭유", ratio: 0.08, box: [0.3, 0.5, 0.24, 0.18] },
      { label: "플라스틱", ratio: 0.04, box: [0.66, 0.38, 0.14, 0.12] },
    ],
    threshold: 0.05,
    thresholdLabel: "제강사 납품 기준 이물질 5%",
    currentPerKg: 120,
    ladder: [
      { label: "현재", perKg: 120 },
      { label: "탈유", perKg: 210 },
      { label: "탈유·선별", perKg: 260 },
    ],
    afterPerKg: 260,
    actionTitle: "절삭유를 빼고 플라스틱을 골라내세요",
    laborHours: 4,
    priceSource: "가격조사 2026-10 · 부산권역 철 스크랩(중량) 260원/kg",
    note: "절삭유가 남아 있으면 지정폐기물(폐유)로 분류될 수 있습니다.",
    disposalPerKg: 0,
    landfillPerKg: 180,
    visitFee: 90000,
    avoidedTPerT: 1.4,
    incinerationTPerT: 0.05,
    landfillTPerT: 0.02,
    wasteCode: "51-02 폐금속류",
    designatedCircular: true,
  },
  폐목재: {
    detail: "목재 팔레트",
    verdict: "reuse",
    mainBox: [0.1, 0.2, 0.8, 0.66],
    contaminants: [
      { label: "못·철물", ratio: 0.06, box: [0.22, 0.4, 0.16, 0.14] },
      { label: "도장면", ratio: 0.1, box: [0.58, 0.52, 0.22, 0.2] },
    ],
    threshold: 0.1,
    thresholdLabel: "재사용 팔레트 매입 기준 파손 10%",
    currentPerKg: -80,
    ladder: [
      { label: "현재", perKg: -80 },
      { label: "파손품 분리", perKg: 10 },
      { label: "규격별 분류", perKg: 40 },
    ],
    afterPerKg: 40,
    actionTitle: "파손된 팔레트를 따로 쌓으세요",
    laborHours: 2,
    priceSource: "업체 인터뷰 평균 · 규격 팔레트 재사용 40원/kg",
    note: "도장되거나 방부 처리된 목재는 연료용 재활용이 제한됩니다.",
    disposalPerKg: 80,
    landfillPerKg: 120,
    visitFee: 70000,
    avoidedTPerT: 0.9,
    incinerationTPerT: 0.1,
    landfillTPerT: 0.6,
    wasteCode: "51-11 폐목재",
    designatedCircular: true,
  },
  포장재: {
    detail: "골판지 압축",
    verdict: "recycle",
    mainBox: [0.06, 0.24, 0.88, 0.62],
    contaminants: [
      { label: "비닐 랩", ratio: 0.09, box: [0.36, 0.46, 0.22, 0.2] },
      { label: "테이프", ratio: 0.05, box: [0.7, 0.58, 0.12, 0.1] },
    ],
    threshold: 0.05,
    thresholdLabel: "제지사 납품 기준 이물질 5%",
    currentPerKg: -40,
    ladder: [
      { label: "현재", perKg: -40 },
      { label: "비닐 제거", perKg: 50 },
      { label: "비닐·테이프 제거", perKg: 90 },
    ],
    afterPerKg: 90,
    actionTitle: "비닐 랩을 벗기고 골판지만 압축하세요",
    laborHours: 2,
    priceSource: "가격조사 2026-10 · 부산권역 골판지 90원/kg",
    note: "젖은 골판지는 무게 기준 단가가 30% 이상 깎입니다. 지붕 아래 보관을 권장합니다.",
    disposalPerKg: 40,
    landfillPerKg: 60,
    visitFee: 60000,
    avoidedTPerT: 0.8,
    incinerationTPerT: 0.4,
    landfillTPerT: 0.7,
    wasteCode: "51-01 폐지",
    designatedCircular: true,
  },
};

const LABOR_PER_HOUR = 15000;
const KAU_PER_T = 9000;
const MIN_PICKUP_KG = 2000;

export function primaryItem(org: Organization): WasteItem {
  return org.wasteStreams[0]?.item ?? "폐플라스틱";
}

export function monthlyKgOf(session: Session) {
  const answer = session.questions.find((q) => q.id === "volume")?.answer;
  const n = answer ? Number(answer) : NaN;
  return Number.isFinite(n) && n > 0 ? n : session.classify.estimatedKg;
}

export function buildClassify(org: Organization): { classify: ClassifyResult; questions: Question[] } {
  const item = primaryItem(org);
  const p = ITEM_PROFILES[item];
  const declared = org.wasteStreams.find((w) => w.item === item);
  const estimatedKg = Math.round(((declared?.monthlyKg ?? 800) * 0.975) / 10) * 10;
  const detections: Detection[] = [
    { id: "det_main", label: p.detail, kind: "item", confidence: 0.94, box: p.mainBox, source: "ai" },
    ...p.contaminants.map((c, i) => ({
      id: `det_c${i + 1}`,
      label: c.label,
      kind: "contaminant" as const,
      confidence: 0.81 - i * 0.07,
      box: c.box,
      ratio: c.ratio,
      source: "ai" as const,
    })),
  ];
  return {
    classify: {
      item,
      detail: p.detail,
      confidence: 0.94,
      estimatedKg,
      frames: 24,
      detections,
      model: { name: "rtdetr-waste", version: "v3.2" },
      durationMs: 4200,
    },
    questions: [
      {
        id: "volume",
        step: "classify",
        text: "한 달에 이만큼 나오나요?",
        why: "사진으로는 부피만 알 수 있습니다. 묶음 수거 물량과 손익 계산에 씁니다.",
        kind: "number",
        unit: "kg/월",
        suggested: String(declared?.monthlyKg ?? estimatedKg),
      },
      {
        id: "storage",
        step: "classify",
        text: "어디에 얼마나 보관하나요?",
        why: "비와 햇빛에 노출되면 수분과 변색으로 등급이 떨어집니다.",
        kind: "choice",
        options: ["실내", "야외·지붕, 2주 이내", "야외·노출, 2주 이상"],
        suggested: declared?.storage === "실내" ? "실내" : "야외·지붕, 2주 이내",
      },
      {
        id: "analysis",
        step: "regulation",
        text: "이물질 성분분석표가 있나요?",
        why: "순환자원 인정 신청에 유해물질 기준 충족 증빙이 필요합니다.",
        kind: "choice",
        options: ["있음", "없음"],
      },
    ],
  };
}

function contaminationRatio(session: Session) {
  return session.classify.detections
    .filter((d) => d.kind === "contaminant" && !d.removed)
    .reduce((s, d) => s + (d.ratio ?? 0), 0);
}

export function buildFeasibility(session: Session, cards: KnowledgeCard[]): FeasibilityResult {
  const p = ITEM_PROFILES[session.classify.item];
  const kg = monthlyKgOf(session);
  const laborCost = p.laborHours * LABOR_PER_HOUR;
  const benefit = Math.round((p.afterPerKg - p.currentPerKg) * kg);
  const ratio = contaminationRatio(session);
  const main = session.classify.detections.find((d) => d.kind === "contaminant" && !d.removed);
  const storage = session.questions.find((q) => q.id === "storage")?.answer ?? "";
  const reasons: Reason[] = [
    { text: `${p.priceSource.split(" · ")[1] ?? p.priceSource}`, source: p.priceSource.split(" · ")[0] },
    {
      text: `이물질 ${Math.round(ratio * 100)}%는 ${p.thresholdLabel}을 ${ratio > p.threshold ? "넘습니다" : "충족합니다"}.${main ? ` ${main.label}을 제거하면 기준을 충족합니다.` : ""}`,
      source: "식별 결과 · 규칙 엔진",
    },
  ];
  if (storage.includes("노출")) reasons.push({ text: "야외 노출 보관은 수분·오염 가중 요인입니다. 지붕 아래 보관을 권장합니다.", source: "규칙 엔진" });
  for (const card of cards.filter((c) => c.item === session.classify.item && c.status === "adopted").slice(0, 2)) {
    reasons.push({ text: `${card.condition} → ${card.judgment}`, source: `${card.orgName} · 동의 ${card.agrees.length}명`, knowledgeCardId: card.id });
  }
  return {
    verdict: p.verdict,
    currentPerKg: p.currentPerKg,
    afterPerKg: p.afterPerKg,
    ladder: p.ladder,
    action: { title: p.actionTitle, laborHours: p.laborHours, laborCost, benefit, net: benefit - laborCost },
    note: p.note,
    reasons,
  };
}

export function buildRegulation(session: Session): RegulationResult {
  const p = ITEM_PROFILES[session.classify.item];
  const analysis = session.questions.find((q) => q.id === "analysis")?.answer;
  const hasAnalysis = analysis === "있음";
  return {
    items: [
      {
        id: "designated",
        label: "순환자원 지정 품목",
        status: p.designatedCircular ? "ok" : "no",
        result: p.designatedCircular ? "해당" : "해당 없음",
        citation: "「순환경제사회 전환 촉진법」 순환자원 지정 고시",
        excerpt: `${session.classify.detail}은(는) 고시 별표의 지정 품목 목록에 ${p.designatedCircular ? "포함됩니다" : "포함되지 않습니다"}.`,
      },
      {
        id: "recognition",
        label: "순환자원 인정 신청",
        status: hasAnalysis ? "ok" : "ask",
        result: hasAnalysis ? "신청 가능" : "분석 후 가능",
        citation: "「순환경제사회 전환 촉진법」 순환자원 인정 요건",
        excerpt: "유해물질 기준, 경제성, 방치 우려가 없을 것 등 인정 요건을 모두 충족해야 합니다.",
      },
      {
        id: "joint",
        label: "공동처리",
        status: "ok",
        result: "가능",
        citation: "「폐기물관리법」 사업장폐기물 공동 처리",
        excerpt: "둘 이상의 사업장폐기물배출자는 공동으로 폐기물을 처리할 수 있으며, 공동 운영기구 대표자가 신고합니다.",
      },
      {
        id: "hazard",
        label: "유해물질 기준",
        status: analysis === undefined ? "ask" : hasAnalysis ? "ok" : "ask",
        result: analysis === undefined ? "정보 부족" : hasAnalysis ? "충족(분석표)" : "분석표 필요",
        citation: "「폐기물관리법 시행규칙」 폐기물 분석 기준",
        excerpt: "성분분석표가 없으면 유해물질 함량 기준 충족 여부를 판단할 수 없습니다.",
      },
    ],
    conclusion: hasAnalysis
      ? { tone: "gain", text: "순환자원 인정 신청이 가능합니다. 인정을 받으면 폐기물 규제에서 벗어납니다." }
      : { tone: "warn", text: "지금은 폐기물로 처리합니다. 인정 신청은 성분 분석 후 가능합니다." },
  };
}

function distanceM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function buildMatching(session: Session, org: Organization, companies: Company[]): MatchingResult {
  const item = session.classify.item;
  const kg = monthlyKgOf(session);
  // 내 회사의 위치: 시연 시나리오 기업이 있으면 그 건물, 없으면 같은 품목을 내놓는 첫 기업 건물을 쓴다.
  const anchor =
    companies.find((c) => c.name.includes("한빛정밀")) ??
    companies.find((c) => c.role === "배출" && c.wasteStreams.some((w) => w.item === item)) ??
    companies[0];
  const self: [number, number] = anchor?.location ?? [0, 0];
  const peers = companies
    .filter((c) => c.id !== anchor?.id && c.role === "배출")
    .map((c) => ({ c, kg: c.wasteStreams.filter((w) => w.item === item).reduce((s, w) => s + w.monthlyKg, 0), d: distanceM(self, c.location) }))
    .filter((x) => x.kg > 0)
    .sort((a, b) => a.d - b.d);

  const group: MatchingResult["group"] = [{ companyId: anchor?.id ?? "self", name: org.name, kg, distanceM: 0, isSelf: true }];
  let total = kg;
  for (const p of peers) {
    if (total >= MIN_PICKUP_KG && group.length >= 3) break;
    group.push({ companyId: p.c.id, name: p.c.name, kg: p.kg, distanceM: p.d });
    total += p.kg;
  }

  const collectors = companies
    .filter((c) => c.role === "처리업체")
    .map((c) => ({ c, d: distanceM(self, c.location) }))
    .sort((a, b) => a.d - b.d);
  const licensed = collectors.find((x) => x.c.permits?.includes(item)) ?? collectors[0];
  const excluded = collectors
    .filter((x) => !x.c.permits?.includes(item))
    .map((x) => ({ companyId: x.c.id, name: x.c.name, reason: `${item} 허가 품목 없음` }));

  return {
    complexId: session.complexId,
    selfLocation: self,
    minKg: MIN_PICKUP_KG,
    soloFeasible: kg >= MIN_PICKUP_KG,
    group,
    totalKg: total,
    collector: {
      companyId: licensed?.c.id ?? "",
      name: licensed?.c.name ?? "처리업체 없음",
      distanceM: licensed?.d ?? 0,
      permits: licensed?.c.permits ?? [],
    },
    excluded,
    schedule: "매월 둘째·넷째 주 화요일 오전",
    costShare: group.map((g) => ({ companyId: g.companyId, name: g.name, sharePct: Math.round((g.kg / total) * 1000) / 10 })),
  };
}

export function buildCostCarbon(session: Session): CostCarbonResult {
  const p = ITEM_PROFILES[session.classify.item];
  const kg = monthlyKgOf(session);
  const t = kg / 1000;
  const laborCost = p.laborHours * LABOR_PER_HOUR;
  const grouped = session.matching ? !session.matching.soloFeasible && session.matching.totalKg >= session.matching.minKg : true;
  const round = (n: number, step = 1000) => Math.round(n / step) * step;
  const carbon = (n: number) => Math.round(n * 100) / 100;
  const routes: Route[] = [
    {
      id: "A",
      name: "묶음 재활용",
      description: `${p.actionTitle.replace("하세요", "")} → ${session.matching?.group.length ?? 3}개사 묶음 → ${session.matching?.collector.name ?? "처리업체"} 매각`,
      monthlyKrw: round(p.afterPerKg * kg - laborCost),
      carbonT: carbon(-p.avoidedTPerT * t),
      kauKrw: 0,
      condition: grouped ? "참여 기업 동의, 제거 작업 월 " + p.laborHours + "시간" : "묶음 없이도 가능",
      recommended: true,
    },
    {
      id: "B",
      name: "단독 재활용",
      description: "제거 후 처리업체 단독 방문 요청",
      monthlyKrw: round(p.afterPerKg * kg - laborCost - p.visitFee),
      carbonT: carbon(-p.avoidedTPerT * t * 0.875),
      kauKrw: 0,
      condition: "최소 물량 미달 · 방문 수수료 · 대기 3주 이상",
    },
    {
      id: "C",
      name: "현행 유지 (혼합 소각)",
      description: "지금처럼 혼합 폐기물로 위탁",
      monthlyKrw: round(-p.disposalPerKg * kg + (p.currentPerKg > 0 ? p.currentPerKg * kg : 0)),
      carbonT: carbon(p.incinerationTPerT * t),
      kauKrw: 0,
      condition: "없음",
    },
    {
      id: "D",
      name: "매립",
      description: "매립 가능 지역까지 운송",
      monthlyKrw: round(-p.landfillPerKg * kg),
      carbonT: carbon(p.landfillTPerT * t),
      kauKrw: 0,
      condition: "매립 가능 지역까지 운송 필요",
    },
  ].map((r) => ({ ...r, id: r.id as Route["id"], kauKrw: Math.round((-r.carbonT * KAU_PER_T) / 10) * 10 }));

  return {
    baseline: "신재 대비",
    routes,
    assumptions: [
      { label: "매각 단가", value: p.priceSource },
      { label: "처리비", value: `혼합 사업장폐기물 ${(p.disposalPerKg * 1000).toLocaleString("ko-KR")}원/t (업체 인터뷰 평균)` },
      { label: "운송", value: `도로 거리 기준, 5톤 차량, 물량 비례 분담` },
      { label: "탄소", value: `신재 대비 회피 ${p.avoidedTPerT} tCO₂e/t, 소각 ${p.incinerationTPerT}, 매립 ${p.landfillTPerT}` },
      { label: "KAU", value: `2026-11 종가 ${KAU_PER_T.toLocaleString("ko-KR")}원/t (가정)` },
      { label: "인건비", value: `${LABOR_PER_HOUR.toLocaleString("ko-KR")}원/시간` },
    ],
  };
}

export function buildProposal(session: Session, org: Organization): ProposalResult {
  const routes = session.costCarbon?.routes ?? [];
  const best = [...routes].sort((a, b) => b.monthlyKrw - a.monthlyKrw)[0];
  const current = routes.find((r) => r.id === "C");
  const m = session.matching;
  const kg = monthlyKgOf(session);
  const p = ITEM_PROFILES[session.classify.item];
  const diff = best && current ? best.monthlyKrw - current.monthlyKrw : 0;
  const members = m?.group.map((g) => `${g.name} ${g.kg.toLocaleString("ko-KR")}kg`).join(", ") ?? org.name;
  return {
    recommended: best?.id ?? "A",
    alternatives: routes.filter((r) => r.id !== best?.id && r.id !== "D").map((r) => r.id),
    summary: `${best?.name ?? "묶음 재활용"}을 추천합니다. 현행 대비 월 ${diff.toLocaleString("ko-KR")}원, 연 ${(diff * 12).toLocaleString("ko-KR")}원이 개선되고 탄소는 월 ${Math.abs(best?.carbonT ?? 0)}t 줄어듭니다.`,
    documents: [
      {
        id: "quote",
        kind: "quote",
        title: "견적 요청서",
        to: m?.collector.name ?? "처리업체",
        fields: [
          { label: "요청 기업", value: org.name },
          { label: "품목", value: `${session.classify.item} · ${session.classify.detail}` },
          { label: "월 물량", value: `${(m?.totalKg ?? kg).toLocaleString("ko-KR")}kg (묶음 ${m?.group.length ?? 1}개사)` },
          { label: "수거 주기", value: m?.schedule ?? "협의" },
          { label: "희망 단가", value: `${p.afterPerKg.toLocaleString("ko-KR")}원/kg 이상` },
          { label: "첨부", value: "AI 판정 결과, 이물질 제거 계획" },
        ],
        body: `${m?.collector.name ?? "귀사"} 담당자님께. ${findComplex(session.complexId)?.name ?? "산업단지"} 내 ${m?.group.length ?? 1}개 사업장이 ${session.classify.detail}을(를) 묶어 매월 ${(m?.totalKg ?? kg).toLocaleString("ko-KR")}kg 배출하려 합니다. 이물질 제거 후 상태 기준으로 매입 단가와 수거 가능 일정을 회신해 주시기 바랍니다.`,
      },
      {
        id: "joint",
        kind: "joint",
        title: "공동처리 신고서 초안",
        to: "관할 구청 환경과",
        fields: [
          { label: "참여 사업장", value: members },
          { label: "대표자", value: org.name },
          { label: "폐기물 종류", value: p.wasteCode },
          { label: "처리 방법", value: "재활용 (위탁)" },
          { label: "비용 분담", value: m?.costShare.map((c) => `${c.name} ${c.sharePct}%`).join(", ") ?? "-" },
        ],
        body: "「폐기물관리법」에 따른 사업장폐기물 공동 처리 신고서의 초안입니다. 제출 전 참여 사업장 동의서를 첨부해야 합니다.",
      },
      {
        id: "handover",
        kind: "handover",
        title: "인계서 초안",
        to: "올바로시스템 전자인계",
        fields: [
          { label: "배출자", value: org.name },
          { label: "운반자", value: m?.collector.name ?? "-" },
          { label: "처리자", value: m?.collector.name ?? "-" },
          { label: "폐기물 종류", value: p.wasteCode },
          { label: "수량", value: `${kg.toLocaleString("ko-KR")}kg` },
        ],
        body: "올바로시스템 전자인계서 입력 항목의 초안입니다. 실제 인계는 수거 당일 운반자가 확인합니다.",
      },
    ],
  };
}
