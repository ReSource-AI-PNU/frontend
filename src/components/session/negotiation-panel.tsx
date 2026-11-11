"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatSigned } from "@/lib/format";
import { approveNegotiation, resetNegotiation, startNegotiation } from "@/lib/server/session-actions";
import type { Guardrails, Negotiation, PickupTerms } from "@/lib/session/types";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { MoreDetails } from "../ui/more-details";

const WEEKDAYS = ["월", "화", "수", "목", "금"] as const;
const STEP_MS = 1100;
const noopSubscribe = () => () => {};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const termsText = (t: PickupTerms) => `${t.day}요일 ${t.slot} · ${t.perKg}원/kg · 월 ${t.perMonth}회`;

type ActionState = { error?: string; ok?: true } | undefined;

/**
 * 순회 수거 조건 협상(A2A). 사람은 가드레일만 정하고, 우리 에이전트와 수거 업체 에이전트가 조건을 주고받는다.
 * 대화 말풍선이 아니라 차례별 제안 장부로 보여 준다(DESIGN.md: 에이전트 기록은 채팅 말풍선으로 쓰지 않는다).
 * 합의안은 승인 게이트(먹색 테두리 상자) 안에서 사람이 승인해야 확정된다.
 */
export function NegotiationPanel({
  sessionId,
  streamId,
  streamName,
  collectorName,
  requested,
  defaults,
  negotiation,
  impact,
}: {
  sessionId: string;
  streamId: string;
  streamName: string;
  collectorName: string;
  requested: PickupTerms;
  defaults: Guardrails;
  negotiation?: Negotiation;
  /** 합의 단가를 적용했을 때 이 흐름의 월 손익(지금 판정값 → 합의 기준) */
  impact?: { before: number; after: number };
}) {
  const [editing, setEditing] = useState(false);
  const titleId = `neg-${streamId}`;
  const showForm = !negotiation || editing;

  return (
    <section aria-labelledby={titleId} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-h2">
            {streamName} 수거 조건 협상
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-2">
            우리 에이전트가 {collectorName} 에이전트와 요일·단가·횟수를 조율합니다. 사람은 범위만 정하고, 합의안을 승인합니다.
          </p>
        </div>
        {negotiation ? (
          <Badge tone={negotiation.status === "approved" ? "gain" : negotiation.status === "agreed" ? "warn" : "loss"}>
            {negotiation.status === "approved" ? "합의 승인 완료" : negotiation.status === "agreed" ? "합의 · 승인 대기" : "사람 판단 필요"}
          </Badge>
        ) : null}
      </div>

      {showForm ? (
        <GuardrailForm sessionId={sessionId} streamId={streamId} requested={requested} defaults={negotiation?.guardrails ?? defaults} onDone={() => setEditing(false)} />
      ) : (
        <Ledger key={negotiation.id} sessionId={sessionId} negotiation={negotiation} collectorName={collectorName} impact={impact} onRetry={() => setEditing(true)} />
      )}
    </section>
  );
}

function GuardrailForm({
  sessionId,
  streamId,
  requested,
  defaults,
  onDone,
}: {
  sessionId: string;
  streamId: string;
  requested: PickupTerms;
  defaults: Guardrails;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(startNegotiation.bind(null, sessionId, streamId), undefined);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (state?.ok) done.current();
  }, [state]);

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-line px-5 py-4">
      <p className="text-[13.5px] text-ink-2">
        요청서 조건: <b className="font-semibold text-ink">{termsText(requested)}</b>. 에이전트는 아래 범위 안에서만 양보하고, 벗어나면 협상을 멈추고 사람에게 넘깁니다.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">하한 단가 (원/kg)</span>
          <input
            name="minPerKg"
            inputMode="numeric"
            defaultValue={defaults.minPerKg}
            className="num h-11 rounded-md border border-line-strong bg-surface px-3 text-right text-[15px] focus:border-ink focus:outline-none"
          />
        </label>
        <fieldset className="grid gap-1.5 text-sm">
          <legend className="mb-1.5 font-semibold">가능한 요일</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="days" value={d} defaultChecked={defaults.days.includes(d)} className="peer sr-only" />
                <span className="grid size-11 place-items-center rounded-md border border-line-strong text-[14px] text-muted peer-checked:border-ink peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-on-ink peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
                  {d}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">월 최소 수거 횟수</span>
          <select name="minPerMonth" defaultValue={defaults.minPerMonth} className="h-11 rounded-md border border-line-strong bg-surface px-3 text-[15px] focus:border-ink focus:outline-none">
            {[1, 2, 4].map((n) => (
              <option key={n} value={n}>
                월 {n}회
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "에이전트가 협상 중…" : "에이전트에게 협상 맡기기"}
        </button>
        {state?.error ? (
          <p role="alert" className="text-sm text-loss">
            {state.error}
          </p>
        ) : (
          <p className="text-[12.5px] text-muted">수거 업체 에이전트는 시연용 모의 에이전트입니다. 실제로는 업체가 자기 에이전트를 A2A로 연결합니다.</p>
        )}
      </div>
    </form>
  );
}

function Ledger({
  sessionId,
  negotiation: n,
  collectorName,
  impact,
  onRetry,
}: {
  sessionId: string;
  negotiation: Negotiation;
  collectorName: string;
  impact?: { before: number; after: number };
  onRetry: () => void;
}) {
  // 처음 보는 협상이면 차례를 하나씩 보여 준다. 서버와 동작 줄이기 설정에서는 전부 보여 준다
  const key = `rs-neg:${n.id}`;
  const unseen = useSyncExternalStore(noopSubscribe, () => !reducedMotion() && !window.sessionStorage.getItem(key), () => false);
  const [shown, setShown] = useState<number | null>(null);
  const total = n.rounds.length;
  const count = shown ?? (unseen ? 1 : total);
  // 회신 대기 중 화면을 주기적으로 새로 읽어도 차례 공개가 처음부터 다시 돌지 않게, 협상 id와 차례 수에만 묶는다
  useEffect(() => {
    if (!unseen) return;
    const timers = Array.from({ length: total }, (_, i) =>
      window.setTimeout(() => {
        setShown(i + 1);
        if (i === total - 1) {
          window.sessionStorage.setItem(key, "1");
          setShown(null);
        }
      }, STEP_MS * i),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [unseen, key, total]);
  const finished = count >= n.rounds.length;
  const [approveState, approve, approving] = useActionState<ActionState, FormData>(async () => approveNegotiation(sessionId, n.id), undefined);

  return (
    <div className="grid gap-4">
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span>가드레일</span>
        <span>
          하한 <b className="num text-ink-2">{n.guardrails.minPerKg}원/kg</b>
        </span>
        <span>
          요일 <b className="text-ink-2">{n.guardrails.days.join("·")}</b>
        </span>
        <span>
          월 <b className="num text-ink-2">{n.guardrails.minPerMonth}회</b> 이상
        </span>
      </p>

      <ol className="border-t border-ink" aria-live="polite">
        {n.rounds.slice(0, count).map((r, i) => (
          <li key={i} className="grid gap-x-4 gap-y-1 border-b border-line py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
            <p className="text-[12.5px]">
              <span className="num text-muted">{String(i + 1).padStart(2, "0")}</span>{" "}
              <span className={`font-semibold ${r.by === "ours" ? "text-ink" : "text-ink-2"}`}>{r.by === "ours" ? "우리 에이전트" : `${collectorName} 에이전트`}</span>
            </p>
            <div className="min-w-0">
              <p className="num text-[14px] font-semibold">
                {termsText(r.terms)}
                {r.accept ? <span className="ml-2 font-sans text-[12.5px] font-semibold text-gain">수락</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-2">{r.message}</p>
            </div>
            <span className="self-start">
              <Badge tone={r.within ? "neutral" : "warn"}>{r.within ? "가드레일 안" : "가드레일 밖"}</Badge>
            </span>
          </li>
        ))}
        {!finished ? (
          <li className="py-3 text-[13px] text-muted" aria-hidden="true">
            상대 에이전트의 답을 기다리는 중…
          </li>
        ) : null}
      </ol>

      {finished && n.status === "failed" ? (
        <div className="grid gap-3 rounded-md bg-loss-bg px-4 py-3.5">
          <p className="text-sm text-ink">
            <b className="font-semibold">합의하지 못해 사람에게 넘깁니다.</b> {n.note}
          </p>
          <button type="button" onClick={onRetry} className={`${buttonClass("secondary", "sm")} w-fit`}>
            가드레일 바꿔 다시 협상
          </button>
        </div>
      ) : null}

      {finished && n.agreed && n.status !== "failed" ? (
        <div className={`grid gap-3 rounded-lg px-5 py-4 ${n.status === "approved" ? "border border-line" : "border border-ink"}`}>
          <p className="text-label text-muted">합의안</p>
          <p className="num text-[20px] font-bold tracking-[-0.02em]">{termsText(n.agreed)}</p>
          <p className="text-[13.5px] text-ink-2">
            요청서({termsText(n.requested)})보다 단가가 kg당 {n.requested.perKg - n.agreed.perKg}원 낮고, 요일이 {n.requested.day === n.agreed.day ? "같습니다" : `${n.agreed.day}요일로 바뀌었습니다`}.
            {impact ? (
              <>
                {" "}
                이 흐름의 월 손익은 <span className="num">{formatSigned(impact.before)}원</span> → <b className="num font-semibold">{formatSigned(impact.after)}원</b>이 됩니다.
              </>
            ) : null}
          </p>
          {n.status === "approved" ? (
            <p className="text-[13px] text-ink-2">
              <span className="rounded-sm bg-ink px-1.5 text-[12px] font-semibold text-on-ink">승인</span> {n.approvedBy} · 순회 일정을 확정하고 이웃 기업에 알렸습니다.
            </p>
          ) : (
            <form action={approve} className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={approving} className={buttonClass("secondary")}>
                {approving ? "승인 중…" : "합의안 승인"}
              </button>
              <button type="button" onClick={() => resetNegotiation(sessionId, n.id)} className={buttonClass("ghost", "sm")}>
                다시 협상
              </button>
              {approveState?.error ? (
                <p role="alert" className="text-sm text-loss">
                  {approveState.error}
                </p>
              ) : (
                <p className="text-[12.5px] text-muted">승인권자만 승인할 수 있습니다. 에이전트는 대신 승인하지 않습니다.</p>
              )}
            </form>
          )}
        </div>
      ) : null}

      <MoreDetails label="협상 규칙 보기" closeLabel="협상 규칙 접기">
        <ul className="grid list-disc gap-1 pl-4 text-[13px] text-ink-2 marker:text-muted">
          <li>우리 에이전트는 요청서 조건에서 시작해 kg당 5원씩만 내리고, 하한 단가 아래로는 내려가지 않습니다.</li>
          <li>요일은 가드레일 요일 안에서만 받아들입니다. 겹치는 요일이 없으면 바로 사람에게 넘깁니다.</li>
          <li>최대 {n.guardrails.maxRounds}차례 안에 합의하지 못하면 멈춥니다. 합의해도 사람이 승인해야 확정됩니다.</li>
        </ul>
      </MoreDetails>
    </div>
  );
}
