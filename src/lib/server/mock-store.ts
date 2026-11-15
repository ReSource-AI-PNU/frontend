import "server-only";
import type { Organization } from "@/lib/domain";
import { collection, newId, nowIso } from "./mock/db";
import { backendForUser, type Identity } from "@/lib/platform/server";

/** 회사 정보. 백엔드 be#23(기업 프로필 API) 연동 전까지 모의 저장소를 쓴다. */
export const organizations = collection<Organization>("organizations");

export async function findOrganizationByOwner(ownerId: string) {
  if (process.env.PLATFORM_API_URL) return (await backendForUser<Identity>("identity")).organizations[0] ?? null;
  return organizations.find((o) => o.ownerId === ownerId);
}

export async function upsertOrganization(
  ownerId: string,
  input: Omit<Organization, "id" | "ownerId" | "createdAt" | "updatedAt">,
) {
  if (process.env.PLATFORM_API_URL) return backendForUser<Organization>("organizations", input);
  const existing = await findOrganizationByOwner(ownerId);
  if (existing) {
    return (await organizations.update(existing.id, (o) => ({ ...o, ...input, updatedAt: nowIso() })))!;
  }
  const now = nowIso();
  return organizations.insert({ ...input, id: newId("org"), ownerId, createdAt: now, updatedAt: now });
}
