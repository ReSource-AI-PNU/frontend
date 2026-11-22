"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronRightIcon, DocIcon, PlusIcon, TalkIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Fold, FoldGroup } from "@/components/ui/fold";
import { Steps } from "@/components/ui/steps";
import { ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { useWorkspace } from "@/components/v3/use-workspace";
import { formatDateTime, formatNumber } from "@/lib/v3/format";
import { DOC_LABEL } from "@/lib/v3/labels";
import { DEAL_STEPS, progressOf, type Activity, type Deal, type Task, type TaskKind } from "@/lib/v3/overview";
import { Dots } from "./dots";

const TAG_TONE: Record<TaskKind, string> = {
  blocked: "bg-loss-bg text-loss",
  answer: "bg-warn-bg text-warn",
  permit: "bg-warn-bg text-warn",
  approve: "bg-accent-bg text-accent",
  check: "bg-sunken text-ink-2",
  outcome: "bg-sunken text-ink-2",
  document: "bg-gain-bg text-gain",
};

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.03em] whitespace-nowrap tabular-nums">{children}</p>
    </div>
  );
}

const unit = "ml-1 text-[14px] font-medium tracking-normal text-ink-2";

function TaskRow({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  return (
    <li>
      <button type="button" title={task.detail} onClick={() => onOpen(task)} className="rs-press group flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-sunken">
        <span className={`inline-flex h-6 w-[5.5rem] shrink-0 items-center justify-center rounded-md text-[12px] font-semibold ${TAG_TONE[task.kind]}`}>{task.tag}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{task.title}</span>
          {task.checks ? <span className="block text-[12px] text-muted">확인할 것 {task.checks.count}개</span> : null}
        </span>
        <ChevronRightIcon className="shrink-0 text-muted group-hover:text-ink" />
      </button>
    </li>
  );
}

/** 거래에 든 품목의 "지금 대비" 합 */
function differenceOf(deal: Deal): number | null {
  const values = deal.items.map((item) => item.difference?.value).filter((value): value is number => typeof value === "number");
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

/** 거래 한 줄: 누구와, 무엇을, 어디까지 왔는지 */
function DealRow({ deal, href, name, emitter }: { deal: Deal; href: string; name: string; emitter: boolean }) {
  const difference = emitter ? differenceOf(deal) : null;
  const kg = deal.items.reduce((sum, item) => sum + (item.monthlyKg ?? 0), 0);
  const progress = progressOf(deal);
  return (
    <li>
      <Link href={href} className="rs-press group flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-sunken">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{name}</span>
          <span className="block truncate text-[13px] text-ink-2">
            {deal.items.map((item) => item.name).join(", ")} · {formatNumber(kg)}kg/월
          </span>
          <Steps steps={DEAL_STEPS} done={progress.done} stopped={progress.stopped} compact className="mt-1.5" />
        </span>
        {difference !== null ? (
          <span className="shrink-0 text-right text-[15px] font-semibold text-gain tabular-nums">
            {difference > 0 ? "+" : difference < 0 ? "−" : ""}
            {formatNumber(Math.abs(difference))}원
          </span>
        ) : null}
        <ChevronRightIcon className="shrink-0 text-muted group-hover:text-ink" />
      </Link>
    </li>
  );
}

function ActivityRow({ item, href }: { item: Activity; href: string | null }) {
  const body = (
    <>
      <span className="shrink-0 text-[12px] text-muted tabular-nums">{item.at ? formatDateTime(item.at, "time") : ""}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">
        <span className="font-medium text-ink">{item.who.split(" · ").at(-1)}</span> {item.text}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-11 items-center gap-3 rounded-lg hover:text-ink">
          {body}
        </Link>
      ) : (
        <span className="flex min-h-11 items-center gap-3">{body}</span>
      )}
    </li>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * 로그인한 뒤 첫 화면(대시보드). 숫자 넷, 할 일, 진행 중인 거래만 둔다. 최근 바뀐 것과 서류는 접어 둔다.
 * 자세한 근거와 대화는 거래·찾기·승인 화면으로 넘긴다.
 */
export function Overview() {
  const { org, basePath, readOnly } = useV3();
  const router = useRouter();
  const w = useWorkspace();
  const emitter = w.side === "emitter";
  const dealHref = (key: string | null) => `${basePath}/deals${key ? `?deal=${encodeURIComponent(key)}` : ""}`;

  // 처음 들어온 배출 기업(찾기가 하나도 없음)은 홈 대신 폐기물 등록과 찾기 화면으로 보낸다
  const fresh = emitter && !readOnly && w.ready && w.views.length === 0;
  useEffect(() => {
    if (fresh) router.replace(`${basePath}/find`);
  }, [fresh, router, basePath]);

  if (w.loading || fresh) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <Dots label="불러오는 중" />
      </div>
    );
  }

  const h = w.headline;
  const empty = w.deals.length === 0 && w.tasks.length === 0;
  const talking = w.deals.filter((deal) => deal.stage === "talking" || deal.stage === "agreed").length;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pt-8 pb-16 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{emitter ? "배출 기업" : "처리 업체"}</p>
          <h1 className="truncate text-[26px] leading-tight font-bold tracking-[-0.03em]">{org.name}</h1>
        </div>
        {emitter ? (
          <Link href={`${basePath}/find`} className={buttonClass("primary", "md")}>
            <PlusIcon />
            받아 줄 곳 찾기
          </Link>
        ) : null}
      </header>

      {w.error ? (
        <p role="alert" className="mt-5 rounded-lg bg-loss-bg px-4 py-3 text-sm text-loss">
          {w.error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        {emitter ? (
          <Cell label={h.provisional ? "지금 대비 한 달 (잠정)" : "지금 대비 한 달"}>
            {h.difference ? <ClaimValue claim={h.difference} signed className="text-gain" /> : <span className="text-muted">—</span>}
          </Cell>
        ) : (
          <Cell label="진행 중인 거래">
            {talking}
            <span className={unit}>건</span>
          </Cell>
        )}
        <Cell label={emitter ? "보낼 물량" : "들어올 물량"}>
          {formatNumber(h.recycledKg)}
          <span className={unit}>kg/월</span>
        </Cell>
        <Cell label="승인 기다림">
          {h.agreedCount}
          <span className={unit}>건</span>
        </Cell>
        <Cell label="확정">
          {h.confirmedCount}
          <span className={unit}>건</span>
        </Cell>
      </div>

      {empty ? (
        <div className="mt-6 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
          <h2 className="text-[18px] font-bold">{emitter ? "아직 거래가 없습니다" : "아직 받은 문의가 없습니다"}</h2>
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] text-ink-2">
            {emitter ? "나오는 폐기물을 적고 찾기를 시작하면, AI가 받을 수 있는 업체에 대신 조건을 묻습니다." : "허가 품목과 매입 기준을 올려 두면 맞는 물량만 문의가 옵니다."}
          </p>
          <Link href={emitter ? `${basePath}/find` : `${basePath}/materials`} className={buttonClass("primary", "md", "mt-6")}>
            {emitter ? "받아 줄 곳 찾기" : "업체 정보 올리기"}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
            <Card title="할 일" aside={<span className="text-[13px] text-muted">{w.tasks.length}건</span>}>
              {w.tasks.length > 0 ? (
                <ul className="divide-y divide-line">
                  {w.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={w.go} />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[14px] text-muted">지금 할 일이 없습니다</p>
              )}
            </Card>

            <Card
              title="진행 중인 거래"
              aside={
                <Link href={dealHref(null)} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                  전체 보기
                  <ChevronRightIcon className="size-3.5" />
                </Link>
              }
            >
              {w.deals.length > 0 ? (
                <ul className="divide-y divide-line">
                  {w.deals.map((deal) => (
                    <DealRow key={deal.key} deal={deal} href={dealHref(deal.key)} emitter={emitter} name={emitter ? deal.vendorName : w.nameOf(deal.emitterOrgId)} />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[14px] text-muted">아직 거래가 없습니다</p>
              )}
            </Card>
          </div>

          <FoldGroup className="mt-5 !rounded-xl">
            <Fold title="최근 바뀐 것" summary={`${w.activity.length}건`} icon={<TalkIcon />}>
              {w.activity.length > 0 ? (
                <ol>
                  {w.activity.map((item) => (
                    <ActivityRow key={item.id} item={item} href={item.dealKey ? dealHref(item.dealKey) : null} />
                  ))}
                </ol>
              ) : (
                <p className="text-[14px] text-muted">아직 기록이 없습니다.</p>
              )}
            </Fold>
            <Fold title="서류" summary={`${w.documents.length}건`} icon={<DocIcon />}>
              {w.documents.length > 0 ? (
                <ul>
                  {w.documents.map((item) => (
                    <li key={`${item.dealKey}:${item.doc.id}`}>
                      <button
                        type="button"
                        onClick={() => w.go({ sessionId: item.sessionId, target: "approval", dealKey: item.dealKey })}
                        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg text-left text-[14px] hover:text-accent"
                      >
                        <span className="w-24 shrink-0 font-medium">{DOC_LABEL[item.doc.kind]}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-2">{emitter ? item.vendorName : w.nameOf(item.emitterOrgId)}</span>
                        <span className="shrink-0 text-[12px] text-muted tabular-nums">{formatDateTime(item.doc.createdAt, "date")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-muted">양쪽이 승인하면 요청서, 이행 계획서, 계약서 초안이 여기에 모입니다.</p>
              )}
            </Fold>
          </FoldGroup>
        </>
      )}
    </div>
  );
}
