"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { useEscape } from "@/components/use-escape";
import { api } from "@/lib/v3/api";
import { CHECK_KEY_LABEL, formatNumber } from "@/lib/v3/format";
import { evidenceExcerpt, evidenceSource, evidenceTitle, evidenceTool } from "@/lib/v3/labels";
import type { Evidence, EvidenceDetail } from "@/lib/v3/types";

type Loaded = { id: string; detail: EvidenceDetail | null; error: string | null };

function valueText(item: Evidence): string | null {
  if (item.value === null || item.value === undefined) return null;
  const value = typeof item.value === "number" ? formatNumber(item.value).replace("-", "−") : item.value;
  if (!item.unit) return String(value);
  return item.unit === "%" ? `${value}%` : `${value} ${item.unit}`;
}

/** 주소의 %EB… 표기를 읽을 수 있는 글자로 바꾼다. */
function readable(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

/**
 * 근거 응답의 access에는 보는 조직과 소유 조직만 실린다(전체 공개는 "*").
 * 그 밖에 누가 볼 수 있는지는 서버가 알려 주지 않으므로 화면도 적지 않는다.
 */
function accessText(access: string[], orgName: (id: string) => string): string {
  if (access.includes("*")) return "모든 회사";
  if (access.length === 0) return "확인 필요";
  return access.map(orgName).join(", ");
}

/**
 * 근거 하나. 출처·이름·발췌에 판단 도구의 내부 ID를 쓰지 않는다(src/lib/v3/labels.ts). 근거 ID와 판단 도구 ID 같은
 * 기술 정보는 운영 회사(technical)에게만 보인다.
 */
function EvidenceCard({
  item,
  compact = false,
  orgName,
  technical,
}: {
  item: Evidence;
  compact?: boolean;
  orgName: (id: string) => string;
  technical: boolean;
}) {
  const value = valueText(item);
  const formula = typeof item.meta.formula === "string" ? item.meta.formula : null;
  const tool = typeof item.meta.tool === "string" ? item.meta.tool : null;
  const toolName = evidenceTool(item);
  const source = evidenceSource(item);
  const hiddenInputs = (item.meta.inputs as { hidden?: boolean } | undefined)?.hidden === true;
  const url = typeof item.meta.url === "string" && /^https?:\/\//.test(item.meta.url) ? item.meta.url : null;
  // 원문이 JSON 덩어리(기준표 등)면 줄글 대신 고정폭으로 보여 준다
  const structured = /^[[{]/.test(item.excerpt.trim());
  const excerpt = structured ? item.excerpt : evidenceExcerpt(item, (key) => CHECK_KEY_LABEL[key]);
  const assumed = item.kind === "assumption";
  return (
    <article>
      <p className="text-[13px] text-muted">
        {item.kindLabel}
        {assumed ? <span className="ml-1.5 text-warn">팀이 정한 가정값입니다</span> : null}
      </p>
      <h3 className={compact ? "text-[15px] font-medium" : "mt-0.5 text-[17px] leading-snug font-semibold tracking-[-0.02em]"}>
        {evidenceTitle(item)}
      </h3>
      {value ? (
        <p className={`mt-1 font-semibold tabular-nums ${compact ? "text-[17px]" : "text-[26px] leading-tight tracking-[-0.02em]"}`}>
          {value}
        </p>
      ) : null}
      {excerpt ? (
        structured ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-ground p-3 font-mono text-[12px] break-all whitespace-pre-wrap text-ink-2">
            {excerpt}
          </pre>
        ) : (
          <blockquote className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-ground px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">
            {excerpt}
          </blockquote>
        )
      ) : null}
      {formula && formula !== item.excerpt && item.meta.call !== true ? <p className="mt-3 text-sm text-ink-2">계산식: {formula}</p> : null}
      {hiddenInputs ? (
        <p className="mt-2 text-[13px] text-muted">계산에 넣은 원본 값은 계산한 회사에게만 보입니다.</p>
      ) : null}
      <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <dt className="text-muted">출처</dt>
        <dd>
          {source ?? <span className="text-warn">확인 필요</span>}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="block text-[12px] break-all text-muted underline underline-offset-2 hover:text-ink">
              {readable(url)}
            </a>
          ) : null}
        </dd>
        <dt className="text-muted">기준일</dt>
        <dd className="tabular-nums">
          {item.asOf}
          {item.validUntil ? ` (${item.validUntil}까지 유효)` : ""}
        </dd>
        {toolName && !source?.includes(toolName) ? (
          <>
            <dt className="text-muted">계산한 곳</dt>
            <dd>{toolName}</dd>
          </>
        ) : null}
        {compact ? null : (
          <>
            <dt className="text-muted">볼 수 있는 곳</dt>
            <dd>{accessText(item.access, orgName)}</dd>
            <dt className="text-muted">버전</dt>
            <dd className="tabular-nums">{item.version}</dd>
          </>
        )}
      </dl>
      {compact || !technical ? null : (
        <details className="mt-2 text-[12px] text-muted">
          <summary className="cursor-pointer hover:text-ink">기술 정보</summary>
          <p className="mt-1 font-mono break-all">
            {item.id} · v{item.version}
            {tool ? ` · ${tool}` : ""}
          </p>
        </details>
      )}
    </article>
  );
}

export function EvidencePanel({
  ids,
  title,
  orgId,
  orgName,
  technical = false,
  live,
  onClose,
}: {
  ids: string[];
  title?: string;
  orgId: string;
  /** 조직 ID를 이름으로. 모르는 조직이면 "다른 회사"처럼 ID가 아닌 말을 돌려준다 */
  orgName: (id: string) => string;
  /** 근거 ID와 판단 도구 ID를 보여 줄지(운영 회사만) */
  technical?: boolean;
  /** 서버와 이어졌을 때만 근거를 읽는다 */
  live: boolean;
  onClose: () => void;
}) {
  const [remote, setRemote] = useState<Loaded[] | null>(null);

  useEffect(() => {
    if (!live) return;
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
  }, [ids, orgId, live]);

  // Esc는 맨 위 패널만 닫는다(대화 패널 위에 열렸으면 이것만)
  useEscape(true, onClose);

  const items: Loaded[] | null = live ? remote : null;

  // 첫 근거의 계산 사슬에 이미 나온 근거는 아래에 다시 그리지 않는다
  const inChain = new Set(items?.[0]?.detail?.chain.map((link) => link.id) ?? []);
  const shown = items?.filter((item, index) => index === 0 || !inChain.has(item.id)) ?? null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="근거 패널 닫기" className="absolute inset-0 bg-ink/25" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="근거"
        className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-bg shadow-[0_0_60px_rgb(0_0_0/0.18)] [animation:rs-panel_240ms_var(--ease-out)_both]"
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{title ?? "이 값의 근거"}</h2>
            <p className="text-[13px] text-muted">이 값이 어디서 왔는지, 위에서 아래로 따라가며 볼 수 있습니다.</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="근거 패널 닫기"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-5 py-5">
          {items === null ? (
            <p className="text-sm text-muted">{live ? "근거를 불러오는 중입니다." : "잠시 연결이 원활하지 않습니다. 잠시 후 다시 열어 주세요."}</p>
          ) : null}
          <div className="divide-y divide-line">
            {shown?.map((item, index) => (
              <section key={item.id} className="py-6 first:pt-0 last:pb-0">
                {shown.length > 1 && index > 0 ? <p className="mb-2 text-[13px] text-muted">함께 쓴 근거</p> : null}
                {item.detail ? (
                  <>
                    <EvidenceCard item={item.detail.evidence} orgName={orgName} technical={technical} />
                    {item.detail.chain.length > 0 ? (
                      <div className="mt-6">
                        <p className="text-[13px] text-muted">이 값을 계산하는 데 쓴 값 {item.detail.chain.length}개</p>
                        <ol className="mt-3 space-y-5 border-l border-line-strong pl-4">
                          {item.detail.chain.map((link) => (
                            <li key={link.id} style={{ marginLeft: `${Math.max((link.depth ?? 1) - 1, 0) * 14}px` }}>
                              <EvidenceCard item={link} compact orgName={orgName} technical={technical} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-loss">
                    {item.error}
                    {technical ? <span className="block text-[12px] break-all text-muted">{item.id}</span> : null}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
