import type { BundleGroup } from "@/lib/session/types";

/**
 * 묶음 그룹 기업의 참여 상태.
 * self = 내 회사, not-sent = 아직 승인 전이라 제안을 보내지 않음, pending = 보냈고 회신 전, accepted·declined = 회신함
 */
export type ConsentState = "self" | "not-sent" | "pending" | "accepted" | "declined";

export type MemberConsent = { companyId: string; name: string; state: ConsentState; at?: string; reason?: string };

export const CONSENT_LABEL: Record<ConsentState, string> = {
  self: "내 회사",
  "not-sent": "제안 전",
  pending: "회신 대기",
  accepted: "참여 동의",
  declined: "참여 안 함",
};

export type ConsentSummary = {
  sent: boolean;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
  /** 내 회사 + 동의한 기업의 월 물량 */
  confirmedKg: number;
  confirmedRate: number;
  /** 모두 회신했고 확정 물량이 최소 물량 이상 */
  settled: boolean;
};

export function summarizeConsent(bundle: BundleGroup, consents: MemberConsent[]): ConsentSummary {
  const state = new Map(consents.map((c) => [c.companyId, c.state]));
  const others = bundle.group.filter((g) => !g.isSelf);
  const count = (s: ConsentState) => others.filter((g) => state.get(g.companyId) === s).length;
  const confirmedKg = bundle.group.filter((g) => g.isSelf || state.get(g.companyId) === "accepted").reduce((a, g) => a + g.kg, 0);
  const pending = count("pending");
  return {
    sent: others.some((g) => state.get(g.companyId) !== "not-sent"),
    invited: others.length,
    accepted: count("accepted"),
    declined: count("declined"),
    pending,
    confirmedKg,
    confirmedRate: bundle.truckKg > 0 ? confirmedKg / bundle.truckKg : 0,
    settled: pending === 0 && confirmedKg >= bundle.minKg,
  };
}

export const CONSENT_TONE: Record<ConsentState, "gain" | "loss" | "warn" | "neutral"> = {
  self: "neutral",
  "not-sent": "neutral",
  pending: "warn",
  accepted: "gain",
  declined: "loss",
};
