/**
 * 처리 업체의 빈 화면 글(src/lib/v3/vendor-empty.ts). 허가 품목·매입 기준을 올린 업체에게 다시 올리라고 하지 않는다.
 * 실행: node --test tests/vendor-empty.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { vendorEmptyCopy, vendorReady } from "../src/lib/v3/vendor-empty.ts";

test("허가 품목이나 매입 기준이 있으면 '아직 들어온 문의가 없습니다'만 적고 올리기를 권하지 않는다", () => {
  for (const profile of [
    { permits: [{ code: "51-03" }], criteria: [{ id: "c1" }] },
    { permits: [{ code: "51-03" }], criteria: [] },
    { permits: [], criteria: [{ id: "c1" }] },
  ]) {
    assert.equal(vendorReady(profile), true);
    for (const where of ["home", "inquiries"] as const) {
      const copy = vendorEmptyCopy(profile, where);
      assert.equal(copy.title, "아직 들어온 문의가 없습니다");
      assert.equal(copy.action.upload, false);
      assert.equal(copy.action.label, "업체 정보 보기");
      assert.doesNotMatch(`${copy.title} ${copy.description} ${copy.action.label}`, /올리|올려/);
    }
  }
});

test("허가 품목과 매입 기준이 없거나 프로필이 없으면 허가증·매입 기준표 올리기를 주 행동으로 둔다", () => {
  for (const profile of [null, { permits: [], criteria: [] }, { permits: null, criteria: undefined }]) {
    assert.equal(vendorReady(profile), false);
    const copy = vendorEmptyCopy(profile, "inquiries");
    assert.equal(copy.title, "허가증과 매입 기준표를 올려 주세요");
    assert.equal(copy.action.label, "허가증·매입 기준표 올리기");
    assert.equal(copy.action.upload, true);
  }
});

test("프로필을 읽지 못했으면(undefined) 올리기를 권하지 않는다", () => {
  const copy = vendorEmptyCopy(undefined, "inquiries");
  assert.equal(copy.ready, false);
  assert.equal(copy.title, "아직 들어온 문의가 없습니다");
  assert.equal(copy.action.upload, false);
});

test("대화 첫 화면과 받은 문의는 문장만 다르다", () => {
  const profile = { permits: [{}], criteria: [] };
  assert.match(vendorEmptyCopy(profile, "home").description, /여기에 나타납니다/);
  assert.match(vendorEmptyCopy(profile, "inquiries").description, /이곳에 모입니다/);
});
