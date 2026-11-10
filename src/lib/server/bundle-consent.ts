import "server-only";
import type { MemberConsent } from "@/lib/bundle-consent";
import type { Session } from "@/lib/session/types";
import { outbox } from "./sessions";

/** 묶음 흐름마다 그룹 기업의 참여 상태. 묶음 참여 제안(bundle-invite)의 회신에서 읽는다 */
export async function bundleConsents(session: Session): Promise<Map<string, MemberConsent[]>> {
  const invites = await outbox.filter((m) => m.sessionId === session.id && m.kind === "bundle-invite");
  const out = new Map<string, MemberConsent[]>();
  for (const b of session.matching?.bundles ?? []) {
    out.set(
      b.streamId,
      b.group.map((g) => {
        if (g.isSelf) return { companyId: g.companyId, name: g.name, state: "self" };
        const m = invites.find((x) => x.toCompanyId === g.companyId && (!x.streamId || x.streamId === b.streamId));
        if (!m) return { companyId: g.companyId, name: g.name, state: "not-sent" };
        return { companyId: g.companyId, name: g.name, state: m.reply?.decision ?? "pending", at: m.reply?.at, reason: m.reply?.reason };
      }),
    );
  }
  return out;
}
