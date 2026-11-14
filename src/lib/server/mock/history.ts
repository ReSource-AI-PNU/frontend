import "server-only";
import type { Organization, WasteItem } from "@/lib/domain";
import type { Session, Stream, StreamOrigin, StreamRoute } from "@/lib/session/types";
import { buildFeasibility, buildStream, profileFor, SAMPLE_FACTORY } from "./pipeline";

/**
 * 대시보드용 처리 이력. 단위는 "흐름 × 월"이다(문제 정의 v2: 공장의 폐플라스틱 흐름 여러 개).
 *
 * - 시연용 이력: 새로 가입한 회사는 실제 이력이 없으므로, 회사 id로 시드를 고정한 난수로 지난 6개월치를 만든다
 *   (같은 회사는 언제 열어도 같은 숫자가 나온다). 시연 공장 (주)한빛정밀의 네 흐름을 기본으로 하고,
 *   회사가 신고한 금속 스크랩·폐목재가 있으면 그 흐름을 더한다. 첫 달은 전부 소각이고, 달이 갈수록
 *   흐름이 하나씩 추천 경로로 옮겨 간다.
 * - 실제 이력: 승인해서 발송했거나 수거를 마친 진단을 흐름별 행으로 바꿔 합친다.
 * 금액·탄소는 모두 pipeline.ts의 규칙 엔진(buildFeasibility)과 가정값으로 계산한다.
 */
export type HistoryState = "완료" | "거절" | "수거 대기" | "자체 처리" | "현행 유지";

export type HistoryRecord = {
  id: string;
  /** ISO 날짜 */
  date: string;
  item: WasteItem;
  /** 흐름 이름. 예: 스프루·러너 */
  stream: string;
  /** 예: PP 사출 스프루·러너 */
  detail: string;
  origin: StreamOrigin;
  kg: number;
  route: StreamRoute;
  /** 현행(전부 혼합 소각) 대비 절감액. 음수면 손해 */
  savingKrw: number;
  /** 현행 대비 줄인 탄소 (tCO₂e) */
  carbonSavedT: number;
  /** AI가 예상한 kg당 손익 (원/kg). 외부 업체가 없는 경로(재투입·소각)는 null */
  predictedPerKg: number | null;
  /** 업체가 기록한 실제 단가 (원/kg). 거절이거나 아직 기록 전이면 null */
  actualPerKg: number | null;
  /** 업체 매입 여부. 아직 결과가 없거나 업체가 없는 경로면 null */
  accepted: boolean | null;
  state: HistoryState;
  demo: boolean;
  sessionId?: string;
};

/** 외부 업체가 받아 가는 경로. 이 경로만 업체의 실제 결과(매입 여부·단가)가 생긴다 */
export function hasPartner(route: StreamRoute) {
  return route === "sell" || route === "bundle" || route === "pyrolysis";
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32. 같은 시드면 같은 수열을 낸다. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const round2 = (n: number) => Math.round(n * 100) / 100;

function monthStart(now: Date, offset: number) {
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

type DemoStream = { key: string; profile: ReturnType<typeof profileFor>; kg: number };

/** 경로를 바꾸기 쉬운 순서. 재투입(공장 안에서 끝남) → 매각 → 열분해 → 단지 묶음(다른 회사 동의 필요) */
const ADOPT_MONTH: Record<StreamRoute, number> = { reuse: -5, sell: -4, pyrolysis: -3, bundle: -2, incinerate: 1 };

function demoStreams(org: Pick<Organization, "wasteStreams">): DemoStream[] {
  const out: DemoStream[] = SAMPLE_FACTORY.map((p) => ({ key: p.key, profile: p, kg: p.defaultKg }));
  // profileFor는 이름으로 프로필을 고른다. "스크랩"은 필름 규칙(/랩/)에 먼저 걸리므로 겹치지 않는 이름을 넘긴다
  for (const [item, name] of [
    ["금속 스크랩", "금속"],
    ["폐목재", "목재"],
  ] as const) {
    const kg = org.wasteStreams.filter((w) => w.item === item).reduce((s, w) => s + w.monthlyKg, 0);
    if (kg > 0) out.push({ key: item, profile: profileFor(name, item), kg });
  }
  return out;
}

/** buildFeasibility는 세션의 흐름만 읽는다. 시연 이력에서는 흐름만 담은 세션 모양을 넘긴다 */
function decideMonth(streams: Stream[], overrides: Record<string, StreamRoute>) {
  return buildFeasibility({ streams } as Pick<Session, "streams"> as Session, [], overrides).decisions;
}

/** 회사별 지난 6개월(이번 달 제외) 시연용 흐름 이력. 결정적이다. */
export function buildDemoHistory(org: Pick<Organization, "id" | "wasteStreams">, now: Date): HistoryRecord[] {
  const base = demoStreams(org);
  const adoptRand = rng(hashString(`${org.id}:adopt`));
  // 회사마다 한두 흐름은 한 달 늦게 옮긴다(첫 전환인 공정 재투입은 제외)
  const lag = new Map(base.map((b) => [b.key, adoptRand() < 0.3 ? 1 : 0]));
  lag.set(SAMPLE_FACTORY[0].key, 0);
  const records: HistoryRecord[] = [];

  for (let m = -6; m <= -1; m++) {
    const start = monthStart(now, m);
    const key = `${start.getFullYear()}-${start.getMonth() + 1}`;
    const rand = rng(hashString(`${org.id}:${key}`));
    const streams = base.map((b) =>
      buildStream(`demo_${b.key}`, b.profile, { media: [], kg: round(b.kg * (0.85 + rand() * 0.3), 10) || 100, modelVersion: "demo" }),
    );
    const aiDecisions = decideMonth(streams, {});
    const overrides: Record<string, StreamRoute> = {};
    for (const d of aiDecisions) {
      const k = d.streamId.replace(/^demo_/, "");
      if (m < Math.min(-1, ADOPT_MONTH[d.route] + (lag.get(k) ?? 0))) overrides[d.streamId] = "incinerate";
    }
    const decisions = Object.keys(overrides).length ? decideMonth(streams, overrides) : aiDecisions;

    for (const d of decisions) {
      const s = streams.find((x) => x.id === d.streamId)!;
      const k = d.streamId.replace(/^demo_/, "");
      const day = 3 + Math.floor(rand() * 24);
      const common = {
        id: `demo_${hashString(`${org.id}:${key}:${k}`).toString(36)}`,
        date: new Date(start.getFullYear(), start.getMonth(), day, 10).toISOString(),
        item: s.classify.item,
        stream: s.name,
        detail: s.classify.detail,
        origin: s.origin,
        kg: s.monthlyKg,
        route: d.route,
        demo: true,
      };
      const labor = d.action?.laborCost ?? 0;

      if (d.route === "incinerate") {
        records.push({ ...common, savingKrw: 0, carbonSavedT: 0, predictedPerKg: null, actualPerKg: null, accepted: null, state: "현행 유지" });
        continue;
      }
      if (d.route === "reuse") {
        records.push({
          ...common,
          savingKrw: d.monthlyAfter - d.monthlyNow,
          carbonSavedT: round2(d.carbonNowT - d.carbonAfterT),
          predictedPerKg: null,
          actualPerKg: null,
          accepted: null,
          state: "자체 처리",
        });
        continue;
      }
      // 업체가 받아 가는 경로: 가끔 매입 거절, 실제 단가는 예상보다 조금 낮게 나오는 경우가 많다(수분·이물 감량 정산)
      if (d.route !== "pyrolysis" && rand() < 0.08) {
        records.push({ ...common, savingKrw: -labor, carbonSavedT: 0, predictedPerKg: d.afterPerKg, actualPerKg: null, accepted: false, state: "거절" });
        continue;
      }
      const actual = round(d.afterPerKg * (0.84 + rand() * 0.22), 10);
      records.push({
        ...common,
        savingKrw: round((actual - d.currentPerKg) * s.monthlyKg - labor, 100),
        carbonSavedT: round2(d.carbonNowT - d.carbonAfterT),
        predictedPerKg: d.afterPerKg,
        actualPerKg: actual,
        accepted: true,
        state: "완료",
      });
    }
  }
  return records;
}

/** 승인해서 발송했거나 수거를 마친 실제 진단을 흐름별 이력 행으로 바꾼다. */
export function sessionsToHistory(sessions: Session[]): HistoryRecord[] {
  const out: HistoryRecord[] = [];
  for (const s of sessions) {
    if (s.status !== "sent" && s.status !== "completed") continue;
    const f = s.feasibility;
    if (!f) continue;
    const routeId = s.approval?.routeId ?? s.selectedRoute ?? s.proposal?.recommended;
    const chosen = s.costCarbon?.routes.find((r) => r.id === routeId);
    for (const d of f.decisions) {
      const st = (s.streams ?? []).find((x) => x.id === d.streamId);
      if (!st) continue;
      // 고른 이행안이 흐름별 최적안이 아니면(예: 묶음 없이 개별 처리) 그 안의 흐름별 내역을 따른다
      const planned = chosen?.breakdown.find((b) => b.streamId === d.streamId);
      const route = planned?.route ?? d.route;
      const labor = d.action?.laborCost ?? 0;
      const o = s.outcome && s.outcome.streamId === d.streamId ? s.outcome : undefined;
      let kg = st.monthlyKg;
      let saving = (planned?.monthlyKrw ?? d.monthlyAfter) - d.monthlyNow;
      let carbon = round2(d.carbonNowT - (planned?.carbonT ?? d.carbonAfterT));
      if (o && o.accepted) {
        kg = o.actualKg;
        saving = Math.round((o.actualPerKg - d.currentPerKg) * kg - labor);
        carbon = round2((d.carbonNowT - d.carbonAfterT) * (kg / Math.max(1, st.monthlyKg)));
      } else if (o) {
        saving = -labor;
        carbon = 0;
      }
      const partner = hasPartner(route);
      out.push({
        id: `${s.id}:${d.streamId}`,
        date: o?.recordedAt ?? s.approval?.approvedAt ?? s.updatedAt,
        item: st.classify.item,
        stream: st.name,
        detail: st.classify.detail,
        origin: st.origin,
        kg,
        route,
        savingKrw: saving,
        carbonSavedT: carbon,
        predictedPerKg: partner && route === d.route ? d.afterPerKg : null,
        actualPerKg: o && o.accepted ? o.actualPerKg : null,
        accepted: o ? o.accepted : null,
        state: route === "incinerate" ? "현행 유지" : route === "reuse" ? "자체 처리" : !o ? "수거 대기" : o.accepted ? "완료" : "거절",
        demo: false,
        sessionId: s.id,
      });
    }
  }
  return out;
}

export type MonthBucket = { key: string; label: string; savingKrw: number; carbonSavedT: number; count: number; demo: boolean };

/** 최근 7개월(시연 6개월 + 이번 달) 월별 합계. count는 그 달에 처리한 흐름 수 */
export function bucketByMonth(records: HistoryRecord[], now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let m = -6; m <= 0; m++) {
    const start = monthStart(now, m);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const rows = records.filter((r) => localKey(r.date) === key);
    buckets.push({
      key,
      label: `${start.getMonth() + 1}월`,
      savingKrw: rows.reduce((s, r) => s + r.savingKrw, 0),
      carbonSavedT: round2(rows.reduce((s, r) => s + r.carbonSavedT, 0)),
      count: rows.length,
      demo: rows.some((r) => r.demo),
    });
  }
  return buckets;
}

/** 경로 표시 순서. 값 순위로 바꾸지 않고 항상 이 순서로 보여 준다 */
export const ROUTE_ORDER: StreamRoute[] = ["reuse", "sell", "bundle", "pyrolysis", "incinerate"];

export type RouteShare = { route: StreamRoute; kg: number; share: number; streams: number };

/** 경로별 처리량(kg)과 비중. 업체가 매입을 거절한 물량은 결국 소각했으므로 소각으로 센다 */
export function routeShares(records: HistoryRecord[]): RouteShare[] {
  const effective = (r: HistoryRecord): StreamRoute => (r.accepted === false ? "incinerate" : r.route);
  const total = records.reduce((s, r) => s + r.kg, 0);
  return ROUTE_ORDER.map((route) => {
    const rows = records.filter((r) => effective(r) === route);
    const kg = rows.reduce((s, r) => s + r.kg, 0);
    return { route, kg, share: total > 0 ? kg / total : 0, streams: new Set(rows.map((r) => r.stream)).size };
  });
}

function localKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
