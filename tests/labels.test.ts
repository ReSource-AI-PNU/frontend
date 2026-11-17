/**
 * 화면 이름(src/lib/v3/labels.ts): 근거 패널과 실행 기록에 판단 도구의 내부 ID가 보이지 않는지.
 * 실행: node --test tests/labels.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { AI_NAME, TOOL_LABEL, evidenceExcerpt, evidenceSource, evidenceTitle, evidenceTool, eventSummary, plainIds, toolLabel } from "../src/lib/v3/labels.ts";

const RAW_ID = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;

function evidence(over: Record<string, unknown> = {}) {
  return {
    id: "calc:optimize_assignment:54bcd9744f70:totalNow",
    kind: "calc",
    kindLabel: "계산",
    label: "현행 월 손익 합계 계산",
    source: "판단 도구 optimize_assignment",
    excerpt: "폐기물별 현행 월 손익의 합",
    meta: { tool: "optimize_assignment", formula: "폐기물별 현행 월 손익의 합" },
    ...over,
  };
}

test("판단 도구 ID마다 한국어 이름이 있다", () => {
  for (const id of ["judge_route", "optimize_assignment", "cost_carbon", "search_clauses", "match_permit", "find_vendors", "check_loading", "judge_reuse"]) {
    assert.ok(toolLabel(id), id);
    assert.doesNotMatch(toolLabel(id) ?? "", RAW_ID);
  }
  assert.equal(TOOL_LABEL.judge_route, "경로 판단");
  assert.equal(TOOL_LABEL.optimize_assignment, "최적 배정 계산");
  assert.equal(TOOL_LABEL.cost_carbon, "비용·탄소 계산");
  assert.equal(toolLabel("no_such_tool"), null);
  assert.equal(toolLabel(3), null);
});

test("출처: 백엔드 이름이 있으면 그것을, 없으면 표로 바꾸고, 모르는 ID는 그대로 두지 않는다", () => {
  assert.equal(evidenceSource(evidence()), "판단 도구 · 최적 배정 계산");
  assert.equal(evidenceSource(evidence({ sourceLabel: "최적 배정 계산(판단 도구)" })), "최적 배정 계산(판단 도구)");
  assert.equal(evidenceSource(evidence({ meta: { sourceLabel: "경로 판단 결과" } })), "경로 판단 결과");
  assert.equal(evidenceSource(evidence({ source: "판단 도구 brand_new_tool" })), "판단 도구");
  assert.equal(evidenceSource(evidence({ source: "" })), null);
  assert.equal(
    evidenceSource(evidence({ source: "업체 허가증.pdf (Document Intelligence 추출, 담당자 확인)" })),
    "업체 허가증.pdf (문서에서 뽑음, 담당자 확인)",
  );
  for (const tool of Object.keys(TOOL_LABEL)) {
    assert.doesNotMatch(evidenceSource(evidence({ source: `판단 도구 ${tool}` })) ?? "", RAW_ID, tool);
  }
});

test("이름·도구·발췌에도 ID가 나오지 않는다", () => {
  assert.equal(evidenceTool(evidence()), "최적 배정 계산");
  assert.equal(evidenceTool(evidence({ toolLabel: "배정 계산" })), "배정 계산");
  assert.equal(evidenceTool(evidence({ meta: { tool: "mystery_tool" } })), "판단 도구");
  assert.equal(evidenceTool(evidence({ meta: {} })), null);
  assert.equal(evidenceTitle(evidence({ label: "" })), "계산", "이름이 없으면 ID 대신 종류");
  // 판단 도구 호출 기록은 판정과 검사 결과를 낱말로 푼다
  const call = evidence({
    excerpt: "판정 conditional. 검사: permit=met, contamination_basis=conditional",
    meta: { tool: "judge_route", call: true, status: "conditional", checks: [{ key: "permit", status: "met" }, { key: "contamination_basis", status: "conditional" }] },
  });
  const labels: Record<string, string> = { permit: "허가 품목", contamination_basis: "오염도 출처" };
  assert.equal(evidenceExcerpt(call, (key) => labels[key]), "판정: 조건부 · 검사: 허가 품목 충족, 오염도 출처 조건부");
  assert.equal(evidenceExcerpt(evidence()), "폐기물별 현행 월 손익의 합");
});

test("실행 기록 요약: 'judge_route · conditional' → '경로 판단 · 조건부'", () => {
  assert.equal(eventSummary("judge_route · conditional"), "경로 판단 · 조건부");
  assert.equal(eventSummary("optimize_assignment · calculated"), "최적 배정 계산 · 확인됨");
  assert.equal(eventSummary("unknown_tool · needs_information"), "판단 도구 · 확인 필요");
  assert.equal(eventSummary("(주)한빛정밀 담당자가 승인했습니다."), "(주)한빛정밀 담당자가 승인했습니다.");
  assert.equal(plainIds("org_hanbit · st_purge"), "");
});

test("두 AI의 이름은 백엔드 작성자 표시와 같다", () => {
  assert.deepEqual(AI_NAME, { company: "회사 측 AI", vendor: "업체 측 AI" });
});
