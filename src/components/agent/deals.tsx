"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DocIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { Steps } from "@/components/ui/steps";
import { ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { useWorkspace } from "@/components/v3/use-workspace";
import { formatDateTime, formatNumber } from "@/lib/v3/format";
import { AI_NAME, DOC_LABEL } from "@/lib/v3/labels";
import { DEAL_STEPS, progressOf, type Deal } from "@/lib/v3/overview";
import type { DiagnosisView } from "@/lib/v3/types";
import { Bubble, ReviewNote } from "./agent-talk";
import { Dots } from "./dots";
import { approvalHref } from "./nav-pages";

type Tab = "talk" | "terms" | "docs";

function ListItem({ deal, active, href, name }: { deal: Deal; active: boolean; href: string; name: string }) {
  const progress = progressOf(deal);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="rs-press block border-l-[3px] border-transparent px-4 py-3.5 hover:bg-sunken aria-[current=page]:border-accent aria-[current=page]:bg-accent-bg"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[15px] font-semibold">{name}</span>
          {deal.updatedAt ? <span className="shrink-0 text-[12px] text-muted tabular-nums">{formatDateTime(deal.updatedAt, "date")}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-2">{deal.items.map((item) => item.name).join(", ")}</span>
        <Steps steps={DEAL_STEPS} done={progress.done} stopped={progress.stopped} compact className="mt-2" />
      </Link>
    </li>
  );
}

function Approved({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-[13px] font-medium ${done ? "bg-gain-bg text-gain" : "bg-sunken text-ink-2"}`}>
      {label} {done ? "승인" : "승인 전"}
    </span>
  );
}

/** 품목마다 지금 → 바뀐 뒤, 단가, 지금 대비 한 달 */
function Terms({ deal, emitter }: { deal: Deal; emitter: boolean }) {
  return (
    <>
      <ul className="divide-y divide-line md:hidden">
        {deal.items.map((item) => (
          <li key={item.streamId} className="py-3 text-[14px]">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{item.name}</span>
              {emitter && item.difference ? <ClaimValue claim={item.difference} signed className="text-gain" /> : null}
            </p>
            <p className="mt-1 text-ink-2">
              {item.monthlyKg !== null ? `${formatNumber(item.monthlyKg)}kg/월 · ` : ""}
              {item.now ?? "지금 처리 미입력"} → <span className="font-medium text-ink">{item.process ?? "확인 필요"}</span>
            </p>
            {item.unitPrice ? (
              <p className="mt-1">
                <ClaimValue claim={item.unitPrice} className="!font-normal" />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <thead className="bg-ground text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">폐기물</th>
              <th className="px-3 py-2 font-medium">한 달 물량</th>
              <th className="px-3 py-2 font-medium">지금 → 바뀐 뒤</th>
              <th className="px-3 py-2 font-medium">단가</th>
              {emitter ? <th className="px-3 py-2 text-right font-medium">지금 대비 한 달</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {deal.items.map((item) => (
              <tr key={item.streamId}>
                <td className="px-3 py-2.5 font-medium">{item.name}</td>
                <td className="px-3 py-2.5 text-ink-2 tabular-nums">{item.monthlyKg !== null ? `${formatNumber(item.monthlyKg)} kg` : "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">
                  {item.now ?? "미입력"} → <span className="font-medium text-ink">{item.process ?? "확인 필요"}</span>
                </td>
                <td className="px-3 py-2.5">{item.unitPrice ? <ClaimValue claim={item.unitPrice} className="!font-normal" /> : <span className="text-muted">—</span>}</td>
                {emitter ? (
                  <td className="px-3 py-2.5 text-right">
                    {item.difference ? <ClaimValue claim={item.difference} signed className="text-gain" /> : <span className="text-muted">—</span>}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Detail({ deal, view, name, emitterName }: { deal: Deal; view: DiagnosisView; name: string; emitterName: string }) {
  const { basePath, readOnly, setSessionId } = useV3();
  const [tab, setTab] = useState<Tab>("talk");
  const emitter = view.viewer.role !== "vendor";
  // 찾기·승인 화면은 열어 둔 찾기 하나를 본다. 이 거래의 찾기를 열어 두고 넘어간다
  const pin = () => setSessionId(deal.sessionId);
  const thread = view.threads.find((item) => item.id === deal.threadId);
  const review = view.approvals.find((item) => item.threadId === deal.threadId)?.review ?? null;
  const a = deal.approval;
  const mine = a ? (emitter ? a.emitter : a.vendor) : true;
  const needsMe = deal.stage === "agreed" && a !== null && !mine && !a.blocked;
  const progress = progressOf(deal);
  const tabs: { key: Tab; label: string }[] = [
    { key: "talk", label: `AI 대화 ${deal.messageCount}` },
    { key: "terms", label: "조건" },
    { key: "docs", label: `서류 ${deal.documents.length}` },
  ];
  return (
    <article className="mx-auto w-full max-w-[900px] px-5 pt-6 pb-16 lg:px-8">
      <Link href={`${basePath}/deals`} className="mb-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink lg:hidden">
        ← 거래 목록
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{emitter ? "처리 업체" : "배출 기업"}</p>
          <h1 className="text-[24px] leading-tight font-bold tracking-[-0.03em]">{name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link onClick={pin} href={`${basePath}/find?present=1`} className={buttonClass("secondary", "md")}>
            발표 화면
          </Link>
          {deal.stage === "agreed" && emitter && a?.permitHold ? (
            // 허가증 원문 대조는 찾기 화면의 결과표에서 한다. 대조가 끝나야 승인할 수 있다
            <Link onClick={pin} href={`${basePath}/find`} className={buttonClass(readOnly ? "secondary" : "primary", "md")}>
              허가증 대조하기
            </Link>
          ) : deal.stage === "agreed" || deal.stage === "confirmed" ? (
            <Link
              onClick={pin}
              href={deal.stage === "confirmed" ? `${basePath}/approval/documents` : approvalHref(basePath, deal.threadId)}
              className={buttonClass(needsMe && !readOnly ? "primary" : "secondary", "md")}
            >
              {deal.stage === "confirmed" ? "서류 보기" : needsMe ? "승인하기" : "승인 상태"}
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-label="진행 단계" className="mt-5 rounded-xl border border-line bg-surface px-4 py-5">
        <Steps steps={DEAL_STEPS} done={progress.done} stopped={progress.stopped} />
        {a ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <Approved label="배출 기업" done={a.emitter} />
            <Approved label="처리 업체" done={a.vendor} />
            {a.blocked ? <span className="inline-flex h-6 items-center rounded-[6px] bg-loss-bg px-2 text-[13px] font-medium text-loss">막힘</span> : null}
            {a.permitHold && emitter ? (
              <span className="inline-flex h-6 items-center rounded-[6px] bg-warn-bg px-2 text-[13px] font-medium text-warn">허가증 대조 필요</span>
            ) : null}
            {a.checks > 0 ? (
              <span title={a.checkTitles.join(", ")} className="inline-flex h-6 items-center rounded-[6px] bg-warn-bg px-2 text-[13px] font-medium text-warn">
                확인할 것 {a.checks}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <div role="tablist" aria-label="거래 내용" className="mt-6 flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className="-mb-px min-h-11 border-b-2 border-transparent px-3.5 text-[14.5px] text-ink-2 hover:text-ink aria-selected:border-accent aria-selected:font-semibold aria-selected:text-ink"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "talk" ? (
        <section role="tabpanel" aria-label="AI 대화" className="pt-4">
          <div className="grid grid-cols-2 gap-3 text-[12px] leading-snug">
            <p>
              <span className="block font-medium text-ink">{AI_NAME.company}</span>
              <span className="block text-muted">{emitterName} 편</span>
            </p>
            <p className="text-right">
              <span className="block font-medium text-ink">{AI_NAME.vendor}</span>
              <span className="block text-muted">{deal.vendorName} 편</span>
            </p>
          </div>
          <ol className="mt-4 space-y-5">
            {(thread?.messages ?? []).map((message) => {
              const left = message.author ? message.author.side === "company" : message.from === "company_agent";
              return <Bubble key={message.id} message={message} mine={left} name={left ? emitterName : deal.vendorName} fresh={false} clamp />;
            })}
            {review ? <ReviewNote review={review} fresh={false} /> : null}
          </ol>
          <p className="mt-4 text-[12px] text-muted">숫자를 누르면 근거가 열립니다.</p>
        </section>
      ) : null}

      {tab === "terms" ? (
        <section role="tabpanel" aria-label="조건" className="pt-4">
          <div className="overflow-hidden rounded-xl border border-line bg-surface md:[&_table]:rounded-none">
            <div className="px-4 md:px-0">
              <Terms deal={deal} emitter={emitter} />
            </div>
          </div>
          {a && a.checks > 0 ? (
            <p className="mt-3 text-[13px] text-ink-2">
              <span className="font-medium text-warn">승인 전에 사람이 확인할 것</span> · {a.checkTitles.join(", ")}
            </p>
          ) : null}
          {a?.blocked && a.blockedReason ? <p className="mt-2 text-[13px] text-loss">{a.blockedReason}</p> : null}
          {deal.outcomeText ? <p className="mt-2 text-[13px] text-muted">{deal.outcomeText}</p> : null}
        </section>
      ) : null}

      {tab === "docs" ? (
        <section role="tabpanel" aria-label="서류" className="pt-4">
          {deal.documents.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {deal.documents.map((doc) => (
                <li key={doc.id} className="px-4 py-2">
                  <p className="flex min-h-11 items-center gap-2 text-[14px]">
                    <DocIcon className="shrink-0 text-muted" />
                    <span className="w-24 shrink-0 font-medium">{DOC_LABEL[doc.kind]}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">{doc.title}</span>
                    <span className="shrink-0 text-[12px] text-muted tabular-nums">{formatDateTime(doc.createdAt, "date")}</span>
                  </p>
                  <MoreDetails label="내용 보기" closeLabel="내용 접기">
                    <p className="pb-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{doc.rendered}</p>
                  </MoreDetails>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-[14px] text-muted">
              양쪽이 승인하면 요청서, 이행 계획서, 계약서 초안이 여기에 만들어집니다.
            </p>
          )}
        </section>
      ) : null}
    </article>
  );
}

/**
 * 거래: 업체 한 곳(업체가 볼 때는 배출 기업 한 곳)과 두 AI로 조건을 맞춘 건들. 왼쪽에 목록, 오른쪽에 고른 거래의
 * 진행 단계와 탭(AI 대화, 조건, 서류)을 둔다. 좁은 화면에서는 목록과 내용을 번갈아 보인다(?deal= 가 있으면 내용).
 */
export function DealsView() {
  const { basePath, readOnly } = useV3();
  const w = useWorkspace();
  const params = useSearchParams();
  const session = params.get("session");
  const wanted = params.get("deal");
  const showDetail = Boolean(wanted || session);

  if (w.loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <Dots label="불러오는 중" />
      </div>
    );
  }

  const deal =
    w.deals.find((item) => item.key === wanted) ?? (session ? w.deals.find((item) => item.sessionId === session) : undefined) ?? w.deals[0] ?? null;
  const view = deal ? (w.views.find((item) => item.session.id === deal.sessionId) ?? null) : null;
  const emitter = w.side === "emitter";
  const nameFor = (item: Deal) => (emitter ? item.vendorName : w.nameOf(item.emitterOrgId));

  if (!deal || !view) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <h1 className="text-[22px] font-bold tracking-[-0.025em]">아직 거래가 없습니다</h1>
        <p className="mt-2 max-w-[440px] text-[15px] text-ink-2">
          {emitter ? "찾기를 시작하면 AI가 받을 수 있는 업체에 조건을 묻고, 그 거래가 여기에 모입니다." : "배출 기업의 AI가 문의하면 여기에 거래가 생깁니다."}
        </p>
        {emitter && !readOnly ? (
          <Link href={`${basePath}/find`} className={buttonClass("primary", "md", "mt-6")}>
            받아 줄 곳 찾기
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className={`w-full shrink-0 border-r border-line lg:block lg:w-[320px] ${showDetail ? "hidden" : "block"}`}>
        <div className="sticky top-0 max-h-dvh overflow-y-auto">
          <header className="flex items-baseline justify-between px-4 pt-6 pb-3">
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">거래</h1>
            <span className="text-[13px] text-muted">{w.deals.length}건</span>
          </header>
          <ul className="divide-y divide-line border-y border-line">
            {w.deals.map((item) => (
              <ListItem key={item.key} deal={item} active={item.key === deal.key} href={`${basePath}/deals?deal=${encodeURIComponent(item.key)}`} name={nameFor(item)} />
            ))}
          </ul>
        </div>
      </aside>
      <div className={`min-w-0 flex-1 ${showDetail ? "block" : "hidden lg:block"}`}>
        <Detail key={deal.key} deal={deal} view={view} name={nameFor(deal)} emitterName={w.nameOf(deal.emitterOrgId)} />
      </div>
    </div>
  );
}
