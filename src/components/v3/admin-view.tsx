"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api, API_BASE } from "@/lib/v3/api";
import { MESSAGE_LABEL, STATUS_LABEL, THREAD_LABEL, modelLabel } from "@/lib/v3/format";
import type { AdminStatus, EvalResult } from "@/lib/v3/types";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

function Connected({ on, name }: { on: boolean; name: string }) {
  return (
    <span className={on ? "font-semibold text-ink" : "font-semibold text-warn"}>
      {on ? `${name} 연결됨` : `${name} 미연결`}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function StatusBody({ status }: { status: AdminStatus }) {
  const { openEvidence } = useV3();
  const kinds = Object.entries(status.evidence.byKind);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        <Row label="기준일">
          <span className="font-mono">{status.today}</span>
        </Row>
        <Row label="회사 측 에이전트">
          <span className={status.models.company.provider === "rule" ? "font-semibold text-warn" : "font-semibold"}>
            {modelLabel(status.models.company)}
          </span>
          {status.models.llmFactory ? "" : " · 이 서버에는 모델이 연결되지 않았습니다"}
        </Row>
        <Row label="법령 조항">
          <span className="font-mono">{status.laws.count}</span>건 · 최신 기준일{" "}
          <span className="font-mono">{status.laws.latestAsOf ?? "확인 필요"}</span>
        </Row>
        <Row label="볼 수 있는 근거">
          <span className="font-mono">{status.evidence.visible}</span>건 (
          {kinds.map(([kind, count]) => `${kind} ${count}`).join(" · ")})
        </Row>
        <Row label="근거가 없는 기준">
          {status.missingBasis.length === 0 ? (
            "없음"
          ) : (
            <span className="text-warn">
              <span className="font-mono">{status.missingBasis.join(", ")}</span> · 이 값이 필요한 계산은
              &ldquo;확인 필요&rdquo;로 남습니다
            </span>
          )}
        </Row>
        <Row label="외부 서비스">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Connected on={status.promptShields.configured} name="Prompt Shields" />
            <Connected on={status.documentIntelligence.configured} name="Document Intelligence" />
            <Connected on={status.gradeEndpoint.configured} name="등급 모델 엔드포인트" />
            <Connected on={status.distance.provider} name="도로 거리(Azure Maps)" />
          </span>
        </Row>
        <Row label="실행 구성">
          <span className="font-mono text-[13px]">
            {status.vendorGateway} · {status.store}
          </span>
        </Row>
      </dl>
      <div>
        <h3 className="text-label text-muted">기준값 스냅숏 ({status.references.length}건)</h3>
        {status.references.length === 0 ? (
          <p className="mt-1 text-sm text-muted">등록된 기준값이 없습니다.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line text-sm">
            {status.references.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                <button
                  type="button"
                  className="text-left underline decoration-dotted underline-offset-4"
                  onClick={() => openEvidence([item.id], item.label)}
                >
                  {item.label}
                </button>
                <span className="font-mono text-[13px] text-muted">기준일 {item.asOf}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EvalBody({ result }: { result: EvalResult }) {
  const { orgs } = useV3();
  const rate = result.validatorPassRate;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">{result.scenario}</p>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5">
        <Row label="대화를 쓴 구현">
          <span className={result.model.provider === "rule" ? "font-semibold text-warn" : "font-semibold"}>
            {modelLabel(result.model)}
          </span>
          {result.model.provider === "rule" ? " · 모델 호출 없이 돈 결과입니다" : ""}
        </Row>
        <Row label="근거 검증기 통과">
          <span className="font-mono font-semibold">
            {result.passed}/{result.checked}
          </span>
          {rate != null ? <span className="font-mono"> ({(rate * 100).toFixed(1)}%)</span> : null} · 다시 쓴 횟수{" "}
          <span className="font-mono">{result.rewritten}</span>
        </Row>
        <Row label="끝난 상태">
          <span className="font-mono">{result.sessionStatus}</span> · 결과{" "}
          {result.resultStatus ? STATUS_LABEL[result.resultStatus] : "확인 필요"}
        </Row>
      </dl>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-ink text-left text-muted">
            <th className="py-1 pr-3">업체</th>
            <th className="py-1 pr-3">대화 상태</th>
            <th className="py-1 pr-3">답한 구현 (설정)</th>
            <th className="py-1">오간 메시지 종류</th>
          </tr>
        </thead>
        <tbody>
          {result.threads.map((thread, index) => (
            <tr key={index} className="border-b border-line align-top">
              <td className="py-1.5 pr-3 font-semibold">
                {orgs.find((item) => item.id === thread.vendorOrgId)?.name ?? thread.vendorOrgId}
              </td>
              <td className="py-1.5 pr-3">{THREAD_LABEL[thread.status] ?? thread.status}</td>
              <td className="py-1.5 pr-3">
                {modelLabel(thread.vendorModel)}
                {thread.vendorModel.configured ? (
                  <span className="text-muted"> (설정: {modelLabel(thread.vendorModel.configured)})</span>
                ) : null}
              </td>
              <td className="py-1.5">
                {thread.types.length === 0
                  ? "-"
                  : thread.types.map((type) => MESSAGE_LABEL[type] ?? type).join(" → ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminView() {
  const { mode, org, setSessionId, reconnect } = useV3();
  const live = mode === "live";
  const health = useRemote("health", live, () => api.health());
  const status = useRemote(`admin:${org.id}`, live, () => api.adminStatus(org.id));
  const [evalState, setEvalState] = useState<{ busy: boolean; result: EvalResult | null; error: string | null }>({
    busy: false,
    result: null,
    error: null,
  });
  const [reset, setReset] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });

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

  const resetDemo = async () => {
    setReset({ busy: true, note: null });
    try {
      await api.resetDemo(org.id);
      setSessionId(null);
      status.reload();
      setReset({ busy: false, note: "시연 데이터를 처음 상태로 되돌렸습니다. 진행하던 진단은 지워졌습니다." });
    } catch (error) {
      setReset({ busy: false, note: error instanceof Error ? error.message : "되돌리지 못했습니다." });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-h1">관리자</h1>
        <p className="mt-1 text-sm text-muted">기준값과 법령 색인 상태, 사례 시험, 재학습 결과를 봅니다.</p>
      </header>

      <section className="rounded-lg border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2">백엔드 연결</h2>
            <p className="mt-1 text-sm">
              <span className="font-mono text-[13px] break-all">{API_BASE}</span> ·{" "}
              {!live ? (
                <span className="font-semibold text-warn">연결 안 됨 (예시 데이터를 보여 주는 중)</span>
              ) : health.loading ? (
                "확인 중"
              ) : health.error ? (
                <span className="font-semibold text-loss">상태 확인 실패: {health.error}</span>
              ) : (
                <span className="font-semibold">상태 확인 통과 (GET /health)</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={live ? health.reload : reconnect}>
              {live ? "다시 확인" : "다시 연결"}
            </Button>
            <Button size="sm" variant="secondary" disabled={!live || reset.busy} onClick={resetDemo}>
              시연 데이터 처음 상태로
            </Button>
          </div>
        </div>
        {reset.note ? <p className="mt-2 text-[13px] text-ink-2">{reset.note}</p> : null}
      </section>

      <section className="rounded-lg border border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h2">기준값·법령 색인 상태</h2>
          <Button size="sm" variant="secondary" disabled={!live} onClick={status.reload}>
            다시 읽기
          </Button>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          지금 고른 관점({org.name})이 볼 수 있는 근거를 기준으로 셉니다. 색인을 다시 만드는 주소는 v3 API
          계약에 없어 이 화면에서는 상태만 봅니다.
        </p>
        <div className="mt-3">
          {!live ? (
            <p className="text-sm text-muted">백엔드에 연결되지 않아 상태를 읽을 수 없습니다. 예시 값은 만들지 않습니다.</p>
          ) : status.loading ? (
            <p className="text-sm text-muted">불러오는 중입니다.</p>
          ) : status.error ? (
            <p className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">{status.error}</p>
          ) : status.data ? (
            <StatusBody status={status.data} />
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-h2">사례 시험</h2>
            <p className="mt-1 text-sm text-muted">
              시연 시나리오를 따로 만든 저장소에서 처음부터 끝까지 돌리고, 나간 메시지와 문서를 다시 검증해
              근거 검증기 통과율을 냅니다. 진행 중인 진단은 바뀌지 않습니다.
            </p>
          </div>
          <Button size="sm" variant="secondary" disabled={!live || evalState.busy} onClick={runEval}>
            {evalState.busy ? "실행 중" : "사례 시험 실행"}
          </Button>
        </div>
        <div className="mt-3">
          {evalState.error ? (
            <p className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">{evalState.error}</p>
          ) : evalState.result ? (
            <EvalBody result={evalState.result} />
          ) : (
            <p className="text-sm text-muted">아직 실행한 결과가 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h2">재학습 결과</h2>
        <EmptyState
          title="재학습 기록이 없습니다"
          description="사람이 고친 박스·재질·출처와, 업체가 확정 뒤 기록한 실제 등급·단가가 쌓이면 재학습 결과(모델 비교와 배포 게이트)가 이 표에 나옵니다. v3 API 계약에 고친 값·실제 결과를 보내는 주소와 재학습 결과를 읽는 주소가 아직 없어 지금은 보여 줄 데이터가 없습니다."
        />
      </section>
    </div>
  );
}
