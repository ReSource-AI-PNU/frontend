import type { ReactNode } from "react";
import { FLOW_STEPS, type KnowledgeCard } from "@/lib/session/types";
import { Badge } from "../ui/badge";
import { formatDate } from "../dashboard/format-date";
import { KNOWLEDGE_STATUS } from "./status";

/**
 * 현장 지식 카드(암묵지)를 영수증 형식으로 보여 준다. 조건 → 판단 → 근거 순서.
 * 사람이 적은 지식이므로 형광펜을 쓰지 않고 먹색으로만 표시한다.
 */
export function KnowledgeReceipt({ card, actions }: { card: KnowledgeCard; actions?: ReactNode }) {
  const status = KNOWLEDGE_STATUS[card.status];
  const step = FLOW_STEPS.find((s) => s.slug === card.step);
  return (
    <article aria-labelledby={`kc-${card.id}`} className="flex h-full flex-col rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-dashed border-line-strong px-5 py-3">
        <p className="text-[13px] text-muted">
          <span className="font-semibold text-ink">{card.item}</span> · {step?.agent ?? card.step}
        </p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>
      <dl className="grid flex-1 content-start gap-0 px-5 py-2">
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 py-2">
          <dt className="text-label text-muted">조건</dt>
          <dd id={`kc-${card.id}`} className="text-[15px] font-semibold">
            {card.condition}
          </dd>
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 py-2">
          <dt className="text-label text-muted">
            <span aria-hidden="true">→ </span>판단
          </dt>
          <dd className="text-[15px] font-semibold">{card.judgment}</dd>
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-t border-dotted border-line-strong py-2">
          <dt className="text-label text-muted">근거</dt>
          <dd className="text-sm text-ink-2">{card.rationale}</dd>
        </div>
      </dl>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong px-5 py-3">
        <div className="text-[12px] text-muted">
          <p>
            <span className="font-semibold text-ink-2">{card.author}</span> · {card.orgName}
          </p>
          <p>
            <span className="tabular-nums">{formatDate(card.createdAt)}</span> 작성 · 판정 <span className="tabular-nums">{card.citedCount}</span>건에 인용
          </p>
        </div>
        {actions}
      </footer>
    </article>
  );
}
