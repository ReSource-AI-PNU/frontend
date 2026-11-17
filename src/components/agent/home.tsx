"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
import { useDiagnosis } from "@/components/v3/use-diagnosis";
import { Conversation } from "./conversation";
import { Start } from "./start";

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em] text-balance">{title}</h1>
      <div className="mt-3 max-w-[520px] text-ink-2">{children}</div>
    </div>
  );
}

/** 에이전트 화면의 첫 화면. 보는 회사의 역할과 진단 유무에 따라 한 가지만 보여 준다. */
export function AgentHome() {
  const { orgs, mode, fixture } = useV3();
  const d = useDiagnosis();

  if (d.loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <span className="lane lane-run block h-[3px] w-40 rounded-full" role="status" aria-label="불러오는 중" />
      </div>
    );
  }

  if (d.view) return <Conversation d={d} />;

  if (d.org.role === "admin") {
    return (
      <Centered title="운영 화면에서 기준값과 사례 시험을 봅니다">
        <p>찾기는 배출 기업 관점에서 시작합니다. 왼쪽 아래 ‘보는 회사’를 바꿔 보세요.</p>
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
          있습니다. ‘보는 회사’를 그쪽으로 바꾸거나 서버를 띄우고 다시 연결하세요.
        </p>
      </Centered>
    );
  }

  return (
    <>
      {d.error ? (
        <p role="alert" className="border-b border-line bg-loss-bg px-5 py-2.5 text-sm text-loss">
          {d.error}{" "}
          <button type="button" className="font-semibold underline" onClick={d.forget}>
            저장된 찾기 번호 지우기
          </button>
        </p>
      ) : null}
      <Start busy={d.busy} error={null} onFind={d.find} />
    </>
  );
}
