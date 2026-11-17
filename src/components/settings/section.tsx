import type { ReactNode } from "react";

/** 설정 화면의 한 묶음. 제목(h2)과 설명, 오른쪽 행동을 둔다. */
export function SettingsSection({
  id,
  title,
  description,
  aside,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`grid gap-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-h2">
            {title}
          </h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 이름-값 표 (정의 목록). 값이 숫자뿐이면 numeric으로 자릿수 폭을 맞춘다(고정폭 글꼴은 쓰지 않는다). */
export function DefinitionTable({ rows }: { rows: { label: string; value: ReactNode; numeric?: boolean }[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map((r) => (
        <div key={r.label} className="grid gap-1 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm text-muted">{r.label}</dt>
          <dd className={r.numeric ? "text-[15px] tabular-nums" : "text-[15px]"}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

/** 2026-11-09 형식 (한국 시간) */
export function formatDate(iso: string) {
  return ymd.format(new Date(iso));
}
