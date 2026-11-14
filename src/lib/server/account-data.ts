import "server-only";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Organization } from "@/lib/domain";
import { UPLOAD_DIR } from "./mock/db";
import { listMembers, removeMembersOfOrg } from "./mock/members";
import { organizations } from "./mock-store";
import { knowledgeCards, labelTasks, outbox, sessions } from "./sessions";

/** 사용자가 만든 카드 id (newId("kc") 형식). 시드 카드(kc_rain_pp 등)와 구분한다. */
const USER_CARD_ID = /^kc_[a-f0-9]{12}$/;

type UploadMeta = { id: string; type: string; name: string; orgId: string };

async function listUploads(orgId: string): Promise<UploadMeta[]> {
  let files: string[];
  try {
    files = await readdir(UPLOAD_DIR);
  } catch {
    return [];
  }
  const metas = await Promise.all(
    files
      .filter((f) => /^up_[a-f0-9]{12}\.json$/.test(f))
      .map(async (f) => {
        try {
          const meta = JSON.parse(await readFile(path.join(UPLOAD_DIR, f), "utf8")) as Omit<UploadMeta, "id">;
          return { ...meta, id: f.replace(/\.json$/, "") };
        } catch {
          return null;
        }
      }),
  );
  return metas.filter((m): m is UploadMeta => m !== null && m.orgId === orgId);
}

/** 회사 하나에 속한 데이터 전체. 내보내기와 탈퇴가 같은 범위를 쓰도록 한곳에서 정한다. */
export async function collectOrgData(org: Organization) {
  const [orgSessions, orgOutbox, orgMembers, uploads] = await Promise.all([
    sessions.filter((s) => s.orgId === org.id),
    outbox.filter((m) => m.orgId === org.id),
    listMembers(org.id),
    listUploads(org.id),
  ]);
  const sessionIds = new Set(orgSessions.map((s) => s.id));
  const [cards, labels] = await Promise.all([
    knowledgeCards.filter(
      (c) => (c.sourceSessionId ? sessionIds.has(c.sourceSessionId) : false) || (c.orgName === org.name && USER_CARD_ID.test(c.id)),
    ),
    labelTasks.filter((t) => sessionIds.has(t.sessionId)),
  ]);
  return { sessions: orgSessions, outbox: orgOutbox, members: orgMembers, uploads, knowledgeCards: cards, labelTasks: labels };
}

export type OrgDataSummary = Record<"sessions" | "outbox" | "members" | "uploads" | "knowledgeCards" | "labelTasks", number>;

export async function summarizeOrgData(org: Organization): Promise<OrgDataSummary> {
  const d = await collectOrgData(org);
  return {
    sessions: d.sessions.length,
    outbox: d.outbox.length,
    members: d.members.length,
    uploads: d.uploads.length,
    knowledgeCards: d.knowledgeCards.length,
    labelTasks: d.labelTasks.length,
  };
}

/** 회사 데이터를 모두 지운다. 되돌릴 수 없다. */
export async function deleteOrgData(org: Organization, userId: string) {
  const d = await collectOrgData(org);
  const sessionIds = new Set(d.sessions.map((s) => s.id));
  const cardIds = new Set(d.knowledgeCards.map((c) => c.id));

  for (const u of d.uploads) {
    await rm(path.join(UPLOAD_DIR, u.id), { force: true });
    await rm(path.join(UPLOAD_DIR, `${u.id}.json`), { force: true });
  }
  await labelTasks.remove((t) => sessionIds.has(t.sessionId));
  await knowledgeCards.remove((c) => cardIds.has(c.id));
  // 다른 회사 카드에 남긴 동의 표시도 지운다
  const agreed = await knowledgeCards.filter((c) => c.agrees.includes(userId));
  for (const c of agreed) {
    await knowledgeCards.update(c.id, (row) => ({ ...row, agrees: row.agrees.filter((a) => a !== userId) }));
  }
  await outbox.remove((m) => m.orgId === org.id);
  await sessions.remove((s) => s.orgId === org.id);
  await removeMembersOfOrg(org.id);
  await organizations.remove((o) => o.id === org.id);
}
