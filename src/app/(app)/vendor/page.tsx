import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { formatDateTime } from "@/components/dashboard/format-date";
import { ButtonLink } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BundleBoard, type AiBundle } from "@/components/vendor/bundle-board";
import { OutcomeForm } from "@/components/vendor/outcome-form";
import { findComplex } from "@/lib/complexes";
import { formatNumber, formatSigned } from "@/lib/format";
import { getCompanies } from "@/lib/server/companies";
import { requireOrganization } from "@/lib/server/organization";
import { outbox, sessions } from "@/lib/server/sessions";
import type { OutboxMessage, Session } from "@/lib/session/types";

export const metadata: Metadata = { title: "업체 화면" };

const MESSAGE_STATUS: Record<OutboxMessage["status"], { label: string; tone: BadgeTone }> = {
  sent: { label: "새 요청", tone: "warn" },
  read: { label: "읽음", tone: "neutral" },
  replied: { label: "회신함", tone: "neutral" },
  completed: { label: "수거 완료", tone: "gain" },
};

const KIND_LABEL: Record<OutboxMessage["kind"], string> = { quote: "견적 요청", "bundle-invite": "묶음 참여 제안" };
const VERDICT_LABEL = { reuse: "재사용 가능", recycle: "재활용 가능", dispose: "폐기 처리" } as const;

function predictedKg(s: Session) {
  return s.matching?.totalKg ?? s.classify.estimatedKg;
}

function OutcomeComparison({ s }: { s: Session }) {
  const o = s.outcome!;
  const pred = s.feasibility?.afterPerKg ?? null;
  const rows: { label: string; ai: string; actual: string; aiNum?: boolean; actualNum?: boolean }[] = [
    { label: "매입 여부", ai: "매입 예상", actual: o.accepted ? "매입함" : "매입 거절" },
    { label: "등급", ai: s.feasibility ? VERDICT_LABEL[s.feasibility.verdict] : "—", actual: o.actualGrade },
    { label: "단가 (원/kg)", ai: pred !== null ? formatSigned(pred) : "—", actual: o.accepted ? formatSigned(o.actualPerKg) : "—", aiNum: pred !== null, actualNum: o.accepted },
    { label: "수거량 (kg)", ai: formatNumber(predictedKg(s)), actual: formatNumber(o.actualKg), aiNum: true, actualNum: true },
  ];
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">AI 예상과 업체가 기록한 실제 결과 비교</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            <th scope="col" className="py-2 pr-3 font-semibold">항목</th>
            <th scope="col" className="py-2 pr-3 font-semibold">AI 예상</th>
            <th scope="col" className="py-2 font-semibold">실제 (업체 기록)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {r.label}
              </th>
              <td className="py-2 pr-3">
                <span className={`rounded-sm bg-marker px-1.5 py-0.5 text-marker-ink ${r.aiNum ? "num" : ""}`}>{r.ai}</span>
              </td>
              <td className={`py-2 font-semibold ${r.actualNum ? "num" : ""}`}>{r.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">
        {o.recordedBy}({o.recorderRole})가 <span className="tabular-nums">{formatDateTime(o.recordedAt)}</span>에 기록했습니다.
        {o.reason ? ` 메모: ${o.reason}` : ""} 이 기록은 다음 모델 학습에 쓰입니다.
      </p>
    </div>
  );
}

async function VendorPageContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { as } = await searchParams;
  const org = await requireOrganization();
  const complex = findComplex(org.complexId);
  const companies = await getCompanies(org.complexId);
  const vendors = companies.filter((c) => c.role === "처리업체");
  const inboxAll = (await outbox.filter((m) => vendors.some((v) => v.id === m.toCompanyId))).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  // 기본 시점: 가장 최근에 요청을 받은 처리업체, 없으면 단지의 첫 처리업체
  const vendor = vendors.find((v) => v.id === as) ?? vendors.find((v) => v.id === inboxAll[0]?.toCompanyId) ?? vendors[0];

  if (!vendor) {
    return (
      <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:px-8">
        <h1 className="text-h1">업체 화면</h1>
        <EmptyState title="이 단지에 등록된 처리업체가 없습니다" description="다른 산업단지로 온보딩하면 그 단지의 처리업체 시점으로 볼 수 있습니다." />
      </div>
    );
  }

  const messages = inboxAll.filter((m) => m.toCompanyId === vendor.id);
  const newCount = (id: string) => inboxAll.filter((m) => m.toCompanyId === id && m.status === "sent").length;
  const allSessions = await sessions.filter((s) => s.complexId === org.complexId);
  const byId = new Map(allSessions.map((s) => [s.id, s]));
  const firstOpen = messages.find((m) => m.kind === "quote" && byId.get(m.sessionId)?.status === "sent");

  const aiBundles: AiBundle[] = allSessions
    .filter((s) => s.matching?.collector.companyId === vendor.id && s.approval)
    .map((s) => ({
      sessionId: s.id,
      item: s.classify.item,
      detail: s.classify.detail,
      totalKg: s.matching!.totalKg,
      members: s.matching!.group.map((g) => ({ name: g.name, kg: g.kg })),
      schedule: s.matching!.schedule,
      done: s.status === "completed",
    }));

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-h1">업체 화면</h1>
            <p className="mt-1 text-sm text-muted">
              처리업체가 받은 견적 요청을 보고, 수거한 뒤 실제 등급·단가·매입 여부를 기록하는 화면입니다.
            </p>
          </div>
          <Badge tone="neutral">업체 시점 시연</Badge>
        </div>
        <div className="grid gap-3 rounded-md border border-line bg-surface px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <p className="text-[13px] text-ink-2">
            시연에서는 한 계정이 {complex?.shortName ?? "단지"} 처리업체 중 하나의 시점으로 바꿔 봅니다. 실제 서비스에서는 업체 담당자가 자기 계정으로 들어옵니다.
          </p>
          <nav aria-label="시점으로 볼 처리업체">
            <ul className="flex flex-wrap gap-1 rounded-md bg-sunken p-1">
              {vendors.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/vendor?as=${v.id}`}
                    aria-current={v.id === vendor.id ? "page" : undefined}
                    className="flex min-h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold whitespace-nowrap text-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                  >
                    <span aria-hidden="true" className="inline-block size-2 rounded-[2px] bg-current" />
                    {v.name}
                    {newCount(v.id) > 0 ? <span className="text-[12px] font-medium text-ink-2">새 요청 <span className="tabular-nums">{newCount(v.id)}</span></span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="text-[13px] text-muted">
          지금 보는 업체: <span className="font-semibold text-ink">{vendor.name}</span> · 허가 품목 {vendor.permits?.join(", ") ?? "없음"}
        </p>
      </header>

      <section aria-labelledby="inbox" className="grid gap-4">
        <div>
          <h2 id="inbox" className="text-h2">
            받은 요청함
          </h2>
          <p className="text-[13px] text-muted">배출 기업 담당자가 판정 흐름 마지막에서 승인한 견적 요청과 묶음 제안입니다.</p>
        </div>
        {messages.length === 0 ? (
          <EmptyState
            title={`${vendor.name}에 도착한 요청이 아직 없습니다`}
            description="견적 요청은 배출 기업 담당자가 판정 흐름의 마지막 단계(최적안·승인)에서 발송 내용을 확인하고 승인해야 나갑니다. 사람이 승인하기 전에는 외부로 아무것도 발송되지 않습니다. 이 업체가 묶음 수거 업체로 선택된 세션을 승인하면 여기에 나타납니다."
            action={
              <ButtonLink href="/session" variant="secondary">
                내 세션에서 승인하기
              </ButtonLink>
            }
          />
        ) : (
          <ul className="grid gap-4">
            {messages.map((m) => {
              const s = byId.get(m.sessionId);
              const st = MESSAGE_STATUS[s?.status === "completed" ? "completed" : m.status];
              return (
                <li key={m.id} className="rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[12px] text-muted">
                        {KIND_LABEL[m.kind]} · {m.fromOrg} · <span className="tabular-nums">{formatDateTime(m.sentAt)}</span>
                      </p>
                      <h3 className="mt-0.5 text-[16px] font-semibold">{m.subject}</h3>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {s ? (
                    <div className="grid gap-6 px-5 py-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                      <dl className="grid content-start gap-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">품목</dt>
                          <dd className="text-right font-semibold">
                            {s.classify.item} · {s.classify.detail}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">월 물량 (kg)</dt>
                          <dd className="num font-semibold">{formatNumber(predictedKg(s))}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">묶음</dt>
                          <dd className="text-right">{s.matching ? `${s.matching.group.length}개사` : "단독"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">수거 주기</dt>
                          <dd className="text-right">{s.matching?.schedule ?? "협의"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">희망 단가 (원/kg)</dt>
                          <dd className="num font-semibold">{s.feasibility ? formatSigned(s.feasibility.afterPerKg) : "—"}</dd>
                        </div>
                      </dl>
                      <div className="min-w-0">
                        {s.outcome ? (
                          <OutcomeComparison s={s} />
                        ) : m.kind === "quote" ? (
                          <details open={m.id === firstOpen?.id} className="group">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-3 rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-ink">
                              수거 후 실제 결과 기록
                              <span aria-hidden="true" className="text-muted group-open:rotate-180">
                                ▾
                              </span>
                            </summary>
                            <div className="pt-4">
                              <OutcomeForm
                                sessionId={s.id}
                                primary={m.id === firstOpen?.id}
                                prediction={{
                                  verdictLabel: s.feasibility ? VERDICT_LABEL[s.feasibility.verdict] : "판정 전",
                                  perKg: s.feasibility?.afterPerKg ?? null,
                                  kg: predictedKg(s),
                                }}
                              />
                            </div>
                          </details>
                        ) : (
                          <p className="text-sm text-muted">묶음 참여 제안은 참여 여부만 회신합니다. 실제 결과는 견적 요청을 받은 수거 업체가 기록합니다.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="px-5 py-4 text-sm text-muted">원본 세션을 찾을 수 없습니다.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BundleBoard vendor={vendor} companies={companies} aiBundles={aiBundles} />
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function VendorPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VendorPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
