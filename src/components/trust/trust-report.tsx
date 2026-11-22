"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/v3/status-chip";
import { api } from "@/lib/v3/api";
import { toTrustView, type TrustLayer, type TrustMetric, type TrustView } from "@/lib/trust";

type Loaded = { status: "loading" } | { status: "error" } | { status: "ready"; view: TrustView };

function Verdict({ metric }: { metric: TrustMetric }) {
  if (metric.verdict === "met") return <StatusChip tone="done">목표 달성</StatusChip>;
  if (metric.verdict === "unmet") return <StatusChip tone="stop">목표 미달</StatusChip>;
  if (metric.verdict === "unmeasured") return <StatusChip tone="neutral">미측정</StatusChip>;
  return null;
}

/** 값: 숫자는 Mono, 값이 없으면 "미측정"(숫자를 지어내지 않는다) */
function Value({ metric, size }: { metric: TrustMetric; size: "lg" | "md" | "sm" }) {
  const cls = size === "lg" ? "text-[32px] leading-none" : size === "md" ? "text-[24px] leading-none" : "text-[15px]";
  if (metric.value === null) return <span className={`${size === "sm" ? "text-[15px]" : "text-[20px] leading-none"} font-semibold text-muted`}>미측정</span>;
  return <span className={`num font-semibold ${cls}`}>{metric.display}</span>;
}

/** 표본이 작은 비율 지표에 붙이는 말 */
const SMALL_NOTE = "표본이 작아 구간이 넓습니다";

/** n · 신뢰구간 · 목표를 한 줄로. 표본이 작은 비율이거나 구간의 폭이 0이면 그 아래에 한 줄 더 */
function Facts({ metric }: { metric: TrustMetric }) {
  const parts = [
    metric.n !== null ? <span key="n">n = <span className="num">{metric.n}</span></span> : null,
    metric.ci ? <span key="ci">{metric.ci}</span> : null,
    metric.target ? <span key="t">{metric.target}</span> : null,
  ].filter(Boolean);
  if (parts.length === 0 && !metric.smallSample && !metric.intervalNote) return null;
  return (
    <div className="text-[12px] text-muted">
      {parts.length > 0 ? (
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          {parts.map((part, index) => (
            <span key={index} className="flex gap-x-2.5">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}
      {metric.intervalNote ? <p className="mt-0.5">{metric.intervalNote}</p> : null}
      {metric.smallSample ? <p className="mt-0.5">{SMALL_NOTE}</p> : null}
    </div>
  );
}

/** 무엇을 재는지 한 줄 */
function Explain({ metric, className = "" }: { metric: TrustMetric; className?: string }) {
  return metric.explain ? <p className={`text-[13px] leading-snug text-muted ${className}`}>{metric.explain}</p> : null;
}

function Tile({ metric }: { metric: TrustMetric }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-line-strong pt-4">
      <div>
        <p className="text-[14px] leading-snug text-ink-2">{metric.label}</p>
        <Explain metric={metric} className="mt-0.5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Value metric={metric} size="lg" />
        <Verdict metric={metric} />
      </div>
      <Facts metric={metric} />
    </div>
  );
}

function MetricTable({ metrics }: { metrics: TrustMetric[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-ground text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">지표</th>
            <th className="px-3 py-2 font-medium">값</th>
            <th className="px-3 py-2 font-medium">95% 신뢰구간</th>
            <th className="px-3 py-2 font-medium">n</th>
            <th className="px-3 py-2 font-medium">목표</th>
            <th className="px-3 py-2 font-medium">판정</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {metrics.map((metric, index) => (
            <tr key={`${metric.key}-${index}`} className="align-top">
              <td className="px-3 py-2 text-ink-2">
                {metric.label}
                {metric.explain ? <span className="mt-0.5 block text-[12px] leading-snug text-muted">{metric.explain}</span> : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{metric.value === null ? <span className="text-muted">미측정</span> : <span className="num">{metric.display}</span>}</td>
              <td className="px-3 py-2 text-muted">
                {metric.ci ? (
                  <span className="whitespace-nowrap">{metric.ci.replace("95% 신뢰구간 ", "")}</span>
                ) : metric.intervalNote ? (
                  <span className="block text-[12px] leading-snug">{metric.intervalNote}</span>
                ) : null}
                {metric.smallSample ? <span className="mt-0.5 block text-[12px]">{SMALL_NOTE}</span> : null}
              </td>
              <td className="px-3 py-2 text-muted">{metric.n !== null ? <span className="num">{metric.n}</span> : null}</td>
              <td className="px-3 py-2 whitespace-nowrap text-muted">{metric.target?.replace("목표 ", "") ?? null}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {metric.verdict === "met" ? "달성" : metric.verdict === "unmet" ? <span className="font-semibold text-loss">미달</span> : metric.verdict === "unmeasured" ? <span className="text-muted">미측정</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Layer({ layer }: { layer: TrustLayer }) {
  return (
    <section aria-labelledby={`layer-${layer.id}`} className="border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`layer-${layer.id}`} className="text-[20px] font-semibold tracking-[-0.02em]">
          {layer.title}
        </h3>
        {layer.size ? <span className="text-[13px] text-muted">{layer.size}</span> : null}
        {layer.status === "partial" ? <StatusChip tone="neutral">일부만 잼</StatusChip> : null}
        {layer.status === "not_measured" ? <StatusChip tone="neutral">미측정</StatusChip> : null}
      </div>
      <p className="mt-1.5 text-[15px] text-ink-2">{layer.explain}</p>

      {layer.key ? (
        <div className="mt-4 flex flex-col gap-2">
          <div>
            <p className="text-[14px] text-ink-2">{layer.key.label}</p>
            <Explain metric={layer.key} className="mt-0.5" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Value metric={layer.key} size="md" />
            <Verdict metric={layer.key} />
          </div>
          <Facts metric={layer.key} />
        </div>
      ) : null}

      {layer.more.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {layer.more.map((metric) => (
            <li key={metric.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-ink-2">{metric.label}</span>
                {metric.explain ? <span className="mt-0.5 block text-[12px] leading-snug text-muted">{metric.explain}</span> : null}
              </span>
              <Value metric={metric} size="sm" />
              <span className="w-full text-[12px] text-muted sm:w-auto">
                {[metric.target, metric.verdict === "met" ? "달성" : metric.verdict === "unmet" ? "미달" : null, metric.smallSample ? SMALL_NOTE : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <MoreDetails className="mt-2" hint={`지표 ${layer.all.length}개`}>
        <MetricTable metrics={layer.all} />
        {layer.notes.length > 0 ? (
          <div className="mt-3">
            <p className="text-[13px] font-medium text-ink-2">재지 못한 것</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted">
              {layer.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </MoreDetails>
    </section>
  );
}

function Report({ view }: { view: TrustView }) {
  const meta = [
    `평가일 ${view.date}`,
    view.aiVersion,
    view.split,
    view.scenarios !== null ? `시나리오 ${view.scenarios}건` : null,
    view.repeats !== null ? `시나리오마다 ${view.repeats}번 실행` : null,
    "가상 사례",
    view.reviewState,
  ].filter((item): item is string => Boolean(item));
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-muted">{meta.join(" · ")}</p>
        {view.stale ? <StatusChip tone="warn">오래된 결과</StatusChip> : null}
      </div>
      {view.retired.map((item) => (
        <p key={`${item.date}-${item.reason}`} className="mt-1 text-[13px] text-muted">
          앞서 공개한 결과{item.date ? `(${item.date})` : ""}는 내렸습니다. {item.reason}
        </p>
      ))}

      {!view.isModel ? (
        <p className="mt-6 rounded-xl border border-line bg-ground px-4 py-3.5 text-[15px] text-ink-2">
          이번 결과는 <span className="font-semibold text-ink">AI 모델을 연결하지 않은 채</span> 정해 둔 규칙으로 돌린 시험입니다. 근거 확인과
          안전장치가 제대로 막는지 보는 결과이고, AI 모델의 성적이 아닙니다.
        </p>
      ) : null}

      <section aria-labelledby="trust-headline" className="mt-10">
        <h2 id="trust-headline" className="sr-only">
          한눈에 보기
        </h2>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {view.headline.map((metric) => (
            <Tile key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      <section aria-labelledby="trust-layers" className="mt-16">
        <h2 id="trust-layers" className="text-[22px] font-semibold tracking-[-0.025em]">
          무엇을 어떻게 쟀나요
        </h2>
        <p className="mt-1.5 text-[15px] text-ink-2">AI가 하는 일을 다섯 갈래로 나눠 갈래마다 따로 쟀습니다. 주요 지표를 먼저 보이고, 모든 지표는 상세 보기에 둡니다.</p>
        <div className="mt-6 space-y-10">
          {view.layers.map((layer) => (
            <Layer key={layer.id} layer={layer} />
          ))}
        </div>
      </section>

      {view.pending.length > 0 ? (
        <section aria-labelledby="trust-pending" className="mt-16">
          <h2 id="trust-pending" className="text-[22px] font-semibold tracking-[-0.025em]">
            아직 재지 못한 것
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {view.pending.map((item) => (
              <li key={item.title} className="py-3.5">
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-[14px] text-ink-2">{item.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="trust-read" className="mt-16">
        <h2 id="trust-read" className="text-[22px] font-semibold tracking-[-0.025em]">
          숫자 읽는 법
        </h2>
        <dl className="mt-4 space-y-4 text-[15px]">
          <div>
            <dt className="font-medium">목표</dt>
            <dd className="text-ink-2">결과가 아니라 넘기로 정해 둔 선입니다. 못 미친 것도 그대로 적습니다.</dd>
          </div>
          <div>
            <dt className="font-medium">95% 신뢰구간과 n</dt>
            <dd className="text-ink-2">
              n은 잰 사례 수입니다. 같은 시험을 다시 해도 결과가 신뢰구간 안에 들 가능성이 높다는 뜻이고, 사례가 적을수록 구간이
              넓어집니다. 비율을 30건보다 적게 잰 곳에는 &ldquo;{SMALL_NOTE}&rdquo;라고 적었습니다.
              {view.ciNote ? <span className="mt-1 block text-[14px] text-muted">{view.ciNote}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium">가상 사례</dt>
            <dd className="text-ink-2">실제 회사가 아닌 가상의 공장과 업체로 만든 시험입니다. 기대값은 사람이 규칙에서 정했고, 시험셋은 만든 뒤 고치지 않습니다.</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

/** AI 신뢰도: 공개 평가 결과를 요약 먼저, 상세는 펼쳐 보이는 화면 */
export function TrustReport() {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .trust()
      .then((raw) => {
        const view = toTrustView(raw);
        if (alive) setLoaded(view ? { status: "ready", view } : { status: "error" });
      })
      .catch(() => {
        if (alive) setLoaded({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pt-12 pb-20 sm:pt-16">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">AI 신뢰도</h1>
      <p className="mt-3 max-w-[40rem] text-[16px] leading-relaxed text-ink-2">
        공장과 업체를 대신해 대화하는 AI를 공개한 시험으로 잰 결과를 있는 그대로 보여 드립니다. 목표에 못 미친 것과 아직 재지 못한 것도 함께
        적습니다.
      </p>

      {loaded.status === "loading" ? (
        <div role="status" aria-label="평가 결과를 불러오는 중" className="mt-10 grid gap-6 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : loaded.status === "error" ? (
        <div role="status" className="mt-10 rounded-xl border border-line px-5 py-6">
          <p className="font-medium">평가 결과를 불러오지 못했습니다</p>
          <p className="mt-1 text-[15px] text-ink-2">잠시 후 다시 시도해 주세요.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setLoaded({ status: "loading" });
              setAttempt((before) => before + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <Report view={loaded.view} />
      )}

      <div className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-6 text-[15px]">
        <Link href="/demo" className="font-semibold text-ink underline underline-offset-4">
          체험하기에서 두 AI의 대화 보기
        </Link>
        <Link href="/" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          처음 화면으로
        </Link>
      </div>
    </div>
  );
}
