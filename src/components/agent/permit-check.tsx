"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
import { StatusChip } from "@/components/v3/status-chip";
import {
  canRecordCheck,
  checkerText,
  permitLine,
  permitPaper,
  permitScope,
  permitSource,
  permitState,
  permitTodo,
} from "@/lib/v3/permit";
import type { BlockedRoute, PermitCheckInput, PermitLevel } from "@/lib/v3/types";

const link = "text-[13px] text-muted underline underline-offset-4 hover:text-ink";

/** 허가 확인 상태 칩 하나(결과표 줄, 승인 카드, 법령 요건 줄이 같은 낱말과 색을 쓴다) */
export function PermitChip({ permit }: { permit: PermitLevel | null | undefined }) {
  const state = permitState(permit);
  if (!state) return null;
  return <StatusChip tone={state.tone}>{state.label}</StatusChip>;
}

/**
 * 결과표 줄 아래에 늘 보이는 허가 한 줄: 칩 + 누가·언제·무엇을 확인했는지(또는 제출받을 문서) + 근거.
 * 확인이 필요한 것은 접지 않는다(DESIGN.md 요약 먼저, 행동해야 하는 것은 펼쳐 둔다).
 */
export function PermitSummary({ permit, vendorName }: { permit: PermitLevel; vendorName?: string | null }) {
  const { openEvidence } = useV3();
  const state = permitState(permit);
  if (!state) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <span className="text-muted">허가</span>
      <PermitChip permit={permit} />
      <span className="min-w-0 basis-full text-ink-2 sm:basis-auto sm:flex-1">
        {vendorName ? <span className="font-medium text-ink">{vendorName} · </span> : null}
        {permitLine(permit)}{" "}
        {permit.evidence.length > 0 ? (
          <button type="button" className={link} onClick={() => openEvidence(permit.evidence, `허가 확인 · ${state.label}`)}>
            근거 열기
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** 허가 확인 결과 이 경로로 진행할 수 없는 업체. 사유와 함께 늘 보이고, 손익은 보이지 않는다 */
export function BlockedRoutes({ routes, placedName }: { routes: BlockedRoute[]; placedName: string | null }) {
  const { openEvidence } = useV3();
  if (routes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-[13px]">
      {routes.map((route) => (
        <li key={route.vendorOrgId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PermitChip permit={route.permit} />
          <span className="min-w-0 flex-1 text-ink-2">
            <span className="font-medium text-ink">{route.vendorName ?? "업체"}</span>: {route.note}{" "}
            {placedName ? `대신 ${placedName}에 배정했습니다.` : "다른 적합한 후보가 없어 지금 방식 그대로 둡니다."}{" "}
            {route.permit.evidence.length > 0 ? (
              <button type="button" className={link} onClick={() => openEvidence(route.permit.evidence, "진행 불가 사유")}>
                근거 열기
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

type CheckFormProps = {
  permit: PermitLevel;
  streamId: string;
  vendorOrgId: string;
  onRecord: (input: PermitCheckInput) => Promise<string | null>;
  disabled: boolean;
};

/**
 * 담당자의 허가증 원문 대조 기록. 업체가 올린 허가증을 원본으로 보고 이 폐기물(품목·재질)과 처리 방법을 대조한 결과를
 * 쪽과 함께 남긴다. AI가 읽은 표기는 참고로만 보인다(marker 점). 기록하면 이름과 시각이 남는다.
 */
function CheckForm({ permit, streamId, vendorOrgId, onRecord, disabled }: CheckFormProps) {
  const document = permit.document;
  const pages = document?.pages.length ? document.pages : [1];
  const read = document?.items.find((item) => item.wasteItem === permit.wasteItem) ?? null;
  const [page, setPage] = useState<number>(read?.page ?? document?.business?.page ?? pages[0]);
  const [found, setFound] = useState<boolean | null>(null);
  const [fits, setFits] = useState<boolean | null>(null);
  const [itemQuote, setItemQuote] = useState(read?.quote ?? "");
  const [processQuote, setProcessQuote] = useState(document?.business?.quote ?? "");
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  if (!document) return null;
  const scope = permitScope(permit);
  const process = `${permit.process ?? "처리 방식"}${permit.need ? `(${permit.need})` : ""}`;
  const ready = found !== null && fits !== null && !state.busy && !disabled;

  const submit = async () => {
    if (found === null || fits === null) return;
    setState({ busy: true, error: null });
    const error = await onRecord({
      streamId,
      vendorOrgId,
      documentId: document.id,
      page,
      itemFound: found,
      processFits: fits,
      itemQuote: itemQuote.trim() || undefined,
      processQuote: processQuote.trim() || undefined,
    });
    setState({ busy: false, error });
  };

  const choice = (
    name: string,
    value: boolean | null,
    set: (next: boolean) => void,
    yes: string,
    no: string,
  ) => (
    <span role="radiogroup" aria-label={name} className="flex gap-2">
      {[
        { label: yes, on: true },
        { label: no, on: false },
      ].map((option) => (
        <label
          key={option.label}
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] ${
            value === option.on ? "border-ink font-semibold text-ink" : "border-line-strong text-ink-2"
          }`}
        >
          <input
            type="radio"
            name={`${name}-${streamId}-${vendorOrgId}`}
            className="size-4 accent-ink"
            checked={value === option.on}
            onChange={() => set(option.on)}
            disabled={disabled || state.busy}
          />
          {option.label}
        </label>
      ))}
    </span>
  );

  return (
    <div className="mt-3 rounded-xl border border-line-strong bg-surface px-4 py-4">
      <p className="font-medium">허가증 원문 대조 기록</p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        업체가 올린 {document.name ?? "허가증"}의 원본을 보고 확인한 내용만 기록하세요. 기록하면 담당자 이름과 시각이 함께
        남고, 이 폐기물과 처리 방식에만 쓰입니다.
      </p>
      {read?.quote || document.business?.quote ? (
        <ul className="mt-2 space-y-0.5 text-[12.5px] text-muted">
          {read?.quote ? (
            <li className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-marker ring-1 ring-ink" />
              AI가 읽은 표기 · {read.page ?? "?"}쪽 · “{read.quote}”
            </li>
          ) : null}
          {document.business?.quote ? (
            <li className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-marker ring-1 ring-ink" />
              AI가 읽은 표기 · {document.business.page ?? "?"}쪽 · “{document.business.quote}”
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-3 space-y-3 text-[14px]">
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-ink-2">대조한 쪽</span>
          <select
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
            disabled={disabled || state.busy}
            className="min-h-11 rounded-[6px] border border-line-strong bg-surface px-2.5 text-sm tabular-nums"
          >
            {pages.map((item) => (
              <option key={item} value={item}>
                {item}쪽
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-ink-2">{scope}</span>
          {choice("허가 품목", found, setFound, "원문에 있음", "원문에 없음")}
        </div>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-[13px] text-muted">원문 표기(선택)</span>
          <input
            value={itemQuote}
            onChange={(event) => setItemQuote(event.target.value)}
            disabled={disabled || state.busy}
            className="min-h-11 min-w-0 flex-1 rounded-[6px] border border-line-strong bg-surface px-2.5 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-ink-2">처리 방식 {process}</span>
          {choice("처리 방법", fits, setFits, "업종·처리 방법 맞음", "다름")}
        </div>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-[13px] text-muted">원문 표기(선택)</span>
          <input
            value={processQuote}
            onChange={(event) => setProcessQuote(event.target.value)}
            disabled={disabled || state.busy}
            className="min-h-11 min-w-0 flex-1 rounded-[6px] border border-line-strong bg-surface px-2.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" disabled={!ready} onClick={submit}>
          {state.busy ? "기록하는 중" : "대조 결과 기록"}
        </Button>
        <span className="text-[13px] text-muted">
          {found === false || fits === false
            ? "맞지 않는다고 기록하면 이 경로는 진행하지 않고 다른 후보로 다시 배정합니다."
            : "둘 다 맞으면 이 경로는 허가증 대조 완료가 되어 승인할 수 있습니다."}
        </span>
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 결과표 줄을 펼친 곳의 "허가 확인": 실제 근거 수준, 대조 완료면 누가·언제·어느 문서 몇 쪽에서·무엇을 확인했는지,
 * 아니면 제출받을 문서와 확인할 항목, 쓰지 않은 허가증과 이유, (배출 기업 담당자에게) 원문 대조 기록 폼.
 */
export function PermitDetail({
  permit,
  streamId,
  vendorOrgId,
  onRecord,
  disabled,
}: {
  permit: PermitLevel;
  streamId: string;
  vendorOrgId: string;
  onRecord?: (input: PermitCheckInput) => Promise<string | null>;
  disabled: boolean;
}) {
  const { openEvidence } = useV3();
  const state = permitState(permit);
  if (!state) return null;
  const todo = permitTodo(permit);
  const check = permit.check;
  return (
    <div className="mb-4 border-b border-line pb-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">허가 확인</span>
        <PermitChip permit={permit} />
      </p>
      <p className="mt-1 text-[13px] text-muted">근거 수준: {permitSource(permit)}</p>
      {state.key === "verified" && check ? (
        <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-muted">확인한 사람</dt>
          <dd>{checkerText(permit)}</dd>
          <dt className="text-muted">확인한 때</dt>
          <dd className="tabular-nums">{check.checkedAt.slice(0, 16).replace("T", " ")}</dd>
          <dt className="text-muted">문서 · 쪽</dt>
          <dd>
            {check.document ?? "허가증"} · <span className="tabular-nums">{check.page ?? "?"}쪽</span>
          </dd>
          <dt className="text-muted">확인한 범위</dt>
          <dd>
            {permitScope(permit)} · 처리 방식 {permit.process}
            {permit.need ? `(${permit.need})` : ""}. 다른 폐기물이나 처리 방식에는 쓰지 않습니다.
          </dd>
          {check.itemQuote || check.processQuote ? (
            <>
              <dt className="text-muted">원문 표기</dt>
              <dd className="text-ink-2">
                {[check.itemQuote, check.processQuote]
                  .filter(Boolean)
                  .map((quote) => `“${quote}”`)
                  .join(" · ")}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {state.key === "mismatch" ? <p className="mt-1.5 text-ink-2">{permit.text}</p> : null}
      {todo.length > 0 ? (
        <div className="mt-2 text-[13px]">
          <p className="text-ink-2">{permitPaper(permit)}</p>
          <p className="mt-1 text-muted">허가증 원문에서 확인할 항목</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-ink-2 marker:text-muted">
            {todo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {(permit.ignored ?? []).length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-warn">
          {(permit.ignored ?? []).map((item) => (
            <li key={`${item.name}-${item.reason}`}>
              {item.name ?? "허가증"}: {item.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {permit.evidence.length > 0 ? (
        <p className="mt-2">
          <button type="button" className={link} onClick={() => openEvidence(permit.evidence, `허가 확인 · ${state.label}`)}>
            근거 열기
          </button>
        </p>
      ) : null}
      {onRecord && canRecordCheck(permit) ? (
        <CheckForm permit={permit} streamId={streamId} vendorOrgId={vendorOrgId} onRecord={onRecord} disabled={disabled} />
      ) : state.key === "registered" && !state.legacy && onRecord ? (
        <p className="mt-2 text-[13px] text-ink-2">
          업체가 허가증을 올리면 여기에서 원문과 대조해 기록할 수 있습니다. 대화에서 허가증 사본을 요청하세요.
        </p>
      ) : null}
    </div>
  );
}
