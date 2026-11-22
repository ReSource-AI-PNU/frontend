"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useV3 } from "@/components/v3/context";
import { loadVendorProfile } from "@/components/v3/materials-view";
import { useRemote } from "@/components/v3/use-remote";
import { api } from "@/lib/v3/api";
import { formatDateTime } from "@/lib/v3/format";
import { vendorEmptyCopy } from "@/lib/v3/vendor-empty";
import { Dots } from "./dots";

const STATUS_WORD: Record<string, string> = {
  idle: "진행 전",
  running: "AI가 조건을 묻는 중",
  awaiting_answers: "배출 기업 답변 기다림",
  awaiting_approval: "승인 기다림",
  confirmed: "확정",
};

/**
 * 받은 문의(처리 업체) 또는 찾기 기록(배출 기업). 서버에 남은 내가 당사자인 찾기 목록(GET /sessions)이다.
 * 누르면 그 찾기를 열어 대화 화면으로 간다.
 */
export function Inquiries() {
  const { org, mode, sessionId, setSessionId, basePath } = useV3();
  const router = useRouter();
  const vendor = org.role === "vendor";
  const list = useRemote(`sessions:${org.id}`, mode === "live", () => api.listSessions(org.id));
  // 빈 화면 글은 업체 프로필로 정한다: 허가 품목·매입 기준을 올렸으면 다시 올리라고 하지 않는다
  const profile = useRemote(`vendor:${org.id}`, mode === "live" && vendor, () => loadVendorProfile(org.id, org.name));
  const empty = vendor ? vendorEmptyCopy(profile.error ? undefined : profile.data, "inquiries") : null;
  const open = (id: string) => {
    setSessionId(id);
    router.push(`${basePath}/deals?session=${encodeURIComponent(id)}`);
  };

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-10 pb-16">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">{vendor ? "받은 문의" : "찾기 기록"}</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {vendor
            ? "허가 품목 또는 매입 기준을 등록하면 문의 후보군에 포함됩니다. 실제 문의는 물량별 품목과 조건에 따라 들어옵니다."
            : "지금까지 받아 줄 곳을 찾은 기록입니다. 누르면 결과와 대화를 다시 볼 수 있습니다."}
        </p>
      </header>
      {list.loading || (vendor && profile.loading) ? (
        <div className="py-10">
          <Dots label="불러오는 중" />
        </div>
      ) : list.error ? (
        <p role="alert" className="text-sm text-loss">
          {list.error}{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={list.reload}>
            다시 시도
          </button>
        </p>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState
          title={empty ? empty.title : "아직 찾은 기록이 없습니다"}
          description={empty ? empty.description : "폐기물을 등록하고 받아 줄 곳을 찾으면 이곳에 기록이 남습니다."}
          action={
            <Link
              href={empty ? `${basePath}/materials` : basePath}
              className={buttonClass(empty?.action.upload ? "primary" : "secondary")}
            >
              {empty ? empty.action.label : "찾기 화면으로"}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {list.data.map((item) => {
            const current = item.id === sessionId;
            const at = item.updatedAt ?? item.createdAt;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item.id)}
                  aria-current={current ? "true" : undefined}
                  className="flex min-h-16 w-full flex-wrap items-center gap-x-4 gap-y-1 px-1 py-3 text-left transition-colors hover:bg-ground"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{vendor ? item.emitterName : "받아 줄 곳 찾기"}</span>
                    <span className="block text-[13px] text-muted">{STATUS_WORD[item.status] ?? "진행 중"}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-muted tabular-nums">
                    {current ? "보는 중 · " : ""}
                    {at ? formatDateTime(at, "date") : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
