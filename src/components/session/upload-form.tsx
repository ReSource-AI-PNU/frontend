"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startSession } from "@/lib/server/session-actions";
import { formatNumber } from "@/lib/format";
import { UploadIcon } from "../icons";
import { buttonClass } from "../ui/button";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,application/pdf";
const MAX_STREAMS = 8;
const MAX_FILES_PER_STREAM = 6;
const MAX_TOTAL = 55 * 1024 * 1024;

/** 흐름 이름 자동 완성. 이름으로 식별 모델의 초기 프로필을 고른다(실제로는 사진으로 판정) */
const SUGGESTIONS = ["스프루·러너", "불량 성형품", "퍼지·색 혼합", "원자재 포장 필름", "PP 마대·톤백", "금속 칩", "목재 팔레트"];

type Picked = { file: File; url: string | null; id: string };
type Row = { key: string; name: string; files: Picked[] };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={buttonClass("primary")}>
      {pending ? "올리는 중…" : "진단 시작"}
    </button>
  );
}

function SampleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary")}>
      {pending ? "준비 중…" : "샘플 공장으로 체험"}
    </button>
  );
}

function kindOf(file: File) {
  if (file.type.startsWith("video")) return "영상";
  if (file.type === "application/pdf") return "PDF";
  return "사진";
}

function StreamRow({
  index,
  row,
  onChange,
  onRemove,
  canRemove,
  onError,
  listId,
}: {
  index: number;
  row: Row;
  onChange: (row: Row) => void;
  onRemove: () => void;
  canRemove: boolean;
  onError: (msg: string | null) => void;
  listId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function sync(files: Picked[]) {
    onChange({ ...row, files });
    const dt = new DataTransfer();
    files.forEach((p) => dt.items.add(p.file));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function add(list: FileList | File[]) {
    const all = Array.from(list);
    const ok = all.filter((f) => ACCEPT.split(",").includes(f.type));
    const next = [
      ...row.files,
      ...ok.map((file) => ({ file, url: file.type.startsWith("image") ? URL.createObjectURL(file) : null, id: `${file.name}-${file.size}-${file.lastModified}` })),
    ]
      .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
      .slice(0, MAX_FILES_PER_STREAM);
    onError(ok.length < all.length ? "JPG·PNG·WEBP·HEIC 사진, MP4·MOV 영상, PDF만 올릴 수 있습니다." : null);
    sync(next);
  }

  return (
    <li className="grid gap-3 border-b border-line py-5 first:pt-0 last:border-b-0">
      <div className="flex items-end gap-3">
        <span className="num pb-2.5 text-[13px] text-muted">{String(index + 1).padStart(2, "0")}</span>
        <label className="grid flex-1 gap-1.5">
          <span className="text-sm font-semibold">흐름 이름</span>
          <input
            name={`stream-${index}-name`}
            list={listId}
            value={row.name}
            maxLength={30}
            onChange={(e) => onChange({ ...row, name: e.target.value })}
            placeholder="예: 스프루·러너, 원자재 포장 필름"
            className="h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-muted focus:border-ink focus:outline-none"
          />
        </label>
        {canRemove ? (
          <button type="button" onClick={onRemove} className={buttonClass("ghost", "sm", "mb-1")}>
            흐름 빼기
          </button>
        ) : null}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        data-dragging={dragging || undefined}
        className="flex min-h-28 cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed border-line-strong bg-surface px-5 py-4 transition-colors hover:border-ink data-[dragging]:border-ink data-[dragging]:bg-sunken has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
      >
        <input ref={inputRef} type="file" name={`stream-${index}-files`} multiple accept={ACCEPT} onChange={(e) => e.target.files && add(e.target.files)} className="sr-only" />
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink-2 [&_svg]:size-5">
          <UploadIcon />
        </span>
        <span className="text-sm">
          <span className="block font-semibold">이 흐름의 사진·영상을 끌어다 놓거나 눌러서 고르기</span>
          <span className="text-[13px] text-muted">
            더미 전체 한 장 + 이물이 보이게 가까이 한 장 · 최대 <span className="num">{MAX_FILES_PER_STREAM}</span>개
          </span>
        </span>
      </label>

      {row.files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={`${row.name || "흐름"} 파일`}>
          {row.files.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-md border border-line bg-surface">
              <div className="relative aspect-square bg-photo">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL)
                  <img src={p.url} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-[12px] text-white/70">{kindOf(p.file)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (p.url) URL.revokeObjectURL(p.url);
                  sync(row.files.filter((q) => q.id !== p.id));
                }}
                aria-label={`${p.file.name} 빼기`}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-surface/90 text-[12px] shadow-[0_0_0_1px_var(--color-line)]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** 공장 폐플라스틱 흐름 여러 개를 한 번에 올린다. 흐름마다 이름과 사진을 따로 받는다 */
export function UploadForm({ serverError }: { serverError?: string }) {
  const listId = useId();
  const counter = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: "r0", name: "", files: [] }]);
  const [error, setError] = useState<string | null>(serverError ?? null);
  const total = rows.reduce((a, r) => a + r.files.reduce((b, p) => b + p.file.size, 0), 0);
  const ready = rows.filter((r) => r.name.trim() && r.files.length > 0);
  const incomplete = rows.some((r) => (r.name.trim() && r.files.length === 0) || (!r.name.trim() && r.files.length > 0));

  // 미리보기 URL은 화면을 떠날 때 한꺼번에 해제한다
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => () => rowsRef.current.forEach((r) => r.files.forEach((p) => p.url && URL.revokeObjectURL(p.url))), []);

  return (
    <div className="grid gap-6">
      <form
        action={startSession}
        onSubmit={(e) => {
          if (total > MAX_TOTAL) {
            e.preventDefault();
            setError(`한 번에 ${formatNumber(MAX_TOTAL / 1024 / 1024)}MB까지 올릴 수 있습니다. 영상은 30초 이내로 잘라 주세요.`);
          }
        }}
        className="grid gap-4"
      >
        <datalist id={listId}>
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input type="hidden" name="stream-count" value={rows.length} />
        <ol className="rounded-lg border border-line bg-surface px-5 pt-5 pb-1">
          {rows.map((row, i) => (
            <StreamRow
              key={row.key}
              index={i}
              row={row}
              listId={listId}
              canRemove={rows.length > 1}
              onError={setError}
              onChange={(next) => setRows((prev) => prev.map((r) => (r.key === row.key ? next : r)))}
              onRemove={() => {
                row.files.forEach((p) => p.url && URL.revokeObjectURL(p.url));
                setRows((prev) => prev.filter((r) => r.key !== row.key));
              }}
            />
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={rows.length >= MAX_STREAMS}
            onClick={() => setRows((prev) => [...prev, { key: `r${counter.current++}`, name: "", files: [] }])}
            className={buttonClass("secondary", "sm")}
          >
            흐름 추가
          </button>
          <p className="text-sm text-muted">
            {ready.length > 0 ? (
              <>
                흐름 <span className="num">{ready.length}</span>개 · <span className="num">{(total / 1024 / 1024).toFixed(1)}</span>MB
              </>
            ) : (
              "공정마다 따로 모이는 폐플라스틱을 흐름 하나로 올려 주세요."
            )}
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm">
            {error}
          </p>
        ) : incomplete ? (
          <p className="text-sm text-muted">이름과 사진을 모두 넣은 흐름만 진단합니다.</p>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton disabled={ready.length === 0 || incomplete} />
        </div>
      </form>

      <form action={startSession} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-sunken px-4 py-3">
        <input type="hidden" name="sample" value="1" />
        <p className="text-sm">
          지금 찍을 사진이 없으신가요?{" "}
          <span className="text-muted">녹산의 PP 사출 공장 한 곳에서 나오는 폐플라스틱 네 흐름으로 전체 진단을 체험할 수 있습니다.</span>
        </p>
        <SampleButton />
      </form>
    </div>
  );
}
