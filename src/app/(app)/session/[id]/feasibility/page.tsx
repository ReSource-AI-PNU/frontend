import type { Metadata } from "next";
import Link from "next/link";
import { InfoIcon } from "@/components/icons";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { FeasibilityLadder } from "@/components/session/feasibility-ladder";
import { SessionPhoto } from "@/components/session/session-photo";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";
import { FlipNumber } from "@/components/verdict/flip-number";
import { formatNumber, formatSigned } from "@/lib/format";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { monthlyKgOf } from "@/lib/server/mock/pipeline";

export const metadata: Metadata = { title: "판정" };

export default async function FeasibilityPage({ params }: PageProps<"/session/[id]/feasibility">) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const f = session.feasibility;

  if (!f) {
    return (
      <EmptyState
        title="아직 판정하지 않았습니다"
        description="식별 결과와 질문 답변을 바탕으로 재사용·재활용·폐기 중 하나로 판정합니다."
        action={
          <form action={goToStep.bind(null, session.id, "feasibility")}>
            <button type="submit" className={buttonClass("primary")}>
              판정하기
            </button>
          </form>
        }
      />
    );
  }

  const kg = monthlyKgOf(session);
  const contaminants = session.classify.detections.filter((d) => d.kind === "contaminant");
  const headline = f.afterPerKg > 0 && f.currentPerKg <= 0 ? "작업 한 건이면, 이 더미는 수익이 됩니다." : f.afterPerKg > f.currentPerKg ? "작업 한 건이면, 단가가 오릅니다." : "지금 상태로 처리하는 것이 낫습니다.";

  return (
    <div className="grid gap-8">
      <StepHeader
        step="feasibility"
        title="재활용 가능성 판정"
        description={`${session.classify.detail} · 월 ${formatNumber(kg)}kg · ${session.questions.find((q) => q.id === "storage")?.answer ?? "보관 정보 없음"}`}
        aside={<VerdictBadge verdict={f.verdict} />}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SessionPhoto media={session.media[0]} detections={contaminants} caption="이물질만 표시" />

        <div className="grid content-start gap-6">
          <div>
            <Badge tone="ai">권고 작업 1건</Badge>
            <h2 className="mt-3 text-[26px] leading-[1.3] font-[750] tracking-[-0.03em]">{f.action.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{headline}</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-[13px] text-muted">
              <span>kg당 손익</span>
              <span className="num text-loss line-through decoration-1">{formatSigned(f.currentPerKg)} 원/kg</span>
            </div>
            <FlipNumber from={f.currentPerKg} to={f.afterPerKg} unit="원/kg" className="mt-2 text-[56px]" />
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] border-t border-line text-sm">
            <dt className="border-b border-line py-2.5 pr-6 text-muted">작업량</dt>
            <dd className="num border-b border-line py-2.5 text-right">1인 · {f.action.laborHours}시간 / 월</dd>
            <dt className="border-b border-line py-2.5 pr-6 text-muted">작업 비용</dt>
            <dd className="num border-b border-line py-2.5 text-right text-loss">{formatSigned(-f.action.laborCost)}원</dd>
            <dt className="border-b border-line py-2.5 pr-6 text-muted">처리비 절감 + 매각 수익</dt>
            <dd className="num border-b border-line py-2.5 text-right font-semibold text-gain">{formatSigned(f.action.benefit)}원</dd>
            <dt className="border-b border-line py-2.5 pr-6 font-semibold">월 순효과</dt>
            <dd className={`num border-b border-line py-2.5 text-right text-lg font-semibold ${f.action.net >= 0 ? "text-gain" : "text-loss"}`}>{formatSigned(f.action.net)}원</dd>
          </dl>
          <p className="flex items-start gap-2 rounded-md bg-sunken px-3.5 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
            <InfoIcon />
            {f.note}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="ladder-title">
          <h2 id="ladder-title" className="text-h2">
            작업 단계별 kg당 손익
          </h2>
          <p className="mt-1 text-sm text-muted">무엇을 떼어 내면 어디서부터 돈이 되는지 보여 줍니다. 단가는 시연용 가정값입니다.</p>
          <div className="mt-4">
            <FeasibilityLadder ladder={f.ladder} />
          </div>
        </section>

        <section aria-labelledby="reason-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="reason-title" className="text-h2">
              판정 근거
            </h2>
            <DisagreeDialog step="feasibility" item={session.classify.item} sessionId={session.id} placeholder={{ condition: "예: 비 온 다음 날 야외에 둔 베일", judgment: "예: 한 등급 낮춰 매입한다" }} />
          </div>
          <ol className="mt-3 border-t border-line">
            {f.reasons.map((r, i) => (
              <li key={i} className="grid gap-1 border-b border-line py-3 text-sm">
                <p>{r.text}</p>
                <p className="flex items-center gap-2 text-[12px] text-muted">
                  {r.knowledgeCardId ? (
                    <>
                      <Badge tone="neutral">현장 지식</Badge>
                      <Link href="/knowledge" className="underline underline-offset-2">
                        {r.source}
                      </Link>
                    </>
                  ) : (
                    r.source
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <StepFooter sessionId={session.id} step="feasibility" nextLabel="규정 검토" />
    </div>
  );
}
