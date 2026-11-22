"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/v3/api";
import {
  GRADES,
  MATERIALS,
  commonLine,
  draftHeadline,
  duplicateProblem,
  editedKeys,
  emptyRow,
  numberInput,
  reviewReasons,
  rowPayload,
  rowProblems,
  rowSummary,
  savable,
  type CriteriaKey,
  type CriteriaRowState,
  type CriteriaValues,
} from "@/lib/v3/criteria";
import { formatNumber } from "@/lib/v3/format";
import type { PendingDocument } from "@/lib/v3/intake";
import type { DocumentConfirmResult } from "@/lib/v3/types";
import { useV3 } from "./context";

const input =
  "min-h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] tabular-nums placeholder:text-muted disabled:bg-sunken disabled:text-muted";
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-ink-2";
const segment =
  "flex min-h-[38px] cursor-pointer items-center rounded-sm px-3.5 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink peer-disabled:cursor-not-allowed";

const FEE_LABEL: Record<CriteriaValues["collectionFee"], string> = { "": "문서에 없음", included: "단가에 포함", separate: "따로 받음" };

/** 칸 아래 근거·고침·확인 사유. AI가 읽은 값을 고쳤으면 원래 값을 취소선으로 남긴다(DESIGN.md "사람과 AI의 표시 구분") */
function FieldNotes({ row, keys, show }: { row: CriteriaRowState; keys: CriteriaKey[]; show?: (value: string) => string }) {
  const edited = editedKeys(row).filter((key) => keys.includes(key));
  const source = keys.map((key) => row.sources[key]).find(Boolean);
  const reasons = keys.flatMap((key) => row.review[key] ?? []);
  const before = row.ai ? keys.map((key) => row.ai?.[key] ?? "").join(" ").trim() : "";
  return (
    <span className="flex flex-col gap-0.5 text-[12.5px] font-normal leading-snug">
      {edited.length > 0 && row.ai ? (
        <span className="text-ink-2">
          <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-ink align-middle" />
          담당자가 고침 · 문서에서 읽은 값 <s className="text-muted">{before ? (show ? show(before) : before) : "없음"}</s>
        </span>
      ) : null}
      {source ? <span className="break-all text-muted">문서 {source}</span> : null}
      {reasons.map((reason) => (
        <span key={reason} className="text-warn">
          {reason}
        </span>
      ))}
    </span>
  );
}

function RowEditor({
  row,
  number,
  disabled,
  onChange,
}: {
  row: CriteriaRowState;
  number: number;
  disabled: boolean;
  onChange: (values: Partial<CriteriaValues>) => void;
}) {
  const v = row.values;
  const rowId = useId();
  const id = (key: string) => `${rowId}-${key}`;
  const price = (text: string) => {
    const parsed = numberInput(text.split(" ").pop() ?? "");
    return parsed === null || Number.isNaN(parsed) ? text : `kg당 ${formatNumber(parsed)}원`;
  };
  return (
    <div className="mt-3 grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <label className={label} htmlFor={id("material")}>
        재질
        {row.origin === "manual" ? (
          <>
            <input id={id("material")} list={id("material-list")} value={v.material} maxLength={40} disabled={disabled}
              onChange={(event) => onChange({ material: event.target.value })} className={input} />
            <datalist id={id("material-list")}>
              {MATERIALS.map((value) => <option key={value} value={value} />)}
            </datalist>
          </>
        ) : (
          <select id={id("material")} value={v.material} disabled={disabled} onChange={(event) => onChange({ material: event.target.value })} className={input}>
            <option value="">골라 주세요</option>
            {MATERIALS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <FieldNotes row={row} keys={["material"]} />
      </label>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className={label} htmlFor={id("form")}>
          형태
          <input id={id("form")} value={v.form} maxLength={40} disabled={disabled} placeholder="예: 사출 스크랩" onChange={(event) => onChange({ form: event.target.value })} className={input} />
          <FieldNotes row={row} keys={["form"]} />
        </label>
        <label className={label} htmlFor={id("grade")}>
          등급
          {row.origin === "manual" ? (
            <>
              <input id={id("grade")} list={id("grade-list")} value={v.grade} maxLength={40} disabled={disabled}
                onChange={(event) => onChange({ grade: event.target.value })} className={input} />
              <datalist id={id("grade-list")}>
                {GRADES.map((value) => <option key={value} value={value} />)}
              </datalist>
            </>
          ) : (
            <select id={id("grade")} value={v.grade} disabled={disabled} onChange={(event) => onChange({ grade: event.target.value })} className={input}>
              <option value="">없음</option>
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          )}
          <FieldNotes row={row} keys={["grade"]} />
        </label>
      </div>
      <fieldset className="min-w-0 sm:col-span-2">
        <legend className="text-[13px] font-medium text-ink-2">단가 방식</legend>
        <div className="mt-1.5 inline-flex rounded-md bg-sunken p-[3px]">
          {(["fixed", "negotiated"] as const).map((mode) => (
            <label key={mode}>
              <input type="radio" name={id("price-mode")} className="peer sr-only"
                checked={(v.priceMode ?? "fixed") === mode} disabled={disabled}
                onChange={() => onChange({ priceMode: mode })} />
              <span className={segment}>{mode === "fixed" ? "고정 단가" : "건별 협의"}</span>
            </label>
          ))}
        </div>
        {v.priceMode === "negotiated" ? (
          <p className="mt-2 text-sm text-ink-2">담당자 견적 필요</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* 자료 화면의 처리비 입력과 같은 칸 나눔 선택(DESIGN.md "처리비 입력") */}
            <div role="radiogroup" aria-label={`${number}번째 줄 돈의 방향`} className="inline-flex rounded-md bg-sunken p-[3px]">
              {(
                [
                  ["buy", "매입(업체가 줌)"],
                  ["fee", "처리비(배출 기업이 냄)"],
                ] as const
              ).map(([value, text]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={id("direction")}
                    value={value}
                    checked={v.direction === value}
                    disabled={disabled}
                    onChange={() => onChange({ direction: value })}
                    className="peer sr-only"
                  />
                  <span className={segment}>{text}</span>
                </label>
              ))}
            </div>
            <span className="inline-flex items-center gap-2">
              <input
                id={id("price")}
                aria-label={`${number}번째 줄 kg당 단가(원)`}
                value={v.price}
                inputMode="decimal"
                disabled={disabled}
                placeholder="예: 320"
                onChange={(event) => onChange({ price: event.target.value })}
                className={`${input} !w-32 text-right`}
              />
              <span className="text-[13px] text-muted">원/kg</span>
            </span>
            {row.candidates && row.candidates.length === 2 && !disabled
              ? row.candidates.map((value) => (
                  <Button key={value} size="sm" variant="secondary" onClick={() => onChange({ price: String(value) })}>
                    {formatNumber(value)}원으로
                  </Button>
                ))
              : null}
          </div>
        )}
        <span className="mt-1.5 block">
          <FieldNotes row={row} keys={["direction", "price"]} show={price} />
        </span>
      </fieldset>
      <label className={label} htmlFor={id("min")}>
        한 달 최소 물량 (kg)
        <input id={id("min")} value={v.minMonthlyKg} inputMode="decimal" disabled={disabled} placeholder="모르면 비워 두세요" onChange={(event) => onChange({ minMonthlyKg: event.target.value })} className={`${input} text-right`} />
        <FieldNotes row={row} keys={["minMonthlyKg"]} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label} htmlFor={id("dirt")}>
          오염도 상한 (%)
          <input id={id("dirt")} value={v.maxContaminationPct} inputMode="decimal" disabled={disabled} onChange={(event) => onChange({ maxContaminationPct: event.target.value })} className={`${input} text-right`} />
          <FieldNotes row={row} keys={["maxContaminationPct"]} />
        </label>
        <label className={label} htmlFor={id("wet")}>
          수분 상한 (%)
          <input id={id("wet")} value={v.maxMoisturePct} inputMode="decimal" disabled={disabled} onChange={(event) => onChange({ maxMoisturePct: event.target.value })} className={`${input} text-right`} />
          <FieldNotes row={row} keys={["maxMoisturePct"]} />
        </label>
      </div>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <label className={label} htmlFor={id("fee")}>
          수거비
          <select
            id={id("fee")}
            value={v.collectionFee}
            disabled={disabled}
            onChange={(event) => onChange({ collectionFee: event.target.value as CriteriaValues["collectionFee"] })}
            className={input}
          >
            {(Object.keys(FEE_LABEL) as CriteriaValues["collectionFee"][]).map((value) => (
              <option key={value} value={value}>
                {FEE_LABEL[value]}
              </option>
            ))}
          </select>
          <FieldNotes row={row} keys={["collectionFee"]} show={(value) => FEE_LABEL[value as CriteriaValues["collectionFee"]] ?? value} />
        </label>
        {v.collectionFee === "separate" ? (
          <label className={label} htmlFor={id("feeAmount")}>
            1회 수거비 (원)
            <input id={id("feeAmount")} value={v.feePerPickup} inputMode="decimal" disabled={disabled} placeholder="모르면 비워 둡니다" onChange={(event) => onChange({ feePerPickup: event.target.value })} className={`${input} text-right`} />
            <FieldNotes row={row} keys={["feePerPickup"]} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function RowChip({ row }: { row: CriteriaRowState }) {
  const flagged = reviewReasons(row).length;
  const chip = "inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[12.5px] font-semibold";
  if (row.saved) return <span className={`${chip} bg-ink text-on-ink`}>저장함</span>;
  if (flagged > 0) return <span className={`${chip} bg-warn-bg text-warn`}>확인 필요 {flagged}</span>;
  if (row.origin === "manual") return <span className={`${chip} bg-sunken text-ink-2`}>직접 적음</span>;
  if (editedKeys(row).length > 0) return <span className={`${chip} bg-sunken text-ink-2`}>담당자가 고침</span>;
  return <span className={`${chip} bg-sunken text-ink-2`}>읽은 그대로</span>;
}

/**
 * 매입 기준표 검토(AI가 읽은 초안 또는 직접 적기). 줄마다 문서 원문을 함께 보이고, 담당자가 고르고 고친 줄만 저장한다.
 * 확인할 값이 남은 줄은 처음에 고르지 않은 채 펼쳐 두고, 값을 정하기 전에는 고를 수 없다(단일 견적에 쓰지 않는다).
 * 저장하면 그 줄은 업체 정보의 매입 기준이 되어 새 탐색부터 쓰인다. 저장하지 않은 줄은 이 자리에 남는다.
 */
export function CriteriaReview({
  item,
  canAct,
  onRows,
  onSaved,
  onDiscard,
}: {
  item: PendingDocument;
  canAct: boolean;
  onRows: (rows: CriteriaRowState[]) => void;
  onSaved: (result: DocumentConfirmResult, rows: CriteriaRowState[]) => void;
  onDiscard: () => void;
}) {
  const { org } = useV3();
  const rows = item.rows ?? [];
  const draft = item.result.draft;
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const ready = savable(rows);
  const duplicate = duplicateProblem(rows);
  const locked = !canAct || state.busy;

  const change = (key: string, patch: Partial<CriteriaRowState>) =>
    onRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const changeValues = (row: CriteriaRowState, values: Partial<CriteriaValues>) => {
    const next = { ...row, values: { ...row.values, ...values } };
    // 고칠 것이 남은 줄은 고를 수 없다. 담당자가 값을 정하면 직접 고른다
    const correctedManual = row.origin === "manual" && rowProblems(row).length > 0;
    change(row.key, {
      values: next.values,
      include: rowProblems(next).length === 0 && (row.include || correctedManual),
    });
  };

  const save = async () => {
    if (duplicate) {
      setState({ busy: false, error: duplicate });
      return;
    }
    const payload = ready.map(rowPayload).filter((row) => row !== null);
    if (payload.length === 0) return;
    setState({ busy: true, error: null });
    try {
      // 읽은 줄은 서버가 보관한 초안(draft.id)과 대조된다. 고친 값과 근거 원문은 서버가 정한다
      const result = await api.confirmCriteria(org.id, item.result.filename, payload, draft?.id);
      const keys = new Set(ready.map((row) => row.key));
      const next = rows.map((row) => (keys.has(row.key) ? { ...row, saved: true, include: false, open: false } : row));
      setState({ busy: false, error: null });
      onRows(next);
      onSaved(result, next);
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : "저장하지 못했습니다." });
    }
  };

  return (
    <div className="space-y-3 rounded-xl bg-ground px-4 py-4">
      <p className="text-[13px]">
        <span className="tabular-nums">{item.result.filename}</span>
        <span className="text-muted"> · 확인을 기다립니다</span>
      </p>
      <p className="text-[15px] font-medium leading-snug">{draftHeadline(rows, draft?.reader?.by)}</p>
      {item.result.shieldUnavailable ? (
        <p className="text-[13px] text-warn">이 문서는 안전 검사를 하지 못했습니다. 읽은 값을 한 번 더 확인해 주세요.</p>
      ) : null}
      {draft?.notes.map((note) => (
        <p key={note} className="text-[13px] text-warn">
          {note}
        </p>
      ))}
      {draft && draft.common.length > 0 ? (
        <div className="text-[13px]">
          <p className="font-medium text-ink-2">표 밖에 적힌 공통 조건</p>
          <ul className="mt-1 space-y-1">
            {draft.common.map((common, index) => (
              <li key={index} className="border-l-2 border-ink pl-2.5 leading-snug text-ink-2">
                {commonLine(common, rows)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ol className="divide-y divide-line border-y border-line">
        {rows.map((row, index) => {
          const problems = rowProblems(row);
          return (
            <li key={row.key} className="py-3">
              <div className="flex items-start gap-2">
                <label
                  className="-ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-sunken has-[:disabled]:cursor-not-allowed"
                  title={problems.length > 0 && !row.saved ? problems[0] : undefined}
                >
                  <input
                    type="checkbox"
                    aria-label={`${index + 1}번째 줄 저장`}
                    className="size-4 cursor-pointer accent-ink disabled:cursor-not-allowed"
                    checked={row.include || row.saved}
                    disabled={locked || row.saved || problems.length > 0}
                    onChange={(event) => change(row.key, { include: event.target.checked })}
                  />
                </label>
                <div className="min-w-0 flex-1 pt-2.5">
                  <p className="text-[15px] font-medium leading-snug tabular-nums">
                    <span className="mr-2 text-[13px] font-normal text-muted">{index + 1}</span>
                    {rowSummary(row)}
                  </p>
                  {row.quote ? (
                    <p className="mt-1 break-all text-[12.5px] leading-snug text-muted">
                      <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-marker ring-1 ring-ink align-middle" />
                      문서{row.page ? ` ${row.page}쪽` : ""} 원문 · “{row.quote}”
                    </p>
                  ) : row.origin === "manual" ? (
                    <p className="mt-1 text-[12.5px] text-muted">담당자가 직접 적는 줄입니다.</p>
                  ) : null}
                  {row.conversions && row.conversions.length > 0 ? (
                    <p className="mt-0.5 pl-3.5 text-[12.5px] leading-snug text-muted tabular-nums">단위 환산 · {row.conversions.join(" · ")}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 pt-2 sm:flex-row sm:items-center sm:gap-2">
                  <RowChip row={row} />
                  {!row.saved ? (
                    <Button size="sm" variant="ghost" className="!min-h-9" disabled={locked} onClick={() => change(row.key, { open: !row.open })}>
                      {row.open ? "접기" : "고치기"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {row.open && !row.saved ? (
                <div className="pl-9">
                  <RowEditor row={row} number={index + 1} disabled={locked} onChange={(values) => changeValues(row, values)} />
                  {problems.length > 0 ? (
                    <p className="mt-3 text-[13px] text-warn">저장하려면: {problems.join(" ")}</p>
                  ) : !row.include ? (
                    <p className="mt-3 text-[13px] text-ink-2">값을 확인했으면 왼쪽 칸을 눌러 저장할 줄로 고르세요.</p>
                  ) : null}
                  {row.origin === "manual" ? (
                    <Button size="sm" variant="ghost" className="mt-1 !text-ink-2" disabled={locked} onClick={() => onRows(rows.filter((other) => other.key !== row.key))}>
                      이 줄 빼기
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="secondary" disabled={locked || ready.length === 0} onClick={save}>
          {state.busy ? "저장 중" : `고른 ${ready.length}줄 저장`}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={locked}
          onClick={() => onRows([...rows, emptyRow(`n${rows.filter((row) => row.origin === "manual").length + 1}-${rows.length}`)])}
        >
          줄 더하기
        </Button>
        <Button size="sm" variant="ghost" disabled={state.busy} onClick={onDiscard} className="!text-ink-2">
          버리기
        </Button>
      </div>
      <p className="text-[13px] text-muted">
        저장한 줄만 업체 탐색에 쓰입니다. 확인할 값이 남은 줄은 저장하지 않고 이 자리에 남습니다.
      </p>
      {duplicate ? <p className="text-[13px] text-warn">{duplicate}</p> : null}
      {state.error ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
