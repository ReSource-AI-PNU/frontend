/**
 * 회사 정보 고치기(사업자등록번호 형식), 비밀번호 규칙, 구성원 관리, 계정 지우기(409 TRANSFER_OWNERSHIP_FIRST) 처리.
 * 실행: node --test tests/manage.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Membership } from "../src/lib/auth/account.ts";
import {
  aloneOrgs,
  bizNoError,
  blockersFromError,
  companyErrors,
  companyFailure,
  companyPatch,
  complexIdFor,
  DELETE_MESSAGE,
  deleteFailure,
  isUnsupported,
  KEEP_REGION,
  leaveBlock,
  memberFailure,
  newPasswordError,
  passwordErrors,
  passwordFailure,
  soleOwnerOrgs,
  type ComplexRef,
} from "../src/lib/auth/manage.ts";

const JARGON = /[A-Z_]{4,}|백엔드|서버 오류|\b\d{3}\b/;

const COMPLEXES: ComplexRef[] = [
  { id: "noksan", name: "녹산국가산업단지", region: "부산", center: [128.8475, 35.0925] },
  { id: "changwon", name: "창원국가산업단지", region: "경남", center: [128.6725, 35.208] },
];

test("사업자등록번호: 비우면 통과하고, 붙임표와 띄어쓰기는 받되 10자리와 검증 숫자를 본다", () => {
  assert.equal(bizNoError(""), null);
  assert.equal(bizNoError("   "), null);
  assert.equal(bizNoError("220-81-62517"), null);
  assert.equal(bizNoError("2208162517"), null);
  assert.equal(bizNoError(" 124 81 00998 "), null);
  assert.match(bizNoError("220-81-6251") ?? "", /10자리/);
  assert.match(bizNoError("220-81-625170") ?? "", /10자리/, "11자리를 잘라 받지 않는다");
  assert.match(bizNoError("220-81-62518") ?? "", /다시 확인/, "검증 숫자가 틀리면 막는다");
  assert.match(bizNoError("220.81.62517") ?? "", /숫자와 -만/);
  assert.match(bizNoError("가나다-81-62517") ?? "", /숫자와 -만/);
});

test("회사 정보: 이름 길이, 사업자등록번호, 주소 길이를 칸마다 알려 준다", () => {
  assert.deepEqual(companyErrors({ name: "(주)가나정밀", bizNo: "", address: "", complexId: "noksan" }), {});
  const errors = companyErrors({ name: " 가 ", bizNo: "1234567890", address: "가".repeat(121), complexId: "" });
  assert.match(errors.name ?? "", /2자 이상/);
  assert.match(errors.bizNo ?? "", /다시 확인/);
  assert.match(errors.address ?? "", /120자/);
  assert.match(companyErrors({ name: "가".repeat(61), bizNo: "", address: "", complexId: "" }).name ?? "", /60자/);
});

test("회사 정보: 지역은 회사 등록 때와 같은 글로 보내고, 그대로 두면 보내지 않으며, 비운 칸은 null로 지운다", () => {
  assert.deepEqual(companyPatch({ name: " 가나 ", bizNo: "220-81-62517", address: " 녹산산단로 1 ", complexId: "noksan" }, COMPLEXES), {
    name: "가나",
    bizNo: "2208162517",
    address: "녹산산단로 1",
    region: "부산 녹산국가산업단지",
    location: [128.8475, 35.0925],
  });
  assert.deepEqual(companyPatch({ name: "가나", bizNo: "", address: "", complexId: "" }, COMPLEXES), {
    name: "가나",
    bizNo: null,
    address: null,
    region: null,
    location: null,
  });
  const kept = companyPatch({ name: "가나", bizNo: "", address: "", complexId: KEEP_REGION }, COMPLEXES);
  assert.equal("region" in kept, false);
  assert.equal("location" in kept, false);
});

test("회사 정보: 저장된 지역 글로 산업단지를 다시 고른다", () => {
  assert.equal(complexIdFor("경남 창원국가산업단지", COMPLEXES), "changwon");
  assert.equal(complexIdFor("녹산국가산업단지", COMPLEXES), "noksan");
  assert.equal(complexIdFor(null, COMPLEXES), "");
  assert.equal(complexIdFor("서울 구로", COMPLEXES), KEEP_REGION);
});

test("비밀번호: 가입과 같은 규칙(8자 이상, 200자까지)이고 확인 칸이 같아야 한다", () => {
  assert.match(newPasswordError("1234567") ?? "", /8자 이상/);
  assert.equal(newPasswordError("12345678"), null);
  assert.match(newPasswordError("a".repeat(201)) ?? "", /너무 깁니다/);
  assert.match(newPasswordError("        ") ?? "", /빈칸/);

  assert.deepEqual(passwordErrors({ current: "old-password", next: "new-password", confirm: "new-password" }), {});
  const empty = passwordErrors({ current: "", next: "", confirm: "" });
  assert.match(empty.current ?? "", /지금 쓰는 비밀번호/);
  assert.match(empty.next ?? "", /8자 이상/);
  assert.equal(empty.confirm, undefined, "새 비밀번호가 틀리면 확인 칸은 따로 탓하지 않는다");
  assert.match(passwordErrors({ current: "same-password", next: "same-password", confirm: "same-password" }).next ?? "", /다르게/);
  assert.match(passwordErrors({ current: "old-password", next: "new-password", confirm: "new-passw0rd" }).confirm ?? "", /맞지 않습니다/);
});

test("비밀번호: 지금 비밀번호가 틀리면(401) 그 칸에, 시도가 많으면(429) 기다리라고 적는다", () => {
  assert.deepEqual(passwordFailure(401, "INVALID_CREDENTIALS"), { field: "current", message: "지금 쓰는 비밀번호가 맞지 않습니다." });
  assert.equal(passwordFailure(429, "RATE_LIMITED").field, undefined);
  assert.match(passwordFailure(429, "RATE_LIMITED").message, /잠시 후/);
  assert.equal(passwordFailure(422, "INVALID_VALUE").field, "next");
  assert.match(passwordFailure(422, "INVALID_VALUE").message, /8자 이상이고 지금 쓰는 비밀번호와 달라야/, "8자 미만이거나 지금과 같으면 422다");
  assert.match(passwordFailure(429, "TOO_MANY_ATTEMPTS").message, /잠시 후/);
  for (const [status, code] of [[401, "INVALID_CREDENTIALS"], [429, null], [422, null], [500, "500"], [503, "BACKEND_UNREACHABLE"]] as const) {
    assert.doesNotMatch(passwordFailure(status, code).message, JARGON);
  }
});

test("아직 열리지 않은 기능(404·405)과 업무상 404를 가른다", () => {
  assert.equal(isUnsupported(404, "404"), true, "FastAPI 기본 404에는 업무 코드가 없다");
  assert.equal(isUnsupported(404, null), true);
  assert.equal(isUnsupported(404, "NOT_FOUND"), true);
  assert.equal(isUnsupported(405, "405"), true, "GET만 있는 주소에 DELETE를 보내면 405다");
  assert.equal(isUnsupported(404, "MEMBER_NOT_FOUND"), false);
  assert.equal(isUnsupported(409, "TRANSFER_OWNERSHIP_FIRST"), false);
  assert.equal(isUnsupported(500, "500"), false);
});

test("구성원: 소유자가 나 혼자면 나갈 수 없다(다른 구성원이 있으면 먼저 소유자를 정한다)", () => {
  assert.equal(leaveBlock("u1", [{ userId: "u1", memberRole: "owner" }, { userId: "u2", memberRole: "member" }]), "last_owner");
  assert.equal(leaveBlock("u1", [{ userId: "u1", memberRole: "owner" }, { userId: "u2", memberRole: "owner" }]), null);
  assert.equal(leaveBlock("u1", [{ userId: "u1", memberRole: "owner" }]), "alone", "혼자인 회사의 소유자도 마지막 소유자다");
  assert.equal(leaveBlock("u2", [{ userId: "u1", memberRole: "owner" }, { userId: "u2", memberRole: "member" }]), null);
  assert.match(memberFailure("leave", 409, "LAST_OWNER"), /마지막 소유자는 나갈 수 없습니다/);
  assert.match(memberFailure("remove", 409, "LAST_OWNER"), /소유자로 정해/);
  assert.match(memberFailure("remove", 403, "OWNER_ONLY"), /소유자만/);
  assert.match(memberFailure("remove", 404, "MEMBER_NOT_FOUND"), /이미 회사에서 빠진/);
  assert.match(memberFailure("owner", 403, "NOT_A_MEMBER"), /구성원이 아닙니다/);
  for (const action of ["remove", "leave", "owner"] as const) {
    for (const status of [403, 404, 409, 429, 500]) assert.doesNotMatch(memberFailure(action, status, null), JARGON);
  }
  assert.match(companyFailure(422, "INVALID_VALUE"), /다시 확인/);
  assert.match(companyFailure(403, "OWNER_ONLY"), /소유자만/);
  assert.match(companyFailure(403, "DEMO_READ_ONLY"), /시연 회사/);
  for (const [status, code] of [[403, "DEMO_READ_ONLY"], [403, "NOT_A_MEMBER"], [422, "INVALID_VALUE"], [429, null], [500, null]] as const) {
    assert.doesNotMatch(companyFailure(status, code), JARGON);
  }
});

const MEMBERSHIPS: Membership[] = [
  { orgId: "org_a", orgName: "(주)가나", kind: "emitter", memberRole: "owner" },
  { orgId: "org_b", orgName: "(주)다라", kind: "vendor", memberRole: "owner" },
  { orgId: "org_c", orgName: "(주)마바", kind: "emitter", memberRole: "member" },
];

test("계정 지우기: 409 TRANSFER_OWNERSHIP_FIRST는 소유자를 넘기라는 뜻이고, 나머지 실패도 쉬운 말로 적는다", () => {
  assert.equal(deleteFailure(409, "TRANSFER_OWNERSHIP_FIRST"), "transfer");
  assert.equal(deleteFailure(409, "RUN_IN_PROGRESS"), "running", "진행 중인 찾기가 있으면 아무것도 지우지 않는다");
  assert.match(DELETE_MESSAGE.running, /진행 중인 찾기가 끝난 뒤 다시 시도해 주세요/);
  assert.equal(deleteFailure(429, "TOO_MANY_ATTEMPTS"), "rate_limited");
  assert.equal(deleteFailure(401, "INVALID_CREDENTIALS"), "password");
  assert.equal(deleteFailure(422, "INVALID_BODY"), "password");
  assert.equal(deleteFailure(429, "RATE_LIMITED"), "rate_limited");
  assert.equal(deleteFailure(405, "405"), "unsupported");
  assert.equal(deleteFailure(404, "404"), "unsupported");
  assert.equal(deleteFailure(409, "CONFLICT"), "unavailable", "다른 409는 소유자 넘기기로 보지 않는다");
  assert.equal(deleteFailure(503, "BACKEND_UNREACHABLE"), "unavailable");
  for (const message of Object.values(DELETE_MESSAGE)) assert.doesNotMatch(message, JARGON);
});

test("계정 지우기: 409 본문에 실린 회사를 여러 꼴로 읽고, 이름이 없으면 내 소속에서 찾는다", () => {
  const body = (error: Record<string, unknown>) => ({ error: { code: "TRANSFER_OWNERSHIP_FIRST", message: "…", ...error } });
  assert.deepEqual(blockersFromError(body({ orgs: [{ orgId: "org_a", orgName: "(주)가나" }] }), MEMBERSHIPS), [
    { orgId: "org_a", orgName: "(주)가나" },
  ]);
  assert.deepEqual(blockersFromError(body({ orgs: [{ id: "org_b", name: "다라" }, "org_a"] }), MEMBERSHIPS), [
    { orgId: "org_b", orgName: "다라" },
    { orgId: "org_a", orgName: "(주)가나" },
  ]);
  assert.deepEqual(blockersFromError(body({ orgIds: ["org_b", "org_b"] }), MEMBERSHIPS), [{ orgId: "org_b", orgName: "(주)다라" }]);
  assert.deepEqual(blockersFromError(body({ orgId: "org_a" }), MEMBERSHIPS), [{ orgId: "org_a", orgName: "(주)가나" }]);
  assert.deepEqual(blockersFromError(body({ details: { orgId: "org_x", orgName: "모르는 회사" } }), MEMBERSHIPS), [
    { orgId: "org_x", orgName: "모르는 회사" },
  ]);
  assert.deepEqual(blockersFromError(body({}), MEMBERSHIPS), [], "회사를 싣지 않으면 빈 목록(직접 찾는다)");
  assert.deepEqual(blockersFromError("Not Found", MEMBERSHIPS), []);
});

test("계정 지우기: 본문에 회사가 없으면 구성원 목록으로 소유자가 나 혼자인 회사를 찾는다", () => {
  const blockers = soleOwnerOrgs("u1", MEMBERSHIPS, {
    org_a: [
      { userId: "u1", memberRole: "owner" },
      { userId: "u2", memberRole: "member" },
    ],
    org_b: [{ userId: "u1", memberRole: "owner" }],
  });
  assert.deepEqual(blockers, [{ orgId: "org_a", orgName: "(주)가나" }], "혼자인 회사와 구성원으로 속한 회사는 막지 않는다");
  assert.deepEqual(
    soleOwnerOrgs("u1", MEMBERSHIPS, { org_a: null, org_b: [{ userId: "u1", memberRole: "owner" }] }),
    [{ orgId: "org_a", orgName: "(주)가나" }],
    "구성원을 읽지 못한 회사는 막는 것으로 본다",
  );
});

test("계정 지우기: 구성원이 나 하나뿐인 내 회사는 함께 지워지는 회사로 적는다(읽지 못한 회사는 적지 않는다)", () => {
  assert.deepEqual(
    aloneOrgs("u1", MEMBERSHIPS, {
      org_a: [
        { userId: "u1", memberRole: "owner" },
        { userId: "u2", memberRole: "member" },
      ],
      org_b: [{ userId: "u1", memberRole: "owner" }],
      org_c: [{ userId: "u1", memberRole: "member" }],
    }),
    [{ orgId: "org_b", orgName: "(주)다라" }],
  );
  assert.deepEqual(aloneOrgs("u1", MEMBERSHIPS, { org_a: null, org_b: null }), []);
});
