import "server-only";
import { WASTE_ITEMS, type Organization, type WasteItem } from "@/lib/domain";
import type { Route, Session } from "@/lib/session/types";
import { ITEM_PROFILES } from "./pipeline";

/**
 * 대시보드용 처리 이력. 새로 가입한 회사는 실제 이력이 없으므로, 회사 id로 시드를 고정한 난수로
 * 지난 6개월치 시연용 이력을 만든다(같은 회사는 언제 열어도 같은 숫자가 나온다).
 * 실제 세션(승인해서 발송했거나 수거를 마친 것)은 sessions 컬렉션에서 읽어 같은 모양으로 바꿔 합친다.
 * 금액·탄소는 모두 pipeline.ts의 품목 설정표(가정값)로 계산한다.
 */
export type HistoryRecord = {
  id: string;
  /** ISO 날짜 */
  date: string;
  item: WasteItem;
  detail: string;
  kg: number;
  route: string;
  /** 현행(혼합 소각) 대비 절감액. 음수면 손해 */
  savingKrw: number;
  /** 현행 대비 줄인 탄소 (tCO₂e) */
  carbonSavedT: number;
  /** AI가 예상한 작업 후 단가 (원/kg) */
  predictedPerKg: number | null;
  /** 업체가 기록한 실제 단가 (원/kg). 거절이면 null */
  actualPerKg: number | null;
  /** 업체 매입 여부. 아직 결과가 없으면 null */
  accepted: boolean | null;
  state: "완료" | "거절" | "수거 대기";
  demo: boolean;
  sessionId?: string;
};

const LABOR_PER_HOUR = 15000;

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

/** 회사별 지난 6개월(이번 달 제외) 시연용 이력. 결정적이다. */
export function buildDemoHistory(org: Pick<Organization, "id" | "wasteStreams">, now: Date): HistoryRecord[] {
  const declared = org.wasteStreams.length > 0 ? org.wasteStreams : [{ item: "폐플라스틱" as WasteItem, monthlyKg: 800 }];
  const records: HistoryRecord[] = [];
  for (let m = -6; m <= -1; m++) {
    const start = monthStart(now, m);
    const key = `${start.getFullYear()}-${start.getMonth() + 1}`;
    const rand = rng(hashString(`${org.id}:${key}`));
    // 첫 달은 아직 현행대로 처리하던 시점이고, 달이 갈수록 전환 건수가 늘어난다.
    const progress = (m + 7) / 6;
    const count = m === -6 ? 1 : 1 + Math.floor(rand() * 1.4 + progress * 0.6);
    for (let i = 0; i < count; i++) {
      // 신고한 품목이 하나뿐이어도, 공장에서 흔히 같이 나오는 포장재·금속 스크랩이 가끔 섞인다
      const extra = i > 0 && rand() < 0.6;
      const stream = extra
        ? { item: (rand() < 0.65 ? "포장재" : "금속 스크랩") as WasteItem, monthlyKg: 240 + Math.floor(rand() * 260) }
        : (declared[Math.floor(rand() * declared.length)] ?? declared[0]);
      const item = WASTE_ITEMS.includes(stream.item) ? stream.item : "폐플라스틱";
      const p = ITEM_PROFILES[item];
      const kg = round(stream.monthlyKg * (0.7 + rand() * 0.3), 10) || 100;
      const day = 3 + Math.floor(rand() * 24);
      const date = new Date(start.getFullYear(), start.getMonth(), day, 10).toISOString();
      const id = `demo_${hashString(`${org.id}:${key}:${i}`).toString(36)}`;
      const laborCost = p.laborHours * LABOR_PER_HOUR;

      if (m === -6 && i === 0) {
        // 전환 전: 혼합 소각. 절감 0
        records.push({ id, date, item, detail: `${p.detail} 혼합`, kg, route: "현행 유지 (혼합 소각)", savingKrw: 0, carbonSavedT: 0, predictedPerKg: null, actualPerKg: null, accepted: null, state: "완료", demo: true });
        continue;
      }
      const rejected = rand() < 0.08;
      const predicted = p.afterPerKg;
      const tTotal = kg / 1000;
      if (rejected) {
        records.push({
          id, date, item, detail: p.detail, kg, route: "단독 재활용",
          // 작업 인건비만 쓰고 혼합 처리로 돌아간 경우
          savingKrw: -round(laborCost, 1000),
          carbonSavedT: 0,
          predictedPerKg: predicted, actualPerKg: null, accepted: false, state: "거절", demo: true,
        });
        continue;
      }
      // 실제 단가는 예상보다 조금 낮게 나오는 경우가 많다 (수분·이물질 감량 정산)
      const actual = round(predicted * (0.84 + rand() * 0.22), 10);
      const bundled = rand() < 0.55 + progress * 0.3;
      const saving = round((actual + p.disposalPerKg) * kg - laborCost - (bundled ? 0 : p.visitFee * 0.4), 1000);
      records.push({
        id, date, item, detail: p.detail, kg,
        route: bundled ? "묶음 재활용" : "단독 재활용",
        savingKrw: saving,
        carbonSavedT: round2((p.incinerationTPerT + p.avoidedTPerT * (bundled ? 1 : 0.875)) * tTotal),
        predictedPerKg: predicted, actualPerKg: actual, accepted: true, state: "완료", demo: true,
      });
    }
  }
  return records;
}

function routeOf(s: Session, id: Route["id"] | undefined) {
  return s.costCarbon?.routes.find((r) => r.id === id);
}

/** 승인해서 발송했거나 수거를 마친 실제 세션을 이력 행으로 바꾼다. */
export function sessionsToHistory(sessions: Session[]): HistoryRecord[] {
  const out: HistoryRecord[] = [];
  for (const s of sessions) {
    if (s.status !== "sent" && s.status !== "completed") continue;
    const chosen = routeOf(s, s.approval?.routeId ?? s.selectedRoute ?? s.proposal?.recommended);
    const baseline = routeOf(s, "C");
    if (!chosen || !baseline) continue;
    const kgAnswer = Number(s.questions.find((q) => q.id === "volume")?.answer);
    const ownKg = Number.isFinite(kgAnswer) && kgAnswer > 0 ? kgAnswer : s.classify.estimatedKg;
    // 업체는 묶음 전체 수거량을 기록하므로, 우리 회사 몫(신고 물량 비율)만 이력에 넣는다
    const share = s.matching && s.matching.totalKg > 0 ? Math.min(1, ownKg / s.matching.totalKg) : 1;
    const kg = s.outcome ? Math.round(s.outcome.actualKg * share) : ownKg;
    const laborCost = s.feasibility?.action.laborCost ?? 0;
    const o = s.outcome;
    let saving = chosen.monthlyKrw - baseline.monthlyKrw;
    let carbon = round2(baseline.carbonT - chosen.carbonT);
    if (o && o.accepted) saving = round(o.actualPerKg * kg - laborCost - baseline.monthlyKrw * (kg / ownKg), 1000);
    if (o && !o.accepted) {
      saving = -laborCost;
      carbon = 0;
    }
    out.push({
      id: s.id,
      date: o?.recordedAt ?? s.approval?.approvedAt ?? s.updatedAt,
      item: s.classify.item,
      detail: s.classify.detail,
      kg,
      route: chosen.name,
      savingKrw: saving,
      carbonSavedT: carbon,
      predictedPerKg: s.feasibility?.afterPerKg ?? null,
      actualPerKg: o && o.accepted ? o.actualPerKg : null,
      accepted: o ? o.accepted : null,
      state: !o ? "수거 대기" : o.accepted ? "완료" : "거절",
      demo: false,
      sessionId: s.id,
    });
  }
  return out;
}

export type MonthBucket = { key: string; label: string; savingKrw: number; carbonSavedT: number; count: number; demo: boolean };

/** 최근 7개월(시연 6개월 + 이번 달) 월별 합계 */
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

function localKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
