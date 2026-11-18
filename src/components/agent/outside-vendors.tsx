"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { useEscape } from "@/components/use-escape";
import { ClaimText, ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { StatusChip } from "@/components/v3/status-chip";
import { api } from "@/lib/v3/api";
import {
  copyText,
  groupOutside,
  groupTitle,
  matchLabel,
  OUTSIDE_LEAD,
  outsideHeadline,
  phoneText,
  sourceLine,
  uniqueCandidates,
} from "@/lib/v3/outside";
import type { OutsideCandidate, OutsideVendors, QuoteRequest, ViewStream } from "@/lib/v3/types";

const SHOWN = 3;

function Candidate({ candidate, onRequest }: { candidate: OutsideCandidate; onRequest: () => void }) {
  const { openEvidence } = useV3();
  return (
    <li className="grid gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{candidate.name}</span>
          <StatusChip tone={candidate.match === "confirmed" ? "neutral" : "warn"}>{matchLabel(candidate)}</StatusChip>
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          {candidate.business} · 직선 <ClaimValue claim={candidate.distance} title={`${candidate.name}까지 직선거리`} /> ·{" "}
          {phoneText(candidate)}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted">{candidate.address}</p>
        {candidate.note ? <p className="mt-1 text-[13px] text-warn">{candidate.note}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEvidence(candidate.evidence, `${candidate.name} 허가 정보`)}>
          허가 정보
        </Button>
        <Button variant="secondary" size="sm" onClick={onRequest}>
          견적 요청서
        </Button>
      </div>
    </li>
  );
}

function QuoteSheet({
  sessionId,
  orgId,
  streamId,
  candidate,
  onClose,
}: {
  sessionId: string;
  orgId: string;
  streamId: string;
  candidate: OutsideCandidate;
  onClose: () => void;
}) {
  const { openEvidence } = useV3();
  const [letter, setLetter] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .quoteRequest(sessionId, orgId, streamId, candidate.id)
      .then((next) => {
        if (alive) setLetter(next);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : "요청서를 만들지 못했습니다. 잠시 후 다시 열어 주세요.");
      });
    return () => {
      alive = false;
    };
  }, [sessionId, orgId, streamId, candidate.id]);
  useEscape(true, onClose);

  async function copy() {
    if (!letter) return;
    await navigator.clipboard.writeText(copyText(letter.rendered, contact));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="견적 요청서 닫기" className="absolute inset-0 bg-ink/25" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="견적 요청서"
        className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-bg shadow-[0_0_60px_rgb(0_0_0/0.18)] [animation:rs-panel_240ms_var(--ease-out)_both]"
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em]">견적 요청서 · {candidate.name}</h2>
            <p className="text-[13px] text-muted">앱에서 보내지 않습니다. 복사해서 메일이나 팩스로 보내 주세요.</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="견적 요청서 닫기"
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-5 py-5">
          {error ? <p className="text-sm text-loss">{error}</p> : null}
          {!letter && !error ? <p className="text-sm text-muted">요청서를 만들고 있습니다.</p> : null}
          {letter ? (
            <>
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl bg-ground px-4 py-3 text-[14px]">
                <dt className="text-muted">받는 곳</dt>
                <dd className="font-medium">{letter.recipient.name}</dd>
                <dt className="text-muted">주소</dt>
                <dd>{letter.recipient.address}</dd>
                <dt className="text-muted">전화</dt>
                <dd>{phoneText(candidate)}</dd>
                <dt className="text-muted">허가</dt>
                <dd>
                  {letter.recipient.business}
                  <button
                    type="button"
                    onClick={() => openEvidence(letter.recipient.evidence, `${letter.recipient.name} 허가 정보`)}
                    className="ml-2 text-[13px] text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink"
                  >
                    근거
                  </button>
                </dd>
              </dl>
              <article className="mt-5 rounded-xl border border-line px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                <ClaimText text={letter.text} claims={letter.claims} />
              </article>
              <label className="mt-5 block text-[13px] font-medium text-ink-2" htmlFor="quote-contact">
                회신 받을 연락처
              </label>
              <input
                id="quote-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="이메일이나 전화번호"
                className="mt-1.5 min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted"
              />
              <p className="mt-1.5 text-[12px] text-muted">적은 연락처는 저장하지 않고 복사할 글 끝에만 붙습니다.</p>
            </>
          ) : null}
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <Button onClick={copy} disabled={!letter}>
            {copied ? "복사했습니다" : "복사하기"}
          </Button>
          <span aria-live="polite" className="sr-only">
            {copied ? "견적 요청서를 복사했습니다" : ""}
          </span>
        </footer>
      </aside>
    </div>
  );
}

/** 결과 아래: 공공데이터 허가 명부에서 찾은, 아직 가입하지 않은 업체 후보와 견적 요청서 */
export function OutsideVendorsSection({
  outside,
  streams,
  sessionId,
  orgId,
}: {
  outside: OutsideVendors;
  streams: ViewStream[];
  sessionId: string;
  orgId: string;
}) {
  const [open, setOpen] = useState<{
    streamId: string;
    candidate: OutsideCandidate;
  } | null>(null);
  const count = uniqueCandidates(outside);
  const nameOf = (id: string) => {
    const stream = streams.find((item) => item.id === id);
    return stream?.name ?? stream?.label ?? "폐기물";
  };
  return (
    <section aria-label="가입하지 않은 업체" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{outsideHeadline(count)}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{OUTSIDE_LEAD}</p>
      <div className="mt-4 space-y-6">
        {groupOutside(outside).map((group) => {
          const names = group.streamIds.map(nameOf);
          const first = group.candidates.slice(0, SHOWN);
          const rest = group.candidates.slice(SHOWN);
          const ask = (candidate: OutsideCandidate) => setOpen({ streamId: group.streamIds[0], candidate });
          return (
            <div key={group.streamIds.join("|")}>
              <h3 className="text-[14px] font-medium text-muted">{groupTitle(names)}</h3>
              {group.candidates.length === 0 ? (
                <p className="mt-1 text-[14px] text-ink-2">{group.reason ?? "가까운 곳에 맞는 업체가 명부에 없습니다."}</p>
              ) : (
                <>
                  <ul className="divide-y divide-line border-b border-line">
                    {first.map((candidate) => (
                      <Candidate key={candidate.id} candidate={candidate} onRequest={() => ask(candidate)} />
                    ))}
                  </ul>
                  {rest.length > 0 ? (
                    <MoreDetails label={`${rest.length}곳 더 보기`} closeLabel="접기">
                      <ul className="divide-y divide-line border-b border-line">
                        {rest.map((candidate) => (
                          <Candidate key={candidate.id} candidate={candidate} onRequest={() => ask(candidate)} />
                        ))}
                      </ul>
                    </MoreDetails>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">{sourceLine(outside)}</p>
      {open ? (
        <QuoteSheet sessionId={sessionId} orgId={orgId} streamId={open.streamId} candidate={open.candidate} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}
