"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { useV3 } from "@/components/v3/context";
import { useRemote } from "@/components/v3/use-remote";
import { api } from "@/lib/v3/api";
import { formatNumber } from "@/lib/v3/format";
import type { StreamRecord } from "@/lib/v3/types";

const MATERIALS = ["PP", "PE", "LDPE", "ABS", "PS", "PET", "PP+ABS"];
const FORMS = ["가공 전", "분쇄", "압축", "필름", "펠릿"];
const input =
  "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken";

type Draft = { name: string; material: string; form: string; monthlyKg: string; origin: "PIR" | "PCR" };
const EMPTY: Draft = { name: "", material: "PP", form: "가공 전", monthlyKg: "", origin: "PIR" };

/** 흐름 ID. 서버는 처음 보는 ID를 새 흐름으로 받는다. */
function newStreamId() {
  return `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function StreamForm({ onSave, onCancel, busy }: { onSave: (draft: Draft) => void; onCancel?: () => void; busy: boolean }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((before) => ({ ...before, [key]: value }));
  const kg = Number(draft.monthlyKg);
  const valid = draft.name.trim() !== "" && draft.monthlyKg.trim() !== "" && Number.isFinite(kg) && kg > 0;
  return (
    <form
      className="grid gap-3 p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSave(draft);
      }}
    >
      <label className="text-[13px] font-semibold sm:col-span-2">
        무엇이 나오나요
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="예: 스프루·런너, 불량 사출품, 포장 필름"
          className={`${input} mt-1.5 font-normal`}
        />
      </label>
      <label className="text-[13px] font-semibold">
        재질
        <select value={draft.material} onChange={(event) => set("material", event.target.value)} className={`${input} mt-1.5 font-normal`}>
          {MATERIALS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-[13px] font-semibold">
        형태
        <select value={draft.form} onChange={(event) => set("form", event.target.value)} className={`${input} mt-1.5 font-normal`}>
          {FORMS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-[13px] font-semibold">
        한 달에 얼마나
        <span className="mt-1.5 flex items-center gap-2 font-normal">
          <input
            value={draft.monthlyKg}
            inputMode="decimal"
            onChange={(event) => set("monthlyKg", event.target.value)}
            placeholder="숫자"
            className={`${input} tabular-nums`}
          />
          <span className="shrink-0 text-sm text-ink-2">kg</span>
        </span>
      </label>
      <label className="text-[13px] font-semibold">
        어디서 나온 것
        <select
          value={draft.origin}
          onChange={(event) => set("origin", event.target.value as Draft["origin"])}
          className={`${input} mt-1.5 font-normal`}
        >
          <option value="PIR">공정에서 나온 것</option>
          <option value="PCR">쓰고 버린 포장재</option>
        </select>
      </label>
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-10 rounded-lg px-3 text-sm text-ink-2 hover:bg-sunken">
            취소
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!valid || busy}
          className="min-h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold hover:border-ink disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-muted"
        >
          흐름 등록
        </button>
      </div>
    </form>
  );
}

/**
 * 첫 화면. 등록한 흐름을 보여 주고, 없으면 바로 등록하게 한 뒤 "에이전트로 찾기" 하나만 누르게 한다.
 * 사진·측정값·문서는 자료 화면에서 더 올릴 수 있다.
 */
export function Start({ busy, error, onFind }: { busy: boolean; error: string | null; onFind: () => void }) {
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`streams:${org.id}`, live, () => api.listStreams(org.id));
  const streams: StreamRecord[] = live ? (remote.data ?? []) : (fixture?.streams.filter((item) => item.orgId === org.id) ?? []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showForm = adding || (live && !remote.loading && streams.length === 0);
  const canFind = live && streams.length > 0 && !busy && !saving;

  async function save(draft: Draft) {
    setSaving(true);
    setSaveError(null);
    try {
      await api.putStream(org.id, {
        id: newStreamId(),
        orgId: org.id,
        name: draft.name.trim(),
        material: draft.material,
        form: draft.form,
        origin: draft.origin,
        wasteItem: draft.origin === "PCR" ? "포장재" : "폐플라스틱",
        monthlyKg: Number(draft.monthlyKg),
      });
      setAdding(false);
      remote.reload();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "흐름을 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[720px]">
        <h1 className="rise text-center text-[30px] leading-[1.25] font-bold tracking-[-0.03em] text-balance sm:text-[36px]">
          어떤 폐플라스틱을 내보내시나요?
        </h1>
        <p className="rise mt-3 text-center text-ink-2 [animation-delay:60ms]">
          흐름을 등록하면 에이전트가 받아 줄 업체를 찾아 조건을 맞춰 옵니다.
        </p>

        <div className="rise mt-8 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_18px_50px_-28px_rgb(15_21_18/0.35)] [animation-delay:120ms]">
          {remote.loading ? (
            <p className="px-5 py-6 text-sm text-muted">등록한 흐름을 불러오는 중입니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {streams.map((stream) => (
                <li key={stream.id} className="flex items-baseline gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{stream.name}</span>
                    <span className="ml-2 text-sm text-muted">
                      {[stream.material, stream.form].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink-2">
                    {stream.monthlyKg === null ? "물량 확인 필요" : `월 ${formatNumber(stream.monthlyKg)} kg`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {showForm && live ? (
            <div className={streams.length > 0 ? "border-t border-line bg-ground" : "bg-ground"}>
              <StreamForm busy={saving} onSave={save} onCancel={streams.length > 0 ? () => setAdding(false) : undefined} />
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t border-line px-3 py-3">
            {live && !showForm ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <PlusIcon />
                흐름 추가
              </button>
            ) : null}
            <Link
              href="/app/materials"
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
            >
              사진·측정값 올리기
            </Link>
            <button
              type="button"
              disabled={!canFind}
              onClick={onFind}
              className="ml-auto flex min-h-11 items-center gap-2 rounded-full bg-brand pr-2 pl-5 text-[15px] font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted"
            >
              {busy ? "찾는 중" : "에이전트로 찾기"}
              <span className="grid size-7 place-items-center rounded-full bg-on-brand/15">
                <ArrowUpIcon />
              </span>
            </button>
          </div>
        </div>

        {saveError || error || remote.error ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-loss-bg px-4 py-3 text-sm text-loss">
            <CloseIcon className="mt-0.5" />
            {saveError ?? error ?? remote.error}
          </p>
        ) : null}
        {!live && mode !== "loading" ? (
          <p className="mt-4 text-center text-sm text-muted">예시 데이터에서는 찾기를 시작할 수 없습니다.</p>
        ) : null}
        {org.synthetic ? (
          <p className="mt-6 text-center text-[13px] text-muted">
            {org.name}은 시연용 가상 회사입니다. 업체·단가·물량도 모두 가상입니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
