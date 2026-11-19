"use client";

/**
 * 자료 화면의 "보관장 3D 스캔"(배출 기업, DESIGN.md "보관장 3D 스캔"). 휴대폰으로 보관장을 한 바퀴 찍어 올리면 브라우저가
 * 장면 사진을 골라 보내고, 서버가 3D로 재구성해 더미마다 부피·무게를 재고 폐기물별로 나눠 둘 정리안을 낸다.
 * 요약 한 줄과 더미 표를 먼저 보이고, 3D 보기와 정리안 지표·가정값은 열어서 본다.
 * 분석을 받을 수 없고 스캔도 없으면 절을 그리지 않는다(준비되지 않은 기능은 두지 않는다).
 * 계약: ~/rs-work/scan/CONTRACT.md
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Dots } from "@/components/agent/dots";
import { Button, buttonClass } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { ApiError, ApiUnreachable, api } from "@/lib/v3/api";
import { formatNumber } from "@/lib/v3/format";
import {
  ScanInputError,
  currentScan,
  metricRows,
  pendingText,
  scanTime,
  showScanSection,
  stepOf,
  stepStates,
  weighedValue,
  type ScanStepKey,
} from "@/lib/v3/scan";
import type { ScanList, ScanPile, ScanView, StreamRecord } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

const ScanViewer = dynamic(() => import("./scan-viewer").then((module) => module.ScanViewer), {
  ssr: false,
  loading: () => <p className="mt-4 text-sm text-muted">3D 보기를 여는 중입니다.</p>,
});

const POLL_MS = 2000;
const link = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const field =
  "min-h-11 min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";

type Local =
  | { phase: "idle" }
  | { phase: "preparing"; done: number; total: number }
  | { phase: "sending" }
  | { phase: "error"; message: string };

function friendly(error: unknown, fallback: string): string {
  if (error instanceof ScanInputError || error instanceof ApiError || error instanceof ApiUnreachable) return error.message;
  return fallback;
}

/** 파일 고르기 단추. 브라우저 기본 파일 칸 대신 단추 하나로 보인다 */
function PickButton({
  text,
  label,
  accept,
  capture,
  multiple = false,
  disabled,
  onFiles,
}: {
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

/** 진행 단계 넷을 세로 목록으로. 지금 단계에는 점 세 개, 끝난 단계는 먹 점, 남은 단계는 빈 점 */
function Steps({ current, frames }: { current: ScanStepKey; frames: string | null }) {
  return (
    <ol className="mt-3 space-y-2 text-sm" aria-label="분석 진행">
      {stepStates(current).map((step) => (
        <li key={step.key} className="flex min-h-6 items-center gap-3">
          <span className="flex w-6 shrink-0 justify-center">
            {step.state === "now" ? (
              <Dots label={step.label} />
            ) : (
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${step.state === "done" ? "bg-ink" : "border border-line-strong"}`}
              />
            )}
          </span>
          <span className={step.state === "waiting" ? "text-muted" : step.state === "now" ? "font-medium text-ink" : "text-ink-2"}>
            {step.label}
            {step.key === "frames" && frames ? <span className="ml-2 text-muted tabular-nums">{frames}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 무게 칸: 범위(같으면 하나), 밀도 출처. 없으면 계량값 필요 */
function WeightCell({ pile, canAct, onWeigh }: { pile: ScanPile; canAct: boolean; onWeigh: () => void }) {
  const { openEvidence } = useV3();
  if (!pile.streamId) {
    return <span className="text-[13px] text-muted">폐기물을 고르면 계산합니다</span>;
  }
  if (!pile.weight) {
    return (
      <div>
        <span className="text-[13px] font-medium text-warn">계량값 필요</span>
        {canAct ? (
          <Button variant="ghost" size="sm" className="-ml-3 block" onClick={onWeigh}>
            계량한 무게 적기
          </Button>
        ) : null}
      </div>
    );
  }
  const { low, high } = pile.weight;
  const same = typeof low.value === "number" && typeof high.value === "number" && Math.round(low.value) === Math.round(high.value);
  return (
    <div>
      <span className="whitespace-nowrap">
        {same ? (
          <ClaimValue claim={low} className="font-medium" />
        ) : (
          <>
            <ClaimValue
              claim={low}
              display={typeof low.value === "number" ? formatNumber(low.value) : undefined}
              hideAssumed
              className="font-medium"
            />
            ~
            <ClaimValue claim={high} className="font-medium" />
          </>
        )}
      </span>
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
      {canAct ? (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={onWeigh}>
          {pile.weighedKg ? "계량값 고치기" : "계량한 무게 적기"}
        </Button>
      ) : null}
    </div>
  );
}

/** 계량한 무게를 적는 줄. 같은 폐기물 더미의 무게를 이 값으로 보정한다 */
function WeighForm({
  pile,
  busy,
  onSave,
  onCancel,
}: {
  pile: ScanPile;
  busy: boolean;
  onSave: (kg: number | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(typeof pile.weighedKg?.value === "number" ? String(pile.weighedKg.value) : "");
  const value = weighedValue(text);
  const inputId = `weigh-${pile.id}`;
  return (
    <div className="rounded-[10px] border border-ink px-4 py-3">
      <label htmlFor={inputId} className="text-[13px] font-medium">
        {pile.name}의 계량 무게
      </label>
      <p className="mt-0.5 text-[12.5px] text-muted">
        적은 무게로 이 더미의 겉보기 밀도를 구해, 같은 폐기물로 지정한 더미의 무게를 다시 계산합니다.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2">
          <input
            id={inputId}
            inputMode="decimal"
            className={`${field} w-32 tabular-nums`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="예: 480"
          />
          <span className="text-sm text-ink-2">kg</span>
        </span>
        <Button variant="secondary" size="sm" disabled={busy || value === null} onClick={() => onSave(value)}>
          기록
        </Button>
        {pile.weighedKg ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onSave(null)}>
            계량값 지우기
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          취소
        </Button>
      </div>
      {text.trim() !== "" && value === null ? <p className="mt-1 text-[12.5px] text-warn">0보다 큰 숫자(kg)를 적어 주세요.</p> : null}
    </div>
  );
}

/** 분석이 끝난 스캔: 요약 한 줄, 더미 표, 정리안 한 줄과 3D 보기, 접어 둔 지표·가정값 */
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
  const { org, openEvidence } = useV3();
  const [open3d, setOpen3d] = useState(false);
  const [weighing, setWeighing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = view.summary;
  const layout = view.layout;
  const pending = pendingText(view);

  const putPile = async (pile: ScanPile, body: { streamId?: string | null; weighedKg?: number | null }) => {
    setBusy(pile.id);
    setError(null);
    try {
      const next = await api.putScanPile(org.id, view.id, pile.id, body);
      onUpdated(next);
      if ("weighedKg" in body) setWeighing(null);
    } catch (failure) {
      setError(friendly(failure, "바꾸지 못했습니다. 다시 시도해 주세요."));
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

  return (
    <div className="mt-5">
      <p className="text-[18px] leading-snug font-semibold tracking-[-0.02em]">
        더미 <span className="tabular-nums">{summary.pileCount}</span>개 · 부피 <ClaimValue claim={summary.volume} />
        {summary.weight ? (
          <>
            {" · "}무게 약{" "}
            <ClaimValue
              claim={summary.weight.low}
              display={typeof summary.weight.low.value === "number" ? formatNumber(summary.weight.low.value) : undefined}
              hideAssumed
            />
            ~<ClaimValue claim={summary.weight.high} />
          </>
        ) : null}
        {pending ? <span className="text-[14px] font-medium text-warn"> · {pending}</span> : null}
      </p>
      <p className="mt-1 text-[13px] text-muted">
        {scanTime(view.createdAt)} · 장면 <span className="tabular-nums">{view.frameCount}</span>장
        {summary.weight && pending ? " · 무게 합계는 무게를 잰 더미만의 합입니다" : null}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-muted">
              <th className="py-2 pr-3 font-medium">더미</th>
              <th className="py-2 pr-3 font-medium">폐기물</th>
              <th className="py-2 pr-3 font-medium">부피</th>
              <th className="py-2 font-medium">무게</th>
            </tr>
          </thead>
          <tbody>
            {view.piles.map((pile) => (
              <PileRow
                key={pile.id}
                pile={pile}
                streams={streams}
                canAct={canAct}
                busy={busy === pile.id}
                weighing={weighing === pile.id}
                onStream={(streamId) => void putPile(pile, { streamId })}
                onWeigh={() => setWeighing(pile.id)}
                onWeighSave={(kg) => void putPile(pile, { weighedKg: kg })}
                onWeighCancel={() => setWeighing(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

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
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{row.now}</td>
                    <td className="py-2 font-medium whitespace-nowrap tabular-nums">{row.next ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-[12.5px] text-muted">
              더미 <span className="tabular-nums">{layout.proposal.moved}</span>개를 옮기는 안입니다. 폐기물을 고르지 않은 더미는 제자리에
              둡니다.
            </p>
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
              다른 폐기물 사이 간격 <span className="tabular-nums">{layout.rules.gapM}</span> m · 벽 여유{" "}
              <span className="tabular-nums">{layout.rules.wallM}</span> m · 상차 지점 반경{" "}
              <span className="tabular-nums">{layout.rules.pickupClearM}</span> m는 섞임을 줄이고 상차 길을 비우려고 서비스가 정한 배치{" "}
              <button
                type="button"
                className={`font-medium text-warn ${link}`}
                onClick={() => openEvidence(layout.rules.evidence, "정리안 배치 가정값")}
                disabled={layout.rules.evidence.length === 0}
              >
                가정값
              </button>
              이며 법령 기준이 아닙니다.
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
  onStream,
  onWeigh,
  onWeighSave,
  onWeighCancel,
}: {
  pile: ScanPile;
  streams: StreamRecord[];
  canAct: boolean;
  busy: boolean;
  weighing: boolean;
  onStream: (streamId: string | null) => void;
  onWeigh: () => void;
  onWeighSave: (kg: number | null) => void;
  onWeighCancel: () => void;
}) {
  const selectId = `scan-stream-${pile.id}`;
  return (
    <>
      <tr className={`align-top ${weighing ? "" : "border-b border-line"}`}>
        <td className="py-3 pr-3">
          <div className="flex items-start gap-2.5">
            {pile.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- 서버가 보낸 작은 장면 사진(data URL)이라 최적화가 필요 없다
              <img src={pile.thumbnail} alt={`${pile.name} 장면`} width={56} height={56} className="size-14 shrink-0 rounded-md object-cover" />
            ) : (
              <span aria-hidden="true" className="size-14 shrink-0 rounded-md bg-sunken" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{pile.name}</p>
              <p className="text-[12px] text-muted tabular-nums">
                {formatNumber(Math.round(pile.sizeM[0] * 100) / 100)} × {formatNumber(Math.round(pile.sizeM[1] * 100) / 100)} m · 높이{" "}
                {formatNumber(Math.round(pile.heightM * 100) / 100)} m
              </p>
              {pile.note ? <p className="mt-0.5 text-[12px] text-muted">{pile.note}</p> : null}
            </div>
          </div>
        </td>
        <td className="py-3 pr-3">
          {canAct ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                {pile.name}의 폐기물
              </label>
              <select
                id={selectId}
                className={`${field} w-full max-w-[180px] text-[14px]`}
                value={pile.streamId ?? ""}
                disabled={busy}
                onChange={(event) => onStream(event.target.value || null)}
              >
                <option value="">고르기</option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className={pile.streamName ? "" : "text-muted"}>{pile.streamName ?? "지정 안 함"}</span>
          )}
        </td>
        <td className="py-3 pr-3 whitespace-nowrap">
          <ClaimValue claim={pile.volume} className="font-medium" />
          <span className="mt-0.5 block text-[12px] text-muted tabular-nums">
            {formatNumber(pile.volumeRangeM3[0])}~{formatNumber(pile.volumeRangeM3[1])}
          </span>
        </td>
        <td className="py-3">
          <WeightCell pile={pile} canAct={canAct && !busy} onWeigh={onWeigh} />
        </td>
      </tr>
      {weighing ? (
        <tr className="border-b border-line">
          <td colSpan={4} className="pb-3">
            <WeighForm pile={pile} busy={busy} onSave={onWeighSave} onCancel={onWeighCancel} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * "보관장 3D 스캔" 절. 등록한 폐기물이 있을 때 자료 화면 아래에 붙는다.
 */
export function StorageScan({ streams }: { streams: StreamRecord[] }) {
  const { org, mode, canWrite, readOnly } = useV3();
  const remote = useRemote<ScanList>(`scans:${org.id}`, mode === "live", () => api.listScans(org.id));
  const [local, setLocal] = useState<Local>({ phase: "idle" });
  const [overrides, setOverrides] = useState<Record<string, ScanView>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const list = remote.data;
  const reload = remote.reload;

  const scans = (list?.scans ?? []).map((scan) => overrides[scan.id] ?? scan);
  const extra = Object.values(overrides).filter((view) => !scans.some((scan) => scan.id === view.id));
  const all = [...extra, ...scans];
  const latest = currentScan(list ? { canScan: list.canScan, scans: all } : null);
  const shown = (selected ? all.find((scan) => scan.id === selected) : null) ?? latest;
  const processingId = shown?.status === "processing" ? shown.id : null;

  // 진행 중이면 2초마다 다시 읽는다. 끝나면 목록도 다시 읽는다
  useEffect(() => {
    if (!processingId) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      api
        .getScan(org.id, processingId)
        .then((view) => {
          if (!alive) return;
          setOverrides((before) => ({ ...before, [view.id]: view }));
          if (view.status !== "processing") reload();
        })
        .catch(() => {
          // 잠깐 닿지 않으면 다음 차례에 다시 읽는다
          if (alive) setOverrides((before) => ({ ...before }));
        });
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [processingId, org.id, overrides, reload]);

  if (remote.loading || remote.error || !list) return null;
  if (!showScanSection({ canScan: list.canScan, scans: all }) && local.phase === "idle") return null;

  const canAct = canWrite && !readOnly;
  const canUpload = canAct && list.canScan;
  const busy = local.phase === "preparing" || local.phase === "sending";

  const start = async (kind: "video" | "photos", files: File[]) => {
    setLocal({ phase: "preparing", done: 0, total: 0 });
    try {
      const frames = await import("@/lib/v3/scan-frames");
      const progress = (done: number, total: number) => setLocal({ phase: "preparing", done, total });
      const set = kind === "video" ? await frames.framesFromVideo(files[0], progress) : await frames.framesFromPhotos(files, progress);
      setLocal({ phase: "sending" });
      const view = await api.uploadScan(org.id, set.frames, set.source, set.durationSec);
      setOverrides((before) => ({ ...before, [view.id]: view }));
      setSelected(view.id);
      setLocal({ phase: "idle" });
      reload();
    } catch (error) {
      setLocal({
        phase: "error",
        message: friendly(error, "이 영상에서 장면을 고르지 못했습니다. 휴대폰에서 바로 찍어 올리거나 MP4 영상으로 다시 올려 주세요."),
      });
    }
  };
  /** 고른 파일에 영상이 있으면 첫 영상을, 없으면 사진 여러 장으로 본다 */
  const send = (files: File[]) => {
    const video = files.find((file) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name));
    void (video ? start("video", [video]) : start("photos", files));
  };
  const update = (view: ScanView) => setOverrides((before) => ({ ...before, [view.id]: view }));
  const earlier = all.filter((scan) => scan.id !== shown?.id);

  return (
    <section aria-labelledby="storage-scan-title" className="mt-12 border-t border-line pt-8">
      <h2 id="storage-scan-title" className="text-[20px] font-semibold tracking-[-0.02em]">
        보관장 3D 스캔
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">
        휴대폰으로 폐기물 보관장을 천천히 한 바퀴 찍어 올리면, 더미마다 부피와 무게를 재고 폐기물별로 나눠 둘 자리를 3D로 그립니다.
      </p>

      {canUpload ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {/* 휴대폰(손가락으로 누르는 화면)에서는 뒤 카메라 영상 촬영을 바로 연다 */}
            <span className="hidden pointer-coarse:contents">
              <PickButton
                text="영상 찍기"
                label="보관장 영상 찍기"
                accept="video/*"
                capture="environment"
                disabled={busy}
                onFiles={send}
              />
            </span>
            <PickButton
              text="보관장 영상 올리기"
              label="보관장 영상 하나 또는 사진 12~80장 올리기"
              accept="video/*,image/*"
              multiple
              disabled={busy}
              onFiles={send}
            />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            30초~1분, 더미 둘레를 천천히 한 바퀴 돌며 바닥이 함께 보이게 찍어 주세요. 소리와 영상 원본은 보내지 않습니다.
          </p>
        </div>
      ) : readOnly ? (
        <p className="mt-3 text-[13px] text-muted">체험하기에서는 보기만 할 수 있습니다.</p>
      ) : null}

      {local.phase === "preparing" || local.phase === "sending" ? (
        <Steps
          current="frames"
          frames={local.phase === "preparing" && local.total > 0 ? `${local.done}/${local.total}장` : local.phase === "sending" ? "보내는 중" : null}
        />
      ) : null}
      {local.phase === "error" ? (
        <p role="alert" className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
          {local.message}
        </p>
      ) : null}

      {shown && local.phase !== "preparing" && local.phase !== "sending" ? (
        shown.status === "processing" ? (
          <div className="mt-4">
            <Steps current={stepOf(shown.progress?.stage)} frames={`${shown.frameCount}장`} />
            <p className="mt-3 text-[13px] text-muted">보통 1~2분 걸립니다. 이 화면을 떠나도 분석은 이어집니다.</p>
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
                  disabled={busy}
                  onFiles={send}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <ScanResult view={shown} streams={streams} canAct={canAct} onUpdated={update} />
        )
      ) : null}

      {earlier.length > 0 ? (
        <MoreDetails className="mt-4" label={`이전 스캔 ${earlier.length}건`}>
          <ul className="divide-y divide-line text-[13.5px]">
            {earlier.map((scan) => (
              <li key={scan.id} className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-ink-2">
                  {scanTime(scan.createdAt)} ·{" "}
                  {scan.status === "done"
                    ? `더미 ${scan.summary?.pileCount ?? 0}개`
                    : scan.status === "processing"
                      ? "분석 중"
                      : "분석하지 못함"}
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
