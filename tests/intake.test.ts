/**
 * 자료 올리기(src/lib/v3/intake.ts)와 막힌 승인의 문구(src/lib/v3/format.ts clearedApprovals).
 * 실행: node --test tests/intake.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearedApprovalsText } from "../src/lib/v3/format.ts";
import {
  PENDING_LIMIT,
  addPending,
  checkPending,
  dropPending,
  measureCsv,
  measureProblem,
  nothingDetected,
  parsePending,
  pendingKey,
} from "../src/lib/v3/intake.ts";
import type { DocumentUploadResult, MediaUploadResult } from "../src/lib/v3/types.ts";

function doc(filename: string, over: Partial<DocumentUploadResult> = {}): DocumentUploadResult {
  return {
    kind: "permit",
    filename,
    extraction: "text_only",
    shieldUnavailable: false,
    blocked: false,
    handoff: false,
    threadIds: [],
    fields: [{ field: "wasteItem", label: "허가 품목", value: "폐합성수지", unit: null, confirmed: false }],
    ...over,
  };
}

test("확인하지 않은 추출값은 다음 문서를 올려도 남고, 저장했다 다시 읽어도 같다", () => {
  let list = addPending([], doc("허가증.pdf"), new Date("2026-11-18T01:00:00Z"));
  list = checkPending(list, list[0].id, "wasteItem", true);
  list = addPending(list, doc("매입 기준표.xlsx"), new Date("2026-11-18T01:01:00Z"));
  assert.deepEqual(list.map((item) => item.result.filename), ["매입 기준표.xlsx", "허가증.pdf"]);
  assert.equal(list[1].checked.wasteItem, true, "앞서 한 확인 표시도 남는다");
  // 새로 고침: 탭 저장소에 둔 글을 다시 읽는다
  const restored = parsePending(JSON.stringify(list));
  assert.deepEqual(restored, list);
  // 근거로 등록했거나 버린 문서만 빠진다
  assert.deepEqual(dropPending(restored, list[1].id).map((item) => item.result.filename), ["매입 기준표.xlsx"]);
  assert.equal(pendingKey("org_a", "업체 문서"), "rsai-pending-documents:org_a:업체 문서");
});

test("뽑은 값이 없거나 쓰지 않는 문서는 남기지 않고, 저장소의 이상한 값은 버린다", () => {
  assert.deepEqual(addPending([], doc("빈 문서.pdf", { fields: [] }), new Date()), []);
  assert.deepEqual(addPending([], doc("지시문.pdf", { blocked: true }), new Date()), []);
  assert.deepEqual(parsePending(null), []);
  assert.deepEqual(parsePending("{"), []);
  assert.deepEqual(parsePending(JSON.stringify([{ id: 1 }, null, "x"])), []);
  let list = [] as ReturnType<typeof parsePending>;
  for (let index = 0; index < PENDING_LIMIT + 2; index += 1) list = addPending(list, doc(`문서${index}.pdf`), new Date(1_700_000_000_000 + index));
  assert.equal(list.length, PENDING_LIMIT);
  assert.equal(list[0].result.filename, `문서${PENDING_LIMIT + 1}.pdf`);
});

test("사진에서 찾은 것이 없으면 다음 행동을 보인다", () => {
  const base: MediaUploadResult = { detectorUnavailable: false, streamId: "st_1", evidence: [] };
  assert.equal(nothingDetected({ ...base, material: null, contamination: null, detections: [] }), true);
  assert.equal(nothingDetected({ ...base, contamination: { claim: null, reliable: false } }), true);
  assert.equal(nothingDetected({ ...base, detectorUnavailable: true }), false, "분석하지 못한 파일은 따로 알린다");
  assert.equal(
    nothingDetected({ ...base, contamination: { claim: { id: "c", kind: "number", value: 4, unit: "%", evidence: ["ev"] }, reliable: true } }),
    false,
  );
  assert.equal(nothingDetected({ ...base, detections: [{ id: 1, label: "PP", kind: "item", confidence: 0.9 }] }), false);
});

test("직접 적은 수치는 측정값 양식 한 줄이 되고, 잘못된 값은 고칠 것을 한 줄로 알린다", () => {
  const csv = measureCsv({ name: "불량, 사출품", process: "사출", material: "PP", contaminationPct: 5, moisturePct: 0.4, measuredOn: "2026-11-18" });
  assert.equal(csv, '흐름 이름,공정,재질,오염도(%),수분(%),측정일\r\n"불량, 사출품",사출,PP,5,0.4,2026-11-18\r\n');
  assert.equal(measureProblem({ process: "사출", contamination: "5", moisture: "0.4", measuredOn: "2026-11-18" }), null);
  assert.equal(measureProblem({ process: " ", contamination: "5", moisture: "1", measuredOn: "2026-11-18" }), "공정을 적어 주세요.");
  assert.match(measureProblem({ process: "사출", contamination: "120", moisture: "1", measuredOn: "2026-11-18" }) ?? "", /^오염도/);
  assert.match(measureProblem({ process: "사출", contamination: "5", moisture: "", measuredOn: "2026-11-18" }) ?? "", /^수분/);
  assert.equal(measureProblem({ process: "사출", contamination: "5", moisture: "1", measuredOn: "" }), "측정일을 골라 주세요.");
});

test("막힌 합의: clearedApprovals가 비어 있지 않을 때만 '앞서 한 승인은 지워졌습니다'", () => {
  const blocked = JSON.parse(readFileSync(new URL("./fixtures/v3-view-blocked.json", import.meta.url), "utf8"));
  const approval = blocked.approvals[0];
  assert.equal(clearedApprovalsText(approval), null, "예전 뷰(필드 없음)는 알리지 않는다");
  assert.equal(clearedApprovalsText({ ...approval, clearedApprovals: [] }), null, "승인한 적이 없으면 알리지 않는다");
  assert.equal(clearedApprovalsText({ ...approval, clearedApprovals: ["emitter", "vendor"] }), "앞서 한 승인은 양쪽 모두 지워졌습니다.");
  assert.equal(clearedApprovalsText({ ...approval, clearedApprovals: ["emitter"] }), "앞서 한 배출 기업의 승인은 지워졌습니다.");
  assert.equal(clearedApprovalsText({ ...approval, clearedApprovals: ["vendor"] }), "앞서 한 처리 업체의 승인은 지워졌습니다.");
});

test("질문 머리말: 진단 뷰의 questionBatch.intro·note를 쓰고, 없으면 같은 말투로 묶음의 질문 수를 적는다", async () => {
  const { currentBundle, questionIntro } = await import("../src/lib/v3/format.ts");
  const q = (id: string, batch: number, answered = false) => ({ id, batch, answered });
  const first = [q("a", 1), q("b", 1), q("c", 1)];
  assert.deepEqual(currentBundle(first).map((item) => item.id), ["a", "b", "c"]);
  // 백엔드 문장(첫 묶음)
  const summary = { batch: 1, count: 3, open: 3, intro: "찾기 전에 3가지를 여쭙겠습니다.", note: "답을 보고 한 번 더 여쭐 수 있습니다." };
  assert.deepEqual(questionIntro(currentBundle(first), summary), { intro: "찾기 전에 3가지를 여쭙겠습니다.", note: "답을 보고 한 번 더 여쭐 수 있습니다." });
  // 묶음이 다르면(실행 중 막 받은 둘째 묶음) 백엔드 문장을 쓰지 않는다
  const second = [q("a", 1, true), q("b", 2), q("c", 2)];
  assert.deepEqual(currentBundle(second).map((item) => item.id), ["b", "c"]);
  assert.deepEqual(questionIntro(currentBundle(second), summary), { intro: "2가지만 더 여쭙겠습니다. 이번이 마지막 질문입니다.", note: null });
  // 백엔드 문장이 없으면 첫 묶음은 "…만" 없이
  assert.equal(questionIntro(currentBundle(first)).intro, "찾기 전에 3가지를 여쭙겠습니다.");
  const partly = [q("a", 1, true), q("b", 1), q("c", 1)];
  assert.equal(questionIntro(currentBundle(partly), { ...summary, open: 2 }).note, "3가지 가운데 2가지가 남았습니다. 답을 보고 한 번 더 여쭐 수 있습니다.");
  assert.deepEqual(currentBundle([q("a", 1, true)]), []);
  // 묶음 번호가 없으면 답하지 않은 질문 전부를 한 묶음으로 본다(0가지로 쓰지 않는다)
  const loose = [{ id: "x", answered: false }, { id: "y", answered: false }];
  assert.equal(questionIntro(currentBundle(loose)).intro, "찾기 전에 2가지를 여쭙겠습니다.");
});

test("오염도·수분의 출처: 측정, 담당자 답(claim 이름), 사진 추정", async () => {
  const { basisNote } = await import("../src/lib/v3/format.ts");
  const answered = { id: "st_defect_answeredContaminationPct", kind: "number" as const, value: 5, unit: "%", evidence: ["human:x"], label: "오염도(담당자 답)" };
  assert.equal(basisNote("answered", answered), "오염도(담당자 답)");
  assert.equal(basisNote("answered", { ...answered, label: undefined }), "담당자 답");
  assert.equal(basisNote("measured", answered), "측정");
  assert.equal(basisNote("photo_estimate", null), "사진 추정");
  assert.equal(basisNote(null, answered), null);
  assert.equal(basisNote(undefined, null), null);
});

test("업체가 확인한 문서 값이 업체 정보에 들어간 요약", async () => {
  const { profileSummaryText } = await import("../src/lib/v3/intake.ts");
  const base = { permitsAdded: 0, permitsUpdated: 0, criteriaAdded: 0, criteriaUpdated: 0, permits: [], criteria: [], skipped: [] };
  assert.equal(profileSummaryText({ ...base, permitsAdded: 1, criteriaUpdated: 2 }), "업체 정보에 반영했습니다(허가 품목 1개 추가, 매입 기준 2개 수정).");
  assert.equal(profileSummaryText(base), "업체 정보에는 이미 같은 값이 있어 그대로 두었습니다.");
});

test("확인 표시만 바꾸고 받은 항목(target)은 그대로 돌려보낸다", () => {
  const result = doc("매입 기준표.xlsx", {
    kind: "purchase_criteria",
    fields: [{ field: "c0.unitPrice", label: "PP A등급 단가", value: 320, unit: "원/kg", confirmed: false, target: { criterion: 0, key: "unitPriceKrwPerKg" } }],
  });
  const restored = parsePending(JSON.stringify(addPending([], result, new Date("2026-11-18T00:00:00Z"))));
  assert.deepEqual(restored[0].result.fields[0].target, { criterion: 0, key: "unitPriceKrwPerKg" });
});
