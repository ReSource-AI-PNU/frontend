import type { Metadata } from "next";
import Link from "next/link";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { MatchingWorkspace } from "@/components/session/matching-workspace";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { findComplex } from "@/lib/complexes";
import { formatNumber } from "@/lib/format";
import { getCompanies } from "@/lib/server/companies";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "묶음 수거 매칭" };

export default async function MatchingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const matching = session.matching;

  if (!matching) {
    return (
      <div className="grid gap-6">
        <StepHeader step="matching" title="묶음 수거 매칭" />
        <EmptyState
          title="아직 묶음 수거 후보를 찾지 않았습니다."
          description="같은 단지에서 같은 품목을 내놓는 기업과 허가를 가진 수거 업체를 찾아, 최소 수거 물량을 채우는 묶음을 만듭니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "matching")}>
                <button type="submit" className={buttonClass("primary")}>
                  묶음 수거 찾기
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
  const self = matching.group.find((g) => g.isSelf);
  const selfKg = self?.kg ?? 0;
  const peers = matching.group.length - 1;

  const lead = matching.soloFeasible
    ? `월 ${formatNumber(selfKg)}kg이면 단독 수거도 가능하지만, 가까운 ${peers}개사와 묶으면 운송비를 나눠 낼 수 있습니다.`
    : `월 ${formatNumber(selfKg)}kg은 처리업체의 최소 수거 물량 ${formatNumber(matching.minKg)}kg에 못 미쳐 단독으로는 수거를 맡길 수 없습니다.`;
  const follow =
    matching.totalKg >= matching.minKg
      ? `가까운 ${peers}개사와 묶으면 월 ${formatNumber(matching.totalKg)}kg이 되어 최소 물량을 넘습니다.`
      : `가까운 ${peers}개사와 묶어도 월 ${formatNumber(matching.totalKg)}kg이라 최소 물량에 ${formatNumber(matching.minKg - matching.totalKg)}kg 모자랍니다.`;

  return (
    <div>
      <StepHeader
        step="matching"
        title="묶음 수거 매칭"
        description={`${complex?.name ?? "산업단지"} · ${session.classify.item} · 최소 수거 물량 ${formatNumber(matching.minKg)}kg (가정값)`}
        aside={
          <DisagreeDialog
            step="matching"
            item={session.classify.item}
            sessionId={session.id}
            placeholder={{ condition: "예: 이 업체는 화요일 오전에만 단지에 들어온다", judgment: "예: 수거 요일을 화요일로 맞춘다" }}
          />
        }
      />

      <p className="mt-5 max-w-3xl text-[17px] leading-relaxed">
        <b className="font-semibold">{lead}</b> {follow}
      </p>

      <div className="mt-6">
        {complex ? (
          <MatchingWorkspace matching={matching} complex={complex} companies={companies} item={session.classify.item} />
        ) : (
          <EmptyState title="산업단지 정보를 찾지 못했습니다." description="지도를 그릴 수 없습니다. 온보딩에서 고른 산업단지를 확인해 주세요." />
        )}
      </div>

      <StepFooter sessionId={session.id} step="matching" nextLabel="이 묶음으로 비용·탄소 비교" />
    </div>
  );
}
