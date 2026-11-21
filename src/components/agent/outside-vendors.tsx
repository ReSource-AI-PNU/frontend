"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { useEscape } from "@/components/use-escape";
import { ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { StatusChip } from "@/components/v3/status-chip";
import { ApiError, api } from "@/lib/v3/api";
import { formatNumber } from "@/lib/v3/format";
import {
  changesText,
  factCounts,
  groupOutside,
  groupTitle,
  isQuoteFor,
  itemMeta,
  matchLabel,
  OUTSIDE_LEAD,
  outsideHeadline,
  phoneText,
  QUOTE_SAFE_NOTE,
  quoteCopy,
  quoteKey,
  quotePreview,
  sourceLine,
  streamChanges,
  uniqueCandidates,
  vendorStreamIds,
} from "@/lib/v3/outside";
import type { Claim, OutsideCandidate, OutsideVendors, QuoteRequest, ViewStream } from "@/lib/v3/types";

const SHOWN = 3;

/** 업체에 물을 수 있는 폐기물 하나(그 업체가 후보인 폐기물만) */
export type Item = { id: string; name: string; material: string | null; form: string | null; monthlyKg: Claim | null };

/** 견적 요청서를 만들 업체. 가입하지 않은 업체 후보와 같은 단지 후보(허가 명부에 있는 곳)가 함께 쓴다 */
export type QuoteTarget = Pick<OutsideCandidate, "id" | "name" | "phone" | "agency">;

/** 폐기물 ID 목록 → 문의할 폐기물 줄(지금 폐기물 목록에 있는 것만) */
export function itemsOf(streamIds: string[], streams: ViewStream[]): Item[] {
  return streamIds.flatMap((id) => {
    const stream = streams.find((item) => item.id === id);
    return stream ? [{ id, name: stream.name, material: stream.material, form: stream.form, monthlyKg: stream.monthlyKg }] : [];
  });
}

function itemsFor(outside: OutsideVendors, streams: ViewStream[], vendorId: string): Item[] {
  return itemsOf(vendorStreamIds(outside, vendorId), streams);
}

function MonthlyKg({ claim, name }: { claim: Claim | null; name: string }) {
  if (!claim || typeof claim.value !== "number") {
    return <span className="text-[13px] text-warn">월 물량 확인 필요</span>;
  }
  return (
    <span className="text-[13px] text-ink-2 tabular-nums">
      월 <ClaimValue claim={claim} display={`${formatNumber(claim.value)}kg`} title={`${name} 한 달 발생량`} />
    </span>
  );
}

/**
 * 문의할 폐기물 고르기. 이 업체가 후보인 폐기물만 나온다. 이름 · 재질 · 형태 · 월 물량(근거 열림)을 보이고,
 * 후보를 찾은 뒤 바뀐 칸이 있으면 그 줄에 미리 적는다(요청서를 만들 수 있는지는 서버가 지금 자료로 다시 본다).
 */
export function ItemPicker({
  name,
  items,
  selected,
  outside,
  onSelect,
  wide = false,
}: {
  name: string;
  items: Item[];
  selected: string;
  /** 후보를 찾은 뒤 바뀐 칸을 알릴 때 쓴다. 없으면 알리지 않는다 */
  outside: OutsideVendors | null;
  onSelect: (streamId: string) => void;
  /** 업체 카드처럼 폭이 넓으면 넓은 화면에서 두 열로 둔다 */
  wide?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[13px] font-medium text-ink-2">
        문의할 폐기물{items.length > 1 ? ` · ${items.length}가지 중 하나` : ""}
      </legend>
      <div className={`mt-1.5 grid gap-1.5 ${wide ? "sm:grid-cols-2" : ""}`}>
        {items.map((item) => {
          const checked = item.id === selected;
          const { changed, removed } = outside ? streamChanges(outside, item.id) : { changed: [], removed: false };
          return (
            <div
              key={item.id}
              className={`flex flex-wrap items-center gap-x-3 rounded-[10px] border px-3 ${checked ? "border-line-strong bg-sunken" : "border-line"}`}
            >
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[14px]">
                <input
                  type="radio"
                  name={name}
                  value={item.id}
                  checked={checked}
                  onChange={() => onSelect(item.id)}
                  className="size-4 shrink-0 accent-ink"
                />
                <span className="font-medium">{item.name}</span>
                <span className="text-[13px] text-muted">{itemMeta(item)}</span>
              </label>
              <MonthlyKg claim={item.monthlyKg} name={item.name} />
              {removed || changed.length > 0 ? (
                <p className="basis-full pb-2 text-[12.5px] text-warn">
                  {removed ? "후보를 찾은 뒤 지운 폐기물입니다." : `후보를 찾은 뒤 바뀜 · ${changesText(changed)}`}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function Candidate({
  candidate,
  pickerName,
  items,
  selected,
  outside,
  onSelect,
  onRequest,
}: {
  candidate: OutsideCandidate;
  pickerName: string;
  items: Item[];
  selected: string;
  outside: OutsideVendors;
  onSelect: (streamId: string) => void;
  onRequest: () => void;
}) {
  const { openEvidence } = useV3();
  const chosen = items.find((item) => item.id === selected);
  return (
    <li className="py-3.5">
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{candidate.name}</span>
            <StatusChip tone={candidate.match === "confirmed" ? "neutral" : "warn"}>{matchLabel(candidate)}</StatusChip>
            {candidate.sameComplex ? <StatusChip tone="neutral">같은 단지</StatusChip> : null}
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
          <Button
            variant="secondary"
            size="sm"
            disabled={!chosen}
            onClick={onRequest}
            aria-label={chosen ? `${candidate.name}에 ${chosen.name} 견적 요청서` : `${candidate.name} 견적 요청서`}
          >
            견적 요청서
          </Button>
        </div>
      </div>
      <div className="mt-2.5">
        {items.length > 0 ? (
          <ItemPicker name={pickerName} items={items} selected={selected} outside={outside} onSelect={onSelect} wide />
        ) : (
          <p className="text-[13px] text-muted">이 업체에 물을 수 있는 폐기물이 지금 자료에 없습니다.</p>
        )}
      </div>
    </li>
  );
}

type Loaded = { key: string; letter: QuoteRequest | null; error: { code: string; message: string } | null };

export function QuoteSheet({
  sessionId,
  orgId,
  candidate,
  items,
  streamId,
  outside,
  contact,
  demoView,
  onSelect,
  onContact,
  onClose,
  onSearchAgain,
}: {
  sessionId: string;
  orgId: string;
  candidate: QuoteTarget;
  items: Item[];
  streamId: string;
  outside: OutsideVendors | null;
  contact: string;
  demoView: boolean;
  onSelect: (streamId: string) => void;
  onContact: (value: string) => void;
  onClose: () => void;
  onSearchAgain?: () => void;
}) {
  const { openEvidence } = useV3();
  const key = quoteKey(candidate.id, streamId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .quoteRequest(sessionId, orgId, streamId, candidate.id)
      .then((next) => {
        // 다른 업체·폐기물로 바꾼 뒤 늦게 온 응답은 버린다(새 초안과 복사할 글을 덮지 않게)
        if (alive && isQuoteFor(next, candidate.id, streamId)) setLoaded({ key, letter: next, error: null });
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        const error =
          reason instanceof ApiError
            ? { code: reason.code, message: reason.message }
            : { code: "", message: reason instanceof Error ? reason.message : "요청서를 만들지 못했습니다. 잠시 후 다시 열어 주세요." };
        setLoaded({ key, letter: null, error });
      });
    return () => {
      alive = false;
    };
  }, [sessionId, orgId, streamId, candidate.id, key]);
  useEscape(true, onClose);

  // 지금 고른 업체·폐기물의 응답만 쓴다. 고르기를 바꾸면 새 응답이 올 때까지 미리보기와 복사를 비운다
  const current = loaded?.key === key ? loaded : null;
  const letter = current?.letter ?? null;
  const error = current?.error ?? null;
  const pieces = letter ? quotePreview(letter, contact) : [];
  const claims = new Map((letter?.claims ?? []).map((claim) => [claim.id, claim]));
  const counts = letter ? factCounts(letter.facts ?? []) : null;
  const chosen = items.find((item) => item.id === streamId);

  async function copy() {
    if (!letter) return;
    const at = key;
    try {
      await navigator.clipboard.writeText(quoteCopy(letter, contact));
      setCopyFailed(null);
      setCopied(at);
      window.setTimeout(() => setCopied((before) => (before === at ? null : before)), 2400);
    } catch {
      setCopyFailed(at);
    }
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
          {letter?.demo || demoView ? (
            <p className="mb-4 rounded-[10px] bg-warn-bg px-3.5 py-2.5 text-[13px] text-warn">
              시연 회사의 가상 자료로 만든 요청서입니다. 복사한 글의 처음과 끝에도 시연용 표시가 남습니다.
            </p>
          ) : null}
          {items.length > 1 ? (
            <ItemPicker name={`sheet-${candidate.id}`} items={items} selected={streamId} outside={outside} onSelect={onSelect} />
          ) : chosen ? (
            <p className="text-[14px]">
              <span className="text-muted">문의할 폐기물 · </span>
              <span className="font-medium">{chosen.name}</span> <span className="text-[13px] text-muted">{itemMeta(chosen)}</span>
            </p>
          ) : null}

          <div className="mt-5" aria-live="polite" aria-busy={!current}>
            {!current ? <p className="text-sm text-muted">{chosen ? `${chosen.name} 요청서를 만들고 있습니다.` : "요청서를 만들고 있습니다."}</p> : null}
            {error && error.code === "OUTSIDE_STALE" ? (
              <div className="rounded-[10px] bg-warn-bg px-4 py-3 text-[14px] leading-relaxed text-warn">
                <p className="font-medium">이 업체에 보낼 요청서를 만들지 않았습니다.</p>
                <p className="mt-1">{error.message}</p>
                {onSearchAgain ? (
                  <Button variant="secondary" size="sm" className="mt-2.5" onClick={onSearchAgain}>
                    새로 찾기
                  </Button>
                ) : null}
              </div>
            ) : error ? (
              <p className="text-sm text-loss">{error.message}</p>
            ) : null}
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
                {counts ? (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="mr-1 text-muted">요청서에 적은 값</span>
                    {counts.known ? <StatusChip tone="neutral">알린 값 {counts.known}</StatusChip> : null}
                    {counts.estimated ? <StatusChip tone="warn">추정 {counts.estimated}</StatusChip> : null}
                    {counts.unknown ? <StatusChip tone="warn">미확인 {counts.unknown}</StatusChip> : null}
                  </div>
                ) : null}
                {letter.changes && letter.changes.length > 0 ? (
                  <p className="mt-2 text-[13px] text-ink-2">
                    후보를 찾은 뒤 바뀐 자료({changesText(letter.changes)})로도 이 업체의 허가 품목에 맞아, 지금 자료로 요청서를 만들었습니다.
                  </p>
                ) : null}
                <p className="mt-4 text-[13px] font-medium text-ink-2">복사할 글 · 아래 글이 그대로 복사됩니다</p>
                <article
                  data-quote-key={key}
                  aria-label="복사할 견적 요청서"
                  className="mt-1.5 rounded-xl border border-line px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap"
                >
                  {pieces.map((piece, index) => {
                    if (piece.kind === "text") return <span key={index}>{piece.text}</span>;
                    const claim = claims.get(piece.claimId);
                    return claim ? (
                      <ClaimValue key={index} claim={claim} display={piece.display} hideAssumed inline />
                    ) : (
                      <span key={index}>{piece.display}</span>
                    );
                  })}
                </article>
                <label className="mt-5 block text-[13px] font-medium text-ink-2" htmlFor="quote-contact">
                  회신 받을 연락처
                </label>
                <input
                  id="quote-contact"
                  value={contact}
                  onChange={(event) => onContact(event.target.value)}
                  placeholder="이메일이나 전화번호"
                  className="mt-1.5 min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted"
                />
                <p className="mt-1.5 text-[12px] text-muted">적은 연락처는 저장하지 않고 복사할 글 끝에만 붙습니다.</p>
                <p className="mt-1 text-[12px] text-muted">{QUOTE_SAFE_NOTE}</p>
              </>
            ) : null}
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <Button onClick={copy} disabled={!letter}>
            {copied === key ? "복사했습니다" : "복사하기"}
          </Button>
          {copyFailed === key ? (
            <span className="text-[13px] text-loss">복사하지 못했습니다. 위 글을 직접 골라 복사해 주세요.</span>
          ) : null}
          <span aria-live="polite" className="sr-only">
            {copied === key ? "견적 요청서를 복사했습니다" : ""}
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
  onSearchAgain,
}: {
  outside: OutsideVendors;
  streams: ViewStream[];
  sessionId: string;
  orgId: string;
  /** 바뀐 자료로 다시 찾기(찾기 화면의 "새로 찾기"와 같다). 체험하기처럼 찾을 수 없으면 주지 않는다 */
  onSearchAgain?: () => void;
}) {
  const { readOnly } = useV3();
  // 업체마다 고른 폐기물. 카드와 요청서 시트가 같은 값을 쓴다
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<OutsideCandidate | null>(null);
  // 회신 연락처는 담당자 본인 것이라 업체를 바꿔도 남긴다(저장하지 않는다)
  const [contact, setContact] = useState("");
  const count = uniqueCandidates(outside);
  const nameOf = (id: string) => {
    const stream = streams.find((item) => item.id === id);
    return stream?.name ?? stream?.label ?? "폐기물";
  };
  const select = (vendorId: string, streamId: string) => setChoice((before) => ({ ...before, [vendorId]: streamId }));
  const pickedFor = (vendorId: string, items: Item[], fallback: string[]) =>
    choice[vendorId] && items.some((item) => item.id === choice[vendorId])
      ? choice[vendorId]
      : (fallback.find((id) => items.some((item) => item.id === id)) ?? items[0]?.id ?? "");
  const openItems = open ? itemsFor(outside, streams, open.id) : [];
  const openStream = open ? pickedFor(open.id, openItems, []) : "";
  return (
    <section aria-label="가입하지 않은 업체" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{outsideHeadline(count)}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{OUTSIDE_LEAD}</p>
      <div className="mt-4 space-y-6">
        {groupOutside(outside).map((group) => {
          const names = group.streamIds.map(nameOf);
          const first = group.candidates.slice(0, SHOWN);
          const rest = group.candidates.slice(SHOWN);
          const groupKey = group.streamIds.join("|");
          const card = (candidate: OutsideCandidate) => {
            const items = itemsFor(outside, streams, candidate.id);
            const selected = pickedFor(candidate.id, items, group.streamIds);
            return (
              <Candidate
                key={candidate.id}
                candidate={candidate}
                pickerName={`item-${groupKey}-${candidate.id}`}
                items={items}
                selected={selected}
                outside={outside}
                onSelect={(streamId) => select(candidate.id, streamId)}
                onRequest={() => {
                  select(candidate.id, selected);
                  setOpen(candidate);
                }}
              />
            );
          };
          return (
            <div key={groupKey}>
              <h3 className="text-[14px] font-medium text-muted">{groupTitle(names)}</h3>
              {group.candidates.length === 0 ? (
                <p className="mt-1 text-[14px] text-ink-2">{group.reason ?? "가까운 곳에 맞는 업체가 명부에 없습니다."}</p>
              ) : (
                <>
                  <ul className="divide-y divide-line border-b border-line">{first.map(card)}</ul>
                  {rest.length > 0 ? (
                    <MoreDetails label={`${rest.length}곳 더 보기`} closeLabel="접기">
                      <ul className="divide-y divide-line border-b border-line">{rest.map(card)}</ul>
                    </MoreDetails>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">{sourceLine(outside)}</p>
      {open && openStream ? (
        <QuoteSheet
          key={open.id}
          sessionId={sessionId}
          orgId={orgId}
          candidate={open}
          items={openItems}
          streamId={openStream}
          outside={outside}
          contact={contact}
          demoView={readOnly}
          onSelect={(streamId) => select(open.id, streamId)}
          onContact={setContact}
          onClose={() => setOpen(null)}
          onSearchAgain={onSearchAgain}
        />
      ) : null}
    </section>
  );
}
