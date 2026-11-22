"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/v3/api";
import type { AdaptiveState, ScenarioPreview } from "@/lib/v3/adaptive";
import type { Claim, DiagnosisView, Result } from "@/lib/v3/types";
import { useV3 } from "./context";

function money(claim: Claim | null | undefined) {
  return typeof claim?.value === "number" ? `${claim.value < 0 ? "−" : "+"}${Math.abs(claim.value).toLocaleString("ko-KR")}원` : "산정 보류";
}

function Comparison({ before, after, view }: { before: Result | null; after: Result | null; view: DiagnosisView }) {
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">변경 전후 월 손익과 배정 업체</caption>
      <thead><tr className="border-b border-line text-muted"><th className="py-3 font-medium">비교 항목</th><th className="px-2 font-medium">기존 안</th><th className="px-2 font-medium">새 대안</th></tr></thead>
      <tbody>
        <tr className="border-b border-line"><th className="py-3 font-medium">월 손익</th><td className="px-2 font-mono tabular-nums">{money(before?.totals.monthlyAfter)}</td><td className="px-2 font-mono tabular-nums">{money(after?.totals.monthlyAfter)}</td></tr>
        {view.streams.map(s => {
          const old = before?.assignments.find(a => a.streamId === s.id);
          const next = after?.assignments.find(a => a.streamId === s.id);
          const label = (a: typeof old) => !a ? "확인 중" : a.route === "reuse" ? "공정 재투입" : a.vendorName || "현행 유지";
          return <tr key={s.id} className="border-b border-line"><th className="py-3 font-medium">{s.name}</th><td className="px-2">{label(old)}<span className="block text-xs text-muted">{money(old?.monthlyAfter)}</span>{old?.transport ? <span className="block text-xs text-muted">운반비 {Math.abs(Number(old.transport.value)).toLocaleString("ko-KR")}원</span> : null}</td><td className="px-2">{label(next)}<span className="block text-xs text-muted">{money(next?.monthlyAfter)}</span>{next?.transport ? <span className="block text-xs text-muted">운반비 {Math.abs(Number(next.transport.value)).toLocaleString("ko-KR")}원</span> : null}{next?.pickup?.pickups ? <span className="block text-xs text-muted">월 {String(next.pickup.pickups.value)}회 수거</span> : null}{next?.status === "conditional" ? <span className="block text-xs text-warn">조건 확인 필요</span> : null}</td></tr>;
        })}
      </tbody>
    </table>
    <p className="mt-2 text-xs text-muted">+ 받는 돈 · − 내는 돈. 새 대안은 양쪽 승인 전까지 확정되지 않습니다.</p>
  </div>;
}

export function AdaptivePanel({ view, busy }: { view: DiagnosisView; busy: boolean }) {
  const { org, setSessionId, openEvidence } = useV3();
  const [state, setState] = useState<AdaptiveState | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [streamId, setStreamId] = useState(view.streams[0]?.id || "");
  const initial = view.streams.find(s => s.id === streamId)?.monthlyKg?.value;
  const [amount, setAmount] = useState(typeof initial === "number" ? String(initial) : "");
  const [limit, setLimit] = useState("");
  const [preview, setPreview] = useState<ScenarioPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    const read = async () => {
      try { const next = await api.adaptive(view.session.id, org.id); if (active) { setState(next); setNoticeError(null); } }
      catch { if (active) setNoticeError("조건 변경 소식을 확인하지 못했습니다. 잠시 후 다시 확인합니다."); }
    };
    void read();
    const timer = window.setInterval(read, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [view.session.id, org.id]);
  const invalidate = () => { revision.current++; setPreview(null); setError(null); };
  const change = state?.change;
  const superseded = change && change.sessionId !== view.session.id;
  const valid = Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= 10000000 && (!limit || (Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= 31));
  async function compare() {
    if (!valid) return;
    const seq = ++revision.current;
    setPending(true); setError(null); setPreview(null);
    try {
      const next = await api.previewScenario(view.session.id, org.id, { streamId, monthlyKg: Number(amount), maxPickupsPerMonth: limit ? Number(limit) : null });
      if (alive.current && revision.current === seq) setPreview(next);
    } catch (e) { if (alive.current && revision.current === seq) setError(e instanceof Error ? e.message : "비교하지 못했습니다. 다시 시도해 주세요."); }
    finally { if (alive.current) setPending(false); }
  }
  async function apply() {
    if (!preview) return;
    setPending(true); setError(null);
    try {
      const next = await api.applyScenario(view.session.id, org.id, { ...preview.options, token: preview.token });
      if (alive.current) setSessionId(next.sessionId);
    } catch (e) { if (alive.current) { setPreview(null); setError(e instanceof Error ? e.message : "적용하지 못했습니다. 다시 비교해 주세요."); } }
    finally { if (alive.current) setPending(false); }
  }
  return <section aria-label="조건 변경과 대안 비교" className="space-y-4 border-y border-line py-6">
    {change ? <div role="status" className="rounded-lg bg-ground p-4">
      <h2 className="font-semibold">{change.state === "ready" ? "새 조건으로 대안을 준비했습니다" : change.state === "failed" ? "대안을 찾다가 멈췄습니다" : change.state === "needs_input" ? "대안을 찾으려면 확인이 필요합니다" : "바뀐 조건으로 대안을 찾고 있습니다"}</h2>
      <p className="mt-1 text-sm text-ink-2">{change.reason}</p>
      {change.after ? <Comparison before={change.before} after={change.after} view={view} /> : null}
      {change.after ? <button className="mt-2 min-h-11 text-sm underline" onClick={() => openEvidence(change.after?.totals.monthlyAfter?.evidence || [], "새 대안 월 손익 근거")}>새 대안의 계산 근거</button> : null}
      {superseded ? <Button variant="secondary" className="mt-3" onClick={() => setSessionId(change.sessionId)}>새 대안과 진행 보기</Button> : null}
      <p className="mt-2 text-xs text-muted">이전 거래의 서류와 검수 기록은 그대로 보관합니다.</p>
    </div> : <p className="text-sm text-muted">업체의 매입·수거 조건이 바뀌면 대안을 다시 찾아 알려드립니다.</p>}
    {noticeError ? <p role="status" className="text-sm text-warn">{noticeError}</p> : null}
    {!superseded && view.result ? <details>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">조건을 바꿔 비교하기</summary>
      <p className="mt-2 text-sm text-muted">월 발생량과 최대 수거 횟수를 바꾸면 비용과 받을 수 있는 업체를 다시 계산합니다.</p>
      <fieldset disabled={pending || busy} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">폐기물<select aria-label="비교할 폐기물" value={streamId} onChange={e => { invalidate(); setStreamId(e.target.value); const value = view.streams.find(s => s.id === e.target.value)?.monthlyKg?.value; setAmount(typeof value === "number" ? String(value) : ""); }} className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-surface px-3">{view.streams.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">월 발생량 (kg)<input aria-label="비교할 월 발생량" type="number" min="0.01" max="10000000" step="any" value={amount} onChange={e => { invalidate(); setAmount(e.target.value); }} className="mt-1 min-h-11 w-full rounded-md border border-line-strong px-3 tabular-nums" /></label>
        <label className="text-sm">월 최대 수거 횟수<select aria-label="월 최대 수거 횟수" value={limit} onChange={e => { invalidate(); setLimit(e.target.value); }} className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-surface px-3"><option value="">제한 없음</option>{[1,2,4,8,12,16,20,31].map(n => <option key={n} value={n}>{n}회 이하</option>)}</select></label>
      </fieldset>
      <p className="mt-2 text-xs text-muted">수거 횟수는 전체 폐기물에 적용합니다. 업체가 밝힌 횟수가 제한을 넘거나 미확인이면 후보에서 제외합니다. 업체 조건을 임의로 바꾸지 않습니다.</p>
      {!valid ? <p className="mt-2 text-sm text-warn">월 발생량을 0보다 크고 천만 kg 이하로 입력해 주세요.</p> : null}
      <Button variant="secondary" className="mt-4" disabled={!valid || pending || busy} onClick={compare}>{pending ? "처리 중…" : "대안 계산"}</Button>
      {error ? <p role="alert" className="mt-3 text-sm text-loss">{error}</p> : null}
      {preview ? <div aria-live="polite" className="mt-4 space-y-3">
        <p className="text-sm text-muted">{preview.basis}</p>
        <Comparison before={view.result} after={preview.result} view={view} />
        {preview.excluded.length ? <ul className="text-sm text-warn">{preview.excluded.map(item => <li key={item.vendorOrgId}>{view.threads.find(t => t.vendorOrgId === item.vendorOrgId)?.vendorName || "후보 업체"}: {item.reason}</li>)}</ul> : null}
        {preview.questions.length ? <p className="text-sm text-warn">추가 자료가 필요해 비교를 끝내지 못했습니다. 자료를 확인한 뒤 다시 비교해 주세요.</p> : null}
        <details><summary className="min-h-11 cursor-pointer py-2 text-sm">비교 계산의 근거 보기</summary><ul className="max-h-72 space-y-3 overflow-y-auto text-xs">{Object.entries(preview.evidence).map(([key, detail]) => <li key={key} className="border-t border-line pt-2"><p className="font-medium">{detail.evidence.label}</p><p>{detail.evidence.excerpt}</p><p className="text-muted">{detail.evidence.source}</p></li>)}</ul></details>
        <Button variant="secondary" disabled={pending || busy || !preview.result || preview.questions.length > 0} onClick={apply}>이 조건으로 재협상</Button>
        <p className="text-xs text-muted">선택한 월 발생량을 자료에 저장하고 새 찾기를 시작합니다. 기존 승인으로 확정하지 않습니다.</p>
      </div> : null}
    </details> : null}
  </section>;
}
