"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { ComplexSelect } from "@/components/onboarding/complex-select";
import { Button, buttonClass } from "@/components/ui/button";
import { COMPLEXES } from "@/lib/complexes";
import { ApiError, api } from "@/lib/v3/api";
import {
  depotChoice,
  emptyRoute,
  fleetBody,
  fleetDraft,
  fleetErrors,
  hasFleetErrors,
  KEEP_DEPOT,
  MAX_ROUTES,
  toggleDay,
  WEEKDAYS,
  type FleetDraft,
  type FleetErrors,
  type FleetRecord,
  type RouteDraft,
} from "@/lib/v3/fleet";
import {
  BILLING_MODES,
  SALE_METHOD,
  billingHint,
  billingText,
  initialFields,
  saleMethod,
  treatmentInput,
  type BillingFields,
} from "@/lib/v3/billing";
import { formatNumber, priceSide } from "@/lib/v3/format";
import {
  hasOffRouteErrors,
  offRouteDraft,
  offRouteErrors,
  transportBody,
  type OffRouteDraft,
  type OffRouteErrors,
  type TransportTerms,
} from "@/lib/v3/transport-terms";
import {
  addManual,
  addPending,
  checkPending,
  dropPending,
  measureCsv,
  measureProblem,
  nothingDetected,
  parsePending,
  pendingKey,
  profileSummaryText,
  setRows,
  type PendingDocument,
} from "@/lib/v3/intake";
import { AI_NAME } from "@/lib/v3/labels";
import type {
  CsvUploadResult,
  DocumentConfirmResult,
  DocumentKind,
  DocumentProfileSummary,
  DocumentUploadResult,
  ExtractedField,
  MediaUploadResult,
  StreamRecord,
  VendorProfile,
} from "@/lib/v3/types";
import { Dots } from "@/components/agent/dots";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { CriteriaReview } from "./criteria-review";
import { OffRouteTerms } from "./off-route-terms";
import { useRemote } from "./use-remote";

const field =
  "min-h-11 min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";
const link = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

type UploadState<T> = { busy: boolean; result: T | null; error: string | null };

function useUpload<T>(canAct: boolean) {
  const [state, setState] = useState<UploadState<T>>({ busy: false, result: null, error: null });
  const send = async (call: () => Promise<T>) => {
    if (!canAct) return;
    setState({ busy: true, result: null, error: null });
    try {
      setState({ busy: false, result: await call(), error: null });
    } catch (error) {
      setState({
        busy: false,
        result: null,
        error: error instanceof Error ? error.message : "올리지 못했습니다.",
      });
    }
  };
  return { state, send };
}

function UploadStatus({ state, busyText }: { state: UploadState<unknown>; busyText?: string }) {
  if (state.busy) {
    return busyText ? (
      <p className="mt-2 flex items-center gap-2.5 text-sm text-ink-2">
        <Dots label={busyText} />
        {busyText}
      </p>
    ) : (
      <p className="mt-2 text-sm text-muted">올리는 중입니다.</p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="mt-2 text-sm text-loss">
        {state.error}
      </p>
    );
  }
  return null;
}

/** 측정값 CSV를 올린 결과: 받은 행 수, 행과 열을 짚은 오류, 이름이 맞는 폐기물이 없는 행 */
function CsvResult({ result }: { result: CsvUploadResult }) {
  const { openEvidence } = useV3();
  return (
    <div className="mt-2 space-y-2 text-[13px]">
      <p>
        <span className="tabular-nums">{result.filename}</span> ({result.encoding}) · 받은 행{" "}
        <span className="font-medium tabular-nums">{result.accepted}</span> · 오류{" "}
        <span className="font-medium tabular-nums">{result.errors.length}</span> · 폐기물을 찾지 못한 행{" "}
        <span className="font-medium tabular-nums">{result.unmatched.length}</span>
        {result.evidence.length > 0 ? (
          <>
            {" · "}
            <button
              type="button"
              className={`${link}`}
              onClick={() => openEvidence(result.evidence, "등록된 측정값 근거")}
            >
              등록된 측정값 근거 {result.evidence.length}건
            </button>
          </>
        ) : null}
      </p>
      {result.errors.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1 pr-3">행</th>
              <th className="py-1 pr-3">열</th>
              <th className="py-1">오류</th>
            </tr>
          </thead>
          <tbody>
            {result.errors.map((error, index) => (
              <tr key={index} className="border-b border-line text-loss">
                <td className="py-1 pr-3 tabular-nums">{error.row ?? "-"}</td>
                <td className="py-1 pr-3 tabular-nums">{error.column ?? "-"}</td>
                <td className="py-1">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {result.unmatched.length > 0 ? (
        <p className="text-warn">
          이름이 맞는 폐기물이 없어 붙이지 못한 행:{" "}
          <span className="tabular-nums">{result.unmatched.map((row) => JSON.stringify(row)).join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  permit: "허가증",
  purchase_criteria: "매입 기준표",
  material_spec: "원자재 명세",
  msds: "MSDS",
  contract: "위탁 계약서",
};

const PENDING_EVENT = "rsai-pending-documents";

function subscribePending(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PENDING_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PENDING_EVENT, callback);
  };
}

function readPending(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 아직 확인하지 않은 문서 추출값. 새로 고치거나 다음 문서를 올려도 남도록 이 탭의 저장소(sessionStorage)에 둔다.
 * 고칠 때는 저장소의 지금 값을 읽어 고친다(늦게 온 응답이 앞선 변경을 덮지 않게).
 */
function usePending(key: string) {
  const raw = useSyncExternalStore(subscribePending, () => readPending(key), () => null);
  const list = useMemo(() => parsePending(raw), [raw]);
  const update = useCallback(
    (change: (list: PendingDocument[]) => PendingDocument[]) => {
      const next = change(parsePending(readPending(key)));
      try {
        if (next.length === 0) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 이 화면에서만 잃는다
      }
      window.dispatchEvent(new Event(PENDING_EVENT));
    },
    [key],
  );
  return [list, update] as const;
}

/** 확인을 기다리는 문서 하나: 뽑은 값마다 확인 표시를 하고, 표시한 것만 근거로 등록한다 */
function PendingExtraction({
  item,
  canAct,
  onCheck,
  onDone,
  onDiscard,
}: {
  item: PendingDocument;
  canAct: boolean;
  onCheck: (field: string, value: boolean) => void;
  onDone: (result: DocumentConfirmResult) => void;
  onDiscard: () => void;
}) {
  const { org } = useV3();
  const { result, checked } = item;
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const picked = result.fields.filter((field) => checked[field.field]);

  const register = async () => {
    setState({ busy: true, error: null });
    try {
      // 받은 항목(target 등)은 그대로 돌려보내고 확인 표시만 바꾼다
      const fields: ExtractedField[] = result.fields.map((field) => ({ ...field, confirmed: Boolean(checked[field.field]) }));
      const done = await api.confirmDocument(org.id, result.filename, fields);
      setState({ busy: false, error: null });
      onDone(done);
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : "등록하지 못했습니다." });
    }
  };

  return (
    <div className="space-y-3 rounded-xl bg-ground px-4 py-4">
      <p className="text-[13px]">
        <span className="tabular-nums">{result.filename}</span> · {DOC_KIND_LABEL[result.kind] ?? "문서"}
        <span className="text-muted"> · 확인을 기다립니다</span>
      </p>
      {result.shieldUnavailable ? (
        <p className="text-[13px] text-warn">이 문서는 안전 검사를 하지 못했습니다. 뽑은 값을 한 번 더 확인해 주세요.</p>
      ) : null}
      {result.extraction === "text_only" ? (
        <p className="text-[13px] text-muted">이 문서는 글자만 읽었습니다. 표나 사진 속 값은 원본을 보고 직접 확인해 주세요.</p>
      ) : null}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1 pr-3">확인</th>
            <th className="py-1 pr-3">항목</th>
            <th className="py-1 pr-3">뽑은 값</th>
            <th className="py-1">문서의 표기</th>
          </tr>
        </thead>
        <tbody>
          {result.fields.map((field) => (
            <tr key={field.field} className="border-b border-line align-top">
              <td className="pr-3">
                {/* 누르는 곳을 44px로: 칸 전체가 확인 표시다 */}
                <label className="-ml-2 flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-sunken has-[:disabled]:cursor-not-allowed">
                  <input
                    type="checkbox"
                    aria-label={`${field.label} 확인`}
                    className="size-4 cursor-pointer accent-ink disabled:cursor-not-allowed"
                    checked={Boolean(checked[field.field])}
                    disabled={!canAct || state.busy}
                    onChange={(event) => onCheck(field.field, event.target.checked)}
                  />
                </label>
              </td>
              <td className="py-3 pr-3 font-medium">{field.label}</td>
              <td className="py-3 pr-3 tabular-nums">
                {field.value === null ? (
                  <span className="text-warn">확인 필요</span>
                ) : (
                  `${typeof field.value === "number" ? formatNumber(field.value) : field.value}${field.unit ? ` ${field.unit}` : ""}`
                )}
                {field.needsReview ? (
                  <span className="ml-2 text-[12px] text-warn">
                    다시 볼 것{field.reviewReasons?.length ? `: ${field.reviewReasons.join(", ")}` : ""}
                  </span>
                ) : null}
              </td>
              <td className="py-3 text-muted">{field.raw ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="secondary" disabled={!canAct || state.busy || picked.length === 0} onClick={register}>
          {state.busy ? "등록 중" : `확인한 값 ${picked.length}개를 근거로 등록`}
        </Button>
        <Button size="sm" variant="ghost" disabled={state.busy} onClick={onDiscard} className="!text-ink-2">
          버리기
        </Button>
        <span className="text-[13px] text-muted">{result.note ?? "표시한 값만 근거로 등록됩니다."}</span>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 문서 올리기와 추출값 확인. 뽑은 값은 담당자가 표시한 것만 doc 근거로 등록된다.
 * 확인하지 않은 추출값은 새로 고치거나 다음 문서를 올려도 남는다(usePending).
 * 안전 검사나 표 읽기를 하지 못한 문서는 무엇을 직접 확인하면 되는지만 적는다(서비스 이름은 운영 화면에만).
 */
function DocumentUpload({
  kinds,
  canAct,
  label,
  onConfirmed,
}: {
  kinds: DocumentKind[];
  canAct: boolean;
  label: string;
  /** 확인한 값을 등록한 뒤(업체는 응답의 profile로 허가 품목·매입 기준을 바로 다시 그린다) */
  onConfirmed?: (result: DocumentConfirmResult) => void;
}) {
  const { org, openEvidence } = useV3();
  const upload = useUpload<DocumentUploadResult>(canAct);
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [pending, update] = usePending(pendingKey(org.id, label));
  const [registered, setRegistered] = useState<{ filename: string; evidence: string[]; profile: DocumentProfileSummary | null } | null>(null);
  // AI가 읽지 못했을 때 "다시 읽기"로 같은 파일을 다시 보낸다(새로 고치면 잃는다)
  const [lastFile, setLastFile] = useState<{ file: File; kind: DocumentKind } | null>(null);
  const latest = upload.state.result;
  const draft = latest && !latest.blocked ? latest.draft : undefined;

  const send = (file: File, sendKind: DocumentKind) => {
    setRegistered(null);
    setLastFile({ file, kind: sendKind });
    void upload.send(async () => {
      const result = await api.uploadDocument(org.id, file, sendKind);
      update((list) => addPending(list, result, new Date()));
      return result;
    });
  };
  const writeByHand = (name: string) => update((list) => addManual(list, name, new Date()));

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as DocumentKind)}
          className={field}
          aria-label="문서 종류"
        >
          {kinds.map((item) => (
            <option key={item} value={item}>
              {DOC_KIND_LABEL[item]}
            </option>
          ))}
        </select>
        <FileButton text="파일 올리기" label={label} disabled={!canAct || upload.state.busy} onFile={(file) => send(file, kind)} />
        {kind === "purchase_criteria" ? (
          <Button size="sm" variant="ghost" className="!text-ink-2" disabled={!canAct || upload.state.busy} onClick={() => writeByHand("직접 적은 매입 기준")}>
            직접 적기
          </Button>
        ) : null}
      </div>
      <UploadStatus
        state={upload.state}
        busyText={kind === "purchase_criteria" ? "AI가 문서를 읽고 있습니다. 표가 길면 1분 넘게 걸릴 수 있습니다." : undefined}
      />
      {latest && (latest.blocked || latest.handoff) ? (
        <p role="alert" className="rounded-xl bg-loss-bg px-4 py-3 text-sm font-medium text-loss">
          {latest.filename}: 이 문서에서 AI에게 내리는 숨은 지시문이 발견되어 이 문서를 쓰지 않습니다.
          {latest.threadIds.length > 0 ? ` 진행 중인 대화 ${latest.threadIds.length}건은 담당자가 직접 이어 가도록 넘겼습니다.` : ""}
        </p>
      ) : null}
      {draft?.outcome === "model_failed" ? (
        <div role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
          <p className="font-medium text-ink">
            <span className="tabular-nums">{latest?.filename}</span>: {draft.failure?.message ?? "AI가 문서를 읽지 못했습니다."}
          </p>
          <p className="mt-0.5">{draft.failure?.action ?? "다시 읽기를 누르거나 직접 적어 주세요."}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {lastFile ? (
              <Button size="sm" variant="secondary" disabled={!canAct || upload.state.busy} onClick={() => send(lastFile.file, lastFile.kind)}>
                다시 읽기
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" disabled={!canAct} onClick={() => writeByHand(latest?.filename ?? "직접 적은 매입 기준")}>
              직접 적기
            </Button>
          </div>
        </div>
      ) : null}
      {draft?.outcome === "not_found" ? (
        <div role="status" className="rounded-xl bg-ground px-4 py-3 text-[13px] text-ink-2">
          <p className="font-medium text-ink">
            <span className="tabular-nums">{latest?.filename}</span>에서 매입 단가나 처리비 조건을 찾지 못했습니다.
          </p>
          <p className="mt-0.5">매입 기준표가 맞는지 확인하거나, 원본을 보고 직접 적어 주세요.</p>
          <Button size="sm" variant="secondary" className="mt-2.5" disabled={!canAct} onClick={() => writeByHand(latest?.filename ?? "직접 적은 매입 기준")}>
            직접 적기
          </Button>
        </div>
      ) : null}
      {latest && !latest.blocked && !latest.draft && latest.fields.length === 0 ? (
        <p className="rounded-xl bg-ground px-4 py-3 text-[13px] text-ink-2">
          <span className="tabular-nums">{latest.filename}</span>에서 뽑은 값이 없습니다. 값이 표나 사진에 있으면 원본을 보고 직접 적어
          주세요.
        </p>
      ) : null}
      {pending.length > 1 ? <p className="pt-1 text-[13px] text-muted">확인을 기다리는 문서 {pending.length}건</p> : null}
      {pending.map((item) =>
        item.rows ? (
          <CriteriaReview
            key={item.id}
            item={item}
            canAct={canAct}
            onRows={(rows) => update((list) => setRows(list, item.id, rows))}
            onSaved={(result, rows) => {
              // 모든 줄을 저장했으면 검토를 닫는다. 확인할 값이 남은 줄이 있으면 남겨 둔다
              if (rows.every((row) => row.saved)) update((list) => dropPending(list, item.id));
              setRegistered({ filename: item.result.filename, evidence: result.evidence, profile: result.profile ?? null });
              onConfirmed?.(result);
            }}
            onDiscard={() => update((list) => dropPending(list, item.id))}
          />
        ) : (
          <PendingExtraction
            key={item.id}
            item={item}
            canAct={canAct}
            onCheck={(name, value) => update((list) => checkPending(list, item.id, name, value))}
            onDone={(result) => {
              update((list) => dropPending(list, item.id));
              setRegistered({ filename: item.result.filename, evidence: result.evidence, profile: result.profile ?? null });
              onConfirmed?.(result);
            }}
            onDiscard={() => update((list) => dropPending(list, item.id))}
          />
        ),
      )}
      {registered ? (
        <p role="status" className="text-[13px]">
          {registered.evidence.length === 0 ? (
            `${registered.filename}: 등록된 근거가 없습니다.`
          ) : (
            <>
              {registered.filename}: 문서 근거 {registered.evidence.length}건을 등록했습니다.{" "}
              <button type="button" className={`${link}`} onClick={() => openEvidence(registered.evidence, "등록한 문서 근거")}>
                근거 보기
              </button>
            </>
          )}
          {registered.profile ? <span className="mt-0.5 block text-ink-2">{profileSummaryText(registered.profile)}</span> : null}
          {registered.profile?.skipped.map((item) => (
            <span key={item} className="mt-0.5 block text-warn">
              {item}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** 측정값 칸을 펴고 오염도 입력에 커서를 둔다("수치 직접 적기") */
function openMeasure(streamId: string) {
  const shelf = document.getElementById(`measure-${streamId}`);
  if (shelf instanceof HTMLDetailsElement) shelf.open = true;
  const input = document.getElementById(`measure-${streamId}-contamination`);
  input?.scrollIntoView({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  input?.focus({ preventScroll: true });
}

/** 사진으로 값을 얻지 못했을 때의 다음 행동: 다른 사진을 올리거나 수치를 직접 적는다 */
function NextStep({ title, streamId, canAct, note }: { title: string; streamId: string; canAct: boolean; note?: string | null }) {
  return (
    <div role="status" className="rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-0.5">
        다른 사진을 올리거나 수치를 직접 적어 주세요.{note ? ` ${note}` : ""}
      </p>
      {canAct ? (
        <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => openMeasure(streamId)}>
          수치 직접 적기
        </Button>
      ) : null}
    </div>
  );
}

const pct = (value: number | null | undefined) => (value == null ? "확인 필요" : `${formatNumber(value * 100)}%`);

/**
 * 사진·영상 올리기(POST /intake/media). 분석하지 못한 파일은 다음 행동만 알려 주고 탐지 결과를 그리지 않는다.
 * 분석하면 재질 추정과 이물 비율이 AI 판정 근거로 등록된다.
 */
function MediaUpload({
  stream,
  canAct,
  onChanged,
}: {
  stream: StreamRecord;
  canAct: boolean;
  onChanged: () => void;
}) {
  const { org, openEvidence } = useV3();
  const media = useUpload<MediaUploadResult>(canAct);
  const result = media.state.result;
  const estimate = stream.photo?.materialEstimate;
  const sendMedia = (file: File) =>
    void media.send(async () => {
      const uploaded = await api.uploadMedia(org.id, stream.id, file);
      if (!uploaded.detectorUnavailable && uploaded.evidence.length > 0) onChanged();
      return uploaded;
    });
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">
        사진이나 영상을 올리면 재질과 섞인 것의 비율을 추정해 근거로 등록합니다. 사진만으로는 수지 종류(PP·PE·ABS)를 가르지
        못하므로 등록한 재질은 바꾸지 않습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {/* 휴대폰(손가락으로 누르는 화면)에서는 카메라를 바로 연다. 올린 사진은 웹과 같은 계정·서버에 남는다 */}
        <span className="hidden pointer-coarse:contents">
          <FileButton
            text="사진 찍기"
            label={`${stream.name} 사진 찍기`}
            accept="image/*"
            capture="environment"
            disabled={!canAct || media.state.busy}
            onFile={sendMedia}
          />
        </span>
        <FileButton
          text="사진·영상 올리기"
          label={`${stream.name} 사진·영상`}
          accept="image/*,video/*"
          disabled={!canAct || media.state.busy}
          onFile={sendMedia}
        />
      </div>
      <p className="text-[13px]">
        {stream.photo?.contaminationPct != null ? (
          <>
            등록된 사진 추정 오염 비율:{" "}
            <button
              type="button"
              disabled={stream.photo.evidence.length === 0}
              className="font-medium tabular-nums underline decoration-line-strong decoration-dotted underline-offset-4"
              onClick={() => openEvidence(stream.photo?.evidence ?? [], `${stream.name} 사진 추정 오염 비율`)}
            >
              {stream.photo.contaminationPct}%
            </button>
          </>
        ) : (
          <span className="text-muted">등록된 사진 추정값이 없습니다.</span>
        )}
        {estimate ? (
          <>
            {" · "}재질 추정:{" "}
            <button
              type="button"
              disabled={estimate.evidence.length === 0}
              className={`${link}`}
              onClick={() => openEvidence(estimate.evidence, `${stream.name} 재질 추정`)}
            >
              {estimate.label}
            </button>{" "}
            <span className="text-muted">(신뢰도 {pct(estimate.confidence)})</span>
          </>
        ) : null}
      </p>
      <UploadStatus state={media.state} />
      {result?.detectorUnavailable || (result && nothingDetected(result)) ? (
        <NextStep
          title={result.detectorUnavailable ? "이 파일은 분석하지 못했습니다" : "이 사진에서 찾은 것이 없습니다"}
          streamId={stream.id}
          canAct={canAct}
          note={stream.photo?.contaminationPct != null || estimate ? "위에 보이는 사진 추정값은 이전에 올린 사진의 것입니다." : null}
        />
      ) : null}
      {result && !result.detectorUnavailable && !nothingDetected(result) ? (
        <div className="space-y-3 rounded-xl bg-ground px-4 py-4 text-[13px]">
          <p>
            <span className="tabular-nums">{result.filename ?? "올린 파일"}</span>
            {result.mode ? ` · ${result.mode === "video" ? "영상" : "사진"}` : ""}
            {result.framesAnalyzed != null ? ` · 분석한 장면 ${result.framesAnalyzed}` : ""}
            {result.mode === "video" && result.tracksTotal != null ? ` · 추적한 물체 ${result.tracksTotal}` : ""}
          </p>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">재질 추정</dt>
            <dd>
              {result.material ? (
                <>
                  <button
                    type="button"
                    className={`${link}`}
                    onClick={() => openEvidence(result.material?.evidence ?? [], "재질 추정")}
                  >
                    {result.material.label}
                  </button>{" "}
                  <span className="text-muted">
                    신뢰도 {pct(result.material.confidence)}
                    {result.material.wasteItem ? ` · 폐기물 품목 ${result.material.wasteItem}` : ""}
                  </span>
                </>
              ) : (
                <span className="text-warn">탐지된 것이 없습니다 · 확인 필요</span>
              )}
            </dd>
            <dt className="text-muted">이물 비율</dt>
            <dd>
              {result.contamination ? (
                <>
                  <ClaimValue claim={result.contamination.claim} title="사진 추정 오염 비율" />
                  {result.contamination.reliable ? null : (
                    <span className="ml-2 text-warn">신뢰도 낮음</span>
                  )}
                  {result.contamination.note ? (
                    <span className="block text-muted">{result.contamination.note}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-warn">이 파일로는 비율을 정하지 못했습니다 · 확인 필요</span>
              )}
            </dd>
          </dl>
          {result.detections && result.detections.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-1 pr-3">탐지한 것</th>
                  <th className="py-1 pr-3">종류</th>
                  <th className="py-1 pr-3 text-right">신뢰도</th>
                  <th className="py-1 text-right">면적 비율</th>
                </tr>
              </thead>
              <tbody>
                {result.detections.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-b-0">
                    <td className="py-1 pr-3">
                      <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-marker ring-1 ring-ink" />
                      {item.label}
                    </td>
                    <td className="py-1 pr-3">{item.kind === "contaminant" ? "이물" : "대상"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{pct(item.confidence)}</td>
                    <td className="py-1 text-right tabular-nums">{pct(item.ratio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {result.note ? <p className="text-muted">{result.note}</p> : null}
          {result.evidence.length > 0 ? (
            <button
              type="button"
              className={`${link}`}
              onClick={() => openEvidence(result.evidence, "등록된 AI 판정 근거")}
            >
              등록된 AI 판정 근거 {result.evidence.length}건
            </button>
          ) : (
            <p className="text-muted">등록된 근거가 없습니다.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const ORIGIN_WORD: Record<string, string> = { PIR: "공정에서 나온 것", PCR: "쓰고 버린 포장재" };

/** 파일 고르기. 브라우저 기본 파일 칸 대신 단추 하나로 보인다. */
function FileButton({
  label,
  text,
  accept,
  capture,
  disabled,
  onFile,
}: {
  label: string;
  text: string;
  accept?: string;
  /** 휴대폰에서 카메라를 바로 연다(environment: 뒤쪽 카메라). 데스크톱 브라우저는 무시한다 */
  capture?: "environment" | "user";
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={`${buttonClass("secondary", "sm")} cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:border-transparent has-[:disabled]:bg-sunken has-[:disabled]:text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}
    >
      {text}
      <input
        type="file"
        accept={accept}
        capture={capture}
        disabled={disabled}
        aria-label={label}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** 접어 두는 자료 한 줄: 무엇을 올리는 곳인지와 지금까지 올린 것을 한 줄로 보여 준다. */
function Shelf({ id, title, status, children }: { id?: string; title: string; status: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group border-t border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 text-[15px] [&::-webkit-details-marker]:hidden">
        <span className="w-24 shrink-0 font-medium">{title}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{status}</span>
        <ChevronDownIcon className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

const text = (value: number | null | undefined) => (value == null ? "" : String(value));

/** 빈 칸은 null, 숫자가 아니면 NaN */
function parse(value: string) {
  return value.trim() === "" ? null : Number(value.replace(/,/g, ""));
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
      {label}
      <span className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          placeholder="숫자"
          className={`${field} w-28 tabular-nums`}
          disabled={disabled}
        />
        <span className="text-sm font-normal text-ink-2">{unit}</span>
      </span>
    </label>
  );
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

/**
 * 오염도와 수분을 직접 적는 칸. 측정값 CSV와 같은 길(POST /intake/csv)로 한 줄을 올려 측정값 근거로 등록한다.
 * 사진으로 값을 얻지 못했을 때 "수치 직접 적기"가 여기로 온다.
 */
function MeasureForm({ stream, canAct, onChanged }: { stream: StreamRecord; canAct: boolean; onChanged: () => void }) {
  const { org, openEvidence } = useV3();
  const [process, setProcess] = useState(stream.process ?? "");
  const [contamination, setContamination] = useState("");
  const [moisture, setMoisture] = useState("");
  const [measuredOn, setMeasuredOn] = useState(today);
  const [state, setState] = useState<{ busy: boolean; problem: string | null; result: CsvUploadResult | null }>({
    busy: false,
    problem: null,
    result: null,
  });

  const submit = async () => {
    const problem = measureProblem({ process, contamination, moisture, measuredOn });
    if (problem) {
      setState({ busy: false, problem, result: null });
      return;
    }
    setState({ busy: true, problem: null, result: null });
    try {
      const csv = measureCsv({
        name: stream.name,
        process: process.trim(),
        material: stream.material,
        contaminationPct: Number(contamination),
        moisturePct: Number(moisture),
        measuredOn,
      });
      const result = await api.uploadCsv(org.id, new File([csv], `${stream.name} 측정값.csv`, { type: "text/csv" }));
      setState({ busy: false, problem: null, result });
      if (result.accepted > 0) onChanged();
    } catch (error) {
      setState({ busy: false, problem: error instanceof Error ? error.message : "등록하지 못했습니다.", result: null });
    }
  };

  const done = state.result && state.result.accepted > 0;
  return (
    <form
      className="space-y-3 rounded-xl border border-line px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-[13px] font-medium text-ink-2">수치 직접 적기</p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          오염도
          <span className="flex items-center gap-2">
            <input
              id={`measure-${stream.id}-contamination`}
              value={contamination}
              onChange={(event) => setContamination(event.target.value)}
              inputMode="decimal"
              placeholder="숫자"
              className={`${field} w-24 tabular-nums`}
              disabled={!canAct || state.busy}
            />
            <span className="text-sm font-normal">%</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          수분
          <span className="flex items-center gap-2">
            <input
              value={moisture}
              onChange={(event) => setMoisture(event.target.value)}
              inputMode="decimal"
              placeholder="숫자"
              className={`${field} w-24 tabular-nums`}
              disabled={!canAct || state.busy}
            />
            <span className="text-sm font-normal">%</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          잰 날
          <input
            type="date"
            value={measuredOn}
            onChange={(event) => setMeasuredOn(event.target.value)}
            className={`${field} tabular-nums`}
            disabled={!canAct || state.busy}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          공정
          <input
            value={process}
            onChange={(event) => setProcess(event.target.value)}
            placeholder="예: 사출"
            className={field}
            disabled={!canAct || state.busy}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={!canAct || state.busy}>
          {state.busy ? "등록하는 중" : "측정값 등록"}
        </Button>
        {state.problem ? (
          <p role="alert" className="text-[13px] text-loss">
            {state.problem}
          </p>
        ) : done ? (
          <p role="status" className="text-[13px] text-ink-2">
            측정값을 등록했습니다. 다음에 찾을 때부터 씁니다.{" "}
            {state.result && state.result.evidence.length > 0 ? (
              <button type="button" className={link} onClick={() => openEvidence(state.result?.evidence ?? [], "등록한 측정값 근거")}>
                근거 보기
              </button>
            ) : null}
          </p>
        ) : (
          <p className="text-[13px] text-muted">잰 값이 있을 때만 적어 주세요. 적은 값은 측정값 근거로 등록됩니다.</p>
        )}
      </div>
      {state.result && !done ? <CsvResult result={state.result} /> : null}
    </form>
  );
}

/** 순비용에 넣는 값: 전처리에 드는 사람 손과, 공정에 다시 넣을 때의 값. 업체에는 보내지 않는다. */
function CostInputs({
  stream,
  canAct,
  onSave,
}: {
  stream: StreamRecord;
  canAct: boolean;
  onSave: (stream: StreamRecord) => Promise<void>;
}) {
  const [hours, setHours] = useState(text(stream.pretreatHoursPerMonth));
  const [rate, setRate] = useState(text(stream.laborCostKrwPerHour));
  const [virgin, setVirgin] = useState(text(stream.reuse?.virginPriceKrwPerKg));
  const [reusable, setReusable] = useState(text(stream.reuse?.reusableKgPerMonth));
  const [regrind, setRegrind] = useState(text(stream.reuse?.regrindCostKrwPerKg));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const values = { hours: parse(hours), rate: parse(rate), virgin: parse(virgin), reusable: parse(reusable), regrind: parse(regrind) };
    if (Object.values(values).some((value) => value !== null && !Number.isFinite(value))) {
      setNote({ ok: false, text: "숫자로 입력해 주세요." });
      return;
    }
    if ((values.virgin === null) !== (values.reusable === null)) {
      setNote({ ok: false, text: "다시 넣을 때의 값은 신재 구입 단가와 다시 넣을 수 있는 양을 함께 적어 주세요." });
      return;
    }
    try {
      await onSave({
        ...stream,
        pretreatHoursPerMonth: values.hours,
        laborCostKrwPerHour: values.hours === null ? null : values.rate,
        reuse:
          values.virgin !== null && values.reusable !== null
            ? { virginPriceKrwPerKg: values.virgin, reusableKgPerMonth: values.reusable, regrindCostKrwPerKg: values.regrind }
            : null,
      });
      setNote({ ok: true, text: "저장했습니다. 다음에 찾을 때부터 계산에 넣습니다." });
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : "저장하지 못했습니다." });
    }
  };

  return (
    <form
      className="space-y-5 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-ink-2">
        업체에 보낼 때 드는 사람 손과, 공정에 다시 넣을 때 아끼는 돈을 계산에 넣습니다. 이 값은 업체에 보내지 않습니다.
      </p>
      <fieldset className="space-y-2.5">
        <legend className="text-[13px] font-medium">내보내기 전에 손이 가는 시간</legend>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <NumberField label="한 달 작업 시간" unit="시간" value={hours} onChange={setHours} disabled={!canAct} />
          <NumberField label="시간당 인건비" unit="원" value={rate} onChange={setRate} disabled={!canAct} />
        </div>
        <p className="text-[13px] text-muted">분리, 분쇄, 포장에 드는 시간입니다. 인건비를 비우면 2026년 최저임금으로 계산하고 ‘가정’이라고 표시합니다.</p>
      </fieldset>
      <fieldset className="space-y-2.5">
        <legend className="text-[13px] font-medium">공정에 다시 넣는다면</legend>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <NumberField label="신재 구입 단가" unit="원/kg" value={virgin} onChange={setVirgin} disabled={!canAct} />
          <NumberField label="한 달에 다시 넣을 수 있는 양" unit="kg" value={reusable} onChange={setReusable} disabled={!canAct} />
          <NumberField label="분쇄 비용" unit="원/kg" value={regrind} onChange={setRegrind} disabled={!canAct} />
        </div>
        <p className="text-[13px] text-muted">
          공정에서 나온 한 가지 재질이고 섞인 것이 없으며 측정한 오염도가 낮을 때만 다시 넣는 길을 함께 견줍니다. 실제로 넣어도 되는지는
          품질 담당자가 정합니다.
        </p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={!canAct}>
          저장
        </Button>
        {note ? <p role="status" className={`text-[13px] ${note.ok ? "text-muted" : "text-loss"}`}>{note.text}</p> : null}
      </div>
    </form>
  );
}

const segment =
  "flex min-h-[38px] cursor-pointer items-center rounded-sm px-4 text-sm text-muted peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--color-line-strong)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink";

function AmountField({
  label,
  value,
  onChange,
  unit,
  placeholder = "숫자",
  narrow = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  placeholder?: string;
  narrow?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
      {label}
      <span className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          placeholder={placeholder}
          className={`${field} ${narrow ? "w-20" : "w-32"} tabular-nums`}
        />
        <span className="text-sm font-normal text-ink-2">{unit}</span>
      </span>
    </label>
  );
}

function StreamCard({
  stream,
  canAct,
  onSave,
  onChanged,
}: {
  stream: StreamRecord;
  canAct: boolean;
  onSave: (stream: StreamRecord) => Promise<void>;
  /** 올린 자료로 폐기물 정보가 바뀌었을 때 다시 읽는다 */
  onChanged: () => void;
}) {
  const { org, openEvidence } = useV3();
  const [method, setMethod] = useState(stream.currentTreatment?.method ?? "");
  const [fields, setFields] = useState<BillingFields>(() => initialFields(stream.currentTreatment));
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
  const csv = useUpload<CsvUploadResult>(canAct);
  const setField = (patch: Partial<BillingFields>) => {
    setFields((before) => ({ ...before, ...patch }));
    setSaved(null);
  };
  const stored = stream.currentTreatment;

  const save = async () => {
    const input = treatmentInput(method, fields, stream);
    if (!input.ok) {
      setSaved({ ok: false, text: input.message });
      return;
    }
    try {
      await onSave({ ...stream, currentTreatment: input.currentTreatment });
      setSaved({ ok: true, text: "저장했습니다." });
    } catch (error) {
      setSaved({ ok: false, text: error instanceof Error ? error.message : "저장하지 못했습니다." });
    }
  };

  const facts = [
    stream.material,
    stream.form,
    stream.origin ? (ORIGIN_WORD[stream.origin] ?? stream.origin) : null,
    stream.monthlyKg != null
      ? `한 달 ${formatNumber(stream.monthlyKg)} kg${stream.monthlyKgBasis === "estimated" ? " (추정)" : ""}`
      : "한 달 양 확인 필요",
  ].filter(Boolean);
  const photoStatus =
    stream.photo?.contaminationPct != null
      ? `사진으로 본 오염 ${stream.photo.contaminationPct}%`
      : stream.photo?.materialEstimate
        ? `사진으로 본 재질 ${stream.photo.materialEstimate.label}`
        : "아직 없음";
  const measureStatus = stream.measure
    ? `오염도 ${stream.measure.contaminationPct ?? "확인 필요"}% · 수분 ${stream.measure.moisturePct ?? "확인 필요"}% · ${stream.measure.measuredOn} 측정`
    : "아직 없음";

  return (
    <article className="pt-8 pb-3 first:pt-2">
      <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">{stream.name}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {facts.join(" · ")}
        {stream.contaminants && stream.contaminants.length > 0
          ? ` · 섞인 것 ${stream.contaminants.map((item) => item.name).join(", ")}`
          : ""}
      </p>

      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="flex max-w-md flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          지금 어떻게 처리하나요
          <input
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setSaved(null);
            }}
            placeholder={fields.mode === "sale" ? SALE_METHOD : "예: 혼합 소각, 위탁 재활용"}
            className={field}
            disabled={!canAct}
          />
        </label>
        <fieldset className="space-y-2" disabled={!canAct}>
          <legend className="text-[13px] font-medium text-ink-2">처리비를 내나요, 팔고 받나요</legend>
          <div className="mt-1.5 inline-flex rounded-md bg-sunken p-[3px]">
            {BILLING_MODES.map((item) => (
              <label key={item.mode}>
                <input
                  type="radio"
                  name={`billing-${stream.id}`}
                  value={item.mode}
                  checked={fields.mode === item.mode}
                  onChange={() => {
                    setField({ mode: item.mode });
                    // 판다면 소각·매립 같은 방법 이름을 판매로 바꾸고, 판매를 그만 고르면 그 이름을 지운다
                    if (item.mode === "sale") setMethod(saleMethod(method));
                    else if (method === SALE_METHOD) setMethod("");
                  }}
                  className="peer sr-only"
                />
                <span className={segment}>{item.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {fields.mode === "per_kg" ? (
              <AmountField label="kg당 내는 돈" value={fields.perKg} onChange={(perKg) => setField({ perKg })} unit="원" />
            ) : null}
            {fields.mode === "per_trip" ? (
              <>
                <AmountField
                  label="한 번 수거할 때"
                  value={fields.perTrip}
                  onChange={(perTrip) => setField({ perTrip })}
                  unit="원"
                  placeholder="예: 30만"
                />
                <AmountField
                  label="한 달 수거 횟수"
                  value={fields.trips}
                  onChange={(trips) => setField({ trips })}
                  unit="번"
                  placeholder="예: 2"
                  narrow
                />
              </>
            ) : null}
            {fields.mode === "monthly" ? (
              <AmountField
                label="한 달에 내는 돈"
                value={fields.monthly}
                onChange={(monthly) => setField({ monthly })}
                unit="원"
                placeholder="예: 60만"
              />
            ) : null}
            {fields.mode === "sale" ? (
              <AmountField label="kg당 받는 돈" value={fields.sale} onChange={(sale) => setField({ sale })} unit="원" />
            ) : null}
            <Button type="submit" variant="secondary" disabled={!canAct}>
              저장
            </Button>
          </div>
        </fieldset>
        {saved ? (
          <p role="status" className={`text-[13px] ${saved.ok ? "text-muted" : "text-loss"}`}>
            {saved.text}
          </p>
        ) : (
          <p className="text-[13px] text-muted">{billingHint(fields.mode)}</p>
        )}
        {stored?.sale && stored.salePriceKrwPerKg != null ? (
          <p className="text-[13px] text-ink-2">
            저장한 현행: 지금 팔아서{" "}
            <button
              type="button"
              onClick={() => openEvidence(stored.evidence, `${stream.name} 현행 판매 단가`)}
              title="근거 보기"
              className="font-semibold tabular-nums underline decoration-current/40 decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              kg당 {formatNumber(stored.salePriceKrwPerKg)}원
            </button>
            을 받습니다. 결과의 현행 월 손익은 이 판매 수입으로 계산합니다.
          </p>
        ) : null}
        {stored?.billing && stored.unitCostKrwPerKg != null ? (
          <p className="text-[13px] text-ink-2">
            저장한 계약: {billingText(stored.billing)}. 한 달 발생량으로 나누면{" "}
            <button
              type="button"
              onClick={() => openEvidence(stored.evidence, `${stream.name} 현행 처리비 kg당 환산`)}
              title="근거 보기"
              className="font-semibold tabular-nums underline decoration-current/40 decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              kg당 {formatNumber(stored.unitCostKrwPerKg)}원
            </button>
            이고, 결과의 현행 처리비는 이 값으로 계산합니다.
          </p>
        ) : null}
      </form>

      <div className="mt-4">
        <Shelf title="사진·영상" status={photoStatus}>
          <MediaUpload stream={stream} canAct={canAct} onChanged={onChanged} />
        </Shelf>
        <Shelf id={`measure-${stream.id}`} title="측정값" status={measureStatus}>
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              오염도와 수분을 잰 값이 있으면 직접 적거나 CSV 파일로 올립니다. 측정값이 있으면 업체가 조건을 바로 확정할 수 있습니다.
            </p>
            <MeasureForm stream={stream} canAct={canAct} onChanged={onChanged} />
            <div className="flex flex-wrap items-center gap-2">
              <FileButton
                text="CSV 올리기"
                label={`${stream.name} 측정값 CSV`}
                accept=".csv,text/csv"
                disabled={!canAct || csv.state.busy}
                onFile={(file) =>
                  void csv.send(async () => {
                    const result = await api.uploadCsv(org.id, file);
                    if (result.accepted > 0) onChanged();
                    return result;
                  })
                }
              />
              {canAct ? (
                <a href={api.csvTemplateUrl()} className={buttonClass("ghost", "sm", "!text-ink-2")}>
                  양식 내려받기
                </a>
              ) : null}
            </div>
            <p className="text-[13px] text-muted">
              양식의 열: 폐기물 이름(양식의 첫 열), 공정, 재질, 오염도(%), 수분(%), 측정일. 출처, 형태, 로트, 월 발생량은 있으면
              넣습니다. 이름이 같은 폐기물에 붙습니다.
            </p>
            <UploadStatus state={csv.state} />
            {csv.state.result ? <CsvResult result={csv.state.result} /> : null}
          </div>
        </Shelf>
        <Shelf
          title="비용"
          status={
            [
              stream.pretreatHoursPerMonth != null ? `손이 가는 시간 한 달 ${formatNumber(stream.pretreatHoursPerMonth)}시간` : null,
              stream.reuse ? `다시 넣을 수 있는 양 한 달 ${formatNumber(stream.reuse.reusableKgPerMonth)} kg` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "운반 전 작업 시간, 공정에 다시 넣을 때의 값"
          }
        >
          <CostInputs stream={stream} canAct={canAct} onSave={onSave} />
        </Shelf>
        <Shelf title="문서" status="원자재 명세, MSDS, 위탁 계약서">
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              문서에서 뽑은 값은 담당자가 확인한 것만 근거로 씁니다. 문서에 적힌 글을 지시로 따르지 않습니다.
            </p>
            <DocumentUpload kinds={["material_spec", "msds", "contract"]} canAct={canAct} label={`${stream.name} 문서`} />
          </div>
        </Shelf>
      </div>
    </article>
  );
}

function EmitterMaterials() {
  const { mode, canWrite, org, basePath } = useV3();
  const remote = useRemote(`streams:${org.id}`, mode === "live", () => api.listStreams(org.id));
  const streams = remote.data;
  if (remote.loading) return <p className="text-sm text-muted">등록한 폐기물을 불러오는 중입니다.</p>;
  if (remote.error) return <p role="alert" className="text-sm text-loss">{remote.error}</p>;
  if (!streams || streams.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-line-strong px-6 py-10">
        <div>
          <p className="text-[19px] font-semibold tracking-[-0.02em]">아직 등록한 폐기물이 없습니다</p>
          <p className="mt-1 text-sm text-muted">폐기물을 먼저 등록하면 사진, 측정값, 문서를 폐기물마다 올릴 수 있습니다.</p>
        </div>
        {canWrite ? (
          <Link href={basePath} className={buttonClass("primary", "md")}>
            폐기물 등록
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="divide-y divide-line">
      {streams.map((stream) => (
        <StreamCard
          key={stream.id}
          stream={stream}
          canAct={canWrite}
          onChanged={remote.reload}
          onSave={async (next) => {
            await api.putStream(org.id, next);
            remote.reload();
          }}
        />
      ))}
    </div>
  );
}

function VendorForm({
  profile,
  canAct,
  onSave,
  onConfirmed,
  note,
  setNote,
}: {
  profile: VendorProfile;
  canAct: boolean;
  /** 저장하고 저장된 프로필을 돌려준다 */
  onSave: (profile: VendorProfile) => Promise<VendorProfile>;
  /** 문서에서 확인한 값이 업체 정보에 들어갔다 */
  onConfirmed: (result: DocumentConfirmResult) => void;
  /** 저장 결과 한 줄. 처음 저장하면 폼을 새로 그리므로(key) 위에서 들고 있는다 */
  note: string | null;
  setNote: (note: string | null) => void;
}) {
  const { openEvidence } = useV3();
  const [floor, setFloor] = useState(
    profile.guardrails.floorPriceKrwPerKg != null ? String(profile.guardrails.floorPriceKrwPerKg) : "",
  );
  const [days, setDays] = useState(profile.guardrails.days.join(", "));
  const [fleet, setFleet] = useState<FleetDraft>(() => fleetDraft(profile.fleet, COMPLEXES));
  const [fleetIssues, setFleetIssues] = useState<FleetErrors>({});
  // 새로 더한 노선의 목록 열쇠
  const [routeSeq, setRouteSeq] = useState(0);
  // 저장된 차고지가 산업단지 가운데가 아니면(시연 업체처럼 좌표로 넣은 경우) "그대로"를 고를 수 있게 둔다
  const depotKept = depotChoice(profile.fleet?.depot, COMPLEXES) === KEEP_DEPOT;
  const setRoute = (index: number, patch: Partial<RouteDraft>) =>
    setFleet({ ...fleet, routes: fleet.routes.map((route, at) => (at === index ? { ...route, ...patch } : route)) });
  // 노선 밖 공장 수거 조건(transport.offRoute). 노선 수거의 운반 조건은 저장된 그대로 돌려보낸다
  const savedTransport = (profile as VendorProfile & { transport?: TransportTerms | null }).transport;
  const [offRoute, setOffRoute] = useState<OffRouteDraft>(() => offRouteDraft(savedTransport));
  const [offRouteIssues, setOffRouteIssues] = useState<OffRouteErrors>({});
  const [pickups, setPickups] = useState(
    profile.guardrails.minPickupsPerMonth != null ? String(profile.guardrails.minPickupsPerMonth) : "",
  );
  const [decline, setDecline] = useState(profile.guardrails.autoDecline.join(", "));
  const [ceiling, setCeiling] = useState(
    profile.guardrails.ceilingPriceKrwPerKg != null ? String(profile.guardrails.ceilingPriceKrwPerKg) : "",
  );
  // 매입 기준표의 단가(기준 ID → 입력한 글자). 배출 기업 기준이라 양수는 매입, 음수는 처리비다
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      profile.criteria.map((row) => [row.id, row.unitPriceKrwPerKg != null ? String(row.unitPriceKrwPerKg) : ""]),
    ),
  );
  const list = (text: string) =>
    text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const num = (text: string) => (text.trim() === "" ? null : Number(text));
  // 문서 확인으로 새로 들어온 기준은 입력한 적이 없으므로 받은 단가에서 시작한다(빈 칸으로 저장해 단가를 지우지 않게)
  const priceText = (row: VendorProfile["criteria"][number]) =>
    prices[row.id] ?? (row.unitPriceKrwPerKg != null ? String(row.unitPriceKrwPerKg) : "");

  const save = async () => {
    const floorValue = num(floor);
    const pickupValue = num(pickups);
    const ceilingValue = num(ceiling);
    const priceValues = profile.criteria.map((row) => num(priceText(row)));
    if (
      [floorValue, pickupValue, ceilingValue, ...priceValues].some((value) => value !== null && !Number.isFinite(value))
    ) {
      setNote("숫자 칸에는 숫자만 입력하세요.");
      return;
    }
    const issues = fleetErrors(fleet);
    setFleetIssues(issues);
    if (hasFleetErrors(issues)) {
      setNote("노선·차량에서 고칠 칸을 확인해 주세요.");
      return;
    }
    const offIssues = offRouteErrors(offRoute);
    setOffRouteIssues(offIssues);
    if (hasOffRouteErrors(offIssues)) {
      setNote("노선 밖 공장 수거에서 고칠 칸을 확인해 주세요.");
      return;
    }
    const transport = transportBody(savedTransport, offRoute);
    try {
      await onSave({
        ...profile,
        criteria: profile.criteria.map((row, index) => ({ ...row, unitPriceKrwPerKg: priceValues[index] })),
        guardrails: {
          ...profile.guardrails,
          floorPriceKrwPerKg: floorValue,
          ceilingPriceKrwPerKg: ceilingValue,
          days: list(days),
          minPickupsPerMonth: pickupValue,
          autoDecline: list(decline),
        },
        // 계약의 항목만 담는다(evidence는 서버가 정한다). 모르는 항목이나 범위 밖의 값은 요청 전체가 422다
        fleet: fleetBody(fleet, profile.fleet, COMPLEXES),
        // 운반 조건도 계약의 항목만 담는다(근거는 서버가 정한다). 보낼 것이 없으면 키를 빼서 바꾸지 않는다
        transport: transport as VendorProfile["transport"],
      });
      setNote("저장했습니다.");
    } catch (error) {
      // 백엔드 문장이 항목 이름(예: vehicleCount)을 괄호로 덧붙이므로 그 부분만 뺀다
      const message = error instanceof Error ? error.message.replace(/\s*\([A-Za-z_.]+\)/g, "") : "";
      setNote(message || "저장하지 못했습니다.");
    }
  };
  const EvidenceLink = ({ ids }: { ids: string[] }) =>
    ids.length > 0 ? (
      <button
        type="button"
        className={`${link}`}
        onClick={() => openEvidence(ids, "추출값의 근거")}
      >
        근거
      </button>
    ) : (
      <span className="text-warn">확인 필요</span>
    );

  const sectionTitle = "text-[19px] leading-snug font-semibold tracking-[-0.02em]";
  const fieldLabel = "flex flex-col gap-1.5 text-[13px] font-medium text-ink-2";

  return (
    <div className="divide-y divide-line">
      <section className="pb-8">
        <h2 className={sectionTitle}>허가증·매입 기준표 올리기</h2>
        <p className="mt-1 text-sm text-muted">문서에서 뽑은 값은 담당자가 확인한 것만 아래 표에 근거로 들어갑니다.</p>
        <div className="mt-4">
          <DocumentUpload kinds={["permit", "purchase_criteria"]} canAct={canAct} label="업체 문서" onConfirmed={onConfirmed} />
        </div>
      </section>

      <section className="py-8">
        <h2 className={sectionTitle}>허가 품목</h2>
        <p className="mt-1 text-sm text-muted">허가 품목이 맞는 폐기물만 문의가 옵니다.</p>
        {profile.permits.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">아직 등록된 허가 품목이 없습니다. 위에서 허가증을 올려 주세요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line text-[15px]">
            {profile.permits.map((permit, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="font-medium">{permit.wasteItem}</span>
                <span className="min-w-0 flex-1 text-ink-2">{permit.materials.join(", ")}</span>
                <span className="text-[13px] text-muted">
                  <EvidenceLink ids={permit.evidence} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="py-8">
        <h2 className={sectionTitle}>매입 기준표</h2>
        <p className="mt-1 text-sm text-muted">
          AI는 이 표에 있는 조건과 단가로만 답합니다. 단가는 고쳐서 저장할 수 있습니다.
        </p>
        {profile.criteria.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">아직 등록된 매입 기준이 없습니다. 위에서 매입 기준표를 올려 주세요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] font-normal text-muted">
                  <th className="py-2 pr-3 font-normal">재질</th>
                  <th className="py-2 pr-3 font-normal">등급</th>
                  <th className="py-2 pr-3 font-normal">형태</th>
                  <th className="py-2 pr-3 text-right font-normal">오염도 상한</th>
                  <th className="py-2 pr-3 text-right font-normal">수분 상한</th>
                  <th className="py-2 pr-3 text-right font-normal">kg당 단가 (원)</th>
                  <th className="py-2 pr-3 text-right font-normal">한 달 최소 (kg)</th>
                  <th className="py-2 pr-3 font-normal">수거비</th>
                  <th className="py-2 font-normal">근거</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {profile.criteria.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="py-2.5 pr-3 font-medium">{row.material}</td>
                    <td className="py-2.5 pr-3">{row.grade}</td>
                    <td className="py-2.5 pr-3">{row.form ?? "-"}</td>
                    <td className="py-2.5 pr-3 text-right">{row.maxContaminationPct != null ? `${row.maxContaminationPct}%` : "-"}</td>
                    <td className="py-2.5 pr-3 text-right">{row.maxMoisturePct != null ? `${row.maxMoisturePct}%` : "-"}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {canAct ? (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="text-[13px] text-muted">
                            {Number.isFinite(num(priceText(row))) && num(priceText(row)) !== null
                              ? priceSide(num(priceText(row)) as number)
                              : "확인 필요"}
                          </span>
                          <input
                            aria-label={`${row.material} ${row.grade}등급${row.form ? ` ${row.form}` : ""} 단가 (원/kg)`}
                            value={priceText(row)}
                            onChange={(event) => setPrices({ ...prices, [row.id]: event.target.value })}
                            inputMode="decimal"
                            className={`${field} !min-h-9 w-24 text-right tabular-nums`}
                          />
                        </span>
                      ) : row.unitPriceKrwPerKg != null ? (
                        <>
                          {priceSide(row.unitPriceKrwPerKg)} {formatNumber(Math.abs(row.unitPriceKrwPerKg))}
                        </>
                      ) : (
                        <span className="text-warn">확인 필요</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{row.minMonthlyKg != null ? formatNumber(row.minMonthlyKg) : "-"}</td>
                    <td className="py-2.5 pr-3 text-[13px]">
                      {row.collectionFee === "included" ? "단가에 포함" : row.collectionFee === "separate" ? "따로 받음" : "-"}
                    </td>
                    <td className="py-2.5 text-[13px] text-muted">
                      <EvidenceLink ids={row.evidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {profile.criteria.length > 0 ? (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            단가는 배출 기업이 받는 돈 기준입니다. 처리비를 받는 품목은 숫자 앞에 −를 붙입니다. 이미 합의한 조건에 쓰인 단가를
            고치면 그 승인이 지워지고, 배출 기업이 다시 찾아 새 조건으로 합의해야 합니다.
          </p>
        ) : null}
      </section>

      <section className="py-8">
        <h2 className={sectionTitle}>AI가 지킬 범위</h2>
        <p className="mt-1 text-sm text-muted">{AI_NAME.vendor}는 여기서 정한 범위 밖의 조건을 내놓지 않습니다. 확정은 담당자가 합니다.</p>
        <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <label className={fieldLabel}>
            가장 낮게 부를 단가 (kg당 원, 처리비는 −)
            <input value={floor} onChange={(event) => setFloor(event.target.value)} inputMode="decimal" className={`${field} tabular-nums`} disabled={!canAct} />
          </label>
          <label className={fieldLabel}>
            가장 높게 부를 단가 (kg당 원, 선택)
            <input value={ceiling} onChange={(event) => setCeiling(event.target.value)} inputMode="decimal" className={`${field} tabular-nums`} disabled={!canAct} />
          </label>
          <label className={fieldLabel}>
            한 달 최소 수거 횟수
            <input value={pickups} onChange={(event) => setPickups(event.target.value)} inputMode="numeric" className={`${field} tabular-nums`} disabled={!canAct} />
          </label>
          <label className={fieldLabel}>
            수거할 수 있는 요일 (쉼표로 구분)
            <input value={days} onChange={(event) => setDays(event.target.value)} className={field} disabled={!canAct} />
          </label>
          <label className={`${fieldLabel} sm:col-span-2`}>
            받지 않는 조건 (쉼표로 구분)
            <input value={decline} onChange={(event) => setDecline(event.target.value)} className={field} disabled={!canAct} />
          </label>
        </div>

      </section>

      <section className="py-8">
        <h2 className={sectionTitle}>노선·차량</h2>
        <p className="mt-1 text-sm text-muted">
          차고지와 차량 적재량, km당 운송비로 {AI_NAME.vendor}가 수거 횟수와 운반비를 계산합니다. 모르는 칸은 비워 두면
          &lsquo;확인 필요&rsquo;로 남습니다.
        </p>
        <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <label className={`${fieldLabel} sm:col-span-2`}>
            차고지가 있는 산업단지
            <ComplexSelect
              complexes={COMPLEXES}
              keep={depotKept ? { value: KEEP_DEPOT, label: "지금 차고지 그대로" } : null}
              outsideLabel="고르지 않음"
              value={fleet.depot}
              onChange={(event) => setFleet({ ...fleet, depot: event.target.value })}
              className={field}
              disabled={!canAct}
            />
            <span className="font-normal text-muted">운반 거리는 고른 산업단지의 가운데에서 잽니다.</span>
          </label>
          <FleetNumber label="한 번에 싣는 무게 (kg)" value={fleet.capacityKg} error={fleetIssues.capacityKg} disabled={!canAct} onChange={(value) => setFleet({ ...fleet, capacityKg: value })} />
          <FleetNumber label="한 번에 싣는 부피 (m³)" value={fleet.capacityM3} error={fleetIssues.capacityM3} disabled={!canAct} onChange={(value) => setFleet({ ...fleet, capacityM3: value })} />
          <FleetNumber
            label="km당 운송비 (원)"
            hint="상대 회사에는 보이지 않습니다."
            value={fleet.costPerKm}
            error={fleetIssues.costPerKm}
            disabled={!canAct}
            onChange={(value) => setFleet({ ...fleet, costPerKm: value })}
          />
          <FleetNumber
            label="차량 대수"
            inputMode="numeric"
            value={fleet.vehicleCount}
            error={fleetIssues.vehicleCount}
            disabled={!canAct}
            onChange={(value) => setFleet({ ...fleet, vehicleCount: value })}
          />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          적재 무게와 부피는 한 달 수거 횟수를 정합니다. 이미 합의한 조건에 쓰인 값을 바꾸면 그 승인이 지워지고, 배출 기업이 다시
          찾아 새 조건으로 합의해야 합니다.
        </p>

        <h3 className="mt-8 text-[15px] font-semibold">수거 가능 지역</h3>
        <p className="mt-1 text-[13px] text-muted">
          이 회사가 어디까지 수거하러 가는지 적습니다. 공장이 적은 지역 밖이고 최대 거리도 넘으면, 계약 검토 담당이 그 합의의
          승인을 막습니다. 비워 두면 공장마다 &lsquo;확인 필요&rsquo;로 남습니다.
        </p>
        <div className="mt-3 grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <label className={`${fieldLabel} sm:col-span-2`}>
            수거 가능 지역 (쉼표로 구분)
            <input
              value={fleet.serviceAreas}
              onChange={(event) => setFleet({ ...fleet, serviceAreas: event.target.value })}
              placeholder="예: 부산, 경남 김해시, 녹산국가산업단지"
              aria-invalid={fleetIssues.serviceAreas ? true : undefined}
              className={`${field} aria-invalid:border-loss`}
              disabled={!canAct}
            />
            {fleetIssues.serviceAreas ? (
              <span role="alert" className="font-normal text-loss">
                {fleetIssues.serviceAreas}
              </span>
            ) : (
              <span className="font-normal text-muted">
                시·도만 적으면 그 시·도 전체, 시·군·구나 산업단지를 적으면 그곳만 수거 가능 지역으로 봅니다.
              </span>
            )}
          </label>
          <FleetNumber
            label="차고지에서 최대 수거 거리 (km)"
            hint="지역 밖이어도 이 거리 안이면 수거하러 갑니다. 값은 상대 회사에 보이지 않습니다."
            value={fleet.maxPickupKm}
            error={fleetIssues.maxPickupKm}
            disabled={!canAct}
            onChange={(value) => setFleet({ ...fleet, maxPickupKm: value })}
          />
        </div>

        <h3 className="mt-8 text-[15px] font-semibold">노선</h3>
        <p className="mt-1 text-[13px] text-muted">
          노선마다 다니는 요일과 수거하는 곳을 적습니다. 업체 정보에 보여 주는 값이고, 업체 측 AI가 약속하는 수거 요일은 위
          &lsquo;수거할 수 있는 요일&rsquo;을 따릅니다.
        </p>
        {fleetIssues.routes ? (
          <p role="alert" className="mt-2 text-[13px] text-loss">
            {fleetIssues.routes}
          </p>
        ) : null}
        {fleet.routes.length > 0 ? (
          <ul className="mt-3 grid gap-3">
            {fleet.routes.map((route, index) => {
              const issue = fleetIssues.route?.[index];
              const known = new Set(COMPLEXES.map((complex) => complex.name));
              const extra = route.complexes.filter((name) => !known.has(name));
              return (
                <li key={route.key} className="grid gap-4 rounded-lg border border-line-strong bg-surface p-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className={`${fieldLabel} min-w-0 flex-1`}>
                      노선 이름
                      <input
                        value={route.name}
                        onChange={(event) => setRoute(index, { name: event.target.value })}
                        placeholder="예: 강서 화목 노선"
                        maxLength={50}
                        className={field}
                        disabled={!canAct}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canAct}
                      onClick={() => setFleet({ ...fleet, routes: fleet.routes.filter((_, at) => at !== index) })}
                    >
                      노선 빼기
                    </Button>
                  </div>
                  <fieldset>
                    <legend className="text-[13px] font-medium text-ink-2">다니는 요일</legend>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const on = route.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={on}
                            disabled={!canAct}
                            onClick={() => setRoute(index, { days: toggleDay(route.days, day) })}
                            className={`min-h-11 min-w-11 rounded-full border px-3.5 text-sm transition-colors duration-0 hover:duration-180 disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-ink bg-ink font-semibold text-on-ink" : "border-line-strong bg-surface text-ink-2 hover:border-ink"}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-[13px] font-medium text-ink-2">수거하는 산업단지</legend>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
                      {[...COMPLEXES.map((complex) => ({ name: complex.name, label: complex.shortName, region: complex.region })), ...extra.map((name) => ({ name, label: name, region: "" }))].map((item) => {
                        const on = route.complexes.includes(item.name);
                        return (
                          <label
                            key={item.name}
                            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3 text-sm has-[:checked]:border-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-sunken"
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!canAct}
                              onChange={() =>
                                setRoute(index, {
                                  complexes: on ? route.complexes.filter((name) => name !== item.name) : [...route.complexes, item.name],
                                })
                              }
                              className="size-4 accent-ink"
                            />
                            <span>
                              {item.label}
                              {item.region ? <span className="ml-1 text-[12px] text-muted">{item.region}</span> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className={fieldLabel}>
                    수거 지역 (쉼표로 구분, 산업단지 밖이면)
                    <input
                      value={route.regions}
                      onChange={(event) => setRoute(index, { regions: event.target.value })}
                      placeholder="예: 부산 강서구, 김해시 주촌면"
                      className={field}
                      disabled={!canAct}
                    />
                  </label>
                  {issue ? (
                    <p role="alert" className="text-[13px] text-loss">
                      {issue}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-2">아직 적은 노선이 없습니다.</p>
        )}
        {canAct && fleet.routes.length < MAX_ROUTES ? (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setFleet({ ...fleet, routes: [...fleet.routes, emptyRoute(`n${routeSeq}`)] });
              setRouteSeq(routeSeq + 1);
            }}
          >
            노선 추가
          </Button>
        ) : null}
        <OffRouteTerms saved={savedTransport} draft={offRoute} onChange={setOffRoute} errors={offRouteIssues} canAct={canAct} />
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-6">
        <Button disabled={!canAct} onClick={save}>
          저장
        </Button>
        <span role="status" className={`text-sm ${note && !note.startsWith("저장했습니다.") ? "text-loss" : "text-muted"}`}>
          {note ?? (canAct ? "매입 기준표의 단가, AI가 지킬 범위, 노선·차량, 노선 밖 공장 수거 조건을 함께 저장합니다." : "체험 중에는 저장할 수 없습니다.")}
        </span>
      </div>
    </div>
  );
}

/** 노선·차량의 숫자 칸 하나 */
function FleetNumber({
  label,
  hint,
  value,
  error,
  disabled,
  inputMode = "decimal",
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  disabled: boolean;
  inputMode?: "decimal" | "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        className={`${field} tabular-nums aria-invalid:border-loss`}
        disabled={disabled}
      />
      {error ? (
        <span role="alert" className="font-normal text-loss">
          {error}
        </span>
      ) : hint ? (
        <span className="font-normal text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/** 처음 가입한 업체에는 프로필이 없다. 빈 프로필로 시작해 문서를 올리고 범위를 정한다(모델 설정은 보내지 않는다). */
function emptyProfile(orgId: string, name: string): VendorProfile {
  return {
    orgId,
    name,
    permits: [],
    criteria: [],
    fleet: null,
    guardrails: { floorPriceKrwPerKg: null, ceilingPriceKrwPerKg: null, days: [], minPickupsPerMonth: null, autoDecline: [] },
    model: undefined as unknown as VendorProfile["model"],
  };
}

/**
 * 받은 프로필의 빈 칸을 채운다. 새로 가입한 업체의 프로필은 {permits: [], criteria: [], fleet: {}, guardrails: {}}처럼
 * 비어 있고 모델 설정도 없다. 차량은 한 칸이라도 채웠으면 있는 것으로 본다.
 */
function normalizeProfile(raw: VendorProfile, orgId: string, name: string): VendorProfile {
  const empty = emptyProfile(orgId, name);
  // 차량은 칸마다 따로 채우므로 일부만 있어도 둔다(빈 객체 {}면 없는 것으로 본다)
  const fleet = raw.fleet && typeof raw.fleet === "object" && !Array.isArray(raw.fleet) ? (raw.fleet as FleetRecord) : null;
  const fleetOk = fleet !== null && Object.keys(fleet).some((key) => key !== "evidence");
  const guardrails = (raw.guardrails ?? {}) as Partial<VendorProfile["guardrails"]>;
  return {
    ...empty,
    ...raw,
    permits: Array.isArray(raw.permits) ? raw.permits.map((item) => ({ ...item, evidence: item.evidence ?? [] })) : [],
    criteria: Array.isArray(raw.criteria) ? raw.criteria.map((item) => ({ ...item, evidence: item.evidence ?? [] })) : [],
    fleet: fleetOk ? { ...fleet, evidence: Array.isArray(fleet.evidence) ? fleet.evidence : [] } : null,
    guardrails: {
      ...empty.guardrails,
      ...guardrails,
      days: Array.isArray(guardrails.days) ? guardrails.days : [],
      autoDecline: Array.isArray(guardrails.autoDecline) ? guardrails.autoDecline : [],
    },
  };
}

/** 업체 프로필을 읽는다. 아직 없으면(404) null */
export function loadVendorProfile(orgId: string, name = "") {
  return api.getVendor(orgId).then(
    (profile) => normalizeProfile(profile, orgId, name),
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    },
  );
}

function VendorMaterials() {
  const { mode, canWrite, org } = useV3();
  const remote = useRemote(`vendor:${org.id}`, mode === "live", () => loadVendorProfile(org.id, org.name));
  const [note, setNote] = useState<string | null>(null);
  if (remote.loading) return <p className="text-sm text-muted">업체 정보를 불러오는 중입니다.</p>;
  if (remote.error) return <p role="alert" className="text-sm text-loss">{remote.error}</p>;
  const profile = remote.data ?? emptyProfile(org.id, org.name);
  return (
    <VendorForm
      key={`${profile.orgId}:${remote.data ? "saved" : "new"}`}
      profile={profile}
      canAct={canWrite}
      note={note}
      setNote={setNote}
      onSave={async (next) => {
        // 업체가 고른 모델 설정은 운영 화면 몫이다. 읽은 값이 있을 때만 그대로 돌려보낸다.
        // 차량 정보가 없으면 보내지 않는다(빈 값을 근거로 등록하지 않게)
        const { model, fleet, ...rest } = next;
        const body = { ...rest, ...(model?.provider ? { model } : {}), ...(fleet ? { fleet } : {}) };
        const saved = normalizeProfile(await api.putVendor(org.id, body as VendorProfile), org.id, org.name);
        remote.set(saved);
        return saved;
      }}
      onConfirmed={(result) => {
        // 응답의 허가 품목·매입 기준으로 바로 다시 그리고, 프로필 전체는 다시 읽는다
        if (result.profile && remote.data) {
          remote.set(normalizeProfile({ ...remote.data, permits: result.profile.permits, criteria: result.profile.criteria }, org.id, org.name));
        }
        remote.reload();
      }}
    />
  );
}

export function MaterialsView() {
  const { org, mode, readOnly } = useV3();
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-10 pb-16">
      <header className="mb-8">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          {org.role === "vendor" ? "업체 정보" : "자료"}
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {org.role === "emitter"
            ? "지금 처리 방법과 단가, 사진, 측정값을 넣을수록 업체가 조건을 정확히 내놓습니다. 없는 것은 비워 둬도 됩니다."
            : org.role === "vendor"
              ? "허가증과 매입 기준표를 올려 두면, 맞는 물량에만 AI가 매입 기준표의 조건으로 대신 답합니다."
              : "자료는 배출 기업과 처리 업체 계정에서 올립니다."}
        </p>
        {readOnly ? (
          <p className="mt-2 text-[13px] text-muted">
            체험 중에는 자료를 올리거나 저장할 수 없습니다.{" "}
            <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
              가입하고 시작하기
            </Link>
          </p>
        ) : null}
      </header>
      {mode === "loading" ? <p className="text-sm text-muted">불러오는 중입니다.</p> : null}
      {mode !== "loading" && org.role === "emitter" ? <EmitterMaterials /> : null}
      {mode !== "loading" && org.role === "vendor" ? <VendorMaterials /> : null}
    </div>
  );
}
