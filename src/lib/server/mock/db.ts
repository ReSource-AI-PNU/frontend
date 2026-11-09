import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 백엔드 연동 전까지 쓰는 모의 저장소. 컬렉션마다 .mock-db/<name>.json 파일 하나에 배열로 저장한다.
 * 단일 개발 서버 프로세스 기준이며, 쓰기는 프로세스 안에서 순서대로 처리한다.
 */
const DB_DIR = path.join(process.cwd(), ".mock-db");

let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function readAll<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path.join(DB_DIR, `${name}.json`), "utf8")) as T[];
  } catch {
    return [];
  }
}

async function writeAll<T>(name: string, rows: T[]) {
  await mkdir(DB_DIR, { recursive: true });
  const file = path.join(DB_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2));
  await rename(tmp, file);
}

export type Collection<T extends { id: string }> = {
  all(): Promise<T[]>;
  find(predicate: (row: T) => boolean): Promise<T | null>;
  filter(predicate: (row: T) => boolean): Promise<T[]>;
  get(id: string): Promise<T | null>;
  insert(row: T): Promise<T>;
  update(id: string, patch: (row: T) => T): Promise<T | null>;
  remove(predicate: (row: T) => boolean): Promise<number>;
  /** 비어 있을 때만 시드를 넣는다 */
  seed(rows: () => T[] | Promise<T[]>): Promise<void>;
};

export function collection<T extends { id: string }>(name: string): Collection<T> {
  return {
    all: () => readAll<T>(name),
    async find(predicate) {
      return (await readAll<T>(name)).find(predicate) ?? null;
    },
    async filter(predicate) {
      return (await readAll<T>(name)).filter(predicate);
    },
    async get(id) {
      return (await readAll<T>(name)).find((r) => r.id === id) ?? null;
    },
    insert: (row) =>
      serialize(async () => {
        const rows = await readAll<T>(name);
        rows.push(row);
        await writeAll(name, rows);
        return row;
      }),
    update: (id, patch) =>
      serialize(async () => {
        const rows = await readAll<T>(name);
        const i = rows.findIndex((r) => r.id === id);
        if (i < 0) return null;
        rows[i] = patch(rows[i]);
        await writeAll(name, rows);
        return rows[i];
      }),
    remove: (predicate) =>
      serialize(async () => {
        const rows = await readAll<T>(name);
        const kept = rows.filter((r) => !predicate(r));
        await writeAll(name, kept);
        return rows.length - kept.length;
      }),
    seed: (rows) =>
      serialize(async () => {
        const existing = await readAll<T>(name);
        if (existing.length > 0) return;
        await writeAll(name, await rows());
      }),
  };
}

export const UPLOAD_DIR = path.join(DB_DIR, "uploads");

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
