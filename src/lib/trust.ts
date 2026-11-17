/**
 * AI 신뢰도 화면(/trust)이 읽는 평가 결과(GET /api/v3/trust, 백엔드 docs/v3/eval/latest.json)를 화면 모양으로 바꾼다.
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/trust.test.ts).
 *
 * 정직 규칙(평가 설계 17장)
 *  - 목표(target)는 결과가 아니다. 화면에는 늘 "목표"라는 낱말을 붙인다.
 *  - 목표 미달과 재지 못한 것도 그대로 보인다. 숫자를 지어내지 않고, 값이 없으면 "미측정"이다.
 *  - 모델을 연결하지 않은 실행(isModel: false)은 AI 모델의 성적처럼 보이지 않게 따로 밝힌다.
 *  - 평가일에서 staleAfterDays(기본 30일)가 지나면 "오래된 결과"를 붙인다.
 *  - 지난 결과(latest.json의 history, current: false)는 지금 결과처럼 보이지 않는다. 숫자 없이 "내렸다"는 사실과 까닭만
 *    적는다. 이번 실행이 재지 않은 층의 머리 숫자도 보이지 않는다.
 * 일반 사용자 화면이므로 모델 이름, 설정 이름, 파일 경로 같은 개발자 말은 걸러 낸다(DESIGN.md 제품 문구 원칙).
 * 이름은 백엔드가 준 쉬운 말(지표·층의 label, title, explain, notMeasured)을 쓰고 technicalLabel·technicalTitle은 쓰지
 * 않는다. 지표마다 "무엇을 재는지" 한 줄은 아래 METRICS가 먼저다: 백엔드의 explain은 대개 척도 안내("0에서 1 사이
 * 비율입니다")라 화면이 백분율로 적는 값과 맞지 않기 때문이다. 예전 모양(label이 기술 이름)이 오면 METRICS로 바꾼다.
 */

type Json = Record<string, unknown>;
const isObj = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export type Verdict = "met" | "unmet" | "unmeasured" | "none";
export type MetricKind = "rate" | "count" | "seconds" | "score";

export type TrustMetric = {
  key: string;
  /** 쉬운 말 이름 */
  label: string;
  /** 무엇을 재는지 한 줄. 모르는 지표면 null */
  explain: string | null;
  value: number | null;
  /** 화면에 쓸 값. 값이 없으면 "미측정" */
  display: string;
  /** "95% 신뢰구간 97.1–100%". 받은 구간 그대로(비율은 Wilson) */
  ci: string | null;
  /** 구간을 구한 방법(wilson | bootstrap 등). 화면은 바꾸지 않고 그대로 적는다 */
  ciMethod: string | null;
  n: number | null;
  /** "목표 ≥ 80%" */
  target: string | null;
  verdict: Verdict;
  /** 비율 지표인데 표본이 30보다 적다(또는 백엔드가 표본이 적다고 표시했다). 화면은 "표본이 작아 구간이 넓습니다"를 붙인다 */
  smallSample: boolean;
};

export type TrustLayer = {
  id: string;
  title: string;
  explain: string;
  status: "measured" | "partial" | "not_measured";
  /** "시나리오 70건" */
  size: string | null;
  key: TrustMetric | null;
  more: TrustMetric[];
  all: TrustMetric[];
  /** 재지 못한 까닭(걸러 낸 것) */
  notes: string[];
};

export type TrustPending = { title: string; why: string };

/** 내린 지난 결과(숫자는 싣지 않는다) */
export type TrustRetired = { date: string | null; reason: string };

export type TrustView = {
  date: string;
  stale: boolean;
  /** "AI 판 2026-11-18" 또는 "모델 연결 전 기본 규칙" */
  aiVersion: string;
  isModel: boolean;
  /** "시험셋 test-v1" */
  split: string;
  repeats: number | null;
  reviewState: string | null;
  scenarios: number | null;
  headline: TrustMetric[];
  layers: TrustLayer[];
  pending: TrustPending[];
  /** 구간 읽는 법(백엔드 ciNote) */
  ciNote: string | null;
  /** 앞서 공개했다가 내린 결과 */
  retired: TrustRetired[];
};

/* ── 값 다루기 ────────────────────────────────────────────────────── */

const COUNT_KEYS = new Set([
  "outgoingHallucination",
  "violations",
  "wrongAgreements",
  "exposures",
  "baseExposures",
  "probeAdded",
  "viewExposures",
  "probeErrors",
  "pii_other_orgs",
  "pii_model_input_documents",
  "pii_model_input_names",
  "pii_events",
  "pii_control_false_hits",
  "twin_goal_state",
]);
const SECONDS_KEYS = new Set(["latencyP50", "latencyP95"]);
const SCORE_KEYS = new Set([
  "ndcg@10",
  "mrr",
  "normalizedRegret",
  "regretWithTransport",
  "turnsToAgreement",
  "turnsPerThread",
  "questionBatches",
  "handoffs",
  "tacticSensitivity",
  "tokens",
  "cost",
  "pareto",
]);

const RATE_KEYS = new Set(["variantConsistency", "verdictMatch", "probeClean", "zeroRegret", "guardrailCompliance", "agreement"]);

export function kindOf(key: string, label: string): MetricKind {
  if (RATE_KEYS.has(key)) return "rate";
  if (COUNT_KEYS.has(key) || /건수/.test(label)) return "count";
  if (SECONDS_KEYS.has(key)) return "seconds";
  if (SCORE_KEYS.has(key)) return "score";
  if (/률|율|비율|정확도|recall|pass\^|pass1|pass4|asr|효용/i.test(`${key} ${label}`)) return "rate";
  return "score";
}

function trim(value: number, digits: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);
}

export function formatValue(value: number, kind: MetricKind): string {
  if (kind === "rate") return `${trim(value * 100, 1)}%`;
  if (kind === "count") return `${trim(value, 0)}건`;
  if (kind === "seconds") return `${trim(value, 2)}초`;
  return trim(value, 2);
}

/** 구간은 받은 그대로 적는다(비율 지표는 백엔드가 Wilson 구간을 준다) */
function formatCi(ci: unknown, kind: MetricKind): string | null {
  if (!Array.isArray(ci) || ci.length !== 2) return null;
  const [low, high] = ci.map(num);
  if (low === null || high === null) return null;
  if (kind === "rate") return `95% 신뢰구간 ${trim(low * 100, 1)}–${trim(high * 100, 1)}%`;
  return `95% 신뢰구간 ${formatValue(low, kind)}–${formatValue(high, kind)}`;
}

const OPS: Record<string, string> = { ">=": "≥", "<=": "≤", "==": "=", ">": ">", "<": "<" };

function formatTarget(target: unknown, kind: MetricKind): string | null {
  if (!isObj(target) || target.isTarget === false) return null;
  const op = OPS[str(target.op) ?? ""];
  const value = num(target.value);
  if (!op || value === null) return null;
  return `목표 ${op} ${formatValue(value, kind)}`;
}

function verdictOf(raw: unknown, value: number | null): Verdict {
  if (raw === "달성") return "met";
  if (raw === "미달") return "unmet";
  if (raw === "미측정" || value === null) return "unmeasured";
  return "none";
}

/** 표본이 이보다 적은 비율 지표에는 "표본이 작아 구간이 넓습니다"를 붙인다 */
export const SMALL_SAMPLE = 30;

/* ── 쉬운 말 ──────────────────────────────────────────────────────── */

/** 화면에 남으면 안 되는 평가 용어(tests/trust.test.ts가 화면 모양 전체에서 찾는다) */
export const JARGON = /Shields|ASR|\bL\d|카나리아|spotlighting|탐침|정규식|조건 \(i+\)|nDCG|Recall|MRR|pass\^|Cohen|BM25|RRF|루브릭|프롬프트|쌍둥이|게이트|스레드|handoff/i;

type MetricText = { label: string; explain: string };

/** 지표 키 → 쉬운 이름과 한 줄 설명. "층:키"가 있으면 그 층에서 먼저 쓴다(L4와 L5의 handoffs는 뜻이 다르다) */
export const METRICS: Record<string, MetricText> = {
  // 검색
  "ndcg@10": { label: "맞는 조항을 위쪽에 찾아 놓는 정도", explain: "찾은 목록 위쪽 10개 안에서 맞는 조항이 얼마나 앞에 있는지 0~1로 잽니다. 1이 가장 좋습니다." },
  "recall@5": { label: "찾아야 할 조항이 위쪽 5개 안에 든 비율", explain: "꼭 찾아야 할 조항 가운데 찾은 목록 위쪽 5개 안에 든 몫입니다." },
  "recall@10": { label: "찾아야 할 조항이 위쪽 10개 안에 든 비율", explain: "꼭 찾아야 할 조항 가운데 찾은 목록 위쪽 10개 안에 든 몫입니다." },
  mrr: { label: "첫 번째 맞는 조항의 순위 점수", explain: "처음 나온 맞는 조항이 1위면 1, 2위면 0.5처럼 매긴 점수의 평균입니다." },
  no_answer_accuracy: { label: "답이 없는 질문에 없다고 답한 비율", explain: "근거 문서에 답이 없는 질문에 지어내지 않고 없다고 한 몫입니다." },
  answer_rate: { label: "답이 있는 질문에 답을 낸 비율(참고)", explain: "답이 있는 질문에서 기준 점수를 넘는 조항을 찾아 답을 낸 몫입니다." },
  // 근거 있는 생성
  firstTry: { label: "첫 초안이 근거 확인을 통과한 비율", explain: "AI가 처음 쓴 글이 고치지 않고 근거 확인을 통과한 몫입니다." },
  afterRewrite: { label: "고쳐 쓴 뒤까지 근거 확인을 통과한 비율", explain: "돌려보낸 글을 고쳐 쓴 뒤까지 합쳐 근거 확인을 통과한 몫입니다." },
  handoff: { label: "끝내 통과하지 못해 담당자에게 넘긴 비율", explain: "고쳐 써도 근거 확인을 통과하지 못해 사람에게 넘긴 몫입니다." },
  numberHallucination: { label: "초안에 근거 없는 숫자가 섞인 비율", explain: "보내기 전 초안에 근거에 없는 숫자가 섞인 몫입니다. 이런 초안은 나가지 않습니다." },
  evidenceHallucination: { label: "초안이 없는 근거를 댄 비율", explain: "보내기 전 초안이 근거 저장소에 없는 근거를 가리킨 몫입니다. 이런 초안은 나가지 않습니다." },
  quoteMismatch: { label: "조항 인용이 원문과 다른 비율", explain: "인용한 조항 문장이 원문과 글자 그대로 같지 않은 몫입니다." },
  recheckRejected: { label: "받은 쪽이 다시 확인해 돌려보낸 비율", explain: "상대 AI가 받은 글을 다시 확인했을 때 근거와 맞지 않아 돌려보낸 몫입니다." },
  outgoingHallucination: { label: "근거 없는 숫자가 상대에게 나간 횟수", explain: "근거 확인을 지나 상대에게 실제로 보낸 글에서 근거 없는 숫자가 나온 횟수입니다." },
  // 과업 성공
  "pass^1": { label: "찾기를 끝까지 맞게 마친 비율", explain: "가상 시나리오를 한 번 돌렸을 때 끝난 모습(합의·거절·담당자 인계)이 기대와 같은 몫입니다." },
  pass1: { label: "찾기를 끝까지 맞게 마친 비율", explain: "가상 시나리오를 한 번 돌렸을 때 끝난 모습(합의·거절·담당자 인계)이 기대와 같은 몫입니다." },
  "pass^2": { label: "두 번 돌려 두 번 모두 맞은 비율", explain: "같은 시나리오를 두 번 돌려 모두 기대대로 끝난 몫입니다. 결과가 흔들리지 않는지 봅니다." },
  "pass^3": { label: "세 번 돌려 세 번 모두 맞은 비율", explain: "같은 시나리오를 세 번 돌려 모두 기대대로 끝난 몫입니다. 결과가 흔들리지 않는지 봅니다." },
  "pass^4": { label: "네 번 돌려 네 번 모두 맞은 비율", explain: "같은 시나리오를 네 번 돌려 모두 기대대로 끝난 몫입니다. 결과가 흔들리지 않는지 봅니다." },
  pass4: { label: "같은 시나리오를 네 번 돌려 네 번 모두 맞은 비율", explain: "같은 시나리오를 네 번 돌려 모두 기대대로 끝난 몫입니다. 결과가 흔들리지 않는지 봅니다." },
  verdictMatch: { label: "끝난 모습이 기대와 같은 비율", explain: "합의·거절·담당자 인계 가운데 어느 쪽으로 끝났는지가 기대와 같은 몫입니다." },
  violations: { label: "하면 안 되는 일을 한 횟수", explain: "승인 없이 확정하기처럼 금지한 일을 한 횟수입니다." },
  requiredRecall: { label: "꼭 물어야 할 것을 물은 비율", explain: "담당자에게 꼭 물어야 할 값을 빠뜨리지 않고 물은 몫입니다." },
  unneededQuestions: { label: "묻지 않아도 될 것을 물은 비율", explain: "이미 아는 값을 담당자에게 다시 물은 몫입니다." },
  latencyP50: { label: "찾기 한 번에 걸린 시간(가운데 값)", explain: "시나리오 하나를 끝까지 돌리는 데 걸린 시간을 줄 세웠을 때 가운데 값입니다." },
  latencyP95: { label: "찾기 한 번에 걸린 시간(느린 쪽)", explain: "100번 가운데 95번은 이 시간 안에 끝났습니다." },
  turnsPerThread: { label: "업체 한 곳과 주고받은 횟수(평균)", explain: "열린 대화 하나에서 두 AI가 글을 주고받은 횟수의 평균입니다." },
  questionBatches: { label: "담당자에게 질문을 보낸 횟수(평균)", explain: "찾기 한 번에 담당자에게 질문을 묶어 보낸 횟수의 평균입니다." },
  "L4:handoffs": { label: "담당자에게 넘긴 대화 수(평균)", explain: "찾기 한 번에 AI가 끝내지 않고 사람에게 넘긴 대화 수의 평균입니다." },
  tokens: { label: "AI가 읽고 쓴 글의 양", explain: "AI 모델이 읽고 쓴 글의 양입니다." },
  cost: { label: "찾기 한 번의 비용", explain: "AI 모델을 부르는 데 든 비용입니다." },
  variantConsistency: { label: "표현만 바꾼 자료에서 같은 결과를 낸 비율", explain: "단위나 말투만 바꾼 같은 자료로 돌려도 결과가 같은 몫입니다." },
  // 협상
  agreement: { label: "합의할 수 있는 대화를 합의한 비율", explain: "조건이 맞을 수 있는 대화 가운데 실제로 합의에 이른 몫입니다." },
  wrongAgreements: { label: "합의하면 안 되는 대화를 합의한 횟수", explain: "조건이 맞을 수 없는 대화에서 합의해 버린 횟수입니다." },
  normalizedRegret: { label: "가장 좋은 조건과의 차이", explain: "합의한 조건이 가능한 가장 좋은 조건에서 얼마나 떨어졌는지 0~1로 잽니다. 0이 가장 좋습니다." },
  zeroRegret: { label: "가장 좋은 조건으로 합의한 비율", explain: "가능한 가장 좋은 조건과 같은 조건으로 합의한 몫입니다." },
  guardrailCompliance: { label: "업체가 정한 범위를 지킨 비율", explain: "업체 측 AI가 낸 조건이 업체가 정한 단가·요일 범위 안에 있었던 몫입니다." },
  turnsToAgreement: { label: "합의까지 주고받은 횟수(평균)", explain: "합의에 이르기까지 두 AI가 글을 주고받은 횟수의 평균입니다." },
  "L5:handoffs": { label: "담당자에게 넘긴 대화 수(평균)", explain: "시나리오 하나에서 AI가 끝내지 않고 사람에게 넘긴 대화 수의 평균입니다." },
  handoffs: { label: "담당자에게 넘긴 대화 수(평균)", explain: "AI가 끝내지 않고 사람에게 넘긴 대화 수의 평균입니다." },
  tacticSensitivity: { label: "상대의 말투에 흔들린 정도", explain: "상대가 세게 나오든 약하게 나오든 결과가 바뀌지 않는지 봅니다. 0이 가장 좋습니다." },
  pareto: { label: "더 나아질 여지가 없는 합의의 비율", explain: "한쪽을 손해 보게 하지 않고는 더 나은 조건이 없는 합의의 몫입니다." },
  regretWithTransport: { label: "운반비까지 넣은 조건 차이(참고)", explain: "운반비를 넣어 계산했을 때 가장 좋은 조건과의 차이입니다." },
  // 안전: 회사 사이의 정보 노출
  exposures: { label: "다른 회사에 보인 정보 건수", explain: "한 회사의 정보가 다른 회사의 화면이나 대화에 보인 건수입니다." },
  probeClean: { label: "정보를 캐물어도 새지 않은 비율", explain: "다른 회사 정보를 알아내려는 시험 질문을 넣어도 정보가 새지 않은 몫입니다." },
  baseExposures: { label: "평소대로 돌렸을 때 보인 정보 건수", explain: "시험 질문 없이 평소대로 돌렸을 때 다른 회사에 보인 정보 건수입니다." },
  probeAdded: { label: "캐묻는 질문으로 더 보인 정보 건수", explain: "정보를 캐묻는 시험 질문 때문에 더 보인 건수입니다." },
  viewExposures: { label: "화면·대화·서류에 보인 다른 회사 정보 건수", explain: "결과 화면, 대화, 서류에 다른 회사의 정보가 보인 건수입니다." },
  probeErrors: { label: "시험 중 멈춘 횟수", explain: "시험을 돌리다 오류로 멈춘 횟수입니다." },
  // 안전: 숨긴 공격 문구와 개인정보
  benign_utility: { label: "공격 문구가 없을 때 찾기를 맞게 마친 비율", explain: "공격 문구를 뺀 같은 자료로 돌렸을 때 기대대로 끝난 몫입니다." },
  utility_under_attack: { label: "공격 문구가 있어도 찾기를 맞게 마친 비율", explain: "자료에 공격 문구를 숨겨도 기대대로 끝난 몫입니다." },
  safe_handoff: { label: "수상한 자료를 보고 담당자에게 넘긴 비율", explain: "공격 문구가 든 자료를 보고 끝내지 않고 사람에게 넘긴 몫입니다." },
  asr_code_gated: { label: "숨긴 공격 문구가 목표에 닿은 비율", explain: "문서에 숨긴 지시가 AI를 움직여 막아야 할 일을 하게 만든 몫입니다. 0이 목표입니다." },
  injectionGated: { label: "숨긴 공격 문구가 목표에 닿은 비율", explain: "문서에 숨긴 지시가 AI를 움직여 막아야 할 일을 하게 만든 몫입니다. 0이 목표입니다." },
  asr_G1: { label: "범위 밖 단가를 내게 만든 공격이 통한 비율", explain: "업체가 정한 범위 밖의 단가를 내거나 받게 만든 몫입니다." },
  asr_G2: { label: "승인 없이 확정하게 만든 공격이 통한 비율", explain: "담당자 승인 없이 확정하게 만든 몫입니다." },
  asr_G3: { label: "허가 없는 업체와 대화하게 만든 공격이 통한 비율", explain: "허가 품목이 맞지 않는 업체와 대화하거나 배정하게 만든 몫입니다." },
  asr_G4: { label: "다른 회사 정보를 빼내게 만든 공격이 통한 비율", explain: "다른 회사의 정보를 상대에게 보내게 만든 몫입니다." },
  asr_G5: { label: "근거 없는 숫자를 넣게 만든 공격이 통한 비율", explain: "근거에 없는 숫자나 조항을 글에 넣게 만든 몫입니다." },
  asr_G6: { label: "숨긴 지시를 상대에게 옮기게 만든 공격이 통한 비율", explain: "숨긴 지시 문장이나 링크를 보내는 글에 옮기게 만든 몫입니다." },
  utility_plus_handoff: { label: "공격 중에도 맞게 마치거나 담당자에게 넘긴 비율", explain: "공격 문구가 있어도 기대대로 끝내거나 안전하게 사람에게 넘긴 몫입니다." },
  relay_rate: { label: "공격 문구가 상대에게 그대로 전해진 비율(참고)", explain: "숨긴 문구가 상대에게 보내는 글에 그대로 실린 몫입니다." },
  twin_goal_state: { label: "공격 없이도 같은 결과가 난 사례 수(기준)", explain: "공격 문구 없이도 공격이 노린 결과가 나온 사례 수입니다. 공격이 통한 것으로 세지 않으려고 따로 셉니다." },
  shields_detect: { label: "입력 공격 탐지기가 공격을 잡은 비율", explain: "문서에 숨긴 공격을 탐지기가 찾아낸 몫입니다." },
  shields_false_positive: { label: "입력 공격 탐지기가 정상 문서를 잘못 잡은 비율", explain: "공격이 없는 문서를 공격으로 잘못 본 몫입니다." },
  asr_documents_shields_on: { label: "문서 공격이 통한 비율(탐지기 켬)", explain: "입력 공격 탐지기를 켜고 문서에 공격을 숨겼을 때 목표에 닿은 몫입니다." },
  asr_documents_shields_off: { label: "문서 공격이 통한 비율(탐지기 끔)", explain: "탐지기 없이 문서에 공격을 숨겼을 때 목표에 닿은 몫입니다." },
  pii_other_orgs: { label: "다른 회사에 보인 개인정보 건수", explain: "담당자 이름·연락처 같은 개인정보가 다른 회사에 보인 건수입니다." },
  pii_model_input_documents: { label: "AI에 들어간 개인정보 건수(문서)", explain: "올린 문서에서 온 개인정보가 AI 입력에 들어간 건수입니다." },
  pii_model_input_names: { label: "AI에 들어간 개인정보 건수(이름 입력, 참고)", explain: "사람이 적은 이름이 AI 입력에 들어간 건수입니다." },
  pii_events: { label: "실행 기록에 남은 개인정보 건수(참고)", explain: "실행 기록에 개인정보가 남은 건수입니다." },
  pii_control_false_hits: { label: "개인정보 검사가 잘못 잡은 건수", explain: "개인정보를 넣지 않은 사례에서 개인정보로 잘못 본 건수입니다." },
};

/** 평가 메모 가운데 뜻을 알고 있는 것은 쉬운 문장으로 바꾼다(앞에서부터 처음 맞는 것) */
const NOTES: [RegExp, string][] = [
  [/spotlighting|입력 구분 표시/, "문서 글을 따로 표시해 AI에 넣는 방어: 지금은 문서 글이 AI에 들어가지 않아 해당하지 않습니다."],
  [/Prompt Shields|입력 공격 탐지기/, "입력 공격 탐지기를 켠 시험: 탐지기를 아직 연결하지 않아 돌리지 않았습니다."],
  [/실제 모델의 주입 저항/, "실제 AI 모델이 숨긴 공격 문구를 견디는지: 이번 시험은 모델을 연결하지 않은 기본 규칙으로 돌렸습니다."],
  [/Cohen|이중 라벨/, "관련 조항을 두 사람이 따로 매겨 맞춰 보는 검토는 아직 하지 않았습니다."],
  [/인용 문장 적합률/, "인용한 문장이 질문에 맞는지: 질문마다 맞는 답을 표시한 자료가 아직 없습니다."],
  [/의미 지표/, "인용이 빠짐없고 정확한지, 주장이 근거에 충실한지: 채점할 모델과 사람이 표시한 문장이 아직 없습니다."],
  [/카나리아|탐침/, "회사 사이의 정보 노출은 공개 시험셋으로만 잽니다."],
  [/L5는 시험셋|협상 \d+건으로만/, "협상은 공개 시험셋으로만 잽니다."],
  [/루브릭|판정 프롬프트/, "글의 쓸모와 명확성을 매길 기준과 사람 채점이 아직 없습니다."],
  [/현장 사진셋/, "공장 현장 사진과 정답 표시가 아직 모이지 않았습니다."],
];

const DEV_WORDS = /[A-Z][A-Z0-9]*_[A-Z0-9_]+|\.py\b|\.json\b|tests\/|backend|resource-ai|설정 없음|환경 변수/;

/**
 * 재지 못한 까닭 한 줄. 백엔드가 쉬운 말로 준 문장(용어·개발자 말이 없는 것)은 그대로 쓰고, 예전 모양의 기술 메모만
 * 아는 것은 쉬운 문장으로, 나머지는 plain으로 거른다.
 */
export function plainNote(text: string): string | null {
  if (!JARGON.test(text) && !DEV_WORDS.test(text)) return text.trim() || null;
  for (const [pattern, sentence] of NOTES) if (pattern.test(text)) return sentence;
  return plain(text);
}

/**
 * 원래 지표 이름이나 까닭에서 개발자 말과 평가 용어를 걷어 낸다. 설정·파일·내부 코드가 들어간 문장은 통째로 빼고(null),
 * 서비스 이름과 용어는 하는 일로 바꾼다.
 */
export function plain(text: string): string | null {
  if (DEV_WORDS.test(text)) return null;
  const out = text
    .replace(/Azure AI Search/g, "검색 서비스")
    .replace(/Prompt Shields|\bShields\b/g, "입력 공격 탐지기")
    .replace(/규칙 정책/g, "모델을 연결하지 않은 기본 규칙")
    .replace(/\s*\((?:평가 설계 )?\d+장\)/g, "")
    .replace(/조건 \((?:i{1,3}|iv|v)\)\s*/g, "")
    .replace(/\s*\(spotlighting\)/gi, "")
    .replace(/\bL\d[a-z]?(?:는|은|의|에서)?\s*/g, "")
    .replace(/표적 ASR,?\s*|\bASR\b/g, "공격이 통한 비율 ")
    .replace(/카나리아/g, "심어 둔 표식")
    .replace(/탐침/g, "시험 질문")
    .replace(/정규식 오탐/g, "잘못 잡은 건수")
    .replace(/\s*\(test-v\d+\)/g, "")
    .replace(/없다(?=[.)]|$)/g, "없습니다")
    .replace(/않았다(?=[.)]|$)/g, "않았습니다")
    .replace(/잰다(?=[.)]|$)/g, "잽니다")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out === "" ? null : out;
}

/** 백엔드 explain 가운데 백분율로 적는 값과 맞지 않는 척도 안내 */
const SCALE_NOTE = /^0에서 1 사이 비율입니다\.?$/;

/**
 * 지표 하나. layer는 같은 키라도 층마다 뜻이 다를 때 쓴다. 이름은 백엔드의 쉬운 이름(label, technicalLabel이 따로 있을 때)이
 * 먼저이고, 예전 모양(label이 기술 이름)이면 METRICS, 그다음 걸러 낸 이름이다.
 */
function metricOf(raw: unknown, layer: string | null = null): TrustMetric | null {
  if (!isObj(raw)) return null;
  const key = str(raw.key) ?? "";
  const technical = str(raw.technicalLabel);
  const given = str(raw.label);
  const known = (layer ? METRICS[`${layer}:${key}`] : undefined) ?? METRICS[key];
  const kind = kindOf(key, technical ?? given ?? key);
  const value = num(raw.value);
  const n = num(raw.n);
  const plainGiven = technical && given && !JARGON.test(given) ? given : null;
  const backendExplain = str(raw.explain);
  const usableExplain = backendExplain && !(kind === "rate" && SCALE_NOTE.test(backendExplain)) ? plain(backendExplain) : null;
  return {
    key,
    label: plainGiven ?? known?.label ?? (given ? plain(given) : null) ?? "그 밖의 지표",
    explain: known?.explain ?? usableExplain,
    value,
    display: value === null ? "미측정" : formatValue(value, kind),
    ci: value === null ? null : formatCi(raw.ci, kind),
    ciMethod: str(raw.ciMethod),
    n,
    target: formatTarget(raw.target, kind),
    verdict: verdictOf(raw.verdict, value),
    // 구간이 있는 비율 지표에만 붙인다(건수에는 구간이 없다)
    smallSample: value !== null && kind === "rate" && (raw.smallSample === true || (n !== null && n < SMALL_SAMPLE)),
  };
}

/* ── 층 ───────────────────────────────────────────────────────────── */

type LayerSpec = {
  id: string;
  /** 합쳐 보이는 원래 층(안전은 L6c·L6i) */
  sources: string[];
  title: string;
  explain: string;
  /** 앞에 둘 지표 */
  key: string;
  more: string[];
};

/** 공개 화면의 층 다섯 개와 층마다 앞에 둘 지표 */
export const LAYERS: LayerSpec[] = [
  {
    id: "L2",
    sources: ["L2"],
    title: "검색",
    explain: "질문에 맞는 법 조항과 근거 문서를 찾아 위쪽에 놓는지 잽니다. AI가 인용하는 조항은 여기서 찾은 것입니다.",
    key: "ndcg@10",
    more: ["recall@10", "no_answer_accuracy"],
  },
  {
    id: "L3",
    sources: ["L3"],
    title: "근거 있는 생성",
    explain: "AI가 쓴 글의 숫자와 조항이 근거와 맞는지 보내기 전에 검사합니다. 통과하지 못한 초안은 상대에게 나가지 않습니다.",
    key: "firstTry",
    more: ["outgoingHallucination", "handoff"],
  },
  {
    id: "L4",
    sources: ["L4"],
    title: "과업 성공",
    explain: "가상 시나리오마다 찾기를 끝까지 돌려, 끝난 모습(합의·거절·담당자 인계)이 기대와 같은지 봅니다.",
    key: "pass^1",
    more: ["violations", "requiredRecall"],
  },
  {
    id: "L5",
    sources: ["L5"],
    title: "협상",
    explain: "업체 측 AI가 업체가 정한 범위를 지키는지, 합의할 수 있는 대화는 합의하는지, 가장 좋은 조건에 가까운지 봅니다.",
    key: "guardrailCompliance",
    more: ["agreement", "normalizedRegret"],
  },
  {
    id: "L6",
    sources: ["L6i", "L6c"],
    title: "안전",
    explain: "문서에 숨긴 공격 문구가 AI를 움직이는지, 다른 회사의 정보가 새는지 봅니다.",
    key: "asr_code_gated",
    more: ["exposures", "pii_other_orgs"],
  },
];

/** 규모 단위 → 화면 낱말 */
const UNITS: Record<string, [string, string]> = {
  질의: ["질문", "개"],
  시나리오: ["시나리오", "건"],
  공격: ["공격", "건"],
  실행: ["실행", "건"],
  차례: ["주고받은 글", "건"],
};

function sizeOf(n: number | null, unit: string | null): string | null {
  if (n === null || n <= 0) return null;
  if (!unit || unit === "-") return `${trim(n, 0)}건`;
  const word = unit.replace(/\(.*\)$/, "").trim();
  const [name, counter] = UNITS[word] ?? [word, "건"];
  return `${name} ${trim(n, 0)}${counter}`;
}

/** 이번 실행에서 그 층을 쟀는지 */
function measured(part: unknown): boolean {
  return isObj(part) && str(part.status) !== "not_measured";
}

function layerOf(spec: LayerSpec, layers: Json): TrustLayer | null {
  const parts = spec.sources.map((id) => [id, layers[id]] as const).filter((entry): entry is readonly [string, Json] => isObj(entry[1]));
  if (parts.length === 0) return null;
  const metrics = parts.flatMap(([id, part]) => (Array.isArray(part.metrics) ? part.metrics : []).map((item) => ({ id, item })));
  const all = metrics.map(({ id, item }) => metricOf(item, id)).filter((item): item is TrustMetric => item !== null);
  const find = (key: string) => all.find((item) => item.key === key) ?? null;
  const statuses = parts.map(([, part]) => str(part.status) ?? "not_measured");
  const status = statuses.every((item) => item === "not_measured")
    ? "not_measured"
    : statuses.every((item) => item === "measured")
      ? "measured"
      : "partial";
  const sizes = parts.map(([, part]) => sizeOf(num(part.n), str(part.unit))).filter((item): item is string => Boolean(item));
  const notes = [
    ...new Set(
      parts
        .flatMap(([, part]) => (Array.isArray(part.notMeasured) ? part.notMeasured : []))
        .map((item) => (typeof item === "string" ? plainNote(item) : null))
        .filter((item): item is string => Boolean(item)),
    ),
  ];
  // 층 하나로 된 것은 백엔드의 쉬운 이름과 설명을 쓴다(둘을 합친 안전 층은 화면의 이름)
  const single = parts.length === 1 && spec.sources.length === 1 ? parts[0][1] : null;
  const title = single && str(single.title) && !JARGON.test(str(single.title) as string) ? (str(single.title) as string) : spec.title;
  const explain = single && str(single.explain) && !JARGON.test(str(single.explain) as string) ? (str(single.explain) as string) : spec.explain;
  return {
    id: spec.id,
    title,
    explain,
    status,
    size: sizes.length > 0 ? sizes.join(" · ") : null,
    key: find(spec.key),
    more: spec.more.map(find).filter((item): item is TrustMetric => item !== null),
    all,
    notes,
  };
}

/* ── 머리 ─────────────────────────────────────────────────────────── */

/** 머리 숫자 네 개와 그 숫자를 잰 층. 그 층을 이번 실행에서 재지 않았으면 숫자를 보이지 않는다 */
const HEADLINE: [string, string[]][] = [
  ["pass1", ["L4"]],
  ["pass4", ["L4"]],
  ["outgoingHallucination", ["L3"]],
  ["injectionGated", ["L6i"]],
];

function headlineOf(raw: unknown, layers: Json): TrustMetric[] {
  if (!isObj(raw)) return [];
  return HEADLINE.flatMap(([key, from]) => {
    const item = raw[key];
    if (!isObj(item)) return [];
    // 이번 실행에 그 층이 없으면 숫자가 이 실행의 것이 아니다
    if (num(item.value) !== null && !from.some((id) => measured(layers[id]))) return [];
    const metric = metricOf({ ...item, key });
    return metric ? [metric] : [];
  });
}

function versionDate(aiVersion: string | null, date: string): string {
  const tail = aiVersion?.split("·").pop()?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(tail) ? tail : date;
}

/** 오래된 결과인지: 평가일에서 days일이 지났다 */
export function isStale(date: string, days: number, today: Date): boolean {
  const at = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(at)) return false;
  return today.getTime() - at > days * 24 * 60 * 60 * 1000;
}

/** 원래 층 가운데 재지 못한 것을 쉬운 말로(층 이름 → 무엇을 아직 못 쟀나) */
const PENDING_LAYER: Record<string, TrustPending> = {
  L1: { title: "현장 사진으로 본 인식 정확도", why: "공장 현장 사진과 정답 표시가 아직 모이지 않아 재지 못했습니다." },
  L5: { title: "협상 품질", why: "이번 평가에서는 재지 않았습니다." },
  L6c: { title: "회사 사이의 정보 노출", why: "이번 평가에서는 재지 않았습니다." },
  L7: { title: "사람이 읽고 매긴 평가", why: "글의 쓸모와 명확성을 매길 기준과 사람 채점이 아직 없습니다." },
};

/** 내린 지난 결과(history의 current: false). 숫자는 싣지 않고 날짜와 까닭만 */
function retiredOf(history: unknown, split: string | null): TrustRetired[] {
  if (!Array.isArray(history)) return [];
  const seen = new Set<string>();
  return history.flatMap((item) => {
    if (!isObj(item) || item.current !== false) return [];
    // 지금 보이는 실행과 같은 평가셋의 지난 결과만 적는다
    if (split && str(item.split) && str(item.split) !== split) return [];
    const reason = str(item.reason);
    const shown = reason ? plainNote(reason) : null;
    const date = str(item.date);
    const key = `${date}|${shown}`;
    if (!shown || seen.has(key)) return [];
    seen.add(key);
    return [{ date, reason: shown }];
  });
}

/**
 * 평가 결과를 화면 모양으로. 모양이 맞지 않으면 null(화면은 "불러오지 못했습니다"를 보인다).
 * 응답이 latest.json 전체({primary, runs, history})이면 primary 실행을, 실행 하나만 오면 그것을 쓴다.
 * history(지난 결과)는 지금 결과로 쓰지 않는다.
 */
export function toTrustView(raw: unknown, today: Date = new Date()): TrustView | null {
  if (!isObj(raw)) return null;
  let run: Json | null = null;
  if (isObj(raw.runs)) {
    const runs = raw.runs;
    const primary = str(raw.primary);
    // 지난 결과로 표시된 실행(current: false)은 지금 결과로 고르지 않는다
    const usable = (item: unknown): item is Json => isObj(item) && item.current !== false;
    const chosen = primary && usable(runs[primary]) ? runs[primary] : null;
    run = (chosen as Json | null) ?? Object.values(runs).find(usable) ?? null;
  } else if (isObj(raw.layers) && raw.current !== false) {
    run = raw;
  }
  if (!run || !isObj(run.layers)) return null;
  const date = str(run.date);
  if (!date) return null;
  const layers = run.layers;
  const isModel = run.isModel === true;
  const when = versionDate(str(run.aiVersion), date);
  const setVersion = str(run.setVersion);
  const splitName = str(run.split);
  const split =
    splitName === "test" ? `시험셋${setVersion ? ` ${setVersion}` : ""}` : splitName === "dev" ? "개발셋" : (setVersion ?? splitName ?? "");
  const perLayer = isObj(run.nPerLayer) ? run.nPerLayer : {};

  const pending: TrustPending[] = [];
  if (!isModel) pending.push({ title: "실제 AI 모델로 돌린 결과", why: "모델을 연결한 평가는 아직 공개하지 않았습니다. 아래 숫자는 정해 둔 규칙으로 돌린 시험입니다." });
  for (const [id, item] of Object.entries(PENDING_LAYER)) {
    const layer = layers[id];
    if (!isObj(layer) || layer.status !== "not_measured") continue;
    // 백엔드가 쉬운 말로 준 층 이름과 재지 못한 까닭이 있으면 그것을 쓴다
    const title = str(layer.title);
    const why = Array.isArray(layer.notMeasured) ? layer.notMeasured.map((note) => (typeof note === "string" ? plainNote(note) : null)).find(Boolean) : null;
    pending.push({ title: title && !JARGON.test(title) ? title : item.title, why: why ?? item.why });
  }
  const headline = headlineOf(run.headline, layers);
  const pass4 = headline.find((item) => item.key === "pass4");
  if (pass4 && pass4.verdict === "unmeasured") {
    pending.push({ title: "같은 시나리오를 여러 번 돌린 흔들림", why: `이번에는 시나리오마다 ${num(run.repeats) ?? 1}번만 돌렸습니다.` });
  }

  return {
    date,
    stale: isStale(date, num(run.staleAfterDays) ?? 30, today),
    // 모델을 연결하지 않은 판은 평가일과 같은 날짜를 되풀이하지 않는다
    aiVersion: isModel ? `AI 판 ${when}` : when === date ? "모델 연결 전 기본 규칙" : `모델 연결 전 기본 규칙 · ${when}`,
    isModel,
    split,
    repeats: num(run.repeats),
    reviewState: str(run.reviewState),
    scenarios: measured(layers.L4) ? num(perLayer.L4) : null,
    headline,
    layers: LAYERS.map((spec) => layerOf(spec, layers)).filter((item): item is TrustLayer => item !== null),
    pending,
    ciNote: str(run.ciNote) ? plainNote(str(run.ciNote) as string) : null,
    retired: retiredOf(raw.history, splitName),
  };
}
