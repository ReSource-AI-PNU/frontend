import Link from "next/link";
import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";

/** 조항 번호. 화면에는 두 자리 숫자(Geist Mono)로, 본문에는 "제N조"로 쓴다. */
function pad(no: number) {
  return String(no).padStart(2, "0");
}

/**
 * 약관·방침 문서 틀. 넓은 화면에서는 왼쪽에 목차를 고정하고, 본문은 720px 안팎으로 읽기 좋게 둔다.
 * articleLabel: 조항 제목 앞에 붙는 말 ("제N조"). 빈 문자열이면 왼쪽 두 자리 번호만 쓴다.
 */
export function LegalDocument({
  eyebrow,
  title,
  effectiveDate,
  intro,
  sections,
  appendix,
  articleLabel = (no) => `제${no}조`,
  related,
}: {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  intro: ReactNode;
  sections: LegalSection[];
  appendix?: { title: string; body: ReactNode };
  articleLabel?: (no: number) => string;
  related: { href: string; label: string };
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 pt-12 pb-24 lg:grid-cols-[232px_minmax(0,720px)] lg:gap-16 lg:px-8">
      <header className="lg:col-start-2">
        <p className="text-label text-muted">{eyebrow}</p>
        <h1 className="mt-1 text-display">{title}</h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <span>
            시행일 <time dateTime={effectiveDate} className="num">{effectiveDate}</time>
          </span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="rounded-sm bg-warn-bg px-1.5 py-0.5 text-[13px] font-semibold text-warn">초안(법률 검토 전)</span>
        </p>
        <div className="mt-6 grid gap-3 border-t border-line pt-6 leading-[1.75] text-ink-2">{intro}</div>
      </header>

      <nav
        aria-label="목차"
        className="self-start rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-[84px] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:border-0 lg:bg-transparent lg:p-0"
      >
        <p className="mb-3 text-label text-muted">목차</p>
        <ol className="grid gap-0.5 text-sm sm:grid-cols-2 lg:grid-cols-1">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex min-h-9 items-baseline gap-3 rounded-md px-2 py-1.5 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              >
                <span className="num w-5 shrink-0 text-[12px] text-muted">{pad(i + 1)}</span>
                {s.title}
              </a>
            </li>
          ))}
          {appendix ? (
            <li>
              <a
                href="#appendix"
                className="flex min-h-9 items-baseline gap-3 rounded-md px-2 py-1.5 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              >
                <span className="w-5 shrink-0" aria-hidden="true" />
                {appendix.title}
              </a>
            </li>
          ) : null}
        </ol>
        <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
          함께 보기{" "}
          <Link href={related.href} className="font-semibold text-ink underline underline-offset-4">
            {related.label}
          </Link>
        </p>
      </nav>

      <article className="grid gap-0 lg:col-start-2">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-t border-line py-9">
            <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-h2">
              <a
                href={`#${s.id}`}
                aria-label={`${articleLabel(i + 1) || s.title} 링크`}
                className="num shrink-0 rounded-sm text-[13px] font-medium text-muted hover:text-ink"
              >
                {pad(i + 1)}
              </a>
              <span>{articleLabel(i + 1) ? `${articleLabel(i + 1)} ${s.title}` : s.title}</span>
            </h2>
            <div className="mt-4 grid gap-4 leading-[1.75] text-ink-2">{s.body}</div>
          </section>
        ))}
        {appendix ? (
          <section id="appendix" aria-labelledby="appendix-title" className="scroll-mt-24 border-t border-line py-9">
            <h2 id="appendix-title" className="text-h2">
              {appendix.title}
            </h2>
            <div className="mt-4 grid gap-4 leading-[1.75] text-ink-2">{appendix.body}</div>
          </section>
        ) : null}
      </article>
    </div>
  );
}

/** 항(①②…). 각 항 안에 SubItems로 호(1. 2. …)를 둘 수 있다. */
export function Clauses({ items }: { items: ReactNode[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[1.5em_minmax(0,1fr)] gap-1">
          <span aria-hidden="true" className="text-ink">
            {CIRCLED[i]}
          </span>
          <div className="grid gap-2">{item}</div>
        </li>
      ))}
    </ol>
  );
}

/** 호(1. 2. …) */
export function SubItems({ items }: { items: ReactNode[] }) {
  return (
    <ol className="grid gap-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[1.75em_minmax(0,1fr)]">
          <span aria-hidden="true" className="text-[15px] text-muted tabular-nums">
            {i + 1}.
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** 확정되지 않았거나 법률 검토가 필요한 값 */
export function Pending({ children = "확인 필요" }: { children?: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-sm bg-warn-bg px-1.5 align-[1px] text-[12px] leading-5 font-semibold whitespace-nowrap text-warn">
      {children}
    </span>
  );
}

/** 표. 첫 열은 행 제목(th)으로 쓴다. 좁은 화면에서는 가로로 스크롤한다. */
export function LegalTable({
  caption,
  columns,
  rows,
  colWidths,
}: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
  colWidths?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-[1.6]">
        <caption className="sr-only">{caption}</caption>
        {colWidths ? (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-line bg-sunken/60">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-4 py-2.5 text-label font-semibold text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line align-top last:border-b-0">
              {row.map((cell, c) =>
                c === 0 ? (
                  <th key={c} scope="row" className="px-4 py-3 font-semibold text-ink">
                    {cell}
                  </th>
                ) : (
                  <td key={c} className="px-4 py-3 text-ink-2">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 본문 속 안내 상자 (요약·주의) */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-5 py-4">
      <p className="font-semibold text-ink">{title}</p>
      <div className="mt-1.5 grid gap-1.5 text-[15px] text-ink-2">{children}</div>
    </div>
  );
}
