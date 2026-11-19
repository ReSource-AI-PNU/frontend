/**
 * 허가 확인 상태 문구(src/lib/v3/permit.ts). 업체 입력·공공 명부 일치와 담당자의 허가증 원문 대조를 가르는지 본다.
 * 실행: node --test tests/permit.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allVerified,
  canRecordCheck,
  permitLine,
  permitPaper,
  permitSource,
  permitState,
  permitTally,
  permitTodo,
} from "../src/lib/v3/permit.ts";
import type { DiagnosisView, PermitLevel } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|permit_|level|source|null|undefined|verified|registry/;

const base = {
  status: "conditional" as const,
  text: "업체가 입력한 허가 품목이 이 폐기물과 맞습니다.",
  evidence: ["human:org_x:허가품목-폐플라스틱"],
  wasteItem: "폐플라스틱",
  materials: ["PP"],
  process: "재활용",
  need: "재활용업",
  business: null,
  check: null,
  document: null,
  ignored: [],
  todo: {
    submit: "폐기물처리업 허가증 사본(재활용이면 재활용 신고증명서도 됨)",
    items: ["영업대상 폐기물에 폐플라스틱(PP)이 들어 있는지", "업종이 재활용업이고 처리 방법이 재활용인지"],
  },
};

const typed: PermitLevel = { ...base, level: "registered", label: "등록 품목 일치 · 허가증 원본 확인 필요", source: "typed" };
const document = {
  id: "pd_1",
  name: "허가증.pdf",
  uploadedAt: "2026-11-19T10:00:00+00:00",
  pages: [1, 2],
  items: [{ wasteItem: "폐플라스틱", materials: ["PP", "PE"], page: 2, quote: "영업대상 폐기물: 폐플라스틱(PP, PE)" }],
  business: { name: "폐기물종합재활용업", page: 1, quote: "업종: 폐기물 종합재활용업" },
  holder: { name: "(주)가상러너자원", address: "부산광역시 강서구", page: 1, quote: null, nameMatches: true, siteMatches: true },
  evidence: ["doc:org_x:허가증-AI판독:abc"],
};
const pending: PermitLevel = { ...base, level: "pending_review", label: "허가증 검토 대기", source: "document", document };
const verified: PermitLevel = {
  ...base,
  level: "verified",
  label: "허가증 대조 완료",
  status: "met",
  source: "check",
  todo: null,
  document,
  check: {
    id: "pc_1",
    documentId: "pd_1",
    document: "허가증.pdf",
    page: 2,
    wasteItem: "폐플라스틱",
    materials: ["PP"],
    process: "재활용",
    itemFound: true,
    processFits: true,
    itemQuote: "영업대상 폐기물: 폐플라스틱(PP, PE)",
    processQuote: "업종: 폐기물 종합재활용업",
    checkedBy: { orgId: "org_hanbit", orgName: "(주)한빛정밀", userName: "김담당" },
    checkedAt: "2026-11-19T11:30:00+00:00",
    evidence: "human:org_hanbit:허가증대조-org_x-pc_1",
  },
};
const mismatch: PermitLevel = {
  ...verified,
  level: "mismatch",
  label: "이 경로로 진행 불가",
  status: "unmet",
  text: "(주)한빛정밀 담당자가 허가증 원문과 대조한 결과 추천한 처리 방식 재활용(재활용업)이 허가증의 업종·처리 방법과 다릅니다.",
};

test("네 상태를 가르고, 원문 대조 기록이 있는 경로만 대조 완료다", () => {
  assert.equal(permitState(typed)?.label, "등록 품목 일치 · 허가증 원본 확인 필요");
  assert.equal(permitState(pending)?.label, "허가증 검토 대기");
  assert.equal(permitState(verified)?.label, "허가증 대조 완료");
  assert.equal(permitState(mismatch)?.label, "이 경로로 진행 불가");
  assert.equal(permitState(verified)?.tone, "done");
  assert.equal(permitState(mismatch)?.tone, "stop");
  assert.equal(permitState(null), null);
});

test("이전 결과의 허가증·공공 명부 수준은 충족이었어도 원본 확인 필요로 보인다", () => {
  const old = { level: "document", label: "허가증 문서", status: "met", text: "허가증 문서에서 확인했습니다.", evidence: [] } as PermitLevel;
  const state = permitState(old);
  assert.equal(state?.key, "registered");
  assert.equal(state?.legacy, true);
  assert.match(permitSource(old), /원문 대조 기록 없음/);
  assert.match(permitLine(old), /원본으로 품목과 처리 방법을 대조/);
  assert.equal(allVerified([old]), false);
});

test("대조 완료 문구는 누가·언제·어느 문서 몇 쪽에서·무엇을 확인했는지와 범위를 적는다", () => {
  const line = permitLine(verified);
  assert.match(line, /\(주\)한빛정밀 담당자 김담당이 2026-11-19 허가증\.pdf 2쪽에서 폐플라스틱\(PP\)과 처리 방식 재활용을 확인했습니다/);
  assert.match(line, /이 폐기물과 처리 방식에만 해당합니다/);
  assert.doesNotMatch(line, /모두 확인/);
  assert.deepEqual(permitTodo(verified), []);
  assert.equal(canRecordCheck(verified), false);
});

test("원본 확인 필요는 제출받을 문서와 확인할 항목을, 검토 대기는 대조할 문서를 알린다", () => {
  assert.match(permitLine(typed), /^제출받을 문서: 폐기물처리업 허가증 사본/);
  assert.equal(permitTodo(typed).length, 2);
  assert.equal(canRecordCheck(typed), false); // 대조할 허가증이 아직 없다
  assert.match(permitLine(pending), /허가증\.pdf를 AI가 읽었습니다\. 원문에서 폐플라스틱\(PP\)과 처리 방식 재활용을 대조해 기록해 주세요/);
  assert.equal(canRecordCheck(pending), true);
  assert.equal(permitLine(mismatch), mismatch.text);
  assert.equal(permitPaper(pending), "대조할 문서: 업체가 올린 허가증.pdf");
  assert.match(permitPaper(typed), /^제출받을 문서: /);
});

test("전체 제목은 경로마다의 상태를 센다", () => {
  assert.equal(permitTally([verified, typed, typed]), "허가증 대조 완료 1건 · 원본 확인 필요 2건");
  assert.equal(permitTally([pending, mismatch, null]), "검토 대기 1건 · 진행 불가 1건 · 허가 상태 확인 필요 1건");
  assert.equal(allVerified([verified, verified]), true);
  assert.equal(allVerified([verified, pending]), false);
  assert.equal(allVerified([]), false);
});

test("문구에 개발자 말이 없다", () => {
  for (const permit of [typed, pending, verified, mismatch]) {
    for (const text of [permitLine(permit), permitSource(permit), permitState(permit)?.label ?? "", ...permitTodo(permit)]) {
      assert.doesNotMatch(text, JARGON, text);
    }
  }
});

test("실제 백엔드 응답(예시 데이터)의 결과표와 승인 카드가 같은 허가 상태를 보인다", () => {
  const view = JSON.parse(readFileSync(new URL("../src/lib/v3/fixture-data/view.json", import.meta.url), "utf8")) as DiagnosisView;
  const assignments = view.result?.assignments ?? [];
  for (const approval of view.approvals) {
    for (const permit of approval.permits ?? []) {
      const row = assignments.find((item) => item.threadId === approval.threadId && item.streamId === permit.streamId);
      assert.equal(row?.permit?.level, permit.level);
      assert.equal(row?.permit?.label, permit.label);
    }
    const held = (approval.permits ?? []).some((permit) => permit.status !== "met");
    assert.equal(Boolean(approval.permitHold), held);
  }
  // 시연은 세 가지 상태를 보인다: 대조 완료(새길자원), 검토 대기(남해열분해), 원본 확인 필요(미소환경)
  const levels = new Set(assignments.map((item) => item.permit?.level).filter(Boolean));
  assert.ok(levels.has("verified") && levels.has("pending_review") && levels.has("registered"), [...levels].join(","));
});
