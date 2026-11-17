/**
 * 로그인 응답, 회사 소속, 활성 회사 고르기, 오류 문구, 초대 링크. 네트워크 없이 본다.
 * 실행: node --test tests/auth-account.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inviteLink,
  inviteMessage,
  inviteTokenFrom,
  LOGIN_MESSAGE,
  loginFailure,
  parseAccount,
  parseMemberships,
  pickActiveOrg,
  safeRedirect,
  signupMessage,
} from "../src/lib/auth/account.ts";

test("로그인 응답에서 사용자와 소속을 읽고, 모양이 틀린 소속은 버린다", () => {
  const account = parseAccount({
    user: { id: "usr_1", email: "kim@factory.kr", name: "김담당" },
    memberships: [
      { orgId: "org_a", orgName: "(주)가나", kind: "emitter", memberRole: "owner" },
      { orgId: "org_b", orgName: "(주)다라", kind: "vendor", memberRole: "member" },
      { orgId: "org_a", orgName: "중복", kind: "emitter", memberRole: "member" },
      { orgId: "", kind: "emitter" },
      { orgId: "org_c", kind: "unknown" },
      "nope",
    ],
  });
  assert.ok(account);
  assert.deepEqual(account.user, { id: "usr_1", email: "kim@factory.kr", name: "김담당" });
  assert.deepEqual(
    account.memberships.map((item) => [item.orgId, item.kind, item.memberRole]),
    [
      ["org_a", "emitter", "owner"],
      ["org_b", "vendor", "member"],
    ],
  );
  assert.equal(parseAccount({ user: { email: "x@y.z" } }), null);
  assert.equal(parseAccount(null), null);
  assert.deepEqual(parseMemberships(undefined), []);
});

test("활성 회사: 바라는 회사가 소속에 있을 때만 그 회사, 아니면 첫 소속", () => {
  const list = parseMemberships([
    { orgId: "org_a", orgName: "A", kind: "emitter", memberRole: "owner" },
    { orgId: "org_b", orgName: "B", kind: "vendor", memberRole: "member" },
  ]);
  assert.equal(pickActiveOrg(list, "org_b"), "org_b");
  assert.equal(pickActiveOrg(list, "org_hanbit"), "org_a", "소속이 아닌 회사는 고를 수 없다");
  assert.equal(pickActiveOrg(list, null), "org_a");
  assert.equal(pickActiveOrg([], "org_a"), null);
});

test("돌아갈 주소는 같은 사이트의 경로만 받는다", () => {
  assert.equal(safeRedirect("/invite/abc?x=1", "/app"), "/invite/abc?x=1");
  assert.equal(safeRedirect("http://localhost:3000/app/approval", "/app"), "/app/approval");
  assert.equal(safeRedirect("https://evil.example//x", "/app"), "/app");
  assert.equal(safeRedirect("//evil.example/path", "/app"), "/path", "호스트는 버리고 경로만 남긴다");
  assert.equal(safeRedirect("/api/v3/sessions", "/app"), "/app");
  assert.equal(safeRedirect(undefined, "/onboarding"), "/onboarding");
});

test("로그인·가입·초대 실패 문구는 사용자 말이고, 무엇이 틀렸는지 가리지 않는다", () => {
  assert.equal(loginFailure(401), "invalid");
  assert.equal(loginFailure(429), "rate_limited");
  assert.equal(loginFailure(503), "unavailable");
  assert.equal(LOGIN_MESSAGE.invalid, "이메일 또는 비밀번호가 맞지 않습니다.");
  assert.match(signupMessage(409, "EMAIL_TAKEN"), /이미 가입한 이메일/);
  assert.match(signupMessage(500, null), /잠시 후 다시/);
  assert.match(inviteMessage(410, "INVITE_INVALID"), /만료되었거나/);
  const all = [...Object.values(LOGIN_MESSAGE), signupMessage(409, null), signupMessage(503, null), inviteMessage(410, null), inviteMessage(502, null)];
  for (const message of all) assert.ok(!/[A-Z_]{4,}|백엔드|환경 변수/.test(message), message);
});

test("초대 링크를 만들고, 붙여 넣은 링크나 코드에서 토큰을 뽑는다", () => {
  assert.equal(inviteLink("https://resource.example/", "tok_ABC-123"), "https://resource.example/invite/tok_ABC-123");
  assert.equal(inviteTokenFrom("https://resource.example/invite/tok_ABC-123?utm=x"), "tok_ABC-123");
  assert.equal(inviteTokenFrom("  tok_ABC-123 "), "tok_ABC-123");
  assert.equal(inviteTokenFrom("<script>"), null);
  assert.equal(inviteTokenFrom(""), null);
});
