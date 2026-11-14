import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createStore } from "./store.ts";

const fieldNames = ["material", "materialBasis", "form", "contamination", "separation", "process", "sorting", "color", "tradeStage", "region", "quantity"] as const;
const questionIds = ["material", "material_basis", "form", "contamination", "separation", "process", "sorting", "color", "trade_stage", "region", "quantity"] as const;
const simple = z.object({ status: z.enum(["value", "unknown", "unanswered"]), value: z.string().trim().min(1).nullable().optional() }).strict();
const quantity = z.object({ status: z.enum(["value", "unknown", "unanswered"]), value: z.object({ amount: z.number().finite().nonnegative(), unit: z.string().trim().min(1), period: z.string().trim().min(1), basis: z.enum(["measured", "estimated", "unknown"]) }).strict().nullable().optional() }).strict();
const contamination = z.object({ status: z.enum(["value", "unknown", "unanswered"]), value: z.enum(["present", "absent"]).nullable().optional(), description: z.string().nullable().optional() }).strict();
const initial = z.object(Object.fromEntries(fieldNames.map((k) => [k, (k === "quantity" ? quantity : k === "contamination" ? contamination : simple).optional()]))).strict();
const command = z.object({ expectedVersion: z.number().int().nonnegative(), requestId: z.string().trim().min(1).max(128) }).strict();
const displayCommand = command.extend({ selectionId: z.string().uuid(), batchId: z.string().trim().min(1).max(128) });
const answerCommand = command.extend({ batchId: z.string().trim().min(1).max(128), questionId: z.enum(questionIds), answer: z.unknown().optional(), skip: z.boolean().default(false) });
const selectCommand = command;
// Backend fields are validated by its Pydantic contract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>; // backend contract is validated by the backend
export type RecordView = { version: number; state: Json; evaluation: Json; pendingSelection: Json | null };
type Stored = RecordView & { id: string; schemaVersion: 1; requests: Record<string, { hash: string; response: RecordView }> };
type Result = { ok: true; data: RecordView } | { ok: false; code: "conflict" | "not_found" | "invalid"; message: string; latest?: RecordView };
type Backend = (operation: string, body: Json) => Promise<Json>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canonical(value: any): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`; }
function digest(operation: string, payload: Json) { return createHash("sha256").update(canonical({ operation, payload })).digest("hex"); }
function view(r: Stored): RecordView { return structuredClone({ version: r.version, state: r.state, evaluation: r.evaluation, pendingSelection: r.pendingSelection }); }
function find(rows: Record<string, unknown>[], id: string): Stored | undefined { return rows.find((r) => r.id === id) as Stored | undefined; }
function prior(r: Stored, id: string, hash: string): Result | undefined {
  const p = r.requests[`$${id}`];
  if (!p) return;
  return p.hash === hash ? { ok: true, data: structuredClone(p.response) } : { ok: false, code: "conflict", message: "requestId already used for different content", latest: view(r) };
}
function check(r: Stored | undefined, version: number): Result | undefined {
  if (!r) return { ok: false, code: "not_found", message: "C state not initialized" };
  if (r.version !== version) return { ok: false, code: "conflict", message: "Stale version", latest: view(r) };
}
function normalizeInitial(input: unknown): Json {
  const fields = initial.parse(input) as Json;
  const state: Json = { batches: [] };
  for (const name of fieldNames) {
    const field = fields[name] ?? { status: "unanswered" };
    if (name === "form" && field.status === "value" && field.value === "모름") { field.status = "unknown"; field.value = null; }
    if (name === "form" && field.status === "value" && !["가공 전", "압축", "세척·파쇄", "펠렛"].includes(field.value)) throw new Error("Invalid form");
    if ((field.status === "value") !== (field.value != null)) throw new Error(`Invalid ${name} value`);
    state[name] = { ...field, value: field.value ?? null, revision: 0, answeredRevision: field.status === "unknown" ? 0 : null, reaskReason: null };
  }
  return state;
}
export function createCService(store: ReturnType<typeof createStore>, backend: Backend) {
  const flights = new Map<string, { hash: string; promise: Promise<Result> }>();
  async function get(id: string): Promise<Result> { return store.transact(async (rows) => { const r = find(rows, id); return { result: r ? { ok: true, data: view(r) } : { ok: false, code: "not_found", message: "C state not initialized" }, changed: false }; }); }
  async function initialize(id: string, raw: unknown, input: unknown): Promise<Result> {
    const cmd = command.parse(raw); const state = normalizeInitial(input); const hash = digest("initialize", { expectedVersion: cmd.expectedVersion, state });
    return store.transact(async (rows) => {
      const existing = find(rows, id); if (existing) return { result: prior(existing, cmd.requestId, hash) ?? { ok: false, code: "conflict", message: "Already initialized", latest: view(existing) }, changed: false };
      if (cmd.expectedVersion !== 0) return { result: { ok: false, code: "conflict", message: "Expected version must be zero" }, changed: false };
      const evaluation = await backend("evaluate", { state });
      const r: Stored = { id, schemaVersion: 1, version: 1, state, evaluation, pendingSelection: null, requests: {} };
      const response = view(r); r.requests[`$${cmd.requestId}`] = { hash, response }; rows.push(r);
      return { result: { ok: true, data: response }, changed: true };
    });
  }
  async function select(id: string, raw: unknown): Promise<Result> {
    const cmd = selectCommand.parse(raw); const hash = digest("select", { expectedVersion: cmd.expectedVersion }); const key = `${id}\0${cmd.requestId}`;
    const existing = flights.get(key); if (existing) return existing.hash === hash ? existing.promise : { ok: false, code: "conflict", message: "requestId in use with different content" };
    const promise = (async (): Promise<Result> => {
      const snapshot = await store.transact(async (rows) => {
        const r = find(rows, id); const result = r && prior(r, cmd.requestId, hash) || check(r, cmd.expectedVersion);
        return { result: result ?? { ok: true as const, data: view(r!) }, changed: false };
      });
      if (!snapshot.ok) return snapshot;
      // An already committed request must not call the model again.
      const repeated = await store.transact(async (rows) => { const r = find(rows, id); return { result: r && prior(r, cmd.requestId, hash), changed: false }; });
      if (repeated) return repeated;
      if (snapshot.data.evaluation.status !== "questions" || snapshot.data.pendingSelection) return { ok: false, code: "conflict", message: "Selection is not available", latest: snapshot.data };
      const selected = await backend("select", { state: snapshot.data.state });
      return store.transact(async (rows) => {
        const r = find(rows, id); const failure = r && prior(r, cmd.requestId, hash) || check(r, cmd.expectedVersion);
        if (failure) return { result: failure, changed: false };
        r!.version++; r!.evaluation = selected.evaluation;
        r!.pendingSelection = selected.selected?.length ? { id: randomUUID(), selected: selected.selected, snapshotId: selected.snapshotId, source: selected.source, fallbackReason: selected.fallbackReason ?? null } : null;
        const response = view(r!); r!.requests[`$${cmd.requestId}`] = { hash, response };
        return { result: { ok: true, data: response }, changed: true };
      });
    })();
    flights.set(key, { hash, promise }); try { return await promise; } finally { flights.delete(key); }
  }
  async function transition(id: string, operation: "display" | "answer", raw: unknown): Promise<Result> {
    const cmd = operation === "display" ? displayCommand.parse(raw) : answerCommand.parse(raw);
    const { requestId, ...payload } = cmd; const hash = digest(operation, payload);
    return store.transact(async (rows) => {
      const r = find(rows, id); const failure = r && prior(r, requestId, hash) || check(r, cmd.expectedVersion);
      if (failure) return { result: failure, changed: false };
      let body: Json;
      if (operation === "display") {
        const c = cmd as z.infer<typeof displayCommand>; const p = r!.pendingSelection;
        if (!p || p.id !== c.selectionId) return { result: { ok: false, code: "conflict", message: "Selection is no longer pending", latest: view(r!) }, changed: false };
        body = { state: r!.state, batchId: c.batchId, selected: p.selected, snapshotId: p.snapshotId };
      } else {
        const c = cmd as z.infer<typeof answerCommand>;
        if (c.skip && c.answer != null || !c.skip && c.answer == null) return { result: { ok: false, code: "invalid", message: "Provide answer or skip" }, changed: false };
        body = { state: r!.state, batchId: c.batchId, questionId: c.questionId, answer: c.answer ?? null, skip: c.skip };
      }
      const result = await backend(operation, body);
      r!.state = result.state; r!.evaluation = result.evaluation; r!.pendingSelection = null; r!.version++;
      const response = view(r!); r!.requests[`$${requestId}`] = { hash, response };
      return { result: { ok: true, data: response }, changed: true };
    });
  }
  return { get, initialize, select, display: (id: string, raw: unknown) => transition(id, "display", raw), answer: (id: string, raw: unknown) => transition(id, "answer", raw) };
}
