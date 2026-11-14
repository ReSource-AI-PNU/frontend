import { z } from "zod";
import { API_BASE_URL } from "@/lib/config";
import type { Stream, StreamRoute } from "@/lib/session/types";

const amount = z.number().finite().nullable();
const status = z.enum(["calculated", "conditional", "needs_information"]);
const route = z.enum(["reuse", "sell", "bundle", "pyrolysis", "incinerate"]);
const decision = z.object({
  streamId: z.string(), status, route: route.nullable(), aiRoute: route.nullable(),
  reason: z.string(), reasonCode: z.string().nullable(),
  currentPerKg: amount, afterPerKg: amount, monthlyNow: amount, monthlyAfter: amount,
  monthlyDifference: amount, cashSaleRevenue: amount, purchaseAvoidanceNet: amount,
  disposalCost: amount, transportCost: amount, laborCost: amount,
  action: z.object({ title: z.string(), laborHours: z.number(), laborCost: z.number() }).nullable(),
});
const previewResult = z.object({
  status, decisions: z.array(decision), totalNow: amount, totalAfter: amount, difference: amount,
  dataMode: z.literal("synthetic_demo"), assumptions: z.array(z.string()),
});
export type PreviewResult = z.infer<typeof previewResult>;

export async function previewFeasibility(
  streams: Stream[], overrides: Record<string, StreamRoute>, signal: AbortSignal,
): Promise<PreviewResult> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/feasibility/preview`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ streams, overrides }), signal,
  });
  if (!response.ok) throw new Error(`미리보기 요청에 실패했습니다 (HTTP ${response.status}).`);
  const parsed = previewResult.safeParse(await response.json());
  if (!parsed.success) throw new Error("미리보기 응답 형식이 올바르지 않습니다.");
  const expected = new Set(streams.map((s) => s.id));
  const received = parsed.data.decisions.map((d) => d.streamId);
  if (received.length !== expected.size || new Set(received).size !== expected.size ||
      received.some((id) => !expected.has(id))) {
    throw new Error("미리보기 응답의 흐름이 요청과 일치하지 않습니다.");
  }
  return parsed.data;
}
