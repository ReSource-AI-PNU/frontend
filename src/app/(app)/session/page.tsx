import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { formatDate } from "@/components/dashboard/format-date";
import { SESSION_STATUS, SESSION_STATUS_ORDER, SessionStatusBadge } from "@/components/dashboard/session-status";
import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatSigned } from "@/lib/format";
import { listSessionsForCurrentOrg } from "@/lib/server/sessions";
import { FLOW_STEPS, type Session, type SessionStatus } from "@/lib/session/types";

export const metadata: Metadata = { title: "세션" };

function expectedMonthly(s: Session) {
  const id = s.approval?.routeId ?? s.selectedRoute ?? s.proposal?.recommended;
  return s.costCarbon?.routes.find((r) => r.id === id) ?? null;
}

function lastStep(s: Session) {
  if (s.status === "analyzing") return "분석 중";
  const f = FLOW_STEPS.find((x) => x.slug === s.step);
  return f ? `${f.no}. ${f.label}` : "—";
}

function OutcomeCell({ s }: { s: Session }) {
  if (s.outcome) {
    return (
      <span className="text-sm">
        <span className="font-semibold">{s.outcome.accepted ? "매입 완료" : "매입 거절"}</span>
        <span className="block text-[12px] text-muted">
          {s.outcome.accepted ? `실제 ${formatSigned(s.outcome.actualPerKg)}원/kg · ${s.outcome.actualGrade}` : s.outcome.reason || s.outcome.actualGrade}
        </span>
      </span>
    );
  }
  if (s.status === "sent") return <span className="text-sm text-muted">업체 기록 대기</span>;
  return <span className="text-sm text-muted">없음</span>;
}

async function SessionListPageContent({ searchParams }: PageProps<"/session">) {
  const { status: raw } = await searchParams;
  const { sessions } = await listSessionsForCurrentOrg();
  const status = SESSION_STATUS_ORDER.includes(raw as SessionStatus) ? (raw as SessionStatus) : null;
  const rows = status ? sessions.filter((s) => s.status === status) : sessions;
  const counts = Object.fromEntries(SESSION_STATUS_ORDER.map((k) => [k, sessions.filter((s) => s.status === k).length])) as Record<SessionStatus, number>;
  const filters = [
    { key: null as SessionStatus | null, label: "전체", n: sessions.length },
    ...SESSION_STATUS_ORDER.map((k) => ({ key: k as SessionStatus | null, label: SESSION_STATUS[k].label, n: counts[k] })),
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:px-8">
      <PageHeader
        title="세션"
        description="폐기물 한 더미를 식별부터 견적 요청까지 진행한 기록입니다. 품목을 누르면 마지막으로 보던 단계로 이어집니다."
        aside={
          <ButtonLink href="/upload">
            새 판정 시작
            <ArrowRightIcon />
          </ButtonLink>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="아직 만든 세션이 없습니다"
          description="폐기물 사진이나 영상을 올리면 세션이 만들어지고, 에이전트 6개가 식별부터 견적 요청서까지 차례로 채웁니다."
          action={
            <ButtonLink href="/upload" variant="secondary">
              업로드로 시작
              <ArrowRightIcon />
            </ButtonLink>
          }
        />
      ) : (
        <>
          <nav aria-label="상태로 거르기">
            <ul className="flex w-fit flex-wrap gap-1 rounded-md bg-sunken p-1">
              {filters.map((f) => (
                <li key={f.label}>
                  <Link
                    href={f.key ? `/session?status=${f.key}` : "/session"}
                    aria-current={f.key === status ? "page" : undefined}
                    className="flex min-h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold text-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                  >
                    {f.label}
                    <span className="num text-[12px] font-medium">{f.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {rows.length === 0 ? (
            <EmptyState
              title={`${status ? SESSION_STATUS[status].label : ""} 상태인 세션이 없습니다`}
              description="다른 상태를 고르거나 전체 목록을 보세요."
              action={
                <ButtonLink href="/session" variant="secondary">
                  전체 보기
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <caption className="sr-only">
                  세션 이력 {rows.length}건. 상태, 품목, 생성일, 마지막 단계, 예상 월 손익, 실제 결과 순서입니다.
                </caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th scope="col" className="px-4 py-3 font-semibold">상태</th>
                    <th scope="col" className="px-4 py-3 font-semibold">품목</th>
                    <th scope="col" className="px-4 py-3 font-semibold">생성일</th>
                    <th scope="col" className="px-4 py-3 font-semibold">마지막 단계</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">예상 월 손익 (원)</th>
                    <th scope="col" className="px-4 py-3 font-semibold">실제 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const route = expectedMonthly(s);
                    return (
                      <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-bg">
                        <td className="px-4 py-3">
                          <SessionStatusBadge status={s.status} />
                        </td>
                        <th scope="row" className="px-4 py-3 text-left font-normal">
                          <Link href={`/session/${s.id}`} className="font-semibold underline-offset-4 hover:underline">
                            {s.classify.item}
                          </Link>
                          <span className="block text-[12px] text-muted">{s.classify.detail}</span>
                        </th>
                        <td className="num px-4 py-3 text-ink-2">{formatDate(s.createdAt)}</td>
                        <td className="px-4 py-3 text-ink-2">{lastStep(s)}</td>
                        <td className="px-4 py-3 text-right">
                          {route ? (
                            <>
                              <span className={`num font-semibold ${route.monthlyKrw > 0 ? "text-gain" : route.monthlyKrw < 0 ? "text-loss" : ""}`}>
                                {formatSigned(route.monthlyKrw)}
                              </span>
                              <span className="block text-[12px] text-muted">
                                {route.monthlyKrw >= 0 ? "수익" : "지출"} · {route.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">아직 계산 전</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <OutcomeCell s={s} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function SessionListPage(props: PageProps<"/session">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SessionListPageContent {...props} />
    </Suspense>
  );
}
