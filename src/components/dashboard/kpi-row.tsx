import type { ReactNode } from "react";

export type Kpi = {
  label: string;
  /** 숫자 부분 (Geist Mono) */
  value: string;
  /** 단위 (본문 서체) */
  unit?: string;
  tone?: "gain" | "loss" | "ink";
  delta?: ReactNode;
};

/**
 * 상단 KPI 행. 첫 칸은 화면의 hero 숫자(한 화면에 하나)이고 나머지는 보조 지표다.
 * 카드로 감싸지 않고 위아래 구분선과 세로 구분선만 쓴다.
 */
export function KpiRow({ hero, items }: { hero: Kpi; items: Kpi[] }) {
  const tone = (t?: Kpi["tone"]) => (t === "gain" ? "text-gain" : t === "loss" ? "text-loss" : "text-ink");
  return (
    <dl className="grid border-y border-line lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
      <div className="py-6 lg:pr-8">
        <dt className="text-label text-muted">{hero.label}</dt>
        <dd className="mt-2">
          <span className={`num text-[56px] leading-none font-semibold tracking-[-0.04em] ${tone(hero.tone)}`}>{hero.value}</span>
          {hero.unit ? <span className="ml-1.5 text-h2 text-ink-2">{hero.unit}</span> : null}
        </dd>
        {hero.delta ? <dd className="mt-2 text-sm text-ink-2">{hero.delta}</dd> : null}
      </div>
      {items.map((k) => (
        <div key={k.label} className="border-t border-line py-6 lg:border-t-0 lg:border-l lg:px-6">
          <dt className="text-label text-muted">{k.label}</dt>
          <dd className="mt-2">
            <span className={`num text-[30px] leading-none font-semibold tracking-[-0.03em] ${tone(k.tone)}`}>{k.value}</span>
            {k.unit ? <span className="ml-1 text-[15px] text-ink-2">{k.unit}</span> : null}
          </dd>
          {k.delta ? <dd className="mt-2 text-[13px] text-muted">{k.delta}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
