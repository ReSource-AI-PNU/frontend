/**
 * AI 신뢰도 화면(/trust)이 읽는 평가 결과(GET /api/v3/trust, 백엔드 docs/v3/eval/latest.json)를 화면 모양으로 바꾼다.
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/trust.test.ts).
 *
 * 정직 규칙(평가 설계 17장)
 *  - 목표(target)는 결과가 아니다. 화면에는 늘 "목표"라는 낱말을 붙인다.
 *  - 목표 미달과 재지 못한 것도 그대로 보인다. 숫자를 지어내지 않고, 값이 없으면 "미측정"이다.
 *  - 모델을 연결하지 않은 실행(isModel: false)은 AI 모델의 성적처럼 보이지 않게 따로 밝힌다.
 *  - 평가일에서 staleAfterDays(기본 30일)가 지나면 "오래된 결과"를 붙인다.
 * 일반 사용자 화면이므로 모델 이름, 설정 이름, 파일 경로 같은 개발자 말은 걸러 낸다(DESIGN.md 제품 문구 원칙).
 */

type Json = Record<string, unknown>;
const isObj = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export type Verdict = "met" | "unmet" | "unmeasured" | "none";
export type MetricKind = "rate" | "count" | "seconds" | "score";

export type TrustMetric = {
  key: string;
  /** 쉬운 말 이름(주요 지표) 또는 걸러 낸 원래 이름 */
  label: string;
  /** 원래 지표 이름(상세 표에 작게) */
  name: string;
  value: number | null;
  /** 화면에 쓸 값. 값이 없으면 "미측정" */
  display: string;
  /** "95% 신뢰구간 97.1–100%" */
  ci: string | null;
  n: number | null;
  /** "목표 ≥ 80%" */
  target: string | null;
  verdict: Verdict;
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

export function kindOf(key: string, label: string): MetricKind {
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

/**
 * 원래 지표 이름이나 까닭에서 개발자 말을 걷어 낸다. 설정·파일·내부 코드가 들어간 문장은 통째로 빼고(null),
 * 서비스 이름은 하는 일로 바꾼다.
 */
export function plain(text: string): string | null {
  if (/[A-Z][A-Z0-9]*_[A-Z0-9_]+|\.py\b|\.json\b|tests\/|backend|resource-ai|설정 없음|환경 변수/.test(text)) return null;
  return text
    .replace(/Azure AI Search/g, "검색 서비스")
    .replace(/Prompt Shields/g, "입력 공격 탐지기")
    .replace(/규칙 정책/g, "모델을 연결하지 않은 기본 규칙")
    .replace(/\s*\((?:평가 설계 )?\d+장\)/g, "")
    .replace(/\(평가 설계 \d+장\)/g, "")
    .trim();
}

function metricOf(raw: unknown, label?: string): TrustMetric | null {
  if (!isObj(raw)) return null;
  const key = str(raw.key) ?? "";
  const name = str(raw.label) ?? key;
  const kind = kindOf(key, name);
  const value = num(raw.value);
  return {
    key,
    label: label ?? plain(name) ?? key,
    name: plain(name) ?? key,
    value,
    display: value === null ? "미측정" : formatValue(value, kind),
    ci: value === null ? null : formatCi(raw.ci, kind),
    n: num(raw.n),
    target: formatTarget(raw.target, kind),
    verdict: verdictOf(raw.verdict, value),
    smallSample: raw.smallSample === true,
  };
}

/* ── 층 ───────────────────────────────────────────────────────────── */

type LayerSpec = {
  id: string;
  /** 합쳐 보이는 원래 층(안전은 L6c·L6i) */
  sources: string[];
  title: string;
  explain: string;
  key: [string, string];
  more: [string, string][];
};

/** 공개 화면의 층 다섯 개와 층마다 앞에 둘 지표(쉬운 말 이름) */
export const LAYERS: LayerSpec[] = [
  {
    id: "L2",
    sources: ["L2"],
    title: "검색",
    explain: "질문에 맞는 법 조항과 근거 문서를 찾아 위쪽에 놓는지 잽니다. AI가 인용하는 조항은 여기서 찾은 것입니다.",
    key: ["ndcg@10", "맞는 조항을 위쪽에 찾아 놓는 정도"],
    more: [
      ["recall@10", "찾아야 할 조항이 상위 10개 안에 든 비율"],
      ["no_answer_accuracy", "답이 없는 질문에 없다고 답한 비율"],
    ],
  },
  {
    id: "L3",
    sources: ["L3"],
    title: "근거 있는 생성",
    explain: "AI가 쓴 글의 숫자와 조항이 근거와 맞는지 보내기 전에 검사합니다. 통과하지 못한 초안은 상대에게 나가지 않습니다.",
    key: ["firstTry", "첫 초안이 근거 확인을 통과한 비율"],
    more: [
      ["outgoingHallucination", "근거 없는 숫자가 상대에게 나간 횟수"],
      ["handoff", "끝내 통과하지 못해 담당자에게 넘긴 비율"],
    ],
  },
  {
    id: "L4",
    sources: ["L4"],
    title: "과업 성공",
    explain: "가상 시나리오마다 찾기를 끝까지 돌려, 끝난 모습(합의·거절·담당자 인계)이 기대와 같은지 봅니다.",
    key: ["pass^1", "찾기를 끝까지 맞게 마친 비율"],
    more: [
      ["violations", "하면 안 되는 일을 한 횟수"],
      ["requiredRecall", "꼭 물어야 할 것을 물은 비율"],
    ],
  },
  {
    id: "L5",
    sources: ["L5"],
    title: "협상",
    explain: "업체 측 AI가 업체가 정한 범위를 지키는지, 합의할 수 있는 대화는 합의하는지, 가장 좋은 조건에 가까운지 봅니다.",
    key: ["guardrailCompliance", "업체가 정한 범위를 지킨 비율"],
    more: [
      ["agreement", "합의할 수 있는 대화를 합의한 비율"],
      ["normalizedRegret", "가장 좋은 조건과의 차이(0이 가장 좋음)"],
    ],
  },
  {
    id: "L6",
    sources: ["L6i", "L6c"],
    title: "안전",
    explain: "문서에 숨긴 공격 문구가 AI를 움직이는지, 다른 회사의 정보가 새는지 봅니다.",
    key: ["asr_code_gated", "숨긴 공격 문구가 목표에 닿은 비율"],
    more: [
      ["exposures", "다른 회사에 보인 정보 건수"],
      ["pii_other_orgs", "다른 회사에 보인 개인정보 건수"],
    ],
  },
];

const UNITS: Record<string, string> = { 질의: "개", 시나리오: "건", 공격: "건", 실행: "건" };

function sizeOf(n: number | null, unit: string | null): string | null {
  if (n === null || n <= 0) return null;
  if (!unit || unit === "-") return `${n}건`;
  const word = unit.replace(/\(.*\)$/, "").trim();
  return `${word} ${trim(n, 0)}${UNITS[word] ?? "건"}`;
}

function layerOf(spec: LayerSpec, layers: Json): TrustLayer | null {
  const parts = spec.sources.map((id) => layers[id]).filter(isObj);
  if (parts.length === 0) return null;
  const metrics = parts.flatMap((part) => (Array.isArray(part.metrics) ? part.metrics : []));
  const find = (key: string, label: string) => metricOf(metrics.find((item) => isObj(item) && item.key === key), label);
  const statuses = parts.map((part) => str(part.status) ?? "not_measured");
  const status = statuses.every((item) => item === "not_measured")
    ? "not_measured"
    : statuses.every((item) => item === "measured")
      ? "measured"
      : "partial";
  const sizes = parts.map((part) => sizeOf(num(part.n), str(part.unit))).filter((item): item is string => Boolean(item));
  const all = metrics.map((item) => metricOf(item)).filter((item): item is TrustMetric => item !== null);
  const notes = parts
    .flatMap((part) => (Array.isArray(part.notMeasured) ? part.notMeasured : []))
    .map((item) => (typeof item === "string" ? plain(item) : null))
    .filter((item): item is string => Boolean(item));
  return {
    id: spec.id,
    title: spec.title,
    explain: spec.explain,
    status,
    size: sizes.length > 0 ? sizes.join(" · ") : null,
    key: find(...spec.key),
    more: spec.more.map(([key, label]) => find(key, label)).filter((item): item is TrustMetric => item !== null),
    all,
    notes,
  };
}

/* ── 머리 ─────────────────────────────────────────────────────────── */

const HEADLINE: [string, string][] = [
  ["pass1", "찾기를 끝까지 맞게 마친 비율"],
  ["pass4", "같은 시나리오를 네 번 돌려 네 번 모두 맞은 비율"],
  ["outgoingHallucination", "근거 없는 숫자가 상대에게 나간 횟수"],
  ["injectionGated", "숨긴 공격 문구가 목표에 닿은 비율"],
];

function headlineOf(raw: unknown): TrustMetric[] {
  if (!isObj(raw)) return [];
  return HEADLINE.flatMap(([key, label]) => {
    const item = raw[key];
    if (!isObj(item)) return [];
    const metric = metricOf({ ...item, key }, label);
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

/**
 * 평가 결과를 화면 모양으로. 모양이 맞지 않으면 null(화면은 "불러오지 못했습니다"를 보인다).
 * 응답이 latest.json 전체({primary, runs})이면 primary 실행을, 실행 하나만 오면 그것을 쓴다.
 */
export function toTrustView(raw: unknown, today: Date = new Date()): TrustView | null {
  if (!isObj(raw)) return null;
  let run: Json | null = null;
  if (isObj(raw.runs)) {
    const runs = raw.runs;
    const primary = str(raw.primary);
    run = (primary && isObj(runs[primary]) ? runs[primary] : Object.values(runs).find(isObj)) ?? null;
  } else if (isObj(raw.layers)) {
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
    if (isObj(layer) && layer.status === "not_measured") pending.push(item);
  }
  const headline = headlineOf(run.headline);
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
    scenarios: num(perLayer.L4),
    headline,
    layers: LAYERS.map((spec) => layerOf(spec, layers)).filter((item): item is TrustLayer => item !== null),
    pending,
  };
}
