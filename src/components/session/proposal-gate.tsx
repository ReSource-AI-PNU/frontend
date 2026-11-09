"use client";

import { useActionState, useState } from "react";
import { approveAndSend } from "@/lib/server/session-actions";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";

type GateState = { error?: string; ok?: true } | undefined;

/**
 * 사람 승인 게이트 (DESIGN.md). 먹색 1px 테두리 상자 안에 발송 대상과 확인 항목을 두고,
 * 확인해야만 먹색 "승인 후 발송" 버튼이 켜진다. 승인해야만 외부(모의 메일함)로 나간다.
 */
export function ProposalGate({
  sessionId,
  routeLabel,
  targets,
  approver,
  drafts,
}: {
  sessionId: string;
  routeLabel: string;
  targets: { name: string; kind: string }[];
  approver: string;
  drafts: string[];
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState<GateState, FormData>((_prev, formData) => approveAndSend(sessionId, formData), undefined);

  return (
    <form action={action} aria-labelledby="gate-title" className="grid gap-4 rounded-lg border border-ink bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="gate-title" className="text-[16px] font-semibold">
            {targets.length}곳에 발송합니다
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">선택한 경로: {routeLabel}</p>
        </div>
        <Badge tone="warn">승인 대기</Badge>
      </div>

      <div>
        <p className="text-label text-muted">발송 대상</p>
        <ul className="mt-1.5 divide-y divide-line border-y border-line text-sm">
          {targets.map((t) => (
            <li key={`${t.name}-${t.kind}`} className="flex items-center justify-between gap-3 py-2">
              <span className="font-semibold">{t.name}</span>
              <span className="text-[13px] text-muted">{t.kind}</span>
            </li>
          ))}
        </ul>
        {drafts.length ? <p className="mt-2 text-[13px] text-muted">{drafts.join(", ")}은(는) 발송하지 않고 초안으로만 저장합니다.</p> : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-ink"
        />
        <span>발송 대상과 견적 요청서 내용을 확인했습니다. 승인하면 위 {targets.length}곳에 바로 발송됩니다.</span>
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={!confirmed || pending || targets.length === 0} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "발송하는 중…" : "승인 후 발송"}
      </button>
      <p className="-mt-1 text-[12.5px] text-muted">승인자는 {approver}님으로 기록됩니다. 발송은 시연용 모의 메일함으로 갑니다.</p>
    </form>
  );
}
