import "server-only";
import type { MemberKind } from "@/lib/auth/account";
import { backendConfig, callBackend } from "./backend";

export type DemoOrg = { id: string; name: string; kind: MemberKind };

let cached: { at: number; orgs: DemoOrg[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

function normalize(list: unknown): DemoOrg[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const org = item as { id?: unknown; name?: unknown; kind?: unknown; role?: unknown };
    const kind = (org.kind ?? org.role) as unknown;
    if (typeof org.id !== "string" || (kind !== "emitter" && kind !== "vendor" && kind !== "admin")) return [];
    return [{ id: org.id, name: typeof org.name === "string" ? org.name : org.id, kind }];
  });
}

/**
 * 체험하기에서 보여 줄 시연 회사들(GET /demo/orgs). 5분 동안 기억한다.
 * 로컬 개발 서버(header 모드)에 이 주소가 없으면 조직 목록(GET /orgs)의 맨 앞 회사들로 대신한다.
 */
export async function demoOrgs(): Promise<DemoOrg[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.orgs;
  let orgs: DemoOrg[] = [];
  try {
    orgs = normalize(await callBackend("/demo/orgs", { demo: true }));
  } catch (error) {
    const config = backendConfig();
    if (!(config.ok && config.mode === "header")) throw error;
    const all = await callBackend<{ order?: number }[]>("/orgs");
    orgs = normalize([...all].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)));
  }
  cached = { at: Date.now(), orgs };
  return orgs;
}

/** 체험하기의 주인공: 시연 회사 가운데 첫 배출 기업. 없으면 null */
export async function demoCompany(): Promise<DemoOrg | null> {
  try {
    const orgs = await demoOrgs();
    return orgs.find((item) => item.kind === "emitter") ?? null;
  } catch {
    return null;
  }
}
