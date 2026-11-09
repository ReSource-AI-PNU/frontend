import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { DetectionEditor } from "@/components/session/detection-editor";
import { DisagreeDialog } from "@/components/session/disagree-dialog";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { ORIGIN_LABEL, OriginChip } from "@/components/session/stream-badges";
import { buttonClass } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { confirmAllVolumes, setStreamOrigin, setStreamVolume } from "@/lib/server/session-actions";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import type { StreamOrigin } from "@/lib/session/types";

export const metadata: Metadata = { title: "흐름 식별" };

export default async function ClassifyPage({ params, searchParams }: PageProps<"/session/[id]/classify">) {
  const { id } = await params;
  const sp = await searchParams;
  const { session } = await getSessionForCurrentOrg(id);
  if (session.status === "analyzing") redirect(`/session/${id}/analyzing`);
  const pick = Array.isArray(sp.s) ? sp.s[0] : sp.s;
  const stream = session.streams.find((x) => x.id === pick) ?? session.streams[0];
  const c = stream.classify;
  const unconfirmed = session.streams.filter((x) => !x.monthlyKgConfirmed).length;
  const contamination = c.detections.filter((d) => d.kind === "contaminant" && !d.removed).reduce((s, d) => s + (d.ratio ?? 0), 0);
  const corrections = session.corrections.filter((x) => x.streamId === stream.id);

  const stats = [
    { k: "재질", v: c.material, num: true },
    { k: "단일 재질", v: c.singleMaterial ? "예" : "아니요(혼합)" },
    { k: "이물 합계", v: `${Math.round(contamination * 100)}%`, num: true },
    { k: "신뢰도", v: c.confidence.toFixed(2), num: true },
    { k: "모델", v: `${c.model.name} ${c.model.version}`, num: true },
  ];

  return (
    <div className="grid gap-8">
      <StepHeader
        step="classify"
        title="흐름 식별"
        description="공장의 폐플라스틱을 흐름별로 확인합니다. AI가 그린 박스와 출처 판정이 틀렸으면 직접 고쳐 주세요. 고친 내용은 검수를 거쳐 다시 학습하는 데 쓰입니다."
        aside={<DisagreeDialog step="classify" item={c.item} sessionId={session.id} placeholder={{ condition: "예: 퍼지 덩어리에 검은 줄무늬가 보일 때", judgment: "예: ABS 혼입으로 본다" }} />}
      />

      <nav aria-label="흐름 선택" className="-mb-2 overflow-x-auto">
        <ul className="flex min-w-max gap-2">
          {session.streams.map((x, i) => {
            const active = x.id === stream.id;
            return (
              <li key={x.id}>
                <Link
                  href={`/session/${session.id}/classify?s=${x.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-left transition-colors hover:border-ink aria-[current=page]:border-ink aria-[current=page]:shadow-[inset_0_-3px_0_var(--color-ink)]"
                >
                  <span className="num text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block text-sm font-semibold">{x.name}</span>
                    <span className="block text-[12px] text-muted">
                      <span className="num">{x.classify.material}</span> · {x.origin} · <span className="num">{formatNumber(x.monthlyKg)}</span>kg
                    </span>
                  </span>
                  {x.monthlyKgConfirmed ? (
                    <span className="grid size-5 place-items-center rounded-full bg-ink text-on-ink [&_svg]:size-3" aria-label="발생량 확정">
                      <CheckIcon />
                    </span>
                  ) : (
                    <span className="size-2 rounded-full bg-marker shadow-[0_0_0_1px_var(--color-ink)]" aria-label="발생량 확정 필요" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="stream-title" className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="stream-title" className="text-h2">
              {stream.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {c.detail} · {stream.process || "공정 미지정"}
            </p>
          </div>
          <OriginChip origin={stream.origin} source={stream.originSource} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <p className="text-sm font-semibold">출처</p>
            <p className="mt-0.5 text-[13px] text-muted">
              재생원료 사용 의무는 사용 후(PCR) 원료만 인정하고 공정 부산물(PIR)은 제외합니다. 같은 재질이라도 출처에 따라 팔 수 있는 곳이 달라집니다.
            </p>
            <div className="mt-3 inline-flex rounded-md bg-sunken p-[3px]" role="group" aria-label="출처 선택">
              {(["PIR", "PCR"] as StreamOrigin[]).map((o) => (
                <form key={o} action={setStreamOrigin.bind(null, session.id, stream.id, o)}>
                  <button
                    type="submit"
                    aria-pressed={stream.origin === o}
                    disabled={stream.origin === o}
                    className="h-9 rounded-sm px-3.5 text-[13px] text-muted aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-ink aria-pressed:shadow-[0_1px_0_var(--color-line-strong)] enabled:hover:text-ink"
                  >
                    {ORIGIN_LABEL[o].short}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">{stream.originSource === "ai" ? "AI 판정입니다. 다르면 바꿔 주세요." : "담당자가 지정했습니다."}</p>
          </div>

          <div className="rounded-lg border border-line p-4">
            <p className="text-sm font-semibold">월 발생량</p>
            <p className="mt-0.5 text-[13px] text-muted">사진으로는 부피만 알 수 있습니다. 실제 양을 확정해 주세요. 묶음 수거와 손익 계산의 기준이 됩니다.</p>
            <form action={setStreamVolume.bind(null, session.id, stream.id)} className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  key={`${stream.id}-${stream.monthlyKg}`}
                  name="kg"
                  inputMode="numeric"
                  defaultValue={stream.monthlyKg}
                  aria-label={`${stream.name} 월 발생량`}
                  className="num h-10 w-36 rounded-md border border-line-strong bg-surface pr-14 pl-3 text-right text-[15px] focus:border-ink focus:outline-none"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">kg/월</span>
              </div>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                {stream.monthlyKgConfirmed ? "바꾸기" : "확정"}
              </button>
              {stream.monthlyKgConfirmed ? (
                <span className="text-[13px] text-gain">확정했습니다.</span>
              ) : (
                <span className="rounded-full bg-marker px-2.5 py-1 text-[12px] font-semibold text-marker-ink">AI 추정 · 확정 필요</span>
              )}
            </form>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.k} className="border-line py-3 pr-4 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
              <dt className="text-[12px] text-muted">{s.k}</dt>
              <dd className={`mt-0.5 text-sm font-semibold ${s.num ? "num" : ""}`}>{s.v}</dd>
            </div>
          ))}
        </dl>

        <DetectionEditor key={stream.id} sessionId={session.id} streamId={stream.id} media={stream.media[0]} item={c.item} initial={c.detections} />

        <section aria-labelledby="corr-title">
          <h3 id="corr-title" className="text-sm font-semibold">
            이 흐름의 수정 기록
          </h3>
          {corrections.length === 0 ? (
            <p className="mt-2 border-t border-line pt-3 text-sm text-muted">아직 고친 내용이 없습니다. 사람이 고친 내용은 검정으로 남고, AI 원래 값은 지워지지 않습니다.</p>
          ) : (
            <ol className="mt-2 border-t border-line">
              {[...corrections].reverse().map((cor) => (
                <li key={cor.id} className="grid gap-0.5 border-b border-line py-3 text-sm">
                  <p className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{cor.field}</span>
                    <span className="num text-[12px] text-muted">
                      {new Date(cor.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
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
      </section>

      <StepFooter
        sessionId={session.id}
        step="classify"
        nextLabel="흐름별 경로 판정"
        disabled={unconfirmed > 0}
        disabledHint={unconfirmed > 0 ? `발생량을 확정하지 않은 흐름이 ${unconfirmed}개 있습니다.` : undefined}
        extra={
          unconfirmed > 0 ? (
            <form action={confirmAllVolumes.bind(null, session.id)}>
              <button type="submit" className={buttonClass("ghost", "sm")}>
                추정값으로 모두 확정
              </button>
            </form>
          ) : null
        }
      />
    </div>
  );
}
