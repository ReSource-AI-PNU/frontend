"use client";

import { useState } from "react";

/** 서버 오류의 digest를 보여 주고 복사할 수 있게 한다. 지원 문의 때 이 값으로 서버 로그를 찾는다. */
export function ErrorCode({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-sunken px-3.5 py-2.5">
      <span className="text-label text-muted">오류 코드</span>
      <code className="num text-sm text-ink select-all">{digest}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(digest);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="ml-auto min-h-9 rounded-md px-2 text-[13px] font-semibold text-ink underline underline-offset-4 hover:bg-surface"
      >
        복사
      </button>
      <span aria-live="polite" className="text-[13px] text-muted">
        {copied ? "복사했습니다." : ""}
      </span>
    </div>
  );
}
