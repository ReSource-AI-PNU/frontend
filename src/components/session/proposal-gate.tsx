"use client";

import { useActionState, useState } from "react";
import { approveAndSend } from "@/lib/server/session-actions";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";

type GateState = { error?: string; ok?: true } | undefined;

export type GateTarget = { name: string; kind: string; stream?: string };

/**
 * 사람 승인 게이트 (DESIGN.md). 먹색 1px 테두리 상자 안에 발송 대상과 확인 항목을 두고,
 * 확인해야만 먹색 "승인 후 발송" 버튼이 켜진다. 승인해야만 외부(모의 메일함)로 나간다.
 * 발송 대상은 approveAndSend와 같은 규칙으로 page에서 계산한다:
 * A = 순회 수거 요청서(수거 업체) + 묶음 참여 제안(그룹 기업) + 매각 견적 요청서(매입처), B = 매각 견적 요청서만, C·D = 발송 없음.
 * 보낼 곳이 없으면 버튼 대신 안내(emptyNote)를 보여 준다.
 */
export function ProposalGate({
  sessionId,
  routeLabel,
  targets,
  approver,
  internalDocs,
  emptyNote,
}: {
  sessionId: string;
  routeLabel: string;
  targets: GateTarget[];
  approver: string;
  /** 발송하지 않는 서류 이름 */
  internalDocs: string[];
  emptyNote?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState<GateState, FormData>((_prev, formData) => approveAndSend(sessionId, formData), undefined);
  const places = new Set(targets.map((t) => t.name)).size;
  const internalLine = internalDocs.length ? <p className="text-[13px] text-muted">{internalDocs.join(", ")}은(는) 내부용이라 발송하지 않습니다.</p> : null;

  if (targets.length === 0) {
    return (
      <section aria-labelledby="gate-title" className="grid gap-3 rounded-lg border border-line-strong bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="gate-title" className="text-[16px] font-semibold">
              외부로 보낼 서류가 없습니다
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">선택한 방안: {routeLabel}</p>
          </div>
          <Badge tone="neutral">발송 없음</Badge>
        </div>
        <p className="text-sm text-ink-2">{emptyNote ?? "고른 방안에서는 순회 수거 요청서와 매각 견적 요청서를 보내지 않습니다."}</p>
        {internalLine}
      </section>
    );
  }

  return (
    <form action={action} aria-labelledby="gate-title" className="grid gap-4 rounded-lg border border-ink bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="gate-title" className="text-[16px] font-semibold">
            {places}곳에 서류 {targets.length}건을 발송합니다
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">선택한 방안: {routeLabel}</p>
        </div>
        <Badge tone="warn">승인 대기</Badge>
      </div>

      <div>
        <p className="text-label text-muted">발송 대상</p>
        <ul className="mt-1.5 divide-y divide-line border-y border-line text-sm">
          {targets.map((t, i) => (
            <li key={`${t.name}-${t.kind}-${i}`} className="flex items-start justify-between gap-3 py-2">
              <span className="font-semibold">{t.name}</span>
              <span className="text-right text-[13px] text-muted">
                {t.kind}
                {t.stream ? <span className="block text-[12px]">{t.stream}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2">{internalLine}</div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-ink"
        />
        <span>발송 대상과 서류 내용을 확인했습니다. 승인하면 위 {targets.length}건이 바로 발송됩니다.</span>
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={!confirmed || pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "발송하는 중…" : "승인 후 발송"}
      </button>
      <p className="-mt-1 text-[12.5px] text-muted">승인자는 {approver}님으로 기록됩니다. 발송은 시연용 모의 메일함으로 갑니다.</p>
    </form>
  );
}
