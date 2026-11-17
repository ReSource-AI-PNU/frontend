/**
 * 자료 올리기(src/lib/v3/intake.ts)와 막힌 승인의 문구(src/lib/v3/format.ts clearedApprovals).
 * 실행: node --test tests/intake.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearedApprovals } from "../src/lib/v3/format.ts";
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

test("막힌 합의: 승인한 적이 있을 때만 '앞서 한 승인은 지워졌습니다'", () => {
  const blocked = JSON.parse(readFileSync(new URL("./fixtures/v3-view-blocked.json", import.meta.url), "utf8"));
  const confirmed = JSON.parse(readFileSync(new URL("./fixtures/v3-view-confirmed.json", import.meta.url), "utf8"));
  const approval = blocked.approvals[0];
  assert.equal(clearedApprovals(approval, blocked.events), blocked.events.some((event: { kind: string; threadId: string }) => event.kind === "approval" && event.threadId === approval.threadId));
  assert.equal(clearedApprovals(approval, []), false, "승인 기록이 없으면 지워졌다고 쓰지 않는다");
  assert.equal(clearedApprovals(approval, confirmed.events), true, "그 대화의 승인 기록이 있으면 지워진 것이다");
  assert.equal(clearedApprovals({ ...approval, approvalsCleared: false }, confirmed.events), false, "백엔드가 알려 주면 그것을 쓴다");
  assert.equal(clearedApprovals({ ...approval, clearedApprovals: { emitter: true, vendor: false } }, []), true);
});
