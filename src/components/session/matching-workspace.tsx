"use client";

import { useMemo, useState } from "react";
import type { Company, IndustrialComplex } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import type { BundleGroup, StreamRoute } from "@/lib/session/types";
import { ComplexMap, type MapHighlight } from "../complex/complex-map";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { TruckFillMeter } from "./matching-meter";
import { RouteBadge } from "./stream-badges";

/** "흐름별 거래처" 표의 한 줄. 서버(page)에서 흐름·경로·매칭 결과를 합쳐 만든다 */
export type PartnerRow = {
  streamId: string;
  streamName: string;
  process: string;
  route: StreamRoute;
  partner: string;
  /** 지도에서 찾을 수 있는 단지 입주 기업이면 id */
  companyId?: string;
  location: string;
  distanceM?: number;
  note: string;
};

/** 묶음 흐름 하나의 순회 수거 패널에 필요한 값 */
export type BundleView = { bundle: BundleGroup; streamName: string; detail: string; originLabel: string };

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

const km = (m: number) => (m / 1000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const nameButton = "-mx-1 inline-flex min-h-[34px] items-center gap-2 rounded-sm px-1 text-left hover:underline hover:underline-offset-4";

/**
 * 업체·묶음 매칭 화면 본문.
 * 위: 흐름별 거래처 표(재투입은 사내, 소각은 현행 위탁처). 아래 왼쪽: 묶음 흐름마다 순회 수거 패널(트럭 적재율, 그룹, 수거 업체, 제외 업체, 일정).
 * 아래 오른쪽: 3D 지도. 지금 보고 있는 묶음 그룹을 형광펜으로 강조하고, 수거 업체·거래처는 먹색으로 칠한다.
 * 표의 기업 이름을 누르면 지도에서 그 건물로 이동한다.
 */
export function MatchingWorkspace({
  rows,
  bundles,
  complex,
  companies,
}: {
  rows: PartnerRow[];
  bundles: BundleView[];
  complex: IndustrialComplex;
  companies: Company[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(bundles[0]?.bundle.streamId ?? null);
  const known = useMemo(() => new Set(companies.map((c) => c.id)), [companies]);
  const active = bundles.find((b) => b.bundle.streamId === activeStream)?.bundle;
  const partnerIds = useMemo(
    () => rows.filter((r) => r.route !== "bundle" && r.companyId).map((r) => r.companyId as string),
    [rows],
  );
  const highlight = useMemo<MapHighlight | undefined>(() => {
    if (active) {
      return {
        groupIds: active.group.map((g) => g.companyId),
        collectorId: active.collector.companyId || undefined,
        partnerIds,
        excludedIds: active.excluded.map((e) => e.companyId),
      };
    }
    return partnerIds.length ? { groupIds: [], partnerIds, fit: false } : undefined;
  }, [active, partnerIds]);

  const select = (id: string) => setSelectedId((cur) => (cur === id ? null : id));
  const selected = companies.find((c) => c.id === selectedId);
  const selectedRole = selected
    ? highlight?.groupIds.includes(selected.id)
      ? "AI 묶음 그룹"
      : selected.id === highlight?.collectorId
        ? "수거 업체"
        : highlight?.partnerIds?.includes(selected.id)
          ? "거래처"
          : highlight?.excludedIds?.includes(selected.id)
            ? "제외된 업체"
            : selected.role
    : null;

  return (
    <div className="grid gap-10">
      <section aria-labelledby="partners-title">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="partners-title" className="text-h2">
            흐름별 거래처
          </h2>
          <p className="text-[13px] text-muted">거래처 이름을 누르면 지도에서 위치를 보여 줍니다.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">흐름별 경로와 거래처, 위치, 거리, 메모</caption>
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="pb-2 font-[550]">
                  흐름
                </th>
                <th scope="col" className="pb-2 pl-4 font-[550]">
                  경로
                </th>
                <th scope="col" className="pb-2 pl-4 font-[550]">
                  거래처
                </th>
                <th scope="col" className="pb-2 pl-4 font-[550]">
                  위치
                </th>
                <th scope="col" className="pb-2 pl-4 text-right font-[550] whitespace-nowrap">
                  거리 (km)
                </th>
                <th scope="col" className="pb-2 pl-4 font-[550]">
                  메모
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.streamId} className={`border-b border-line align-top ${r.companyId && selectedId === r.companyId ? "bg-sunken" : ""}`}>
                  <th scope="row" className="py-3 pr-2 text-left font-normal">
                    <span className="block font-semibold">{r.streamName}</span>
                    {r.process ? <span className="block text-[12.5px] text-muted">{r.process}</span> : null}
                  </th>
                  <td className="py-3 pl-4">
                    <RouteBadge route={r.route} size="sm" />
                  </td>
                  <td className="py-2 pl-4">
                    {r.companyId && known.has(r.companyId) ? (
                      <button type="button" onClick={() => select(r.companyId as string)} aria-pressed={selectedId === r.companyId} className={nameButton}>
                        <Shape kind="collector" />
                        <span className="font-semibold">{r.partner}</span>
                      </button>
                    ) : (
                      <span className={`inline-flex min-h-[34px] items-center ${r.route === "reuse" || r.route === "incinerate" ? "text-ink-2" : "font-semibold"}`}>
                        {r.partner}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-ink-2">{r.location}</td>
                  <td className="py-3 pl-4 text-right">
                    {r.distanceM !== undefined ? (
                      <span className="num">{km(r.distanceM)}</span>
                    ) : (
                      <span className="text-muted">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">해당 없음</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-[13px] text-ink-2">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">업체 이름·거리·단가는 시연용 가상 데이터입니다. 단지 밖 업체는 지도에 나오지 않습니다.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="grid content-start gap-10 lg:col-span-5">
          {bundles.length === 0 ? (
            <section aria-labelledby="no-bundle-title" className="rounded-lg border border-dashed border-line-strong px-5 py-6">
              <h2 id="no-bundle-title" className="text-h2">
                묶을 흐름이 없습니다
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                단지 묶음 매각으로 판정한 흐름이 없어 순회 수거를 꾸리지 않았습니다. 공장이 쓰고 버린 포장재처럼 혼자 팔기엔 양이 적은 흐름이 생기면, 같은
                단지 기업과 묶어 트럭 적재율을 채웁니다.
              </p>
            </section>
          ) : (
            bundles.map((v) => (
              <BundlePanel
                key={v.bundle.streamId}
                view={v}
                selectedId={selectedId}
                onSelect={select}
                showOnMap={bundles.length > 1 ? () => setActiveStream(v.bundle.streamId) : undefined}
                onMap={activeStream === v.bundle.streamId}
              />
            ))
          )}

          <p className="border-t border-line pt-5 text-[13px] text-muted">
            순회 수거 요청서와 묶음 참여 제안은 마지막 단계에서 담당자가 승인해야 발송됩니다. 기업 이름과 물량은 시연용 가상 데이터입니다.
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
                수거 업체·거래처
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
    </div>
  );
}

function BundlePanel({
  view,
  selectedId,
  onSelect,
  showOnMap,
  onMap,
}: {
  view: BundleView;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showOnMap?: () => void;
  onMap: boolean;
}) {
  const b = view.bundle;
  const share = new Map(b.costShare.map((c) => [c.companyId, c.sharePct]));
  const self = b.group.find((g) => g.isSelf);
  const titleId = `bundle-${b.streamId}`;
  const permitted = (p: string) => p === b.item || (b.item === "포장재" && p === "폐플라스틱");

  return (
    <section aria-labelledby={titleId} className="grid gap-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={titleId} className="text-h2">
            {view.streamName} 순회 수거
          </h2>
          <span className="flex items-center gap-1.5">
            <RouteBadge route="bundle" size="sm" />
            <Badge tone="ai">AI 선택</Badge>
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">
          {view.detail} · {view.originLabel} · {b.mode}
        </p>
        {showOnMap ? (
          <button type="button" onClick={showOnMap} aria-pressed={onMap} className={`${buttonClass("secondary", "sm")} mt-2`}>
            {onMap ? "지도에 표시 중" : "이 묶음을 지도에 표시"}
          </button>
        ) : null}
      </div>

      <TruckFillMeter
        soloKg={self?.kg ?? 0}
        totalKg={b.totalKg}
        truckKg={b.truckKg}
        minKg={b.minKg}
        soloFillRate={b.soloFillRate}
        fillRate={b.fillRate}
        members={b.group.length}
      />

      <p className="rounded-md bg-sunken px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-2">
        <b className="font-semibold text-ink">순회 수거:</b> 각 사업장이 같은 업체와 따로 계약하고 업체가 차례로 돕니다. 공동 보관은 금지됩니다.
      </p>

      <div>
        <h3 className="text-label text-muted">묶음 그룹 {b.group.length}개사</h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="sr-only">{view.streamName} 순회 수거 그룹. 기업별 거리, 월 물량, 비용 분담 비율</caption>
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
                분담 (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {b.group.map((g) => (
              <tr key={g.companyId} className={`border-b border-line ${selectedId === g.companyId ? "bg-sunken" : ""}`}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  <button type="button" onClick={() => onSelect(g.companyId)} aria-pressed={selectedId === g.companyId} className={nameButton}>
                    <Shape kind="group" />
                    <span className={g.isSelf ? "font-semibold" : ""}>{g.name}</span>
                    {g.isSelf ? <span className="rounded-sm bg-sunken px-1.5 text-[11.5px] text-ink-2">내 회사</span> : null}
                  </button>
                </th>
                <td className={`py-1.5 pl-3 text-right ${g.isSelf ? "text-[13px] text-muted" : "num"}`}>{g.isSelf ? "기준" : formatNumber(g.distanceM)}</td>
                <td className={`py-1.5 pl-3 text-right ${g.isSelf ? "num" : "text-[13px] text-muted"}`}>{g.isSelf ? formatNumber(g.kg) : "비공개"}</td>
                <td className="num py-1.5 pl-3 text-right">{(share.get(g.companyId) ?? 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" className="py-2.5 text-left">
                합계
              </th>
              <td className="py-2.5" />
              <td className="num py-2.5 pl-3 text-right">{formatNumber(b.totalKg)}</td>
              <td className="num py-2.5 pl-3 text-right">100.0</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-[13px] text-muted">
          운반비는 월 물량 비율로 나눕니다. 다른 회사의 물량은 공정 정보가 드러나지 않도록 숨기고, 묶음 합계와 분담 비율만 보여 줍니다.
        </p>
      </div>

      <div>
        <h3 className="text-label text-muted">수거 업체</h3>
        <div className="mt-1 flex items-start justify-between gap-3">
          <button type="button" onClick={() => onSelect(b.collector.companyId)} className={`${nameButton} text-[17px] font-semibold`}>
            <Shape kind="collector" />
            {b.collector.name}
          </button>
          <span className="num pt-1.5 text-sm text-muted">{formatNumber(b.collector.distanceM)}m</span>
        </div>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-line text-sm">
          <dt className="border-b border-line py-2 text-muted">허가 품목</dt>
          <dd className="flex flex-wrap justify-end gap-1.5 border-b border-line py-2">
            {b.collector.permits.length ? (
              b.collector.permits.map((p) => (
                <span key={p} className={`rounded-sm px-1.5 text-[12.5px] ${permitted(p) ? "bg-ink font-semibold text-on-ink" : "bg-sunken text-ink-2"}`}>
                  {p}
                </span>
              ))
            ) : (
              <span className="text-muted">등록된 허가 품목 없음</span>
            )}
          </dd>
          <dt className="border-b border-line py-2 text-muted">수거 일정</dt>
          <dd className="border-b border-line py-2 text-right">{b.schedule}</dd>
        </dl>
        <p className="mt-2 text-[13px] text-muted">일정은 업체가 요청서에 회신하면 확정됩니다. 지금 일정은 업체 공개 정보를 바탕으로 한 가정입니다.</p>
      </div>

      <div>
        <h3 className="text-label text-muted">허가 불일치로 제외한 업체 {b.excluded.length}곳</h3>
        {b.excluded.length ? (
          <ul className="mt-2 grid gap-2">
            {b.excluded.map((e) => (
              <li key={e.companyId} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 rounded-md bg-warn-bg px-3.5 py-2.5 text-sm [&_svg]:mt-0.5 [&_svg]:text-warn">
                <AlertIcon />
                <p>
                  <b className="font-semibold">{e.name}</b>을(를) 후보에서 제외했습니다. 사유는 {e.reason}입니다.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-ink-2">단지 안 처리업체가 모두 이 품목 허가를 갖고 있어, 제외한 업체가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
