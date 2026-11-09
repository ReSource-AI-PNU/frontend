import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { Company } from "@/lib/domain";

/** 단지 입주 기업. 지금은 가상 시드(public/data/companies)이며, 백엔드 be#13·be#23이 생기면 API로 바꾼다. */
export async function getCompanies(complexId: string): Promise<Company[]> {
  "use cache";
  cacheLife("hours");
  if (!/^[a-z0-9-]+$/.test(complexId)) return [];
  try {
    const file = path.join(process.cwd(), "public", "data", "companies", `${complexId}.json`);
    return JSON.parse(await readFile(file, "utf8")) as Company[];
  } catch {
    return [];
  }
}
