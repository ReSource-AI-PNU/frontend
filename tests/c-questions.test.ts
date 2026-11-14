import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../src/lib/server/c-questions/store.ts";
import { createCService } from "../src/lib/server/c-questions/core.ts";

test("state transitions, retries, conflicts, and restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-test-"));
  try {
    let calls = 0;
    // Test adapter models the backend response contract.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = async (op: string, body: any): Promise<any> => {
      const state = structuredClone(body.state);
      const evaluation = { status: state.batches.length >= 2 ? "limit_reached" : "questions", unconfirmed: ["form"] };
      if (op === "evaluate") return evaluation;
      if (op === "select") { calls++; return { evaluation, selected: [{ id: "form", text: "형태?", why: "확인", kind: "choice", options: ["모름"] }], snapshotId: `s${state.batches.length}`, source: "rule_fallback" }; }
      if (op === "display") { state.batches.push({ id: body.batchId, snapshotId: body.snapshotId, questions: body.selected.map((selection: unknown) => ({ selection, outcome: "pending" })) }); return { state, evaluation: { status: "awaiting_answers" } }; }
      state.batches.at(-1).questions[0].outcome = body.skip ? "skipped" : "answered";
      if (!body.skip) state.form = body.answer;
      return { state, evaluation };
    };
    let service = createCService(createStore(dir), backend);
    const init = await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, { form: { status: "value", value: "모름" } });
    assert(init.ok); assert.equal(init.data.state.form.status, "unknown"); assert.equal(init.data.state.form.value, null);
    const [sel, duplicate] = await Promise.all([service.select("ses", { expectedVersion: 1, requestId: "select" }), service.select("ses", { expectedVersion: 1, requestId: "select" })]);
    assert.deepEqual(sel, duplicate); assert.equal(calls, 1); assert(sel.ok); assert.equal(sel.data.state.batches.length, 0);
    const display = { expectedVersion: 2, requestId: "display", selectionId: sel.data.pendingSelection!.id, batchId: "batch1" };
    const [a, b] = await Promise.all([service.display("ses", display), service.display("ses", { ...display, requestId: "other" })]);
    assert(a.ok); assert(!b.ok && b.code === "conflict"); assert.deepEqual(await service.display("ses", display), a);
    const blocked = await service.select("ses", { expectedVersion: 3, requestId: "pending" }); assert(!blocked.ok && blocked.code === "conflict");
    const reused = await service.display("ses", { ...display, batchId: "other" }); assert(!reused.ok && reused.code === "conflict");
    const answer = { expectedVersion: 3, requestId: "skip", batchId: "batch1", questionId: "form", skip: true };
    const [skipped, competing] = await Promise.all([service.answer("ses", answer), service.answer("ses", { ...answer, requestId: "other-answer" })]);
    assert(skipped.ok); assert(!competing.ok && competing.code === "conflict"); assert.deepEqual(await service.answer("ses", answer), skipped);
    const second = await service.select("ses", { expectedVersion: 4, requestId: "select2" }); assert(second.ok);
    const shown = await service.display("ses", { expectedVersion: 5, requestId: "display2", selectionId: second.data.pendingSelection!.id, batchId: "batch2" }); assert(shown.ok);
    const answered = await service.answer("ses", { expectedVersion: 6, requestId: "answer2", batchId: "batch2", questionId: "form", answer: { status: "unknown", value: null } }); assert(answered.ok);
    service = createCService(createStore(dir), backend); const restored = await service.get("ses"); assert.deepEqual(restored, answered);
    assert.equal(answered.data.state.batches[0].questions[0].outcome, "skipped"); assert.equal(answered.data.evaluation.status, "limit_reached");
    await writeFile(path.join(dir, "c-questions.json"), "broken"); await assert.rejects(service.get("ses"));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("select response is discarded when state changes during model call", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-race-"));
  try {
    let release!: () => void; let started!: () => void;
    const waiting = new Promise<void>((r) => { release = r; }); const entered = new Promise<void>((r) => { started = r; });
    let selections = 0;
    // Test adapter models the backend response contract.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = async (op: string, body: any): Promise<any> => {
      if (op === "evaluate") return { status: "questions" };
      if (op === "select") { selections++; if (selections === 1) { started(); await waiting; } return { evaluation: { status: "questions" }, selected: [{ id: "form" }], snapshotId: "snapshot", source: "rule_fallback" }; }
      return { state: body.state, evaluation: { status: "awaiting_answers" } };
    };
    const service = createCService(createStore(dir), backend);
    await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, {});
    const slow = service.select("ses", { expectedVersion: 1, requestId: "slow" }); await entered;
    const fast = await service.select("ses", { expectedVersion: 1, requestId: "fast" }); assert(fast.ok);
    release(); const stale = await slow; assert(!stale.ok && stale.code === "conflict");
    const current = await service.get("ses"); assert.deepEqual(current, fast);
    const before = await readFile(path.join(dir, "c-questions.json"), "utf8");
    await assert.rejects(service.initialize("other", { expectedVersion: 0, requestId: "bad" }, { form: { status: "value", value: "invalid" } }));
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("backend and storage failures do not commit", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-fail-"));
  try {
    let fail = false;
    const backend = async () => { if (fail) throw new Error("timeout"); return { status: "questions" }; };
    const service = createCService(createStore(dir), backend);
    await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, {});
    const before = await readFile(path.join(dir, "c-questions.json"), "utf8");
    fail = true; await assert.rejects(service.select("ses", { expectedVersion: 1, requestId: "timeout" }));
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
    const fileAsDirectory = path.join(dir, "not-directory"); await writeFile(fileAsDirectory, "x");
    const failingStore = createCService(createStore(fileAsDirectory), async () => ({ status: "questions" }));
    await assert.rejects(failingStore.initialize("ses", { expectedVersion: 0, requestId: "init" }, {}));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("frontend transitions against backend policy with rule selection", async (t) => {
  const { spawnSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const python = path.resolve("../backend/.venv/bin/python");
  if (!existsSync(python)) return t.skip("backend virtual environment unavailable");
  const dir = await mkdtemp(path.join(tmpdir(), "c-policy-"));
  try {
    const backend = async (operation: string, body: Record<string, unknown>) => {
      const run = spawnSync(python, ["-B", "tests/c-policy-bridge.py"], { input: JSON.stringify({ operation, body }), encoding: "utf8" });
      if (run.status !== 0) throw new Error(run.stderr);
      return JSON.parse(run.stdout);
    };
    const service = createCService(createStore(dir), backend);
    const allUnknown = Object.fromEntries(["material", "materialBasis", "form", "contamination", "separation", "process", "sorting", "color", "tradeStage", "region", "quantity"].map((key) => [key, { status: "unknown" }]));
    const complete = await service.initialize("complete", { expectedVersion: 0, requestId: "init" }, allUnknown);
    assert(complete.ok); assert.equal(complete.data.evaluation.status, "complete"); assert(complete.data.evaluation.unconfirmed.length > 0);
    const first = await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, { material: { status: "value", value: "PP" }, form: { status: "value", value: "압축" }, region: { status: "unknown" } });
    assert(first.ok); let version = first.data.version;
    for (let n = 1; n <= 2; n++) {
      const selected = await service.select("ses", { expectedVersion: version, requestId: `select${n}` }); assert(selected.ok); version = selected.data.version;
      assert.equal(selected.data.state.batches.length, n - 1);
      const shown = await service.display("ses", { expectedVersion: version, requestId: `display${n}`, selectionId: selected.data.pendingSelection!.id, batchId: `batch${n}` }); assert(shown.ok); version = shown.data.version;
      assert.equal(shown.data.evaluation.status, "awaiting_answers");
      const blocked = await service.select("ses", { expectedVersion: version, requestId: `blocked${n}` }); assert(!blocked.ok);
      for (const q of shown.data.state.batches[n - 1].questions) {
        const skipped = await service.answer("ses", { expectedVersion: version, requestId: `${n}-${q.selection.id}`, batchId: `batch${n}`, questionId: q.selection.id, skip: true }); assert(skipped.ok); version = skipped.data.version;
      }
    }
    const final = await service.get("ses"); assert(final.ok); assert.equal(final.data.evaluation.status, "limit_reached"); assert.equal(final.data.state.region.status, "unknown");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("existing session collection remains separate from C store", async () => {
  const { spawnSync } = await import("node:child_process");
  const dir = await mkdtemp(path.join(tmpdir(), "c-regression-"));
  try {
    const modulePath = new URL("../src/lib/server/mock/db.ts", import.meta.url).href;
    const script = `import { collection } from ${JSON.stringify(modulePath)}; const s = collection('sessions'); const o = collection('organizations'); await s.insert({id:'ses', title:'before'}); await o.insert({id:'org', name:'unchanged'}); await s.update('ses', x => ({...x,title:'after'})); if ((await s.get('ses')).title !== 'after' || (await o.get('org')).name !== 'unchanged') process.exit(1);`;
    const child = spawnSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", script], { cwd: dir, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    const service = createCService(createStore(path.join(dir, ".mock-db")), async () => ({ status: "complete" }));
    await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, {});
    assert.match(await readFile(path.join(dir, ".mock-db", "sessions.json"), "utf8"), /after/);
    assert.match(await readFile(path.join(dir, ".mock-db", "organizations.json"), "utf8"), /unchanged/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
