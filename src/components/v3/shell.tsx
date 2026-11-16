"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/v3/api";
import { useV3 } from "./context";

const ROLE_LABEL = { emitter: "배출 기업", vendor: "처리 업체", admin: "관리자" } as const;
const TABS = [
  { href: "/v3", label: "진단·연결" },
  { href: "/v3/materials", label: "자료 올리기" },
  { href: "/v3/approval", label: "승인" },
  { href: "/v3/admin", label: "관리자" },
];

/** v3 화면 공통 틀: 화면 탭, 관점 전환(시연용), 예시 데이터 띠 */
export function V3Shell({ children }: { children: ReactNode }) {
  const { mode, orgs, org, setOrgId } = useV3();
  const pathname = usePathname();
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 sm:px-6 lg:px-8">
        <nav aria-label="화면" className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-3 text-sm whitespace-nowrap ${active ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:text-ink"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <label className="ml-auto flex items-center gap-2 py-2 text-[13px] text-muted">
          관점 (시연용)
          <select
            value={org.id}
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
      {mode === "fixture" ? (
        <div role="status" className="border-b border-warn bg-warn-bg px-4 py-2.5 text-sm font-semibold text-warn sm:px-6 lg:px-8">
          예시 데이터 · 백엔드({API_BASE})에 연결하지 못해 가상 예시를 보여 줍니다. 실제 에이전트
          대화나 계산 결과가 아니며, 실행·답변·승인·업로드는 보내지 않습니다.
        </div>
      ) : null}
      {children}
    </div>
  );
}
