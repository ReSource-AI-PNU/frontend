import "server-only";
import { formatNumber, formatSigned } from "@/lib/format";
import { STREAM_ROUTE_LABEL, type FlowStep, type RunEvent, type Session } from "@/lib/session/types";
import { newId } from "./db";

/**
 * 에이전트 실행 기록(모의). 실제 서비스에서는 Agent Framework 실행 추적에서 같은 모양을 만든다.
 * 걸린 시간은 시연용 가정값이고, 한 묶음의 기록은 걸린 시간만큼 시각을 띄워 실제로 차례대로 돈 것처럼 보이게 한다.
 */
type Draft = Omit<RunEvent, "id" | "at">;

function stamp(drafts: Draft[], start = Date.now()): RunEvent[] {
  let t = start;
  return drafts.map((d) => {
    const ev = { ...d, id: newId("ev"), at: new Date(t).toISOString() };
    t += d.durationMs ?? 120;
    return ev;
  });
}

export function appendRun(s: Session, drafts: Draft[]): Session {
  return { ...s, runLog: [...(s.runLog ?? []), ...stamp(drafts)] };
}

/** 사람이 한 일 한 줄 */
export function human(title: string, opts: Partial<Draft> = {}): Draft {
  return { agent: "orchestrator", actor: "human", kind: "decision", title, ...opts };
}

export function startEvents(s: Session): Draft[] {
  const media = s.streams.reduce((a, x) => a + x.media.length, 0);
  return [
    {
      agent: "orchestrator",
      actor: "ai",
      kind: "start",
      title: `진단 시작 · 흐름 ${s.streams.length}개`,
      detail: "흐름마다 식별·분류 에이전트를 돌린 뒤 경로 판정부터 이행안까지 차례로 넘깁니다. 외부 발송은 사람이 승인하기 전까지 하지 않습니다.",
      durationMs: 300,
    },
    { agent: "classify", actor: "ai", kind: "start", title: `식별·분류 시작 · 사진·영상 ${media}개`, step: "classify", durationMs: 200 },
  ];
}

export function classifyEvents(s: Session): Draft[] {
  const out: Draft[] = [];
  for (const x of s.streams) {
    const c = x.classify;
    const contamination = c.detections.filter((d) => d.kind === "contaminant" && !d.removed).reduce((a, d) => a + (d.ratio ?? 0), 0);
    out.push({
      agent: "classify",
      actor: "ai",
      kind: "tool",
      tool: `${c.model.name} ${c.model.version} · 재질·이물 탐지`,
      title: `${x.name} · ${c.material} ${c.singleMaterial ? "단일" : "혼합"} · 이물 ${Math.round(contamination * 100)}%`,
      detail: `${c.detail}. 박스 ${c.detections.length}개, 신뢰도 ${c.confidence.toFixed(2)}. 사진으로는 부피만 보이므로 월 발생량은 담당자 확인이 필요합니다.`,
      durationMs: c.durationMs,
      step: "classify",
      streamId: x.id,
    });
    if (x.media.some((m) => m.kind === "pdf")) {
      out.push({ agent: "classify", actor: "ai", kind: "tool", tool: "Azure AI Document Intelligence", title: `${x.name} · 원자재 명세에서 수지 종류 읽기`, durationMs: 900, step: "classify", streamId: x.id });
    }
    out.push({
      agent: "classify",
      actor: "ai",
      kind: "result",
      tool: "출처 규칙(공정명·흐름 이름)",
      title: `${x.name} 출처 추정 · ${x.origin === "PIR" ? "공정 부산물(PIR)" : "사용 후 포장재(PCR)"}`,
      detail: "출처는 사진으로 가를 수 없어 공정명과 흐름 이름으로 추정합니다. 담당자가 확인해야 확정됩니다.",
      durationMs: 150,
      step: "classify",
      streamId: x.id,
    });
  }
  out.push({
    agent: "classify",
    actor: "ai",
    kind: "ask",
    title: `월 발생량 확인 요청 · 흐름 ${s.streams.filter((x) => !x.monthlyKgConfirmed).length}개`,
    detail: "사진 한 장의 양은 월 발생량이 아닙니다. 계량 기록이나 담당자 기억으로 확정해 주세요.",
    step: "classify",
    durationMs: 100,
  });
  return out;
}

/** 이번에 새로 계산한 단계의 기록. prev에 없고 next에 생긴 결과만 남긴다 */
export function stepEvents(prev: Session, next: Session): Draft[] {
  const out: Draft[] = [];
  const nameOf = (id: string) => next.streams.find((x) => x.id === id)?.name ?? "흐름";
  const f = next.feasibility;
  if (!prev.feasibility && f) {
    out.push({ agent: "feasibility", actor: "ai", kind: "start", title: `경로 판정 시작 · 흐름 ${f.decisions.length}개`, step: "feasibility", durationMs: 200 });
    out.push({
      agent: "feasibility",
      actor: "ai",
      kind: "tool",
      tool: "가격 데이터 · 재활용가능자원 가격조사(가정값)",
      title: "PP 압축품·LDPE 필름 단가와 소각 위탁비 조회",
      refs: f.reasons.filter((r) => !r.knowledgeCardId).map((r) => `${r.text} (${r.source})`),
      durationMs: 700,
      step: "feasibility",
    });
    const cards = f.reasons.filter((r) => r.knowledgeCardId);
    if (cards.length) {
      out.push({
        agent: "feasibility",
        actor: "ai",
        kind: "tool",
        tool: "현장 지식 카드 검색",
        title: `채택된 현장 지식 ${cards.length}개 인용`,
        refs: cards.map((r) => `${r.text} (${r.source})`),
        durationMs: 400,
        step: "feasibility",
      });
    }
    for (const d of f.decisions) {
      out.push({
        agent: "feasibility",
        actor: "ai",
        kind: "decision",
        title: `${nameOf(d.streamId)} → ${STREAM_ROUTE_LABEL[d.route]} · 월 ${formatSigned(d.monthlyAfter)}원`,
        detail: `${d.reason} 다른 경로: ${d.alternatives.map((a) => `${STREAM_ROUTE_LABEL[a.route]} ${formatSigned(a.perKg)}원/kg`).join(", ")}.`,
        durationMs: 350,
        step: "feasibility",
        streamId: d.streamId,
      });
    }
    out.push({
      agent: "feasibility",
      actor: "ai",
      kind: "result",
      title: `공장 월 손익 ${formatSigned(f.totalNow)}원 → ${formatSigned(f.totalAfter)}원`,
      detail: `월 ${formatSigned(f.totalAfter - f.totalNow)}원 개선, 탄소 ${formatSigned(f.carbonNowT, 2)} → ${formatSigned(f.carbonAfterT, 2)} tCO₂e/월`,
      step: "feasibility",
      durationMs: 100,
    });
  }
  const r = next.regulation;
  if (!prev.regulation && r) {
    const ok = r.items.filter((i) => i.status === "ok").length;
    const ask = r.items.filter((i) => i.status === "ask");
    out.push({
      agent: "regulation",
      actor: "ai",
      kind: "tool",
      tool: "Azure AI Search · 법령 조항 색인",
      title: `흐름별 경로에 맞는 조항 ${r.items.length}건 검색`,
      refs: [...new Set(r.items.map((i) => i.citation))],
      durationMs: 1300,
      step: "regulation",
    });
    out.push({ agent: "regulation", actor: "ai", kind: "result", title: `충족 ${ok}건 · 확인 필요 ${ask.length}건`, detail: r.conclusion.text, step: "regulation", durationMs: 200 });
    for (const q of next.questions.filter((x) => x.step === "regulation" && !x.answer)) {
      out.push({ agent: "regulation", actor: "ai", kind: "ask", title: `되묻기 · ${q.text}`, detail: q.why, step: "regulation", streamId: q.streamId, durationMs: 80 });
    }
  }
  const m = next.matching;
  if (!prev.matching && m) {
    out.push({ agent: "matching", actor: "ai", kind: "tool", tool: "PostGIS · 단지 기업 거리 계산", title: "같은 단지에서 같은 재질·출처 흐름을 내는 기업 찾기", durationMs: 600, step: "matching" });
    for (const b of m.bundles) {
      out.push({
        agent: "matching",
        actor: "ai",
        kind: "tool",
        tool: "허가 품목 대조",
        title: `수거 업체 ${b.collector.name} 선택 · 제외 ${b.excluded.length}곳`,
        refs: b.excluded.map((e) => `${e.name}: ${e.reason}`),
        durationMs: 400,
        step: "matching",
        streamId: b.streamId,
      });
      out.push({
        agent: "matching",
        actor: "ai",
        kind: "tool",
        tool: "OR-Tools · 순회 순서",
        title: `순회 순서 계산${b.routeM ? ` · 약 ${(b.routeM / 1000).toFixed(1)}km` : ""}`,
        durationMs: 500,
        step: "matching",
        streamId: b.streamId,
      });
      out.push({
        agent: "matching",
        actor: "ai",
        kind: "result",
        title: `${nameOf(b.streamId)} 묶음 ${b.group.length}개사 · 적재율 ${Math.round(b.soloFillRate * 100)}% → ${Math.round(b.fillRate * 100)}%`,
        detail: `월 합계 ${formatNumber(b.totalKg)}kg. 다른 회사 물량은 배출 기업 화면에서 숨깁니다.`,
        durationMs: 150,
        step: "matching",
        streamId: b.streamId,
      });
    }
    for (const p of m.partners) {
      out.push({ agent: "matching", actor: "ai", kind: "result", title: `${nameOf(p.streamId)} 거래처 · ${p.name}`, detail: p.note, durationMs: 120, step: "matching", streamId: p.streamId });
    }
  }
  const cc = next.costCarbon;
  if (!prev.costCarbon && cc) {
    const a = cc.routes.find((x) => x.id === "A");
    const c = cc.routes.find((x) => x.id === "C");
    out.push({ agent: "cost-carbon", actor: "ai", kind: "tool", tool: "Azure Maps · 도로 거리", title: "순회 수거·매각 운송 거리 계산", durationMs: 800, step: "cost-carbon" });
    out.push({ agent: "cost-carbon", actor: "ai", kind: "tool", tool: "배출계수·KAU 시세", title: "흐름별 순 탄소와 배출권 환산", refs: cc.assumptions.filter((x) => /탄소|KAU/.test(x.label)).map((x) => `${x.label}: ${x.value}`), durationMs: 500, step: "cost-carbon" });
    out.push({
      agent: "cost-carbon",
      actor: "ai",
      kind: "result",
      title: `시나리오 ${cc.routes.length}개 비교${a && c ? ` · A ${formatSigned(a.monthlyKrw)}원, C ${formatSigned(c.monthlyKrw)}원` : ""}`,
      detail: a ? `A 순 탄소 ${formatSigned(a.carbonT, 2)} tCO₂e/월, 배출권 환산 ${formatSigned(a.kauKrw)}원/월` : undefined,
      step: "cost-carbon",
      durationMs: 150,
    });
  }
  const p = next.proposal;
  if (!prev.proposal && p) {
    const external = p.documents.filter((d) => d.external).length;
    out.push({ agent: "proposal", actor: "ai", kind: "tool", tool: "Azure OpenAI · 서류 초안", title: `서류 초안 ${p.documents.length}종 작성`, refs: p.documents.map((d) => `${d.title} → ${d.to}`), durationMs: 2400, step: "proposal" });
    out.push({ agent: "proposal", actor: "ai", kind: "tool", tool: "Foundry 평가 · 근거 충실도", title: "서류의 숫자·조항 인용이 앞 단계 결과와 맞는지 검사", detail: "시연에서는 모의 평가입니다. 실제로는 검증 세트로 인용 정확도를 측정합니다.", durationMs: 900, step: "proposal" });
    out.push({ agent: "proposal", actor: "ai", kind: "ask", title: `사람 승인 대기 · 외부 발송 서류 ${external}건`, detail: "에이전트는 외부로 아무것도 보내지 않습니다. 승인권자가 발송 대상과 확인 항목을 체크한 뒤에만 나갑니다.", step: "proposal", durationMs: 80 });
  }
  return out;
}

export const STEP_OF_WORD: [RegExp, FlowStep][] = [
  [/식별|분류/, "classify"],
  [/경로|판정/, "feasibility"],
  [/규정|법령|조항/, "regulation"],
  [/매칭|묶음|업체|거래처/, "matching"],
  [/비용|탄소|시나리오/, "cost-carbon"],
  [/이행|서류|제안/, "proposal"],
];

/** 명령에 대한 에이전트 답 한 줄 */
export function reply(title: string, detail?: string): Draft {
  return { agent: "orchestrator", actor: "ai", kind: "result", title, detail, durationMs: 300 };
}

