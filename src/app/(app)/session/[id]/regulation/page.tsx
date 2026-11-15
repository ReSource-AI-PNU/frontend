import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import Link from "next/link";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { RegulationAsk } from "@/components/session/regulation-ask";
import { CONCLUSION_LABEL, RegulationReceipt, type ReceiptGroup } from "@/components/session/regulation-receipt";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { ORIGIN_LABEL } from "@/components/session/stream-badges";
import { buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { EmptyState } from "@/components/ui/empty-state";
import { goToStep } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import type { StreamRoute } from "@/lib/session/types";
import { answerRegulationQuestion } from "./actions";

export const metadata: Metadata = { title: "규정 검토" };

const TONE_BOX = { gain: "bg-gain-bg", warn: "bg-warn-bg", loss: "bg-loss-bg" } as const;

/** 경로별로 조항이 없을 때 쓰는 문장 */
const EMPTY_BY_ROUTE: Partial<Record<StreamRoute, string>> = {
  incinerate: "소각은 지금 위탁처와 맺은 계약을 그대로 씁니다. 새로 확인할 조항이 없습니다.",
};

/** "스프루·러너 · 공정 재투입"처럼 흐름 이름이 붙은 항목 이름에서, 흐름 머리말과 겹치는 앞부분을 뗀다 */
function stripStreamName(label: string, name: string) {
  const prefix = `${name} · `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

/** 이름 목록을 "A, B"로 잇는다 */
const joinNames = (names: string[]) => names.join(", ");

export default async function RegulationPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute params={params} step="regulation" />;
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const result = session.regulation;
  const firstItem = session.streams[0]?.classify.item ?? "폐플라스틱";
  const disagree = (
    <DisagreeDialog
      step="regulation"
      item={firstItem}
      sessionId={session.id}
      placeholder={{ condition: "예: 원자재 납품서에 포장 사양이 적혀 있지 않을 때", judgment: "예: 매입처가 입고 사진과 계량표로 출처 증빙을 대신 받았다" }}
    />
  );

  if (!result) {
    return (
      <div className="grid gap-6">
        <StepHeader step="regulation" title="규정 검토" aside={disagree} />
        <EmptyState
          title="아직 규정 검토를 하지 않았습니다."
          description="흐름마다 고른 경로(재투입·매각·단지 묶음 매각·열분해)가 규정상 가능한지, 순환자원 인정·PCR 출처 증빙·단지 내 순회 수거·위탁 업체 허가 범위를 조항과 함께 확인합니다. 앞 단계 결과가 없으면 함께 계산합니다."
          action={
            <div className="flex flex-wrap gap-2">
              <form action={goToStep.bind(null, session.id, "regulation")}>
                <button type="submit" className={buttonClass("primary")}>
                  규정 검토 실행
                </button>
              </form>
              <Link href={`/session/${session.id}/feasibility`} className={buttonClass("ghost")}>
                경로 판정으로 돌아가기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const decisions = session.feasibility?.decisions ?? [];
  const routeOf = new Map(decisions.map((d) => [d.streamId, d.route]));
  const questions = new Map(session.questions.map((q) => [q.id, q]));
  const streamIds = new Set(session.streams.map((s) => s.id));

  const groups: ReceiptGroup[] = session.streams.map((s) => {
    const route = routeOf.get(s.id);
    const items = result.items.filter((i) => i.streamId === s.id).map((i) => ({ ...i, label: stripStreamName(i.label, s.name) }));
    // 흐름별 PCR 출처 증빙 질문: 그 흐름에 출처 증빙 항목이 있을 때만 묻는다
    const pcrQuestion = questions.get(`pcr-proof:${s.id}`);
    const showPcr = pcrQuestion && items.some((i) => i.id === `pcr:${s.id}`);
    return {
      key: s.id,
      title: s.name,
      meta: [s.process, ORIGIN_LABEL[s.origin].short].filter(Boolean).join(" · "),
      route,
      items,
      empty: route ? EMPTY_BY_ROUTE[route] : undefined,
      ask: showPcr ? (
        <RegulationAsk
          question={pcrQuestion}
          action={answerRegulationQuestion.bind(null, session.id, pcrQuestion.id)}
          hint="입고 기록이 있으면 사용 후(PCR) 재생원료로, 없으면 일반 재생원료로 팝니다. 답하면 이 흐름의 출처 증빙 항목과 결론을 다시 검토합니다."
        />
      ) : undefined,
    };
  });
  // 흐름에 묶이지 않은 항목(공장 전체에 걸리는 조항)
  const loose = result.items.filter((i) => !i.streamId || !streamIds.has(i.streamId));
  if (loose.length) groups.unshift({ key: "factory", title: "공장 전체", items: loose });

  // 공장 공통 질문(성분분석표): 순환자원 인정 항목이 있을 때만 묻는다
  const analysis = questions.get("analysis");
  const showAnalysis = analysis && result.items.some((i) => i.id.startsWith("circular:"));

  const hasAsk = result.items.some((i) => i.status === "ask");
  const tone = result.conclusion.tone;
  const nameOf = new Map(session.streams.map((s) => [s.id, s.name]));
  const namesFor = (route: StreamRoute) => decisions.filter((d) => d.route === route).map((d) => nameOf.get(d.streamId) ?? "흐름");
  const bundleNames = namesFor("bundle");
  const sellNames = namesFor("sell");
  const pyroNames = namesFor("pyrolysis");
  const noProof = session.streams.filter((s) => routeOf.get(s.id) === "bundle" && questions.get(`pcr-proof:${s.id}`)?.answer === "없음").map((s) => s.name);

  return (
    <div>
      <StepHeader
        step="regulation"
        title="규정 검토"
        description={`흐름 ${session.streams.length}개마다 고른 경로가 규정상 가능한지 법령 조항을 인용해 확인했습니다.`}
        aside={disagree}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RegulationReceipt
            result={result}
            groups={groups}
            note="공정 부산물(PIR)은 재생원료 사용 의무 실적에 들어가지 않고, 사용 후 원료(PCR)만 인정됩니다. 그래서 공장이 쓰고 버린 포장재에만 출처 증빙을 묻습니다."
            common={
              showAnalysis ? (
                <RegulationAsk
                  question={analysis}
                  action={answerRegulationQuestion.bind(null, session.id, analysis.id)}
                  hint="답하면 매각 흐름의 순환자원 인정 항목과 결론을 다시 검토합니다."
                />
              ) : undefined
            }
          />
        </div>

        <aside className="grid content-start gap-6 lg:col-span-5">
          <section aria-labelledby="regulation-conclusion" className={`rounded-lg px-5 py-4 ${TONE_BOX[tone]}`}>
            <p className="text-label text-muted">결론 · {CONCLUSION_LABEL[tone]}</p>
            <h2 id="regulation-conclusion" className="mt-1 text-h2">
              {result.conclusion.text}
            </h2>
          </section>

          <section aria-labelledby="regulation-next" className="border-t border-line pt-2">
            <h2 id="regulation-next" className="sr-only">
              다음 단계에 미치는 영향
            </h2>
            <MoreDetails label="다음 단계에 미치는 영향 보기" closeLabel="다음 단계에 미치는 영향 접기">
              <ul className="mt-2 grid list-disc gap-2 pl-4 text-sm text-ink-2 marker:text-muted">
                {bundleNames.length ? (
                  <li>
                    {joinNames(bundleNames)}은(는) 다음 단계에서 같은 단지 기업과 순회 수거로 묶습니다. 각 사업장이 수거 업체와 따로 계약하므로 공동처리 신고는
                    필요하지 않습니다.
                  </li>
                ) : null}
                {noProof.length ? (
                  <li>{joinNames(noProof)}은(는) 입고 기록이 없어 사용 후(PCR) 원료가 아닌 일반 재생원료로 팝니다.</li>
                ) : null}
                {sellNames.length ? <li>{joinNames(sellNames)}의 매입처가 폐합성수지 재활용 허가를 가졌는지 매칭 단계에서 다시 확인합니다.</li> : null}
                {pyroNames.length ? <li>{joinNames(pyroNames)}은(는) 열분해 재활용 허가를 가진 업체를 찾습니다.</li> : null}
                {hasAsk ? <li>확인이 필요한 항목은 되묻기에 답하면 다시 검토합니다. 답하지 않으면 보수적인 조건으로 계산합니다.</li> : null}
              </ul>
            </MoreDetails>
          </section>

          <p className="border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
            법령명과 조문 요지는 시연용으로 요약한 것입니다. 공장 포장재를 PCR로 인정하는지는 해석 확인이 필요합니다. 실제 신고나 인정 신청 전에는
            국가법령정보센터의 현행 조문과 관할 기관의 안내로 확인해 주세요.
          </p>
        </aside>
      </div>

      <StepFooter sessionId={session.id} step="regulation" nextLabel="거래처와 묶음 찾기" />
    </div>
  );
}
