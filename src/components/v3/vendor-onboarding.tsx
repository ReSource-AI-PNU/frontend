"use client";

import { useEffect, useRef, useState } from "react";
import { Dots } from "@/components/agent/dots";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/v3/api";
import { AI_NAME } from "@/lib/v3/labels";
import { authorLabel, checkSummary, groupDraft, selectedKeys, startOpen } from "@/lib/v3/onboarding";
import type { OnboardingState, VendorProfile } from "@/lib/v3/types";

const field =
  "min-h-11 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";

/** AI가 표시한 것(DESIGN.md 색 규칙 1)의 점 */
function MarkerDot() {
  return <span aria-hidden="true" className="mr-1.5 inline-block size-2 shrink-0 rounded-full bg-marker ring-1 ring-ink align-middle" />;
}

/**
 * 업체 정보 AI 도우미. 업체 측 AI가 공공 허가 명부와 담당자 대화로 업체 정보 초안을 채우고,
 * 담당자가 고른 항목만 저장한다. 업체 담당자에게만 보이며, 서버에 이 기능이 없으면(404) 아무것도 그리지 않는다.
 */
export function VendorOnboarding({ orgId, discoverable, onSaved }: {
  orgId: string;
  discoverable: boolean;
  onSaved: (profile: VendorProfile) => void;
}) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unselected, setUnselected] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let alive = true;
    api.getOnboarding(orgId).then(
      (next) => {
        if (!alive) return;
        setState(next);
        setLoadError(null);
        setOpen((before) => before ?? startOpen(next));
      },
      (failure: unknown) => {
        if (!alive) return;
        // 이 기능이 없는 서버(이전 판)에서는 조용히 숨긴다
        if (failure instanceof ApiError && (failure.status === 404 || failure.status === 405)) setHidden(true);
        else setLoadError(failure instanceof Error ? failure.message : "불러오지 못했습니다.");
      },
    );
    return () => {
      alive = false;
    };
  }, [orgId, attempt]);

  const messageCount = state?.messages.length ?? 0;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messageCount, sending]);

  if (hidden) return null;
  if (loadError) {
    return (
      <section className="pb-8">
        <p role="alert" className="text-sm text-loss">
          {loadError}
        </p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
          다시 시도
        </Button>
      </section>
    );
  }
  if (!state) return <p className="pb-8 text-sm text-muted">업체 정보 도우미를 불러오는 중입니다.</p>;

  const author = authorLabel(state.model, AI_NAME.vendor);
  const groups = groupDraft(state.draft);
  const picked = selectedKeys(state.draft, unselected);

  const send = async () => {
    const message = text.trim();
    if (!message || sending || busy) return;
    setSending(message);
    setText("");
    setError(null);
    setNote(null);
    try {
      setState(await api.sendOnboardingMessage(orgId, message));
    } catch (failure) {
      setText(message);
      setError(failure instanceof Error ? failure.message : "보내지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(null);
    }
  };

  const confirm = async () => {
    if (picked.length === 0 || busy || sending) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await api.confirmOnboarding(orgId, picked);
      setState(result.onboarding);
      setUnselected(new Set());
      setNote(`${picked.length}가지를 업체 정보에 저장했습니다. 아래 칸에 반영했습니다.`);
      onSaved(result.profile);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy || sending) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      setState(await api.resetOnboarding(orgId));
      setUnselected(new Set());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "지우지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) => {
    const next = new Set(unselected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setUnselected(next);
  };

  return (
    <section className="pb-8" aria-labelledby="vendor-onboarding-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="vendor-onboarding-title" className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">
            AI와 함께 업체 정보 채우기
          </h2>
          <p className="mt-1 text-sm text-ink-2">{checkSummary(discoverable)}</p>
        </div>
        <Button size="sm" variant="ghost" className="!text-ink-2" aria-expanded={Boolean(open)} onClick={() => setOpen(!open)}>
          {open ? "간단히 보기" : state.draft.length > 0 ? `대화 열기 · 확인할 초안 ${state.draft.length}가지` : "대화 열기"}
        </Button>
      </div>
      {state.checks.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
          {state.checks.map((check) => (
            <li
              key={check.key}
              title={check.note || undefined}
              className={`rounded-full px-2.5 py-1 ${check.done ? "bg-ink text-on-ink" : "bg-sunken text-ink-2"}`}
            >
              {check.done ? "✓ " : ""}
              {check.label}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="mt-5">
          <p className="text-sm text-muted">
            {AI_NAME.vendor}가 공공 허가 명부와 담당자가 답한 내용으로 업체 정보 초안을 만듭니다. 숫자는 담당자가 말한 것만 쓰고, 확인한
            항목만 저장됩니다.
          </p>

          <ol ref={listRef} aria-live="polite" className="mt-4 flex max-h-[440px] flex-col gap-3 overflow-y-auto pr-1">
            {state.messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-[20px] bg-sunken px-4 py-2.5 text-[15px] whitespace-pre-line">{message.text}</div>
                </li>
              ) : (
                <li key={message.id} className="flex max-w-[85%] flex-col gap-1">
                  <span className="text-[12.5px] text-muted">{author}</span>
                  <div className="rounded-[20px] border border-line-strong bg-surface px-4 py-2.5 text-[15px] whitespace-pre-line">
                    {message.text}
                  </div>
                  {message.tools.length > 0 ? (
                    <ul className="flex flex-col gap-0.5 pl-1 text-[12.5px] text-muted">
                      {message.tools.map((tool, index) => (
                        <li key={index}>
                          <MarkerDot />
                          {tool.summary}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ),
            )}
            {sending ? (
              <>
                <li className="flex justify-end">
                  <div className="max-w-[85%] rounded-[20px] bg-sunken px-4 py-2.5 text-[15px] whitespace-pre-line">{sending}</div>
                </li>
                <li className="flex items-center gap-2 text-[13px] text-muted">
                  <Dots label={`${author}가 답을 쓰고 있습니다`} />
                  {author}가 답을 쓰고 있습니다. 1분 가까이 걸릴 수 있습니다.
                </li>
              </>
            ) : null}
          </ol>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              aria-label={`${AI_NAME.vendor}에게 보낼 말`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="예: 차량은 5톤 두 대이고 월·수·금에 수거합니다"
              disabled={Boolean(sending) || busy}
              maxLength={2000}
              className={field}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!text.trim() || Boolean(sending) || busy}>
              보내기
            </Button>
          </form>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-loss">
              {error}
            </p>
          ) : null}

          {groups.length > 0 ? (
            <div className="mt-6 rounded-[14px] border border-line bg-ground p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-ink-2">
                <MarkerDot />
                AI 초안 · 담당자 확인 전
              </p>
              <p className="mt-1 text-sm text-muted">
                AI가 공공 허가 명부와 대화 내용으로 채운 초안입니다. 확인한 항목만 저장됩니다.
              </p>
              {groups.map((group) => (
                <fieldset key={group.section} className="mt-4">
                  <legend className="text-[13px] font-semibold text-muted">{group.label}</legend>
                  <ul className="mt-1 divide-y divide-line border-y border-line">
                    {group.items.map((item) => (
                      <li key={item.key} className="py-2">
                        <label className="flex min-h-11 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!unselected.has(item.key)}
                            onChange={() => toggle(item.key)}
                            disabled={busy}
                            className="mt-1 size-[18px] shrink-0 accent-ink"
                          />
                          <span className="min-w-0">
                            <span className="block text-[15px]">
                              <span className="font-medium">{item.label}</span>
                              <span className="text-ink-2"> · {item.text}</span>
                            </span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">
                              {item.source.label}
                              {item.source.quote ? ` · “${item.source.quote}”` : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button size="sm" variant="secondary" disabled={picked.length === 0 || busy || Boolean(sending)} onClick={() => void confirm()}>
                  {busy ? "저장하는 중" : `확인하고 업체 정보에 저장 · ${picked.length}가지`}
                </Button>
                <span className="text-[13px] text-muted">고르지 않은 항목은 초안에 남습니다.</span>
              </div>
            </div>
          ) : null}
          {note ? <p className="mt-3 text-sm text-ink-2">{note}</p> : null}

          {state.messages.some((message) => message.role === "user") || state.draft.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-2">
              <Button size="sm" variant="ghost" className="!text-ink-2" disabled={busy || Boolean(sending)} onClick={() => void reset()}>
                처음부터 다시
              </Button>
              <span className="text-[13px] text-muted">대화와 초안만 지웁니다. 저장한 업체 정보는 그대로입니다.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
