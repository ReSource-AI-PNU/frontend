import "server-only";
import { josa } from "@/lib/josa";
import type { BundleGroup, Guardrails, Negotiation, NegotiationRound, PickupTerms } from "@/lib/session/types";
import { newId } from "./db";

/**
 * 에이전트 간 협상(모의). 우리 에이전트는 사람이 정한 가드레일 안에서만 양보하고, 수거 업체 에이전트는 자기 조건(가능 요일, 낼 수 있는 최고 단가)을 지킨다.
 * 실제 서비스에서는 수거 업체가 자기 에이전트를 A2A로 연결하고, 같은 메시지 형식(PickupTerms)을 주고받는다.
 */

export const WEEKDAYS = ["월", "화", "수", "목", "금"] as const;

/** 수거 업체 에이전트의 조건(시연용 가정값). 업체마다 다르게 둘 수 있다 */
const COLLECTOR_TERMS = { days: ["목", "금"], maxPerKg: 142, opening: 130, maxPerMonth: 2 };

/** 순회 수거 요청서에 적은 조건. 일정 문구에서 요일을 읽고, 희망 단가는 LDPE 필름 150원/kg이다 */
export function requestedTerms(b: BundleGroup): PickupTerms {
  const day = WEEKDAYS.find((d) => b.schedule.includes(`${d}요일`)) ?? "화";
  return { day, slot: b.schedule.includes("오후") ? "오후" : "오전", perKg: 150, perMonth: /둘째·넷째|월 2회/.test(b.schedule) ? 2 : 1 };
}

export const DEFAULT_GUARDRAILS: Guardrails = { minPerKg: 140, days: ["화", "목"], minPerMonth: 2, maxRounds: 6 };

const termsText = (t: PickupTerms) => `${t.day}요일 ${t.slot} · ${t.perKg}원/kg · 월 ${t.perMonth}회`;
const within = (t: PickupTerms, g: Guardrails) => t.perKg >= g.minPerKg && g.days.includes(t.day) && t.perMonth >= g.minPerMonth;
const down5 = (n: number) => Math.floor(n / 5) * 5;

export function negotiate(b: BundleGroup, g: Guardrails, start = Date.now()): Negotiation {
  const requested = requestedTerms(b);
  const rounds: NegotiationRound[] = [];
  let t = start;
  const push = (r: Omit<NegotiationRound, "at" | "within"> & { within?: boolean }) => {
    t += 1600;
    rounds.push({ ...r, at: new Date(t).toISOString(), within: r.within ?? within(r.terms, g) });
  };
  const base = { id: newId("neg"), streamId: b.streamId, counterparty: { companyId: b.collector.companyId, name: b.collector.name }, guardrails: g, requested, startedAt: new Date(start).toISOString() };

  // 1. 우리 에이전트: 요청서 조건 그대로
  push({ by: "ours", terms: requested, message: `순회 수거 요청서 조건입니다. 단지 ${b.group.length}개사, 월 ${b.totalKg.toLocaleString("ko-KR")}kg을 사업장별로 순회합니다.` });

  // 2. 수거 업체 에이전트: 요일이 안 되면 자기 요일로, 단가는 자기 시작값으로
  const theirDay = COLLECTOR_TERMS.days.includes(requested.day) ? requested.day : (COLLECTOR_TERMS.days.find((d) => g.days.includes(d)) ?? COLLECTOR_TERMS.days[0]);
  const counter: PickupTerms = { ...requested, day: theirDay, perKg: COLLECTOR_TERMS.opening, perMonth: Math.min(requested.perMonth, COLLECTOR_TERMS.maxPerMonth) };
  push({
    by: "theirs",
    terms: counter,
    message: `${theirDay === requested.day ? "" : `${requested.day}요일은 다른 단지 순회가 있어 어렵습니다. `}${josa(termsText(counter), "을/를")} 제안합니다.`,
  });

  if (!g.days.includes(counter.day)) {
    return { ...base, rounds, status: "failed", note: `수거 업체가 가능한 요일(${COLLECTOR_TERMS.days.join("·")})이 가드레일 요일(${g.days.join("·")})과 겹치지 않습니다. 사람이 요일을 다시 정해야 합니다.` };
  }

  // 3. 우리 에이전트: 요일은 받아들이고, 단가는 요청과 상대 제안 사이에서 하한을 지키며 조금씩 내린다
  let ours = requested.perKg;
  let theirs = counter.perKg;
  for (let i = 0; rounds.length < g.maxRounds; i++) {
    const next = Math.max(g.minPerKg, ours - 5);
    if (next <= theirs) {
      push({ by: "ours", terms: { ...counter, perKg: theirs }, message: "제안을 받아들입니다. 합의안을 담당자에게 올려 승인을 받겠습니다.", accept: true });
      const deal = { ...counter, perKg: theirs };
      return within(deal, g) ? { ...base, rounds, status: "agreed", agreed: deal } : { ...base, rounds, status: "failed", note: "상대 제안이 가드레일 밖이라 사람에게 넘깁니다." };
    }
    ours = next;
    push({
      by: "ours",
      terms: { ...counter, perKg: ours },
      message:
        i === 0
          ? `${counter.day}요일은 받아들입니다. 단가는 ${ours}원/kg을 제안합니다. 3개사 물량으로 트럭 한 대를 넘게 채우므로 운반 효율이 높습니다.`
          : `${ours}원/kg까지 내릴 수 있습니다. 이보다 낮으면 담당자 확인이 필요합니다.`,
    });
    if (ours <= COLLECTOR_TERMS.maxPerKg) {
      push({ by: "theirs", terms: { ...counter, perKg: ours }, message: `${ours}원/kg에 동의합니다. ${josa(termsText({ ...counter, perKg: ours }), "으로/로")} 계약하겠습니다.`, accept: true });
      return { ...base, rounds, status: "agreed", agreed: { ...counter, perKg: ours } };
    }
    theirs = down5(COLLECTOR_TERMS.maxPerKg);
    push({ by: "theirs", terms: { ...counter, perKg: theirs }, message: `${ours}원은 어렵습니다. ${theirs}원/kg이면 ${counter.day}요일 ${counter.slot} 월 ${counter.perMonth}회 순회가 가능합니다.` });
    if (theirs < g.minPerKg && ours === g.minPerKg) break;
  }
  return {
    ...base,
    rounds,
    status: "failed",
    note: `수거 업체가 낼 수 있는 단가(${theirs}원/kg)가 가드레일 하한(${g.minPerKg}원/kg)보다 낮습니다. 하한을 낮출지 다른 업체를 찾을지 사람이 정해야 합니다.`,
  };
}

export { termsText };
