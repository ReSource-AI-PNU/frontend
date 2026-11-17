/**
 * 체험하기(/demo) 화면이 부르는 통로. 로그인 없이 시연 회사 하나를 읽기 전용으로 본다.
 * GET만 넘기고 쓰기는 백엔드에 닿기 전에 403 DEMO_READ_ONLY로 막는다. 시연 회사는 서버가 정한다(GET /demo/orgs).
 */
import { forwardToBackend } from "@/lib/server/proxy";
import { demoCompany } from "@/lib/server/demo";

async function forward(request: Request, context: RouteContext<"/api/v3-demo/[...path]">) {
  const { path } = await context.params;
  const read = request.method === "GET" || request.method === "HEAD";
  // 쓰기는 시연 회사를 찾기 전에 막는다(백엔드를 부르지 않는다)
  const company = read ? await demoCompany() : null;
  return forwardToBackend(request, path, { kind: "demo", orgId: company?.id ?? null });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
