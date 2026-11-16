"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { THREAD_LABEL, formatDateTime, modelLabel } from "@/lib/v3/format";
import { ClaimText, ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useDiagnosis } from "./use-diagnosis";

const DOC_LABEL = { request: "요청서", plan: "이행 계획서" } as const;

function Side({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm ${done ? "font-semibold text-ink" : "text-muted"}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${done ? "bg-ink" : "border border-line-strong"}`} />
      {label} {done ? "✓ 승인함" : "승인 전"}
    </span>
  );
}

/** 양쪽 담당자 승인. 근거 확인에 실패한 항목이 있으면 승인 버튼을 끈다. */
export function ApprovalView() {
  const d = useDiagnosis();
  const { mode } = useV3();
  const { view } = d;
  if (d.loading) return <p className="p-8 text-sm text-muted">불러오는 중입니다.</p>;
  if (!view) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {d.error ? (
          <p role="alert" className="mb-4 rounded-md bg-loss-bg px-4 py-3 text-sm text-loss">
            {d.error}
          </p>
        ) : null}
        <EmptyState
          title={mode === "fixture" ? "이 관점의 예시 데이터가 없습니다" : "승인할 진단이 없습니다"}
          description={
            mode === "fixture"
              ? "예시 데이터는 배출 기업 한 곳의 관점만 담고 있습니다. 관점을 바꾸거나 백엔드를 띄우고 다시 연결하세요."
              : "진단·연결 화면에서 진단을 먼저 시작하세요."
          }
        />
      </div>
    );
  }
  const streamName = (id: string) => view.streams.find((item) => item.id === id)?.name ?? id;
  const role = view.viewer.role;
  // 한 화면에 먹색 버튼은 하나만 둔다: 지금 승인할 수 있는 첫 합의에만 쓴다
  const firstActionable = view.approvals.find((approval) => {
    const mine = role === "emitter" ? approval.emitter : approval.vendor;
    return !approval.blocked && !mine;
  })?.threadId;
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-h1">승인</h1>
        <p className="mt-1 text-sm text-muted">
          양쪽 담당자가 모두 승인해야 확정됩니다. 확정 전에는 어떤 문서도 만들지 않습니다. 관점을 바꿔 배출
          기업과 처리 업체 양쪽에서 각각 승인합니다(시연용).
        </p>
      </header>
      {d.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-4 py-3 text-sm text-loss">
          {d.error}
        </p>
      ) : null}
      {view.approvals.length === 0 ? (
        <EmptyState title="승인 대기 중인 합의가 없습니다" description="에이전트 대화에서 합의가 나오면 여기에 나타납니다." />
      ) : null}
      {view.approvals.map((approval) => {
        const thread = view.threads.find((item) => item.id === approval.threadId);
        const failed = thread?.messages.filter((message) => !message.validation.ok) ?? [];
        const rows = (view.result?.assignments ?? []).filter(
          (item) => item.threadId === approval.threadId && approval.streamIds.includes(item.streamId),
        );
        const mine = role === "emitter" ? approval.emitter : role === "vendor" ? approval.vendor : true;
        const blocked = approval.blocked || failed.length > 0;
        const reason =
          approval.blockedReason ??
          (failed.length > 0 ? `근거 확인에 실패한 메시지가 ${failed.length}건 있습니다.` : null);
        return (
          <section key={approval.threadId} className="rounded-lg border border-ink p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-h2">{thread?.vendorName ?? approval.threadId}</h2>
              <span className="text-sm text-muted">{thread ? THREAD_LABEL[thread.status] : ""}</span>
              <div className="ml-auto flex flex-wrap gap-4">
                <Side label="배출 기업" done={approval.emitter} />
                <Side label="처리 업체" done={approval.vendor} />
              </div>
            </div>
            {thread ? (
              <p className="mt-1 text-[13px] text-muted">
                업체 측 답변: {modelLabel(thread.vendorModel)}
                {thread.vendorModel.configured ? ` · 설정: ${modelLabel(thread.vendorModel.configured)}` : ""}
              </p>
            ) : null}
            <div className="mt-3 text-sm">
              <p className="text-label text-muted">
                {approval.emitter && approval.vendor ? "확정한 흐름" : "승인할 흐름"}
              </p>
              {approval.streamIds.length === 0 ? (
                <p className="mt-1 text-muted">이 합의에 배정된 흐름이 없습니다.</p>
              ) : rows.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {rows.map((item) => (
                    <li key={item.streamId} className="flex flex-wrap gap-x-3">
                      <span className="font-semibold">{streamName(item.streamId)}</span>
                      <span>
                        단가 <ClaimValue claim={item.unitPrice} price />
                      </span>
                      {role === "vendor" ? null : (
                        <span>
                          월 <ClaimValue claim={item.monthlyAfter} signed />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-semibold">{approval.streamIds.map(streamName).join(", ")}</p>
              )}
            </div>
            {thread && thread.messages.length > 0 ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted">
                  마지막 메시지 보기 ({thread.messages.length}번째)
                </summary>
                <p className="mt-2 border-l-2 border-line-strong pl-3 text-ink-2">
                  <ClaimText
                    text={thread.messages[thread.messages.length - 1].text}
                    claims={thread.messages[thread.messages.length - 1].claims}
                  />
                </p>
              </details>
            ) : null}
            {blocked && reason ? (
              <p className="mt-3 rounded-md bg-warn-bg px-3 py-2 text-sm font-semibold text-warn">
                승인할 수 없습니다: {reason}
              </p>
            ) : null}
            {role === "admin" ? (
              <p className="mt-4 text-sm text-muted">관리자는 승인하지 않습니다. 상태만 봅니다.</p>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant={approval.threadId === firstActionable ? "primary" : "secondary"}
                  disabled={!d.canAct || d.busy || blocked || mine}
                  onClick={() => d.approve(approval.threadId)}
                >
                  {mine ? "승인했습니다" : `${role === "emitter" ? "배출 기업" : "처리 업체"} 담당자로 승인`}
                </Button>
                {!d.canAct ? (
                  <span className="text-[13px] text-muted">예시 데이터에서는 승인을 보낼 수 없습니다.</span>
                ) : null}
              </div>
            )}
          </section>
        );
      })}

      <section>
        <h2 className="text-h2">요청서와 이행 계획서</h2>
        {view.documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            양쪽 승인이 끝나면 요청서와 이행 계획서가 만들어집니다. 아직 만들어진 문서가 없습니다.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {view.documents.map((document) => (
              <article key={document.id} className="rounded-lg border border-line p-5">
                <p className="text-label text-muted">
                  {DOC_LABEL[document.kind]} · {document.streamIds.map(streamName).join(", ")} ·{" "}
                  <span className="font-mono">{formatDateTime(document.createdAt)}</span>
                </p>
                <h3 className="text-h2">{document.title}</h3>
                {!document.validation.ok ? (
                  <p className="mt-2 rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">
                    근거 확인에 실패한 문서입니다. 내용을 쓰지 마세요.
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] font-semibold">✓ 근거 확인 통과 · 숫자를 누르면 근거가 열립니다</p>
                )}
                <div className="mt-3 text-[15px] leading-relaxed">
                  <ClaimText text={document.text} claims={document.claims} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
