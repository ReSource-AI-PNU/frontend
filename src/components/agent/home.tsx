"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
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

/** 에이전트 화면의 첫 화면. 보는 회사의 역할과 진단 유무에 따라 한 가지만 보여 준다. */
export function AgentHome() {
  const { orgs, mode, fixture } = useV3();
  const d = useDiagnosis();
  const stale = Boolean(d.sessionId) && !d.view && !d.loading && Boolean(d.error);
  const { forget } = d;

  // 저장해 둔 찾기 번호가 서버에 없으면(서버를 다시 띄웠을 때 등) 묻지 않고 지우고 첫 화면을 보여 준다
  useEffect(() => {
    if (stale && d.org.role === "emitter") forget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, d.org.role]);

  if (d.loading) {
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
        <p>찾기는 배출 기업으로 볼 때 시작할 수 있습니다. 왼쪽 아래 ‘시연 회사’를 바꿔 보세요.</p>
        <Link href="/app/admin" className={buttonClass("secondary", "md", "mt-6")}>
          운영 화면 열기
        </Link>
      </Centered>
    );
  }

  if (d.org.role === "vendor") {
    return (
      <Centered title="아직 들어온 문의가 없습니다">
        <p>
          배출 기업이 찾기를 시작하면, 매입 기준에 맞는 물량이 여기에 나타납니다. 매입 기준과 허가 품목은 미리 올려 둘 수
          있습니다.
        </p>
        {d.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-loss-bg px-4 py-3 text-sm text-loss">
            {d.error}{" "}
            <button type="button" className="font-semibold underline" onClick={d.forget}>
              지우고 다시 보기
            </button>
          </p>
        ) : null}
        <Link href="/app/materials" className={buttonClass("secondary", "md", "mt-6")}>
          매입 기준 올리기
        </Link>
      </Centered>
    );
  }

  if (mode === "fixture" && d.org.id !== fixture?.meta.emitterOrgId) {
    return (
      <Centered title="이 회사의 예시 데이터가 없습니다">
        <p>
          예시 데이터에는 {orgs.find((item) => item.id === fixture?.meta.emitterOrgId)?.name ?? "배출 기업 한 곳"}의 결과만 들어
          있습니다. ‘시연 회사’를 그쪽으로 바꾸거나 서버를 띄우고 다시 연결하세요.
        </p>
      </Centered>
    );
  }

  return <Start busy={d.busy} error={d.sessionId ? null : d.error} onFind={d.find} />;
}
