import type { createCService } from "./core.ts";
import { z } from "zod";

const fieldBase = {
  status: z.enum(["unanswered", "unknown", "value", "conflict"]),
  revision: z.number().int().nonnegative(),
  answeredRevision: z.number().int().nonnegative().nullable(),
  reaskReason: z.string().nullable(),
};
const inputField = z.object({ ...fieldBase, value: z.string().nullable() });
const contaminationField = z.object({ ...fieldBase, value: z.enum(["absent", "present"]).nullable(), description: z.string().nullable() });
const quantityField = z.object({ ...fieldBase, value: z.object({
  amount: z.number().finite().nonnegative(), unit: z.string(), period: z.string(),
  basis: z.enum(["measured", "estimated", "unknown"]),
}).nullable() });
const source = z.object({ document: z.string(), url: z.string(), pdfPage: z.number().int(), printedPage: z.number().int() });
const finding = z.object({ status: z.enum(["match", "different", "unconfirmed"]), reason: z.string() });
const evidence = z.object({
  id: z.string(), referenceMonth: z.string(), material: z.string(), form: z.string(), quality: z.string(),
  processing: z.string(), tradeStage: z.string(), region: z.string(), vat: z.string(), logistics: z.string(),
  criteria: source, priceTable: source, generalCriteria: source, detailedCriteria: source, faq: source,
});
const evidenceComparison = z.object({
  status: z.enum(["compared", "insufficient_information", "unsupported"]),
  inputSummary: z.object({
    material: inputField, materialBasis: inputField, form: inputField, contamination: contaminationField,
    separation: inputField, process: inputField, sorting: inputField, color: inputField,
    tradeStage: inputField, region: inputField, quantity: quantityField,
  }),
  comparisons: z.array(z.object({ evidence, material: finding, form: finding, region: finding, quality: finding, tradeStage: finding })),
  limitations: z.array(z.string()),
  followUp: z.array(z.string()),
});
export type EvidenceComparison = z.infer<typeof evidenceComparison>;

export function createEvidenceComparison(
  authorize: (id: string) => Promise<unknown>,
  service: Pick<ReturnType<typeof createCService>, "get">,
  baseUrl: string,
  request: typeof fetch = fetch,
) {
  return async (sessionId: string) => {
    await authorize(sessionId);
    const current = await service.get(sessionId);
    if (!current.ok) return current;
    const response = await request(`${baseUrl}/c/evidence/compare`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: current.data.state }),
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`C backend evidence compare failed (${response.status})`);
    return { ok: true as const, data: evidenceComparison.parse(await response.json()) };
  };
}
