import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { MatchingWorkspace, type BundleView, type PartnerRow } from "@/components/session/matching-workspace";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { ORIGIN_LABEL } from "@/components/session/stream-badges";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { summarizeConsent } from "@/lib/bundle-consent";
import { findComplex } from "@/lib/complexes";
import { formatNumber } from "@/lib/format";
import { bundleConsents } from "@/lib/server/bundle-consent";
import { getCompanies } from "@/lib/server/companies";
import { isPeerStream } from "@/lib/server/mock/pipeline";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import type { MatchingResult, Stream, StreamDecision } from "@/lib/session/types";

export const metadata: Metadata = { title: "업체·묶음 매칭" };

const pct = (r: number) => Math.round(r * 100);

/** 흐름 하나의 거래처 줄. 재투입은 사내, 소각은 현행 위탁처 */
function partnerRow(s: Stream, d: StreamDecision, m: MatchingResult): PartnerRow {
  const base = { streamId: s.id, streamName: s.name, process: s.process, route: d.route };
  switch (d.route) {
    case "reuse":
      return { ...base, partner: "사내", location: s.process ? `사내 · ${s.process}` : "사내", note: "분쇄해서 같은 공정에 신재 대비 10% 이내로 다시 넣습니다." };
    case "bundle": {
      const b = m.bundles.find((x) => x.streamId === s.id);
      if (!b) return { ...base, partner: "수거 업체 미정", location: "같은 단지", note: "순회 수거 그룹을 꾸리지 못했습니다." };
      return {
        ...base,
        partner: b.collector.name,
        companyId: b.collector.companyId || undefined,
        location: "같은 단지 · 순회",
        distanceM: b.collector.distanceM,
        note: `${b.group.length}개사 순회 수거 · 트럭 적재율 ${pct(b.fillRate)}% · ${b.schedule}`,
      };
    }
    case "sell":
    case "pyrolysis": {
      const p = m.partners.find((x) => x.streamId === s.id);
      if (!p) return { ...base, partner: "거래처 미정", location: "—", note: "허가 품목이 맞는 업체를 찾지 못했습니다." };
      return { ...base, partner: p.name, companyId: p.companyId, location: p.location, distanceM: p.distanceM, note: p.note };
    }
    case "incinerate":
      return {
        ...base,
        partner: "현행 위탁처",
        location: "지금 계약 그대로",
        note: `혼합 사업장폐기물로 위탁 · 처리비 kg당 ${formatNumber(Math.abs(d.currentPerKg))}원(가정)`,
      };
  }
}

export default async function MatchingPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute params={params} step="matching" />;
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const matching = session.matching;
  const decisions = session.feasibility?.decisions ?? [];
  const firstBundle = matching?.bundles[0];
  const itemStream = session.streams.find((s) => s.id === firstBundle?.streamId) ?? session.streams[0];
  const disagree = (
    <DisagreeDialog
      step="matching"
      item={itemStream?.classify.item ?? "폐플라스틱"}
      sessionId={session.id}
      placeholder={{ condition: "예: 이 업체는 화요일 오전에만 단지에 들어온다", judgment: "예: 순회 수거 요일을 화요일로 맞춘다" }}
    />
  );

  if (!matching) {
    return (
      <div className="grid gap-6">
        <StepHeader step="matching" title="업체·묶음 매칭" aside={disagree} />
        <EmptyState
          title="아직 거래처와 묶음을 찾지 않았습니다."
          description="흐름마다 매각처·열분해 업체를 찾고, 혼자 팔기엔 양이 적은 흐름은 같은 단지 기업과 순회 수거로 묶어 트럭 적재율을 채웁니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "matching")}>
                <button type="submit" className={buttonClass("primary")}>
                  거래처와 묶음 찾기
                </button>
              </form>
              <Link href={`/session/${session.id}/regulation`} className={buttonClass("ghost")}>
                규정 검토로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const complex = findComplex(matching.complexId) ?? findComplex(session.complexId);
  const companies = await getCompanies(matching.complexId);
  const decisionOf = new Map(decisions.map((d) => [d.streamId, d]));
  const streamOf = new Map(session.streams.map((s) => [s.id, s]));

  const rows: PartnerRow[] = session.streams.flatMap((s) => {
    const d = decisionOf.get(s.id);
    return d ? [partnerRow(s, d, matching)] : [];
  });
  const consents = await bundleConsents(session);
  const selfId = matching.bundles[0]?.group.find((g) => g.isSelf)?.companyId;
  const bundles: BundleView[] = matching.bundles.flatMap((b) => {
    const s = streamOf.get(b.streamId);
    if (!s) return [];
    // 단지 전체에서 같은 재질·출처 흐름을 내놓는 배출 기업(내 회사 제외)
    const peers = companies
      .filter((c) => c.role === "배출" && c.id !== selfId)
      .map((c) => c.wasteStreams.filter((w) => isPeerStream(s, w)).reduce((a, w) => a + w.monthlyKg, 0))
      .filter((kg) => kg > 0);
    return [
      {
        bundle: b,
        streamName: s.name,
        detail: s.classify.detail,
        originLabel: ORIGIN_LABEL[s.origin].short,
        consents: consents.get(b.streamId),
        potential: { companies: peers.length + 1, kg: peers.reduce((a, kg) => a + kg, 0) + s.monthlyKg, complexName: complex?.shortName ?? complex?.name ?? "산업단지" },
      },
    ];
  });
  const waiting = bundles.some((v) => v.consents && summarizeConsent(v.bundle, v.consents).pending > 0);
  const outside = rows.filter((r) => r.route === "sell" || r.route === "pyrolysis").length;

  // 첫 문장: 묶음 흐름이 있으면 단독과 묶음의 트럭 적재율 차이, 없으면 거래처 요약
  let lead: string;
  let follow: string;
  if (firstBundle) {
    const name = streamOf.get(firstBundle.streamId)?.name ?? "묶음 흐름";
    const selfKg = firstBundle.group.find((g) => g.isSelf)?.kg ?? 0;
    const peers = firstBundle.group.length - 1;
    const tons = (firstBundle.truckKg / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    lead =
      selfKg < firstBundle.minKg
        ? `${name} 월 ${formatNumber(selfKg)}kg은 ${tons}톤 트럭의 ${pct(firstBundle.soloFillRate)}%라 혼자서는 업체가 오지 않습니다.`
        : `${name} 월 ${formatNumber(selfKg)}kg은 혼자서도 최소 물량을 채우지만, 묶으면 운반비를 나눠 낼 수 있습니다.`;
    const rest = outside ? ` 나머지 흐름은 매각처·열분해 업체 ${outside}곳과 사내 재투입으로 보냅니다.` : "";
    follow =
      peers > 0
        ? `같은 단지 ${peers}개사와 순회 수거로 묶으면 월 ${formatNumber(firstBundle.totalKg)}kg, 적재율 ${pct(firstBundle.fillRate)}%가 됩니다.${rest}`
        : `같은 단지에서 같은 재질을 내놓는 기업을 아직 찾지 못했습니다.${rest}`;
  } else {
    lead = "이번 진단에는 단지 묶음 매각으로 판정한 흐름이 없습니다.";
    follow = `흐름 ${rows.length}개의 갈 곳과 거래처를 아래 표에 정리했습니다.`;
  }

  return (
    <div>
      <StepHeader
        step="matching"
        title="업체·묶음 매칭"
        description={`${complex?.name ?? "산업단지"} · 흐름 ${rows.length}개 · 순회 수거 ${bundles.length}건 · 최소 물량과 트럭 적재량은 품목별 가정값입니다.`}
        aside={disagree}
      />

      <p className="mt-5 max-w-3xl text-[17px] leading-relaxed tabular-nums">
        <b className="font-semibold">{lead}</b> {follow}
      </p>

      <div className="mt-8">
        {complex ? (
          <MatchingWorkspace sessionId={session.id} rows={rows} bundles={bundles} complex={complex} companies={companies} />
        ) : (
          <EmptyState title="산업단지 정보를 찾지 못했습니다." description="지도를 그릴 수 없습니다. 온보딩에서 고른 산업단지를 확인해 주세요." />
        )}
      </div>

      <LiveRefresh active={waiting} />
      <StepFooter sessionId={session.id} step="matching" nextLabel="흐름별 비용·탄소 비교" />
    </div>
  );
}
