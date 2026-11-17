/**
 * AI 신뢰도 화면(/trust)의 데이터 풀이(src/lib/trust.ts). 백엔드 평가 결과(docs/v3/eval/latest.json)를 그대로 읽는다.
 * 실행: node --test tests/trust.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatValue, isStale, kindOf, plain, toTrustView } from "../src/lib/trust.ts";

const latest: unknown = JSON.parse(readFileSync(new URL("./fixtures/eval-latest.json", import.meta.url), "utf8"));
const TODAY = new Date("2026-11-20T00:00:00Z");

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
  assert.equal(view.aiVersion, "모델 연결 전 기본 규칙 · 2026-11-18");
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
  assert.equal(injection.verdict, "unmet", "목표 미달도 그대로 보인다");
});

test("층 다섯: 검색, 근거 있는 생성, 과업 성공, 협상, 안전. 층마다 주요 지표와 n·CI·목표", () => {
  const view = toTrustView(latest, TODAY)!;
  assert.deepEqual(view.layers.map((item) => item.title), ["검색", "근거 있는 생성", "과업 성공", "협상", "안전"]);
  const search = view.layers[0];
  assert.equal(search.size, "질의 80개");
  assert.equal(search.key?.label, "맞는 조항을 위쪽에 찾아 놓는 정도");
  assert.equal(search.key?.display, "0.48");
  assert.equal(search.key?.target, "목표 ≥ 0.75");
  assert.equal(search.key?.verdict, "unmet");
  assert.ok(search.key?.ci?.startsWith("95% 신뢰구간"));
  const safety = view.layers[4];
  assert.equal(safety.status, "partial");
  assert.equal(safety.size, "공격 60건 · 실행 31건");
  assert.equal(safety.key?.key, "asr_code_gated");
  assert.ok(safety.more.some((item) => item.key === "exposures" && item.display === "186건"));
  const negotiation = view.layers[3];
  assert.equal(negotiation.key?.label, "업체가 정한 범위를 지킨 비율");
  assert.equal(negotiation.key?.display, "100%");
  for (const layer of view.layers) assert.ok(layer.all.length > 0, layer.title);
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
  const text = JSON.stringify(view);
  for (const banned of [/[A-Z][A-Z0-9]*_[A-Z0-9_]{2,}/, /Prompt Shields/, /Azure/, /규칙 정책/, /\.py\b/, /backend/, /설정 없음/]) {
    assert.doesNotMatch(text, banned);
  }
  assert.equal(plain("S2 AI Search BM25 전문 검색: Azure AI Search 설정 없음(또는 V3_EVAL_L2_AZURE=1이 아님)"), null);
  assert.equal(plain("L5는 시험셋(test-v1)의 협상 30건으로만 잰다(평가 설계 9장)"), "L5는 시험셋(test-v1)의 협상 30건으로만 잰다");
});

test("오래된 결과, 값의 종류, 모양이 맞지 않는 응답", () => {
  assert.equal(isStale("2026-11-18", 30, new Date("2026-12-19T00:00:00Z")), true);
  assert.equal(isStale("2026-11-18", 30, new Date("2026-12-17T00:00:00Z")), false);
  assert.equal(toTrustView(latest, new Date("2027-01-01T00:00:00Z"))?.stale, true);
  assert.equal(kindOf("recall@10", "Recall@10"), "rate");
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
});
