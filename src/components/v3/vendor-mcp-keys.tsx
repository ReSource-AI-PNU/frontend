"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { ApiError, api } from "@/lib/v3/api";
import { connectionExamples, keyCountLine } from "@/lib/v3/mcp-keys";
import type { McpKey, McpKeyList } from "@/lib/v3/types";

const field =
  "min-h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-[15px] placeholder:text-muted disabled:bg-sunken disabled:text-muted";

const noop = () => () => {};

function day(value: string | null): string {
  if (!value) return "아직 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString("ko-KR");
}

/** 복사 단추. 복사하면 잠깐 "복사했습니다"로 바뀐다 */
function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "복사했습니다" : label}
    </Button>
  );
}

function Example({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-2">{title}</p>
        <CopyButton text={text} />
      </div>
      <pre className="mt-1.5 overflow-x-auto rounded-md border border-line px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

/**
 * 외부 AI 에이전트 연결. 업체가 쓰는 AI 에이전트가 연결 키로 붙어 업체 정보 초안을 채운다.
 * 에이전트가 넣은 값은 위 AI 도우미의 초안으로 들어가고, 담당자가 확인해야 저장된다(저장 도구는 없다).
 * 업체 담당자에게만 보이며, 서버에 이 기능이 없으면(404·405) 아무것도 그리지 않는다.
 */
export function VendorMcpKeys({ orgId }: { orgId: string }) {
  const [list, setList] = useState<McpKeyList | null>(null);
  const [hidden, setHidden] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ key: McpKey; token: string } | null>(null);
  // 연결 주소는 지금 보고 있는 사이트 주소에 경로를 붙인 것이다(서버에서 그릴 때는 비운다)
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );

  useEffect(() => {
    let alive = true;
    api.listMcpKeys(orgId).then(
      (next) => {
        if (alive) setList(next);
      },
      (failure: unknown) => {
        if (!alive) return;
        if (failure instanceof ApiError && (failure.status === 404 || failure.status === 405)) setHidden(true);
        else setError(failure instanceof Error ? failure.message : "연결 키를 불러오지 못했습니다.");
      },
    );
    return () => {
      alive = false;
    };
  }, [orgId]);

  if (hidden) return null;

  const create = async () => {
    const name = label.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createMcpKey(orgId, name);
      setCreated({ key: result.key, token: result.token });
      setLabel("");
      setList((before) => ({
        path: result.path,
        limit: before?.limit ?? 5,
        keys: [...(before?.keys ?? []), result.key],
      }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "연결 키를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key: McpKey) => {
    if (busy) return;
    if (!window.confirm(`'${key.label}' 연결을 끊을까요? 이 키로 붙은 에이전트는 더 이상 초안을 채우지 못합니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      setList(await api.deleteMcpKey(orgId, key.id));
      if (created?.key.id === key.id) setCreated(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "연결을 끊지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const keys = list?.keys ?? [];
  const limit = list?.limit ?? 5;
  const url = `${origin}${list?.path ?? "/mcp/vendor"}`;
  const examples = connectionExamples(url, created?.token ?? null);

  return (
    <section className="border-t border-line py-8" aria-labelledby="vendor-mcp-title">
      <h2 id="vendor-mcp-title" className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">
        외부 AI 에이전트 연결
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        우리 회사가 쓰는 AI 에이전트가 업체 정보 초안을 채우게 할 수 있습니다. 에이전트가 넣은 값도 위 초안에 들어가고, 담당자가
        확인해야 저장됩니다.
      </p>
      <p className="mt-1 text-[13px] text-muted">{list ? keyCountLine(keys.length, limit) : "연결 키를 불러오는 중입니다."}</p>

      {keys.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-y border-line text-[15px]">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="font-medium">{key.label}</span>
              <span className="font-mono text-[13px] text-muted">{key.prefix}…</span>
              <span className="min-w-0 flex-1 text-[13px] text-muted">
                만든 날 {day(key.createdAt)} · 마지막 사용 {day(key.lastUsedAt)}
              </span>
              <Button size="sm" variant="ghost" className="!text-ink-2" disabled={busy} onClick={() => void remove(key)}>
                연결 끊기
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {created ? (
        <div className="mt-4 border-t border-line pt-4" role="status">
          <p className="text-[15px] font-semibold">새 연결 키 · {created.key.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line-strong px-3 py-2 font-mono text-[13px] break-all">
              {created.token}
            </code>
            <CopyButton text={created.token} />
          </div>
          <p className="mt-2 text-[13px] text-warn">
            이 키는 지금 한 번만 보입니다. 이 화면을 닫으면 다시 볼 수 없으니 에이전트 설정에 바로 넣어 두세요.
          </p>
          <Button size="sm" variant="ghost" className="mt-1 !text-ink-2" onClick={() => setCreated(null)}>
            저장해 두었습니다
          </Button>
        </div>
      ) : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          aria-label="연결할 에이전트 이름"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="예: 사내 AI 비서"
          maxLength={40}
          disabled={busy || keys.length >= limit}
          className={field}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!label.trim() || busy || keys.length >= limit}>
          연결 키 만들기
        </Button>
      </form>
      {keys.length >= limit ? (
        <p className="mt-2 text-[13px] text-muted">연결 키는 {limit}개까지 만들 수 있습니다. 쓰지 않는 연결을 끊고 만들어 주세요.</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <MoreDetails label="연결 방법 보기" closeLabel="연결 방법 접기" className="mt-4 text-sm">
        <div className="pb-2 text-ink-2">
          <p>
            MCP(에이전트가 외부 도구를 쓰는 표준 방식)를 지원하는 에이전트면 연결할 수 있습니다. 주소와 키를 에이전트 설정에 넣으면
            공공 허가 명부 찾기, 말한 값을 초안에 넣기, 매입 기준 넣기, 업체 정보 현황 보기를 쓸 수 있습니다. 저장(확정)은 할 수
            없습니다.
          </p>
          <Example title="주소" text={url} />
          <Example title="인증 헤더" text={examples.header} />
          <Example title="Claude Code에서" text={examples.claudeCode} />
          <Example title="설정 파일(JSON)" text={examples.json} />
          {!created ? <p className="mt-2 text-[13px] text-muted">예시의 &lt;키&gt; 자리에 만든 연결 키를 넣습니다.</p> : null}
        </div>
      </MoreDetails>
    </section>
  );
}
