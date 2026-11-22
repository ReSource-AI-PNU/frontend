/**
 * 자원순환 효과(src/lib/v3/circular.ts). 실제 백엔드가 낸 결과의 circular(tests/fixtures/v3-circular.json)로 본다.
 * 실행: node --test tests/circular.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CIRCULAR_METRICS,
  DISCLAIMER,
  LANDFILL_NOTE,
  baselineSummary,
  bundleSentence,
  metricText,
  metricRangeText,
  scenarioOf,
  totalStatusText,
} from "../src/lib/v3/circular.ts";
import { circularSchema } from "../src/lib/v3/schema.ts";
import type { Claim, ViewStream } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|Foundry|Ollama|규칙 정책|연결되지 않았습니다|예시 데이터|claim|null|undefined/;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/v3-circular.json", import.meta.url), "utf8")) as {
  streams: ViewStream[];
  circular: unknown;
};
// 화면 스키마(엄격)로 읽힌다
const circular = circularSchema.parse(fixture.circular);
const view = { streams: fixture.streams };

const claim = (value: number, unit: string): Claim => ({ id: "x", kind: "number", value, unit, evidence: ["calc:x"] });

test("시연 결과에 네 시나리오가 A·B·C·D 순서로 오고, C는 감축량 0의 기준선이다", () => {
  assert.ok(circular);
  assert.deepEqual(
    circular.scenarios.map((item) => item.id),
    ["A", "B", "C", "D"],
  );
  const c = scenarioOf(circular, "C");
  for (const metric of CIRCULAR_METRICS) assert.equal(c?.totals[metric]?.status, "zero");
  // 감축량 0이어도 지금 처리 단계 배출은 0이 아니다
  assert.ok(typeof c?.baselineEmission?.value === "number" && c.baselineEmission.value > 0);
  assert.equal(baselineSummary(circular), "소각 4가지");
});

test("산정 보류는 0으로 바꾸지 않고, 부분합이면 산정한 물량과 보류 물량을 함께 낸다", () => {
  const a = scenarioOf(circular!, "A")!;
  const ghg = a.totals.ghg!;
  assert.equal(ghg.status, "partial");
  assert.ok(ghg.total && ghg.countedKg && ghg.heldKg);
  const held = a.rows.filter((row) => row.ghg.status === "hold");
  assert.ok(held.length > 0);
  for (const row of held) {
    assert.equal(row.ghg.value, null, "보류는 값이 없다");
    assert.ok(row.ghg.reason.length > 0, "보류 사유가 있다");
  }
  // 부분합 = 산정한 폐기물 값의 합
  const sum = a.rows.reduce((acc, row) => acc + (typeof row.ghg.value?.value === "number" ? row.ghg.value.value : 0), 0);
  assert.ok(Math.abs(sum - (ghg.total!.value as number)) < 1e-6);
  // 보류 물량 + 산정 물량 = 전체 물량
  const all = view.streams.reduce((acc, s) => acc + (typeof s.monthlyKg?.value === "number" ? s.monthlyKg.value : 0), 0);
  assert.equal((ghg.countedKg!.value as number) + (ghg.heldKg!.value as number), all);
});

test("공정 스크랩(PIR)과 섞인 재질(열분해)에는 문헌값을 쓰지 않는다", () => {
  const a = scenarioOf(circular!, "A")!;
  for (const row of a.rows) {
    const stream = view.streams.find((s) => s.id === row.streamId)!;
    if (stream.origin === "PIR" || String(stream.material).includes("+")) {
      for (const metric of CIRCULAR_METRICS) assert.notEqual(row[metric].method, "literature", `${row.streamName} ${metric}`);
    }
  }
  const purge = a.rows.find((row) => row.route === "pyrolysis");
  assert.ok(purge && CIRCULAR_METRICS.every((metric) => purge[metric].status === "hold"));
});

test("LDPE 재활용 에너지 값은 원문에 없어(NA) 다른 재질 값으로 채우지 않는다", () => {
  const film = scenarioOf(circular!, "A")!.rows.find((row) => row.streamId === "st_film")!;
  assert.equal(film.ghg.method, "literature");
  assert.equal(film.energy.status, "hold");
  assert.match(film.energy.reason, /NA/);
  // 신재 대체량 = 300kg × 선별 73% × 재활용 84% × 대체율 0.75
  assert.ok(Math.abs((film.virgin.value!.value as number) - 300 * 0.73 * 0.84 * 0.75) < 1e-6);
  // 감축량 = 0.3t × 1.381 tCO2e/t (JRC Annex 5 (B) LDPE)
  assert.ok(Math.abs((film.ghg.value!.value as number) - 0.3 * 1.381) < 1e-6);
});

test("매립(D)은 원료 회수가 없어 신재 대체가 없고, 소각 전력 회수를 잃어 에너지는 더 쓴다", () => {
  const d = scenarioOf(circular!, "D")!;
  assert.equal(d.totals.virgin?.status, "zero");
  const energy = d.totals.energy?.total?.value;
  assert.ok(typeof energy === "number" && energy < 0);
  assert.equal(d.money, null);
  assert.match(LANDFILL_NOTE, /추천하지 않습니다/);
});

test("값 글: 감축은 양수, 늘어남은 낱말로 밝히고, 작은 탄소는 kg으로 적는다", () => {
  assert.equal(metricText("ghg", claim(0.4143, "tCO2e/월")), "0.41 tCO2e/월");
  assert.equal(metricText("ghg", claim(0.042, "tCO2e/월")), "42 kgCO2e/월");
  assert.equal(metricText("ghg", claim(-0.62, "tCO2e/월")), "0.62 tCO2e/월 늘어남");
  assert.equal(metricText("energy", claim(-6.625611, "GJ/월")), "6.6 GJ/월 더 씀");
  assert.equal(metricText("virgin", claim(137.97, "kg/월")), "138 kg/월");
  assert.equal(metricText("virgin", null), null);
  assert.equal(totalStatusText(undefined), "계산하지 않음");
});

test("PET 등급별 추정 범위를 한 단위로 표시한다", () => {
  assert.equal(metricRangeText("ghg", claim(0.886, "tCO2e/월"), claim(1.2588, "tCO2e/월")), "0.89~1.26 tCO2e/월");
  assert.equal(metricRangeText("virgin", claim(140, "kg/월")), "140 kg/월");
});

test("화면 문장에 개발자 말이 없다", () => {
  const texts = [DISCLAIMER, LANDFILL_NOTE, bundleSentence(circular!)];
  for (const scene of circular!.scenarios) {
    for (const row of scene.rows) {
      texts.push(row.explain.effect, row.explain.why, row.explain.conditions, row.explain.basis, ...row.unconfirmed);
      for (const metric of CIRCULAR_METRICS) texts.push(row[metric].reason);
    }
  }
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
});
