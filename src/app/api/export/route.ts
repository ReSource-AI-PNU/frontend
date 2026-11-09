import { auth } from "@/auth";
import { collectOrgData } from "@/lib/server/account-data";
import { findOrganizationByOwner } from "@/lib/server/mock-store";

/**
 * 데이터 내보내기 (개인정보 열람·전송 요구). 현재 사용자 회사의 데이터를 JSON 파일 하나로 내려준다.
 * 업로드 파일 본문은 크기 때문에 넣지 않고 목록만 넣는다.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const org = await findOrganizationByOwner(session.user.id);
  if (!org) return new Response("Not found", { status: 404 });

  const data = await collectOrgData(org);
  const exportedAt = new Date();
  const body = {
    format: "resource-ai-export",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    account: { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
    organization: org,
    members: data.members.map(({ id, name, email, role, status, invitedAt, owner }) => ({
      id,
      name,
      email,
      role,
      status,
      invitedAt,
      owner: Boolean(owner),
    })),
    sessions: data.sessions,
    knowledgeCards: data.knowledgeCards,
    labelTasks: data.labelTasks,
    outbox: data.outbox,
    uploads: data.uploads.map(({ id, name, type }) => ({ id, name, type })),
  };

  const stamp = exportedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="resource-ai-export-${stamp}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
