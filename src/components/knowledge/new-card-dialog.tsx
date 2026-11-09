"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { WASTE_ITEMS, type WasteItem } from "@/lib/domain";
import { createKnowledgeCard } from "@/lib/server/session-actions";
import { FLOW_STEPS } from "@/lib/session/types";
import { buttonClass } from "../ui/button";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none";

/** 현장 지식 카드 새로 쓰기. 판정 흐름 밖에서도 기준을 남길 수 있다. 남긴 카드는 "제안됨"으로 시작한다. */
export function NewCardDialog({ defaultItem }: { defaultItem?: WasteItem }) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createKnowledgeCard, undefined);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      const t = setTimeout(() => ref.current?.close(), 1400);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={buttonClass("primary")}>
        새 카드 작성
      </button>
      <dialog
        ref={ref}
        aria-labelledby="new-card-title"
        className="m-auto w-[min(560px,calc(100%-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)] backdrop:bg-ink/40"
      >
        <form
          ref={formRef}
          // 오류가 나도 적은 내용이 지워지지 않게 직접 제출한다 (React 19는 form action 뒤 입력을 초기화한다)
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => action(data));
          }}
          className="grid gap-4 p-6"
        >
          <div>
            <p className="text-label text-muted">현장 지식 카드</p>
            <h2 id="new-card-title" className="mt-1 text-h2">
              현장에서 쓰는 판단 기준을 남겨 주세요
            </h2>
            <p className="mt-1 text-sm text-muted">
              조건 → 판단 → 근거 순서로 적습니다. 다른 담당자의 동의와 관리자 검토를 거쳐 채택되면 다음 판정에서 근거로 인용됩니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">품목</span>
              <select name="item" defaultValue={defaultItem ?? WASTE_ITEMS[0]} className={inputClass}>
                {WASTE_ITEMS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">적용할 판정 단계</span>
              <select name="step" defaultValue="feasibility" className={inputClass}>
                {FLOW_STEPS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.agent} · {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">조건: 어떤 경우에</span>
            <input name="condition" required minLength={4} maxLength={120} placeholder="예: 비 온 다음 날 야외에 둔 PP 베일" className={inputClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">판단: 어떻게 보나요</span>
            <input name="judgment" required minLength={4} maxLength={120} placeholder="예: 수분 5% 초과로 보고 한 등급 낮춘다" className={inputClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">근거</span>
            <textarea name="rationale" required minLength={4} maxLength={400} rows={3} placeholder="경험, 업체 정산 기록, 반송 사례 등" className={inputClass} />
          </label>
          {state && "error" in state ? (
            <p role="alert" className="text-sm text-loss">
              {state.error}
            </p>
          ) : null}
          {state && "ok" in state ? (
            <p role="status" className="rounded-md bg-gain-bg px-3 py-2 text-sm">
              카드를 남겼습니다. 목록 맨 앞에 &ldquo;제안됨&rdquo; 상태로 보입니다.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("ghost")}>
              닫기
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "남기는 중…" : "카드로 남기기"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
