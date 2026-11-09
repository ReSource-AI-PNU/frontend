import type { ReactNode } from "react";
import type { RegulationItem, RegulationResult } from "@/lib/session/types";
import { Badge } from "../ui/badge";

const STATUS: Record<RegulationItem["status"], { sr: string; icon: string; result: string }> = {
  ok: { sr: "충족", icon: "bg-gain-bg text-gain", result: "text-ink" },
  no: { sr: "해당 없음", icon: "bg-loss-bg text-loss", result: "text-loss" },
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
  gain: "순환자원 인정 신청 가능",
  warn: "폐기물로 처리 · 인정은 분석 후",
  loss: "폐기물로 처리",
};

/**
 * 규정 체크리스트 영수증. 항목 · 점선 리더 · 결론, 그 아래 「법령명」 인용 (DESIGN.md 컴포넌트 규칙).
 * 항목을 펼치면 조문 요지가 보인다. 인용 조항은 AI가 고른 근거이므로 형광펜 밑줄을 긋는다.
 */
export function RegulationReceipt({ result, ask }: { result: RegulationResult; ask?: ReactNode }) {
  const counts = {
    ok: result.items.filter((i) => i.status === "ok").length,
    no: result.items.filter((i) => i.status === "no").length,
    ask: result.items.filter((i) => i.status === "ask").length,
  };
  return (
    <section
      aria-labelledby="regulation-receipt-title"
      className="relative rounded-lg border border-line bg-surface px-6 pt-6 pb-8 after:absolute after:inset-x-0 after:-bottom-px after:h-2 after:bg-[radial-gradient(circle_at_6px_8px,var(--color-bg)_5px,transparent_5.5px)] after:bg-size-[12px_8px] after:bg-repeat-x after:content-['']"
    >
      <header className="mb-1 border-b border-dashed border-line-strong pb-3">
        <h2 id="regulation-receipt-title" className="text-[17px] font-bold tracking-[-0.02em]">
          ③ 규정 검토
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">
          조항 {result.items.length}건을 인용했습니다. 충족 {counts.ok}건, 해당 없음 {counts.no}건, 확인 필요 {counts.ask}건입니다. 항목을
          누르면 조문 요지를 볼 수 있습니다.
        </p>
      </header>

      <ul className="divide-y divide-dashed divide-line">
        {result.items.map((item) => (
          <li key={item.id}>
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
          </li>
        ))}
      </ul>

      {ask}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong pt-3">
        <b className="text-[15px] font-semibold">결론</b>
        <Badge tone={result.conclusion.tone}>{CONCLUSION_LABEL[result.conclusion.tone]}</Badge>
      </div>
    </section>
  );
}
