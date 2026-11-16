/**
 * 예시 데이터. 백엔드에 연결하지 못했을 때만 쓰고, 화면에는 "예시 데이터" 띠를 함께 보여 준다.
 * 회사, 단가, 물량은 모두 가상이다. 실제 에이전트 대화나 계산 결과가 아니다.
 */
import type {
  Claim,
  DiagnosisView,
  Evidence,
  Org,
  OrgRole,
  StreamRecord,
  ThreadMessage,
  VendorProfile,
} from "./types";

const HANBIT = "org_hanbit";
const SAEGIL = "org_saegil";
const NAMHAE = "org_namhae";
const MISO = "org_miso";

export const FIXTURE_ORGS: Org[] = [
  { id: HANBIT, name: "(주)한빛정밀", role: "emitter", region: "부산 강서구 녹산산단" },
  { id: SAEGIL, name: "(주)새길자원", role: "vendor", region: "부산 강서구" },
  { id: NAMHAE, name: "(주)남해열분해", role: "vendor", region: "경남 김해시" },
  { id: MISO, name: "(주)미소환경", role: "vendor", region: "부산 사상구" },
  { id: "org_admin", name: "운영 관리자", role: "admin" },
];

function ev(
  id: string,
  label: string,
  value: number | string | null,
  unit: string | null,
  excerpt: string,
  source: string,
  meta: Record<string, unknown> = {},
): Evidence {
  const kind = id.split(":")[0] as Evidence["kind"];
  const kindLabel = {
    law: "법령",
    ref: "기준값",
    doc: "문서",
    measure: "측정값",
    model: "모델 판정",
    human: "사람 확인",
    calc: "계산",
    assumption: "가정값",
  }[kind];
  return {
    id,
    kind,
    kindLabel,
    label,
    value,
    unit,
    excerpt,
    source,
    asOf: "2026-11-16",
    validUntil: null,
    access: ["*"],
    version: 1,
    meta,
  };
}

const E = {
  incinerate: "assumption:현행처리-혼합소각@v1",
  sprueKg: "measure:org_hanbit:st_sprue:월발생량@2026-11-10",
  defectKg: "measure:org_hanbit:st_defect:월발생량@2026-11-10",
  purgeKg: "human:org_hanbit:st_purge-월발생량",
  filmKg: "measure:org_hanbit:st_film:월발생량@2026-11-10",
  sprueCont: "measure:org_hanbit:st_sprue:오염도@2026-11-10",
  ppA: "doc:org_saegil:매입기준표:PP-A-단가",
  ppB: "doc:org_saegil:매입기준표:PP-B-단가",
  ppACont: "doc:org_saegil:매입기준표:PP-A-오염도상한",
  pyro: "doc:org_namhae:매입기준표:혼합플라스틱-처리비",
  misoPermit: "doc:org_miso:허가증:허가품목",
  sprueNow: "calc:cost_carbon:a1f0c2d3e4b5:st_sprue-현행월손익",
  sprueAfter: "calc:cost_carbon:a1f0c2d3e4b5:st_sprue-월손익",
  sprueDiff: "calc:cost_carbon:a1f0c2d3e4b5:st_sprue-차이",
  defectNow: "calc:cost_carbon:b2e1d3c4f5a6:st_defect-현행월손익",
  defectAfter: "calc:cost_carbon:b2e1d3c4f5a6:st_defect-월손익",
  defectDiff: "calc:cost_carbon:b2e1d3c4f5a6:st_defect-차이",
  purgeNow: "calc:cost_carbon:c3d2e4f5a6b7:st_purge-현행월손익",
  purgeAfter: "calc:cost_carbon:c3d2e4f5a6b7:st_purge-월손익",
  purgeDiff: "calc:cost_carbon:c3d2e4f5a6b7:st_purge-차이",
  filmNow: "calc:cost_carbon:d4e3f5a6b7c8:st_film-현행월손익",
  totalNow: "calc:optimize_assignment:e5f4a6b7c8d9:현행합계",
  totalAfter: "calc:optimize_assignment:e5f4a6b7c8d9:배정합계",
  totalDiff: "calc:optimize_assignment:e5f4a6b7c8d9:차이합계",
} as const;

const calc = (formula: string, inputEvidence: string[]) => ({
  tool: "예시",
  formula,
  inputEvidence,
});

export const FIXTURE_EVIDENCE: Record<string, Evidence> = Object.fromEntries(
  [
    ev(
      E.incinerate,
      "현행 처리 단가 (혼합 소각)",
      250,
      "원/kg",
      "현행 처리 방법과 단가를 입력받지 못해 혼합 소각 250원/kg으로 가정했다.",
      "팀 가정값 v1 (예시)",
    ),
    ev(E.sprueKg, "스프루·런너 월 발생량", 600, "kg/월", "월 발생량 600kg", "측정값 CSV (예시)"),
    ev(E.defectKg, "사출 불량품 월 발생량", 400, "kg/월", "월 발생량 400kg", "측정값 CSV (예시)"),
    ev(E.purgeKg, "퍼지 덩어리 월 발생량", 250, "kg/월", "담당자 추정 250kg", "담당자 답변 (예시)"),
    ev(E.filmKg, "포장 필름 월 발생량", 300, "kg/월", "월 발생량 300kg", "측정값 CSV (예시)"),
    ev(E.sprueCont, "스프루·런너 오염도", 1, "%", "오염도 1.0%", "측정값 CSV (예시)"),
    ev(
      E.ppA,
      "PP A등급 분쇄 매입 단가",
      320,
      "원/kg",
      "PP A등급(분쇄, 오염도 2% 이하, 수분 1% 이하) 320원/kg, 월 500kg 이상",
      "(주)새길자원 매입 기준표 (예시)",
    ),
    ev(
      E.ppB,
      "PP B등급 매입 단가",
      180,
      "원/kg",
      "PP B등급(이물 분리 후) 180원/kg",
      "(주)새길자원 매입 기준표 (예시)",
    ),
    ev(E.ppACont, "PP A등급 오염도 상한", 2, "%", "오염도 2% 이하", "(주)새길자원 매입 기준표 (예시)"),
    ev(
      E.pyro,
      "혼합 플라스틱 열분해 처리비",
      -80,
      "원/kg",
      "혼합 플라스틱 처리비 80원/kg",
      "(주)남해열분해 매입 기준표 (예시)",
    ),
    ev(
      E.misoPermit,
      "(주)미소환경 허가 품목",
      null,
      null,
      "허가 품목: 폐합성수지(경질), 폐목재",
      "(주)미소환경 허가증 (예시)",
    ),
    ev(E.sprueNow, "스프루·런너 현행 월 손익", -150000, "원/월", "600 × −250", "예시 계산", calc("월 발생량 × 현행 단가", [E.sprueKg, E.incinerate])),
    ev(E.sprueAfter, "스프루·런너 배정 후 월 손익", 192000, "원/월", "600 × 320", "예시 계산", calc("월 발생량 × 매입 단가", [E.sprueKg, E.ppA])),
    ev(E.sprueDiff, "스프루·런너 현행 대비", 342000, "원/월", "192,000 − (−150,000)", "예시 계산", calc("배정 후 − 현행", [E.sprueAfter, E.sprueNow])),
    ev(E.defectNow, "사출 불량품 현행 월 손익", -100000, "원/월", "400 × −250", "예시 계산", calc("월 발생량 × 현행 단가", [E.defectKg, E.incinerate])),
    ev(E.defectAfter, "사출 불량품 배정 후 월 손익", 72000, "원/월", "400 × 180", "예시 계산", calc("월 발생량 × 매입 단가", [E.defectKg, E.ppB])),
    ev(E.defectDiff, "사출 불량품 현행 대비", 172000, "원/월", "72,000 − (−100,000)", "예시 계산", calc("배정 후 − 현행", [E.defectAfter, E.defectNow])),
    ev(E.purgeNow, "퍼지 덩어리 현행 월 손익", -62500, "원/월", "250 × −250", "예시 계산", calc("월 발생량 × 현행 단가", [E.purgeKg, E.incinerate])),
    ev(E.purgeAfter, "퍼지 덩어리 배정 후 월 손익", -20000, "원/월", "250 × −80", "예시 계산", calc("월 발생량 × 처리비", [E.purgeKg, E.pyro])),
    ev(E.purgeDiff, "퍼지 덩어리 현행 대비", 42500, "원/월", "−20,000 − (−62,500)", "예시 계산", calc("배정 후 − 현행", [E.purgeAfter, E.purgeNow])),
    ev(E.filmNow, "포장 필름 현행 월 손익", -75000, "원/월", "300 × −250", "예시 계산", calc("월 발생량 × 현행 단가", [E.filmKg, E.incinerate])),
    ev(E.totalNow, "공장 현행 월 손익", -387500, "원/월", "네 흐름 현행 합계", "예시 계산", calc("흐름별 현행 합계", [E.sprueNow, E.defectNow, E.purgeNow, E.filmNow])),
    ev(E.totalAfter, "공장 배정 후 월 손익", 169000, "원/월", "192,000 + 72,000 − 20,000 − 75,000", "예시 계산", calc("흐름별 배정 후 합계 (필름은 현행 유지)", [E.sprueAfter, E.defectAfter, E.purgeAfter, E.filmNow])),
    ev(E.totalDiff, "공장 현행 대비", 556500, "원/월", "169,000 − (−387,500)", "예시 계산", calc("배정 후 − 현행", [E.totalAfter, E.totalNow])),
  ].map((item) => [item.id, item]),
);

function c(id: string, evidenceId: string, more: string[] = []): Claim {
  const source = FIXTURE_EVIDENCE[evidenceId];
  return {
    id,
    kind: "number",
    value: source.value,
    unit: source.unit,
    evidence: [evidenceId, ...more],
  };
}

let seq = 0;
function msg(
  from: string,
  to: string,
  type: ThreadMessage["type"],
  stage: number,
  streamIds: string[],
  text: string,
  claims: Claim[] = [],
  validation: ThreadMessage["validation"] = { ok: true, attempts: 1, rejections: [] },
): ThreadMessage {
  seq += 1;
  return {
    id: `msg_${seq}`,
    seq,
    from,
    to,
    type,
    stage,
    streamIds,
    text,
    claims,
    validation,
    createdAt: "",
  };
}

const BASE_VIEW: Omit<DiagnosisView, "viewer"> = {
  session: { id: "ses_example", emitterOrgId: HANBIT, status: "awaiting_answers", version: 1 },
  stages: [
    { stage: 1, key: "identify", label: "식별·분류", status: "done" },
    { stage: 2, key: "feasibility", label: "가능성 판단", status: "needs_check" },
    { stage: 3, key: "regulation", label: "규정 검토", status: "done" },
    { stage: 4, key: "matching", label: "업종·기업 탐색", status: "done" },
    { stage: 5, key: "cost-carbon", label: "비용·탄소 비교", status: "running" },
    { stage: 6, key: "proposal", label: "최적안 제안", status: "waiting" },
  ],
  streams: [
    {
      id: "st_sprue",
      name: "스프루·런너",
      material: "PP",
      origin: "PIR",
      form: "가공 전",
      monthlyKg: c("kg", E.sprueKg),
      grade: { value: "A", basis: "measured", evidence: [E.sprueCont] },
      currentTreatment: { method: "혼합 소각", unitCost: c("cost", E.incinerate), assumed: true },
    },
    {
      id: "st_defect",
      name: "사출 불량품",
      material: "PP",
      origin: "PIR",
      form: "가공 전",
      monthlyKg: c("kg", E.defectKg),
      grade: { value: "B", basis: "photo_estimate", evidence: [] },
      currentTreatment: { method: "혼합 소각", unitCost: c("cost", E.incinerate), assumed: true },
    },
    {
      id: "st_purge",
      name: "퍼지 덩어리",
      material: "PP+ABS",
      origin: "PIR",
      form: "가공 전",
      monthlyKg: c("kg", E.purgeKg),
      grade: { value: "등외", basis: "photo_estimate", evidence: [] },
      currentTreatment: { method: "혼합 소각", unitCost: c("cost", E.incinerate), assumed: true },
    },
    {
      id: "st_film",
      name: "포장 필름",
      material: "LDPE",
      origin: "PCR",
      form: "필름",
      monthlyKg: c("kg", E.filmKg),
      grade: null,
      currentTreatment: { method: "혼합 소각", unitCost: c("cost", E.incinerate), assumed: true },
    },
  ],
  threads: [
    {
      id: "th_saegil",
      vendorOrgId: SAEGIL,
      vendorName: "(주)새길자원",
      vendorModel: { provider: "foundry", name: "gpt-5-mini" },
      status: "open",
      statusReason: null,
      reasonEvidence: [],
      streamIds: ["st_sprue", "st_defect"],
      turns: 4,
      maxTurns: 12,
      messages: [
        msg(HANBIT, SAEGIL, "inquiry", 4, ["st_sprue"], "PP 스프루·런너가 월 {{kg}} 나옵니다. 측정한 오염도는 {{cont}}입니다. 매입할 수 있는지 문의드립니다.", [c("kg", E.sprueKg), c("cont", E.sprueCont)]),
        msg(SAEGIL, HANBIT, "offer", 5, ["st_sprue"], "A등급 기준(오염도 {{limit}} 이하)에 맞습니다. 분쇄 상태로 주시면 {{price}}에 매입하겠습니다.", [c("limit", E.ppACont), c("price", E.ppA)], {
          ok: true,
          attempts: 2,
          rejections: [
            {
              code: "NUMBER_OUTSIDE_PLACEHOLDER",
              message: "자리표시자 밖 본문에 숫자가 있어 다시 쓰게 했습니다.",
            },
          ],
        }),
        msg(HANBIT, SAEGIL, "inquiry", 4, ["st_defect"], "사출 불량품도 월 {{kg}} 나옵니다. 종이 라벨과 금속 인서트가 붙어 있습니다.", [c("kg", E.defectKg)]),
        msg(SAEGIL, HANBIT, "conditional", 5, ["st_defect"], "금속 인서트를 분리해 주시면 B등급 {{price}}에 매입할 수 있습니다. 분리가 가능한지 확인 부탁드립니다.", [c("price", E.ppB)]),
      ],
    },
    {
      id: "th_namhae",
      vendorOrgId: NAMHAE,
      vendorName: "(주)남해열분해",
      vendorModel: { provider: "ollama", name: "오픈 모델" },
      status: "agreed",
      statusReason: null,
      reasonEvidence: [],
      streamIds: ["st_purge"],
      turns: 2,
      maxTurns: 12,
      messages: [
        msg(HANBIT, NAMHAE, "inquiry", 4, ["st_purge"], "PP와 ABS가 섞인 퍼지 덩어리가 월 {{kg}} 나옵니다. 열분해 원료로 받을 수 있는지 문의드립니다.", [c("kg", E.purgeKg)]),
        msg(NAMHAE, HANBIT, "offer", 5, ["st_purge"], "혼합 플라스틱으로 받을 수 있습니다. 처리비는 {{fee}}입니다.", [c("fee", E.pyro)]),
      ],
    },
    {
      id: "th_miso",
      vendorOrgId: MISO,
      vendorName: "(주)미소환경",
      vendorModel: { provider: "foundry", name: "gpt-5-mini" },
      status: "not_opened",
      statusReason: "허가 품목에 필름류가 없어 포장 필름 대화를 열지 않았습니다.",
      reasonEvidence: [E.misoPermit],
      streamIds: ["st_film"],
      turns: 0,
      maxTurns: 12,
      messages: [],
    },
  ],
  graph: {
    nodes: [
      { id: "st_sprue", type: "stream", label: "스프루·런너" },
      { id: "st_defect", type: "stream", label: "사출 불량품" },
      { id: "st_purge", type: "stream", label: "퍼지 덩어리" },
      { id: "st_film", type: "stream", label: "포장 필름" },
      { id: "pc_pp_a", type: "criterion", label: "PP A등급" },
      { id: "pc_pp_b", type: "criterion", label: "PP B등급" },
      { id: "pc_mixed", type: "criterion", label: "혼합 플라스틱" },
      { id: "permit_miso", type: "criterion", label: "허가 품목" },
      { id: SAEGIL, type: "vendor", label: "(주)새길자원" },
      { id: NAMHAE, type: "vendor", label: "(주)남해열분해" },
      { id: MISO, type: "vendor", label: "(주)미소환경" },
      { id: E.ppA, type: "evidence", label: "새길 매입 기준표" },
      { id: E.pyro, type: "evidence", label: "남해 매입 기준표" },
      { id: E.misoPermit, type: "evidence", label: "미소 허가증" },
    ],
    edges: [
      { from: "st_sprue", to: "pc_pp_a", status: "met", label: "오염도 충족", evidence: [E.sprueCont, E.ppACont] },
      { from: "st_defect", to: "pc_pp_b", status: "conditional", label: "인서트 분리 시", evidence: [E.ppB] },
      { from: "st_purge", to: "pc_mixed", status: "met", label: "혼합 수용", evidence: [E.pyro] },
      { from: "st_film", to: "permit_miso", status: "unmet", label: "필름 허가 없음", evidence: [E.misoPermit] },
      { from: "pc_pp_a", to: SAEGIL, status: "met", label: "", evidence: [E.ppA] },
      { from: "pc_pp_b", to: SAEGIL, status: "conditional", label: "", evidence: [E.ppB] },
      { from: "pc_mixed", to: NAMHAE, status: "met", label: "", evidence: [E.pyro] },
      { from: "permit_miso", to: MISO, status: "unmet", label: "", evidence: [E.misoPermit] },
      { from: SAEGIL, to: E.ppA, status: "met", label: "", evidence: [E.ppA] },
      { from: NAMHAE, to: E.pyro, status: "met", label: "", evidence: [E.pyro] },
      { from: MISO, to: E.misoPermit, status: "unmet", label: "", evidence: [E.misoPermit] },
    ],
  },
  result: {
    status: "conditional",
    assignments: [
      {
        streamId: "st_sprue",
        vendorOrgId: SAEGIL,
        route: "sell",
        status: "calculated",
        unitPrice: c("price", E.ppA),
        monthlyNow: c("now", E.sprueNow),
        monthlyAfter: c("after", E.sprueAfter),
        difference: c("diff", E.sprueDiff),
        carbon: null,
        checks: [],
        alternatives: [
          { vendorOrgId: null, route: "incinerate", monthlyAfter: c("alt", E.sprueNow), note: "현행 유지" },
        ],
      },
      {
        streamId: "st_defect",
        vendorOrgId: SAEGIL,
        route: "sell",
        status: "conditional",
        unitPrice: c("price", E.ppB),
        monthlyNow: c("now", E.defectNow),
        monthlyAfter: c("after", E.defectAfter),
        difference: c("diff", E.defectDiff),
        carbon: null,
        checks: [
          {
            key: "separation",
            status: "conditional",
            text: "금속 인서트를 분리해야 B등급으로 매입합니다.",
            ask: "금속 인서트를 현장에서 분리할 수 있습니까?",
            evidence: [E.ppB],
          },
        ],
        alternatives: [],
      },
      {
        streamId: "st_purge",
        vendorOrgId: NAMHAE,
        route: "pyrolysis",
        status: "calculated",
        unitPrice: c("price", E.pyro),
        monthlyNow: c("now", E.purgeNow),
        monthlyAfter: c("after", E.purgeAfter),
        difference: c("diff", E.purgeDiff),
        carbon: null,
        checks: [],
        alternatives: [],
      },
      {
        streamId: "st_film",
        vendorOrgId: null,
        route: null,
        status: "needs_information",
        unitPrice: null,
        monthlyNow: c("now", E.filmNow),
        monthlyAfter: null,
        difference: null,
        carbon: null,
        checks: [
          {
            key: "moisture",
            status: "conditional",
            text: "수분을 알아야 등급을 낼 수 있습니다.",
            ask: null,
            evidence: [],
          },
          {
            key: "permit",
            status: "unmet",
            text: "(주)미소환경은 허가 품목에 필름류가 없습니다.",
            ask: null,
            evidence: [E.misoPermit],
          },
        ],
        alternatives: [],
      },
    ],
    totals: {
      monthlyNow: c("totalNow", E.totalNow),
      monthlyAfter: c("totalAfter", E.totalAfter),
      difference: c("totalDiff", E.totalDiff),
      carbon: null,
    },
    assumptions: [E.incinerate],
    sensitivity: [{ label: "현행 처리가 혼합 소각이 아닐 때", difference: null }],
  },
  questions: [
    {
      id: "q_film_moisture",
      batch: 1,
      streamId: "st_film",
      field: "moisturePct",
      text: "포장 필름은 젖은 상태로 보관됩니까? 수분(%)을 알고 있으면 알려 주세요.",
      answered: false,
    },
    {
      id: "q_defect_separation",
      batch: 1,
      streamId: "st_defect",
      field: "separation",
      text: "사출 불량품의 금속 인서트를 현장에서 분리할 수 있습니까?",
      answered: false,
    },
  ],
  approvals: [
    { threadId: "th_saegil", emitter: false, vendor: false, blocked: true, blockedReason: "조건부 항목(금속 인서트 분리)이 남아 있습니다." },
    { threadId: "th_namhae", emitter: false, vendor: false, blocked: false, blockedReason: null },
  ],
  documents: [],
  events: [],
};

export function fixtureView(orgId: string): DiagnosisView {
  const org = FIXTURE_ORGS.find((item) => item.id === orgId) ?? FIXTURE_ORGS[0];
  const role: OrgRole = org.role;
  // 업체는 자기 스레드만 본다. 배출 기업의 다른 업체 대화는 보여 주지 않는다.
  const threads =
    role === "vendor"
      ? BASE_VIEW.threads.filter((thread) => thread.vendorOrgId === org.id)
      : BASE_VIEW.threads;
  const threadIds = new Set(threads.map((thread) => thread.id));
  return {
    ...BASE_VIEW,
    viewer: { orgId: org.id, role },
    threads,
    approvals: BASE_VIEW.approvals.filter((approval) => threadIds.has(approval.threadId)),
    result: role === "vendor" ? null : BASE_VIEW.result,
    questions: role === "emitter" ? BASE_VIEW.questions : [],
  };
}

export const FIXTURE_STREAMS: StreamRecord[] = [
  { id: "st_sprue", orgId: HANBIT, name: "스프루·런너", process: "사출", wasteItem: "폐플라스틱", material: "PP", origin: "PIR", form: "가공 전", monthlyKg: 600, monthlyKgBasis: "measured", currentTreatment: null },
  { id: "st_defect", orgId: HANBIT, name: "사출 불량품", process: "사출", wasteItem: "폐플라스틱", material: "PP", origin: "PIR", form: "가공 전", monthlyKg: 400, monthlyKgBasis: "measured", currentTreatment: null },
  { id: "st_purge", orgId: HANBIT, name: "퍼지 덩어리", process: "사출", wasteItem: "폐플라스틱", material: "PP+ABS", origin: "PIR", form: "가공 전", monthlyKg: 250, monthlyKgBasis: "estimated", currentTreatment: null },
  { id: "st_film", orgId: HANBIT, name: "포장 필름", process: "입고", wasteItem: "포장재", material: "LDPE", origin: "PCR", form: "필름", monthlyKg: 300, monthlyKgBasis: "measured", currentTreatment: null },
];

export const FIXTURE_VENDORS: Record<string, VendorProfile> = {
  [SAEGIL]: {
    orgId: SAEGIL,
    permits: [{ wasteItem: "폐플라스틱", materials: ["PP", "PE"], evidence: [] }],
    criteria: [
      { id: "pc_pp_a", material: "PP", grade: "A", form: "분쇄", maxContaminationPct: 2, maxMoisturePct: 1, unitPriceKrwPerKg: 320, minMonthlyKg: 500, evidence: [E.ppA] },
      { id: "pc_pp_b", material: "PP", grade: "B", form: null, maxContaminationPct: 8, maxMoisturePct: 3, unitPriceKrwPerKg: 180, minMonthlyKg: 300, evidence: [E.ppB] },
    ],
    fleet: { depot: [128.9, 35.1], capacityKg: 5000, capacityM3: 20, costPerKm: 1200, evidence: [] },
    guardrails: { floorPriceKrwPerKg: 150, days: ["화", "목"], minPickupsPerMonth: 2, autoDecline: ["PVC 혼입"] },
    model: { provider: "foundry", name: "gpt-5-mini" },
  },
  [NAMHAE]: {
    orgId: NAMHAE,
    permits: [{ wasteItem: "폐플라스틱", materials: ["PP", "PE", "ABS", "혼합"], evidence: [] }],
    criteria: [
      { id: "pc_mixed", material: "혼합", grade: "등외", form: null, maxContaminationPct: null, maxMoisturePct: null, unitPriceKrwPerKg: -80, minMonthlyKg: 200, evidence: [E.pyro] },
    ],
    fleet: null,
    guardrails: { floorPriceKrwPerKg: -120, days: ["수"], minPickupsPerMonth: 1, autoDecline: [] },
    model: { provider: "ollama", name: "오픈 모델" },
  },
  [MISO]: {
    orgId: MISO,
    permits: [{ wasteItem: "폐플라스틱", materials: ["경질"], evidence: [E.misoPermit] }],
    criteria: [],
    fleet: null,
    guardrails: { floorPriceKrwPerKg: null, days: [], minPickupsPerMonth: null, autoDecline: [] },
    model: { provider: "foundry", name: "gpt-5-mini" },
  },
};
