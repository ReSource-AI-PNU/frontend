"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { DocumentDraft } from "@/lib/session/types";

/**
 * 서류 상태. internal = 내부용(발송하지 않음), pending = 승인 후 발송, skipped = 고른 방안에서는 보내지 않음, sent = 발송함.
 */
export type DocStatus = "internal" | "pending" | "skipped" | "sent";

export type DocView = DocumentDraft & {
  /** 탭에 쓰는 짧은 이름 */
  tabLabel: string;
  status: DocStatus;
  /** 문서 아래 안내 문장(예: 고른 방안에서는 보내지 않는 이유) */
  note?: string;
};

const STATUS: Record<DocStatus, { tab: string; badge: string; line: string; badgeClass: string }> = {
  internal: {
    tab: "내부용",
    badge: "내부용 · 발송하지 않음",
    line: "AI가 만든 초안 · 내부 결재와 신청 준비용이라 외부로 발송하지 않습니다",
    badgeClass: "border-line-strong text-ink-2",
  },
  pending: {
    tab: "승인 후 발송",
    badge: "승인 후 발송",
    line: "AI가 만든 초안 · 담당자가 승인해야만 발송합니다",
    badgeClass: "border-ink text-ink",
  },
  skipped: {
    tab: "이번엔 보내지 않음",
    badge: "이 방안에서는 보내지 않음",
    line: "AI가 만든 초안 · 지금 고른 방안에서는 발송 대상이 아닙니다",
    badgeClass: "border-dashed border-line-strong text-muted",
  },
  sent: {
    tab: "발송함",
    badge: "발송함",
    line: "AI가 만든 초안 · 담당자가 승인해 발송했습니다",
    badgeClass: "border-ink bg-ink text-on-ink",
  },
};

function Paper({ doc, from, dateLabel }: { doc: DocView; from: string; dateLabel: string }) {
  const s = STATUS[doc.status];
  return (
    <article className="mx-auto max-w-[720px] rounded-[3px] border border-line bg-surface px-8 py-9 shadow-[0_1px_0_var(--color-line-strong),0_22px_44px_-30px_rgb(0_0_0/0.5)] sm:px-11">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
        <div>
          <p className="text-[12px] text-muted">{s.line}</p>
          <h3 className="mt-1 text-[22px] font-bold tracking-[-0.03em]">{doc.title}</h3>
        </div>
        <span className={`mt-1 shrink-0 rounded-sm border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${s.badgeClass}`}>{s.badge}</span>
      </header>

      <dl className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13.5px]">
        <dt className="text-muted">수신</dt>
        <dd className="font-semibold">{doc.to}</dd>
        <dt className="text-muted">발신</dt>
        <dd>{from}</dd>
        <dt className="text-muted">작성일</dt>
        <dd className="tabular-nums">{dateLabel}</dd>
      </dl>

      <table className="mt-5 w-full border-collapse border-y border-ink text-[13.5px]">
        <caption className="sr-only">{doc.title} 항목</caption>
        <tbody>
          {doc.fields.map((f) => (
            <tr key={f.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="w-[120px] bg-bg/60 px-3 py-2.5 text-left align-top font-semibold text-ink-2">
                {f.label}
              </th>
              <td className="px-3 py-2.5 tabular-nums">{f.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 text-[14.5px] leading-[1.8] text-ink-2">{doc.body}</p>

      <footer className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-3 text-[12px] text-muted">
        <span>Re:Source AI가 흐름 진단·규정·매칭 결과로 채웠습니다. 숫자는 시연용 가정값입니다.</span>
        <span className="shrink-0">{from}</span>
      </footer>
    </article>
  );
}

/**
 * 서류 초안 다섯 종류 미리보기: 이행 계획서, 지원사업 신청 초안, 순회 수거 요청서, 매각 견적 요청서, 공동처리 신고서 초안(선택).
 * 탭(왼쪽·오른쪽 방향키 이동)과 종이 문서 모양의 본문. 탭 둘째 줄에 내부용인지, 승인 후 발송하는지 적는다.
 * 선택 서류(optional)는 탭에 "선택"을 달고, 본문을 접어 둔다. 기본 흐름(순회 수거)에서는 필요 없기 때문이다.
 */
export function ProposalDocuments({ documents, from, dateLabel }: { documents: DocView[]; from: string; dateLabel: string }) {
  const [active, setActive] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = documents.length;
    let next = active;
    if (e.key === "ArrowRight") next = (active + 1) % n;
    else if (e.key === "ArrowLeft") next = (active - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setActive(next);
    tabsRef.current[next]?.focus();
  };

  const doc = documents[active];
  if (!doc) return null;

  return (
    <div>
      <div role="tablist" aria-label="서류 초안" onKeyDown={onKey} className="flex gap-0.5 overflow-x-auto border-b border-line">
        {documents.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px flex min-h-11 shrink-0 flex-col items-start justify-center border-b-2 px-3 py-1.5 text-left transition-colors duration-150 ${
              i === active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span className={`text-sm whitespace-nowrap ${i === active ? "font-semibold" : ""}`}>{d.tabLabel}</span>
            <span className="text-[11.5px] whitespace-nowrap text-muted">
              {d.optional ? `선택 · ${STATUS[d.status].tab}` : STATUS[d.status].tab}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`} tabIndex={0} className="bg-sunken px-4 py-6 sm:px-8">
        {doc.optional ? (
          <div className="mx-auto grid max-w-[720px] gap-3">
            <div className="rounded-md border border-line bg-surface px-4 py-3.5">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-line-strong px-1.5 text-[12px] font-semibold text-ink-2">선택</span>
                <b className="text-[15px] font-semibold">{doc.title}</b>
              </p>
              {doc.note ? <p className="mt-1.5 text-[13.5px] text-ink-2">{doc.note}</p> : null}
            </div>
            <details className="group">
              <summary className="w-fit cursor-pointer list-none text-sm font-semibold underline underline-offset-4 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">신고서 초안 펼치기</span>
                <span className="hidden group-open:inline">신고서 초안 접기</span>
              </summary>
              <div className="mt-3">
                <Paper doc={doc} from={from} dateLabel={dateLabel} />
              </div>
            </details>
          </div>
        ) : (
          <>
            <Paper doc={doc} from={from} dateLabel={dateLabel} />
            {doc.note ? <p className="mx-auto mt-4 max-w-[720px] rounded-md bg-warn-bg px-3.5 py-2.5 text-[13px] text-ink">{doc.note}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
