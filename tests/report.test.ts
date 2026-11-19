/**
 * 실적 리포트(src/lib/v3/report.ts): 기간, 문구, CSV. 실제 백엔드가 낸 리포트(tests/fixtures/v3-report.json)로 본다.
 * 실행: node --test tests/report.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CSV_HEADER,
  EMPTY_LEAD,
  PLANNED_LEAD,
  REPORT_LEAD,
  baselineNote,
  basisTag,
  carbonGapNote,
  correctionNote,
  correctionText,
  csvCell,
  csvName,
  periodRange,
  periodText,
  reconstructedNote,
  reportCsv,
  reportHeadline,
  scopeNote,
  unverifiedNote,
} from "../src/lib/v3/report.ts";
import { carbonText } from "../src/lib/v3/format.ts";
import type { Report } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|Foundry|Ollama|규칙 정책|연결되지 않았습니다|예시 데이터|calc|claim|null/;
const report = JSON.parse(readFileSync(new URL("./fixtures/v3-report.json", import.meta.url), "utf8")) as Report;

test("기간 버튼은 서버의 오늘로 시작·끝 날짜를 정한다(달 끝, 1월의 지난달)", () => {
  assert.deepEqual(periodRange("all", "2026-11-19"), { from: null, to: null });
  assert.deepEqual(periodRange("this_month", "2026-11-19"), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(periodRange("last_month", "2026-01-05"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(periodRange("last_month", "2028-03-10"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(periodRange("this_year", "2026-11-19"), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("last_year", "2026-11-19"), { from: "2025-01-01", to: "2025-12-31" });
  assert.equal(periodText({ from: null, to: null }), "전체 기간");
  assert.equal(periodText({ from: "2026-11-01", to: "2026-11-30" }), "2026-11-01 ~ 2026-11-30");
});

test("CSV는 BOM과 머리 줄, 실적 줄, 합계 줄을 담고 칸 수가 같다", () => {
  const csv = reportCsv(report);
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(lines[0], CSV_HEADER.join(","));
  assert.equal(lines.length, 1 + report.records.length + 1 + (report.totals?.revenue ? 1 : 0) + (report.totals?.fee ? 1 : 0));
  for (const line of lines) assert.equal(line.split(",").length, CSV_HEADER.length, line);
  const first = report.records[0];
  assert.ok(lines[1].startsWith(`${first.inspectedOn},`));
  // 처리비 합계는 표의 부호(−는 낸 돈)로 적는다
  if (report.totals?.fee) assert.ok(lines.some((line) => line.startsWith("처리비 합계,") && line.includes(`,-${report.totals?.fee?.value}`)));
});

test("CSV는 검수 한 건이 한 줄이고, 검수 ID·계량표 번호·정정 이력 칸을 싣는다", () => {
  // 예시 리포트: 같은 날 같은 폐기물 반입 두 건, 두 번째 건은 120kg → 110kg 정정
  assert.equal(report.records.length, 2);
  assert.equal(report.totals?.count, 2);
  assert.equal(report.totals?.kg?.value, report.records.reduce((sum, item) => sum + Number(item.kg?.value ?? 0), 0));
  const lines = reportCsv(report).slice(1).trimEnd().split("\r\n");
  const column = (name: string) => CSV_HEADER.indexOf(name);
  const rows = lines.slice(1, 1 + report.records.length).map((line) => line.split(","));
  assert.deepEqual(
    rows.map((row) => row[column("검수 ID")]),
    report.records.map((item) => item.inspectionId),
  );
  const fixed = report.records.find((item) => item.revision === 2);
  assert.ok(fixed);
  assert.equal(correctionText(fixed), "2판(정정 1회). 1판 중량 120kg · 단가 -72원/kg · 등급 등외. 최근 사유: 계량표 재확인(가상)");
  assert.equal(correctionText(report.records.find((item) => item.revision === 1) ?? fixed), "");
  assert.ok(lines.some((line) => line.includes(",T-0002,") && line.includes("2판(정정 1회)")));
  // 합계 줄의 건수는 검수 건 수다(정정한 건을 두 번 세지 않는다)
  assert.ok(lines.some((line) => line.startsWith("합계,2건,")));
  assert.match(correctionNote(report.records) ?? "", /^정정한 검수 1건은 고친 값만 합계에 넣었습니다/);
  assert.equal(correctionNote(report.records.filter((item) => item.revision === 1)), null);
});

test("CSV 칸은 수식으로 읽히지 않고, 쉼표·따옴표를 감싼다", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("@sum"), "'@sum");
  assert.equal(csvCell("-19200"), "-19200");
  assert.equal(csvCell('(주)새길, "자원"'), '"(주)새길, ""자원"""');
  assert.equal(csvName("(주)한빛정밀", { from: null, to: null }), "(주)한빛정밀 재활용 실적 전체.csv");
  assert.equal(csvName("A/B", { from: "2026-11-01", to: "2026-11-30" }), "AB 재활용 실적 2026-11-01_2026-11-30.csv");
});

test("탄소를 계산하지 못한 실적과 가정한 현행 처리를 숨기지 않고 적는다", () => {
  const carbonless = report.records.filter((item) => item.carbon === null);
  const note = carbonGapNote(report.records);
  if (carbonless.length > 0) assert.match(note ?? "", new RegExp(`${carbonless.length}건은 공인된 배출계수가 없어`));
  else assert.equal(note, null);
  if (report.records.some((item) => item.currentMethodAssumed)) assert.match(baselineNote(report.records) ?? "", /가정했습니다/);
  assert.equal(carbonGapNote([]), null);
  // 조사는 받침에 맞춘다("혼합 소각으로", "열분해(화학적 재활용)로")
  const sample = report.records[0];
  assert.match(baselineNote([{ ...sample, currentMethod: "혼합 소각", currentMethodAssumed: true }]) ?? "", /혼합 소각으로 가정/);
  const uncounted = { ...sample, carbon: null, process: "열분해(화학적 재활용)", carbonBasis: { ...sample.carbonBasis, status: "not_computed" as const } };
  assert.match(carbonGapNote([uncounted]) ?? "", /^열분해\(화학적 재활용\)로 보낸 1건/);
});

test("탄소는 배출계수 적용 추정이고, 기록할 때 고정한 기준과 계산 범위를 화면·CSV에 밝힌다", () => {
  const first = report.records[0];
  assert.equal(first.carbonBasis.status, "recorded");
  assert.equal(basisTag(first.carbonBasis), "기록 당시 기준");
  assert.ok(first.carbonBasis.factors.baseline && first.carbonBasis.factors.applied, "옮겨 적은 배출계수 두 개");
  assert.equal(report.carbonScope.key, "process_only");
  assert.match(scopeNote(report), /^계산 범위: .*수거 운송 배출과 신재 대체 효과는 넣지 않았습니다/);
  const csv = reportCsv(report).slice(1).trimEnd().split("\r\n");
  assert.ok(CSV_HEADER.includes("추정 탄소 변화(tCO2e · −는 감축 · 배출계수 적용)"));
  assert.ok(CSV_HEADER.includes("실제 중량(kg · 업체 계량)"));
  const row = csv[1].split(",");
  assert.equal(row[CSV_HEADER.indexOf("계산 범위")], report.carbonScope.label);
  assert.match(row[CSV_HEADER.indexOf("탄소 기준")], /^기록 당시 기준\(\d{4}-\d{2}-\d{2} 고정\)$/);
  assert.match(row[CSV_HEADER.indexOf("현행 처리 배출계수")], /kgCO2e\/kg · .* · 기준일 \d{4}-\d{2}-\d{2} · 판 \d+$/);
  const total = csv.find((line) => line.startsWith("합계,")) ?? "";
  assert.ok(total.includes(scopeNote(report)), total);
  assert.ok(total.includes(`기록 당시 기준 ${report.totals?.carbonStatus.recorded}건`), total);
});

test("당시 기준을 확인할 수 없는 지난 기록은 숫자 없이 상태와 이유를 적는다", () => {
  const sample = report.records[0];
  const unverified = {
    ...sample,
    carbon: null,
    currentMethod: null,
    process: null,
    carbonBasis: {
      ...sample.carbonBasis,
      status: "unverified" as const,
      statusLabel: "당시 기준 확인 불가",
      reason: "합의 기록을 찾지 못해 당시 기준을 확인할 수 없어 탄소를 계산하지 않았습니다.",
      baseline: { method: null, assumed: false, source: null, sourceLabel: null },
      applied: { process: null, source: null, sourceLabel: null, assumed: false },
      factors: { baseline: null, applied: null },
      perKg: null,
    },
  };
  const rebuilt = { ...sample, carbonBasis: { ...sample.carbonBasis, status: "reconstructed" as const, statusLabel: "합의 당시 기준으로 재구성" } };
  assert.match(unverifiedNote([unverified]) ?? "", /^1건은 .*오늘 기준으로 다시 계산하지 않았고, 탄소 합계에 넣지 않았습니다/);
  assert.match(reconstructedNote([rebuilt]) ?? "", /합의 당시 기준/);
  assert.equal(basisTag(rebuilt.carbonBasis), "합의 당시 기준");
  assert.equal(unverifiedNote(report.records), null);
  assert.equal(carbonGapNote([unverified]), null, "확인 불가는 계수 없음과 다른 문장으로 적는다");
  assert.equal(baselineNote([unverified]), null);
  const csv = reportCsv({ ...report, records: [unverified], totals: null }).slice(1).trimEnd().split("\r\n");
  const row = csv[1].split(",");
  assert.equal(row[CSV_HEADER.indexOf("추정 탄소 변화(tCO2e · −는 감축 · 배출계수 적용)")], "");
  assert.match(row[CSV_HEADER.indexOf("탄소 기준")], /^당시 기준 확인 불가: 합의 기록을 찾지 못해/);
  assert.equal(row[CSV_HEADER.indexOf("비교한 현행 처리")], "확인 불가");
});

test("제목과 안내 문구에 개발자 말이 없다", () => {
  const empty: Report = { ...report, records: [], totals: null, planned: [] };
  const texts = [
    REPORT_LEAD,
    EMPTY_LEAD,
    PLANNED_LEAD,
    reportHeadline(report),
    reportHeadline(empty),
    reportHeadline({ ...empty, planned: report.planned }),
    carbonGapNote(report.records) ?? "",
    baselineNote(report.records) ?? "",
    scopeNote(report),
    reconstructedNote([{ ...report.records[0], carbonBasis: { ...report.records[0].carbonBasis, status: "reconstructed" } }]) ?? "",
    unverifiedNote([{ ...report.records[0], carbonBasis: { ...report.records[0].carbonBasis, status: "unverified" } }]) ?? "",
  ];
  assert.equal(reportHeadline(report), `검수 기록 ${report.records.length}건을 모았습니다`);
  assert.equal(reportHeadline(empty), "아직 실적이 없습니다");
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
});

test("검수 한 건의 작은 탄소 값은 kg으로 적는다(0.003 tCO2e → 3.1 kgCO2e)", () => {
  const claim = { id: "c", kind: "number" as const, value: 0.00313, unit: "tCO2e", evidence: ["calc:x"] };
  assert.equal(carbonText(claim), "3.1 kgCO2e");
  assert.equal(carbonText({ ...claim, value: -1.968493 }), "−1.968 tCO2e");
  assert.equal(carbonText({ ...claim, value: -0.0012, unit: "tCO2e/월" }), "−1.2 kgCO2e/월");
});
