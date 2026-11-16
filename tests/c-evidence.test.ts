import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../src/lib/server/c-questions/store.ts";
import { createCService } from "../src/lib/server/c-questions/core.ts";
import { createEvidenceComparison } from "../src/lib/server/c-questions/evidence.ts";

test("comparison authorizes, forwards stored state, and never writes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-evidence-"));
  try {
    const service = createCService(createStore(dir), async () => ({ status: "questions" }));
    const initial = await service.initialize("owned", { expectedVersion: 0, requestId: "init" }, { material: { status: "value", value: "PP" } });
    assert(initial.ok);
    const before = await readFile(path.join(dir, "c-questions.json"), "utf8");
    let calls = 0;
    const request: typeof fetch = async (url, options) => {
      calls++;
      assert.equal(url, "http://backend/api/v1/c/evidence/compare");
      assert.deepEqual(JSON.parse(options!.body as string), { state: initial.data.state });
      assert.equal(options!.method, "POST"); assert.equal(options!.cache, "no-store");
      return Response.json({ status: "compared", inputSummary: {}, comparisons: [], limitations: [], followUp: [] });
    };
    const compare = createEvidenceComparison(async (id) => { if (id === "other") throw new Error("not found"); }, service, "http://backend/api/v1", request);
    const result = await compare("owned"); assert(result.ok); assert.equal(result.data.status, "compared");
    await assert.rejects(compare("other"), /not found/); assert.equal(calls, 1);
    const missing = await compare("missing"); assert(!missing.ok); assert.equal(missing.code, "not_found"); assert.equal(calls, 1);
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
    const failed = createEvidenceComparison(async () => {}, service, "http://backend/api/v1", async () => new Response(null, { status: 503 }));
    await assert.rejects(failed("owned"), /503/);
    const timedOut = createEvidenceComparison(async () => {}, service, "http://backend/api/v1", async () => { throw new DOMException("timeout", "TimeoutError"); });
    await assert.rejects(timedOut("owned"), { name: "TimeoutError" });
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
