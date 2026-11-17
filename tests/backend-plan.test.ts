/**
 * 프런트 서버 통로(src/app/api/v3, src/app/api/v3-demo)가 백엔드로 넘길지 막을지 정하는 규칙.
 * 네트워크 없이 순수 함수만 본다. 실행: node --test tests/backend-plan.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { backendHeaders, errorCodeOf, planProxy, readBackendConfig, USER_MESSAGE } from "../src/lib/v3/backend-plan.ts";

const BFF = readBackendConfig({ V3_BACKEND_URL: "https://api.example/api/v3/", V3_AUTH: "bff", V3_BFF_KEY: "k".repeat(32) });
const member = { kind: "member" as const, userId: "usr_1", orgId: "org_mine" };

test("설정을 읽는다: V3_AUTH가 없으면 키가 있는 쪽으로 정한다", () => {
  assert.deepEqual(readBackendConfig({}), { ok: false, code: "BACKEND_NOT_SET" });
  assert.equal(BFF.ok && BFF.mode, "bff");
  assert.equal(BFF.ok && BFF.url, "https://api.example/api/v3");
  const implicit = readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3", V3_BFF_KEY: "secret-key" });
  assert.equal(implicit.ok && implicit.mode, "bff");
  assert.deepEqual(readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3", V3_AUTH: "bff" }), { ok: false, code: "BFF_KEY_NOT_SET" });
  const header = readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3" });
  assert.equal(header.ok && header.mode, "header");
  const token = readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3", V3_ORG_TOKENS: '{"org_a":["t-new","t-old"]}' });
  assert.ok(token.ok && token.mode === "token" && token.tokens.org_a === "t-new");
  assert.deepEqual(readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3", V3_ORG_TOKENS: "{" }), { ok: false, code: "TOKENS_INVALID" });
});

test("bff: 서버 키와 세션의 사람·회사를 머리글로 싣는다", () => {
  assert.ok(BFF.ok);
  const plan = planProxy({ method: "GET", path: ["orgs", "org_mine", "streams"], search: "?a=1", config: BFF, scope: member });
  assert.ok(plan.ok);
  assert.equal(plan.url, "https://api.example/api/v3/orgs/org_mine/streams?a=1");
  assert.deepEqual(plan.headers, {
    Authorization: `Bearer ${"k".repeat(32)}`,
    "X-User-Id": "usr_1",
    "X-Org-Id": "org_mine",
  });
});

test("조직은 세션의 활성 회사로만 정한다: 주소의 다른 회사는 막는다", () => {
  const other = planProxy({ method: "GET", path: ["orgs", "org_other", "streams"], config: BFF, scope: member });
  assert.equal(other.ok, false);
  assert.ok(!other.ok && other.status === 403 && other.code === "ORG_MISMATCH" && other.message === USER_MESSAGE.otherCompany);
  const vendorWrite = planProxy({ method: "PUT", path: ["vendors", "org_other"], config: BFF, scope: member });
  assert.ok(!vendorWrite.ok && vendorWrite.code === "ORG_MISMATCH");
  // 회사 ID가 없는 경로는 세션 회사로 간다
  const sessions = planProxy({ method: "POST", path: ["sessions"], config: BFF, scope: member });
  assert.ok(sessions.ok && sessions.headers["X-Org-Id"] === "org_mine");
});

test("로그인하지 않았거나 회사가 없으면 백엔드를 부르지 않는다", () => {
  const anonymous = planProxy({ method: "GET", path: ["sessions"], config: BFF, scope: { kind: "member", userId: null, orgId: null } });
  assert.ok(!anonymous.ok && anonymous.status === 401 && anonymous.code === "LOGIN_REQUIRED");
  const noOrg = planProxy({ method: "GET", path: ["sessions"], config: BFF, scope: { kind: "member", userId: "usr_1", orgId: null } });
  assert.ok(!noOrg.ok && noOrg.status === 403 && noOrg.code === "ORG_REQUIRED");
  // 상태 확인만 열려 있다
  const health = planProxy({ method: "GET", path: ["health"], config: BFF, scope: { kind: "member", userId: null, orgId: null } });
  assert.ok(health.ok && !("X-User-Id" in health.headers) && !("X-Org-Id" in health.headers));
});

test("체험하기: GET만 넘기고, 사람 ID 없이 체험 머리글과 시연 회사만 싣는다", () => {
  const demo = { kind: "demo" as const, orgId: "org_hanbit" };
  const read = planProxy({ method: "GET", path: ["sessions"], config: BFF, scope: demo });
  assert.ok(read.ok);
  assert.equal(read.headers["X-Demo-View"], "1");
  assert.equal(read.headers["X-Org-Id"], "org_hanbit");
  assert.equal("X-User-Id" in read.headers, false);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const write = planProxy({ method, path: ["sessions", "s1", "approvals"], config: BFF, scope: demo });
    assert.ok(!write.ok && write.status === 403 && write.code === "DEMO_READ_ONLY", method);
    assert.equal(!write.ok && write.message, USER_MESSAGE.demoReadOnly);
  }
  const missing = planProxy({ method: "GET", path: ["sessions"], config: BFF, scope: { kind: "demo", orgId: null } });
  assert.ok(!missing.ok && missing.code === "DEMO_UNAVAILABLE");
});

test("다른 창에서 회사를 바꿔 화면의 회사와 세션의 회사가 다르면 409로 막는다", () => {
  const changed = planProxy({ method: "POST", path: ["sessions"], config: BFF, scope: member, expectedOrg: "org_before" });
  assert.ok(!changed.ok && changed.status === 409 && changed.code === "ORG_CHANGED");
  const same = planProxy({ method: "POST", path: ["sessions"], config: BFF, scope: member, expectedOrg: "org_mine" });
  assert.ok(same.ok);
  // 체험하기는 서버가 시연 회사를 정하므로 보지 않는다
  const demo = planProxy({ method: "GET", path: ["sessions"], config: BFF, scope: { kind: "demo", orgId: "org_hanbit" }, expectedOrg: "x" });
  assert.ok(demo.ok);
});

test("계정·초대 경로는 브라우저 통로로 넘기지 않는다", () => {
  for (const path of [["accounts", "login"], ["accounts", "me"], ["invites", "tok", "accept"]]) {
    const plan = planProxy({ method: "POST", path, config: BFF, scope: member });
    assert.ok(!plan.ok && plan.code === "SERVER_ONLY", path.join("/"));
  }
});

test("설정이 빠졌거나 주소가 이상하면 쉬운 말로 거절하고 원인은 코드에만 남긴다", () => {
  const unset = planProxy({ method: "GET", path: ["sessions"], config: readBackendConfig({}), scope: member });
  assert.ok(!unset.ok && unset.status === 503 && unset.code === "BACKEND_NOT_SET");
  assert.ok(!unset.ok && !/V3_|백엔드|환경 변수/.test(unset.message));
  const dots = planProxy({ method: "GET", path: ["..", "admin"], config: BFF, scope: member });
  assert.ok(!dots.ok && dots.status === 404);
  // 조각 안에 숨긴 "/"로 계정 경로나 다른 회사 경로를 비켜 가지 못한다
  for (const path of [["accounts/signup"], ["accounts%2Fsignup"], ["orgs", "org_other/streams"], ["orgs%2Forg_other", "streams"], ["a\\b"], ["%E0%A4%A"]]) {
    const plan = planProxy({ method: "POST", path, config: BFF, scope: member });
    assert.ok(!plan.ok && plan.status === 404, path.join("|"));
  }
  for (const message of Object.values(USER_MESSAGE)) assert.ok(!/V3_|\.env|백엔드|BACKEND/.test(message), message);
});

test("token·header 모드: 예전 방식도 세션 회사로만 부른다", () => {
  const token = readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3", V3_ORG_TOKENS: '{"org_mine":"tok-mine"}' });
  assert.ok(token.ok);
  const plan = planProxy({ method: "GET", path: ["sessions"], config: token, scope: member });
  assert.ok(plan.ok && plan.headers.Authorization === "Bearer tok-mine" && plan.headers["X-Org-Id"] === "org_mine");
  const notListed = planProxy({ method: "GET", path: ["sessions"], config: token, scope: { ...member, orgId: "org_x" } });
  assert.ok(!notListed.ok && notListed.code === "ORG_NOT_ALLOWED");
  const header = readBackendConfig({ V3_BACKEND_URL: "http://b/api/v3" });
  assert.ok(header.ok);
  const plain = backendHeaders(header, { userId: "dev:a@b.c", orgId: "org_mine" });
  assert.ok(plain.ok && plain.headers["X-Org-Id"] === "org_mine" && !("Authorization" in plain.headers));
  const bad = backendHeaders(header, { orgId: "org mine;" });
  assert.ok(!bad.ok && bad.code === "INVALID_ORG");
});

test("오류 본문에서 코드를 읽는다", () => {
  assert.equal(errorCodeOf({ error: { code: "EMAIL_TAKEN", message: "…" } }), "EMAIL_TAKEN");
  assert.equal(errorCodeOf({ error: "x" }), null);
  assert.equal(errorCodeOf(null), null);
});
