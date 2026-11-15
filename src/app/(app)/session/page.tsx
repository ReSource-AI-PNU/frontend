import { PlatformRoute } from "@/components/platform/route";
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

export const metadata: Metadata = { title: "진단 이력" };

function lastStep(s: Session) {
  if (s.status === "analyzing") return "분석 중";
  const f = FLOW_STEPS.find((x) => x.slug === s.step);
  return f ? `${f.no}. ${f.label}` : "—";
}

/** 흐름 이름 요약: 앞의 세 개와 나머지 수 */
function streamSummary(s: Session) {
  const names = (s.streams ?? []).map((x) => x.name);
  if (names.length === 0) return "흐름 없음";
  const head = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${head} 외 ${names.length - 3}개` : head;
}

function signTone(n: number) {
  return n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-ink-2";
}

function MonthlyCell({ s }: { s: Session }) {
  const f = s.feasibility;
  if (!f) return <span className="text-muted">아직 계산 전</span>;
  const diff = f.totalAfter - f.totalNow;
  return (
    <>
      <span className="sr-only">
        현행 {formatSigned(f.totalNow)}원에서 흐름별 최적안 {formatSigned(f.totalAfter)}원으로
      </span>
      <span aria-hidden="true" className="whitespace-nowrap">
        <span className={`num ${signTone(f.totalNow)}`}>{formatSigned(f.totalNow)}</span>
        <span className="mx-1.5 text-muted">→</span>
        <span className={`num font-semibold ${signTone(f.totalAfter)}`}>{formatSigned(f.totalAfter)}</span>
      </span>
      <span className="block text-[12px] text-muted">
        현행 전부 소각 → 흐름별 최적안 · 개선 <span className="tabular-nums">{formatSigned(diff)}</span>원
      </span>
    </>
  );
}

function OutcomeCell({ s }: { s: Session }) {
  if (s.outcome) {
    const stream = s.streams?.find((x) => x.id === s.outcome?.streamId);
    return (
      <span className="text-sm">
        <span className="font-semibold">{s.outcome.accepted ? "매입 완료" : "매입 거절"}</span>
        <span className="block text-[12px] text-muted">
          {stream ? `${stream.name} · ` : ""}
          {s.outcome.accepted ? (
            <>
              실제 <span className="tabular-nums">{formatSigned(s.outcome.actualPerKg)}</span>원/kg · {s.outcome.actualGrade}
            </>
          ) : (
            s.outcome.reason || s.outcome.actualGrade
          )}
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
        title="폐플라스틱 진단 이력"
        description="공장의 폐플라스틱 흐름을 식별부터 이행안 승인까지 진단한 기록입니다. 진단 제목을 누르면 마지막으로 보던 단계로 이어집니다."
        aside={
          <ButtonLink href="/upload">
            새 진단 시작
            <ArrowRightIcon />
          </ButtonLink>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="아직 시작한 진단이 없습니다"
          description="공정별 폐플라스틱 흐름(스프루, 불량품, 퍼지, 포장 필름 등)을 찍어 올리면 진단이 만들어지고, 에이전트 6개가 흐름별 갈 곳부터 이행 계획서까지 차례로 채웁니다."
          action={
            <ButtonLink href="/upload" variant="secondary">
              흐름 사진 올리기
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
              title={`${status ? SESSION_STATUS[status].label : ""} 상태인 진단이 없습니다`}
              description="다른 상태를 고르거나 전체 목록을 보세요."
              action={
                <ButtonLink href="/session" variant="secondary">
                  전체 보기
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <caption className="sr-only">
                  폐플라스틱 진단 이력 {rows.length}건. 상태, 진단과 흐름, 생성일, 마지막 단계, 공장 월 손익(현행에서 최적안으로), 실제 결과 순서입니다.
                </caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th scope="col" className="px-4 py-3 font-semibold">상태</th>
                    <th scope="col" className="px-4 py-3 font-semibold">진단 · 흐름</th>
                    <th scope="col" className="px-4 py-3 font-semibold">생성일</th>
                    <th scope="col" className="px-4 py-3 font-semibold">마지막 단계</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">공장 월 손익 (원)</th>
                    <th scope="col" className="px-4 py-3 font-semibold">실제 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top last:border-b-0 hover:bg-bg">
                      <td className="px-4 py-3">
                        <SessionStatusBadge status={s.status} />
                      </td>
                      <th scope="row" className="max-w-[340px] px-4 py-3 text-left font-normal">
                        <Link href={`/session/${s.id}`} className="font-semibold underline-offset-4 hover:underline">
                          {s.title}
                        </Link>
                        <span className="block text-[12px] text-muted">
                          흐름 <span className="tabular-nums">{s.streams?.length ?? 0}</span>개 · {streamSummary(s)}
                        </span>
                      </th>
                      <td className="num px-4 py-3 text-ink-2">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3 text-ink-2">{lastStep(s)}</td>
                      <td className="px-4 py-3 text-right">
                        <MonthlyCell s={s} />
                      </td>
                      <td className="px-4 py-3">
                        <OutcomeCell s={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[12px] text-muted">공장 월 손익은 시연용 가정값(소각 위탁비, 매각 단가, 재투입 가치 등)으로 계산한 예상치입니다. 실제 결과는 처리업체가 수거 후 기록합니다.</p>
        </>
      )}
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function SessionListPage(props: PageProps<"/session">) {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute view="sessions" />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SessionListPageContent {...props} />
    </Suspense>
  );
}
