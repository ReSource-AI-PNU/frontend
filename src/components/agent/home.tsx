"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
import { useRemote } from "@/components/v3/use-remote";
import { api } from "@/lib/v3/api";
import { loadVendorProfile } from "@/components/v3/materials-view";
import { useDiagnosis } from "@/components/v3/use-diagnosis";
import { Conversation, Dots } from "./conversation";
import { Start } from "./start";

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-balance">{title}</h1>
      <div className="mt-3 max-w-[520px] text-ink-2">{children}</div>
    </div>
  );
}

/** 처리 업체가 아직 받은 문의가 없을 때. 허가증과 매입 기준표가 없으면 그것부터 올리게 한다. */
function VendorEmpty({ error }: { error: string | null }) {
  const { org, mode, readOnly, basePath } = useV3();
  const profile = useRemote(`vendor:${org.id}`, mode === "live", () => loadVendorProfile(org.id, org.name));
  const ready = Boolean(profile.data && (profile.data.permits.length > 0 || profile.data.criteria.length > 0));
  if (profile.loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <Dots label="불러오는 중" />
      </div>
    );
  }
  return (
    <Centered title={ready ? "아직 들어온 문의가 없습니다" : "허가증과 매입 기준표를 올려 주세요"}>
      <p>
        {ready
          ? "배출 기업이 찾기를 시작하면, 허가 품목과 매입 기준에 맞는 물량이 여기에 나타납니다. AI가 매입 기준표의 조건으로 먼저 답하고, 확정은 담당자가 합니다."
          : "허가 품목과 매입 기준이 있어야 맞는 물량 문의가 들어옵니다. 문서를 올리면 값을 뽑아 드리고, 담당자가 확인한 값만 씁니다."}
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-loss-bg px-4 py-3 text-sm text-loss">
          {error}
        </p>
      ) : null}
      <Link
        href={`${basePath}/materials`}
        className={buttonClass(ready || readOnly ? "secondary" : "primary", "md", "mt-6 !min-h-12")}
      >
        {ready ? "업체 정보 보기" : "허가증·매입 기준표 올리기"}
      </Link>
    </Centered>
  );
}

/** 에이전트 화면의 첫 화면. 보는 회사의 종류와 진단 유무에 따라 한 가지만 보여 준다. */
export function AgentHome() {
  const { mode, readOnly, basePath, setSessionId, dropSession, failedSessions } = useV3();
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

  if (d.view) return <Conversation d={d} />;

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

  return (
    <Start
      busy={d.busy}
      error={d.sessionId ? null : (d.error ?? recent.error)}
      onFind={d.find}
      onResume={latest ? () => setSessionId(latest.id) : undefined}
    />
  );
}
