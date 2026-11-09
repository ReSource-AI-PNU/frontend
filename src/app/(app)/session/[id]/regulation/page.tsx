import type { Metadata } from "next";
import Link from "next/link";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { RegulationAsk } from "@/components/session/regulation-ask";
import { CONCLUSION_LABEL, RegulationReceipt } from "@/components/session/regulation-receipt";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { answerRegulationQuestion } from "./actions";

export const metadata: Metadata = { title: "규정 검토" };

const TONE_BOX = { gain: "bg-gain-bg", warn: "bg-warn-bg", loss: "bg-loss-bg" } as const;

export default async function RegulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const result = session.regulation;

  if (!result) {
    return (
      <div className="grid gap-6">
        <StepHeader step="regulation" title="규정 검토" />
        <EmptyState
          title="아직 규정 검토를 하지 않았습니다."
          description="판정 결과를 바탕으로 순환자원 지정·인정, 공동처리, 유해물질 기준을 차례로 확인합니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "regulation")}>
                <button type="submit" className={buttonClass("primary")}>
                  규정 검토 실행
                </button>
              </form>
              <Link href={`/session/${session.id}/feasibility`} className={buttonClass("ghost")}>
                판정으로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const question = session.questions.find((q) => q.step === "regulation" && q.id === "analysis");
  const hasAsk = result.items.some((i) => i.status === "ask");
  const showAsk = question && (hasAsk || question.answer);
  const tone = result.conclusion.tone;

  return (
    <div>
      <StepHeader
        step="regulation"
        title="규정 검토"
        description="이 폐기물을 어떤 제도로 처리할 수 있는지 법령 조항을 인용해 확인했습니다."
        aside={
          <DisagreeDialog
            step="regulation"
            item={session.classify.item}
            sessionId={session.id}
            placeholder={{ condition: "예: 같은 품목을 관할 구청에 공동처리 신고했을 때", judgment: "예: 운영기구 규약 사본을 먼저 요구했다" }}
          />
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RegulationReceipt
            result={result}
            ask={showAsk ? <RegulationAsk question={question} action={answerRegulationQuestion.bind(null, session.id, question.id)} /> : null}
          />
        </div>

        <aside className="grid content-start gap-6 lg:col-span-5">
          <section aria-labelledby="regulation-conclusion" className={`rounded-lg px-5 py-4 ${TONE_BOX[tone]}`}>
            <p className="text-label text-muted">결론 · {CONCLUSION_LABEL[tone]}</p>
            <h2 id="regulation-conclusion" className="mt-1 text-h2">
              {result.conclusion.text}
            </h2>
          </section>

          <section aria-labelledby="regulation-next" className="border-t border-line pt-4">
            <h2 id="regulation-next" className="text-label text-muted">
              다음 단계에 미치는 영향
            </h2>
            <ul className="mt-2 grid gap-2 text-sm text-ink-2">
              {result.items.some((i) => i.id === "joint" && i.status === "ok") ? (
                <li>공동처리가 가능하므로, 다음 단계에서 같은 단지 기업과 묶음 수거를 찾습니다.</li>
              ) : null}
              {tone === "gain" ? (
                <li>순환자원 인정을 받으면 폐기물 규제에서 벗어나 일반 원료처럼 거래할 수 있습니다.</li>
              ) : (
                <li>인정 전까지는 폐기물 처리 허가를 가진 업체에만 맡길 수 있습니다. 매칭 단계에서 허가 품목을 확인합니다.</li>
              )}
              {hasAsk ? <li>확인이 필요한 항목은 되묻기에 답하면 다시 검토합니다.</li> : null}
            </ul>
          </section>

          <p className="border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
            법령명과 조문 요지는 시연용으로 요약한 것입니다. 실제 신고나 인정 신청 전에는 국가법령정보센터의 현행 조문과 관할 기관의 안내로 확인해
            주세요.
          </p>
        </aside>
      </div>

      <StepFooter sessionId={session.id} step="regulation" nextLabel="묶음 수거 찾기" />
    </div>
  );
}
