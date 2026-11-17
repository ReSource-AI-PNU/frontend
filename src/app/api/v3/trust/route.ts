/**
 * 공개 평가 결과(GET /trust, 백엔드 docs/v3/eval/latest.json)를 넘기는 통로. 로그인 없이 읽기만 한다.
 * AI 신뢰도 화면(/trust)이 부른다. 사람·회사 머리글은 붙이지 않는다(src/lib/v3/backend-plan.ts의 public).
 * GET만 내보내므로 다른 메서드는 Next가 405로 막는다.
 */
import { forwardToBackend } from "@/lib/server/proxy";

export async function GET(request: Request) {
  return forwardToBackend(request, ["trust"], { kind: "public" });
}
