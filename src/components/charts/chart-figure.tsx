"use client";

import { useId, useState, type ReactNode } from "react";

export type ChartTable = {
  caption: string;
  columns: string[];
  rows: string[][];
  /** 열마다 오른쪽 정렬 여부(숫자 열) */
  numeric?: boolean[];
};

/**
 * 차트 틀. 제목·보조 설명과 "표로 보기" 전환을 맡는다.
 * 모든 차트는 같은 값을 담은 표를 함께 가진다(dataviz: 표 보기는 차트의 접근성 쌍둥이).
 */
export function ChartFigure({
  title,
  subtitle,
  table,
  children,
  footnote,
}: {
  title: string;
  subtitle?: ReactNode;
  table: ChartTable;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure className="min-w-0" aria-labelledby={`${id}-t`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="text-[15px] font-semibold">
            {title}
          </h3>
          {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="min-h-[34px] shrink-0 rounded-md px-2.5 text-[13px] font-semibold text-ink-2 underline underline-offset-4 hover:bg-sunken"
        >
          {asTable ? "차트로 보기" : "표로 보기"}
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`py-2 pr-3 font-semibold ${table.numeric?.[i] ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri} className="border-b border-line last:border-b-0">
                  {r.map((cell, ci) =>
                    ci === 0 ? (
                      <th key={ci} scope="row" className="py-2 pr-3 text-left font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={ci} className={`py-2 pr-3 ${table.numeric?.[ci] ? "text-right tabular-nums" : ""}`}>
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      {footnote ? <figcaption className="mt-2 text-[12px] text-muted">{footnote}</figcaption> : null}
    </figure>
  );
}
