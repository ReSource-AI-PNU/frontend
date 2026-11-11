import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { formatDateTime } from "@/components/dashboard/format-date";
import { OriginChip, RouteBadge } from "@/components/session/stream-badges";
import { ButtonLink } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BundleBoard, type AiBundle } from "@/components/vendor/bundle-board";
import { OutcomeForm } from "@/components/vendor/outcome-form";
import { summarizeConsent } from "@/lib/bundle-consent";
import { findComplex } from "@/lib/complexes";
import { formatNumber, formatSigned } from "@/lib/format";
import { bundleConsents } from "@/lib/server/bundle-consent";
import { getCompanies } from "@/lib/server/companies";
import { termsText } from "@/lib/server/mock/negotiation";
import { passports } from "@/lib/server/mock/passport";
import { MIN_KG } from "@/lib/server/mock/pipeline";
import { requireOrganization } from "@/lib/server/organization";
import { outbox, sessions } from "@/lib/server/sessions";
import type { BundleGroup, OutboxMessage, Session, Stream, StreamDecision } from "@/lib/session/types";

export const metadata: Metadata = { title: "업체 화면" };

const MESSAGE_STATUS: Record<OutboxMessage["status"], { label: string; tone: BadgeTone }> = {
  sent: { label: "새 요청", tone: "warn" },
  read: { label: "읽음", tone: "neutral" },
  replied: { label: "회신함", tone: "neutral" },
  completed: { label: "수거 완료", tone: "gain" },
};

const KIND_LABEL: Record<OutboxMessage["kind"], string> = {
  pickup: "순회 수거 요청서",
  quote: "매각 견적 요청",
  "bundle-invite": "묶음 참여 제안",
};

/** 요청서가 가리키는 흐름. 순회 수거는 이 업체가 수거 업체인 묶음, 견적은 이 업체가 매입처인 매각 흐름 */
type Target = { stream: Stream; decision?: StreamDecision; bundle?: BundleGroup };

function targetFor(s: Session, m: OutboxMessage): Target | null {
  const bundles = s.matching?.bundles ?? [];
  const partners = s.matching?.partners ?? [];
  const streamId =
    m.kind === "pickup"
      ? bundles.find((b) => b.collector.companyId === m.toCompanyId)?.streamId
      : m.kind === "quote"
        ? partners.find((p) => p.route === "sell" && p.companyId === m.toCompanyId)?.streamId
        : bundles.find((b) => b.group.some((g) => g.companyId === m.toCompanyId))?.streamId;
  const stream = (s.streams ?? []).find((x) => x.id === streamId);
  if (!stream) return null;
  return {
    stream,
    decision: s.feasibility?.decisions.find((d) => d.streamId === stream.id),
    bundle: bundles.find((b) => b.streamId === stream.id),
  };
}

function gradeLabel(st: Stream) {
  return `${st.classify.material} ${st.classify.singleMaterial ? "단일" : "혼합"} · ${st.origin === "PCR" ? "사용 후(PCR)" : "공정 부산물(PIR)"}`;
}

function perKgNote(t: Target) {
  return t.decision?.route === "bundle" ? "묶음 운반비 분담 후, 배출 기업 기준" : undefined;
}

/** 진단 하나에 흐름별 결과가 여러 건 쌓인다. 예전 기록(outcome 하나)도 읽는다 */
function outcomesOf(s: Session) {
  return s.outcomes ?? (s.outcome ? [s.outcome] : []);
}

function OutcomeComparison({ o, t }: { o: NonNullable<Session["outcome"]>; t: Target }) {
  const pred = t.decision?.afterPerKg ?? null;
  const rows: { label: string; ai: string; actual: string; aiNum?: boolean; actualNum?: boolean }[] = [
    { label: "매입 여부", ai: "매입 예상", actual: o.accepted ? "매입함" : "매입 거절" },
    { label: "등급·재질", ai: gradeLabel(t.stream), actual: o.actualGrade },
    { label: "단가 (원/kg)", ai: pred !== null ? formatSigned(pred) : "—", actual: o.accepted ? formatSigned(o.actualPerKg) : "—", aiNum: pred !== null, actualNum: o.accepted },
    { label: "수거량 (kg)", ai: formatNumber(t.stream.monthlyKg), actual: formatNumber(o.actualKg), aiNum: true, actualNum: true },
  ];
  const gap = pred !== null && o.accepted ? o.actualPerKg - pred : null;
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t.stream.name} 흐름의 AI 예상과 업체가 기록한 실제 결과 비교</caption>
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
        {gap !== null ? (
          <>
            실제 단가가 예상보다 <span className="tabular-nums">{formatNumber(Math.abs(gap))}</span>원/kg {gap < 0 ? "낮았습니다" : gap > 0 ? "높았습니다" : "같았습니다"}.{" "}
          </>
        ) : null}
        {o.recordedBy}({o.recorderRole})가 <span className="tabular-nums">{formatDateTime(o.recordedAt)}</span>에 기록했습니다.
        {o.reason ? ` 메모: ${o.reason}` : ""} 이 기록은 다음 모델 학습에 쓰입니다.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
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
  const issued = new Map((await passports.all()).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)).map((p) => [`${p.sessionId}:${p.streamId}`, p.id]));
  const byId = new Map(allSessions.map((s) => [s.id, s]));
  const targets = new Map(messages.map((m) => [m.id, byId.get(m.sessionId) ? targetFor(byId.get(m.sessionId)!, m) : null]));
  // 결과를 받을 수 있는 첫 요청서만 펼치고 기록 버튼을 검정으로 둔다(한 화면에 검정 버튼 하나)
  const firstOpen = messages.find((m) => {
    const s = byId.get(m.sessionId);
    const t = targets.get(m.id);
    return (m.kind === "pickup" || m.kind === "quote") && s?.status === "sent" && t && !outcomesOf(s).some((o) => o.streamId === t.stream.id);
  });

  const approvedA = allSessions.filter((s) => s.approval && s.approval.routeId === "A");
  const consentsBySession = new Map(await Promise.all(approvedA.map(async (s) => [s.id, await bundleConsents(s)] as const)));
  const aiBundles: AiBundle[] = approvedA
    .flatMap((s) =>
      (s.matching?.bundles ?? [])
        .filter((b) => b.collector.companyId === vendor.id)
        .map((b) => {
          const st = (s.streams ?? []).find((x) => x.id === b.streamId);
          const sum = summarizeConsent(b, consentsBySession.get(s.id)?.get(b.streamId) ?? []);
          return {
            consent: { accepted: sum.accepted, invited: sum.invited, pending: sum.pending },
            key: `${s.id}:${b.streamId}`,
            sessionId: s.id,
            streamId: b.streamId,
            streamName: st?.name ?? "흐름",
            item: b.item,
            detail: st?.classify.detail ?? b.item,
            mode: b.mode,
            totalKg: b.totalKg,
            truckKg: b.truckKg,
            fillRate: b.fillRate,
            members: b.group.map((g) => ({ name: g.name, kg: g.kg })),
            schedule: b.schedule,
            done: outcomesOf(s).some((o) => o.streamId === b.streamId),
          };
        }),
    );

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-h1">업체 화면</h1>
            <p className="mt-1 text-sm text-muted">
              처리업체가 받은 순회 수거 요청서와 매각 견적 요청을 보고, 수거한 뒤 흐름별 실제 등급·단가·매입 여부를 기록하는 화면입니다.
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
                    {newCount(v.id) > 0 ? (
                      <span className="text-[12px] font-medium text-ink-2">
                        새 요청 <span className="tabular-nums">{newCount(v.id)}</span>
                      </span>
                    ) : null}
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
          <p className="text-[13px] text-muted">배출 기업 담당자가 진단 마지막 단계에서 승인한 순회 수거 요청서와 매각 견적 요청입니다. 요청서 하나가 공장의 흐름 하나를 가리킵니다.</p>
        </div>
        {messages.length === 0 ? (
          <EmptyState
            title={`${vendor.name}에 도착한 요청이 아직 없습니다`}
            description="요청서는 배출 기업 담당자가 진단의 마지막 단계(이행안·승인)에서 발송 내용을 확인하고 승인해야 나갑니다. 사람이 승인하기 전에는 외부로 아무것도 발송되지 않습니다. 이 업체가 순회 수거 업체나 매입처로 선택된 진단을 승인하면 여기에 나타납니다."
            action={
              <ButtonLink href="/session" variant="secondary">
                내 진단에서 승인하기
              </ButtonLink>
            }
          />
        ) : (
          <ul className="grid gap-4">
            {messages.map((m) => {
              const s = byId.get(m.sessionId);
              const t = targets.get(m.id) ?? null;
              const own = s && t ? outcomesOf(s).find((o) => o.streamId === t.stream.id) : undefined;
              // 이 요청서가 가리키는 흐름의 결과가 있을 때만 완료로 보인다
              const st = MESSAGE_STATUS[own ? "completed" : m.status === "completed" ? "read" : m.status];
              return (
                <li key={m.id} className="rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[12px] text-muted">
                        <span className="font-semibold text-ink-2">{KIND_LABEL[m.kind]}</span> · {m.fromOrg} ·{" "}
                        <span className="tabular-nums">{formatDateTime(m.sentAt)}</span>
                      </p>
                      <h3 className="mt-0.5 text-[16px] font-semibold">{m.subject}</h3>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {s && t ? (
                    <div className="grid gap-6 px-5 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                      <dl className="grid content-start gap-2 text-sm">
                        <Row label="흐름">
                          <span className="font-semibold">{t.stream.name}</span>
                          <span className="block text-[12px] text-muted">{t.stream.classify.detail}</span>
                        </Row>
                        <Row label="출처">
                          <OriginChip origin={t.stream.origin} source={t.stream.originSource} />
                        </Row>
                        {t.decision ? (
                          <Row label="AI 경로">
                            <RouteBadge route={t.decision.route} size="sm" />
                          </Row>
                        ) : null}
                        <Row label="이 사업장 월 물량 (kg)">
                          <span className="num font-semibold">{formatNumber(t.stream.monthlyKg)}</span>
                        </Row>
                        {m.kind === "pickup" && t.bundle ? (
                          <>
                            <Row label="묶음">
                              {t.bundle.mode} · <span className="tabular-nums">{t.bundle.group.length}</span>개 사업장
                              <span className="block text-[12px] text-muted">
                                월 합계 <span className="tabular-nums">{formatNumber(t.bundle.totalKg)}</span>kg · 1톤 트럭 적재율{" "}
                                <span className="tabular-nums">{Math.round(t.bundle.fillRate * 100)}%</span>
                              </span>
                            </Row>
                            <Row label="수거 주기">{t.bundle.schedule}</Row>
                            {(() => {
                              const n = s.negotiations?.find((x) => x.streamId === t.stream.id);
                              if (!n) return null;
                              return (
                                <Row label="에이전트 협상">
                                  {n.status === "approved" ? "합의 · 배출 기업 승인 완료" : n.status === "agreed" ? "합의 · 배출 기업 승인 대기" : "합의 실패"}
                                  {n.agreed ? <span className="num block text-[12px] text-muted">{termsText(n.agreed)}</span> : null}
                                </Row>
                              );
                            })()}
                          </>
                        ) : (
                          <Row label="수거 주기">협의</Row>
                        )}
                        <Row label="AI 예상 단가 (원/kg)">
                          <span className="num font-semibold">{t.decision ? formatSigned(t.decision.afterPerKg) : "—"}</span>
                          {perKgNote(t) ? <span className="block text-[12px] text-muted">{perKgNote(t)}</span> : null}
                        </Row>
                      </dl>
                      <div className="min-w-0">
                        {own ? (
                          <>
                            <OutcomeComparison o={own} t={t} />
                            {issued.get(`${s.id}:${t.stream.id}`) ? (
                              <p className="mt-3 text-[13px]">
                                재생원료 여권 <span className="num">{issued.get(`${s.id}:${t.stream.id}`)}</span> ·{" "}
                                <Link href={`/passport/${issued.get(`${s.id}:${t.stream.id}`)}`} className="font-semibold underline underline-offset-4">
                                  여권 보기
                                </Link>
                              </p>
                            ) : null}
                          </>
                        ) : m.kind === "bundle-invite" ? (
                          <p className="text-sm text-muted">묶음 참여 제안은 참여 여부만 회신합니다. 실제 결과는 순회 수거 요청서를 받은 수거 업체가 사업장별로 기록합니다.</p>
                        ) : (
                          <details open={m.id === firstOpen?.id} className="group">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
                              {t.stream.name} 수거 후 실제 결과 기록
                              <span aria-hidden="true" className="text-muted group-open:rotate-180">
                                ▾
                              </span>
                            </summary>
                            <div className="pt-4">
                              <OutcomeForm
                                sessionId={s.id}
                                streamId={t.stream.id}
                                streamName={t.stream.name}
                                primary={m.id === firstOpen?.id}
                                prediction={{
                                  gradeLabel: gradeLabel(t.stream),
                                  perKg: t.decision?.afterPerKg ?? null,
                                  perKgNote: perKgNote(t),
                                  kg: t.stream.monthlyKg,
                                }}
                              />
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="px-5 py-4 text-sm text-muted">{s ? "요청서가 가리키는 흐름을 진단에서 찾을 수 없습니다." : "원본 진단을 찾을 수 없습니다."}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BundleBoard vendor={vendor} companies={companies} aiBundles={aiBundles} pickup={MIN_KG} />
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
