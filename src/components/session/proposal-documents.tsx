"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { DocumentDraft } from "@/lib/session/types";

/**
 * 서류 초안 3종 미리보기. 탭(왼쪽·오른쪽 방향키 이동)과 종이 문서 모양의 본문.
 * notes: 문서 id별 안내 문장(예: 선택한 경로에서는 제출하지 않는 서류).
 * sent: 승인·발송을 마쳤으면 true. 견적 요청서는 "발송함", 나머지는 "초안 저장"으로 표시한다.
 */
export function ProposalDocuments({
  documents,
  from,
  dateLabel,
  notes,
  sent = false,
}: {
  documents: DocumentDraft[];
  from: string;
  dateLabel: string;
  notes?: Record<string, string>;
  sent?: boolean;
}) {
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
  const note = notes?.[doc.id];
  const wasSent = sent && doc.kind === "quote";
  const statusLine = !sent
    ? "AI가 만든 초안 · 승인 전에는 발송하지 않습니다"
    : wasSent
      ? "AI가 만든 초안 · 담당자가 승인해 발송했습니다"
      : "AI가 만든 초안 · 발송하지 않고 초안으로 저장했습니다";

  return (
    <div>
      <div role="tablist" aria-label="서류 초안" onKeyDown={onKey} className="flex gap-1 border-b border-line">
        {documents.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${d.id}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px min-h-11 border-b-2 px-3 text-sm transition-colors duration-150 ${
              i === active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {d.title}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${doc.id}`} tabIndex={0} className="bg-sunken px-4 py-6 sm:px-8">
        <article className="mx-auto max-w-[720px] rounded-[3px] border border-line bg-surface px-8 py-9 shadow-[0_1px_0_var(--color-line-strong),0_22px_44px_-30px_rgb(0_0_0/0.5)] sm:px-11">
          <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
            <div>
              <p className="text-[12px] text-muted">{statusLine}</p>
              <h3 className="mt-1 text-[22px] font-bold tracking-[-0.03em]">{doc.title}</h3>
            </div>
            <span
              className={`mt-1 shrink-0 rounded-sm border px-2 py-0.5 text-[12px] font-semibold ${wasSent ? "border-ink bg-ink text-on-ink" : "border-line-strong text-ink-2"}`}
            >
              {wasSent ? "발송함" : "초안"}
            </span>
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

          {note ? <p className="mt-4 rounded-md bg-warn-bg px-3.5 py-2.5 text-[13px] text-ink">{note}</p> : null}

          <footer className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-3 text-[12px] text-muted">
            <span>Re:Source AI가 판정·규정·매칭 결과로 채웠습니다. 숫자는 시연용 가정값입니다.</span>
            <span className="shrink-0">{from}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
