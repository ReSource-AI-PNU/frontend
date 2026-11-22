"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
import { useRemote } from "@/components/v3/use-remote";
import { api } from "@/lib/v3/api";
import { loadVendorProfile } from "@/components/v3/materials-view";
import { useDiagnosis } from "@/components/v3/use-diagnosis";
import { vendorEmptyCopy } from "@/lib/v3/vendor-empty";
import { Conversation } from "./conversation";
import { FIND_PARTS, findHref, findPartOf } from "./nav-pages";
import { Dots } from "./dots";
import { Start } from "./start";

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-balance">{title}</h1>
      <div className="mt-3 max-w-[520px] text-ink-2">{children}</div>
    </div>
  );
}

/** 처리 업체가 아직 받은 문의가 없을 때. 허가 품목과 매입 기준이 없으면 그것부터 올리게 한다(src/lib/v3/vendor-empty.ts) */
function VendorEmpty({ error }: { error: string | null }) {
  const { org, mode, readOnly, basePath } = useV3();
  const profile = useRemote(`vendor:${org.id}`, mode === "live", () => loadVendorProfile(org.id, org.name));
  if (profile.loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <Dots label="불러오는 중" />
      </div>
    );
  }
  const copy = vendorEmptyCopy(profile.error ? undefined : profile.data, "home");
  return (
    <Centered title={copy.title}>
      <p>{copy.description}</p>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-loss-bg px-4 py-3 text-sm text-loss">
          {error}
        </p>
      ) : null}
      <Link
        href={`${basePath}/materials`}
        className={buttonClass(copy.action.upload && !readOnly ? "primary" : "secondary", "md", "mt-6 !min-h-12")}
      >
        {copy.action.label}
      </Link>
    </Centered>
  );
}

/**
 * 찾기 화면. 보는 회사의 종류와 진단 유무에 따라 한 가지만 보여 준다.
 * 주소가 찾기 한 건의 어느 화면인지 정한다(/find 진행·결과, /find/approve 승인 …, nav-pages.ts FIND_PARTS).
 * 찾기 레이아웃이 그리므로 하위 화면을 옮겨 다녀도 같은 진단과 실시간 진행을 그대로 쓴다.
 */
export function AgentHome() {
  const { mode, readOnly, basePath, setSessionId, dropSession, failedSessions } = useV3();
  const part = findPartOf(usePathname(), basePath);
  const d = useDiagnosis();
  const stale = Boolean(d.sessionId) && !d.view && !d.loading && Boolean(d.error);

  // 적어 둔 찾기를 열지 못하면(지워졌거나 볼 수 없게 됐을 때) 지우고 첫 화면을 보여 준다.
  // 열지 못한 것은 기억해 두어 목록에서 같은 찾기를 되풀이해 열지 않는다
  useEffect(() => {
    if (stale && d.sessionId) dropSession(d.sessionId);
  }, [stale, d.sessionId, dropSession]);

  // 이 기기에 적어 둔 찾기가 없으면, 서버에 남은 내 찾기 목록에서 최근 것을 찾는다
  const lookUp = mode === "live" && !d.loading && !d.view;
  const recent = useRemote(`sessions:${d.org.id}:${d.sessionId ?? ""}`, lookUp, () => api.listSessions(d.org.id));
  const latest = lookUp
    ? (recent.data?.find((item) => item.id !== d.sessionId && !failedSessions.includes(item.id)) ?? null)
    : null;
  // 업체·운영자와 체험하기는 최근 것을 바로 연다. 배출 기업은 새로 찾을 수도 있으므로 고르게 한다
  const autoOpen = d.org.role !== "emitter" || readOnly;
  useEffect(() => {
    if (latest && autoOpen) setSessionId(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id, autoOpen]);

  if (d.loading || (latest && autoOpen) || (lookUp && recent.loading)) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <Dots label="불러오는 중" />
      </div>
    );
  }

  if (d.view) return <Conversation d={d} part={part} />;

  if (d.org.role === "admin") {
    return (
      <Centered title="운영 화면에서 기준값과 사례 시험을 봅니다">
        <p>찾기는 배출 기업 계정으로 시작합니다. 진행 중인 찾기가 생기면 여기에서 상태를 볼 수 있습니다.</p>
        <Link href={`${basePath}/admin`} className={buttonClass("secondary", "md", "mt-6")}>
          운영 화면 열기
        </Link>
      </Centered>
    );
  }

  if (d.org.role === "vendor") return <VendorEmpty error={d.error ?? recent.error} />;

  // 찾기의 하위 화면(승인, 서류 …)은 연 찾기가 있어야 보인다. 없으면 찾기 첫 화면으로 보낸다
  if (part !== "main") {
    return (
      <Centered title={FIND_PARTS.find((item) => item.part === part)?.label ?? "찾기"}>
        <p>{latest ? "지금 연 찾기가 없습니다. 지난번에 찾은 결과를 열면 여기에서 볼 수 있습니다." : "아직 연 찾기가 없습니다. 받아 줄 곳을 먼저 찾아 주세요."}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {latest ? (
            <button type="button" onClick={() => setSessionId(latest.id)} className={buttonClass("secondary", "md")}>
              지난번에 찾은 결과 보기
            </button>
          ) : null}
          <Link href={findHref(basePath, "main")} className={buttonClass(latest ? "ghost" : "secondary", "md")}>
            찾기 화면으로
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <Start
      busy={d.busy}
      error={d.sessionId ? null : (d.error ?? recent.error)}
      onFind={d.find}
      onResume={latest ? () => setSessionId(latest.id) : undefined}
    />
  );
}
