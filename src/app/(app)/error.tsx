"use client";

import { useEffect } from "react";
import { CONTACT_PENDING, SUPPORT_EMAIL } from "@/components/legal/contact";
import { ErrorCode } from "@/components/legal/error-code";
import { Button, ButtonLink } from "@/components/ui/button";

function digestOf(error: unknown) {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string") return error.digest;
  return null;
}

/** 앱 화면의 오류 경계. 앱 헤더(레이아웃)는 그대로 두고 본문만 바꾼다. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = digestOf(error);
  const devMessage = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid w-full max-w-[1200px] px-6 py-16 lg:px-8">
      <div role="alert" className="grid max-w-[640px] gap-5">
        <p className="text-label text-loss">오류</p>
        <h1 className="text-h1">화면을 불러오지 못했습니다</h1>
        <p className="text-ink-2">
          일시적인 문제일 수 있으니 다시 시도해 주세요. 저장을 마친 내용은 그대로 남아 있습니다.
        </p>
        {digest ? <ErrorCode digest={digest} /> : null}
        {devMessage ? (
          <pre className="overflow-x-auto rounded-md border border-dashed border-line-strong px-3.5 py-2.5 text-[13px] whitespace-pre-wrap text-muted">
            개발 모드 메시지: {devMessage}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => retry()}>다시 시도</Button>
          <ButtonLink href="/session" variant="secondary">
            세션 목록으로
          </ButtonLink>
        </div>
        <p className="border-t border-line pt-5 text-sm text-muted">
          계속 같은 화면이 나오면 {digest ? "위 오류 코드와 함께 " : ""}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
          {CONTACT_PENDING ? " (연락처 확정 전)" : ""}로 알려 주세요. 어느 화면에서 무엇을 누르다 생겼는지 적어 주시면 빨리 찾을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
