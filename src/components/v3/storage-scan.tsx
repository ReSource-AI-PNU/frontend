"use client";

/**
 * 자료 화면의 "보관장 3D 스캔"(배출 기업, DESIGN.md "보관장 3D 스캔"). 휴대폰으로 보관장을 한 바퀴 찍어 올리면 브라우저가
 * 장면 사진을 골라 보내고, 서버가 3D로 재구성해 더미마다 부피·무게를 재고 폐기물별로 나눠 둘 정리안을 낸다.
 * 요약 한 줄과 더미 목록, 정리안 지표를 먼저 보이고, 3D 보기와 배치 기준은 열어서 본다.
 * 분석을 받을 수 없고 스캔도 없으면 절을 그리지 않는다(준비되지 않은 기능은 두지 않는다).
 * 화면의 숫자는 모두 근거가 열린다(크기·높이는 그 더미의 부피 근거, 배치 기준은 가정값 근거).
 * 계약: ~/rs-work/scan/CONTRACT.md
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { ApiError, ApiUnreachable, api } from "@/lib/v3/api";
import { UNAVAILABLE } from "@/lib/v3/errors";
import { formatNumber } from "@/lib/v3/format";
import {
  MAX_WEIGHED_KG,
  ScanInputError,
  currentScan,
  fix2,
  keptText,
  m3,
  metricRows,
  pendingText,
  scanTime,
  showScanSection,
  stepOf,
  stepStates,
  weighedValue,
  type MetricCell,
  type ScanStepKey,
} from "@/lib/v3/scan";
import type { ScanList, ScanPile, ScanView, StreamRecord } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";

const ScanViewer = dynamic(() => import("./scan-viewer").then((module) => module.ScanViewer), {
  ssr: false,
  loading: () => <p className="mt-4 text-sm text-muted">3D 보기를 여는 중입니다.</p>,
});

const POLL_MS = 2000;
/** 진행을 읽지 못한 차례가 이만큼(약 30초) 이어지면 멈추고 다시 시도 단추를 보인다 */
const MAX_POLL_FAILS = 15;
const link = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const field =
  "min-h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";
const FRAMES_FAILED = "이 영상에서 장면을 고르지 못했습니다. 휴대폰에서 바로 찍어 올리거나 MP4 영상으로 다시 올려 주세요.";
const TOO_BIG = "장면 사진이 너무 큽니다. 영상을 1분 안쪽으로 줄여 주세요.";

type Local =
  | { phase: "idle" }
  | { phase: "portrait"; file: File }
  | { phase: "preparing" }
  | { phase: "sending" }
  | { phase: "error"; message: string };

const GUIDE =
  "휴대폰을 가로로 가슴 높이에 들고, 더미 줄에서 2~3 m 떨어져 마주 본 채 옆으로 천천히 걸으며 30초~1분 찍어 주세요. 제자리에서 돌며 찍지 마세요. 소리와 영상 원본은 보내지 않습니다.";

/** 서버 문장(ApiError)과 연결 문장(ApiUnreachable)은 그대로, 그 밖의 오류(코드 오류 문장)는 내보내지 않는다 */
function friendly(error: unknown, fallback: string = UNAVAILABLE): string {
  if (error instanceof ApiError && (error.code === "TOO_LARGE" || error.status === 413)) return TOO_BIG;
  if (error instanceof ScanInputError || error instanceof ApiError || error instanceof ApiUnreachable) return error.message;
  return fallback;
}

/** 다음 그리기 뒤에 그 id의 요소로 초점을 옮긴다(저장 뒤 원래 단추로) */
function focusLater(id: string) {
  window.requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
}

/** 숫자는 Geist Mono로(DESIGN.md 서체: 숫자에만 Mono). 공용 ClaimValue는 그대로 두고 이 절에서 감싼다 */
function Num({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

/** 파일 고르기 단추. 브라우저 기본 파일 칸 대신 단추 하나로 보인다 */
function PickButton({
  id,
  text,
  label,
  accept,
  capture,
  multiple = false,
  disabled,
  onFiles,
}: {
  id?: string;
  text: string;
  label: string;
  accept: string;
  capture?: "environment";
  multiple?: boolean;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label
      className={`${buttonClass("secondary", "sm")} cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:border-transparent has-[:disabled]:bg-sunken has-[:disabled]:text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}
    >
      {text}
      <input
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** 진행 단계 넷을 세로 목록으로. 지금 단계에는 점 세 개, 끝난 단계는 먹 점. 숫자를 세어 올리지 않는다 */
function Steps({ current }: { current: ScanStepKey }) {
  return (
    <ol className="mt-3 space-y-2 text-sm" aria-label="분석 진행">
      {stepStates(current).map((step) => (
        <li key={step.key} className="flex min-h-6 items-center gap-3">
          <span aria-hidden="true" className="flex w-8 shrink-0 justify-center">
            {step.state === "now" ? (
              <span className="inline-flex items-center gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="size-1.5 rounded-full bg-ink [animation:rs-dot_1.2s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 160}ms` }}
                  />
                ))}
              </span>
            ) : (
              <span className={`size-2 rounded-full ${step.state === "done" ? "bg-ink" : "border border-line-strong"}`} />
            )}
          </span>
          <span className={step.state === "waiting" ? "text-muted" : step.state === "now" ? "font-medium text-ink" : "text-ink-2"}>
            {step.label}
            <span className="sr-only">{step.state === "done" ? " (끝남)" : step.state === "now" ? " (지금)" : " (기다림)"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 부피 값: 소수 둘째 자리로 적고 누르면 근거가 열린다 */
function VolumeValue({ claim }: { claim: ScanPile["volume"] }) {
  const text = typeof claim.value === "number" ? `${m3(claim.value)} m³` : undefined;
  return (
    <Num>
      <ClaimValue claim={claim} display={text} className="whitespace-nowrap" />
    </Num>
  );
}

/**
 * 무게 범위 "713~881 kg"를 단추 하나로(가운데서 줄을 바꾸지 않고, 휴대폰에서도 누르기 쉽게). 누르면 하한 근거가 열리고,
 * 근거 패널의 계산 사슬에서 부피 범위와 밀도를 따라가 상한도 볼 수 있다. 같으면 값 하나
 */
function WeightRange({ weight }: { weight: NonNullable<ScanPile["weight"]> }) {
  const { low, high } = weight;
  const both = typeof low.value === "number" && typeof high.value === "number";
  const same = both && Math.round(low.value as number) === Math.round(high.value as number);
  const text = both
    ? same
      ? `${formatNumber(Math.round(low.value as number))} kg`
      : `${formatNumber(Math.round(low.value as number))}~${formatNumber(Math.round(high.value as number))} kg`
    : undefined;
  return (
    <Num>
      <ClaimValue claim={low} display={text} className="inline-block min-h-8 whitespace-nowrap" />
    </Num>
  );
}

/** 무게 칸: 범위(같으면 하나), 무게 기준. 폐기물을 고르지 않았으면 안내, 기준이 없으면 계량값 필요 */
function WeightCell({ pile, canAct, busy, onWeigh }: { pile: ScanPile; canAct: boolean; busy: boolean; onWeigh: () => void }) {
  const { openEvidence } = useV3();
  const weighButton = (text: string, extra = "") =>
    canAct ? (
      <Button
        id={`scan-weigh-${pile.id}`}
        variant="ghost"
        size="sm"
        className={`-ml-3 ${extra}`}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onWeigh();
        }}
      >
        {text}
      </Button>
    ) : null;
  if (!pile.streamId) {
    return <span className="text-[13px] text-muted">폐기물을 고르면 계산합니다</span>;
  }
  if (!pile.weight) {
    return (
      <div>
        <span className="text-[13px] font-medium text-warn">계량값 필요</span>
        {weighButton("계량한 무게 적기", "block")}
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <WeightRange weight={pile.weight} />
      {pile.weighedKg ? (
        // 계량한 더미는 계량값 그대로다(하한 = 상한). 사람이 적은 값이라 먹색으로 적는다
        <button
          type="button"
          className={`mt-0.5 block text-left text-[12px] text-ink-2 ${link}`}
          onClick={() => openEvidence(pile.weighedKg?.evidence ?? [], `${pile.name} 계량한 무게`)}
          disabled={pile.weighedKg.evidence.length === 0}
        >
          담당자가 계량한 무게
        </button>
      ) : pile.density ? (
        <button
          type="button"
          className={`mt-0.5 block text-left text-[12px] text-muted ${link}`}
          onClick={() => openEvidence(pile.density?.evidence ?? [], `${pile.name} 무게 기준`)}
          disabled={pile.density.evidence.length === 0}
        >
          {pile.density.label}
        </button>
      ) : null}
      {weighButton(pile.weighedKg ? "계량값 고치기" : "계량한 무게 적기")}
    </div>
  );
}

/**
 * 계량한 무게를 적는 상자. 같은 폐기물 더미의 무게를 이 값으로 보정한다.
 * Enter로 기록하고 Esc로 닫는다. 서버가 거절하면(밀도가 맞지 않음 등) 그 문장을 상자 안에 보인다.
 */
function WeighForm({
  pile,
  busy,
  error,
  onSave,
  onCancel,
}: {
  pile: ScanPile;
  busy: boolean;
  error: string | null;
  onSave: (kg: number | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(typeof pile.weighedKg?.value === "number" ? String(pile.weighedKg.value) : "");
  const value = weighedValue(text);
  const inputId = `weigh-${pile.id}`;
  const hintId = `weigh-${pile.id}-hint`;
  const errorId = `weigh-${pile.id}-error`;
  const invalid = text.trim() !== "" && value === null;
  return (
    <form
      className="rounded-md border border-ink px-4 py-3"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value !== null) onSave(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <label htmlFor={inputId} className="text-[13px] font-medium">
        {pile.name}의 계량 무게
      </label>
      <p id={hintId} className="mt-0.5 text-[12.5px] text-muted">
        적은 무게로 이 더미의 겉보기 밀도를 구해, 같은 폐기물로 지정한 더미의 무게를 다시 계산합니다.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2">
          <input
            id={inputId}
            // 상자를 열면 바로 적을 수 있게 한다
            autoFocus
            inputMode="decimal"
            className={`${field} w-32 font-mono tabular-nums`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="예: 480"
            aria-invalid={invalid || Boolean(error) || undefined}
            aria-describedby={error || invalid ? errorId : hintId}
          />
          <span className="text-sm text-ink-2">kg</span>
        </span>
        <Button type="submit" variant="secondary" size="sm" disabled={value === null} aria-disabled={busy || undefined}>
          {busy ? "기록하는 중" : "기록"}
        </Button>
        {pile.weighedKg ? (
          <Button
            variant="ghost"
            size="sm"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onSave(null);
            }}
          >
            계량값 지우기
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>
      {invalid ? (
        <p id={errorId} className="mt-1 text-[12.5px] text-warn">
          0보다 크고 <Num>{formatNumber(MAX_WEIGHED_KG)}</Num> kg 이하인 숫자를 적어 주세요.
        </p>
      ) : error ? (
        <p id={errorId} role="alert" className="mt-1 text-[12.5px] text-loss">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** 정리안 지표 칸. 값은 누르면 계산 근거가 열린다 */
function MetricValue({ cell, strong = false }: { cell: MetricCell; strong?: boolean }) {
  if (!cell.claim) return <span className="text-muted">{cell.text}</span>;
  return (
    <Num>
      <ClaimValue claim={cell.claim} display={cell.text} className={strong ? "" : "text-ink-2"} />
    </Num>
  );
}

/** 배치 기준(가정값) 숫자 하나. 누르면 가정값 근거가 열린다 */
function RuleValue({ value, evidence }: { value: number; evidence: string[] }) {
  const { openEvidence } = useV3();
  return (
    <button
      type="button"
      className={`font-mono font-semibold tabular-nums ${link}`}
      onClick={() => openEvidence(evidence, "정리안 배치 가정값")}
      disabled={evidence.length === 0}
    >
      {formatNumber(value)} m
    </button>
  );
}

type PileError = { pileId: string; kind: "stream" | "weigh" | "exclude"; message: string };

/** 분석이 끝난 스캔: 요약 한 줄, 더미 목록, 정리안 지표와 3D 보기, 접어 둔 배치 기준 */
function ScanResult({
  view,
  streams,
  canAct,
  onUpdated,
}: {
  view: ScanView;
  streams: StreamRecord[];
  canAct: boolean;
  onUpdated: (view: ScanView) => void;
}) {
  const { org } = useV3();
  const [open3d, setOpen3d] = useState(false);
  const [weighing, setWeighing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<PileError | null>(null);
  const summary = view.summary;
  const layout = view.layout;
  const pending = pendingText(view);
  const usedFrames = view.quality?.frames ?? view.frameCount;

  const putPile = async (pile: ScanPile, body: { streamId?: string | null; weighedKg?: number | null; excluded?: boolean }) => {
    const kind: PileError["kind"] = "weighedKg" in body ? "weigh" : "excluded" in body ? "exclude" : "stream";
    setBusy(pile.id);
    setError(null);
    try {
      const next = await api.putScanPile(org.id, view.id, pile.id, body);
      onUpdated(next);
      if (kind === "weigh") {
        setWeighing(null);
        focusLater(`scan-weigh-${pile.id}`);
      }
      // 빼거나 다시 넣은 뒤에는 그 줄의 반대 단추로 초점을 옮긴다
      if (kind === "exclude") focusLater(body.excluded ? `scan-include-${pile.id}` : `scan-exclude-${pile.id}`);
    } catch (failure) {
      setError({ pileId: pile.id, kind, message: friendly(failure) });
    } finally {
      setBusy(null);
    }
  };

  if (!summary || summary.pileCount === 0) {
    return (
      <div role="status" className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
        <p className="font-medium text-ink">보관장에서 더미를 찾지 못했습니다</p>
        <p className="mt-0.5">바닥과 더미가 함께 보이게 조금 떨어져서, 보관장을 천천히 한 바퀴 돌며 다시 찍어 주세요.</p>
        {(view.quality?.notes ?? []).map((note) => (
          <p key={note} className="mt-0.5">
            {note}
          </p>
        ))}
      </div>
    );
  }

  const now = layout?.current.weightedDistanceM;
  const next = layout?.proposal?.metrics.weightedDistanceM;
  const keptLine = keptText(view);
  const fartherThanNow = layout?.proposal != null && now != null && next != null && !(now > next);

  return (
    <div className="mt-5">
      <p className="text-[18px] leading-snug font-semibold tracking-[-0.02em]">
        <span className="whitespace-nowrap">
          더미 <Num>{summary.pileCount}</Num>개
        </span>
        {" · "}
        <span className="whitespace-nowrap">
          부피 <VolumeValue claim={summary.volume} />
        </span>
        {summary.weight ? (
          <>
            {" · "}
            <span className="whitespace-nowrap">
              무게 약 <WeightRange weight={summary.weight} />
            </span>
          </>
        ) : null}
        {pending ? <span className="text-[14px] font-medium text-warn"> · {pending}</span> : null}
      </p>
      <p className="mt-1 text-[13px] text-muted">
        <span className="tabular-nums">{scanTime(view.createdAt)}</span> · 장면 <Num>{usedFrames}</Num>장
        {summary.floorArea ? (
          <>
            {" · "}보인 바닥{" "}
            <Num>
              <ClaimValue claim={summary.floorArea} />
            </Num>
          </>
        ) : null}
        {summary.weight && pending ? " · 무게 합계는 무게를 잰 더미만의 합입니다" : null}
        {summary.excludedCount > 0 ? (
          <>
            {" · "}더미 아님 <Num>{summary.excludedCount}</Num>개 뺌
          </>
        ) : null}
      </p>

      {/* 넓은 화면은 네 칸 표처럼, 휴대폰은 줄마다 세로로 쌓는다(가로로 넘치지 않는다) */}
      <div className="mt-4 text-sm">
        <div
          aria-hidden="true"
          className="hidden border-b border-line pb-2 text-[13px] font-medium text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_170px_110px_170px] sm:gap-3"
        >
          <span>더미</span>
          <span>폐기물</span>
          <span>부피</span>
          <span>무게</span>
        </div>
        <ul aria-label="더미 목록">
          {view.piles.map((pile) => (
            <PileRow
              key={pile.id}
              pile={pile}
              streams={streams}
              canAct={canAct}
              busy={busy === pile.id}
              weighing={weighing === pile.id}
              error={error?.pileId === pile.id ? error : null}
              onStream={(streamId) => void putPile(pile, { streamId })}
              onExclude={(excluded) => void putPile(pile, { excluded })}
              onWeigh={() => {
                setError(null);
                setWeighing(pile.id);
              }}
              onWeighSave={(kg) => void putPile(pile, { weighedKg: kg })}
              onWeighCancel={() => {
                setWeighing(null);
                setError(null);
                focusLater(`scan-weigh-${pile.id}`);
              }}
            />
          ))}
        </ul>
      </div>

      {(view.quality?.notes ?? []).map((note) => (
        <p key={note} className="mt-2 text-[12.5px] text-muted">
          {note}
        </p>
      ))}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="text-[15px] font-semibold">정리안</h3>
          <Button variant="secondary" size="sm" onClick={() => setOpen3d((value) => !value)} aria-expanded={open3d}>
            {open3d ? "3D 닫기" : "3D 보기"}
          </Button>
        </div>
        {layout?.proposal ? (
          <div className="mt-2">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-muted">
                  <th className="py-1.5 pr-3 font-medium">지표</th>
                  <th className="py-1.5 pr-3 font-medium">지금</th>
                  <th className="py-1.5 font-medium">정리안</th>
                </tr>
              </thead>
              <tbody>
                {metricRows(layout.current, layout.proposal.metrics, layout.rules.gapM).map((row) => (
                  <tr key={row.key} className="border-b border-line">
                    <td className="py-2 pr-3 text-ink-2">{row.label}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <MetricValue cell={row.now} />
                    </td>
                    <td className="py-2 whitespace-nowrap">{row.next ? <MetricValue cell={row.next} strong /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-[12.5px] text-muted">
              더미 <Num>{layout.proposal.moved}</Num>개를 옮기는 안입니다. 폐기물을 고르지 않은 더미는 제자리에 둡니다.
            </p>
            {keptLine ? <p className="mt-1 text-[12.5px] text-muted">{keptLine}</p> : null}
            {fartherThanNow ? (
              <p className="mt-1 text-[12.5px] font-medium text-warn">
                상차 지점이 바뀌어 지금 배치보다 상차 지점에서 멀어진 더미가 있습니다. 상차 지점을 다시 확인해 주세요.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-muted">{layout?.unavailable ?? "정리안을 그리지 못했습니다."}</p>
        )}
      </div>
      {open3d ? <ScanViewer view={view} orgId={org.id} canAct={canAct} onUpdated={onUpdated} /> : null}

      {layout ? (
        <MoreDetails className="mt-2" label="배치 기준 보기">
          <div className="rounded-xl bg-ground px-4 py-3 text-[13px] text-ink-2">
            <p>
              다른 폐기물 사이 간격 <RuleValue value={layout.rules.gapM} evidence={layout.rules.evidence} /> · 벽 여유{" "}
              <RuleValue value={layout.rules.wallM} evidence={layout.rules.evidence} /> · 상차 지점 반경{" "}
              <RuleValue value={layout.rules.pickupClearM} evidence={layout.rules.evidence} />은 섞임을 줄이고 상차 길을 비우려고
              서비스가 정한 배치 <span className="font-medium text-warn">가정값</span>이며 법령 기준이 아닙니다.
            </p>
            <p className="mt-1">
              정리안은 이 기준으로 계산한 자리입니다. 부피가 큰 폐기물일수록 상차 지점에 가깝게 두고, 같은 폐기물은 한 구역에 모읍니다.
            </p>
          </div>
        </MoreDetails>
      ) : null}
    </div>
  );
}

function PileRow({
  pile,
  streams,
  canAct,
  busy,
  weighing,
  error,
  onStream,
  onExclude,
  onWeigh,
  onWeighSave,
  onWeighCancel,
}: {
  pile: ScanPile;
  streams: StreamRecord[];
  canAct: boolean;
  busy: boolean;
  weighing: boolean;
  error: PileError | null;
  onStream: (streamId: string | null) => void;
  onExclude: (excluded: boolean) => void;
  onWeigh: () => void;
  onWeighSave: (kg: number | null) => void;
  onWeighCancel: () => void;
}) {
  const { openEvidence } = useV3();
  const selectId = `scan-stream-${pile.id}`;
  const range = (
    <span className="font-mono text-[12px] font-normal text-muted tabular-nums">
      {m3(pile.volumeRangeM3[0])}~{m3(pile.volumeRangeM3[1])}
    </span>
  );
  const [zoomed, setZoomed] = useState(false);
  const exclude = (excluded: boolean) => {
    if (!busy) onExclude(excluded);
  };
  const identity = (
    <div className="flex min-w-0 items-start gap-2.5">
      {pile.thumbnail ? (
        // 썸네일이 "더미 아님"을 가르는 근거라 눌러서 크게 본다
        <button
          type="button"
          aria-expanded={zoomed}
          aria-label={`${pile.name} 장면 ${zoomed ? "작게" : "크게"} 보기`}
          className="shrink-0 rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink"
          onClick={() => setZoomed((value) => !value)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 보낸 작은 장면 사진(data URL)이라 최적화가 필요 없다 */}
          <img src={pile.thumbnail} alt="" width={56} height={56} className={`size-14 rounded-md object-cover ${pile.excluded ? "opacity-50" : ""}`} />
        </button>
      ) : (
        <span aria-hidden="true" className="size-14 shrink-0 rounded-md bg-sunken" />
      )}
      <div className="min-w-0">
        <p className={`font-medium ${pile.excluded ? "text-muted line-through decoration-line-strong" : ""}`}>{pile.name}</p>
        {/* 크기·높이는 이 더미의 부피 근거(3D 재구성)에 함께 적혀 있다 */}
        <button
          type="button"
          className="text-left text-[12px] text-muted underline-offset-4 hover:underline"
          onClick={() => openEvidence(pile.volume.evidence, `${pile.name} 크기와 부피`)}
          disabled={pile.volume.evidence.length === 0}
        >
          <Num>
            {fix2(pile.sizeM[0])} × {fix2(pile.sizeM[1])}
          </Num>{" "}
          m · 높이 <Num>{fix2(pile.heightM)}</Num> m
        </button>
        {pile.note && !pile.excluded ? <p className="mt-0.5 text-[12px] text-muted">{pile.note}</p> : null}
        {canAct && !pile.excluded ? (
          <div>
            <Button
              id={`scan-exclude-${pile.id}`}
              variant="ghost"
              size="sm"
              className="-ml-3 text-muted"
              aria-disabled={busy || undefined}
              aria-label={`${pile.name} 빼기: 더미가 아님(벽·바닥 자국 등)`}
              onClick={() => exclude(true)}
            >
              더미 아님
            </Button>
          </div>
        ) : null}
        {error?.kind === "exclude" ? (
          <p role="alert" className="mt-1 text-[12.5px] text-loss">
            {error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
  const zoom =
    zoomed && pile.thumbnail ? (
      <div className="mt-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 보낸 장면 사진(data URL) */}
        <img src={pile.thumbnail} alt={`${pile.name} 장면`} width={240} height={240} className="w-60 max-w-full rounded-lg object-contain" />
      </div>
    ) : null;

  if (pile.excluded) {
    return (
      <li className="border-b border-line py-3 text-muted" aria-busy={busy || undefined}>
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_450px] sm:items-start sm:gap-3">
          {identity}
          <p className="flex flex-wrap items-center gap-x-1 text-[13px]">
            합계와 정리안에서 뺐습니다
            {canAct ? (
              <>
                {" · "}
                <Button
                  id={`scan-include-${pile.id}`}
                  variant="ghost"
                  size="sm"
                  className="-ml-1"
                  aria-disabled={busy || undefined}
                  aria-label={`${pile.name} 다시 넣기`}
                  onClick={() => exclude(false)}
                >
                  다시 넣기
                </Button>
              </>
            ) : null}
          </p>
        </div>
        {zoom}
      </li>
    );
  }

  return (
    <li className="border-b border-line py-3" aria-busy={busy || undefined}>
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_170px_110px_170px] sm:items-start sm:gap-3">
        {identity}
        <div className="min-w-0">
          {canAct ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                {pile.name}의 폐기물
              </label>
              {/* 저장하는 동안에도 끄지 않는다(끄면 초점이 화면 밖으로 튄다). 그동안 고른 값은 받지 않는다 */}
              <select
                id={selectId}
                className={`${field} w-full text-[14px]`}
                value={pile.streamId ?? ""}
                aria-busy={busy || undefined}
                onChange={(event) => {
                  if (!busy) onStream(event.target.value || null);
                }}
              >
                <option value="">폐기물 고르기</option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
              {error?.kind === "stream" ? (
                <p role="alert" className="mt-1 text-[12.5px] text-loss">
                  {error.message}
                </p>
              ) : null}
            </>
          ) : (
            <span className={pile.streamName ? "" : "text-muted"}>
              <span className="text-muted sm:hidden">폐기물 </span>
              {pile.streamName ?? "지정 안 함"}
            </span>
          )}
        </div>
        {/* 넓은 화면: 부피 칸 */}
        <div className="hidden sm:block">
          <VolumeValue claim={pile.volume} />
          <span className="mt-0.5 block">{range}</span>
        </div>
        {/* 휴대폰: 부피 한 줄 */}
        <p className="sm:hidden">
          <span className="text-muted">부피 </span>
          <span className="whitespace-nowrap">
            <VolumeValue claim={pile.volume} /> {range}
          </span>
        </p>
        <div className="flex flex-wrap items-baseline gap-x-1">
          <span className="text-muted sm:hidden">무게 </span>
          <WeightCell pile={pile} canAct={canAct} busy={busy} onWeigh={onWeigh} />
        </div>
      </div>
      {zoom}
      {weighing ? (
        <div className="mt-3">
          <WeighForm
            pile={pile}
            busy={busy}
            error={error?.kind === "weigh" ? error.message : null}
            onSave={onWeighSave}
            onCancel={onWeighCancel}
          />
        </div>
      ) : null}
    </li>
  );
}

/** 이 회사의 스캔 목록. 다시 읽다 실패해도 앞서 읽은 목록은 남긴다 */
function useScanList(orgId: string, enabled: boolean) {
  const [state, setState] = useState<{ orgId: string; list: ScanList | null; error: string | null }>({
    orgId: "",
    list: null,
    error: null,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .listScans(orgId)
      .then((list) => {
        if (alive) setState({ orgId, list, error: null });
      })
      .catch((error: unknown) => {
        if (alive) setState((before) => ({ orgId, list: before.orgId === orgId ? before.list : null, error: friendly(error) }));
      });
    return () => {
      alive = false;
    };
  }, [orgId, enabled, version]);
  const reload = useCallback(() => setVersion((before) => before + 1), []);
  const mine = state.orgId === orgId ? state : null;
  return { list: mine?.list ?? null, error: mine?.error ?? null, loading: enabled && mine === null, reload };
}

/**
 * "보관장 3D 스캔" 절. 등록한 폐기물이 있을 때 자료 화면 아래에 붙는다.
 */
export function StorageScan({ streams }: { streams: StreamRecord[] }) {
  const { org, mode, canWrite, readOnly } = useV3();
  const remote = useScanList(org.id, mode === "live");
  const [local, setLocal] = useState<Local>({ phase: "idle" });
  const [overrides, setOverrides] = useState<Record<string, ScanView>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [poll, setPoll] = useState({ tick: 0, fails: 0 });
  const list = remote.list;
  const reload = remote.reload;

  const mine = Object.values(overrides).filter((view) => view.orgId === org.id);
  const scans = (list?.scans ?? []).map((scan) => mine.find((view) => view.id === scan.id) ?? scan);
  const extra = mine.filter((view) => !scans.some((scan) => scan.id === view.id));
  const all = [...extra, ...scans];
  const latest = currentScan(list ? { canScan: list.canScan, scans: all } : null);
  const shown = (selected ? all.find((scan) => scan.id === selected) : null) ?? latest;
  const processingId = shown?.status === "processing" ? shown.id : null;
  const stalled = poll.fails >= MAX_POLL_FAILS;

  // 진행 중이면 2초마다 다시 읽는다. 끝나면 목록도 다시 읽는다. 연달아 읽지 못하면(약 30초) 멈추고 다시 시도 단추를 보인다
  useEffect(() => {
    if (!processingId || stalled) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      api
        .getScan(org.id, processingId)
        .then((view) => {
          if (!alive) return;
          setOverrides((before) => ({ ...before, [view.id]: view }));
          setPoll((before) => ({ tick: before.tick + 1, fails: 0 }));
          if (view.status !== "processing") reload();
        })
        .catch(() => {
          if (alive) setPoll((before) => ({ tick: before.tick + 1, fails: before.fails + 1 }));
        });
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [processingId, org.id, poll.tick, stalled, reload]);

  if (mode !== "live" || remote.loading) return null;
  const canAct = canWrite && !readOnly;
  const heading = (
    <>
      <h2 id="storage-scan-title" className="text-[20px] font-semibold tracking-[-0.02em]">
        보관장 3D 스캔
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">
        휴대폰으로 폐기물 보관장을 천천히 한 바퀴 찍어 올리면, 더미마다 부피와 무게를 재고 폐기물별로 나눠 둘 자리를 3D로 그립니다.
      </p>
    </>
  );
  if (!list) {
    // 처음 불러오기에 실패했다
    return (
      <section aria-labelledby="storage-scan-title" className="mt-12 border-t border-line pt-8">
        {heading}
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-[13.5px] text-ink-2">
          <span>보관장 3D 스캔을 불러오지 못했습니다. {remote.error ?? UNAVAILABLE}</span>
          <Button variant="secondary" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </div>
      </section>
    );
  }
  if (!showScanSection({ canScan: list.canScan, scans: all }) && local.phase === "idle") return null;

  const inProgress = all.some((scan) => scan.status === "processing");
  const canUpload = canAct && list.canScan;
  const busy = local.phase === "preparing" || local.phase === "sending";
  const uploadOff = busy || inProgress;

  const start = async (kind: "video" | "photos", files: File[], checkedOrientation = false) => {
    setLocal({ phase: "preparing" });
    let set: { frames: Blob[]; source: "video" | "photos"; durationSec: number | null };
    try {
      const frames = await import("@/lib/v3/scan-frames");
      if (kind === "video" && !checkedOrientation) {
        // 세로로 찍은 영상이면 올리기 전에 한 번 묻는다(막지는 않는다)
        const { portrait } = await frames.probeVideo(files[0]);
        if (portrait) {
          setLocal({ phase: "portrait", file: files[0] });
          return;
        }
      }
      set = kind === "video" ? await frames.framesFromVideo(files[0]) : await frames.framesFromPhotos(files);
    } catch (error) {
      // 장면 고르기에서 난 문제만 영상 탓으로 말한다
      setLocal({ phase: "error", message: error instanceof ScanInputError ? error.message : FRAMES_FAILED });
      return;
    }
    setLocal({ phase: "sending" });
    try {
      const view = await api.uploadScan(org.id, set.frames, set.source, set.durationSec);
      setOverrides((before) => ({ ...before, [view.id]: view }));
      setSelected(view.id);
      setPoll({ tick: 0, fails: 0 });
      setLocal({ phase: "idle" });
      reload();
    } catch (error) {
      setLocal({ phase: "error", message: friendly(error) });
      // 이미 분석 중인 스캔이 있으면 목록을 다시 읽어 그 진행을 보인다
      if (error instanceof ApiError && error.code === "SCAN_IN_PROGRESS") reload();
    }
  };
  /** "다시 찍기": 휴대폰이면 카메라를, 아니면 파일 고르기를 다시 연다 */
  const retake = () => {
    setLocal({ phase: "idle" });
    const capture = document.getElementById("scan-capture-input");
    const target = capture && capture.offsetParent !== null ? capture : document.getElementById("scan-upload-input");
    if (target instanceof HTMLInputElement) target.click();
  };
  /** 고른 파일에 영상이 있으면 첫 영상을, 없으면 사진 여러 장으로 본다 */
  const send = (files: File[]) => {
    if (uploadOff) return;
    const video = files.find((file) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name));
    void (video ? start("video", [video]) : start("photos", files));
  };
  const update = (view: ScanView) => setOverrides((before) => ({ ...before, [view.id]: view }));
  const earlier = all.filter((scan) => scan.id !== shown?.id);
  const showLocal = local.phase === "preparing" || local.phase === "sending";
  // 진행 단계는 고정된 알림 영역 하나에 글로 알린다
  const liveText =
    local.phase === "preparing"
      ? "장면 고르는 중입니다."
      : local.phase === "sending"
        ? "장면을 보내는 중입니다."
        : shown?.status === "processing"
          ? stalled
            ? UNAVAILABLE
            : `${stepStates(stepOf(shown.progress?.stage)).find((step) => step.state === "now")?.label ?? ""}입니다.`
          : "";

  return (
    <section aria-labelledby="storage-scan-title" className="mt-12 border-t border-line pt-8">
      {heading}
      <p aria-live="polite" className="sr-only">
        {liveText}
      </p>

      {canUpload ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {/* 휴대폰(손가락으로 누르는 화면)에서는 뒤 카메라 영상 촬영을 바로 연다 */}
            <span className="hidden pointer-coarse:contents">
              <span className="flex items-center gap-2">
                <PickButton
                  id="scan-capture-input"
                  text="영상 찍기"
                  label="보관장 영상 찍기. 휴대폰을 가로로 들고 찍어 주세요"
                  accept="video/*"
                  capture="environment"
                  disabled={uploadOff}
                  onFiles={send}
                />
                <span aria-hidden="true" className="text-[12.5px] text-muted">
                  가로로 들고 찍기
                </span>
              </span>
            </span>
            <PickButton
              id="scan-upload-input"
              text="보관장 영상 올리기"
              label="보관장 영상 하나 또는 사진 12~80장 올리기"
              accept="video/*,image/*"
              multiple
              disabled={uploadOff}
              onFiles={send}
            />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {inProgress ? "지금 분석 중인 영상이 있습니다. 분석이 끝나면 새 영상을 올릴 수 있습니다." : GUIDE}
          </p>
        </div>
      ) : readOnly ? (
        <p className="mt-3 text-[13px] text-muted">체험하기에서는 보기만 할 수 있습니다.</p>
      ) : null}
      {remote.error ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          목록을 새로 고치지 못했습니다.
          <Button variant="ghost" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </p>
      ) : null}

      {local.phase === "portrait" ? (
        <div role="alert" className="mt-3">
          <p className="text-[13px] font-medium text-warn">세로로 찍은 영상입니다. 휴대폰을 가로로 들고 찍으면 더미를 더 정확히 찾습니다.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void start("video", [local.file], true)}>
              그래도 올리기
            </Button>
            <Button variant="ghost" size="sm" onClick={retake}>
              다시 찍기
            </Button>
          </div>
        </div>
      ) : null}
      {showLocal ? <Steps current="frames" /> : null}
      {local.phase === "error" ? (
        <p role="alert" className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
          {local.message}
        </p>
      ) : null}

      {shown && !showLocal ? (
        shown.status === "processing" ? (
          <div className="mt-4">
            <Steps current={stepOf(shown.progress?.stage)} />
            {stalled ? (
              <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
                <span>{UNAVAILABLE}</span>
                <Button variant="secondary" size="sm" onClick={() => setPoll((before) => ({ tick: before.tick + 1, fails: 0 }))}>
                  다시 시도
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">보통 1~2분 걸립니다. 이 화면을 떠나도 분석은 이어집니다.</p>
            )}
          </div>
        ) : shown.status === "failed" ? (
          <div role="status" className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
            <p>{shown.failure?.message ?? "보관장을 천천히 한 바퀴 돌며 다시 찍어 올려 주세요."}</p>
            {canUpload ? (
              <div className="mt-2.5">
                <PickButton
                  text="다시 올리기"
                  label="보관장 영상 다시 올리기"
                  accept="video/*,image/*"
                  multiple
                  disabled={uploadOff}
                  onFiles={send}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <ScanResult key={shown.id} view={shown} streams={streams} canAct={canAct} onUpdated={update} />
        )
      ) : null}

      {earlier.length > 0 ? (
        <MoreDetails className="mt-4" label={`이전 스캔 ${earlier.length}건`}>
          <ul className="divide-y divide-line text-[13.5px]">
            {earlier.map((scan) => (
              <li key={scan.id} className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-ink-2">
                  <span className="tabular-nums">{scanTime(scan.createdAt)}</span> ·{" "}
                  {scan.status === "done" ? (
                    <>
                      더미 <Num>{scan.summary?.pileCount ?? 0}</Num>개
                    </>
                  ) : scan.status === "processing" ? (
                    "분석 중"
                  ) : (
                    "분석하지 못함"
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelected(scan.id)}>
                  보기
                </Button>
              </li>
            ))}
          </ul>
        </MoreDetails>
      ) : null}
    </section>
  );
}
