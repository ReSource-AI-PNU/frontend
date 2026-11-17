"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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

/** 폐기물(흐름) ID. 서버는 처음 보는 ID를 새 흐름으로 받는다. */
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
      className="grid gap-x-3 gap-y-4 py-5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSave(draft);
      }}
    >
      <label className="text-[13px] font-medium text-ink-2 sm:col-span-2">
        무엇이 나오나요
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="예: 스프루·런너, 불량 사출품, 포장 필름"
          className={`${input} mt-1.5 text-ink`}
        />
      </label>
      <label className="text-[13px] font-medium text-ink-2">
        재질
        <select value={draft.material} onChange={(event) => set("material", event.target.value)} className={`${input} mt-1.5 text-ink`}>
          {MATERIALS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-[13px] font-medium text-ink-2">
        형태
        <select value={draft.form} onChange={(event) => set("form", event.target.value)} className={`${input} mt-1.5 text-ink`}>
          {FORMS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-[13px] font-medium text-ink-2">
        한 달에 얼마나
        <span className="mt-1.5 flex items-center gap-2 text-ink">
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
      <label className="text-[13px] font-medium text-ink-2">
        어디서 나온 것
        <select
          value={draft.origin}
          onChange={(event) => set("origin", event.target.value as Draft["origin"])}
          className={`${input} mt-1.5 text-ink`}
        >
          <option value="PIR">공정에서 나온 것</option>
          <option value="PCR">쓰고 버린 포장재</option>
        </select>
      </label>
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
        ) : null}
        <Button type="submit" variant="secondary" disabled={!valid || busy}>
          {busy ? "추가하는 중" : "추가"}
        </Button>
      </div>
    </form>
  );
}

/**
 * 첫 화면. 등록한 폐기물을 보여 주고, 없으면 바로 추가하게 한 뒤 "받아 줄 곳 찾기" 하나만 누르게 한다.
 * 사진·측정값·문서는 자료 화면에서 더 올릴 수 있다.
 */
export function Start({
  busy,
  error,
  onFind,
  onResume,
}: {
  busy: boolean;
  error: string | null;
  onFind: () => void;
  /** 서버에 남아 있는 지난 찾기를 다시 연다 */
  onResume?: () => void;
}) {
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`streams:${org.id}`, live, () => api.listStreams(org.id));
  const streams: StreamRecord[] = live ? (remote.data ?? []) : (fixture?.streams.filter((item) => item.orgId === org.id) ?? []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const empty = live && !remote.loading && streams.length === 0;
  const showForm = adding || empty;
  const canFind = live && streams.length > 0 && !busy && !saving;
  const totalKg = streams.reduce((sum, item) => sum + (item.monthlyKg ?? 0), 0);

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
      setSaveError(cause instanceof Error ? cause.message : "폐기물을 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-14">
      <div className="mx-auto w-full max-w-[640px]">
        <h1 className="text-[28px] leading-[1.3] font-semibold tracking-[-0.03em] text-balance sm:text-[32px]">
          {empty ? "어떤 폐플라스틱이 나오나요?" : "받아 줄 곳을 찾아볼까요?"}
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {empty
            ? "공장에서 나오는 것을 한 가지씩 적어 주세요. 이름과 한 달 양만 알아도 됩니다."
            : "아래 폐기물을 받을 수 있는 업체에 AI가 대신 조건을 물어봅니다."}
        </p>

        {remote.loading ? (
          <p className="mt-8 text-sm text-muted">등록한 폐기물을 불러오는 중입니다.</p>
        ) : streams.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-baseline justify-between border-b border-line pb-2 text-[13px] text-muted">
              <span>내보내는 폐기물 {streams.length}가지</span>
              {totalKg > 0 ? <span className="tabular-nums">한 달 {formatNumber(totalKg)} kg</span> : null}
            </div>
            <ul className="divide-y divide-line">
              {streams.map((stream) => (
                <li key={stream.id} className="flex items-baseline gap-3 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{stream.name}</span>
                    <span className="ml-2 text-[13px] text-muted">{[stream.material, stream.form].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-ink-2">
                    {stream.monthlyKg === null ? "양 확인 필요" : `${formatNumber(stream.monthlyKg)} kg`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showForm && live ? (
          <div className={streams.length > 0 ? "border-t border-line" : "mt-6"}>
            <StreamForm busy={saving} onSave={save} onCancel={streams.length > 0 ? () => setAdding(false) : undefined} />
          </div>
        ) : null}

        {streams.length > 0 && !showForm ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-1 border-t border-line pt-3">
            {live ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="-ml-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <PlusIcon />
                폐기물 추가
              </button>
            ) : null}
            <Link href="/app/materials" className="flex min-h-10 items-center rounded-lg px-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
              사진·측정값 올리기
            </Link>
          </div>
        ) : null}

        {streams.length > 0 ? (
          <div className="mt-8">
            <Button disabled={!canFind} onClick={onFind} className="!min-h-12 w-full !text-[16px] sm:w-auto sm:!px-7">
              {busy ? "업체에 물어보는 중" : "받아 줄 곳 찾기"}
            </Button>
            {onResume ? (
              <button
                type="button"
                onClick={onResume}
                className="mt-3 block text-sm text-ink-2 underline underline-offset-4 hover:text-ink sm:mt-0 sm:ml-5 sm:inline"
              >
                지난번에 찾은 결과 보기
              </button>
            ) : null}
          </div>
        ) : null}

        {saveError || error || remote.error ? (
          <p role="alert" className="mt-4 text-sm text-loss">
            {saveError ?? error ?? remote.error}
          </p>
        ) : null}
        {!live && mode !== "loading" ? <p className="mt-4 text-sm text-muted">예시 데이터에서는 찾기를 시작할 수 없습니다.</p> : null}
        {org.synthetic ? (
          <p className="mt-10 text-[13px] text-muted">{org.name}은 시연용 가상 회사입니다. 업체·단가·물량도 모두 가상입니다.</p>
        ) : null}
      </div>
    </div>
  );
}
