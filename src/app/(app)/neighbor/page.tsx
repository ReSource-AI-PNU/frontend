import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/components/dashboard/format-date";
import { InviteReply } from "@/components/neighbor/invite-reply";
import { OriginChip } from "@/components/session/stream-badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreDetails } from "@/components/ui/more-details";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CONSENT_LABEL, CONSENT_TONE, summarizeConsent } from "@/lib/bundle-consent";
import { findComplex } from "@/lib/complexes";
import { formatNumber, formatSigned } from "@/lib/format";
import { josa } from "@/lib/josa";
import { bundleConsents } from "@/lib/server/bundle-consent";
import { getCompanies } from "@/lib/server/companies";
import { requireOrganization } from "@/lib/server/organization";
import { outbox, sessions } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "이웃 기업 화면" };

const pct = (r: number) => `${Math.round(r * 100)}%`;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * 이웃 기업 화면. 같은 단지의 다른 배출 기업이 받은 묶음 참여 제안을 보고 참여 여부를 회신한다.
 * 시연에서는 한 계정이 제안을 받은 기업 시점으로 바꿔 보고, 회신은 제안한 기업의 매칭·이행안 화면에 바로 반영된다.
 */
async function NeighborPageContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { as } = await searchParams;
  const org = await requireOrganization();
  const complex = findComplex(org.complexId);
  const companies = await getCompanies(org.complexId);
  const byCompany = new Map(companies.map((c) => [c.id, c]));
  const invites = (await outbox.filter((m) => m.kind === "bundle-invite" && byCompany.has(m.toCompanyId))).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const recipients = [...new Set(invites.map((m) => m.toCompanyId))].map((id) => byCompany.get(id)!);
  const pendingOf = (id: string) => invites.filter((m) => m.toCompanyId === id && !m.reply).length;
  const me = recipients.find((c) => c.id === as) ?? recipients.find((c) => pendingOf(c.id) > 0) ?? recipients[0];
  // 주소에 기업을 고정해 둔다. 회신한 뒤 다시 그릴 때 회신 대기 중인 다른 기업으로 넘어가지 않게 한다
  if (me && as !== me.id) redirect(`/neighbor?as=${me.id}`);

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 px-6 py-10 lg:px-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-h1">이웃 기업 화면</h1>
            <p className="mt-1 text-sm text-muted">
              같은 단지의 다른 배출 기업이 받은 묶음 참여 제안입니다. 혼자서는 양이 적어 아무도 가지러 오지 않던 흐름을, 이웃과 묶어 트럭을 채우자는 제안에
              참여 여부를 회신합니다.
            </p>
          </div>
          <Badge tone="neutral">이웃 기업 시점 시연</Badge>
        </div>
        {recipients.length ? (
          <div className="grid gap-3 rounded-md border border-line bg-surface px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <p className="text-[13px] text-ink-2">
              시연에서는 한 계정이 제안을 받은 {complex?.shortName ?? "단지"} 기업 중 하나의 시점으로 바꿔 봅니다. 실제 서비스에서는 그 기업 담당자가 자기 계정으로
              들어옵니다.
            </p>
            <nav aria-label="시점으로 볼 이웃 기업">
              <ul className="flex flex-wrap gap-1 rounded-md bg-sunken p-1">
                {recipients.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/neighbor?as=${c.id}`}
                      aria-current={c.id === me?.id ? "page" : undefined}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold whitespace-nowrap text-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                    >
                      <span aria-hidden="true" className="inline-block size-2 rounded-full bg-current" />
                      {c.name}
                      {pendingOf(c.id) > 0 ? (
                        <span className="text-[12px] font-medium text-ink-2">
                          새 제안 <span className="tabular-nums">{pendingOf(c.id)}</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
      </header>

      {!me ? (
        <EmptyState
          title="아직 도착한 묶음 참여 제안이 없습니다"
          description="묶음 참여 제안은 배출 기업 담당자가 진단의 마지막 단계(이행안·승인)에서 A. 흐름별 최적안을 승인해야 나갑니다. 단지 묶음 매각으로 판정한 흐름이 있는 진단을 승인하면 여기에 나타납니다."
          action={
            <ButtonLink href="/session" variant="secondary">
              내 진단에서 승인하기
            </ButtonLink>
          }
        />
      ) : (
        <section aria-labelledby="invites-title" className="grid gap-4">
          <div>
            <h2 id="invites-title" className="text-h2">
              {josa(me.name, "이/가")} 받은 제안
            </h2>
            <p className="text-[13px] text-muted">
              {me.industry} · 제안 {invites.filter((m) => m.toCompanyId === me.id).length}건
            </p>
          </div>
          <ul className="grid gap-4">
            {await Promise.all(
              invites
                .filter((m) => m.toCompanyId === me.id)
                .map(async (m) => {
                  const s = await sessions.get(m.sessionId);
                  const bundle = s?.matching?.bundles.find((b) => b.streamId === m.streamId) ?? s?.matching?.bundles[0];
                  const stream = s?.streams.find((x) => x.id === bundle?.streamId);
                  const decision = s?.feasibility?.decisions.find((d) => d.streamId === bundle?.streamId);
                  const mine = bundle?.group.find((g) => g.companyId === me.id);
                  if (!s || !bundle || !stream || !mine) {
                    return (
                      <li key={m.id} className="rounded-lg border border-line px-5 py-4 text-sm text-muted">
                        제안이 가리키는 진단을 찾을 수 없습니다.
                      </li>
                    );
                  }
                  const consents = (await bundleConsents(s)).get(bundle.streamId) ?? [];
                  const summary = summarizeConsent(bundle, consents);
                  const share = bundle.costShare.find((c) => c.companyId === me.id)?.sharePct ?? 0;
                  const position = (bundle.visitOrder ?? []).indexOf(me.id);
                  const state = m.reply?.decision ?? "pending";
                  const gain = decision ? Math.round((decision.afterPerKg - decision.currentPerKg) * mine.kg) : null;
                  return (
                    <li key={m.id} className="rounded-lg border border-line bg-surface">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[12px] text-muted">
                            <span className="font-semibold text-ink-2">묶음 참여 제안</span> · {m.fromOrg} ·{" "}
                            <span className="tabular-nums">{formatDateTime(m.sentAt)}</span>
                          </p>
                          <h3 className="mt-0.5 text-[16px] font-semibold">{m.subject}</h3>
                        </div>
                        <Badge tone={CONSENT_TONE[state]}>{CONSENT_LABEL[state]}</Badge>
                      </div>

                      <div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="min-w-0">
                          <p className="text-[15px] leading-relaxed tabular-nums">
                            {me.name}의 {stream.classify.detail} 월 {formatNumber(mine.kg)}kg은 혼자서는{" "}
                            {(bundle.truckKg / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}톤 트럭의 {pct(mine.kg / bundle.truckKg)}입니다.{" "}
                            <b className="font-semibold">
                              같은 단지 {bundle.group.length}개사가 묶이면 월 {formatNumber(bundle.totalKg)}kg, 적재율 {pct(bundle.fillRate)}
                            </b>
                            가 되어 업체가 정기적으로 가지러 옵니다.
                          </p>
                          <dl className="mt-3 border-t border-line text-sm">
                            <Row label="우리 회사 월 물량">
                              <span className="num font-semibold">{formatNumber(mine.kg)}kg</span>
                              <span className="ml-2 text-[12.5px] text-muted">다른 회사 물량은 서로 보지 않습니다.</span>
                            </Row>
                            <Row label="운반비 분담">
                              <span className="num font-semibold">{share.toFixed(1)}%</span>
                              <span className="ml-2 text-[12.5px] text-muted">월 물량 비율</span>
                            </Row>
                            {decision && gain !== null ? (
                              <Row label="예상 효과">
                                <span className="num font-semibold text-gain">{formatSigned(decision.afterPerKg)}원/kg</span>
                                <span className="ml-2 text-[12.5px] text-muted">지금 소각한다면 월 {formatSigned(gain)}원 개선(가정)</span>
                              </Row>
                            ) : null}
                          </dl>
                          <MoreDetails label="제안 상세 보기" closeLabel="제안 상세 접기" hint="품목·수거 업체·일정·순회 순서·계약 방식">
                            <dl className="border-t border-line text-sm">
                              <Row label="품목">
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  {stream.classify.detail}
                                  <OriginChip origin={stream.origin} source="human" />
                                </span>
                              </Row>
                              <Row label="수거 업체">
                                {bundle.collector.name} · 허가 {bundle.collector.permits.join(", ") || "없음"}
                              </Row>
                              <Row label="수거 일정">{bundle.schedule}</Row>
                              {position >= 0 ? (
                                <Row label="순회 순서">
                                  {bundle.group.length}곳 중 <span className="num font-semibold">{position + 1}</span>번째
                                  {bundle.routeM ? <span className="ml-2 text-[12.5px] text-muted">전체 약 {(bundle.routeM / 1000).toFixed(1)}km</span> : null}
                                </Row>
                              ) : null}
                              {decision ? (
                                <Row label="예상 효과 계산">
                                  <span className="text-[13px] text-ink-2">
                                    운반비 분담 후 kg당 {formatSigned(decision.afterPerKg)}원, 지금 소각 위탁비 kg당 {formatNumber(Math.abs(decision.currentPerKg))}원(가정)의 차이
                                  </span>
                                </Row>
                              ) : null}
                            </dl>
                            <p className="mt-3 rounded-md bg-sunken px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
                              <b className="font-semibold text-ink">순회 수거:</b> 각 사업장이 {josa(bundle.collector.name, "와/과")} 따로 계약하고, 업체가 사업장을 차례로
                              돌며 사업장마다 계량하고 전자인계서를 씁니다. 폐기물을 한곳에 모아 두는 공동 보관은 하지 않습니다(「폐기물관리법 시행규칙」
                              제21조제1항제7호의2).
                            </p>
                          </MoreDetails>
                        </div>

                        <div className="grid content-start gap-4">
                          <div className="rounded-md border border-line px-4 py-3.5">
                            <p className="text-sm font-semibold">
                              묶음 참여 현황 <span className="num">{summary.accepted}</span>/<span className="num">{summary.invited}</span>
                            </p>
                            <p className="mt-1 text-[13px] text-ink-2">
                              {summary.settled
                                ? "참여 기업이 모두 동의해 묶음이 확정되었습니다."
                                : summary.pending > 0
                                  ? `${summary.pending}곳의 회신을 기다리고 있습니다.`
                                  : "참여하지 않은 기업이 있어 제안한 기업이 다음 후보를 찾고 있습니다."}
                            </p>
                            <p className="mt-1 text-[12.5px] text-muted">다른 기업의 이름과 물량은 보이지 않습니다.</p>
                          </div>
                          {m.reply ? (
                            <p className="text-[13px] text-ink-2">
                              {m.reply.by} · <span className="tabular-nums">{formatDateTime(m.reply.at)}</span>에 &ldquo;{CONSENT_LABEL[m.reply.decision]}&rdquo;로
                              회신했습니다.
                              {m.reply.reason ? ` 사유: ${m.reply.reason}` : ""}
                            </p>
                          ) : null}
                          <InviteReply key={`${m.id}-${m.reply?.at ?? "none"}`} messageId={m.id} companyName={me.name} replied={Boolean(m.reply)} />
                        </div>
                      </div>
                    </li>
                  );
                }),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function NeighborPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute view="neighbor" />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NeighborPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
