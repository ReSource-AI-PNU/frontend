"use client";

import { useEffect, useRef, useState } from "react";
import { SessionPhoto } from "@/components/session/session-photo";
import { OriginChip, RouteBadge } from "@/components/session/stream-badges";
import { buttonClass } from "@/components/ui/button";
import { previewFeasibility, type PreviewResult } from "@/lib/api/feasibility-preview";
import { formatSigned } from "@/lib/format";
import { STREAM_ROUTE_LABEL, type Stream, type StreamRoute } from "@/lib/session/types";

const money = (n: number | null) => n === null ? "계산 보류" : `${formatSigned(n)}원`;
const rates = (n: number | null) => n === null ? "계산 보류" : `${formatSigned(n)}원/kg`;

type Draft = { kg: string; confirmed: boolean; route: StreamRoute | "" };

export function FeasibilityPreview({ streams }: { streams: Stream[] }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(
    streams.map((s) => [s.id, { kg: String(s.monthlyKg), confirmed: s.monthlyKgConfirmed, route: "" }]),
  ));
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { sequence.current++; controller.current?.abort(); }, []);

  function change(id: string, patch: Partial<Draft>) {
    sequence.current++;
    controller.current?.abort();
    setLoading(false);
    setResult(null);
    setError(null);
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  }

  async function calculate() {
    const parsed = streams.map((stream) => ({ stream, draft: drafts[stream.id] }));
    if (parsed.some(({ draft }) => draft.kg.trim() === "" || !Number.isFinite(Number(draft.kg)) || Number(draft.kg) < 0)) {
      setError("월 발생량은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    const requestStreams = parsed.map(({ stream, draft }) => ({
      ...stream, monthlyKg: Number(draft.kg), monthlyKgConfirmed: draft.confirmed,
    }));
    const overrides = Object.fromEntries(parsed.filter(({ draft }) => draft.route).map(({ stream, draft }) => [stream.id, draft.route as StreamRoute]));
    const current = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await previewFeasibility(requestStreams, overrides, abort.signal);
      if (current === sequence.current) setResult(response);
    } catch (err) {
      if (current === sequence.current && !abort.signal.aborted) {
        setError(err instanceof Error ? err.message : "미리보기를 불러오지 못했습니다.");
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }

  const byId = new Map(result?.decisions.map((d) => [d.streamId, d]));
  return (
    <div className="grid gap-8">
      <p className="rounded-md bg-sunken px-4 py-3 text-sm text-ink-2">
        가상 시연 계산이며 결과와 변경한 값은 저장되지 않습니다. 규정·매칭·시나리오 등 후속 단계는 이 미리보기와 연결되지 않은 별도 모의 결과입니다.
      </p>
      <section className="grid gap-6 border-y border-line py-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-labelledby="total-title">
        <div>
          <p className="text-label text-muted">가상 공장 경제 효과</p>
          <h2 id="total-title" className="mt-2 text-h2">공장 월 손익</h2>
          {result ? <p className="num mt-4 text-[32px] font-semibold">{money(result.totalNow)} → {money(result.totalAfter)}</p> : <p className="mt-4 text-sm text-muted">발생량과 확인 여부를 입력하고 계산해 주세요.</p>}
          {result?.status === "conditional" && <p className="mt-2 text-sm text-warn">묶음 경로가 포함된 조건부 결과입니다. 실제 거래는 확정되지 않았습니다.</p>}
          {result?.status === "needs_information" && <p className="mt-2 text-sm text-warn">확인이 필요한 흐름이 있어 공장 합계를 계산하지 않았습니다.</p>}
        </div>
        <dl className="grid content-center grid-cols-2 text-sm">
          <dt className="border-b border-line py-3 text-muted">월 개선액</dt><dd className="num border-b border-line py-3 text-right">{result ? money(result.difference) : "—"}</dd>
          <dt className="border-b border-line py-3 text-muted">탄소</dt><dd className="border-b border-line py-3 text-right">미계산</dd>
        </dl>
      </section>
      <section aria-labelledby="map-title">
        <h2 id="map-title" className="text-h2">흐름 지도</h2>
        <p className="mt-1 text-sm text-muted">월 발생량, 확인 여부와 경로를 정한 다음 계산합니다.</p>
        <ol className="mt-3 border-t border-ink">
          {streams.map((stream) => {
            const draft = drafts[stream.id];
            const d = byId.get(stream.id);
            return <li key={stream.id} className="grid gap-4 border-b border-line py-5 lg:grid-cols-[200px_minmax(0,1fr)_220px]">
              <div className="flex gap-3"><div className="relative size-16 shrink-0 overflow-hidden rounded-md"><SessionPhoto media={stream.media[0]} compact className="aspect-square! rounded-md" /></div><div><p className="font-semibold">{stream.name}</p><p className="mt-1 text-sm text-muted">{stream.classify.material}</p><div className="mt-2"><OriginChip origin={stream.origin} source={stream.originSource} /></div></div></div>
              <div className="grid content-start gap-3">
                <label className="text-sm">월 발생량 (kg)
                  <input aria-label={`${stream.name} 월 발생량`} type="number" min="0" step="any" value={draft.kg} onChange={(e) => change(stream.id, { kg: e.target.value })} className="ml-2 w-32 rounded-md border border-line-strong bg-surface px-2 py-1" />
                </label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.confirmed} onChange={(e) => change(stream.id, { confirmed: e.target.checked })} />발생량 확인</label>
                <label className="text-sm">경로 선택 <select aria-label={`${stream.name} 경로 선택`} value={draft.route} onChange={(e) => change(stream.id, { route: e.target.value as Draft["route"] })} className="ml-2 rounded-md border border-line-strong bg-surface px-2 py-1">
                  <option value="">시연 추천</option>{Object.entries(STREAM_ROUTE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                {d && <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">{d.route && <RouteBadge route={d.route} />}{d.aiRoute && <span className="text-muted">담당자 변경 · 원래 시연 경로 {STREAM_ROUTE_LABEL[d.aiRoute]}</span>}</div>
                  <p className={d.status === "needs_information" ? "text-warn" : undefined}>{d.status === "needs_information" ? "계산 보류 · " : ""}{d.reason}</p>
                  {d.status === "conditional" && <p className="text-warn">묶음은 가상 조건부 후보입니다.</p>}
                  <p className="text-muted">kg당: {rates(d.currentPerKg)} → {rates(d.afterPerKg)}</p>
                  {d.action && <p>작업: {d.action.title} · {d.action.laborHours}시간 · {money(d.action.laborCost)}</p>}
                  <p>현금 매각액: {money(d.cashSaleRevenue)} · 신재 구매 회피 순효과: {money(d.purchaseAvoidanceNet)}</p>
                  <p className="text-muted">처리비 {money(d.disposalCost)} · 운송비 {money(d.transportCost)} · 인건비 {money(d.laborCost)}</p>
                </div>}
              </div>
              <dl className="grid content-start gap-1 text-sm"><div className="flex justify-between"><dt className="text-muted">지금</dt><dd className="num">{d ? money(d.monthlyNow) : "—"}</dd></div><div className="flex justify-between"><dt className="text-muted">바꾸면</dt><dd className="num">{d ? money(d.monthlyAfter) : "—"}</dd></div></dl>
            </li>;
          })}
        </ol>
      </section>
      <div className="flex flex-wrap items-center gap-4"><button type="button" className={buttonClass("primary")} onClick={calculate} disabled={loading}>{loading ? "계산 중…" : "경제 효과 계산"}</button>{loading && <span role="status" className="text-sm text-muted">백엔드에서 계산하고 있습니다.</span>}</div>
      {error && <p role="alert" className="rounded-md bg-loss-bg p-4 text-sm text-loss">{error} 백엔드 서버와 API 주소를 확인한 후 다시 시도해 주세요.</p>}
      {result && <details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold">계산 가정 보기</summary><ul className="mt-3 list-disc pl-5 text-sm text-muted">{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}
    </div>
  );
}
