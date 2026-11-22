"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { useV3 } from "@/components/v3/context";
import { ClaimValue } from "@/components/v3/claim";
import { StatusChip } from "@/components/v3/status-chip";
import { formatNumber } from "@/lib/v3/format";
import {
  candidateLine,
  COMPLEX_LEAD,
  complexHeadline,
  complexSourceLine,
  complexStatsLead,
  complexStreamIds,
  groupComplex,
  moreLine,
  permitChip,
  quoteVendorId,
  resinChip,
  TAKES_TITLE,
  UNLISTED_NOTE,
  USES_NOTE,
  USES_TITLE,
} from "@/lib/v3/complex";
import { groupTitle } from "@/lib/v3/outside";
import type { ComplexCandidate, ComplexPartners, OutsideVendors, ViewStream } from "@/lib/v3/types";
import { ComplexPlanView } from "./complex-plan";
import { itemsOf, QuoteSheet, type QuoteTarget } from "./outside-vendors";

const SHOWN = 3;

/** 단지 전체 폐합성수지 발생·처리(2024 공공 통계). 값을 누르면 통계표 원문 근거가 열린다. 회사 계산에는 쓰지 않는다 */
function ComplexStats({ stats }: { stats: NonNullable<ComplexPartners["stats"]> }) {
  const { generated, recycled, incinerated } = stats.values;
  const tons = (claim: typeof generated) =>
    typeof claim.value === "number" ? `${formatNumber(Math.round(claim.value))}톤` : "확인 필요";
  return (
    <p className="mt-3 border-l-2 border-line-strong pl-3.5 text-[13px] leading-relaxed text-ink-2">
      {complexStatsLead(stats)}: 연 <ClaimValue claim={generated} display={tons(generated)} title="단지 폐합성수지 발생량" /> · 재활용{" "}
      <ClaimValue claim={recycled} display={tons(recycled)} title="단지 폐합성수지 재활용" /> · 소각{" "}
      <ClaimValue claim={incinerated} display={tons(incinerated)} title="단지 폐합성수지 소각" />
      <span className="text-muted"> · 회사별 값이 아니며 계산에는 쓰지 않습니다.</span>
    </p>
  );
}

export function PartnerRow({ candidate, onRequest }: { candidate: ComplexCandidate; onRequest?: () => void }) {
  const { openEvidence } = useV3();
  const permit = candidate.role === "takes" ? permitChip(candidate) : null;
  const resin = resinChip(candidate);
  const line = candidateLine(candidate);
  return (
    <li className="py-3.5">
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{candidate.name}</span>
            {permit ? <StatusChip tone={permit.tone}>{permit.label}</StatusChip> : null}
            {candidate.product ? <StatusChip tone={resin.tone}>{resin.label}</StatusChip> : null}
          </p>
          {line ? <p className="mt-1 text-[13px] text-ink-2">{line}</p> : null}
          <p className="mt-0.5 truncate text-[13px] text-muted">{candidate.address}</p>
          {candidate.permit?.status === "unlisted" ? <p className="mt-1 text-[13px] text-warn">{UNLISTED_NOTE}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEvidence(candidate.evidence, `${candidate.name} 공공데이터`)}>
            근거
          </Button>
          {onRequest ? (
            <Button variant="secondary" size="sm" onClick={onRequest} aria-label={`${candidate.name} 견적 요청서`}>
              견적 요청서
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function PartnerList({
  candidates,
  total,
  onRequest,
}: {
  candidates: ComplexCandidate[];
  total: number;
  onRequest: (candidate: ComplexCandidate) => (() => void) | undefined;
}) {
  const first = candidates.slice(0, SHOWN);
  const rest = candidates.slice(SHOWN);
  const more = moreLine(total, candidates.length);
  const row = (candidate: ComplexCandidate) => (
    <PartnerRow key={candidate.id} candidate={candidate} onRequest={onRequest(candidate)} />
  );
  return (
    <>
      <ul className="divide-y divide-line border-b border-line">{first.map(row)}</ul>
      {rest.length > 0 ? (
        <MoreDetails label={`${rest.length}곳 더 보기`} closeLabel="접기">
          <ul className="divide-y divide-line border-b border-line">{rest.map(row)}</ul>
        </MoreDetails>
      ) : null}
      {more ? <p className="mt-1.5 text-[12.5px] text-muted">{more}</p> : null}
    </>
  );
}

/**
 * 결과 아래(가입하지 않은 업체 다음): 같은 산업단지에서 폐기물을 받아 재생원료로 만드는 곳과, 재생원료를 쓸 수 있는 곳.
 * 받는 곳은 바로 보이고, 쓰는 곳은 접어 둔다(요약 먼저). 허가 명부에 있는 받는 곳은 견적 요청서를 만들 수 있다.
 */
export function ComplexPartnersSection({
  partners,
  outside,
  streams,
  sessionId,
  orgId,
  onSearchAgain,
}: {
  partners: ComplexPartners;
  /** 같은 찾기의 가입하지 않은 업체 후보. 후보를 찾은 뒤 바뀐 폐기물 칸을 견적 요청서에서 알릴 때 쓴다 */
  outside: OutsideVendors | null;
  streams: ViewStream[];
  sessionId: string;
  orgId: string;
  onSearchAgain?: () => void;
}) {
  const { readOnly } = useV3();
  const [open, setOpen] = useState<{ target: QuoteTarget; streamId: string } | null>(null);
  const [contact, setContact] = useState("");
  const nameOf = (id: string) => {
    const stream = streams.find((item) => item.id === id);
    return stream?.name ?? stream?.label ?? "폐기물";
  };
  const openItems = open ? itemsOf(complexStreamIds(partners, open.target.id), streams) : [];

  if (!partners.complex) {
    return (
      <section aria-label="같은 단지 자원순환 후보" className="border-t border-line pt-6">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{complexHeadline(partners)}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{partners.reason}</p>
      </section>
    );
  }

  const requestFor = (groupStreamIds: string[]) => (candidate: ComplexCandidate) => {
    const vendorId = quoteVendorId(candidate);
    if (!vendorId) return undefined;
    return () => {
      const allowed = complexStreamIds(partners, vendorId);
      const streamId = groupStreamIds.find((id) => allowed.includes(id)) ?? allowed[0];
      if (!streamId) return;
      setOpen({
        target: { id: vendorId, name: candidate.name, phone: candidate.permit?.phone ?? null, agency: candidate.permit?.agency ?? null },
        streamId,
      });
    };
  };

  return (
    <section aria-label="같은 단지 자원순환 후보" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{complexHeadline(partners)}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{COMPLEX_LEAD}</p>
      {partners.stats ? <ComplexStats stats={partners.stats} /> : null}
      <div className="mt-4">
        <ComplexPlanView
          partners={partners}
          streams={streams}
          sessionId={sessionId}
          orgId={orgId}
          renderDetail={(candidate, streamIds) => (
            <PartnerRow key={candidate.id} candidate={candidate} onRequest={requestFor(streamIds)(candidate)} />
          )}
        />
      </div>
      <div className="mt-6 space-y-7">
        {groupComplex(partners).map((group) => {
          const key = group.streamIds.join("|");
          const empty = group.takes.length === 0 && group.uses.length === 0;
          return (
            <div key={key}>
              <h3 className="text-[14px] font-medium text-muted">{groupTitle(group.streamIds.map(nameOf))}</h3>
              {empty ? (
                <p className="mt-1 text-[14px] text-ink-2">{group.reason ?? "같은 단지에서 맞는 곳을 찾지 못했습니다."}</p>
              ) : (
                <>
                  <h4 className="mt-2 text-[13px] font-semibold text-ink-2">{TAKES_TITLE}</h4>
                  {group.takes.length > 0 ? (
                    <PartnerList candidates={group.takes} total={group.takesTotal} onRequest={requestFor(group.streamIds)} />
                  ) : (
                    <p className="mt-1 text-[14px] text-ink-2">같은 단지에서 찾지 못했습니다.</p>
                  )}
                  {group.uses.length > 0 ? (
                    <MoreDetails label={`${USES_TITLE} ${group.usesTotal}곳 보기`} closeLabel={`${USES_TITLE} 접기`}>
                      <p className="text-[13px] leading-relaxed text-ink-2">{USES_NOTE}</p>
                      <PartnerList candidates={group.uses} total={group.usesTotal} onRequest={() => undefined} />
                    </MoreDetails>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">{complexSourceLine(partners)}</p>
      {open && openItems.length > 0 ? (
        <QuoteSheet
          key={open.target.id}
          sessionId={sessionId}
          orgId={orgId}
          candidate={open.target}
          items={openItems}
          streamId={openItems.some((item) => item.id === open.streamId) ? open.streamId : openItems[0].id}
          outside={outside}
          contact={contact}
          demoView={readOnly}
          onSelect={(streamId) => setOpen((before) => (before ? { ...before, streamId } : before))}
          onContact={setContact}
          onClose={() => setOpen(null)}
          onSearchAgain={onSearchAgain}
        />
      ) : null}
    </section>
  );
}
