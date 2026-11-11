import "server-only";
import { createHash } from "node:crypto";
import { findComplex } from "@/lib/complexes";
import type { MaterialPassport, Outcome, Session } from "@/lib/session/types";
import { collection } from "./db";

/**
 * 재생원료 여권(모의 원장). 여권을 발급 순서대로 이어 붙이고, 각 여권의 hash에 앞 여권의 hash를 넣어 체인을 만든다.
 * 한 장이라도 내용이 바뀌면 그 여권의 hash가 맞지 않고, 뒤 여권의 prevHash와도 어긋난다.
 * 실제 서비스에서는 위·변조 방지 원장(예: Azure Confidential Ledger)에 두고 발급자 서명을 붙인다.
 */
export const passports = collection<MaterialPassport>("passports");

const ISSUER = "Re:Source AI (시연)";

type Body = Omit<MaterialPassport, "hash">;

/** 중첩된 객체까지 키 순서를 고정한 JSON. 값이 없는 키는 뺀다 */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function digest(body: Body) {
  return createHash("sha256").update(canonical(body)).digest("hex");
}

/** 여권 번호의 날짜는 한국 시각 기준이다 */
const KST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

function nextId(all: MaterialPassport[], at: Date) {
  const day = KST_DAY.format(at).replaceAll("-", "");
  const n = all.filter((p) => p.id.includes(day)).length + 1;
  return `RP-${day}-${String(n).padStart(4, "0")}`;
}

/** 수거 결과가 들어오면 그 흐름의 여권을 발급한다. 재생원료로 팔린 흐름(묶음·매각)만 대상이다 */
export async function issuePassport(s: Session, o: Outcome, companyName: string): Promise<MaterialPassport | null> {
  const st = s.streams.find((x) => x.id === o.streamId);
  const d = s.feasibility?.decisions.find((x) => x.streamId === o.streamId);
  if (!st || !d || !o.accepted || (d.route !== "bundle" && d.route !== "sell")) return null;
  const all = (await passports.all()).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  const proof = s.questions.find((q) => q.id === `pcr-proof:${st.id}`)?.answer;
  const creditable: MaterialPassport["creditable"] = st.origin === "PIR" ? "pir" : proof === "있음" ? "pcr" : "pcr-unverified";
  const bundle = s.matching?.bundles.find((b) => b.streamId === st.id);
  const partner = s.matching?.partners.find((p) => p.streamId === st.id);
  const contamination = st.classify.detections.filter((x) => x.kind === "contaminant" && !x.removed).reduce((a, x) => a + (x.ratio ?? 0), 0);
  const now = new Date();
  const body: Body = {
    id: nextId(all, now),
    sessionId: s.id,
    streamId: st.id,
    issuedAt: now.toISOString(),
    issuer: ISSUER,
    company: companyName,
    complex: findComplex(s.complexId)?.name ?? s.complexId,
    stream: st.name,
    material: st.classify.material,
    detail: st.classify.detail,
    origin: st.origin,
    originBasis:
      st.origin === "PIR"
        ? `${st.originSource === "human" ? "담당자 확인" : "AI 추정"} · 공정 부산물(${st.process || "공정"})`
        : `${st.originSource === "human" ? "담당자 확인" : "AI 추정"} · 공장이 쓰고 버린 포장재 · 입고 기록 ${proof ?? "확인 전"}`,
    creditable,
    evidence: [
      { label: "식별 모델", value: `${st.classify.model.name} ${st.classify.model.version} · 신뢰도 ${st.classify.confidence.toFixed(2)}` },
      { label: "이물(면적 추정)", value: `${Math.round(contamination * 100)}%` },
      { label: "원자재 입고 기록", value: st.origin === "PCR" ? (proof ?? "확인 전") : "해당 없음(공정 부산물)" },
      { label: "수거 방식", value: bundle ? `${bundle.mode} · ${bundle.group.length}개 사업장 · 사업장별 계량` : "단독 매각" },
      { label: "계량", value: `${o.recorderRole} 기록 · ${o.actualKg.toLocaleString("ko-KR")}kg` },
    ],
    weightKg: o.actualKg,
    grade: o.actualGrade,
    collectedBy: bundle?.collector.name ?? partner?.name ?? "수거 업체",
    collectedAt: o.recordedAt,
    route: d.route,
    prevHash: all.at(-1)?.hash ?? null,
  };
  const passport = { ...body, hash: digest(body) };
  await passports.insert(passport);
  return passport;
}

export type PassportCheck = { ok: boolean; hashOk: boolean; linkOk: boolean; position: number; total: number };

/** 여권 한 장의 hash를 다시 계산하고, 앞 여권과 이어지는지 확인한다 */
export async function verifyPassport(p: MaterialPassport): Promise<PassportCheck> {
  const all = (await passports.all()).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  const i = all.findIndex((x) => x.id === p.id);
  const { hash, ...body } = p;
  const hashOk = digest(body) === hash;
  const linkOk = i <= 0 ? p.prevHash === null || all.length === 0 : all[i - 1].hash === p.prevHash;
  return { ok: hashOk && linkOk, hashOk, linkOk, position: i + 1, total: all.length };
}

export const CREDITABLE_LABEL: Record<MaterialPassport["creditable"], { title: string; body: string }> = {
  pcr: {
    title: "사용 후 원료(PCR)",
    body: "공장이 원자재 포장으로 쓰고 버린 재료이고 입고 기록으로 출처를 확인했습니다. 재생원료 사용 실적에 넣을 수 있는 원료로 봅니다. 공장 포장재의 PCR 인정은 관계 기관의 해석 확인이 필요합니다.",
  },
  "pcr-unverified": {
    title: "사용 후 원료(PCR) · 출처 증빙 없음",
    body: "공장이 쓰고 버린 포장재로 추정하지만 입고 기록을 확인하지 못했습니다. 일반 재생원료로 거래하고, 사용 실적에 넣으려면 출처 증빙이 더 필요합니다.",
  },
  pir: {
    title: "공정 부산물(PIR)",
    body: "제조 공정에서 나온 부산물입니다. 재생원료로 쓸 수 있지만, 재생원료 사용의무 실적에는 넣을 수 없습니다.",
  },
};
