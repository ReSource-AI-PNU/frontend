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
  carbonGapNote,
  csvCell,
  csvName,
  periodRange,
  periodText,
  reportCsv,
  reportHeadline,
} from "../src/lib/v3/report.ts";
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
  assert.match(carbonGapNote([{ ...sample, carbon: null, process: "열분해(화학적 재활용)" }]) ?? "", /^열분해\(화학적 재활용\)로 보낸 1건/);
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
  ];
  assert.equal(reportHeadline(report), `검수 기록 ${report.records.length}건을 모았습니다`);
  assert.equal(reportHeadline(empty), "아직 실적이 없습니다");
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
});
