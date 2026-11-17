/**
 * 백엔드(/api/v3)로 넘기는 서버 쪽 통로. 브라우저는 이 주소(/api/v3/*)만 부르고, 백엔드 주소와 서버 키는 서버에만 둔다.
 *
 *   NEXT_PUBLIC_API_BASE=/api/v3            브라우저가 부를 주소(이 통로)
 *   V3_BACKEND_URL=https://.../api/v3       실제 백엔드. 접두어 /api/v3까지 적는다
 *   V3_AUTH=bff, V3_BFF_KEY=...             운영. 서버 키와 X-User-Id, X-Org-Id를 붙인다
 *
 * - /health 말고는 로그인한 사용자만 지나간다.
 * - 회사는 세션의 활성 회사로만 정한다. 브라우저가 보낸 X-Org-Id는 쓰지 않는다(src/lib/v3/backend-plan.ts).
 */
import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/server/proxy";

async function forward(request: Request, context: RouteContext<"/api/v3/[...path]">) {
  const { path } = await context.params;
  const session = await auth();
  const userId = session?.user?.id || null;
  const memberships = session?.memberships ?? [];
  const orgId = memberships.some((item) => item.orgId === session?.activeOrgId) ? (session?.activeOrgId ?? null) : null;
  return forwardToBackend(request, path, { kind: "member", userId, orgId });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
