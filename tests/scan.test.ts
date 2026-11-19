/**
 * 보관장 3D 스캔(src/lib/v3/scan.ts)의 순수 로직과 ScanView 계약(schema.ts).
 *  - tests/fixtures/v3-scan.json: 백엔드 devserver(backend work/scan a8a1eab, 가짜 재구성 서버)가 실제로 낸 목록.
 *    진행 중(scan_2)과 끝남(scan_1: 더미 다섯, 폐기물 셋 지정, 더미 2는 230 kg 계량, 더미 4는 미지정)
 *  - tests/fixtures/v3-scan-unassigned.json: 같은 스캔을 폐기물 지정 전에 본 뷰(정리안 없음)
 * 실행: node --test tests/scan.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { z } from "zod";
import {
  MAX_PHOTOS,
  MAX_VIDEO_FRAMES,
  MIN_VIDEO_FRAMES,
  QUALITY_STEPS,
  currentScan,
  encodePoints,
  fitSize,
  frameCount,
  frameTimes,
  insidePolygon,
  keptText,
  looksLikeScanList,
  looksLikeScanView,
  metricRows,
  nextQuality,
  parsePoints,
  pendingText,
  photoProblem,
  proposalSummary,
  showScanSection,
  spread,
  stepOf,
  stepStates,
  weighedValue,
  zoneOrder,
  zoneToken,
} from "../src/lib/v3/scan.ts";
import { scanListSchema, scanViewSchema } from "../src/lib/v3/schema.ts";

type List = z.infer<typeof scanListSchema>;

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as unknown;
const list = read("v3-scan.json") as List;
const unassigned = read("v3-scan-unassigned.json") as List["scans"][number];
const failed = { ...structuredClone(list.scans[0]), id: "scan_0", status: "failed" as const, progress: null, failure: { message: "바닥이 충분히 보이지 않아 더미를 나누지 못했습니다." } };

function problems(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  if (result.success) return [];
  return (result.error?.issues ?? []).slice(0, 20).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

test("스캔 목록 예시가 스키마에 맞는다", () => {
  assert.deepEqual(problems(scanListSchema.safeParse(list)), []);
  assert.deepEqual(problems(scanViewSchema.safeParse(unassigned)), []);
  assert.deepEqual(problems(scanViewSchema.safeParse(failed)), []);
});

test("계량한 더미는 계량값 그대로이고(하한 = 상한), 폐기물을 고르지 않은 더미는 무게를 산정 보류한다", () => {
  const done = list.scans.find((scan) => scan.status === "done")!;
  const weighed = done.piles.find((pile) => pile.weighedKg)!;
  assert.equal(weighed.weight?.low.value, weighed.weighedKg?.value);
  assert.equal(weighed.weight?.high.value, weighed.weighedKg?.value);
  assert.equal(weighed.density?.basis, "weighed");
  const none = done.piles.filter((pile) => !pile.streamId);
  assert.ok(none.length > 0);
  for (const pile of none) assert.equal(pile.weight, null);
  assert.equal(done.summary?.weightPending, none.length);
});

test("스키마는 모르는 필드를 받지 않는다(백엔드가 칸을 더하면 계약 시험이 알린다)", () => {
  const extra = structuredClone(list);
  (extra.scans[1] as Record<string, unknown>).unknownField = 1;
  assert.equal(scanListSchema.safeParse(extra).success, false);
});

test("장면 수는 영상 길이×2를 24~80으로 자른다", () => {
  assert.equal(frameCount(5), MIN_VIDEO_FRAMES);
  assert.equal(frameCount(20), 40);
  assert.equal(frameCount(30.4), 61);
  assert.equal(frameCount(600), MAX_VIDEO_FRAMES);
  assert.equal(frameCount(Number.NaN), MIN_VIDEO_FRAMES);
  assert.equal(frameCount(-3), MIN_VIDEO_FRAMES);
});

test("장면 시각은 구간 가운데라 0초와 끝을 피하고 고르게 늘어선다", () => {
  const times = frameTimes(40, 80);
  assert.equal(times.length, 80);
  assert.equal(times[0], 0.25);
  assert.equal(times[79], 39.75);
  for (let i = 1; i < times.length; i += 1) assert.ok(Math.abs(times[i] - times[i - 1] - 0.5) < 1e-9);
});

test("긴 변을 896px 이하로 줄이고 작은 사진은 키우지 않는다", () => {
  assert.deepEqual(fitSize(1920, 1080), { width: 896, height: 504 });
  assert.deepEqual(fitSize(1080, 1920), { width: 504, height: 896 });
  assert.deepEqual(fitSize(640, 480), { width: 640, height: 480 });
  assert.deepEqual(fitSize(0, 0), { width: 0, height: 0 });
});

test("사진이 많으면 찍은 순서를 지키며 고르게 고른다", () => {
  const items = Array.from({ length: 200 }, (_, i) => i);
  const chosen = spread(items, MAX_PHOTOS);
  assert.equal(chosen.length, MAX_PHOTOS);
  assert.deepEqual([...chosen].sort((a, b) => a - b), chosen);
  assert.equal(new Set(chosen).size, MAX_PHOTOS);
  assert.deepEqual(spread([1, 2, 3], 80), [1, 2, 3]);
});

test("사진이 12장보다 적으면 다시 고르라고 한다", () => {
  assert.match(photoProblem(5) ?? "", /12장 이상/);
  assert.equal(photoProblem(12), null);
});

test("합계가 넘치면 품질을 차례로 낮추고 더 낮출 수 없으면 null", () => {
  assert.equal(nextQuality(QUALITY_STEPS[0]), QUALITY_STEPS[1]);
  assert.equal(nextQuality(QUALITY_STEPS[QUALITY_STEPS.length - 1]), null);
});

test("점군 바이트를 mm 단위 int16에서 m로 읽는다", () => {
  const buffer = encodePoints([
    { x: 1.234, y: -2.5, z: 0.0004, r: 10, g: 20, b: 30, label: 0 },
    { x: -32.7, y: 0, z: 1.1, r: 255, g: 0, b: 128, label: 3 },
  ]);
  assert.equal(buffer.byteLength, 16 + 2 * 10);
  const cloud = parsePoints(buffer);
  assert.equal(cloud.count, 2);
  assert.deepEqual(Array.from(cloud.positions).map((v) => Math.round(v * 1000) / 1000), [1.234, -2.5, 0, -32.7, 0, 1.1]);
  assert.deepEqual(Array.from(cloud.colors), [10, 20, 30, 255, 0, 128]);
  assert.deepEqual(Array.from(cloud.labels), [0, 3]);
});

test("점군 형식이 틀리면 읽지 않는다", () => {
  assert.throws(() => parsePoints(new ArrayBuffer(4)), /짧/);
  const wrong = encodePoints([]);
  new DataView(wrong).setUint8(0, 0x58);
  assert.throws(() => parsePoints(wrong), /형식/);
  const cut = encodePoints([{ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, label: 0 }]).slice(0, 20);
  assert.throws(() => parsePoints(cut), /잘렸/);
  const version = encodePoints([]);
  new DataView(version).setUint32(4, 2, true);
  assert.throws(() => parsePoints(version), /판/);
});

test("서버 단계를 화면 단계 넷으로 옮긴다(기다리는 동안은 재구성)", () => {
  assert.equal(stepOf(null), "geometry");
  assert.equal(stepOf("geometry"), "geometry");
  assert.equal(stepOf("scale"), "scale");
  assert.equal(stepOf("floor"), "piles");
  assert.equal(stepOf("piles"), "piles");
  assert.deepEqual(
    stepStates("scale").map((step) => step.state),
    ["done", "done", "now", "waiting"],
  );
  assert.deepEqual(
    stepStates("frames").map((step) => step.label),
    ["장면 고르는 중", "3D로 재구성하는 중", "실제 크기 맞추는 중", "바닥과 더미 찾는 중"],
  );
});

test("분석을 받을 수 없고 스캔도 없으면 절을 그리지 않는다", () => {
  assert.equal(showScanSection(null), false);
  assert.equal(showScanSection({ canScan: false, scans: [] }), false);
  assert.equal(showScanSection({ canScan: true, scans: [] }), true);
  assert.equal(showScanSection({ canScan: false, scans: list.scans }), true);
});

test("진행 중인 스캔이 있으면 그것을, 없으면 가장 최근 것을 보인다", () => {
  assert.equal(currentScan(list)?.id, "scan_2");
  const finished = { canScan: true, scans: [failed, ...list.scans.filter((scan) => scan.status !== "processing")] };
  assert.equal(currentScan(finished)?.id, "scan_0");
  assert.equal(currentScan({ canScan: true, scans: [] }), null);
});

test("무게를 못 낸 더미를 폐기물 미지정과 계량값 필요로 나눠 알린다", () => {
  const done = list.scans.find((scan) => scan.id === "scan_1")!;
  assert.equal(pendingText(done), "1개는 폐기물 지정 필요");
  assert.equal(pendingText(unassigned), "더미마다 폐기물을 고르면 무게를 계산합니다");
  const needWeigh = structuredClone(done);
  needWeigh.piles[0].weight = null;
  assert.equal(pendingText(needWeigh), "1개는 폐기물 지정 필요 · 1개는 계량값 필요");
  const all = structuredClone(done);
  all.piles = all.piles.filter((pile) => pile.streamId);
  assert.equal(pendingText(all), null);
});

test("정리안 지표 표와 한 줄 요약(퍼진 넓이는 보이지 않고, 칸마다 계산 근거가 열린다)", () => {
  const done = list.scans.find((scan) => scan.id === "scan_1")!;
  const layout = done.layout!;
  const rows = metricRows(layout.current, layout.proposal!.metrics, layout.rules.gapM);
  assert.deepEqual(
    rows.map((row) => row.key),
    ["mixedPairs", "minMixedGapM", "weightedDistanceM"],
  );
  assert.equal(rows[0].label, "다른 폐기물과 1 m 안에 붙은 더미 쌍");
  assert.equal(rows[0].now.text, "4쌍");
  assert.equal(rows[0].next?.text, "0쌍");
  assert.equal(rows[1].now.text, "0 m");
  assert.equal(rows[1].next?.text, "1.05 m");
  assert.equal(rows[2].now.text, "3.7 m");
  for (const row of rows) {
    assert.ok(row.now.claim?.evidence[0]?.startsWith("calc:"), `${row.key} 지금 칸에 계산 근거가 없다`);
    assert.ok(row.next?.claim?.evidence[0]?.startsWith("calc:"), `${row.key} 정리안 칸에 계산 근거가 없다`);
  }
  assert.equal(rows[0].now.claim?.value, 4);
  assert.equal(metricRows(layout.current, null, 1)[0].next, null);
  // 간격을 잴 쌍이 없으면 "없음"이고 근거를 열지 않는다
  const lonely = structuredClone(layout.current);
  lonely.minMixedGapM = null;
  lonely.evidence.minMixedGapM = null;
  assert.deepEqual(metricRows(lonely, null, 1)[1].now, { text: "없음", claim: null });
  assert.equal(proposalSummary(done), "붙은 더미 4쌍 → 0쌍 · 상차 지점까지 평균 3.7 m → 2.77 m · 더미 4개 옮김");
  assert.equal(proposalSummary(unassigned), null);
  assert.equal(unassigned.layout?.unavailable, "더미에 폐기물을 두 가지 이상 지정하면 정리안을 그립니다.");
});

test("보인 바닥 넓이는 재구성 근거가 열리는 값이다", () => {
  const done = list.scans.find((scan) => scan.id === "scan_1")!;
  assert.equal(done.summary?.floorArea?.unit, "m²");
  assert.ok(done.summary?.floorArea?.evidence[0]?.startsWith("model:"));
});

test("정리안 색은 영역 순서를 따르고 여섯을 넘으면 되돌아간다", () => {
  const done = list.scans.find((scan) => scan.id === "scan_1")!;
  assert.deepEqual(zoneOrder(done), ["st_sprue", "st_defect", "st_film"]);
  assert.equal(zoneToken(0), "--color-chart-1");
  assert.equal(zoneToken(6), "--color-chart-1");
});

test("상차 지점은 바닥 다각형 안이어야 한다", () => {
  const floor = [
    [-4, -3],
    [4, -3],
    [4, 3],
    [-4, 3],
  ] as const;
  assert.equal(insidePolygon(0, 0, floor), true);
  assert.equal(insidePolygon(5, 0, floor), false);
  assert.equal(insidePolygon(0, -3.5, floor), false);
});

test("계량한 무게 입력은 0보다 크고 100,000 kg 이하인 숫자만 받는다", () => {
  assert.equal(weighedValue("480"), 480);
  assert.equal(weighedValue("1,250.5"), 1250.5);
  assert.equal(weighedValue("100000"), 100000);
  assert.equal(weighedValue("999999"), null);
  assert.equal(weighedValue(""), null);
  assert.equal(weighedValue("0"), null);
  assert.equal(weighedValue("-3"), null);
  assert.equal(weighedValue("많음"), null);
});

test("응답 최소 확인: 꼭 필요한 칸이 없으면 쓰지 않고, 모르는 칸이 더해져도 받는다", () => {
  assert.equal(looksLikeScanList(list), true);
  assert.equal(looksLikeScanList({}), false);
  assert.equal(looksLikeScanList({ canScan: true, scans: [{}] }), false);
  assert.equal(looksLikeScanView({}), false);
  assert.equal(looksLikeScanView(null), false);
  assert.equal(looksLikeScanView("{not json"), false);
  const done = list.scans.find((scan) => scan.status === "done")!;
  assert.equal(looksLikeScanView({ ...done, someNewField: 1 }), true);
  assert.equal(looksLikeScanView({ ...done, status: "weird" }), false);
  assert.equal(looksLikeScanView({ ...done, summary: null }), false);
  assert.equal(looksLikeScanView({ ...done, piles: "x" }), false);
  assert.equal(looksLikeScanView(unassigned), true);
});

test("옮길 자리가 없어 제자리에 둔 더미를 한 줄로 알리고, 그 폐기물에도 색을 준다", () => {
  const done = list.scans.find((scan) => scan.status === "done")!;
  assert.equal(keptText(done), null);
  const kept = structuredClone(done);
  const proposal = kept.layout!.proposal!;
  // 불량 사출품 더미(p3)를 제자리에 두고, 그 폐기물의 영역은 없다
  proposal.kept = ["p3"];
  proposal.zones = proposal.zones.filter((zone) => zone.streamId !== "st_defect");
  assert.equal(keptText(kept), "더미 3은 옮길 자리가 없어 제자리에 둡니다.");
  assert.ok(zoneOrder(kept).includes("st_defect"));
  assert.equal(zoneOrder(kept).at(-1), "st_defect");
  proposal.kept = ["p2", "p4"];
  assert.equal(keptText(kept), "더미 2·4는 옮길 자리가 없어 제자리에 둡니다.");
  proposal.kept = ["p2"];
  assert.equal(keptText(kept), "더미 2는 옮길 자리가 없어 제자리에 둡니다.");
});
