import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Organization } from "@/lib/domain";

/**
 * 백엔드(be#23) 연동 전까지 쓰는 모의 저장소. .mock-db/db.json에 저장한다.
 * 단일 프로세스 개발 서버 기준이며, 여러 인스턴스로 배포하면 동작하지 않는다.
 */
type Db = { organizations: Record<string, Organization> };

const DB_DIR = path.join(process.cwd(), ".mock-db");
const DB_FILE = path.join(DB_DIR, "db.json");

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(DB_FILE, "utf8")) as Db;
  } catch {
    return { organizations: {} };
  }
}

async function save(db: Db) {
  await mkdir(DB_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_FILE);
}

export async function findOrganizationByOwner(ownerId: string) {
  const db = await load();
  return Object.values(db.organizations).find((o) => o.ownerId === ownerId) ?? null;
}

export async function upsertOrganization(
  ownerId: string,
  input: Omit<Organization, "id" | "ownerId" | "createdAt" | "updatedAt">,
) {
  const db = await load();
  const now = new Date().toISOString();
  const existing = Object.values(db.organizations).find((o) => o.ownerId === ownerId);
  const org: Organization = existing
    ? { ...existing, ...input, updatedAt: now }
    : { ...input, id: crypto.randomUUID(), ownerId, createdAt: now, updatedAt: now };
  db.organizations[org.id] = org;
  await save(db);
  return org;
}
