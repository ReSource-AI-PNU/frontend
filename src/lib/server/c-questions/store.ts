import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// One queue per process, shared by every instance using this module.
let queue: Promise<unknown> = Promise.resolve();
export function createStore(directory: string) {
  const file = path.join(directory, "c-questions.json");
  async function read(): Promise<Record<string, unknown>[]> {
    let contents: string;
    try { contents = await readFile(file, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const rows: unknown = JSON.parse(contents);
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || typeof r.id !== "string")) throw new Error("Invalid C question store");
    return rows;
  }
  async function transact<T>(fn: (rows: Record<string, unknown>[]) => Promise<{ result: T; changed: boolean }>): Promise<T> {
    const run = queue.then(async () => {
      const rows = await read();
      const { result, changed } = await fn(rows);
      if (changed) {
        await mkdir(directory, { recursive: true });
        const tmp = `${file}.${randomUUID()}.tmp`;
        await writeFile(tmp, JSON.stringify(rows));
        await rename(tmp, file);
      }
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  }
  return { transact };
}
