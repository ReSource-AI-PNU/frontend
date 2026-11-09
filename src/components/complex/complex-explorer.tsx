"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { COMPANY_ROLES, WASTE_ITEMS, type Company, type CompanyRole, type IndustrialComplex, type WasteItem } from "@/lib/domain";
import { Badge } from "../ui/badge";
import { ComplexMap } from "./complex-map";

/** 처리업체 1회 방문 최소 물량 (가정값). 업체별 실제 값은 백엔드 be#15에서 받는다. */
const MIN_PICKUP_KG = 2000;

const ROLE_TONE: Record<CompanyRole, "neutral" | "gain" | "warn"> = { 배출: "neutral", 처리업체: "gain", 수요처: "warn" };

function monthlyKg(company: Company, item: WasteItem | null) {
  return company.wasteStreams
    .filter((w) => item === null || w.item === item)
    .reduce((sum, w) => sum + w.monthlyKg, 0);
}

function RoleShape({ role }: { role: CompanyRole }) {
  const base = "inline-block size-2.5 shrink-0 bg-ink";
  if (role === "처리업체") return <span aria-hidden="true" className={`${base} rounded-[2px]`} />;
  if (role === "수요처") return <span aria-hidden="true" className={`${base} rounded-full bg-transparent shadow-[inset_0_0_0_2px_var(--color-ink)]`} />;
  return <span aria-hidden="true" className={`${base} rounded-full`} />;
}

export function ComplexExplorer({
  complex,
  complexes,
  companies,
  myComplexBadge,
}: {
  complex: IndustrialComplex;
  complexes: Pick<IndustrialComplex, "id" | "shortName" | "region">[];
  companies: Company[];
  myComplexBadge?: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [role, setRole] = useState<CompanyRole | "전체">("전체");
  const [item, setItem] = useState<WasteItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim();
    return companies.filter(
      (c) =>
        (role === "전체" || c.role === role) &&
        (item === null || c.wasteStreams.some((w) => w.item === item) || c.permits?.includes(item)) &&
        (q === "" || c.name.includes(q) || c.industry.includes(q)),
    );
  }, [companies, deferredQuery, role, item]);

  const emitters = companies.filter((c) => c.role === "배출");
  const bundleKg = item ? emitters.reduce((s, c) => s + monthlyKg(c, item), 0) : 0;
  const bundleCount = item ? emitters.filter((c) => monthlyKg(c, item) > 0).length : 0;
  const selected = companies.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-line lg:border-r">
        <div className="grid gap-4 border-b border-line px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="complex-switch" className="sr-only">
                산업단지 바꾸기
              </label>
              <select
                id="complex-switch"
                value={complex.id}
                onChange={(e) => router.push(`/complex/${e.target.value}`)}
                className="-ml-1 max-w-full cursor-pointer rounded-md bg-transparent px-1 text-h1 hover:bg-sunken focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
              >
                {complexes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[13px] text-muted">
                {complex.name} · {complex.region} · {complex.type}
                {complex.areaKm2 ? <span className="num"> · {complex.areaKm2} km²</span> : null}
              </p>
            </div>
            {myComplexBadge}
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기업명이나 업종으로 찾기"
            aria-label="기업 검색"
            className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
          />

          <div className="inline-flex w-fit rounded-md bg-sunken p-[3px]" role="group" aria-label="역할로 거르기">
            {(["전체", ...COMPANY_ROLES] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className="h-8 rounded-sm px-3 text-[13px] text-muted aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-ink aria-pressed:shadow-[0_1px_0_var(--color-line-strong)]"
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="품목으로 거르기">
            {WASTE_ITEMS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={item === w}
                onClick={() => setItem(item === w ? null : w)}
                className="h-8 rounded-full border border-line-strong px-3 text-[13px] text-ink-2 hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {w}
              </button>
            ))}
          </div>

          {item ? (
            <div className="rounded-md bg-surface p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  단지 내 <b>{item}</b> 배출 {bundleCount}곳 합계
                </span>
                <span className="num font-semibold">{formatNumber(bundleKg)} kg/월</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (bundleKg / MIN_PICKUP_KG) * 100)}%` }} />
              </div>
              <p className={`mt-1.5 text-[13px] ${bundleKg >= MIN_PICKUP_KG ? "text-gain" : "text-muted"}`}>
                {bundleKg >= MIN_PICKUP_KG
                  ? `묶으면 최소 수거 물량 ${formatNumber(MIN_PICKUP_KG)}kg을 넘깁니다.`
                  : `최소 수거 물량 ${formatNumber(MIN_PICKUP_KG)}kg까지 ${formatNumber(MIN_PICKUP_KG - bundleKg)}kg 부족합니다.`}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 text-[12px] text-muted">
          <span>
            입주 기업 <span className="num">{filtered.length}</span> / <span className="num">{companies.length}</span>
          </span>
          <span>가상 시드 데이터</span>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line" aria-label="입주 기업 목록">
          {filtered.map((c) => {
            const kg = monthlyKg(c, item);
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(active ? null : c.id)}
                  aria-pressed={active}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 text-left transition-colors hover:bg-sunken aria-pressed:bg-surface aria-pressed:shadow-[inset_3px_0_0_var(--color-ink)]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold">
                      <RoleShape role={c.role} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">{c.industry}</span>
                  </span>
                  <span className="text-right text-[13px]">
                    {c.role === "처리업체" ? (
                      <span className="text-muted">허가 {c.permits?.length ?? 0}품목</span>
                    ) : kg > 0 ? (
                      <span className="num font-semibold">
                        {formatNumber(kg)}
                        <span className="ml-0.5 font-sans font-normal text-muted">kg</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="px-5 py-10 text-center text-sm text-muted">조건에 맞는 기업이 없습니다.</li> : null}
        </ul>
      </aside>

      <section className="relative min-h-[60vh] lg:min-h-0" aria-label="지도">
        <ComplexMap complex={complex} companies={companies} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="pointer-events-none absolute top-4 left-4 flex flex-wrap gap-3 rounded-md bg-surface/90 px-3 py-2 text-[12px] text-ink-2 shadow-[0_0_0_1px_var(--color-line)] backdrop-blur">
          {COMPANY_ROLES.map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <RoleShape role={r} />
              {r}
            </span>
          ))}
        </div>

        {selected ? <CompanyCard company={selected} companies={companies} onClose={() => setSelectedId(null)} onPickItem={setItem} /> : null}
      </section>
    </div>
  );
}

function CompanyCard({
  company,
  companies,
  onClose,
  onPickItem,
}: {
  company: Company;
  companies: Company[];
  onClose: () => void;
  onPickItem: (item: WasteItem) => void;
}) {
  const sameItemPeers = (item: WasteItem) =>
    companies.filter((c) => c.id !== company.id && c.role === "배출" && c.wasteStreams.some((w) => w.item === item)).length;

  return (
    <article
      aria-label={`${company.name} 상세`}
      className="absolute top-4 right-4 w-[min(360px,calc(100%-2rem))] rounded-lg border border-line bg-surface p-5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-h2">{company.name}</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {company.industry}
            {company.employees ? ` · ${company.employees}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink">
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={ROLE_TONE[company.role]}>{company.role}</Badge>
        {company.isDemo ? <Badge tone="neutral">가상 기업</Badge> : null}
      </div>

      {company.wasteStreams.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <caption className="mb-1 text-left text-label text-muted">배출 품목</caption>
          <tbody>
            {company.wasteStreams.map((w) => (
              <tr key={`${w.item}-${w.detail}`} className="border-t border-line">
                <td className="py-2 pr-2">
                  <span className="font-semibold">{w.item}</span>
                  {w.detail ? <span className="block text-[12px] text-muted">{w.detail}</span> : null}
                </td>
                <td className="py-2 text-right">
                  <span className="num">{formatNumber(w.monthlyKg)}</span>
                  <span className="text-muted"> kg/월</span>
                  {w.storage ? <span className="block text-[12px] text-muted">{w.storage}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {company.permits?.length ? (
        <div className="mt-4">
          <p className="mb-1.5 text-label text-muted">허가 품목</p>
          <div className="flex flex-wrap gap-1.5">
            {company.permits.map((p) => (
              <span key={p} className="rounded-sm bg-sunken px-2 py-1 text-[13px]">
                {p}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {company.wasteStreams[0] ? (
        <button
          type="button"
          onClick={() => onPickItem(company.wasteStreams[0].item)}
          className="mt-4 flex w-full items-center justify-between rounded-md bg-sunken px-3 py-2.5 text-left text-sm hover:bg-line"
        >
          <span>
            같은 품목({company.wasteStreams[0].item})을 내놓는 기업 <b className="num">{sameItemPeers(company.wasteStreams[0].item)}</b>곳
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </article>
  );
}
