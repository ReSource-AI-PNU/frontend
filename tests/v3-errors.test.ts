/**
 * 화면에 보이는 오류 문구에 개발자 말(코드, 환경 변수, 서비스 이름)이 섞이지 않는지 본다.
 * 실행: node --test tests/v3-errors.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { UNAVAILABLE, userMessage } from "../src/lib/v3/errors.ts";

const JARGON = /[A-Z_]{4,}|V3_|\.env|백엔드|Document Intelligence|Prompt Shields|Azure|Entra|규칙 정책|모델 미연결|예시 데이터/;

test("닿지 못했거나 서버 오류면 다시 시도하라고만 말한다", () => {
  assert.equal(userMessage(0, "UNREACHABLE", null), UNAVAILABLE);
  assert.equal(userMessage(502, "BACKEND_UNREACHABLE", "백엔드에 연결하지 못했습니다."), UNAVAILABLE);
  assert.equal(userMessage(503, "BACKEND_NOT_SET", "서버에 백엔드 주소(V3_BACKEND_URL)가 설정되지 않았습니다."), UNAVAILABLE);
  assert.equal(userMessage(500, "INTERNAL", null), UNAVAILABLE);
});

test("업무 상태를 설명하는 서버 문장은 그대로 둔다", () => {
  assert.equal(userMessage(409, "APPROVAL_BLOCKED", "업체가 조건을 바꿔 승인이 막혔습니다."), "업체가 조건을 바꿔 승인이 막혔습니다.");
  assert.equal(userMessage(403, "DEMO_READ_ONLY", "체험 중에는 둘러보기만 할 수 있습니다."), "체험 중에는 둘러보기만 할 수 있습니다.");
  const stale = "후보를 찾은 뒤 재질이 PP에서 알루미늄으로 바뀌었습니다. 바뀐 자료로 받아 줄 곳을 다시 찾아 주세요.";
  assert.equal(userMessage(409, "OUTSIDE_STALE", stale), stale);
});

test("서비스 이름이 들어간 서버 문장은 다음 행동을 알려 주는 말로 바꾼다", () => {
  const message = userMessage(503, "DOCUMENT_INTELLIGENCE_UNAVAILABLE", "Document Intelligence가 설정되지 않아 글이 아닌 문서를 읽을 수 없다");
  assert.ok(!JARGON.test(message), message);
  assert.match(userMessage(502, "DETECTOR_FAILED", "탐지 엔드포인트 호출 실패"), /분석하지 못했습니다/);
  // 깨진 파일은 다른 파일로, 서비스에 닿지 못했으면 같은 파일을 다시 올리라고 알린다
  assert.match(userMessage(422, "DOCUMENT_UNREADABLE", "파일을 열지 못했습니다"), /손상되지 않은 PDF/);
  assert.match(userMessage(502, "DOCUMENT_FAILED", "문서 분석 요청이 거부됐습니다(500)."), /같은 파일을 다시/);
});

test("어떤 코드와 상태에도 개발자 말이 나오지 않는다", () => {
  const codes = ["ORG_REQUIRED", "TOKEN_REQUIRED", "INVALID_TOKEN", "UNKNOWN_ORG", "FORBIDDEN", "WRONG_ROLE", "NOT_FOUND", "SESSION_NOT_FOUND", "INVALID_JSON", "INVALID_BODY", "TOO_LARGE", "UNSUPPORTED_MEDIA", "SHIELD_FAILED", "DOCUMENT_FAILED", "DOCUMENT_UNREADABLE", "LOGIN_REQUIRED", "TOKENS_INVALID"];
  for (const code of codes) {
    for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 502, 503]) {
      const message = userMessage(status, code, `${code}: X-Org-Id 헤더 문제 (V3_ORG_TOKENS)`);
      assert.ok(!JARGON.test(message), `${status} ${code}: ${message}`);
    }
  }
});
