/**
 * AI 신뢰도 화면(/trust)의 데이터 풀이(src/lib/trust.ts). 백엔드 평가 결과(docs/v3/eval/latest.json)를 그대로 읽는다.
 * 실행: node --test tests/trust.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FLAT_INTERVAL_NOTE,
  JARGON,
  LAYERS,
  METRICS,
  SMALL_SAMPLE,
  formatValue,
  intervalNoteOf,
  isStale,
  kindOf,
  plain,
  plainNote,
  toTrustView,
  type TrustView,
} from "../src/lib/trust.ts";

const latest: unknown = JSON.parse(readFileSync(new URL("./fixtures/eval-latest.json", import.meta.url), "utf8"));
const TODAY = new Date("2026-11-20T00:00:00Z");

type Metric = Record<string, unknown>;
type Layer = { status?: string; metrics: Metric[]; notMeasured?: string[] } & Record<string, unknown>;
type Run = { current?: boolean; layers: Record<string, Layer> } & Record<string, unknown>;
type Latest = { primary: string; runs: Record<string, Run>; history: Record<string, unknown>[] };
const clone = (): Latest => structuredClone(latest) as Latest;

/** 화면에 보이는 글(지표 이름, 설명, 메모, 아직 재지 못한 것) */
function shownText(view: TrustView): string[] {
  const metrics = [...view.headline, ...view.layers.flatMap((layer) => [...layer.all, ...(layer.key ? [layer.key] : []), ...layer.more])];
  return [
    ...metrics.flatMap((metric) => [metric.label, metric.explain ?? "", metric.ci ?? "", metric.intervalNote ?? "", metric.target ?? ""]),
    ...view.layers.flatMap((layer) => [layer.title, layer.explain, layer.size ?? "", ...layer.notes]),
    ...view.pending.flatMap((item) => [item.title, item.why]),
    ...view.retired.map((item) => item.reason),
    view.aiVersion,
  ];
}

test("primary 실행(시험셋)을 고르고 머리에 평가일·판·규모를 적는다", () => {
  const view = toTrustView(latest, TODAY);
  assert.ok(view);
  assert.equal(view.date, "2026-11-18");
  assert.equal(view.split, "시험셋 test-v1");
  assert.equal(view.scenarios, 70);
  assert.equal(view.repeats, 1);
  assert.equal(view.stale, false);
  assert.equal(view.isModel, false);
  // 모델을 연결하지 않은 실행은 AI 판처럼 보이지 않고, 개발자 말(규칙 정책)을 쓰지 않는다
  assert.equal(view.aiVersion, "모델 연결 전 기본 규칙");
  assert.ok(view.pending.some((item) => item.title === "실제 AI 모델로 돌린 결과"));
});

test("큰 숫자 네 칸: 성공률(CI·n·목표), 네 번 모두, 근거 없는 숫자, 공격", () => {
  const view = toTrustView(latest, TODAY)!;
  assert.deepEqual(view.headline.map((item) => item.key), ["pass1", "pass4", "outgoingHallucination", "injectionGated"]);
  const [pass1, pass4, hallucination, injection] = view.headline;
  assert.equal(pass1.display, "98.6%");
  assert.match(pass1.ci ?? "", /^95% 신뢰구간 \d/);
  assert.equal(pass1.n, 70);
  assert.equal(pass1.target, "목표 ≥ 80%");
  assert.equal(pass1.verdict, "met");
  assert.equal(pass4.display, "미측정");
  assert.equal(pass4.verdict, "unmeasured");
  assert.equal(pass4.ci, null);
  assert.equal(hallucination.display, "0건");
  assert.equal(hallucination.target, "목표 = 0건");
  assert.equal(injection.label, "숨긴 공격 문구가 목표에 닿은 비율");
  // 비율 구간은 백엔드가 준 Wilson 구간 그대로
  assert.equal(pass1.ciMethod, "wilson");
  assert.equal(pass1.ci, "95% 신뢰구간 92.3–99.7%");
  for (const metric of view.headline) assert.ok(metric.explain, `${metric.key}에 한 줄 설명이 있다`);
});

test("층 다섯: 백엔드의 쉬운 층 이름(title·explain)과 합친 안전 층. 층마다 주요 지표와 n·CI·목표", () => {
  const view = toTrustView(latest, TODAY)!;
  assert.deepEqual(view.layers.map((item) => item.title), ["근거 찾기", "근거 있는 글쓰기", "찾기를 끝까지 해내기", "조건 맞추기", "안전"]);
  assert.equal(view.layers[0].explain, "질문에 맞는 법 조항과 근거 문서를 찾아 위쪽에 놓는지 봅니다.");
  const search = view.layers[0];
  assert.equal(search.size, "질문 80개");
  assert.equal(search.key?.label, "맞는 조항을 위쪽에 찾아 놓는 정도");
  assert.equal(search.key?.display, "0.62");
  assert.equal(search.key?.target, "목표 ≥ 0.75");
  assert.equal(search.key?.verdict, "unmet", "목표 미달도 그대로 보인다");
  assert.ok(search.key?.ci?.startsWith("95% 신뢰구간"));
  const safety = view.layers[4];
  assert.equal(safety.status, "partial");
  assert.equal(safety.size, "공격 60건 · 실행 31건");
  assert.equal(safety.key?.key, "asr_code_gated");
  assert.ok(safety.more.some((item) => item.key === "exposures" && item.display === "0건"));
  const negotiation = view.layers[3];
  assert.equal(negotiation.key?.label, "업체가 정한 범위를 지킨 비율");
  assert.equal(negotiation.key?.display, "100%");
  // 이름은 백엔드의 쉬운 이름(label)을 쓴다(기술 이름 technicalLabel은 쓰지 않는다)
  assert.equal(search.all.find((item) => item.key === "recall@5")?.label, "찾아야 할 조항이 상위 5개 안에 든 비율");
  // 같은 키(handoffs)라도 층마다 설명을 따로 고른다
  assert.match(view.layers[2].all.find((item) => item.key === "handoffs")?.explain ?? "", /찾기 한 번에/);
  assert.match(negotiation.all.find((item) => item.key === "handoffs")?.explain ?? "", /시나리오 하나에서/);
  for (const layer of view.layers) assert.ok(layer.all.length > 0, layer.title);
});

test("모든 지표에 쉬운 이름과 한 줄 설명이 있고, 평가 용어(ASR, 카나리아, 탐침, nDCG…)가 화면에 없다", () => {
  const view = toTrustView(latest, TODAY)!;
  for (const layer of view.layers) {
    for (const metric of layer.all) {
      assert.ok(metric.explain, `${layer.title} · ${metric.key}에 설명이 없다`);
      assert.ok(/[.]$/.test(metric.explain ?? ""), `${metric.key} 설명은 한 문장으로 끝난다`);
    }
  }
  const hits = shownText(view).filter((text) => JARGON.test(text));
  assert.deepEqual(hits, []);
  for (const key of ["asr_code_gated", "exposures", "probeClean", "pii_control_false_hits", "shields_detect", "benign_utility"]) {
    assert.doesNotMatch(METRICS[key].label, JARGON, key);
  }
  // 층 앞에 두는 지표는 모두 이름표에 있다
  for (const spec of LAYERS) for (const key of [spec.key, ...spec.more]) assert.ok(METRICS[key], key);
  // 재지 못한 까닭: 백엔드의 쉬운 문장(notMeasured)을 그대로 쓰고, 기술 메모(notMeasuredTechnical)는 쓰지 않는다
  const safety = view.layers[4];
  assert.ok(safety.notes.includes("문서 글을 AI 입력과 구분해 넣는 조건: 문서 글이 AI 입력에 들어가지 않아 해당하지 않습니다."));
  assert.ok(safety.notes.every((note) => !/조건 \(|spotlighting|Shields|AZURE/.test(note)));
  // 백엔드 explain의 척도 안내("0에서 1 사이 비율입니다")는 백분율로 적는 값과 맞지 않아 쓰지 않는다
  assert.ok(view.layers.flatMap((layer) => layer.all).every((metric) => !/0에서 1 사이 비율/.test(metric.explain ?? "")));
});

test("비율 지표의 표본이 30보다 적으면 표시하고, 구간은 받은 그대로 적는다", () => {
  const view = toTrustView(latest, TODAY)!;
  const search = view.layers[0];
  const noAnswer = search.all.find((item) => item.key === "no_answer_accuracy")!;
  assert.equal(noAnswer.n, 14);
  assert.ok(noAnswer.n! < SMALL_SAMPLE);
  assert.equal(noAnswer.smallSample, true);
  assert.equal(noAnswer.ci, "95% 신뢰구간 45.4–88.3%");
  assert.equal(noAnswer.ciMethod, "wilson");
  assert.equal(search.key?.smallSample, false, "n=66");
  // 건수 지표는 구간이 없으므로 표시하지 않는다
  const safety = view.layers[4];
  assert.equal(safety.all.find((item) => item.key === "baseExposures")?.smallSample, false);
  // Wilson 구간으로 바뀌어도 받은 값을 그대로 적는다
  const raw = clone();
  const metric = raw.runs.test.layers.L2.metrics.find((item: Metric) => item.key === "no_answer_accuracy")!;
  metric.ci = [0.4535, 0.8828];
  metric.ciMethod = "wilson";
  const wilson = toTrustView(raw, TODAY)!.layers[0].all.find((item) => item.key === "no_answer_accuracy");
  assert.equal(wilson?.ci, "95% 신뢰구간 45.4–88.3%");
});

test("지난 결과(history, current: false)는 지금 결과로 보이지 않고, 내렸다는 사실과 까닭만 적는다", () => {
  const raw = clone();
  assert.ok(raw.history.length > 0);
  const view = toTrustView(raw, TODAY)!;
  // history의 지난 노출 186건은 어디에도 지금 값으로 나오지 않는다
  const exposures = view.layers[4].all.find((item) => item.key === "exposures");
  assert.equal(exposures?.display, "0건");
  assert.equal(JSON.stringify(view).includes("186"), false);
  assert.equal(view.retired.length, 1, "같은 평가셋의 지난 결과만, 한 번씩");
  assert.match(view.retired[0].reason, /고치기 전 코드로 잰 결과입니다/);
  assert.match(view.ciNote ?? "", /Wilson/);
  // 실행에 current: false가 붙으면 그 실행을 고르지 않는다
  const runs = clone();
  runs.runs.test.current = false;
  assert.equal(toTrustView(runs, TODAY)?.split, "개발셋");
});

test("이번 실행이 재지 않은 층의 머리 숫자는 보이지 않는다", () => {
  const raw = clone();
  raw.runs.test.layers.L6i.status = "not_measured";
  raw.runs.test.layers.L6i.metrics = [];
  const view = toTrustView(raw, TODAY)!;
  assert.equal(view.headline.some((item) => item.key === "injectionGated"), false);
  // 개발셋에는 협상이 없다
  const dev = clone();
  dev.primary = "dev";
  const devView = toTrustView(dev, TODAY)!;
  assert.equal(devView.layers.find((item) => item.id === "L5")?.all.length, 0);
  assert.ok(devView.pending.some((item) => item.title === "조건 맞추기"));
});

test("아직 재지 못한 것: 현장 사진, 사람 평가, 여러 번 돌린 흔들림", () => {
  const view = toTrustView(latest, TODAY)!;
  const titles = view.pending.map((item) => item.title);
  assert.ok(titles.includes("사진 인식"));
  assert.ok(titles.includes("사람이 읽고 매긴 평가"));
  assert.ok(titles.includes("같은 시나리오를 여러 번 돌린 흔들림"));
});

test("일반 사용자 화면에 개발자 말(설정 이름, 파일, 서비스 이름, 규칙 정책)이 나가지 않는다", () => {
  const view = toTrustView(latest, TODAY)!;
  const text = shownText(view).join("\n");
  for (const banned of [/[A-Z][A-Z0-9]*_[A-Z0-9_]{2,}/, /Prompt Shields/, /Azure/, /규칙 정책/, /\.py\b/, /backend/, /설정 없음/]) {
    assert.doesNotMatch(text, banned);
  }
  assert.equal(plain("S2 AI Search BM25 전문 검색: Azure AI Search 설정 없음(또는 V3_EVAL_L2_AZURE=1이 아님)"), null);
  assert.equal(plainNote("L5는 시험셋(test-v1)의 협상 30건으로만 잰다(평가 설계 9장)"), "협상은 공개 시험셋으로만 잽니다.");
  assert.equal(plain("표적 ASR G7 새 공격"), "공격이 통한 비율 G7 새 공격");
  assert.equal(plain("정상 효용(정상 쌍둥이의 L4 성공률)"), "정상 효용(정상 쌍둥이의 성공률)");
});

test("오래된 결과, 값의 종류, 모양이 맞지 않는 응답", () => {
  assert.equal(isStale("2026-11-18", 30, new Date("2026-12-19T00:00:00Z")), true);
  assert.equal(isStale("2026-11-18", 30, new Date("2026-12-17T00:00:00Z")), false);
  assert.equal(toTrustView(latest, new Date("2027-01-01T00:00:00Z"))?.stale, true);
  assert.equal(kindOf("recall@10", "Recall@10"), "rate");
  assert.equal(kindOf("variantConsistency", "변형 일관성"), "rate");
  assert.equal(kindOf("exposures", "조직 간 노출 건수(카나리아·값)"), "count");
  assert.equal(kindOf("ndcg@10", "nDCG@10"), "score");
  assert.equal(formatValue(0.9857, "rate"), "98.6%");
  assert.equal(formatValue(0.033, "seconds"), "0.03초");
  for (const bad of [null, "x", {}, { runs: {} }, { runs: { test: { layers: {} } } }]) assert.equal(toTrustView(bad, TODAY), null);
  // 실행 하나만 와도 읽는다. 모델을 연결한 실행은 AI 판(평가일)으로 적고 모델 이름은 쓰지 않는다
  const raw = latest as { runs: { test: Record<string, unknown> } };
  const modelRun = { ...raw.runs.test, isModel: true, aiVersion: "gpt-5-mini · 2026-11-18" };
  const single = toTrustView(modelRun, TODAY);
  assert.equal(single?.aiVersion, "AI 판 2026-11-18");
  assert.equal(single?.pending.some((item) => item.title === "실제 AI 모델로 돌린 결과"), false);
  // 표에 없는 지표는 백엔드가 준 쉬운 이름과 설명을 쓴다. 예전 모양(label이 기술 이름)이면 걸러 낸다
  const extra = clone();
  extra.runs.test.layers.L2.metrics.push({ key: "brand_new", label: "찾아야 할 조항이 위쪽 20개 안에 든 비율", technicalLabel: "Recall@20", explain: "1이면 모두 찾았습니다.", value: 0.7, n: 66, ci: null, target: null, verdict: "-" });
  extra.runs.test.layers.L2.metrics.push({ key: "old_shape", label: "표적 ASR G9", value: 0, n: 66, ci: null, target: null, verdict: "-" });
  const all = toTrustView(extra, TODAY)!.layers[0].all;
  const added = all.find((item) => item.key === "brand_new");
  assert.equal(added?.label, "찾아야 할 조항이 위쪽 20개 안에 든 비율");
  assert.equal(added?.explain, "1이면 모두 찾았습니다.");
  assert.doesNotMatch(all.find((item) => item.key === "old_shape")?.label ?? "", JARGON);
});

test("구간의 아래·위가 같으면(예: n=25 모두 0) 맨 '0–0' 대신 까닭을 한 줄로 적는다", () => {
  const view = toTrustView(latest, TODAY)!;
  const negotiation = view.layers.find((layer) => layer.id === "L5")!;
  const regret = negotiation.all.find((item) => item.key === "normalizedRegret")!;
  assert.equal(regret.n, 25);
  assert.equal(regret.display, "0");
  assert.equal(regret.ci, null, "0–0을 적지 않는다");
  assert.equal(regret.intervalNote, FLAT_INTERVAL_NOTE);
  assert.equal(regret.intervalNote, "모든 사례에서 같은 값이 나와 구간의 폭이 0입니다");
  // 화면 어디에도 아래·위가 같은 구간이 그대로 나가지 않는다
  const all = view.layers.flatMap((layer) => [...layer.all, ...(layer.key ? [layer.key] : []), ...layer.more]);
  for (const metric of [...view.headline, ...all]) assert.doesNotMatch(metric.ci ?? "", /(?<![\d.])(\d+(?:\.\d+)?)%?–\1%?$/, metric.key);
  // 폭이 있는 구간에는 붙이지 않는다
  const search = view.layers[0].key!;
  assert.ok(search.ci);
  assert.equal(search.intervalNote, null);
  // 비율·건수·점수 모두 같은 규칙. 구간이 없거나 모양이 틀리면 아무것도 적지 않는다
  assert.equal(intervalNoteOf([1, 1]), FLAT_INTERVAL_NOTE);
  assert.equal(intervalNoteOf([0.2, 0.2]), FLAT_INTERVAL_NOTE);
  assert.equal(intervalNoteOf([0, 0.1]), null);
  assert.equal(intervalNoteOf(null), null);
  assert.equal(intervalNoteOf([0]), null);
  // 값이 없으면(미측정) 구간 말도 없다
  const raw = clone();
  const metric = raw.runs.test.layers.L5.metrics.find((item: Metric) => item.key === "normalizedRegret")!;
  metric.value = null;
  const unmeasured = toTrustView(raw, TODAY)!.layers.find((layer) => layer.id === "L5")!.all.find((item) => item.key === "normalizedRegret")!;
  assert.equal(unmeasured.intervalNote, null);
});
