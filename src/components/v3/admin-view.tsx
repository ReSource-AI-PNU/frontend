"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/v3/api";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

/** 모양이 정해지지 않은 응답을 키와 값으로 풀어 보여 준다. */
function KeyValues({ data }: { data: unknown }) {
  if (data === null || typeof data !== "object") {
    return <p className="font-mono text-sm">{String(data)}</p>;
  }
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-[13px] text-muted">{key}</dt>
          <dd className="min-w-0">
            {value !== null && typeof value === "object" ? (
              <pre className="max-h-56 overflow-auto rounded-md bg-sunken p-2 text-[12px]">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <span className="font-mono">{value === null ? "확인 필요" : String(value)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminView() {
  const { mode, org } = useV3();
  const live = mode === "live";
  const status = useRemote(`admin:${org.id}`, live, () => api.adminStatus(org.id));
  const [evalState, setEvalState] = useState<{ busy: boolean; result: unknown; error: string | null }>({
    busy: false,
    result: null,
    error: null,
  });

  const runEval = async () => {
    setEvalState({ busy: true, result: null, error: null });
    try {
      setEvalState({ busy: false, result: await api.adminEval(org.id), error: null });
    } catch (error) {
      setEvalState({
        busy: false,
        result: null,
        error: error instanceof Error ? error.message : "사례 시험을 실행하지 못했습니다.",
      });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-h1">관리자</h1>
        <p className="mt-1 text-sm text-muted">기준값과 법령 색인 상태, 사례 시험, 재학습 결과를 봅니다.</p>
      </header>

      <section className="rounded-lg border border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h2">기준값·법령 색인 상태</h2>
          <Button size="sm" variant="secondary" disabled={!live} onClick={status.reload}>
            다시 읽기
          </Button>
        </div>
        <div className="mt-3">
          {!live && mode !== "loading" ? (
            <p className="text-sm text-muted">백엔드에 연결되지 않아 상태를 읽을 수 없습니다. 예시 값은 만들지 않습니다.</p>
          ) : status.loading ? (
            <p className="text-sm text-muted">불러오는 중입니다.</p>
          ) : status.error ? (
            <p className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">{status.error}</p>
          ) : (
            <KeyValues data={status.data} />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-h2">사례 시험</h2>
            <p className="mt-1 text-sm text-muted">고정 사례로 판정 일치율과 근거 검증기 통과율을 잽니다.</p>
          </div>
          <Button size="sm" variant="secondary" disabled={!live || evalState.busy} onClick={runEval}>
            {evalState.busy ? "실행 중" : "사례 시험 실행"}
          </Button>
        </div>
        <div className="mt-3">
          {evalState.error ? (
            <p className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">{evalState.error}</p>
          ) : evalState.result !== null ? (
            <KeyValues data={evalState.result} />
          ) : (
            <p className="text-sm text-muted">아직 실행한 결과가 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h2">재학습 결과</h2>
        <EmptyState
          title="재학습 기록이 없습니다"
          description="사람이 고친 박스·재질·출처와, 업체가 확정 뒤 기록한 실제 등급·단가가 쌓이면 Azure ML 재학습 결과(모델 비교와 배포 게이트)가 이 표에 나옵니다. v3 API 계약에 재학습 결과 경로가 아직 없어 지금은 보여 줄 데이터가 없습니다."
        />
      </section>
    </div>
  );
}
