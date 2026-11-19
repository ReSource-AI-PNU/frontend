"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreDetails } from "@/components/ui/more-details";
import { ApiError, api } from "@/lib/v3/api";
import Link from "next/link";
import {
  THREAD_LABEL,
  clearedApprovalsText,
  formatDateTime,
  formatNumber,
  formatSignedPrice,
  rejectionLabel,
} from "@/lib/v3/format";
import { DOC_LABEL } from "@/lib/v3/labels";
import {
  ALREADY_SAVED,
  CORRECTED_MEANWHILE,
  REPLAYED,
  inspectionLabel,
  latestChanges,
  newRequestId,
  sameDayOrder,
} from "@/lib/v3/outcome";
import type {
  Assignment,
  Outcome,
  OutcomeCorrection,
  OutcomeInput,
  OutcomeResult,
  OutcomeValues,
} from "@/lib/v3/types";
import { PermitSummary } from "@/components/agent/permit-check";
import { PickupBrief } from "@/components/agent/pickup-line";
import { pickupTodo } from "@/lib/v3/pickup";
import { BlockedNotice } from "./blocked-notice";
import { ClaimText, ClaimValue } from "./claim";
import { ContractReviewBox, needsAck, reviewBlocked } from "./contract-review";
import { useV3 } from "./context";
import { useDiagnosis } from "./use-diagnosis";
import { useRemote } from "./use-remote";


function Side({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm ${done ? "font-medium text-ink" : "text-muted"}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${done ? "bg-ink" : "border border-line-strong"}`} />
      {label} {done ? "승인함" : "승인 전"}
    </span>
  );
}

const GRADES = ["A", "B", "C", "등외"];
const field = "min-h-10 rounded-[10px] border border-line-strong bg-surface px-2.5 text-sm";
const evidenceLink = "font-medium tabular-nums underline decoration-line-strong underline-offset-4";

type PriceSide = "매입" | "처리비";
/** 입력 칸의 값(글자 그대로). 보낼 때 숫자로 바꾼다 */
type Draft = { grade: string; side: PriceSide | null; price: string; kg: string; inspectedOn: string; ticket: string; note: string };

const emptyDraft = (today: string): Draft => ({
  grade: "",
  side: null,
  price: "",
  kg: "",
  inspectedOn: today,
  ticket: "",
  note: "",
});

function draftOf(item: Outcome): Draft {
  const price = item.actualUnitPriceKrwPerKg;
  return {
    grade: item.actualGrade ?? "",
    side: price === null ? null : price < 0 ? "처리비" : "매입",
    price: price === null ? "" : String(Math.abs(price)),
    kg: item.actualKg === null ? "" : String(item.actualKg),
    inspectedOn: item.inspectedOn,
    ticket: item.weighTicket ?? "",
    note: item.note ?? "",
  };
}

/**
 * 입력 칸을 보낼 값으로 바꾼다. 틀린 칸이 있으면 null.
 * 단가는 배출 기업 기준 부호로 보낸다: 매입이면 양수, 처리비면 음수. 방향을 고르지 않았으면 합의한 단가의 방향을 따른다.
 */
function valuesOf(draft: Draft, agreed: number | undefined): OutcomeValues | null {
  const side = draft.side ?? (typeof agreed === "number" && agreed < 0 ? "처리비" : "매입");
  const price = draft.price.trim() === "" ? null : Number(draft.price);
  const kg = draft.kg.trim() === "" ? null : Number(draft.kg);
  const ok =
    Boolean(draft.inspectedOn) &&
    (draft.grade !== "" || price !== null) &&
    (price === null || (Number.isFinite(price) && price >= 0)) &&
    (kg === null || (Number.isFinite(kg) && kg >= 0));
  if (!ok) return null;
  return {
    actualGrade: draft.grade || null,
    actualUnitPriceKrwPerKg: price === null ? null : side === "처리비" ? -price : price,
    actualKg: kg,
    inspectedOn: draft.inspectedOn,
    weighTicket: draft.ticket.trim() || null,
    note: draft.note.trim() || undefined,
  };
}

/** 검수 한 건의 입력 칸(새 반입 등록과 정정이 같이 쓴다) */
function OutcomeFields({
  draft,
  onChange,
  agreed,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  agreed: number | undefined;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const side = draft.side ?? (typeof agreed === "number" && agreed < 0 ? "처리비" : "매입");
  return (
    <>
      <label className="flex flex-col gap-1 font-semibold">
        검수일
        <input
          type="date"
          value={draft.inspectedOn}
          onChange={(event) => set({ inspectedOn: event.target.value })}
          className={`${field} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        계량표 번호 (선택)
        <input
          value={draft.ticket}
          maxLength={40}
          onChange={(event) => set({ ticket: event.target.value })}
          className={`${field} w-28 tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        실제 등급
        <select value={draft.grade} onChange={(event) => set({ grade: event.target.value })} className={field}>
          <option value="">기록 안 함</option>
          {GRADES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        실제 단가 (kg당 원)
        <span className="flex gap-1">
          <select
            value={side}
            aria-label="단가 방향"
            onChange={(event) => set({ side: event.target.value as PriceSide })}
            className={field}
          >
            <option>매입</option>
            <option>처리비</option>
          </select>
          <input
            value={draft.price}
            onChange={(event) => set({ price: event.target.value })}
            inputMode="decimal"
            aria-label="실제 단가"
            className={`${field} w-24 tabular-nums`}
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        실제 중량 (kg)
        <input
          value={draft.kg}
          onChange={(event) => set({ kg: event.target.value })}
          inputMode="decimal"
          className={`${field} w-24 tabular-nums`}
        />
      </label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 font-semibold">
        메모 (선택)
        <input value={draft.note} onChange={(event) => set({ note: event.target.value })} className={field} />
      </label>
    </>
  );
}

type SendState = { busy: boolean; error: string | null; done: string | null };
const idle: SendState = { busy: false, error: null, done: null };

/**
 * 한 번 누른 요청을 응답이 올 때까지 같은 요청 번호로 보낸다. 두 번 누르거나, 응답을 받지 못해 다시 누르면
 * 같은 번호가 가서 서버가 한 건으로 묶는다. 성공하거나 서버가 "이미 다른 내용으로 저장됨"이라고 답하면 번호를 비운다.
 */
function useOnceRequest() {
  const pending = useRef<string | null>(null);
  const sending = useRef(false);
  const [state, setState] = useState<SendState>(idle);
  const run = async (
    call: (requestId: string) => Promise<OutcomeResult>,
    done: string,
    onConflict: () => void,
  ): Promise<boolean> => {
    if (sending.current) return false;
    sending.current = true;
    pending.current ??= newRequestId();
    setState({ busy: true, error: null, done: null });
    try {
      const result = await call(pending.current);
      pending.current = null;
      setState({ busy: false, error: null, done: result.replayed ? REPLAYED : done });
      return true;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      if (code === "REQUEST_ID_REUSED" || code === "REVISION_CONFLICT") {
        pending.current = null;
        onConflict();
      }
      const message =
        code === "REQUEST_ID_REUSED"
          ? ALREADY_SAVED
          : code === "REVISION_CONFLICT"
            ? CORRECTED_MEANWHILE
            : error instanceof Error
              ? error.message
              : "기록하지 못했습니다.";
      setState({ busy: false, error: message, done: null });
      return false;
    } finally {
      sending.current = false;
    }
  };
  return { state, run };
}

function SendStatus({ state }: { state: SendState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      {state.done ? (
        <p role="status" className="mt-2 text-[13px] font-semibold">
          {state.done}
        </p>
      ) : null}
    </>
  );
}

/**
 * 이미 기록한 검수 한 건의 정정. 그 줄 아래 먹색 1px 테두리 상자에 지금 값을 채워 열고, 정정 사유를 받는다.
 * 앞 판은 이력으로 남고 실적에는 고친 값만 한 번 들어간다.
 */
function CorrectionForm({
  item,
  agreed,
  onCorrect,
  onConflict,
  onClose,
}: {
  item: Outcome;
  agreed: number | undefined;
  onCorrect: (inspectionId: string, body: OutcomeCorrection) => Promise<OutcomeResult>;
  onConflict: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(item));
  const [reason, setReason] = useState("");
  const { state, run } = useOnceRequest();
  const values = valuesOf(draft, agreed);
  const send = async () => {
    if (!values) return;
    const ok = await run(
      (requestId) =>
        onCorrect(item.inspectionId, { ...values, requestId, baseRevision: item.revision, reason: reason.trim() }),
      "정정을 기록했습니다.",
      onConflict,
    );
    if (ok) onClose();
  };
  return (
    <div className="rounded-xl border border-ink p-3">
      <p className="text-[13px] font-semibold">
        {inspectionLabel(item)} 정정 <span className="font-normal text-muted">· 지금 {item.revision}판</span>
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3 text-[13px]">
        <OutcomeFields draft={draft} onChange={setDraft} agreed={agreed} />
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 font-semibold">
          정정 사유
          <input
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 계량표 재확인"
            className={field}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!values || !reason.trim() || state.busy} onClick={send}>
          {state.busy ? "기록 중" : "정정 기록"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={state.busy}>
          취소
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        정정하면 앞의 기록은 정정 이력으로 남고, 실적에는 고친 값만 한 번 들어갑니다. 다른 반입이면 정정하지 말고 아래에서 새로
        기록해 주세요.
      </p>
      <SendStatus state={state} />
    </div>
  );
}

/** 정정한 건의 이력: 가장 최근 정정은 늘 보이고(앞 값은 취소선, 누르면 그때의 근거), 그 앞 판들은 접는다 */
function CorrectionHistory({ item }: { item: Outcome }) {
  const { openEvidence } = useV3();
  const before = item.history[item.history.length - 1];
  if (!before) return null;
  const changes = latestChanges(item);
  const older = item.history.slice(0, -1);
  return (
    <div className="text-[13px]">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span aria-hidden="true" className="size-2 self-center rounded-full bg-ink" />
        <span className="font-semibold">정정 {item.revision - 1}회</span>
        {item.reason ? <span className="text-ink-2">사유 · {item.reason}</span> : null}
        {item.recordedOn ? <span className="text-muted tabular-nums">{item.recordedOn}</span> : null}
      </p>
      <ul className="mt-0.5 pl-4">
        {changes.map((change) => {
          const old = change.part ? before.evidence[change.part] : null;
          return (
            <li key={change.label}>
              {change.label}{" "}
              {old ? (
                <button
                  type="button"
                  className="tabular-nums text-muted line-through decoration-muted"
                  onClick={() => openEvidence([old], `정정 전 ${change.label}`)}
                >
                  {change.before}
                </button>
              ) : (
                <span className="tabular-nums text-muted line-through">{change.before}</span>
              )}{" "}
              → <span className="font-medium tabular-nums">{change.after}</span>
            </li>
          );
        })}
      </ul>
      {older.length > 0 ? (
        <MoreDetails className="pl-4" label="이전 판 모두 보기" hint={`${older.length}판`}>
          <ul className="mb-1 space-y-0.5 text-muted">
            {older.map((entry) => (
              <li key={entry.revision} className="tabular-nums">
                {entry.revision}판 · {entry.recordedOn ?? "기록일 없음"} · {entry.actualGrade ?? "등급 기록 없음"} ·{" "}
                {entry.actualUnitPriceKrwPerKg === null ? "단가 기록 없음" : formatSignedPrice(entry.actualUnitPriceKrwPerKg)} ·{" "}
                {entry.actualKg === null ? "중량 기록 없음" : `${formatNumber(entry.actualKg)} kg`}
                {entry.reason ? ` · 사유 ${entry.reason}` : ""}
              </li>
            ))}
          </ul>
        </MoreDetails>
      ) : null}
    </div>
  );
}

/**
 * 업체가 기록한 실제 결과. 검수(계량) 한 건이 한 줄이다. 사람이 적은 값이라 먹색 점으로 표시하고, 값마다 근거(사람 확인)가
 * 열린다. 같은 날 같은 폐기물을 여러 번 받았으면 몇 번째인지 적고, 정정한 건은 줄 아래에 정정 이력을 둔다.
 * 업체 담당자는 줄마다 "정정"으로 그 건을 고친다(새 반입은 아래 입력 줄로 따로 기록한다).
 */
function OutcomeTable({
  outcomes,
  streamName,
  agreedOf,
  onCorrect,
  onConflict,
}: {
  outcomes: Outcome[];
  streamName: (id: string) => string;
  agreedOf: (streamId: string) => number | undefined;
  onCorrect: ((inspectionId: string, body: OutcomeCorrection) => Promise<OutcomeResult>) | null;
  onConflict: () => void;
}) {
  const { openEvidence } = useV3();
  const [editing, setEditing] = useState<string | null>(null);
  const order = sameDayOrder(outcomes);
  const columns = onCorrect ? 9 : 8;
  const target = outcomes.find((item) => item.inspectionId === editing) ?? null;
  return (
    <div>
      {/* relative: 머리 칸의 화면 낭독기용 글자(절대 위치)가 스크롤 상자 밖으로 문서 폭을 늘리지 않게 */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line-strong text-left text-muted">
              <th className="py-1 pr-3 font-semibold">폐기물</th>
              <th className="py-1 pr-3 font-semibold">검수일</th>
              <th className="py-1 pr-3 font-semibold">검수 번호</th>
              <th className="py-1 pr-3 font-semibold">실제 등급</th>
              <th className="py-1 pr-3 text-right font-semibold">실제 단가</th>
              <th className="py-1 pr-3 text-right font-semibold">실제 중량</th>
              <th className="py-1 pr-3 text-right font-semibold">매입 기준표 단가</th>
              <th className="py-1 pr-3 text-right font-semibold">기준표 대비</th>
              {onCorrect ? (
                <th className="py-1 font-semibold">
                  <span className="sr-only">정정</span>
                </th>
              ) : null}
            </tr>
          </thead>
          {outcomes.map((item) => (
            <tbody key={item.inspectionId} className="border-b border-line last:border-b-0">
              <tr className="align-top">
                <td className="py-1.5 pr-3">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
                    {streamName(item.streamId)}
                  </span>
                  {item.note ? <span className="text-muted">{item.note}</span> : null}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {item.inspectedOn}
                  {order.get(item.inspectionId) ? (
                    <span className="block text-[12px] text-muted">{order.get(item.inspectionId)}</span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums" title={item.inspectionId}>
                  {inspectionLabel(item)}
                </td>
                <td className="py-1.5 pr-3">
                  {item.actualGrade ? (
                    <button
                      type="button"
                      className={evidenceLink}
                      disabled={!item.evidence.grade}
                      onClick={() => openEvidence(item.evidence.grade ? [item.evidence.grade] : [], "실제 등급")}
                    >
                      {item.actualGrade}
                    </button>
                  ) : (
                    <span className="text-muted">기록 없음</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                  {item.actualUnitPriceKrwPerKg !== null ? (
                    <button
                      type="button"
                      className={evidenceLink}
                      disabled={!item.evidence.unitPrice}
                      onClick={() => openEvidence(item.evidence.unitPrice ? [item.evidence.unitPrice] : [], "실제 단가")}
                    >
                      {formatSignedPrice(item.actualUnitPriceKrwPerKg)}
                    </button>
                  ) : (
                    <span className="text-muted">기록 없음</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                  {item.actualKg !== null ? (
                    <button
                      type="button"
                      className={evidenceLink}
                      disabled={!item.evidence.kg}
                      onClick={() => openEvidence(item.evidence.kg ? [item.evidence.kg] : [], "실제 중량")}
                    >
                      {formatNumber(item.actualKg)} kg
                    </button>
                  ) : (
                    <span className="text-muted">기록 없음</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                  {item.tablePrice ? <ClaimValue claim={item.tablePrice} price /> : <span className="text-muted">-</span>}
                </td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                  {item.deviation ? <ClaimValue claim={item.deviation} signed /> : <span className="text-muted">-</span>}
                </td>
                {onCorrect ? (
                  <td className="py-0.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={editing === item.inspectionId}
                      onClick={() => setEditing(editing === item.inspectionId ? null : item.inspectionId)}
                    >
                      정정
                    </Button>
                  </td>
                ) : null}
              </tr>
              {item.history.length > 0 ? (
                <tr>
                  <td colSpan={columns} className="pb-2">
                    <CorrectionHistory item={item} />
                  </td>
                </tr>
              ) : null}
            </tbody>
          ))}
        </table>
      </div>
      {/* 정정 상자는 표 밖에 둔다(휴대폰에서 표만 가로로 밀리고 입력 칸은 화면 폭에 맞게) */}
      {onCorrect && target ? (
        <div className="mt-2">
          <CorrectionForm
            key={`${target.inspectionId}:${target.revision}`}
            item={target}
            agreed={agreedOf(target.streamId)}
            onCorrect={onCorrect}
            onConflict={onConflict}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 업체의 새 반입 기록(확정된 대화에만). 검수에서 나온 실제 등급·단가·중량을 반입할 때마다 한 건씩 적는다.
 * 같은 날 같은 폐기물을 여러 번 받았으면 건마다 기록하고, 이미 기록한 건을 고치는 것은 표의 "정정"이다.
 */
function OutcomeForm({
  threadId,
  rows,
  streamName,
  today,
  onSubmit,
  onConflict,
}: {
  threadId: string;
  rows: Assignment[];
  streamName: (id: string) => string;
  today: string;
  onSubmit: (body: OutcomeInput) => Promise<OutcomeResult>;
  onConflict: () => void;
}) {
  const [streamId, setStreamId] = useState(rows[0]?.streamId ?? "");
  const agreed = rows.find((item) => item.streamId === streamId)?.unitPrice?.value;
  const [draft, setDraft] = useState(() => emptyDraft(today));
  const { state, run } = useOnceRequest();
  const values = valuesOf(draft, typeof agreed === "number" ? agreed : undefined);
  const send = async () => {
    if (!values || !streamId) return;
    const ok = await run(
      (requestId) => onSubmit({ ...values, requestId, threadId, streamId }),
      "새 반입 한 건을 기록했습니다.",
      onConflict,
    );
    // 다음 반입을 바로 적을 수 있게 값만 비우고 검수일은 그대로 둔다
    if (ok) setDraft({ ...emptyDraft(draft.inspectedOn), side: draft.side });
  };
  return (
    <div className="mt-3">
      <p className="text-[13px] font-semibold">새 반입 기록</p>
      <div className="mt-1 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 font-semibold">
          폐기물
          <select value={streamId} onChange={(event) => setStreamId(event.target.value)} className={field}>
            {rows.map((item) => (
              <option key={item.streamId} value={item.streamId}>
                {streamName(item.streamId)}
              </option>
            ))}
          </select>
        </label>
        <OutcomeFields draft={draft} onChange={setDraft} agreed={typeof agreed === "number" ? agreed : undefined} />
        <Button size="sm" variant="secondary" disabled={!values || !streamId || state.busy} onClick={send}>
          {state.busy ? "기록 중" : "새 반입 기록"}
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        실제 등급이나 실제 단가 가운데 하나는 적어야 합니다. 같은 날 같은 폐기물을 여러 번 받았으면 받을 때마다 따로 기록합니다.
        이미 기록한 건의 값을 고치려면 위 표에서 그 줄의 &ldquo;정정&rdquo;을 누르세요. 기록은 배출 기업도 봅니다.
      </p>
      <SendStatus state={state} />
    </div>
  );
}

/** 양쪽 담당자 승인. 근거 확인에 실패한 항목이 있으면 승인 버튼을 끈다. */
export function ApprovalView() {
  const d = useDiagnosis();
  const { org, mode, readOnly, basePath, setSessionId, failedSessions } = useV3();
  const { view } = d;
  // 계약 검토의 "확인할 것"을 담당자가 확인했는지(대화마다). 화면에만 두고 저장하지 않는다
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  // 이 회사로 아직 연 찾기가 없으면 서버에 남은 최근 찾기를 연다(다른 기기에서 들어왔거나 회사를 바꿨을 때)
  const lookUp = mode === "live" && !d.sessionId;
  const recent = useRemote(`sessions:${org.id}`, lookUp, () => api.listSessions(org.id));
  const latest = lookUp ? (recent.data?.find((item) => !failedSessions.includes(item.id))?.id ?? null) : null;
  useEffect(() => {
    if (latest) setSessionId(latest);
  }, [latest, setSessionId]);
  if (d.loading || (lookUp && (recent.loading || latest))) return <p className="mx-auto w-full max-w-[820px] px-5 pt-10 text-sm text-muted">불러오는 중입니다.</p>;
  if (!view) {
    return (
      <div className="mx-auto w-full max-w-[820px] px-5 pt-10 pb-16">
        {d.error ? (
          <p role="alert" className="mb-4 text-sm text-loss">
            {d.error}
          </p>
        ) : null}
        <EmptyState
          title="아직 승인할 것이 없습니다"
          description={
            org.role === "vendor"
              ? "배출 기업과 AI끼리 조건을 맞추면 여기에 나타납니다. 받은 문의는 대화 화면에서 볼 수 있습니다."
              : "찾기 화면에서 받아 줄 곳을 먼저 찾아 주세요. 조건이 맞는 업체가 나오면 여기에 나타납니다."
          }
          action={
            <Link href={basePath} className="text-sm font-medium underline underline-offset-4">
              {org.role === "vendor" ? "대화 화면으로" : "찾기 화면으로"}
            </Link>
          }
        />
      </div>
    );
  }
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  const role = view.viewer.role;
  // 한 화면에 먹색 버튼은 하나만 둔다: 지금 승인할 수 있는 첫 합의에만 쓴다
  // 허가증 원문 대조가 끝나지 않은 합의는 배출 기업이 승인할 수 없다(서버도 409 PERMIT_UNVERIFIED로 막는다)
  const permitHeld = (approval: (typeof view.approvals)[number]) =>
    role === "emitter" && Boolean(approval.permitHold) && !(approval.emitter && approval.vendor);
  const firstActionable = view.approvals.find((approval) => {
    const mine = role === "emitter" ? approval.emitter : approval.vendor;
    return !approval.blocked && !reviewBlocked(approval.review) && !mine && !permitHeld(approval);
  })?.threadId;
  // 승인 칸은 합의·확정 대화에만 있다. 담당자에게 넘어갔거나 거절된 대화는 사유와 함께 따로 적는다
  const closed = view.threads.filter((item) => item.status === "handoff" || item.status === "declined");
  const ended = view.session.status === "idle" && view.session.phase === "done";
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-10 pb-16">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">승인·서류</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          승인하기 전에 계약 검토 담당이 합의 조건을 다시 대조합니다. 양쪽 담당자가 모두 승인해야 확정되고, 그 뒤에 요청서,
          이행 계획서, 위탁 계약서 초안이 만들어집니다.
        </p>
        {readOnly ? (
          <p className="mt-2 text-[13px] text-muted">
            체험 중에는 승인할 수 없습니다.{" "}
            <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
              가입하고 시작하기
            </Link>
          </p>
        ) : null}
      </header>
      {d.error ? (
        <p role="alert" className="text-sm text-loss">
          {d.error}
        </p>
      ) : null}
      {closed.length > 0 ? (
        <section className="border-t border-line py-7">
          <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">조건이 맞지 않은 곳</h2>
          <p className="mt-1 text-sm text-muted">
            업체가 받지 않겠다고 했거나 사람이 직접 판단해야 하는 곳입니다. 사유를 보고 담당자가 직접 처리합니다.
          </p>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {closed.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="font-medium">{item.vendorName}</span>
                <span className={`text-[13px] ${item.status === "declined" ? "text-loss" : "text-warn"}`}>
                  {THREAD_LABEL[item.status]}
                </span>
                <span className="text-muted">{item.streamIds.map(streamName).join(", ")}</span>
                <span className="basis-full text-ink-2">{item.statusReason ?? "사유가 기록되지 않았습니다."}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.approvals.length === 0 ? (
        <EmptyState
          title={ended ? "승인할 곳이 남지 않았습니다" : "아직 승인할 것이 없습니다"}
          description={
            ended
              ? "조건이 맞는 곳이 없었거나 모두 사람이 직접 판단해야 하는 상태입니다. 찾기 화면에서 사유를 확인하세요."
              : "AI끼리 조건을 맞추면 여기에 나타납니다."
          }
        />
      ) : null}
      {view.approvals.map((approval) => {
        const thread = view.threads.find((item) => item.id === approval.threadId);
        const failed = thread?.messages.filter((message) => !message.validation.ok) ?? [];
        const rows = (view.result?.assignments ?? []).filter(
          (item) => item.threadId === approval.threadId && approval.streamIds.includes(item.streamId),
        );
        const mine = role === "emitter" ? approval.emitter : role === "vendor" ? approval.vendor : true;
        const blocked = approval.blocked || failed.length > 0;
        // 계약 검토 담당이 막았거나, 확인할 것을 담당자가 아직 확인하지 않았으면 승인 단추를 끈다(안전장치)
        const reviewStops = reviewBlocked(approval.review);
        const unchecked = needsAck(approval.review) && !acks[approval.threadId];
        const canApprove = role !== "admin" && !readOnly && !mine;
        const reason =
          approval.blockedReason ??
          (failed.length > 0 ? `근거 확인에 실패한 메시지가 ${failed.length}건 있습니다.` : null);
        const outcomes = view.feedback.outcomes.filter((item) => item.threadId === approval.threadId);
        const confirmed = thread?.status === "confirmed";
        // 승인 전에 확인할 수거·운반(노선 밖 수거 확인, 정해지지 않은 운반비). 있으면 "조건이 맞음"으로만 보이지 않게 한다
        const todos = rows.flatMap((item) => pickupTodo(item).map((text) => ({ streamId: item.streamId, text })));
        const headline =
          thread?.status === "agreed" && todos.length > 0
            ? `합의함 · 확인할 것 ${todos.length}개`
            : thread
              ? THREAD_LABEL[thread.status]
              : "";
        return (
          <section key={approval.threadId} className="border-t border-line py-7">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">{thread?.vendorName ?? "업체"}</h2>
              <span className={`text-sm ${todos.length > 0 && thread?.status === "agreed" ? "text-warn" : "text-muted"}`}>
                {headline}
              </span>
              <div className="ml-auto flex flex-wrap gap-4">
                <Side label="배출 기업" done={approval.emitter} />
                <Side label="처리 업체" done={approval.vendor} />
              </div>
            </div>
            <div className="mt-3 text-sm">
              <p className="text-[13px] text-muted">
                {approval.emitter && approval.vendor ? "확정한 폐기물" : "승인할 폐기물"}
              </p>
              {approval.streamIds.length === 0 ? (
                <p className="mt-1 text-muted">여기에 배정된 폐기물이 없습니다.</p>
              ) : rows.length > 0 ? (
                <ul className="mt-1.5 divide-y divide-line border-y border-line text-[15px]">
                  {rows.map((item) => (
                    <li key={item.streamId} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5">
                      <span className="min-w-[8rem] flex-1 font-medium">{streamName(item.streamId)}</span>
                      <span className="text-ink-2">
                        <ClaimValue claim={item.unitPrice} price className="!font-normal" />
                      </span>
                      {role === "vendor" ? null : (
                        <span className="w-36 text-right tabular-nums">
                          <ClaimValue claim={item.monthlyAfter} signed />
                          {item.transportPending ? <span className="block text-[12px] text-warn">운반비 반영 전</span> : null}
                        </span>
                      )}
                      {item.pickup ? (
                        <span className="basis-full">
                          <PickupBrief pickup={item.pickup} />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-medium">{approval.streamIds.map(streamName).join(", ")}</p>
              )}
            </div>
            {(approval.permits ?? []).length > 0 ? (
              <div className="mt-3">
                {(approval.permits ?? []).map((permit) => (
                  <PermitSummary
                    key={permit.streamId}
                    permit={permit}
                    vendorName={(approval.permits ?? []).length > 1 ? streamName(permit.streamId) : null}
                  />
                ))}
                {approval.permitHold && !confirmed ? (
                  <p className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-sm text-ink-2">
                    <span className="font-medium text-ink">허가증 원문 대조가 끝나지 않은 경로는 확정하지 않습니다.</span>{" "}
                    {role === "emitter"
                      ? "찾기 화면의 결과표에서 그 줄을 펼쳐 업체가 올린 허가증 원문과 품목·처리 방법을 대조해 기록하면 승인할 수 있습니다."
                      : "배출 기업 담당자가 허가증 원문을 대조하면 확정됩니다. 허가증을 아직 올리지 않았으면 자료 화면에서 올려 주세요."}
                  </p>
                ) : null}
              </div>
            ) : null}
            {todos.length > 0 && !confirmed ? (
              <div className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-sm">
                <p className="font-medium text-warn">승인 전에 확인할 수거·운반 {todos.length}개</p>
                <ul className="mt-1.5 space-y-1 text-ink-2">
                  {todos.map((item, index) => (
                    <li key={`${item.streamId}-${index}`}>
                      <span className="font-medium text-ink">{streamName(item.streamId)}</span> · {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {thread && thread.messages.length > 0 ? (
              <MoreDetails className="mt-3 text-sm" hint={`마지막 메시지 (${thread.messages.length}번째)`}>
                <p className="mt-2 rounded-xl bg-ground px-4 py-3 whitespace-pre-wrap text-ink-2">
                  <ClaimText
                    text={thread.messages[thread.messages.length - 1].text}
                    claims={thread.messages[thread.messages.length - 1].claims}
                  />
                </p>
              </MoreDetails>
            ) : null}
            {approval.review ? (
              <ContractReviewBox
                className="mt-4"
                review={approval.review}
                acknowledged={Boolean(acks[approval.threadId])}
                onAcknowledge={
                  canApprove && d.canAct ? (value) => setAcks((before) => ({ ...before, [approval.threadId]: value })) : undefined
                }
              />
            ) : null}
            {blocked ? (
              <div className="mt-3">
                <BlockedNotice
                  codes={approval.blockedCodes}
                  reason={reason}
                  canRerun={role === "emitter" && d.canAct}
                  cleared={clearedApprovalsText(approval)}
                  busy={d.busy || view.session.status === "running"}
                  onRerun={d.run}
                />
              </div>
            ) : null}
            {failed.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[13px] text-loss">
                {failed.map((message) => (
                  <li key={message.id}>
                    ✕ {message.seq}번째 메시지 근거 확인 실패
                    {(message.validation.rejections ?? []).map((rejection, index) => (
                      <span key={index} className="block pl-4 text-ink-2">
                        {rejectionLabel(rejection.code, rejection.message)}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : null}
            {role === "admin" ? (
              <p className="mt-4 text-sm text-muted">운영자는 승인하지 않고 상태만 봅니다.</p>
            ) : readOnly ? null : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant={approval.threadId === firstActionable ? "primary" : "secondary"}
                  disabled={!d.canAct || d.busy || blocked || mine || reviewStops || unchecked || permitHeld(approval)}
                  onClick={() => d.approve(approval.threadId)}
                >
                  {mine ? "승인했습니다" : permitHeld(approval) ? "허가증 대조 뒤 승인" : "승인"}
                </Button>
                {!mine && !blocked && !reviewStops && unchecked ? (
                  <span className="text-[13px] text-muted">계약 검토의 확인할 것을 확인하면 승인할 수 있습니다.</span>
                ) : null}
              </div>
            )}
            {confirmed && (outcomes.length > 0 || role === "vendor") ? (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-[15px] font-medium">받아 보니 실제로는 (검수 뒤 업체가 기록)</h3>
                {outcomes.length > 0 ? (
                  <div className="mt-2">
                    <p className="mb-1 text-[13px] text-muted">
                      검수 {outcomes.length}건 · 반입(계량) 한 번이 한 줄이고, 정정한 건은 고친 값만 실적에 들어갑니다.
                    </p>
                    <OutcomeTable
                      outcomes={outcomes}
                      streamName={streamName}
                      agreedOf={(streamId) => {
                        const value = rows.find((item) => item.streamId === streamId)?.unitPrice?.value;
                        return typeof value === "number" ? value : undefined;
                      }}
                      onCorrect={
                        role === "vendor" && d.canAct
                          ? async (inspectionId, body) => {
                              const result = await api.correctOutcome(view.session.id, org.id, inspectionId, body);
                              d.reload();
                              return result;
                            }
                          : null
                      }
                      onConflict={d.reload}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted">아직 기록한 실제 결과가 없습니다.</p>
                )}
                {role === "vendor" && d.canAct && rows.length > 0 ? (
                  <OutcomeForm
                    key={approval.threadId}
                    threadId={approval.threadId}
                    rows={rows}
                    streamName={streamName}
                    today={view.session.today}
                    onSubmit={async (body) => {
                      const result = await api.recordOutcome(view.session.id, org.id, body);
                      d.reload();
                      return result;
                    }}
                    onConflict={d.reload}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      <section className="border-t border-line pt-7">
        <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">요청서 · 이행 계획서 · 계약서 초안</h2>
        {view.documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            양쪽이 승인하면 여기에 만들어집니다. 아직 만들어진 서류가 없습니다.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-line border-y border-line">
            {view.documents.map((document) => (
              <article key={document.id} className="py-6">
                <p className="text-[13px] text-muted">
                  {DOC_LABEL[document.kind]} · {document.streamIds.map(streamName).join(", ")} ·{" "}
                  <span className="tabular-nums">{formatDateTime(document.createdAt)}</span>
                </p>
                <h3 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em]">{document.title}</h3>
                {!document.validation.ok ? (
                  <p className="mt-2 text-sm text-loss">
                    근거 확인에 실패한 문서입니다. 내용을 쓰지 마세요.
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-muted">근거 확인됨 · 숫자를 누르면 근거가 열립니다</p>
                )}
                <div className="mt-3 rounded-xl bg-ground px-4 py-4 text-[15px] leading-relaxed">
                  <ClaimText text={document.text} claims={document.claims} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
