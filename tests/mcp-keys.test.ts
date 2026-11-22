/**
 * 외부 AI 에이전트 연결 화면의 순수 함수(src/lib/v3/mcp-keys.ts).
 * 실행: node --test tests/mcp-keys.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { connectionExamples, keyCountLine } from "../src/lib/v3/mcp-keys.ts";

test("키가 없으면 자리표시, 만든 직후에는 실제 키로 예시를 채운다", () => {
  const blank = connectionExamples("https://x.example/mcp/vendor", null);
  assert.equal(blank.header, "Authorization: Bearer <키>");
  assert.ok(blank.claudeCode.includes("claude mcp add --transport http resource-ai https://x.example/mcp/vendor"));
  const filled = connectionExamples("https://x.example/mcp/vendor", "rsai_abc");
  assert.equal(JSON.parse(filled.json).mcpServers["resource-ai"].headers.Authorization, "Bearer rsai_abc");
  assert.equal(JSON.parse(filled.json).mcpServers["resource-ai"].url, "https://x.example/mcp/vendor");
});

test("연결 키 수 문장", () => {
  assert.match(keyCountLine(0, 5), /없습니다/);
  assert.equal(keyCountLine(2, 5), "연결 키 2개 · 최대 5개");
});
