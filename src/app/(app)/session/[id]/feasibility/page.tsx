import type { Metadata } from "next";
import Link from "next/link";
import { InfoIcon } from "@/components/icons";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { FeasibilityLadder } from "@/components/session/feasibility-ladder";
import { SessionPhoto } from "@/components/session/session-photo";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { OriginChip, RouteBadge } from "@/components/session/stream-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlipNumber } from "@/components/verdict/flip-number";
import { formatNumber, formatSigned } from "@/lib/format";
import { goToStep, setStreamRoute } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

export const metadata: Metadata = { title: "경로 판정" };

export default async function FeasibilityPage({ params, searchParams }: PageProps<"/session/[id]/feasibility">) {
  const { id } = await params;
  const sp = await searchParams;
  const { session } = await getSessionForCurrentOrg(id);
  const f = session.feasibility;

  if (!f) {
    return (
      <EmptyState
        title="아직 경로를 판정하지 않았습니다"
        description="흐름별 재질·출처·이물·발생량을 바탕으로 공정 재투입, 매각, 단지 묶음 매각, 열분해, 소각 중 갈 곳을 고릅니다."
        action={
          <form action={goToStep.bind(null, session.id, "feasibility")}>
            <button type="submit" className={buttonClass("primary")}>
              경로 판정하기
            </button>
          </form>
        }
      />
    );
  }

  const byStream = new Map(session.streams.map((s) => [s.id, s]));
  const pick = Array.isArray(sp.s) ? sp.s[0] : sp.s;
  const focus = f.decisions.find((d) => d.streamId === pick) ?? f.decisions.find((d) => d.route !== "reuse") ?? f.decisions[0];
  const focusStream = byStream.get(focus.streamId)!;
  const diff = f.totalAfter - f.totalNow;
  const totalKg = session.streams.reduce((a, s) => a + s.monthlyKg, 0);

  return (
    <div className="grid gap-8">
      <StepHeader
        step="feasibility"
        title="흐름별 경로 판정"
        description={`${session.streams.length}개 흐름 · 월 ${formatNumber(totalKg)}kg. 지금은 모두 혼합 소각으로 위탁한다고 보고, 흐름마다 공장에 가장 이로운 갈 곳을 골랐습니다.`}
        aside={<DisagreeDialog step="feasibility" item={focusStream.classify.item} sessionId={session.id} placeholder={{ condition: "예: 색 교체 퍼지에 PVC가 섞일 때", judgment: "예: 열분해 대신 소각으로 보낸다" }} />}
      />

      <section aria-labelledby="total-title" className="grid gap-6 border-y border-line py-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <Badge tone="ai">AI 진단 결과</Badge>
          <h2 id="total-title" className="mt-3 text-[26px] leading-[1.3] font-[750] tracking-[-0.03em]">
            흐름만 나눠도, 공장의 폐플라스틱이 수익이 됩니다.
          </h2>
          <div className="mt-5 flex items-baseline justify-between text-[13px] text-muted">
            <span>공장 월 손익</span>
            <span className="num text-loss line-through decoration-1">{formatSigned(f.totalNow)} 원/월</span>
          </div>
          <FlipNumber from={f.totalNow} to={f.totalAfter} unit="원/월" className="mt-2 text-[52px]" />
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-center text-sm">
          <dt className="border-b border-line py-2.5 pr-6 text-muted">월 개선</dt>
          <dd className={`num border-b border-line py-2.5 text-right font-semibold ${diff >= 0 ? "text-gain" : "text-loss"}`}>{formatSigned(diff)}원</dd>
          <dt className="border-b border-line py-2.5 pr-6 text-muted">연 환산</dt>
          <dd className={`num border-b border-line py-2.5 text-right ${diff >= 0 ? "text-gain" : "text-loss"}`}>{formatSigned(diff * 12)}원</dd>
          <dt className="border-b border-line py-2.5 pr-6 text-muted">탄소 (tCO₂e/월)</dt>
          <dd className="num border-b border-line py-2.5 text-right">
            {formatSigned(f.carbonNowT, 2)} → <b className={f.carbonAfterT < 0 ? "text-gain" : ""}>{formatSigned(f.carbonAfterT, 2)}</b>
          </dd>
          <dt className="border-b border-line py-2.5 pr-6 text-muted">소각으로 가던 양</dt>
          <dd className="num border-b border-line py-2.5 text-right">
            {formatNumber(totalKg)}kg → {formatNumber(f.decisions.filter((d) => d.route === "incinerate").reduce((a, d) => a + (byStream.get(d.streamId)?.monthlyKg ?? 0), 0))}kg
          </dd>
        </dl>
      </section>

      <section aria-labelledby="map-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="map-title" className="text-h2">
            흐름 지도
          </h2>
          <p className="text-[13px] text-muted">경로를 바꾸면 기록이 남고, 검수를 거쳐 다음 진단에 반영됩니다.</p>
        </div>
        <ol className="mt-3 border-t border-ink">
          {f.decisions.map((d) => {
            const s = byStream.get(d.streamId)!;
            return (
              <li key={d.streamId} className="grid gap-4 border-b border-line py-5 lg:grid-cols-[200px_minmax(0,1fr)_200px]">
                <div className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
                    <SessionPhoto media={s.media[0]} compact className="aspect-square! rounded-md" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-[12px] text-muted">
                      <span className="num">{s.classify.material}</span> · <span className="num">{formatNumber(s.monthlyKg)}</span>kg/월
                    </p>
                    <div className="mt-1.5">
                      <OriginChip origin={s.origin} source={s.originSource} />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RouteBadge route={d.route} />
                    {d.aiRoute ? (
                      <span className="text-[12px] text-muted">
                        담당자 변경 · AI 추천은 <span className="line-through">{STREAM_ROUTE_LABEL[d.aiRoute]}</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm">{d.reason}</p>
                  {d.action ? (
                    <p className="mt-1 text-[13px] text-ink-2">
                      할 일: <b className="font-semibold">{d.action.title}</b> · 월 <span className="num">{d.action.laborHours}</span>시간
                    </p>
                  ) : null}
                  <details className="mt-2 text-[13px]">
                    <summary className="cursor-pointer text-muted">다른 경로 {d.alternatives.length}개</summary>
                    <ul className="mt-2 grid gap-1.5">
                      {d.alternatives.map((a) => (
                        <li key={a.route} className="flex flex-wrap items-center gap-2">
                          <RouteBadge route={a.route} size="sm" />
                          <span className="num">{formatSigned(a.perKg)}원/kg</span>
                          <span className="text-muted">{a.note}</span>
                          {session.approval ? null : (
                            <form action={setStreamRoute.bind(null, session.id, d.streamId, a.route)}>
                              <button type="submit" className="h-7 rounded-sm px-2 text-[12px] font-semibold underline underline-offset-2 hover:bg-sunken">
                                이 경로로 바꾸기
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <dl className="grid content-start gap-1 text-right text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">지금</dt>
                    <dd className="num text-loss">{formatSigned(d.monthlyNow)}원</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">바꾸면</dt>
                    <dd className={`num text-[15px] font-semibold ${d.monthlyAfter >= 0 ? "text-gain" : "text-loss"}`}>{formatSigned(d.monthlyAfter)}원</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">kg당</dt>
                    <dd className="num">
                      {formatSigned(d.currentPerKg)} → {formatSigned(d.afterPerKg)}
                    </dd>
                  </div>
                  <Link href={`/session/${session.id}/feasibility?s=${d.streamId}#ladder-title`} scroll={false} className="mt-1 text-[12px] font-semibold underline underline-offset-2">
                    단계별 손익 보기
                  </Link>
                </dl>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="ladder-title">
          <h2 id="ladder-title" className="text-h2">
            {focusStream.name} · 단계별 kg당 손익
          </h2>
          <p className="mt-1 text-sm text-muted">무엇을 하면 어디서부터 돈이 되는지 보여 줍니다. 단가는 시연용 가정값입니다.</p>
          <div className="mt-4">
            <FeasibilityLadder ladder={focus.ladder} />
          </div>
        </section>

        <section aria-labelledby="reason-title">
          <h2 id="reason-title" className="text-h2">
            판정 근거
          </h2>
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
          <p className="mt-3 flex items-start gap-2 rounded-md bg-sunken px-3.5 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
            <InfoIcon />
            {f.note}
          </p>
        </section>
      </div>

      <StepFooter sessionId={session.id} step="feasibility" nextLabel="규정 검토" />
    </div>
  );
}
