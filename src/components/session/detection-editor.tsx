"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import type { WasteItem } from "@/lib/domain";
import { saveDetections } from "@/lib/server/session-actions";
import type { Box, Detection, Media } from "@/lib/session/types";
import { buttonClass } from "../ui/button";
import { MediaView } from "./session-photo";

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; box: Box }
  | { kind: "resize"; id: string; corner: "nw" | "ne" | "sw" | "se"; startX: number; startY: number; box: Box }
  | { kind: "draw"; startX: number; startY: number; current: Box };

const MIN = 0.02;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function normalize(b: Box): Box {
  const [x, y, w, h] = b;
  const nx = clamp(Math.min(x, x + w));
  const ny = clamp(Math.min(y, y + h));
  return [nx, ny, Math.min(Math.abs(w), 1 - nx), Math.min(Math.abs(h), 1 - ny)];
}

/** AI 값이 처음 바뀔 때 원래 값을 남기고 출처를 사람으로 바꾼다 */
function touch(d: Detection, patch: Partial<Detection>): Detection {
  const original = d.original ?? (d.source === "ai" ? { label: d.label, box: d.box, ratio: d.ratio } : undefined);
  return { ...d, ...patch, source: "human", original };
}

/**
 * 식별 결과 수정 편집기. AI 박스는 형광펜, 사람이 고친 박스는 먹색, AI 원래 위치는 점선으로 남긴다.
 * 저장하면 수정 기록·라벨 검수 작업이 생기고, 이유를 적으면 현장 지식 카드로도 남는다.
 */
export function DetectionEditor({
  sessionId,
  streamId,
  media,
  item,
  initial,
}: {
  sessionId: string;
  streamId: string;
  media: Media | undefined;
  item: WasteItem;
  initial: Detection[];
}) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dets, setDets] = useState<Detection[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const dirty = JSON.stringify(dets) !== JSON.stringify(initial);
  const changedCount = dets.filter((d, i) => JSON.stringify(d) !== JSON.stringify(initial[i])).length + Math.max(0, dets.length - initial.length);

  function point(e: { clientX: number; clientY: number }) {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }

  function update(id: string, patch: Partial<Detection>) {
    setDets((prev) => prev.map((d) => (d.id === id ? touch(d, patch) : d)));
  }

  function onFramePointerDown(e: ReactPointerEvent) {
    if (mode !== "draw") {
      setSelected(null);
      return;
    }
    const p = point(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ kind: "draw", startX: p.x, startY: p.y, current: [p.x, p.y, 0, 0] });
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag) return;
    const p = point(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (drag.kind === "draw") {
      setDrag({ ...drag, current: [drag.startX, drag.startY, dx, dy] });
      return;
    }
    const [x, y, w, h] = drag.box;
    if (drag.kind === "move") {
      setDets((prev) => prev.map((d) => (d.id === drag.id ? { ...d, box: [clamp(x + dx, 0, 1 - w), clamp(y + dy, 0, 1 - h), w, h] } : d)));
      return;
    }
    let nb: Box = [x, y, w, h];
    if (drag.corner === "se") nb = [x, y, w + dx, h + dy];
    if (drag.corner === "nw") nb = [x + dx, y + dy, w - dx, h - dy];
    if (drag.corner === "ne") nb = [x, y + dy, w + dx, h - dy];
    if (drag.corner === "sw") nb = [x + dx, y, w - dx, h + dy];
    const n = normalize(nb);
    if (n[2] < MIN || n[3] < MIN) return;
    setDets((prev) => prev.map((d) => (d.id === drag.id ? { ...d, box: n } : d)));
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.kind === "draw") {
      const b = normalize(drag.current);
      if (b[2] >= MIN && b[3] >= MIN) {
        const id = `det_h${Date.now().toString(36)}`;
        setDets((prev) => [...prev, { id, label: "이물질", kind: "contaminant", confidence: 1, box: b, ratio: 0.02, source: "human" }]);
        setSelected(id);
      }
      setMode("select");
    } else {
      // 이동·크기 변경이 끝났을 때 원래 값과 출처를 기록한다
      const before = initial.find((d) => d.id === drag.id) ?? dets.find((d) => d.id === drag.id);
      setDets((prev) =>
        prev.map((d) => {
          if (d.id !== drag.id) return d;
          const moved = d.box.some((n, i) => Math.abs(n - drag.box[i]) > 0.002);
          if (!moved) return d;
          const original = d.original ?? (before && before.source === "ai" ? { label: before.label, box: before.box, ratio: before.ratio } : undefined);
          return { ...d, source: "human", original };
        }),
      );
    }
    setDrag(null);
  }

  /** 박스·모서리 손잡이 공용 핸들러. 대상은 data-id, data-corner로 받는다. */
  function onBoxPointerDown(e: ReactPointerEvent<HTMLElement>) {
    const id = e.currentTarget.dataset.id;
    const corner = e.currentTarget.dataset.corner as "nw" | "ne" | "sw" | "se" | undefined;
    const d = dets.find((x) => x.id === id);
    if (!d) return;
    e.stopPropagation();
    if (mode === "draw") return;
    setSelected(d.id);
    const p = point(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag(corner ? { kind: "resize", id: d.id, corner, startX: p.x, startY: p.y, box: d.box } : { kind: "move", id: d.id, startX: p.x, startY: p.y, box: d.box });
  }

  function onKey(e: React.KeyboardEvent, d: Detection) {
    const step = e.shiftKey ? 0.02 : 0.005;
    const [x, y, w, h] = d.box;
    const moves: Record<string, Box> = {
      ArrowLeft: [clamp(x - step, 0, 1 - w), y, w, h],
      ArrowRight: [clamp(x + step, 0, 1 - w), y, w, h],
      ArrowUp: [x, clamp(y - step, 0, 1 - h), w, h],
      ArrowDown: [x, clamp(y + step, 0, 1 - h), w, h],
    };
    if (moves[e.key]) {
      e.preventDefault();
      update(d.id, { box: moves[e.key] });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      update(d.id, { removed: true });
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  }

  function save(formData?: FormData) {
    const rationale = String(formData?.get("rationale") ?? "").trim() || undefined;
    const condition = String(formData?.get("condition") ?? "").trim() || undefined;
    const judgment = String(formData?.get("judgment") ?? "").trim() || undefined;
    const makeCard = formData?.get("makeCard") === "on";
    startTransition(async () => {
      const res = await saveDetections(sessionId, streamId, { detections: dets, rationale, condition, judgment, makeCard });
      dialogRef.current?.close();
      setMessage(`수정 ${res.saved}건을 저장했습니다.${res.cardId ? " 현장 지식 카드도 남겼습니다." : ""} 검수를 거쳐 다음 학습에 쓰입니다.`);
      router.refresh();
    });
  }

  const sel = dets.find((d) => d.id === selected) ?? null;
  const drawBox = drag?.kind === "draw" ? normalize(drag.current) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md bg-sunken p-[3px]" role="group" aria-label="편집 도구">
            {(["select", "draw"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className="h-8 rounded-sm px-3 text-[13px] text-muted aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-ink aria-pressed:shadow-[0_1px_0_var(--color-line-strong)]"
              >
                {m === "select" ? "선택·이동" : "박스 추가"}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-3 rounded-[2px] border-2 border-marker" aria-hidden="true" />
              AI 판정
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-3 rounded-[2px] border-2 border-ink" aria-hidden="true" />
              사람 수정
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-3 rounded-[2px] border border-dashed border-marker" aria-hidden="true" />
              AI 원래 위치
            </span>
          </p>
        </div>

        <div
          ref={frameRef}
          onPointerDown={onFramePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative aspect-[4/3] touch-none overflow-hidden rounded-lg bg-photo select-none ${mode === "draw" ? "cursor-crosshair" : ""}`}
        >
          {media ? <MediaView media={media} label="식별 결과를 고칠 폐기물 사진" /> : null}

          {dets.map((d) =>
            d.original && !d.removed ? (
              <div
                key={`${d.id}-orig`}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-[2px] border border-dashed border-marker/80"
                style={{ left: pct(d.original.box[0]), top: pct(d.original.box[1]), width: pct(d.original.box[2]), height: pct(d.original.box[3]) }}
              />
            ) : null,
          )}

          {dets
            .filter((d) => !d.removed)
            .map((d) => {
              const human = d.source === "human";
              const isSel = d.id === selected;
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${d.label} 박스${human ? " (사람 수정)" : " (AI)"}. 방향키로 이동, Delete로 삭제`}
                  aria-pressed={isSel}
                  data-id={d.id}
                  onPointerDown={onBoxPointerDown}
                  onFocus={() => setSelected(d.id)}
                  onKeyDown={(e) => onKey(e, d)}
                  className={`absolute rounded-[2px] focus-visible:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${mode === "draw" ? "pointer-events-none" : "cursor-move"} ${
                    human ? "border-2 border-ink bg-ink/10" : d.kind === "contaminant" ? "border-2 border-marker bg-marker/15" : "border-[1.5px] border-marker"
                  } ${isSel ? "z-10 shadow-[0_0_0_1px_var(--color-surface)]" : ""}`}
                  style={{ left: pct(d.box[0]), top: pct(d.box[1]), width: pct(d.box[2]), height: pct(d.box[3]) }}
                >
                  <span
                    className={`num pointer-events-none absolute -top-[22px] -left-[2px] rounded-[2px] rounded-bl-none px-1.5 text-[12px] leading-5 font-semibold whitespace-nowrap ${human ? "bg-ink text-on-ink" : "bg-marker text-marker-ink"}`}
                  >
                    {d.label}
                    {d.kind === "item" ? ` ${d.confidence.toFixed(2)}` : d.ratio !== undefined ? ` ${Math.round(d.ratio * 100)}%` : ""}
                  </span>
                  {isSel && mode === "select"
                    ? (["nw", "ne", "sw", "se"] as const).map((c) => (
                        <span
                          key={c}
                          aria-hidden="true"
                          data-id={d.id}
                          data-corner={c}
                          onPointerDown={onBoxPointerDown}
                          className={`absolute size-3 rounded-[2px] border-2 border-surface bg-ink ${c.includes("n") ? "-top-1.5" : "-bottom-1.5"} ${c.includes("w") ? "-left-1.5" : "-right-1.5"} ${c === "nw" || c === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                        />
                      ))
                    : null}
                </div>
              );
            })}

          {drawBox ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[2px] border-2 border-ink bg-ink/10"
              style={{ left: pct(drawBox[0]), top: pct(drawBox[1]), width: pct(drawBox[2]), height: pct(drawBox[3]) }}
            />
          ) : null}
          <span className="pointer-events-none absolute bottom-2.5 left-3 text-[12px] text-white/60">{media?.name}</span>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          박스를 끌어 옮기고 모서리로 크기를 바꿉니다. 키보드: 방향키 이동(Shift는 크게), Delete 삭제, Esc 선택 해제.
        </p>
      </div>

      <div className="grid content-start gap-5">
        <section aria-labelledby="det-list">
          <h2 id="det-list" className="mb-2 text-label text-muted">
            탐지 결과
          </h2>
          <ul className="border-t border-line">
            {dets.map((d) => (
              <li key={d.id} className={`border-b border-line ${d.removed ? "opacity-60" : ""}`}>
                <div className={`flex items-center gap-3 py-2.5 ${d.id === selected ? "shadow-[inset_3px_0_0_var(--color-ink)] pl-3" : ""}`}>
                  <i
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-[2px] border-2 ${d.source === "human" ? "border-ink" : "border-marker"}`}
                  />
                  <button type="button" onClick={() => setSelected(d.id)} className={`min-w-0 flex-1 text-left text-sm ${d.removed ? "line-through" : ""}`}>
                    <span className="font-semibold">{d.label}</span>
                    <span className="ml-2 text-[12px] text-muted">{d.kind === "item" ? "품목" : "이물질"} · {d.source === "human" ? "사람 수정" : "AI"}</span>
                    {d.original && d.original.label !== d.label ? <span className="ml-2 text-[12px] text-muted line-through">{d.original.label}</span> : null}
                  </button>
                  {d.kind === "contaminant" ? (
                    <span className="flex items-center gap-1 text-sm">
                      {d.original?.ratio !== undefined && d.original.ratio !== d.ratio ? (
                        <span className="num text-[12px] text-muted line-through">{Math.round(d.original.ratio * 100)}%</span>
                      ) : null}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`${d.label} 비율(%)`}
                        value={Math.round((d.ratio ?? 0) * 100)}
                        disabled={d.removed}
                        onChange={(e) => update(d.id, { ratio: clamp(Number(e.target.value) / 100) })}
                        className="num h-8 w-14 rounded-sm border border-line-strong bg-surface px-1.5 text-right text-[13px] focus:border-ink focus:outline-none"
                      />
                      <span className="text-[12px] text-muted">%</span>
                    </span>
                  ) : (
                    <span className="num text-[13px] text-muted">{d.confidence.toFixed(2)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => update(d.id, { removed: !d.removed })}
                    className="h-8 rounded-sm px-2 text-[12px] text-muted hover:bg-sunken hover:text-ink"
                  >
                    {d.removed ? "되돌리기" : "삭제"}
                  </button>
                </div>
                {d.id === selected && !d.removed ? (
                  <label className="flex items-center gap-2 pb-3 pl-3 text-[13px]">
                    <span className="text-muted">라벨</span>
                    <input
                      value={d.label}
                      maxLength={40}
                      onChange={(e) => update(d.id, { label: e.target.value })}
                      className="h-8 flex-1 rounded-sm border border-line-strong bg-surface px-2 focus:border-ink focus:outline-none"
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-ink)]">
            <p className="text-sm">
              수정 <b className="num">{changedCount}</b>건 · 저장하면 검수를 거쳐 학습 데이터로 쓰입니다.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDets(initial)} className={buttonClass("ghost", "sm")}>
                되돌리기
              </button>
              <button type="button" onClick={() => dialogRef.current?.showModal()} className={buttonClass("secondary", "sm")}>
                수정 저장
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="rounded-md bg-gain-bg px-3.5 py-2.5 text-sm">
            {message}
          </p>
        ) : null}
        {sel && sel.original ? (
          <p className="text-[12px] text-muted">
            AI 원래 값: {sel.original.label}
            {sel.original.ratio !== undefined ? ` ${Math.round(sel.original.ratio * 100)}%` : ""} · 위치 {sel.original.box.map((n) => n.toFixed(2)).join(", ")}
          </p>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="why-title"
        className="m-auto w-[min(520px,calc(100%-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)] backdrop:bg-ink/40"
      >
        <form action={save} className="grid gap-4 p-6">
          <div>
            <p className="text-label text-muted">수정 저장</p>
            <h2 id="why-title" className="mt-1 text-h2">
              왜 이렇게 고치셨나요?
            </h2>
            <p className="mt-1 text-sm text-muted">
              선택 사항입니다. 이유를 남기면 검수자가 판단하기 쉽고, 같은 상황에서 AI가 다음부터 참고할 수 있습니다.
            </p>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">이유</span>
            <textarea
              name="rationale"
              rows={2}
              maxLength={400}
              placeholder="예: 광택 나는 띠는 투명 테이프다. 현장에서 직접 확인했다."
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-ink focus:outline-none"
            />
          </label>
          <details className="rounded-md bg-sunken px-3.5 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">현장 지식 카드로도 남기기</summary>
            <div className="mt-3 grid gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="makeCard" className="size-[18px] accent-ink" />
                {item} 판정 기준으로 남깁니다
              </label>
              <input name="condition" maxLength={120} placeholder="어떤 경우에 (예: 베일 표면에 광택 나는 띠)" className="h-10 rounded-md border border-line-strong bg-surface px-3 focus:border-ink focus:outline-none" />
              <input name="judgment" maxLength={120} placeholder="어떻게 판단하나 (예: 투명 테이프로 본다)" className="h-10 rounded-md border border-line-strong bg-surface px-3 focus:border-ink focus:outline-none" />
            </div>
          </details>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("ghost")}>
              취소
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
