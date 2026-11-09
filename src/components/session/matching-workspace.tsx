"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Company, IndustrialComplex } from "@/lib/domain";
import type { MatchingResult } from "@/lib/session/types";
import { ComplexMap, type MapHighlight } from "../complex/complex-map";
import { Badge } from "../ui/badge";
import { MatchingMeter } from "./matching-meter";

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.2l6.2 11H1.8z" />
      <path d="M8 6.5v3M8 11.6v.1" />
    </svg>
  );
}

function Shape({ kind }: { kind: "group" | "collector" | "excluded" | "other" }) {
  if (kind === "collector") return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[2px] bg-ink" />;
  if (kind === "group") return <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full bg-marker shadow-[0_0_0_2px_var(--color-ink)]" />;
  if (kind === "excluded") return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[2px] bg-ink opacity-35" />;
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full bg-ink opacity-55" />;
}

/**
 * 묶음 수거 매칭 화면 본문. 왼쪽은 그룹 표·최소 물량 막대·수거 업체·제외 업체·일정, 오른쪽은 3D 지도.
 * 표의 기업 이름을 누르면 지도에서 그 건물로 이동한다.
 */
export function MatchingWorkspace({
  matching,
  complex,
  companies,
  item,
}: {
  matching: MatchingResult;
  complex: IndustrialComplex;
  companies: Company[];
  item: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const highlight = useMemo<MapHighlight>(
    () => ({
      groupIds: matching.group.map((g) => g.companyId),
      collectorId: matching.collector.companyId || undefined,
      excludedIds: matching.excluded.map((e) => e.companyId),
    }),
    [matching],
  );
  const share = new Map(matching.costShare.map((c) => [c.companyId, c.sharePct]));
  const self = matching.group.find((g) => g.isSelf);
  const selected = companies.find((c) => c.id === selectedId);
  const selectedRole = selected
    ? highlight.groupIds.includes(selected.id)
      ? "AI 묶음 그룹"
      : selected.id === highlight.collectorId
        ? "수거 업체"
        : highlight.excludedIds?.includes(selected.id)
          ? "제외된 업체"
          : selected.role
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
      <div className="grid content-start gap-8 lg:col-span-5">
        <section aria-labelledby="group-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="group-title" className="text-h2">
              묶음 그룹 {matching.group.length}개사
            </h2>
            <Badge tone="ai">AI 선택</Badge>
          </div>
          <table className="mt-3 w-full border-collapse text-sm">
            <caption className="sr-only">묶음 수거 그룹. 기업별 거리, 월 물량, 비용 분담 비율</caption>
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="pb-2 font-[550]">
                  기업
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-[550]">
                  거리 (m)
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-[550]">
                  월 물량 (kg)
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-[550]">
                  비용 분담 (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {matching.group.map((g) => (
                <tr key={g.companyId} className={`border-b border-line ${selectedId === g.companyId ? "bg-sunken" : ""}`}>
                  <th scope="row" className="py-2 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => setSelectedId(g.companyId === selectedId ? null : g.companyId)}
                      aria-pressed={selectedId === g.companyId}
                      className="-mx-1 inline-flex min-h-[34px] items-center gap-2 rounded-sm px-1 text-left hover:underline hover:underline-offset-4"
                    >
                      <Shape kind="group" />
                      <span className={g.isSelf ? "font-semibold" : ""}>{g.name}</span>
                      {g.isSelf ? <span className="rounded-sm bg-sunken px-1.5 text-[11.5px] text-ink-2">내 회사</span> : null}
                    </button>
                  </th>
                  <td className={`py-2 pl-3 text-right ${g.isSelf ? "text-[13px] text-muted" : "num"}`}>{g.isSelf ? "기준" : formatNumber(g.distanceM)}</td>
                  <td className="num py-2 pl-3 text-right">{formatNumber(g.kg)}</td>
                  <td className="num py-2 pl-3 text-right">{(share.get(g.companyId) ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th scope="row" className="py-2.5 text-left">
                  합계
                </th>
                <td className="py-2.5" />
                <td className="num py-2.5 pl-3 text-right">{formatNumber(matching.totalKg)}</td>
                <td className="num py-2.5 pl-3 text-right">100.0</td>
              </tr>
            </tfoot>
          </table>
          <MatchingMeter selfKg={self?.kg ?? 0} totalKg={matching.totalKg} minKg={matching.minKg} />
          <p className="mt-2 text-[13px] text-muted">비용은 월 물량 비율로 나눕니다. 운송비도 같은 비율로 분담합니다.</p>
        </section>

        <section aria-labelledby="collector-title" className="border-t border-line pt-5">
          <h2 id="collector-title" className="text-label text-muted">
            수거 업체
          </h2>
          <div className="mt-2 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedId(matching.collector.companyId)}
              className="-mx-1 inline-flex min-h-[34px] items-center gap-2 rounded-sm px-1 text-[17px] font-semibold hover:underline hover:underline-offset-4"
            >
              <Shape kind="collector" />
              {matching.collector.name}
            </button>
            <span className="pt-1.5 text-sm text-muted tabular-nums">{formatNumber(matching.collector.distanceM)}m</span>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-line text-sm">
            <dt className="border-b border-line py-2 text-muted">허가 품목</dt>
            <dd className="flex flex-wrap justify-end gap-1.5 border-b border-line py-2">
              {matching.collector.permits.length ? (
                matching.collector.permits.map((p) => (
                  <span key={p} className={`rounded-sm px-1.5 text-[12.5px] ${p === item ? "bg-ink font-semibold text-on-ink" : "bg-sunken text-ink-2"}`}>
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-muted">등록된 허가 품목 없음</span>
              )}
            </dd>
            <dt className="border-b border-line py-2 text-muted">수거 일정</dt>
            <dd className="border-b border-line py-2 text-right">{matching.schedule}</dd>
          </dl>
          <p className="mt-2 text-[13px] text-muted">수거 일정은 업체가 견적에 회신하면 확정됩니다. 지금 표시한 일정은 업체 공개 정보를 바탕으로 한 가정입니다.</p>
        </section>

        {matching.excluded.length ? (
          <section aria-labelledby="excluded-title" className="border-t border-line pt-5">
            <h2 id="excluded-title" className="text-label text-muted">
              제외한 업체 {matching.excluded.length}곳
            </h2>
            <ul className="mt-2 grid gap-2">
              {matching.excluded.map((e) => (
                <li key={e.companyId} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 rounded-md bg-warn-bg px-3.5 py-2.5 text-sm [&_svg]:mt-0.5 [&_svg]:text-warn">
                  <AlertIcon />
                  <p>
                    <b className="font-semibold">{e.name}</b>을(를) 후보에서 제외했습니다. 사유는 {e.reason}입니다.
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="border-t border-line pt-5 text-[13px] text-muted">
          묶음 참여 제안은 마지막 단계에서 담당자가 승인해야 다른 기업에 발송됩니다. 기업 이름과 물량은 시연용 가상 데이터입니다.
        </p>
      </div>

      <div className="lg:col-span-7">
        <div className="lg:sticky lg:top-6">
          <div className="h-[min(620px,calc(100dvh-160px))] min-h-[420px] overflow-hidden rounded-lg border border-line">
            <ComplexMap complex={complex} companies={companies} selectedId={selectedId} onSelect={setSelectedId} highlight={highlight} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-2">
              <Shape kind="group" />
              AI가 고른 묶음 그룹
            </span>
            <span className="inline-flex items-center gap-2">
              <Shape kind="collector" />
              수거 업체
            </span>
            <span className="inline-flex items-center gap-2">
              <Shape kind="excluded" />
              제외된 업체
            </span>
            <span className="inline-flex items-center gap-2">
              <Shape kind="other" />
              기타 입주 기업
            </span>
          </div>
          <p aria-live="polite" className="mt-2 min-h-6 text-[13px] text-muted">
            {selected ? `${selected.name} · ${selectedRole} · ${selected.industry}` : "건물이나 표의 기업 이름을 누르면 그 위치로 이동합니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
