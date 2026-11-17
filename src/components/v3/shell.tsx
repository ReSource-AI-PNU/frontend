"use client";

import type { ReactNode } from "react";
import { API_BASE } from "@/lib/v3/api";
import { useV3 } from "./context";

const ROLE_LABEL = { emitter: "배출 기업", vendor: "처리 업체", admin: "관리자" } as const;

/** v3 화면 공통 틀: 데이터 출처 표시, 관점 전환(시연용), 예시 데이터 띠. 화면 이동은 주 메뉴가 맡는다. */
export function V3Shell({ children }: { children: ReactNode }) {
  const { mode, fixture, reconnect, orgs, org, setOrgId } = useV3();
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 sm:px-6 lg:px-8">
        <p className="min-w-0 text-[13px] text-muted">
          {mode === "loading" ? (
            <>
              백엔드에 연결하는 중 <span className="font-mono text-[12px] break-all">{API_BASE}</span>
            </>
          ) : mode === "live" ? (
            <>
              <span className="font-semibold text-ink">백엔드 연결됨</span>{" "}
              <span className="font-mono text-[12px] break-all">{API_BASE}</span>
            </>
          ) : (
            <span className="font-semibold text-warn">백엔드 연결 안 됨 · 예시 데이터</span>
          )}
        </p>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-muted">
          관점 (시연용)
          <select
            value={org.id}
            disabled={mode === "loading"}
            onChange={(event) => setOrgId(event.target.value)}
            className="min-h-[34px] rounded-md border border-line-strong bg-surface px-2 text-sm font-semibold text-ink"
          >
            {orgs.map((item) => (
              <option key={item.id} value={item.id}>
                {ROLE_LABEL[item.role]} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "fixture" && fixture ? (
        <div role="status" className="border-b border-warn bg-warn-bg px-4 py-2.5 text-sm text-warn sm:px-6 lg:px-8">
          <p className="font-semibold">
            예시 데이터 · 백엔드(<span className="font-mono text-[13px]">{API_BASE}</span>)에 연결하지 못해, 저장해 둔
            결과를 보여 줍니다.
          </p>
          <p className="mt-1">
            백엔드 로컬 서버가 <span className="font-mono">{fixture.meta.capturedOn}</span>에 시연용 가상
            데이터로 실제로 낸 진단(승인 전 상태)입니다. 회사·단가·물량은 모두 가상이고, 대화는 모델이 쓴
            것이 아니라 <span className="font-semibold">&ldquo;{fixture.meta.writers.join(", ")}&rdquo;</span>로
            만든 결과입니다. 실행·답변·승인·업로드·저장은 보내지 않습니다.{" "}
            <button type="button" className="font-semibold underline underline-offset-4" onClick={reconnect}>
              다시 연결
            </button>
          </p>
        </div>
      ) : null}
      {org.synthetic && mode === "live" ? (
        <p className="border-b border-line bg-sunken px-4 py-1.5 text-[13px] text-ink-2 sm:px-6 lg:px-8">
          {org.note ?? "시연용 가상 데이터"}
        </p>
      ) : null}
      {children}
    </div>
  );
}
