import type { createCService } from "./core.ts";

type Source = { document: string; url: string; pdfPage: number; printedPage: number };
type Finding = { status: "match" | "different" | "unconfirmed"; reason: string };
type Evidence = {
  id: string; referenceMonth: string; material: string; form: string; quality: string;
  processing: string; tradeStage: string; region: string; vat: string; logistics: string;
  criteria: Source; priceTable: Source; generalCriteria: Source; detailedCriteria: Source; faq: Source;
};
export type EvidenceComparison = {
  status: "compared" | "insufficient_information" | "unsupported";
  inputSummary: Record<string, unknown>;
  comparisons: Array<{ evidence: Evidence; material: Finding; form: Finding; region: Finding; quality: Finding; tradeStage: Finding }>;
  limitations: string[];
  followUp: string[];
};

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
    return { ok: true as const, data: await response.json() as EvidenceComparison };
  };
}
