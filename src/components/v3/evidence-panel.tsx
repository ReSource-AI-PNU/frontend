"use client";

import { useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { api } from "@/lib/v3/api";
import { FIXTURE_EVIDENCE } from "@/lib/v3/fixture";
import { formatNumber } from "@/lib/v3/format";
import type { Evidence, EvidenceDetail } from "@/lib/v3/types";
import type { DataMode } from "./context";

type Loaded = { id: string; detail: EvidenceDetail | null; error: string | null };

function fixtureDetail(id: string): EvidenceDetail | null {
  const evidence = FIXTURE_EVIDENCE[id];
  if (!evidence) return null;
  const chain: Evidence[] = [];
  const seen = new Set<string>([id]);
  const walk = (item: Evidence) => {
    const inputs = Array.isArray(item.meta.inputEvidence) ? (item.meta.inputEvidence as string[]) : [];
    for (const next of inputs) {
      const found = FIXTURE_EVIDENCE[next];
      if (!found || seen.has(next)) continue;
      seen.add(next);
      chain.push(found);
      walk(found);
    }
  };
  walk(evidence);
  return { evidence, chain };
}

const KIND_TONE: Record<string, BadgeTone> = {
  assumption: "warn",
  calc: "neutral",
  law: "neutral",
  ref: "neutral",
  doc: "neutral",
  measure: "neutral",
  model: "ai",
  human: "neutral",
};

function valueText(item: Evidence): string | null {
  if (item.value === null || item.value === undefined) return null;
  const value = typeof item.value === "number" ? formatNumber(item.value).replace("-", "−") : item.value;
  return item.unit ? `${value} ${item.unit}` : String(value);
}

function EvidenceCard({ item, compact = false }: { item: Evidence; compact?: boolean }) {
  const value = valueText(item);
  const formula = typeof item.meta.formula === "string" ? item.meta.formula : null;
  return (
    <article className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONE[item.kind] ?? "neutral"}>{item.kindLabel}</Badge>
        <h3 className="text-sm font-semibold">{item.label || item.id}</h3>
      </div>
      {value ? <p className="mt-2 font-mono text-lg font-semibold tabular-nums">{value}</p> : null}
      {item.excerpt ? (
        <blockquote className="mt-2 border-l-2 border-ink pl-3 text-sm whitespace-pre-wrap text-ink-2">
          {item.excerpt}
        </blockquote>
      ) : null}
      {formula ? <p className="mt-2 text-sm text-ink-2">계산식: {formula}</p> : null}
      <dl className="mt-3 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted">출처</dt>
        <dd>{item.source || "확인 필요"}</dd>
        <dt className="text-muted">기준일</dt>
        <dd className="font-mono">{item.asOf}</dd>
        {item.validUntil ? (
          <>
            <dt className="text-muted">유효 기한</dt>
            <dd className="font-mono">{item.validUntil}</dd>
          </>
        ) : null}
        <dt className="text-muted">버전</dt>
        <dd className="font-mono">v{item.version}</dd>
        {compact ? null : (
          <>
            <dt className="text-muted">근거 ID</dt>
            <dd className="font-mono text-[12px] break-all text-muted">{item.id}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

export function EvidencePanel({
  ids,
  title,
  orgId,
  mode,
  onClose,
}: {
  ids: string[];
  title?: string;
  orgId: string;
  mode: DataMode;
  onClose: () => void;
}) {
  const [remote, setRemote] = useState<Loaded[] | null>(null);

  useEffect(() => {
    if (mode !== "live") return;
    let alive = true;
    Promise.all(
      ids.map((id) =>
        api
          .getEvidence(id, orgId)
          .then((detail): Loaded => ({ id, detail, error: null }))
          .catch((error: unknown): Loaded => ({
            id,
            detail: null,
            error: error instanceof Error ? error.message : "근거를 불러오지 못했습니다.",
          })),
      ),
    ).then((items) => {
      if (alive) setRemote(items);
    });
    return () => {
      alive = false;
    };
  }, [ids, orgId, mode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items: Loaded[] | null =
    mode === "live"
      ? remote
      : ids.map((id) => {
          const detail = fixtureDetail(id);
          return { id, detail, error: detail ? null : "예시 데이터에 없는 근거입니다." };
        });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="근거 패널 닫기"
        className="absolute inset-0 bg-ink/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="근거"
        className="relative flex h-full w-full max-w-[440px] flex-col border-l border-ink bg-surface"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-label text-muted">근거</p>
            <h2 className="text-h2">{title ?? "이 값의 근거"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-sunken"
          >
            닫기
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {mode !== "live" ? (
            <p className="rounded-md bg-warn-bg px-3 py-2 text-[13px] font-semibold text-warn">
              예시 데이터입니다. 실제 근거 저장소의 기록이 아닙니다.
            </p>
          ) : null}
          {items === null ? <p className="text-sm text-muted">근거를 불러오는 중입니다.</p> : null}
          {items?.map((item, index) => (
            <section key={item.id} className="space-y-3">
              {ids.length > 1 ? (
                <p className="text-label text-muted">
                  {index === 0 ? "값의 출처" : "보조 근거"}
                </p>
              ) : null}
              {item.detail ? (
                <>
                  <EvidenceCard item={item.detail.evidence} />
                  {item.detail.chain.length > 0 ? (
                    <div className="space-y-2 border-l border-line-strong pl-4">
                      <p className="text-label text-muted">
                        계산 사슬 ({item.detail.chain.length}개)
                      </p>
                      {item.detail.chain.map((link) => (
                        <EvidenceCard key={link.id} item={link} compact />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">
                  {item.error} <span className="font-mono text-[12px] break-all">{item.id}</span>
                </p>
              )}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
