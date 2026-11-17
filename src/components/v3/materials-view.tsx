"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui/button";
import { api } from "@/lib/v3/api";
import { formatNumber, priceSide } from "@/lib/v3/format";
import type {
  CsvUploadResult,
  DocumentKind,
  DocumentUploadResult,
  ExtractedField,
  MediaUploadResult,
  StreamRecord,
  VendorProfile,
} from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
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

function UploadStatus({ state }: { state: UploadState<unknown> }) {
  if (state.busy) return <p className="mt-2 text-sm text-muted">올리는 중입니다.</p>;
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

/**
 * 문서 올리기와 추출값 확인. 뽑은 값은 담당자가 표시한 것만 doc 근거로 등록된다.
 * 주입 검사나 문서 추출 서비스가 연결되지 않았으면 서버가 알려 준 그대로 보여 준다.
 */
function DocumentUpload({ kinds, canAct, label }: { kinds: DocumentKind[]; canAct: boolean; label: string }) {
  const { org, openEvidence } = useV3();
  const upload = useUpload<DocumentUploadResult>(canAct);
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<{ busy: boolean; evidence: string[] | null; error: string | null }>({
    busy: false,
    evidence: null,
    error: null,
  });
  const result = upload.state.result;
  const picked = result?.fields.filter((item) => checked[item.field]) ?? [];

  const register = async () => {
    if (!result) return;
    setConfirm({ busy: true, evidence: null, error: null });
    try {
      const fields: ExtractedField[] = result.fields.map((item) => ({
        ...item,
        confirmed: Boolean(checked[item.field]),
      }));
      const done = await api.confirmDocument(org.id, result.filename, fields);
      setConfirm({ busy: false, evidence: done.evidence, error: null });
    } catch (error) {
      setConfirm({
        busy: false,
        evidence: null,
        error: error instanceof Error ? error.message : "등록하지 못했습니다.",
      });
    }
  };

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
        <FileButton
          text="파일 올리기"
          label={label}
          disabled={!canAct || upload.state.busy}
          onFile={(file) => {
            setChecked({});
            setConfirm({ busy: false, evidence: null, error: null });
            void upload.send(() => api.uploadDocument(org.id, file, kind));
          }}
        />
      </div>
      <UploadStatus state={upload.state} />
      {result ? (
        <div className="space-y-3 rounded-xl bg-ground px-4 py-4">
          <p className="text-[13px]">
            <span className="tabular-nums">{result.filename}</span> · {DOC_KIND_LABEL[result.kind] ?? result.kind}
          </p>
          {result.blocked || result.handoff ? (
            <p role="alert" className="text-sm font-medium text-loss">
              문서에서 지시문 주입이 탐지되어 이 문서를 쓰지 않습니다.
              {result.threadIds.length > 0
                ? ` 진행 중인 대화 ${result.threadIds.length}건을 담당자에게 넘겼습니다.`
                : ""}
            </p>
          ) : null}
          {result.shieldUnavailable ? (
            <p className="text-[13px] text-warn">
              주입 검사 안 함 · {result.shield?.note ?? "Prompt Shields가 설정되지 않았습니다."}
            </p>
          ) : (
            <p className="text-[13px] text-muted">주입 검사(Prompt Shields)를 거쳤습니다.</p>
          )}
          {result.extraction === "text_only" ? (
            <p className="text-[13px] text-muted">
              문서 추출 서비스(Document Intelligence)가 연결되지 않아 글 파일의 내용만 읽었습니다.
            </p>
          ) : null}
          {result.fields.length === 0 ? (
            <p className="text-[13px] text-muted">이 문서에서 뽑은 값이 없습니다.</p>
          ) : (
            <>
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
                  {result.fields.map((item) => (
                    <tr key={item.field} className="border-b border-line align-top">
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`${item.label} 확인`}
                          checked={Boolean(checked[item.field])}
                          disabled={result.blocked || confirm.busy}
                          onChange={(event) =>
                            setChecked((before) => ({ ...before, [item.field]: event.target.checked }))
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-3 font-medium">{item.label}</td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {item.value === null ? (
                          <span className="text-warn">확인 필요</span>
                        ) : (
                          `${typeof item.value === "number" ? formatNumber(item.value) : item.value}${item.unit ? ` ${item.unit}` : ""}`
                        )}
                        {item.needsReview ? (
                          <span className="ml-2 text-[12px] text-warn">
                            다시 볼 것{item.reviewReasons?.length ? `: ${item.reviewReasons.join(", ")}` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-muted">{item.raw ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canAct || result.blocked || confirm.busy || picked.length === 0}
                  onClick={register}
                >
                  {confirm.busy ? "등록 중" : `확인한 값 ${picked.length}개를 근거로 등록`}
                </Button>
                <span className="text-[13px] text-muted">
                  {result.note ?? "표시한 값만 근거로 등록됩니다."}
                </span>
              </div>
            </>
          )}
          {confirm.error ? (
            <p role="alert" className="text-sm text-loss">
              {confirm.error}
            </p>
          ) : null}
          {confirm.evidence ? (
            <p className="text-[13px]">
              {confirm.evidence.length === 0 ? (
                "등록된 근거가 없습니다."
              ) : (
                <>
                  문서 근거 {confirm.evidence.length}건을 등록했습니다.{" "}
                  <button
                    type="button"
                    className={`${link}`}
                    onClick={() => openEvidence(confirm.evidence ?? [], "등록한 문서 근거")}
                  >
                    근거 보기
                  </button>
                </>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const pct = (value: number | null | undefined) => (value == null ? "확인 필요" : `${formatNumber(value * 100)}%`);

/**
 * 사진·영상 올리기(POST /intake/media). 탐지 모델이 연결되지 않았으면 서버가 준 문장을 그대로 보여 주고
 * 탐지 결과를 그리지 않는다. 연결돼 있으면 재질 추정과 이물 비율이 모델 판정 근거로 등록된다.
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
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">
        사진이나 영상을 올리면 재질과 섞인 것의 비율을 추정해 근거로 등록합니다. 사진만으로는 수지 종류(PP·PE·ABS)를 가르지
        못하므로 등록한 재질은 바꾸지 않습니다.
      </p>
      <FileButton
        text="사진·영상 올리기"
        label={`${stream.name} 사진·영상`}
        accept="image/*,video/*"
        disabled={!canAct || media.state.busy}
        onFile={(file) =>
          void media.send(async () => {
            const uploaded = await api.uploadMedia(org.id, stream.id, file);
            if (!uploaded.detectorUnavailable && uploaded.evidence.length > 0) onChanged();
            return uploaded;
          })
        }
      />
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
      {result?.detectorUnavailable ? (
        <div role="status" className="text-[13px] text-warn">
          <p className="font-medium">{result.message ?? "탐지 모델이 연결되지 않았습니다"}</p>
          <p className="mt-0.5">
            탐지 모델이 연결되지 않아 이 파일은 분석하지 않았습니다. 이 파일로 새로 등록된 근거는 없습니다.
            {stream.photo?.contaminationPct != null || estimate
              ? " 위에 보이는 사진 추정값은 이전에 등록된 근거입니다."
              : ""}
          </p>
        </div>
      ) : null}
      {result && !result.detectorUnavailable ? (
        <div className="space-y-3 rounded-xl bg-ground px-4 py-4 text-[13px]">
          <p>
            <span className="tabular-nums">{result.filename ?? "올린 파일"}</span>
            {result.model ? (
              <>
                {" · "}탐지 모델 <span className="tabular-nums">{`${result.model.name} ${result.model.version}`}</span>
              </>
            ) : null}
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
                <span className="text-warn">상태 모델이 돌지 않아 값이 없습니다 · 확인 필요</span>
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
              onClick={() => openEvidence(result.evidence, "등록된 모델 판정 근거")}
            >
              등록된 모델 판정 근거 {result.evidence.length}건
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
  disabled,
  onFile,
}: {
  label: string;
  text: string;
  accept?: string;
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
function Shelf({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line">
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
  const { org } = useV3();
  const [method, setMethod] = useState(stream.currentTreatment?.method ?? "");
  const [cost, setCost] = useState(
    stream.currentTreatment?.unitCostKrwPerKg != null
      ? String(stream.currentTreatment.unitCostKrwPerKg)
      : "",
  );
  const [saved, setSaved] = useState<string | null>(null);
  const csv = useUpload<CsvUploadResult>(canAct);

  const save = async () => {
    const parsed = cost.trim() === "" ? null : Number(cost);
    if (parsed !== null && !Number.isFinite(parsed)) {
      setSaved("단가는 숫자로 입력하세요.");
      return;
    }
    try {
      await onSave({
        ...stream,
        currentTreatment: method.trim()
          ? {
              method: method.trim(),
              unitCostKrwPerKg: parsed,
              evidence: stream.currentTreatment?.evidence ?? [],
            }
          : null,
      });
      setSaved("저장했습니다.");
    } catch (error) {
      setSaved(error instanceof Error ? error.message : "저장하지 못했습니다.");
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
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          지금 어떻게 처리하나요
          <input
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="예: 혼합 소각, 위탁 재활용"
            className={field}
            disabled={!canAct}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          kg당 내는 돈
          <span className="flex items-center gap-2">
            <input
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              inputMode="decimal"
              placeholder="숫자"
              className={`${field} w-28 tabular-nums`}
              disabled={!canAct}
            />
            <span className="text-sm font-normal text-ink-2">원</span>
          </span>
        </label>
        <Button type="submit" variant="secondary" disabled={!canAct}>
          저장
        </Button>
        <p className={`basis-full text-[13px] ${saved && saved !== "저장했습니다." ? "text-loss" : "text-muted"}`}>
          {saved ?? "비워 두면 혼합 소각으로 가정하고, 결과에 ‘가정’이라고 표시합니다."}
        </p>
      </form>

      <div className="mt-4">
        <Shelf title="사진·영상" status={photoStatus}>
          <MediaUpload stream={stream} canAct={canAct} onChanged={onChanged} />
        </Shelf>
        <Shelf title="측정값" status={measureStatus}>
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              오염도와 수분을 잰 값이 있으면 CSV 파일로 올립니다. 측정값이 있으면 업체가 조건을 바로 확정할 수 있습니다.
            </p>
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
              양식의 열: 흐름 이름(폐기물 이름), 공정, 재질, 오염도(%), 수분(%), 측정일. 출처, 형태, 로트, 월 발생량은 있으면
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
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`streams:${org.id}`, live, () => api.listStreams(org.id));
  const streams = live ? remote.data : (fixture?.streams.filter((item) => item.orgId === org.id) ?? []);
  if (remote.loading) return <p className="text-sm text-muted">등록한 폐기물을 불러오는 중입니다.</p>;
  if (remote.error) return <p role="alert" className="text-sm text-loss">{remote.error}</p>;
  if (!streams || streams.length === 0) {
    return (
      <p className="text-[15px] text-ink-2">
        {live ? (
          <>
            아직 등록한 폐기물이 없습니다.{" "}
            <Link href="/app" className="font-medium text-ink underline underline-offset-4">
              찾기 화면에서 먼저 추가해 주세요.
            </Link>
          </>
        ) : (
          "예시 데이터에는 이 회사의 폐기물이 없습니다. 예시는 배출 기업 한 곳의 자료만 담고 있습니다."
        )}
      </p>
    );
  }
  return (
    <div className="divide-y divide-line">
      {streams.map((stream) => (
        <StreamCard
          key={stream.id}
          stream={stream}
          canAct={live}
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
}: {
  profile: VendorProfile;
  canAct: boolean;
  onSave: (profile: VendorProfile) => Promise<void>;
}) {
  const { openEvidence } = useV3();
  const [floor, setFloor] = useState(
    profile.guardrails.floorPriceKrwPerKg != null ? String(profile.guardrails.floorPriceKrwPerKg) : "",
  );
  const [days, setDays] = useState(profile.guardrails.days.join(", "));
  const [pickups, setPickups] = useState(
    profile.guardrails.minPickupsPerMonth != null ? String(profile.guardrails.minPickupsPerMonth) : "",
  );
  const [decline, setDecline] = useState(profile.guardrails.autoDecline.join(", "));
  const [ceiling, setCeiling] = useState(
    profile.guardrails.ceilingPriceKrwPerKg != null ? String(profile.guardrails.ceilingPriceKrwPerKg) : "",
  );
  const [provider, setProvider] = useState(profile.model.provider);
  const [modelName, setModelName] = useState(profile.model.name);
  const [note, setNote] = useState<string | null>(null);
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

  const save = async () => {
    const floorValue = num(floor);
    const pickupValue = num(pickups);
    const ceilingValue = num(ceiling);
    const priceValues = profile.criteria.map((row) => num(prices[row.id] ?? ""));
    if (
      [floorValue, pickupValue, ceilingValue, ...priceValues].some((value) => value !== null && !Number.isFinite(value))
    ) {
      setNote("숫자 칸에는 숫자만 입력하세요.");
      return;
    }
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
        model: { provider, name: modelName.trim() || profile.model.name },
      });
      setNote("저장했습니다.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "저장하지 못했습니다.");
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
        <h2 className={sectionTitle}>허가 품목</h2>
        <p className="mt-1 text-sm text-muted">허가 품목이 맞는 폐기물만 문의가 옵니다.</p>
        {profile.permits.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">아직 등록된 허가 품목이 없습니다. 아래에서 허가증을 올려 주세요.</p>
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
          <p className="mt-3 text-sm text-ink-2">아직 등록된 매입 기준이 없습니다. 아래에서 매입 기준표를 올려 주세요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] font-normal text-muted">
                  <th className="py-2 pr-3 font-normal">재질</th>
                  <th className="py-2 pr-3 font-normal">등급</th>
                  <th className="py-2 pr-3 font-normal">형태</th>
                  <th className="py-2 pr-3 text-right font-normal">오염도 상한</th>
                  <th className="py-2 pr-3 text-right font-normal">수분 상한</th>
                  <th className="py-2 pr-3 text-right font-normal">kg당 단가 (원)</th>
                  <th className="py-2 pr-3 text-right font-normal">한 달 최소 (kg)</th>
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
                            {Number.isFinite(num(prices[row.id] ?? "")) && num(prices[row.id] ?? "") !== null
                              ? priceSide(num(prices[row.id] ?? "") as number)
                              : "확인 필요"}
                          </span>
                          <input
                            aria-label={`${row.material} ${row.grade}등급${row.form ? ` ${row.form}` : ""} 단가 (원/kg)`}
                            value={prices[row.id] ?? ""}
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
        <p className="mt-1 text-sm text-muted">업체 쪽 AI는 여기서 정한 범위 밖의 조건을 내놓지 않습니다. 확정은 담당자가 합니다.</p>
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

        <details className="group mt-5">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            모델 설정 (기술 설정)
            <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <label className={fieldLabel}>
              AI 모델
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as VendorProfile["model"]["provider"])}
                className={field}
                disabled={!canAct}
              >
                <option value="foundry">Foundry (기본)</option>
                <option value="ollama">Ollama 오픈 모델</option>
              </select>
            </label>
            <label className={fieldLabel}>
              모델 이름
              <input value={modelName} onChange={(event) => setModelName(event.target.value)} className={field} disabled={!canAct} />
            </label>
            <p className="text-[13px] leading-relaxed text-muted sm:col-span-2">
              여기는 설정일 뿐입니다. 실제로 무엇이 답했는지는 대화마다 따로 표시됩니다. 모델이 연결되지 않은 서버에서는
              &ldquo;규칙 정책(모델 미연결)&rdquo;이 답합니다.
            </p>
          </div>
        </details>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled={!canAct} onClick={save}>
            저장
          </Button>
          <span role="status" className={`text-sm ${note && note !== "저장했습니다." ? "text-loss" : "text-muted"}`}>
            {note ?? (canAct ? "매입 기준표의 단가와 위 범위를 함께 저장합니다." : "예시 데이터에서는 저장할 수 없습니다.")}
          </span>
        </div>
      </section>

      <section className="py-8">
        <h2 className={sectionTitle}>수거 차량</h2>
        {profile.fleet ? (
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1.5 text-[15px] tabular-nums">
            <dt className="text-muted">한 번에 싣는 무게</dt>
            <dd>{formatNumber(profile.fleet.capacityKg)} kg</dd>
            <dt className="text-muted">한 번에 싣는 부피</dt>
            <dd>{formatNumber(profile.fleet.capacityM3)} m³</dd>
            <dt className="text-muted">km당 운송비</dt>
            <dd>{formatNumber(profile.fleet.costPerKm)}원</dd>
            <dt className="text-muted">차고지 좌표</dt>
            <dd className="text-ink-2">{profile.fleet.depot.join(", ")}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-2">아직 등록된 차량 정보가 없습니다.</p>
        )}
      </section>

      <section className="pt-8">
        <h2 className={sectionTitle}>허가증·매입 기준표 올리기</h2>
        <p className="mt-1 text-sm text-muted">문서에서 뽑은 값은 담당자가 확인한 것만 위 표에 근거로 들어갑니다.</p>
        <div className="mt-4">
          <DocumentUpload kinds={["permit", "purchase_criteria"]} canAct={canAct} label="업체 문서" />
        </div>
      </section>
    </div>
  );
}

function VendorMaterials() {
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`vendor:${org.id}`, live, () => api.getVendor(org.id));
  const profile = live ? remote.data : (fixture?.vendors[org.id] ?? null);
  if (remote.loading) return <p className="text-sm text-muted">업체 정보를 불러오는 중입니다.</p>;
  if (remote.error) return <p role="alert" className="text-sm text-loss">{remote.error}</p>;
  if (!profile) return <p className="text-sm text-ink-2">등록된 업체 정보가 없습니다.</p>;
  return (
    <VendorForm
      key={profile.orgId}
      profile={profile}
      canAct={live}
      onSave={async (next) => {
        remote.set(await api.putVendor(org.id, next));
      }}
    />
  );
}

export function MaterialsView() {
  const { org, mode } = useV3();
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-10 pb-16">
      <header className="mb-8">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          {org.role === "vendor" ? "매입 기준·자료" : "자료"}
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {org.role === "emitter"
            ? "지금 처리 방법과 단가, 사진, 측정값을 넣을수록 업체가 조건을 정확히 내놓습니다. 없는 것은 비워 둬도 됩니다."
            : org.role === "vendor"
              ? "받을 수 있는 품목과 조건을 올려 두면, 맞는 물량에만 AI가 대신 답합니다."
              : "자료는 배출 기업이나 처리 업체로 볼 때 올립니다. 왼쪽 아래 ‘시연 회사’를 바꿔 보세요."}
        </p>
      </header>
      {mode === "loading" ? <p className="text-sm text-muted">불러오는 중입니다.</p> : null}
      {mode !== "loading" && org.role === "emitter" ? <EmitterMaterials /> : null}
      {mode !== "loading" && org.role === "vendor" ? <VendorMaterials /> : null}
    </div>
  );
}
