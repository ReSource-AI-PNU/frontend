/**
 * 외부 AI 에이전트 연결(MCP 키) 화면의 순수 함수. 네트워크도 React도 부르지 않는다(tests/mcp-keys.test.ts).
 */

/** 연결 키 수 한 줄 */
export function keyCountLine(count: number, limit: number): string {
  return count === 0 ? `연결한 에이전트가 없습니다. 키는 ${limit}개까지 만들 수 있습니다.` : `연결 키 ${count}개 · 최대 ${limit}개`;
}

/** 연결 예시(주소, 인증 헤더, Claude Code 명령, 설정 JSON). 키가 없으면 <키> 자리표시를 둔다 */
export function connectionExamples(url: string, token: string | null) {
  const key = token ?? "<키>";
  const header = `Authorization: Bearer ${key}`;
  return {
    header,
    claudeCode: `claude mcp add --transport http resource-ai ${url} --header "${header}"`,
    json: JSON.stringify({ mcpServers: { "resource-ai": { type: "http", url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
  };
}
