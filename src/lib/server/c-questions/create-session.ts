"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "../session";
import { requireOrganization } from "../organization";
import { sessions } from "../sessions";
import { newId, nowIso } from "../mock/db";

export async function createManualCSession() {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  const id = newId("ses");
  const now = nowIso();
  await sessions.insert({ id, kind: "c-manual", orgId: org.id, ownerId: user.id, complexId: org.complexId,
    title: `${org.name} PP 직접 입력`, createdAt: now, updatedAt: now, status: "in-progress",
    step: "classify", streams: [], questions: [], corrections: [] });
  redirect(`/c/${id}`);
}
