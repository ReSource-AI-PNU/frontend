"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CONSENT_LABEL, CONSENT_TONE, summarizeConsent, type MemberConsent } from "@/lib/bundle-consent";
import type { Company, IndustrialComplex } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { josa } from "@/lib/josa";
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
export type BundleView = {
  bundle: BundleGroup;
  streamName: string;
  detail: string;
  originLabel: string;
  /** 그룹 기업별 참여 상태(승인 전이면 모두 not-sent) */
  consents?: MemberConsent[];
  /** 단지 전체에서 같은 재질·출처 흐름을 내놓는 기업 수와 월 물량(가상 데이터) */
  potential?: { companies: number; kg: number; complexName: string };
};

/** 묶음이 하나씩 차오르는 연출의 한 걸음(ms) */
const STEP_MS = 1100;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const noopSubscribe = () => () => {};

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
  sessionId,
  rows,
  bundles,
  complex,
  companies,
}: {
  sessionId: string;
  rows: PartnerRow[];
  bundles: BundleView[];
  complex: IndustrialComplex;
  companies: Company[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(bundles[0]?.bundle.streamId ?? null);
  const known = useMemo(() => new Set(companies.map((c) => c.id)), [companies]);
  const activeView = bundles.find((b) => b.bundle.streamId === activeStream);
  const active = activeView?.bundle;
  const partnerIds = useMemo(
    () => rows.filter((r) => r.route !== "bundle" && r.companyId).map((r) => r.companyId as string),
    [rows],
  );

  // 킥 장면: 내 회사 하나에서 시작해 이웃 기업이 하나씩 켜지며 트럭이 차오르고, 마지막에 수거 업체와 순회 경로가 그려진다.
  // stage k(1..n) = 그룹의 앞 k곳이 켜짐, n+1 이상 = 수거 업체와 순회 경로까지 다 그림.
  // 이 묶음을 처음 보는 탭이면 1에서 시작해 자동으로 한 번 보여 준다. 서버와 동작 줄이기 설정에서는 다 그린 상태다.
  const memberCount = active?.group.length ?? 0;
  const seenKey = active ? `rs-buildup:${sessionId}:${active.streamId}` : "";
  const unseen = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(seenKey) && !reducedMotion() && !window.sessionStorage.getItem(seenKey),
    () => false,
  );
  const [manualStage, setManualStage] = useState<number | null>(null);
  const stage = manualStage ?? (unseen ? 1 : Number.POSITIVE_INFINITY);
  const playing = stage <= memberCount;
  // 같은 배열을 비워 쓰므로 언마운트 정리에서도 지금 걸린 타이머를 지울 수 있다
  const timers = useRef<number[]>([]);
  const run = useCallback(
    (onDone?: () => void) => {
      timers.current.splice(0).forEach((t) => window.clearTimeout(t));
      for (let k = 2; k <= memberCount + 1; k++) {
        timers.current.push(window.setTimeout(() => setManualStage(k), STEP_MS * (k - 1)));
      }
      timers.current.push(
        window.setTimeout(() => {
          onDone?.();
          setManualStage(null);
        }, STEP_MS * (memberCount + 1)),
      );
    },
    [memberCount],
  );
  useEffect(() => {
    if (unseen) run(() => window.sessionStorage.setItem(seenKey, "1"));
  }, [unseen, seenKey, run]);
  useEffect(() => {
    const list = timers.current;
    return () => list.splice(0).forEach((t) => window.clearTimeout(t));
  }, []);
  const play = () => {
    setManualStage(1);
    run();
  };

  const revealedOf = (b: BundleGroup) => (b.streamId === activeStream ? Math.min(stage, b.group.length) : b.group.length);
  const finalOf = (b: BundleGroup) => b.streamId !== activeStream || stage > b.group.length;

  const highlight = useMemo<MapHighlight | undefined>(() => {
    if (active) {
      const declined = new Set((activeView?.consents ?? []).filter((c) => c.state === "declined").map((c) => c.companyId));
      const shown = active.group.slice(0, Math.min(stage, active.group.length)).map((g) => g.companyId);
      const final = stage > active.group.length;
      const collectorId = active.collector.companyId || undefined;
      const visit = active.visitOrder?.filter((id) => !declined.has(id));
      return {
        groupIds: shown.filter((id) => !declined.has(id)),
        collectorId: final ? collectorId : undefined,
        partnerIds,
        excludedIds: final ? [...active.excluded.map((e) => e.companyId), ...declined] : [],
        fitIds: active.group.map((g) => g.companyId),
        route: final && collectorId && visit?.length ? [collectorId, ...visit, collectorId] : undefined,
        order: final && visit ? Object.fromEntries(visit.map((id, i) => [id, i + 1])) : undefined,
      };
    }
    return partnerIds.length ? { groupIds: [], partnerIds, fit: false } : undefined;
  }, [active, activeView, partnerIds, stage]);

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
                revealed={revealedOf(v.bundle)}
                final={finalOf(v.bundle)}
                playing={playing && activeStream === v.bundle.streamId}
                onReplay={activeStream === v.bundle.streamId ? play : undefined}
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
                <span aria-hidden="true" className="inline-block w-5 border-t-[3px] border-dashed border-ink" />
                순회 경로·순번
              </span>
              <span className="inline-flex items-center gap-2">
                <Shape kind="excluded" />
                제외·불참 업체
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
  revealed,
  final,
  playing,
  onReplay,
}: {
  view: BundleView;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showOnMap?: () => void;
  onMap: boolean;
  revealed: number;
  final: boolean;
  playing: boolean;
  onReplay?: () => void;
}) {
  const b = view.bundle;
  const share = new Map(b.costShare.map((c) => [c.companyId, c.sharePct]));
  const self = b.group.find((g) => g.isSelf);
  const titleId = `bundle-${b.streamId}`;
  const permitted = (p: string) => p === b.item || (b.item === "포장재" && p === "폐플라스틱");
  const consentOf = new Map((view.consents ?? []).map((c) => [c.companyId, c]));
  const summary = view.consents ? summarizeConsent(b, view.consents) : null;
  const shownKg = b.group.slice(0, revealed).reduce((a, g) => a + g.kg, 0);
  const shownRate = b.truckKg > 0 ? shownKg / b.truckKg : 0;
  const newest = b.group[revealed - 1];
  const nameOf = (id: string) => b.group.find((g) => g.companyId === id)?.name ?? id;
  const visit = b.visitOrder?.filter((id) => consentOf.get(id)?.state !== "declined");
  const live = playing
    ? revealed <= 1
      ? `${josa(view.detail, "을/를")} 내놓는 같은 단지 기업을 찾고 있습니다. 혼자서는 트럭의 ${Math.round(shownRate * 100)}%입니다.`
      : `${josa(newest?.name ?? "", "이/가")} 묶음에 들어왔습니다. 적재율 ${Math.round(shownRate * 100)}%입니다.`
    : final && b.routeM
      ? `${josa(b.collector.name, "이/가")} ${b.group.length}곳을 순회합니다. 약 ${km(b.routeM)}km입니다.`
      : "";

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
        <div className="mt-2 flex flex-wrap gap-2">
          {showOnMap ? (
            <button type="button" onClick={showOnMap} aria-pressed={onMap} className={buttonClass("secondary", "sm")}>
              {onMap ? "지도에 표시 중" : "이 묶음을 지도에 표시"}
            </button>
          ) : null}
          {onReplay ? (
            <button type="button" onClick={onReplay} disabled={playing} className={buttonClass("ghost", "sm")}>
              {playing ? "묶는 중…" : "묶음 과정 다시 보기"}
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 text-[13px] font-semibold text-ink">
          {live}
        </p>
      </div>

      {view.potential && view.potential.companies > 0 ? (
        <p className="text-[14px] leading-relaxed text-ink-2 tabular-nums">
          {view.potential.complexName} 전체에서 같은 {view.detail}({view.originLabel})을 내놓는 기업은{" "}
          <b className="font-semibold text-ink">{formatNumber(view.potential.companies)}곳, 월 {formatNumber(view.potential.kg)}kg</b>입니다(가상 데이터).
          혼자서는 모두 트럭을 채우지 못하는 양입니다. 이번 묶음은 그중 가장 가까운 {b.group.length - 1}곳과 꾸렸습니다.
        </p>
      ) : null}

      <TruckFillMeter
        soloKg={self?.kg ?? 0}
        totalKg={shownKg}
        truckKg={b.truckKg}
        minKg={b.minKg}
        soloFillRate={b.soloFillRate}
        fillRate={shownRate}
        members={revealed}
        scaleMax={b.fillRate}
        confirmed={summary?.sent ? { kg: summary.confirmedKg, rate: summary.confirmedRate, members: 1 + summary.accepted } : undefined}
      />

      {summary?.sent ? (
        <div className="rounded-md border border-line px-4 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              참여 동의 <span className="num">{summary.accepted}</span>/<span className="num">{summary.invited}</span>
            </h3>
            <span className="text-[12.5px] text-muted">승인 후 보낸 묶음 참여 제안의 회신</span>
          </div>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {b.group
              .filter((g) => !g.isSelf)
              .map((g) => {
                const c = consentOf.get(g.companyId);
                return (
                  <li key={g.companyId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{g.name}</span>
                    <span className="flex items-center gap-2">
                      {c?.at ? (
                        <span className="num text-[12px] text-muted">
                          {new Date(c.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                      <Badge tone={CONSENT_TONE[c?.state ?? "pending"]}>{CONSENT_LABEL[c?.state ?? "pending"]}</Badge>
                    </span>
                    {c?.state === "declined" && c.reason ? <span className="w-full text-[12.5px] text-ink-2">사유: {c.reason}</span> : null}
                  </li>
                );
              })}
          </ul>
          <p className={`mt-2.5 text-[13px] ${summary.confirmedKg < b.minKg && summary.pending === 0 ? "text-loss" : "text-ink-2"}`}>
            {summary.settled
              ? `묶음이 확정되었습니다. 동의한 물량은 월 ${formatNumber(summary.confirmedKg)}kg, 적재율 ${Math.round(summary.confirmedRate * 100)}%입니다. ${josa(b.collector.name, "이/가")} 순회 일정을 확정하면 첫 수거가 시작됩니다.`
              : summary.pending > 0
                ? `${summary.pending}곳의 회신을 기다리고 있습니다. 회신이 오면 이 화면이 바로 바뀝니다.`
                : `참여하지 않은 기업이 있어 최소 물량에 ${formatNumber(Math.max(0, b.minKg - summary.confirmedKg))}kg 모자랍니다. 같은 단지의 다음 후보를 찾아 다시 제안해야 합니다.`}
          </p>
        </div>
      ) : null}

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
            {b.group.map((g, i) => (
              <tr
                key={g.companyId}
                aria-hidden={i >= revealed ? true : undefined}
                className={`border-b border-line transition-opacity duration-500 motion-reduce:transition-none ${i >= revealed ? "opacity-0" : ""} ${selectedId === g.companyId ? "bg-sunken" : ""}`}
              >
                <th scope="row" className="py-1.5 text-left font-normal">
                  <button type="button" onClick={() => onSelect(g.companyId)} aria-pressed={selectedId === g.companyId} className={nameButton}>
                    <Shape kind="group" />
                    <span className={g.isSelf ? "font-semibold" : ""}>{g.name}</span>
                    {g.isSelf ? <span className="rounded-sm bg-sunken px-1.5 text-[11.5px] text-ink-2">내 회사</span> : null}
                    {consentOf.get(g.companyId)?.state === "declined" ? <span className="rounded-sm bg-loss-bg px-1.5 text-[11.5px] text-loss">불참</span> : null}
                  </button>
                </th>
                <td className={`py-1.5 pl-3 text-right ${g.isSelf ? "text-[13px] text-muted" : "num"}`}>{g.isSelf ? "기준" : formatNumber(g.distanceM)}</td>
                <td className={`py-1.5 pl-3 text-right ${g.isSelf ? "num" : "text-[13px] text-muted"}`}>{g.isSelf ? formatNumber(g.kg) : "비공개"}</td>
                <td className="num py-1.5 pl-3 text-right">{final ? (share.get(g.companyId) ?? 0).toFixed(1) : "·"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" className="py-2.5 text-left">
                합계
              </th>
              <td className="py-2.5" />
              <td className="num py-2.5 pl-3 text-right">{formatNumber(final ? b.totalKg : shownKg)}</td>
              <td className="num py-2.5 pl-3 text-right">{final ? "100.0" : "·"}</td>
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
        {visit?.length ? (
          <div className={`mt-4 transition-opacity duration-500 motion-reduce:transition-none ${final ? "" : "opacity-0"}`} aria-hidden={final ? undefined : true}>
            <h4 className="text-label text-muted">순회 순서 (제안)</h4>
            <ol className="mt-2 grid gap-1.5 text-sm">
              <li className="flex items-center gap-2.5 text-ink-2">
                <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px] bg-ink" />
                {b.collector.name} 출발
              </li>
              {visit.map((id, i) => (
                <li key={id} className="flex items-center gap-2.5">
                  <span className="num grid size-[18px] place-items-center rounded-full bg-ink text-[10.5px] font-bold text-on-ink">{i + 1}</span>
                  <span className={b.group.find((g) => g.companyId === id)?.isSelf ? "font-semibold" : ""}>{nameOf(id)}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-ink-2">
                <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px] bg-ink" />
                복귀{b.routeM ? <span className="num text-muted">· 약 {km(b.routeM)}km</span> : null}
              </li>
            </ol>
            <p className="mt-2 text-[12.5px] text-muted">
              업체 위치에서 가장 가까운 사업장부터 도는 순서입니다. 거리는 직선거리에 도로 계수 1.3을 곱한 가정값이고, 사업장마다 따로 계량해 전자인계서를 씁니다.
            </p>
          </div>
        ) : null}
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
                  <b className="font-semibold">{josa(e.name, "을/를")}</b> 후보에서 제외했습니다. 사유는 {e.reason}입니다.
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
