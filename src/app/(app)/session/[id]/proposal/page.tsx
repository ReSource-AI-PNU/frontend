import type { Metadata } from "next";
import Link from "next/link";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { ProposalDocuments } from "@/components/session/proposal-documents";
import { ProposalGate } from "@/components/session/proposal-gate";
import { ProposalOutcomeForm } from "@/components/session/proposal-outcome";
import { ProposalRoutes } from "@/components/session/proposal-routes";
import { formatKoreanTime, ProposalOutcomeCompare, ProposalSent } from "@/components/session/proposal-sent";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { goToStep } from "@/lib/server/session-actions";
import { getCurrentUser } from "@/lib/server/session";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import type { Route } from "@/lib/session/types";

export const metadata: Metadata = { title: "최적안·승인" };

const VERDICT = { reuse: "재사용 가능", recycle: "재활용 가능", dispose: "폐기 처리" } as const;

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, org } = await getSessionForCurrentOrg(id);
  const proposal = session.proposal;
  const routesAll = session.costCarbon?.routes ?? [];

  if (!proposal || routesAll.length === 0) {
    return (
      <div className="grid gap-6">
        <StepHeader step="proposal" title="최적안과 승인" />
        <EmptyState
          title="아직 최적안을 고르지 않았습니다."
          description="경로별 손익과 탄소를 비교해 추천안 하나와 대안을 고르고, 견적 요청서·공동처리 신고서·인계서 초안을 만듭니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "proposal")}>
                <button type="submit" className={buttonClass("primary")}>
                  최적안 만들기
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
  const selectedId = approval?.routeId ?? session.selectedRoute ?? proposal.recommended;
  const selected = byId.get(selectedId);
  const routeLabel = selected ? `${selected.id}. ${selected.name}` : selectedId;
  const m = session.matching;

  // approveAndSend와 같은 규칙: 수거 업체에는 견적 요청서, A(묶음)일 때만 그룹 기업에 참여 제안
  const targets: { name: string; kind: string }[] = [];
  if (m?.collector.companyId) targets.push({ name: m.collector.name, kind: "견적 요청서" });
  if (selectedId === "A" && m) for (const g of m.group.filter((x) => !x.isSelf)) targets.push({ name: g.name, kind: "묶음 참여 제안" });
  const drafts = proposal.documents.filter((d) => d.kind !== "quote").map((d) => d.title);

  const notes: Record<string, string> = {};
  if (selectedId !== "A") notes.joint = "공동처리 신고서는 A. 묶음 재활용을 고를 때만 제출합니다. 지금 고른 경로에서는 쓰지 않습니다.";

  const volumeAnswer = Number(session.questions.find((q) => q.id === "volume")?.answer);
  const selfKg = m?.group.find((g) => g.isSelf)?.kg ?? (Number.isFinite(volumeAnswer) && volumeAnswer > 0 ? volumeAnswer : session.classify.estimatedKg);
  const bundled = (approval?.routeId ?? selectedId) === "A" && m;
  const expected = {
    verdictLabel: session.feasibility ? VERDICT[session.feasibility.verdict] : "-",
    perKg: session.feasibility?.afterPerKg ?? 0,
    kg: bundled ? m.totalKg : selfKg,
    kgNote: bundled ? "묶음 전체" : undefined,
  };

  return (
    <div>
      <StepHeader
        step="proposal"
        title="최적안과 승인"
        description="안을 고르면 발송 대상이 바뀝니다. 외부 발송은 담당자가 승인해야만 이루어집니다."
        aside={
          <DisagreeDialog
            step="proposal"
            item={session.classify.item}
            sessionId={session.id}
            placeholder={{ condition: "예: 묶음 참여 기업이 월말에 물량이 몰릴 때", judgment: "예: 수거 주기를 월 1회로 줄여 요청한다" }}
          />
        }
      />

      <p className="mt-5 max-w-3xl text-[17px] leading-relaxed font-semibold tabular-nums">{proposal.summary}</p>

      <section aria-labelledby="routes-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="routes-title" className="text-label text-muted">
            처리 방안
          </h2>
          <p className="text-[13px] text-muted">{approval ? "발송을 마쳐 방안을 바꿀 수 없습니다." : "카드를 고르면 발송 대상과 서류가 그 방안으로 바뀝니다."}</p>
        </div>
        <ProposalRoutes sessionId={session.id} routes={cards} recommendedId={proposal.recommended} selectedId={selectedId} disabled={Boolean(approval)} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-6">
        <section aria-labelledby="docs-title" className="lg:col-span-7">
          <h2 id="docs-title" className="mb-2 text-h2">
            서류 초안 {proposal.documents.length}종
          </h2>
          <ProposalDocuments
            documents={proposal.documents}
            from={org.name}
            dateLabel={approval ? formatKoreanTime(approval.approvedAt) : "승인할 때 확정됩니다"}
            notes={notes}
            sent={Boolean(approval)}
          />
        </section>

        <aside className="grid content-start gap-4 lg:col-span-5">
          {approval ? (
            <ProposalSent approval={approval} routeLabel={routeLabel} />
          ) : (
            <ProposalGate sessionId={session.id} routeLabel={routeLabel} targets={targets} approver={user.name} drafts={drafts} />
          )}
        </aside>
      </div>

      {approval ? (
        <section className="mt-10 max-w-3xl border-t border-line pt-8">
          {session.outcome ? (
            <ProposalOutcomeCompare outcome={session.outcome} expected={expected} />
          ) : (
            <ProposalOutcomeForm sessionId={session.id} expectedPerKg={expected.perKg} expectedKg={expected.kg} />
          )}
        </section>
      ) : null}

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
