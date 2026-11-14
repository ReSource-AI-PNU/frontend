import type { ReactNode } from "react";
import type { RegulationItem, RegulationResult, StreamRoute } from "@/lib/session/types";
import { Badge } from "../ui/badge";
import { MoreDetails } from "../ui/more-details";
import { RouteBadge } from "./stream-badges";

const STATUS: Record<RegulationItem["status"], { sr: string; icon: string; result: string }> = {
  ok: { sr: "충족", icon: "bg-gain-bg text-gain", result: "text-ink" },
  no: { sr: "불가", icon: "bg-loss-bg text-loss", result: "text-loss" },
  ask: { sr: "확인 필요", icon: "bg-marker text-marker-ink", result: "text-warn" },
};

function StatusIcon({ status }: { status: RegulationItem["status"] }) {
  const s = STATUS[status];
  return (
    <span className={`mt-0.5 grid size-[18px] place-items-center rounded-full ${s.icon}`}>
      {status === "ok" ? (
        <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 6.3l2.3 2.2L9.5 3.5" />
        </svg>
      ) : status === "no" ? (
        <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
        </svg>
      ) : (
        <span aria-hidden="true" className="num text-[11px] font-bold leading-none">
          ?
        </span>
      )}
      <span className="sr-only">{s.sr}</span>
    </span>
  );
}

export const CONCLUSION_LABEL: Record<RegulationResult["conclusion"]["tone"], string> = {
  gain: "모든 경로 가능",
  warn: "가능 · 확인할 정보 남음",
  loss: "막힌 경로 있음",
};

/** 영수증의 흐름 묶음 하나. 흐름에 딸린 항목과 그 흐름의 되묻기를 함께 둔다. */
export type ReceiptGroup = {
  key: string;
  title: string;
  /** 공정 · 출처 같은 보조 설명 */
  meta?: string;
  route?: StreamRoute;
  items: RegulationItem[];
  ask?: ReactNode;
  /** 항목이 없을 때 보여 줄 문장 */
  empty?: string;
};

function ReceiptItem({ item }: { item: RegulationItem }) {
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[22px_minmax(0,1fr)_16px] gap-2 rounded-sm py-3 text-sm hover:bg-sunken/60 [&::-webkit-details-marker]:hidden">
        <StatusIcon status={item.status} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span>{item.label}</span>
            <span aria-hidden="true" className="min-w-4 flex-1 -translate-y-1 border-b-[1.5px] border-dotted border-line-strong" />
            <b className={`font-semibold whitespace-nowrap ${STATUS[item.status].result}`}>{item.result}</b>
          </div>
          <span className="mt-0.5 block text-[12.5px] text-muted">
            <span className="text-ink-2 underline decoration-marker decoration-[3px] underline-offset-2 [text-decoration-skip-ink:none]">{item.citation}</span>
          </span>
        </div>
        <svg
          viewBox="0 0 16 16"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-1 text-muted transition-transform duration-150 group-open:rotate-180"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="mb-3 ml-[30px] rounded-md bg-sunken px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-2">
        <p className="text-label text-muted">조문 요지</p>
        <p className="mt-1">{item.excerpt}</p>
      </div>
    </details>
  );
}

/**
 * 규정 체크리스트 영수증. 항목 · 점선 리더 · 결론, 그 아래 「법령명」 인용 (DESIGN.md 컴포넌트 규칙).
 * 문제 정의 v2: 항목을 공장의 폐플라스틱 흐름별로 묶는다. 흐름 머리말에 경로 배지를 달고, 그 흐름의 되묻기를 바로 아래에 둔다.
 * common: 공장 공통 되묻기(성분분석표 등). note: 머리말 아래 한 줄 설명.
 * 인용 조항은 AI가 고른 근거이므로 형광펜 밑줄을 긋는다.
 * 요약 먼저: 모두 충족한 흐름은 한 줄 요약만 보이고 조항은 "조항 보기"로 펼친다. 확인이 필요하거나 막힌 흐름은 조항을 바로 보여 준다.
 */
export function RegulationReceipt({
  result,
  groups,
  common,
  note,
}: {
  result: RegulationResult;
  groups: ReceiptGroup[];
  common?: ReactNode;
  note?: ReactNode;
}) {
  const counts = {
    ok: result.items.filter((i) => i.status === "ok").length,
    no: result.items.filter((i) => i.status === "no").length,
    ask: result.items.filter((i) => i.status === "ask").length,
  };
  const tally = [`충족 ${counts.ok}건`, counts.ask ? `확인 필요 ${counts.ask}건` : null, counts.no ? `불가 ${counts.no}건` : null]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      aria-labelledby="regulation-receipt-title"
      className="relative rounded-lg border border-line bg-surface px-6 pt-6 pb-8 after:absolute after:inset-x-0 after:-bottom-px after:h-2 after:bg-[radial-gradient(circle_at_6px_8px,var(--color-bg)_5px,transparent_5.5px)] after:bg-size-[12px_8px] after:bg-repeat-x after:content-['']"
    >
      <header className="border-b border-dashed border-line-strong pb-3">
        <h2 id="regulation-receipt-title" className="text-[17px] font-bold tracking-[-0.02em]">
          ③ 규정 검토
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">
          흐름 {groups.length}개에 대해 조항 {result.items.length}건을 인용했습니다. {tally}입니다. 항목을 누르면 조문 요지를 볼 수 있습니다.
        </p>
        {note ? (
          <MoreDetails label="출처를 묻는 이유 보기" closeLabel="접기">
            <p className="text-[13px] text-ink-2">{note}</p>
          </MoreDetails>
        ) : null}
      </header>

      {common ? (
        <div className="border-b border-dashed border-line-strong pt-4">
          <p className="text-label text-muted">공장 공통 확인</p>
          {common}
        </div>
      ) : null}

      {groups.map((g, i) => (
        <section
          key={g.key}
          aria-labelledby={`receipt-${g.key}`}
          className={`pt-4 ${i < groups.length - 1 ? "border-b border-dashed border-line-strong" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={`receipt-${g.key}`} className="text-[15px] font-semibold tracking-[-0.01em]">
                {g.title}
              </h3>
              {g.meta ? <p className="text-[12.5px] text-muted">{g.meta}</p> : null}
            </div>
            {g.route ? <RouteBadge route={g.route} size="sm" /> : null}
          </div>
          {g.items.length && g.items.every((i) => i.status === "ok") && !g.ask ? (
            <MoreDetails
              label="조항 보기"
              closeLabel="조항 접기"
              hint={g.items.length <= 2 ? g.items.map((i) => `${i.label} ${i.result}`).join(" · ") : `충족 ${g.items.length}건`}
            >
              <ul className="divide-y divide-dashed divide-line">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <ReceiptItem item={item} />
                  </li>
                ))}
              </ul>
            </MoreDetails>
          ) : g.items.length ? (
            <ul className="mt-1 divide-y divide-dashed divide-line">
              {g.items.map((item) => (
                <li key={item.id}>
                  <ReceiptItem item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-muted">{g.empty ?? "확인할 조항이 없습니다."}</p>
          )}
          {g.ask}
        </section>
      ))}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong pt-3">
        <b className="text-[15px] font-semibold">결론</b>
        <Badge tone={result.conclusion.tone}>{CONCLUSION_LABEL[result.conclusion.tone]}</Badge>
      </div>
    </section>
  );
}
