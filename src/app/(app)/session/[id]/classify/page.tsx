import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DetectionEditor } from "@/components/session/detection-editor";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { QuestionCard } from "@/components/session/question-card";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { formatNumber } from "@/lib/format";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "식별 결과" };

export default async function ClassifyPage({ params }: PageProps<"/session/[id]/classify">) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  if (session.status === "analyzing") redirect(`/session/${id}/analyzing`);
  const c = session.classify;
  const questions = session.questions.filter((q) => q.step === "classify");
  const unanswered = questions.filter((q) => !q.answer).length;
  const contamination = c.detections.filter((d) => d.kind === "contaminant" && !d.removed).reduce((s, d) => s + (d.ratio ?? 0), 0);

  const stats = [
    { k: "품목", v: `${c.item} · ${c.detail}` },
    { k: "신뢰도", v: c.confidence.toFixed(2), num: true },
    { k: "이물질 합계", v: `${Math.round(contamination * 100)}%`, num: true },
    { k: "추정 부피 환산", v: `${formatNumber(c.estimatedKg)}kg`, num: true },
    { k: "분석", v: `프레임 ${c.frames}장 · ${(c.durationMs / 1000).toFixed(1)}초`, num: false },
    { k: "모델", v: `${c.model.name} ${c.model.version}`, num: true },
  ];

  return (
    <div className="grid gap-8">
      <StepHeader
        step="classify"
        title="식별 결과"
        description="AI가 그린 박스가 틀렸으면 직접 고쳐 주세요. 고친 내용은 검수를 거쳐 모델을 다시 학습하는 데 쓰입니다."
        aside={<DisagreeDialog step="classify" item={c.item} sessionId={session.id} placeholder={{ condition: "예: 베일 표면에 광택 나는 띠", judgment: "예: 투명 테이프로 본다" }} />}
      />

      <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.k} className="border-line py-3 pr-4 xl:border-l xl:pl-4 xl:first:border-l-0 xl:first:pl-0">
            <dt className="text-[12px] text-muted">{s.k}</dt>
            <dd className={`mt-0.5 text-sm font-semibold ${s.num ? "num" : ""}`}>{s.v}</dd>
          </div>
        ))}
      </dl>

      <DetectionEditor sessionId={session.id} media={session.media[0]} item={c.item} initial={c.detections} />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="ask-title">
          <div className="flex items-baseline justify-between">
            <h2 id="ask-title" className="text-h2">
              에이전트의 질문
            </h2>
            <span className="text-[13px] text-muted">{unanswered > 0 ? `${unanswered}개 남음` : "모두 답함"}</span>
          </div>
          <p className="mt-1 text-sm text-muted">사진만으로는 알 수 없는 정보입니다. 답하면 판정과 손익 계산이 정확해집니다.</p>
          <div className="mt-3 border-t border-line">
            {questions.map((q) => (
              <QuestionCard key={q.id} sessionId={session.id} q={q} />
            ))}
          </div>
        </section>

        <section aria-labelledby="corr-title">
          <h2 id="corr-title" className="text-h2">
            수정 기록
          </h2>
          <p className="mt-1 text-sm text-muted">사람이 고친 내용은 먹색으로 남고, AI 원래 값은 지워지지 않습니다.</p>
          {session.corrections.length === 0 ? (
            <p className="mt-3 border-t border-line pt-4 text-sm text-muted">아직 고친 내용이 없습니다.</p>
          ) : (
            <ol className="mt-3 border-t border-line">
              {[...session.corrections].reverse().map((cor) => (
                <li key={cor.id} className="grid gap-0.5 border-b border-line py-3 text-sm">
                  <p className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{cor.field}</span>
                    <span className="num text-[12px] text-muted">{new Date(cor.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                  <p className="text-[13px]">
                    <span className="text-muted line-through">{cor.before}</span> → <span className="font-semibold">{cor.after}</span>
                  </p>
                  {cor.rationale ? <p className="text-[13px] text-ink-2">이유: {cor.rationale}</p> : null}
                  <p className="text-[12px] text-muted">
                    {cor.by}
                    {cor.knowledgeCardId ? " · 현장 지식 카드로 남김" : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <StepFooter
        sessionId={session.id}
        step="classify"
        nextLabel="판정 보기"
        disabled={unanswered > 0}
        disabledHint={unanswered > 0 ? "질문에 답하면 다음으로 넘어갑니다." : undefined}
      />
    </div>
  );
}
