import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../src/lib/server/c-questions/store.ts";
import { createCService } from "../src/lib/server/c-questions/core.ts";
import { createEvidenceComparison } from "../src/lib/server/c-questions/evidence.ts";

function validResponse() {
  const field = { status: "unanswered", value: null, revision: 0, answeredRevision: null, reaskReason: null };
  const source = { document: "공식 자료", url: "https://example.test", pdfPage: 21, printedPage: 17 };
  const finding = { status: "unconfirmed", reason: "확인 필요" };
  return {
    status: "compared",
    inputSummary: {
      material: { ...field, status: "value", value: "PP" }, materialBasis: field, form: field,
      contamination: { ...field, description: null }, separation: field, process: field,
      sorting: field, color: field, tradeStage: field, region: field, quantity: field,
    },
    comparisons: [{
      evidence: { id: "pp", referenceMonth: "2026-09", material: "PP", form: "압축", quality: "잡색", processing: "압축", tradeStage: "판매", region: "부산", vat: "포함", logistics: "제외", criteria: source, priceTable: source, generalCriteria: source, detailedCriteria: source, faq: source },
      material: { status: "match", reason: "재질 일치" }, form: finding, region: finding, quality: finding, tradeStage: finding,
    }],
    limitations: ["유의사항"], followUp: ["확인 사항"],
  };
}

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
      return Response.json(validResponse());
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

test("rejects malformed successful responses and allows a valid retry", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "c-evidence-schema-"));
  try {
    const service = createCService(createStore(dir), async () => ({ status: "questions" }));
    await service.initialize("ses", { expectedVersion: 0, requestId: "init" }, {});
    let body: unknown = { detail: "unavailable" };
    const compare = createEvidenceComparison(async () => {}, service, "http://backend/api/v1", async () => Response.json(body));
    await assert.rejects(compare("ses"));
    const missingArray = validResponse();
    body = Object.fromEntries(Object.entries(missingArray).filter(([key]) => key !== "limitations"));
    await assert.rejects(compare("ses"));
    const invalidNested = validResponse();
    body = { ...invalidNested, comparisons: [{ ...invalidNested.comparisons[0], evidence: { ...invalidNested.comparisons[0].evidence, criteria: { ...invalidNested.comparisons[0].evidence.criteria, pdfPage: "21" } } }] };
    await assert.rejects(compare("ses"));
    body = validResponse();
    const result = await compare("ses");
    assert(result.ok); assert.deepEqual(result.data, body);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
