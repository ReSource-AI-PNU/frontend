/**
 * 세션 쿠키의 소속과 백엔드 소속 견주기(src/lib/auth/membership-sync.ts).
 * QA: 소유자가 회사 이름을 바꿔도 이미 로그인한 사람의 사이드바·구성원 머리·계정 지우기 문구가 옛 이름으로 남았고,
 * 회사에서 빠진 사람은 다음에 열 때 403(NOT_A_MEMBER)을 세 번 받고 아무 말 없이 회사 등록으로 갔다.
 * 실행: node --test tests/membership-sync.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Membership } from "../src/lib/auth/account.ts";
import {
  checkDue,
  checkMemberships,
  encodeOrgNotice,
  MEMBERSHIP_CHECK_MS,
  orgNoticeText,
  parseOrgNotice,
  sameMemberships,
  shownMemberships,
} from "../src/lib/auth/membership-sync.ts";

const A: Membership = { orgId: "org_a", orgName: "(주)QA정밀3678", kind: "emitter", memberRole: "owner" };
const B: Membership = { orgId: "org_b", orgName: "(주)새길자원", kind: "vendor", memberRole: "member" };

test("소속은 순서와 상관없이 회사·이름·하는 일·역할이 모두 같아야 같다", () => {
  assert.equal(sameMemberships([A, B], [B, A]), true);
  assert.equal(sameMemberships([A], [{ ...A, orgName: "(주)QA정밀수정3678" }]), false, "회사 이름이 바뀌었다");
  assert.equal(sameMemberships([B], [{ ...B, memberRole: "owner" }]), false, "소유자가 되었다");
  assert.equal(sameMemberships([A, B], [A]), false, "한 회사에서 빠졌다");
  assert.equal(sameMemberships([A], [A, B]), false, "다른 창에서 초대를 수락했다");
  assert.equal(sameMemberships([], []), true);
});

test("QA: 다른 사람이 회사 이름을 바꾸면 쿠키가 낡았다고 보고, 보던 회사는 그대로다", () => {
  const renamed = { ...A, orgName: "(주)QA정밀수정3678" };
  assert.deepEqual(checkMemberships([A, B], [renamed, B], A.orgId), { changed: true, gone: null });
  assert.deepEqual(checkMemberships([A, B], [B, A], A.orgId), { changed: false, gone: null });
});

test("QA: 보던 회사에서 빠졌으면 그 회사(이름을 알리는 데 쓴다)를 돌려준다", () => {
  assert.deepEqual(checkMemberships([A, B], [B], A.orgId), { changed: true, gone: A });
  assert.deepEqual(checkMemberships([A], [], A.orgId), { changed: true, gone: A }, "남은 회사가 없다");
  assert.deepEqual(checkMemberships([A, B], [A], A.orgId), { changed: true, gone: null }, "보지 않던 회사에서만 빠졌다");
  assert.deepEqual(checkMemberships([], [A], null), { changed: true, gone: null }, "보던 회사가 없었다");
});

test("화면이 보낸 소속은 모양만 맞춰 견주는 데만 쓴다", () => {
  assert.equal(shownMemberships(undefined), null);
  assert.equal(shownMemberships("org_a"), null);
  assert.deepEqual(shownMemberships([A, { orgId: "", kind: "emitter" }, { orgId: "x", kind: "boss" }]), [A]);
});

test("화면 이동·창으로 돌아올 때는 간격을 두고 다시 읽는다", () => {
  assert.equal(checkDue(1_000, 1_000 + MEMBERSHIP_CHECK_MS - 1), false);
  assert.equal(checkDue(1_000, 1_000 + MEMBERSHIP_CHECK_MS), true);
  assert.equal(checkDue(0, 10, 5), true);
});

test("나왔거나 빠졌다는 안내 문장. 남은 회사로 옮겼으면 그 회사를 덧붙인다(조사는 받침을 따른다)", () => {
  assert.equal(orgNoticeText({ kind: "left", orgName: "(주)QA정밀3678" }), "(주)QA정밀3678에서 나왔습니다.");
  assert.equal(
    orgNoticeText({ kind: "removed", orgName: "(주)QA정밀3678" }),
    "(주)QA정밀3678의 구성원이 아닙니다. 소유자에게 문의해 주세요.",
  );
  assert.equal(
    orgNoticeText({ kind: "left", orgName: "(주)QA정밀3678" }, "(주)새길자원"),
    "(주)QA정밀3678에서 나왔습니다. 지금은 (주)새길자원을 보고 있습니다.",
  );
  assert.equal(
    orgNoticeText({ kind: "removed", orgName: "(주)QA정밀3678" }, "(주)남해열분해"),
    "(주)QA정밀3678의 구성원이 아닙니다. 소유자에게 문의해 주세요. 지금은 (주)남해열분해를 보고 있습니다.",
  );
  assert.equal(orgNoticeText({ kind: "left", orgName: "(주)A" }, "(주)A"), "(주)A에서 나왔습니다.");
});

test("안내 쿠키는 모양이 맞을 때만 읽는다", () => {
  const notice = { kind: "removed", orgName: "(주)QA정밀3678" } as const;
  assert.deepEqual(parseOrgNotice(encodeOrgNotice(notice)), notice);
  assert.equal(parseOrgNotice(undefined), null);
  assert.equal(parseOrgNotice("not json"), null);
  assert.equal(parseOrgNotice(JSON.stringify({ kind: "kicked", orgName: "x" })), null);
  assert.equal(parseOrgNotice(JSON.stringify({ kind: "left", orgName: "  " })), null);
  assert.equal(parseOrgNotice("x".repeat(601)), null);
  assert.equal(parseOrgNotice(encodeOrgNotice({ kind: "left", orgName: "가".repeat(200) }))?.orgName.length, 120);
});
