import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { ProposalDocuments, type DocStatus, type DocView } from "@/components/session/proposal-documents";
import { ProposalGate, type GateTarget } from "@/components/session/proposal-gate";
import { ProposalOutcomeForm, type OutcomeStream } from "@/components/session/proposal-outcome";
import { ProposalRoutes } from "@/components/session/proposal-routes";
import { formatKoreanTime, ProposalOutcomeCompare, ProposalSent } from "@/components/session/proposal-sent";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { bundleConsents } from "@/lib/server/bundle-consent";
import { goToStep } from "@/lib/server/session-actions";
import { getCurrentUser } from "@/lib/server/session";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import type { DocumentKind, Route } from "@/lib/session/types";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

export const metadata: Metadata = { title: "이행안·승인" };

const KIND_ORDER: DocumentKind[] = ["plan", "grant", "pickup", "quote", "joint"];
/** 서류 이름. 탭에는 짧은 이름(KIND_TAB)을 쓴다 */
const KIND_NAME: Record<DocumentKind, string> = {
  plan: "이행 계획서",
  grant: "지원사업 신청 초안",
  pickup: "순회 수거 요청서",
  quote: "매각 견적 요청서",
  joint: "공동처리 신고서 초안",
};
const KIND_TAB: Record<DocumentKind, string> = { ...KIND_NAME, grant: "지원사업 신청", joint: "공동처리 신고서" };
/** approveAndSend가 sentTo에 남기는 서류 이름 */
const KIND_SENT: Partial<Record<DocumentKind, string>> = { pickup: "순회 수거 요청서", quote: "매각 견적 요청서" };

/** approveAndSend와 같은 규칙: 순회 수거 요청서는 A에서만, 매각 견적 요청서는 A·B에서만 보낸다 */
const sendsKind = (routeId: Route["id"], kind: DocumentKind) => (kind === "pickup" ? routeId === "A" : kind === "quote" ? routeId === "A" || routeId === "B" : false);

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, org } = await getSessionForCurrentOrg(id);
  const proposal = session.proposal;
  const routesAll = session.costCarbon?.routes ?? [];
  const streamOf = new Map(session.streams.map((s) => [s.id, s]));
  const firstBundleStream = session.matching?.bundles[0]?.streamId;
  const disagree = (
    <DisagreeDialog
      step="proposal"
      item={(firstBundleStream ? streamOf.get(firstBundleStream) : session.streams[0])?.classify.item ?? "폐플라스틱"}
      sessionId={session.id}
      placeholder={{ condition: "예: 묶음 참여 기업이 월말에 물량이 몰릴 때", judgment: "예: 순회 수거 주기를 월 1회로 줄여 요청한다" }}
    />
  );

  if (!proposal || routesAll.length === 0) {
    return (
      <div className="grid gap-6">
        <StepHeader step="proposal" title="이행안과 승인" aside={disagree} />
        <EmptyState
          title="아직 이행안을 만들지 않았습니다."
          description="시나리오별 손익과 탄소를 비교해 추천안 하나와 대안을 고르고, 이행 계획서·지원사업 신청 초안·순회 수거 요청서·매각 견적 요청서를 만듭니다. 외부 발송은 담당자가 승인해야만 이루어집니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "proposal")}>
                <button type="submit" className={buttonClass("primary")}>
                  이행안 만들기
                </button>
              </form>
              <Link href={`/session/${session.id}/cost-carbon`} className={buttonClass("ghost")}>
                비용·탄소 비교로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  const byId = new Map(routesAll.map((r) => [r.id, r]));
  const cards = [proposal.recommended, ...proposal.alternatives].map((rid) => byId.get(rid)).filter((r): r is Route => Boolean(r));
  const approval = session.approval;
  // 묶음 참여 제안의 회신 상태(받는 곳 이름 기준). 회신을 기다리는 동안 화면을 주기적으로 새로 읽는다
  const replies = approval
    ? Object.fromEntries(
        [...(await bundleConsents(session)).values()]
          .flat()
          .filter((c) => c.state !== "self" && c.state !== "not-sent")
          .map((c) => [c.name, c.state]),
      )
    : undefined;
  const waitingReplies = replies ? Object.values(replies).includes("pending") : false;
  const routeId = approval?.routeId ?? session.selectedRoute ?? proposal.recommended;
  const selected = byId.get(routeId);
  const routeLabel = selected ? `${selected.id}. ${selected.name}` : routeId;
  const m = session.matching;
  const decisions = session.feasibility?.decisions ?? [];
  const streamName = (sid?: string) => (sid ? streamOf.get(sid)?.name : undefined);

  // 발송 대상: approveAndSend와 같은 규칙으로 계산한다
  const targets: GateTarget[] = [];
  if (routeId === "A") {
    for (const b of m?.bundles ?? []) {
      const stream = streamName(b.streamId);
      if (b.collector.companyId) targets.push({ name: b.collector.name, kind: "순회 수거 요청서", stream });
      for (const g of b.group.filter((x) => !x.isSelf)) targets.push({ name: g.name, kind: "묶음 참여 제안", stream });
    }
  }
  if (routeId === "A" || routeId === "B") {
    for (const p of m?.partners.filter((x) => x.companyId) ?? []) {
      targets.push({ name: p.name, kind: p.route === "pyrolysis" ? "열분해 위탁 요청서" : "매각 견적 요청서", stream: streamName(p.streamId) });
    }
  }
  const emptyNote =
    routeId === "A" || routeId === "B"
      ? "보낼 거래처를 찾지 못했습니다. 업체·묶음 매칭 단계에서 매각처와 수거 업체를 확인해 주세요."
      : `${routeLabel}은(는) 흐름을 매각하거나 묶지 않는 방안이라, 순회 수거 요청서와 매각 견적 요청서를 보내지 않습니다. 발송하려면 위에서 A나 B를 고르세요.`;

  // 서류 다섯 종류: 순서·탭 이름·상태·안내
  // 견적 요청서는 매각과 열분해 위탁 두 가지라 서류 제목을 탭 이름으로 쓴다
  const tabBase = (d: { kind: DocumentKind; title: string }) => (d.kind === "quote" ? d.title : KIND_TAB[d.kind]);
  const tabCount = new Map<string, number>();
  for (const d of proposal.documents) tabCount.set(tabBase(d), (tabCount.get(tabBase(d)) ?? 0) + 1);
  const docStatus = (kind: DocumentKind, external: boolean, to: string, title: string): DocStatus => {
    if (!external) return "internal";
    if (approval) return approval.sentTo.some((t) => t.name === to && (t.kind === KIND_SENT[kind] || t.kind === title)) ? "sent" : "skipped";
    return sendsKind(routeId, kind) ? "pending" : "skipped";
  };
  const docNote = (kind: DocumentKind, title: string): string | undefined => {
    if (kind === "joint") {
      return routeId === "A"
        ? "기본값은 각 사업장이 수거 업체와 따로 계약하는 순회 수거라 이 신고서는 내지 않아도 됩니다. 대표자가 신고·인계를 대신하길 원할 때만 구청의 소량 배출 사업장 인정을 받아 제출합니다."
        : "공동처리 신고서는 묶음이 있는 A. 흐름별 최적안에서만 씁니다. 지금 고른 방안에서는 쓰지 않습니다.";
    }
    if (kind === "pickup" && routeId !== "A") return "순회 수거 요청서는 A. 흐름별 최적안을 고를 때만 보냅니다. 지금 고른 방안에서는 이 흐름을 묶지 않습니다.";
    if (kind === "quote" && routeId !== "A" && routeId !== "B") return `${title}는 A나 B를 고를 때만 보냅니다.`;
    if ((kind === "plan" || kind === "grant") && routeId !== proposal.recommended) {
      return "이 초안은 AI 추천안 기준으로 작성했습니다. 고른 방안에 맞게 고쳐 쓰세요.";
    }
    return undefined;
  };
  const documents: DocView[] = [...proposal.documents]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map((d) => ({
      ...d,
      tabLabel: (tabCount.get(tabBase(d)) ?? 0) > 1 && d.streamId ? `${tabBase(d)} · ${streamName(d.streamId) ?? ""}` : tabBase(d),
      status: docStatus(d.kind, d.external, d.to, d.title),
      note: docNote(d.kind, d.title),
    }));
  const internalDocs = [...new Set(documents.filter((d) => !d.external && !d.optional).map((d) => KIND_NAME[d.kind]))];

  // 실제 결과를 적을 흐름: 승인한 방안에서 서류를 보낸 묶음·매각·열분해 흐름
  const sentRoute = approval?.routeId;
  const outcomeStreams: OutcomeStream[] = decisions
    .filter((d) => (sentRoute === "A" && (d.route === "bundle" || d.route === "sell" || d.route === "pyrolysis")) || (sentRoute === "B" && (d.route === "sell" || d.route === "pyrolysis")))
    .flatMap((d) => {
      const s = streamOf.get(d.streamId);
      return s ? [{ id: s.id, name: s.name, routeLabel: STREAM_ROUTE_LABEL[d.route], expectedPerKg: d.afterPerKg, expectedKg: s.monthlyKg }] : [];
    });
  // 흐름마다 결과가 하나씩 쌓인다. 예전 기록(outcome 하나)도 읽는다
  const recorded = session.outcomes ?? (session.outcome ? [session.outcome] : []);
  const recordedRows = recorded.flatMap((o) => {
    const s = o.streamId ? streamOf.get(o.streamId) : undefined;
    const d = s ? decisions.find((x) => x.streamId === s.id) : undefined;
    return s && d ? [{ o, s, d }] : [];
  });
  const pendingStreams = outcomeStreams.filter((x) => !recorded.some((o) => o.streamId === x.id));
  const doneStreams = outcomeStreams.filter((x) => recorded.some((o) => o.streamId === x.id));

  return (
    <div>
      <StepHeader
        step="proposal"
        title="이행안과 승인"
        description="방안을 고르면 발송 대상과 서류가 바뀝니다. 외부 발송은 담당자가 승인해야만 이루어집니다."
        aside={disagree}
      />

      <p className="mt-5 max-w-3xl text-[17px] leading-relaxed font-semibold tabular-nums">{proposal.summary}</p>

      <section aria-labelledby="routes-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="routes-title" className="text-label text-muted">
            이행 방안
          </h2>
          <p className="text-[13px] text-muted">{approval ? "승인을 마쳐 방안을 바꿀 수 없습니다." : "카드를 고르면 발송 대상과 서류가 그 방안으로 바뀝니다."}</p>
        </div>
        <ProposalRoutes sessionId={session.id} routes={cards} recommendedId={proposal.recommended} selectedId={routeId} disabled={Boolean(approval)} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-6">
        <section aria-labelledby="docs-title" className="min-w-0 lg:col-span-8">
          <h2 id="docs-title" className="mb-2 text-h2">
            서류 초안 {documents.length}건
          </h2>
          <ProposalDocuments documents={documents} from={org.name} dateLabel={approval ? formatKoreanTime(approval.approvedAt) : "승인할 때 확정됩니다"} />
        </section>

        <aside className="grid content-start gap-4 lg:col-span-4">
          {approval ? (
            <ProposalSent approval={approval} routeLabel={routeLabel} internalDocs={internalDocs} replies={replies} />
          ) : (
            <ProposalGate
              sessionId={session.id}
              routeLabel={routeLabel}
              targets={targets}
              approver={user.name}
              internalDocs={internalDocs}
              emptyNote={emptyNote}
            />
          )}
        </aside>
      </div>

      {approval && outcomeStreams.length ? (
        <section className="mt-10 max-w-3xl border-t border-line pt-8">
          <div className="grid gap-8">
            {recordedRows.map(({ o, s, d }) => (
              <ProposalOutcomeCompare key={s.id} outcome={o} expected={{ streamName: s.name, route: d.route, perKg: d.afterPerKg, kg: s.monthlyKg }} />
            ))}
            {pendingStreams.length ? (
              <ProposalOutcomeForm
                key={pendingStreams.map((x) => x.id).join()}
                sessionId={session.id}
                streams={pendingStreams}
                heading={recordedRows.length ? `남은 흐름 ${pendingStreams.length}개의 실제 결과를 기록해 주세요` : undefined}
              />
            ) : null}
            {doneStreams.length ? (
              <details className="border-t border-line pt-5">
                <summary className="w-fit cursor-pointer text-sm font-semibold underline underline-offset-4 hover:text-ink-2">기록한 결과 고치기</summary>
                <p className="mt-2 text-[13px] text-muted">같은 흐름으로 다시 기록하면 앞의 결과를 대신합니다.</p>
                <div className="mt-4">
                  <ProposalOutcomeForm sessionId={session.id} streams={doneStreams} heading="실제 결과 다시 기록" />
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      <LiveRefresh active={waitingReplies} />
      <StepFooter
        sessionId={session.id}
        step="proposal"
        extra={
          approval ? (
            <Link href="/dashboard" className={buttonClass("secondary")}>
              대시보드로
            </Link>
          ) : null
        }
      />
    </div>
  );
}
