"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startSession } from "@/lib/server/session-actions";
import { formatNumber } from "@/lib/format";
import { UploadIcon } from "../icons";
import { buttonClass } from "../ui/button";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,application/pdf";
const MAX_FILES = 10;
const MAX_TOTAL = 55 * 1024 * 1024;

type Picked = { file: File; url: string | null; id: string };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={buttonClass("primary")}>
      {pending ? "올리는 중…" : "식별 시작"}
    </button>
  );
}

function SampleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary")}>
      {pending ? "준비 중…" : "샘플 사진으로 체험"}
    </button>
  );
}

function kindOf(file: File) {
  if (file.type.startsWith("video")) return "영상";
  if (file.type === "application/pdf") return "성분표 PDF";
  return "사진";
}

export function UploadForm({ serverError }: { serverError?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(serverError ?? null);
  const total = picked.reduce((s, p) => s + p.file.size, 0);

  // 미리보기 URL은 화면을 떠날 때 한꺼번에, 항목을 뺄 때 개별로 해제한다
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  useEffect(() => () => pickedRef.current.forEach((p) => p.url && URL.revokeObjectURL(p.url)), []);

  function sync(next: Picked[]) {
    setPicked(next);
    const dt = new DataTransfer();
    next.forEach((p) => dt.items.add(p.file));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function add(files: FileList | File[]) {
    const incoming = Array.from(files).filter((f) => ACCEPT.split(",").includes(f.type));
    const rejected = Array.from(files).length - incoming.length;
    const next = [
      ...picked,
      ...incoming.map((file) => ({ file, url: file.type.startsWith("image") ? URL.createObjectURL(file) : null, id: `${file.name}-${file.size}-${file.lastModified}` })),
    ]
      .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
      .slice(0, MAX_FILES);
    const size = next.reduce((s, p) => s + p.file.size, 0);
    if (size > MAX_TOTAL) {
      setError(`한 번에 ${formatNumber(MAX_TOTAL / 1024 / 1024)}MB까지 올릴 수 있습니다. 영상은 30초 이내로 잘라 주세요.`);
      return;
    }
    setError(rejected > 0 ? "JPG·PNG·WEBP·HEIC 사진, MP4·MOV 영상, PDF만 올릴 수 있습니다." : null);
    sync(next);
  }

  return (
    <div className="grid gap-6">
      <form action={startSession} className="grid gap-4">
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
          className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center transition-colors hover:border-ink data-[dragging]:border-ink data-[dragging]:bg-sunken has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
        >
          <input
            ref={inputRef}
            type="file"
            name="files"
            multiple
            accept={ACCEPT}
            onChange={(e) => e.target.files && add(e.target.files)}
            className="sr-only"
          />
          <span className="grid size-12 place-items-center rounded-md bg-sunken text-ink-2 [&_svg]:size-5">
            <UploadIcon />
          </span>
          <span className="font-semibold">사진·영상을 끌어다 놓거나 눌러서 고르기</span>
          <span className="text-[13px] text-muted">
            JPG · PNG · HEIC · MP4(30초 이내) · 성분분석표 PDF는 선택 · 최대 <span className="num">{MAX_FILES}</span>개
          </span>
        </label>

        {picked.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="올릴 파일">
            {picked.map((p) => (
              <li key={p.id} className="group relative overflow-hidden rounded-md border border-line bg-surface">
                <div className="relative aspect-[4/3] bg-photo">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL)
                    <img src={p.url} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[13px] text-white/70">{kindOf(p.file)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[12px]">
                  <span className="truncate" title={p.file.name}>
                    {p.file.name}
                  </span>
                  <span className="num shrink-0 text-muted">{(p.file.size / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (p.url) URL.revokeObjectURL(p.url);
                    sync(picked.filter((q) => q.id !== p.id));
                  }}
                  aria-label={`${p.file.name} 빼기`}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-surface/90 text-sm text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-surface"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {picked.length > 0 ? (
              <>
                <span className="num">{picked.length}</span>개 · <span className="num">{(total / 1024 / 1024).toFixed(1)}</span>MB 선택됨
              </>
            ) : (
              "여러 각도로 찍을수록 판정이 정확해집니다."
            )}
          </p>
          <SubmitButton disabled={picked.length === 0} />
        </div>
      </form>

      <form action={startSession} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-sunken px-4 py-3">
        <input type="hidden" name="sample" value="1" />
        <p className="text-sm">
          지금 찍을 사진이 없으신가요? <span className="text-muted">녹산단지 PP 압축품 더미 사진으로 전체 흐름을 체험할 수 있습니다.</span>
        </p>
        <SampleButton />
      </form>
    </div>
  );
}
