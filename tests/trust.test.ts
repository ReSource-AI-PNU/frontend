/**
 * AI 신뢰도 화면(/trust)의 데이터 풀이(src/lib/trust.ts). 백엔드 평가 결과(docs/v3/eval/latest.json)를 그대로 읽는다.
 * 실행: node --test tests/trust.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JARGON, LAYERS, METRICS, SMALL_SAMPLE, formatValue, isStale, isSuperseded, kindOf, plain, plainNote, toTrustView, type TrustView } from "../src/lib/trust.ts";

const latest: unknown = JSON.parse(readFileSync(new URL("./fixtures/eval-latest.json", import.meta.url), "utf8"));
const TODAY = new Date("2026-11-20T00:00:00Z");

type Metric = Record<string, unknown>;
type Layer = { status?: string; metrics: Metric[]; supersededBy?: string } & Record<string, unknown>;
type Run = { superseded?: unknown; layers: Record<string, Layer> } & Record<string, unknown>;
type Latest = { primary: string; runs: Record<string, Run> };
const clone = (): Latest => structuredClone(latest) as Latest;

/** 화면에 보이는 글(지표 이름, 설명, 메모, 아직 재지 못한 것) */
function shownText(view: TrustView): string[] {
  const metrics = [...view.headline, ...view.layers.flatMap((layer) => [...layer.all, ...(layer.key ? [layer.key] : []), ...layer.more])];
  return [
    ...metrics.flatMap((metric) => [metric.label, metric.explain ?? "", metric.ci ?? "", metric.target ?? ""]),
    ...view.layers.flatMap((layer) => [layer.title, layer.explain, layer.size ?? "", ...layer.notes]),
    ...view.pending.flatMap((item) => [item.title, item.why]),
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
  for (const metric of view.headline) assert.ok(metric.explain, `${metric.key}에 한 줄 설명이 있다`);
});

test("층 다섯: 검색, 근거 있는 생성, 과업 성공, 협상, 안전. 층마다 주요 지표와 n·CI·목표", () => {
  const view = toTrustView(latest, TODAY)!;
  assert.deepEqual(view.layers.map((item) => item.title), ["검색", "근거 있는 생성", "과업 성공", "협상", "안전"]);
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
  // 같은 키(handoffs)라도 층마다 이름을 따로 고른다
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
  // 재지 못한 까닭: 조건 (iii)·spotlighting 같은 말 없이 쉬운 문장으로
  const safety = view.layers[4];
  assert.ok(safety.notes.some((note) => note.startsWith("문서 글을 따로 표시해")));
  assert.ok(safety.notes.every((note) => !/조건 \(|spotlighting|Shields|AZURE/.test(note)));
});

test("비율 지표의 표본이 30보다 적으면 표시하고, 구간은 받은 그대로 적는다", () => {
  const view = toTrustView(latest, TODAY)!;
  const search = view.layers[0];
  const noAnswer = search.all.find((item) => item.key === "no_answer_accuracy")!;
  assert.equal(noAnswer.n, 14);
  assert.ok(noAnswer.n! < SMALL_SAMPLE);
  assert.equal(noAnswer.smallSample, true);
  assert.equal(noAnswer.ci, "95% 신뢰구간 50–92.9%");
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

test("지난 실행의 숫자는 지금 결과처럼 보이지 않는다", () => {
  assert.equal(isSuperseded({ superseded: true }), true);
  assert.equal(isSuperseded({ supersededBy: "2026-11-19-test" }), true);
  assert.equal(isSuperseded({ current: false }), true);
  assert.equal(isSuperseded({ status: "measured" }), false);

  // 지표 하나가 지난 값으로 표시됨 → 표와 앞자리에서 뺀다
  const raw = clone();
  const exposures = raw.runs.test.layers.L6c.metrics.find((item: Metric) => item.key === "exposures")!;
  exposures.superseded = true;
  const view = toTrustView(raw, TODAY)!;
  const safety = view.layers[4];
  assert.equal(safety.all.some((item) => item.key === "exposures"), false);
  assert.equal(safety.more.some((item) => item.key === "exposures"), false);

  // 실행 전체에 지난 값 목록이 오면 그 키를 뺀다
  const listed = clone();
  listed.runs.test.superseded = ["L2:ndcg@10", "injectionGated"];
  const listedView = toTrustView(listed, TODAY)!;
  assert.equal(listedView.layers[0].key, null);
  assert.equal(listedView.headline.some((item) => item.key === "injectionGated"), false);

  // 층 전체가 지난 값 → 숫자를 내리고 재지 못한 것에 적는다
  const layer = clone();
  layer.runs.test.layers.L6c.supersededBy = "다음 평가";
  const layerView = toTrustView(layer, TODAY)!;
  const safe = layerView.layers[4];
  assert.equal(safe.all.some((item) => ["exposures", "probeClean"].includes(item.key)), false);
  assert.equal(safe.size, "공격 60건");
  assert.ok(safe.notes.some((note) => note.includes("지난 평가의 숫자")));
  assert.ok(layerView.pending.some((item) => item.title === "회사 사이의 정보 노출"));

  // primary 실행이 지난 실행이면 지난 값으로 표시되지 않은 실행을 쓴다
  const runs = clone();
  runs.runs.test.superseded = true;
  assert.equal(toTrustView(runs, TODAY)?.split, "개발셋");
});

test("이번 실행이 재지 않은 층의 머리 숫자는 보이지 않는다", () => {
  const raw = clone();
  raw.runs.test.layers.L6i.status = "not_measured";
  raw.runs.test.layers.L6i.metrics = [];
  const view = toTrustView(raw, TODAY)!;
  assert.equal(view.headline.some((item) => item.key === "injectionGated"), false);
  // 개발셋에는 협상·노출이 없고 머리 숫자에도 없다
  const dev = clone();
  dev.primary = "dev";
  const devView = toTrustView(dev, TODAY)!;
  assert.equal(devView.layers.find((item) => item.id === "L5")?.all.length, 0);
  assert.ok(devView.pending.some((item) => item.title === "협상 품질"));
});

test("아직 재지 못한 것: 현장 사진, 사람 평가, 여러 번 돌린 흔들림", () => {
  const view = toTrustView(latest, TODAY)!;
  const titles = view.pending.map((item) => item.title);
  assert.ok(titles.includes("현장 사진으로 본 인식 정확도"));
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
  // 표에 없는 지표는 백엔드가 준 쉬운 이름을 쓴다
  const extra = clone();
  extra.runs.test.layers.L2.metrics.push({ key: "brand_new", label: "Recall@20", plainLabel: "찾아야 할 조항이 위쪽 20개 안에 든 비율", value: 0.7, n: 66, ci: null, target: null, verdict: "-" });
  const added = toTrustView(extra, TODAY)!.layers[0].all.find((item) => item.key === "brand_new");
  assert.equal(added?.label, "찾아야 할 조항이 위쪽 20개 안에 든 비율");
});
