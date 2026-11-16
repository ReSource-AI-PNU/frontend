import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../src/lib/server/c-questions/store.ts";
import { createCService } from "../src/lib/server/c-questions/core.ts";
import { createResourceSpecGenerator } from "../src/lib/server/c-questions/resource-spec.ts";

test("authorizes before forwarding stored state and leaves the store unchanged", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-spec-"));
  try {
    const store = createStore(dir);
    const service = createCService(store, async () => ({ status: "questions" }));
    const initial = await service.initialize("owned", { expectedVersion: 0, requestId: "init" }, { material: { status: "value", value: "PP" } });
    assert(initial.ok);
    await store.transact(async (rows) => {
      const row = rows[0] as { version: number; state: { region: unknown } };
      row.version++;
      row.state.region = { status: "value", value: "부산", revision: 0, answeredRevision: null, reaskReason: null };
      return { result: undefined, changed: true };
    });
    const latest = await service.get("owned");
    assert(latest.ok); assert.equal(latest.data.version, 2);
    const before = await readFile(path.join(dir, "c-questions.json"), "utf8");
    const events: string[] = [];
    const request: typeof fetch = async (url, options) => {
      events.push("fetch");
      assert.equal(url, "http://backend/api/v1/c/resource-spec/draft");
      assert.equal(options!.method, "POST"); assert.equal(options!.cache, "no-store");
      assert(options!.signal instanceof AbortSignal);
      assert.deepEqual(JSON.parse(options!.body as string), { state: latest.data.state });
      return Response.json({ markdown: "  # 자원 명세 초안\n" });
    };
    const get: typeof service.get = async (id) => { events.push("get"); return service.get(id); };
    const generate = createResourceSpecGenerator(async (id) => {
      events.push("authorize");
      if (id === "other") throw new Error("not found");
    }, { get }, "http://backend/api/v1", request);
    const result = await generate("owned");
    assert(result.ok); assert.equal(result.data.markdown, "  # 자원 명세 초안\n");
    assert.deepEqual(events, ["authorize", "get", "fetch"]);
    events.length = 0;
    await assert.rejects(generate("other"), /not found/);
    assert.deepEqual(events, ["authorize"]);
    events.length = 0;
    const missing = await generate("missing");
    assert(!missing.ok); assert.equal(missing.code, "not_found");
    assert.deepEqual(events, ["authorize", "get"]);
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("HTTP failures, timeouts and invalid responses never succeed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-spec-errors-"));
  try {
    const service = createCService(createStore(dir), async () => ({ status: "questions" }));
    await service.initialize("owned", { expectedVersion: 0, requestId: "init" }, {});
    const before = await readFile(path.join(dir, "c-questions.json"), "utf8");
    const generator = (request: typeof fetch) => createResourceSpecGenerator(async () => {}, service, "http://backend", request);
    await assert.rejects(generator(async () => new Response(null, { status: 503 }))("owned"), /503/);
    await assert.rejects(generator(async () => { throw new DOMException("timeout", "TimeoutError"); })("owned"), { name: "TimeoutError" });
    await assert.rejects(generator(async () => new Response("not json"))("owned"));
    for (const body of [{}, { markdown: null }, { markdown: 12 }, { markdown: "" }, { markdown: " \n\t" }]) {
      await assert.rejects(generator(async () => Response.json(body))("owned"));
    }
    assert.equal(await readFile(path.join(dir, "c-questions.json"), "utf8"), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
