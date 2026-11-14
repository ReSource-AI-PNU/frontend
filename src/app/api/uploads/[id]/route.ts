import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { UPLOAD_DIR } from "@/lib/server/mock/db";
import { findOrganizationByOwner } from "@/lib/server/mock-store";

/** 업로드한 사진·영상·PDF. 같은 회사 사용자만 받을 수 있다. */
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  const { id } = await ctx.params;
  if (!/^up_[a-f0-9]{12}$/.test(id)) return new Response("Not found", { status: 404 });
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  try {
    const meta = JSON.parse(await readFile(path.join(UPLOAD_DIR, `${id}.json`), "utf8")) as { type: string; orgId: string };
    const org = await findOrganizationByOwner(session.user.id);
    if (!org || org.id !== meta.orgId) return new Response("Not found", { status: 404 });
    const body = await readFile(path.join(UPLOAD_DIR, id));
    return new Response(body, {
      headers: { "Content-Type": meta.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
