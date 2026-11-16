"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/v3/api";
import {
  THREAD_LABEL,
  formatDateTime,
  formatNumber,
  formatSignedPrice,
  modelLabel,
  rejectionLabel,
} from "@/lib/v3/format";
import type { Assignment, Outcome, OutcomeInput } from "@/lib/v3/types";
import { BlockedNotice } from "./blocked-notice";
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

const GRADES = ["A", "B", "C", "등외"];
const field = "min-h-[34px] rounded-md border border-line-strong bg-surface px-2 text-sm";

/** 업체가 기록한 실제 결과. 사람이 적은 값이라 먹색 점으로 표시하고, 값마다 근거(사람 확인)가 열린다. */
function OutcomeTable({ outcomes, streamName }: { outcomes: Outcome[]; streamName: (id: string) => string }) {
  const { openEvidence } = useV3();
  const link = "font-mono font-semibold underline decoration-line-strong decoration-dotted underline-offset-4";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-ink text-left text-muted">
            <th className="py-1 pr-3 font-semibold">흐름</th>
            <th className="py-1 pr-3 font-semibold">검수일</th>
            <th className="py-1 pr-3 font-semibold">실제 등급</th>
            <th className="py-1 pr-3 text-right font-semibold">실제 단가</th>
            <th className="py-1 pr-3 text-right font-semibold">실제 중량</th>
            <th className="py-1 pr-3 text-right font-semibold">매입 기준표 단가</th>
            <th className="py-1 text-right font-semibold">기준표 대비</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((item) => (
            <tr key={item.id} className="border-b border-line align-top last:border-b-0">
              <td className="py-1.5 pr-3">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
                  {streamName(item.streamId)}
                </span>
                {item.note ? <span className="text-muted">{item.note}</span> : null}
              </td>
              <td className="py-1.5 pr-3 font-mono">{item.inspectedOn}</td>
              <td className="py-1.5 pr-3">
                {item.actualGrade ? (
                  <button
                    type="button"
                    className={link}
                    disabled={!item.evidence.grade}
                    onClick={() => openEvidence(item.evidence.grade ? [item.evidence.grade] : [], "실제 등급")}
                  >
                    {item.actualGrade}
                  </button>
                ) : (
                  <span className="text-muted">기록 없음</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {item.actualUnitPriceKrwPerKg !== null ? (
                  <button
                    type="button"
                    className={link}
                    disabled={!item.evidence.unitPrice}
                    onClick={() => openEvidence(item.evidence.unitPrice ? [item.evidence.unitPrice] : [], "실제 단가")}
                  >
                    {formatSignedPrice(item.actualUnitPriceKrwPerKg)}
                  </button>
                ) : (
                  <span className="text-muted">기록 없음</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {item.actualKg !== null ? (
                  <button
                    type="button"
                    className={link}
                    disabled={!item.evidence.kg}
                    onClick={() => openEvidence(item.evidence.kg ? [item.evidence.kg] : [], "실제 중량")}
                  >
                    {formatNumber(item.actualKg)} kg
                  </button>
                ) : (
                  <span className="text-muted">기록 없음</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {item.tablePrice ? <ClaimValue claim={item.tablePrice} price /> : <span className="text-muted">-</span>}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">
                {item.deviation ? <ClaimValue claim={item.deviation} signed /> : <span className="text-muted">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 업체의 실제 결과 입력(확정된 대화에만). 검수에서 나온 실제 등급·단가·중량을 적으면 재학습 데이터가 된다.
 * 단가는 배출 기업 기준 부호로 보낸다: 매입이면 양수, 처리비면 음수.
 */
function OutcomeForm({
  threadId,
  rows,
  streamName,
  today,
  onSubmit,
}: {
  threadId: string;
  rows: Assignment[];
  streamName: (id: string) => string;
  today: string;
  onSubmit: (body: OutcomeInput) => Promise<void>;
}) {
  const [streamId, setStreamId] = useState(rows[0]?.streamId ?? "");
  const agreed = rows.find((item) => item.streamId === streamId)?.unitPrice?.value;
  const [grade, setGrade] = useState("");
  const [side, setSide] = useState<"매입" | "처리비" | null>(null);
  const [price, setPrice] = useState("");
  const [kg, setKg] = useState("");
  const [inspectedOn, setInspectedOn] = useState(today);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string | null; done: boolean }>({
    busy: false,
    error: null,
    done: false,
  });
  // 고르지 않았으면 합의한 단가의 방향을 따른다
  const sideNow = side ?? (typeof agreed === "number" && agreed < 0 ? "처리비" : "매입");
  const priceValue = price.trim() === "" ? null : Number(price);
  const kgValue = kg.trim() === "" ? null : Number(kg);
  const valid =
    Boolean(streamId) &&
    Boolean(inspectedOn) &&
    (grade !== "" || priceValue !== null) &&
    (priceValue === null || (Number.isFinite(priceValue) && priceValue >= 0)) &&
    (kgValue === null || (Number.isFinite(kgValue) && kgValue >= 0));
  const send = async () => {
    setState({ busy: true, error: null, done: false });
    try {
      await onSubmit({
        threadId,
        streamId,
        actualGrade: grade || null,
        actualUnitPriceKrwPerKg: priceValue === null ? null : sideNow === "처리비" ? -priceValue : priceValue,
        actualKg: kgValue,
        inspectedOn,
        note: note.trim() || undefined,
      });
      setGrade("");
      setPrice("");
      setKg("");
      setNote("");
      setState({ busy: false, error: null, done: true });
    } catch (error) {
      setState({
        busy: false,
        error: error instanceof Error ? error.message : "기록하지 못했습니다.",
        done: false,
      });
    }
  };
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 font-semibold">
          흐름
          <select value={streamId} onChange={(event) => setStreamId(event.target.value)} className={field}>
            {rows.map((item) => (
              <option key={item.streamId} value={item.streamId}>
                {streamName(item.streamId)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          검수일
          <input
            type="date"
            value={inspectedOn}
            onChange={(event) => setInspectedOn(event.target.value)}
            className={`${field} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          실제 등급
          <select value={grade} onChange={(event) => setGrade(event.target.value)} className={field}>
            <option value="">기록 안 함</option>
            {GRADES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          실제 단가 (원/kg)
          <span className="flex gap-1">
            <select
              value={sideNow}
              aria-label="단가 방향"
              onChange={(event) => setSide(event.target.value as "매입" | "처리비")}
              className={field}
            >
              <option>매입</option>
              <option>처리비</option>
            </select>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              aria-label="실제 단가"
              className={`${field} w-24 font-mono`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          실제 중량 (kg)
          <input
            value={kg}
            onChange={(event) => setKg(event.target.value)}
            inputMode="decimal"
            className={`${field} w-24 font-mono`}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 font-semibold">
          메모 (선택)
          <input value={note} onChange={(event) => setNote(event.target.value)} className={field} />
        </label>
        <Button size="sm" variant="secondary" disabled={!valid || state.busy} onClick={send}>
          {state.busy ? "기록 중" : "실제 결과 기록"}
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        실제 등급이나 실제 단가 가운데 하나는 적어야 합니다. 같은 흐름과 검수일로 다시 기록하면 앞의 기록을 고친 새
        판이 됩니다. 기록은 배출 기업도 봅니다.
      </p>
      {state.error ? (
        <p role="alert" className="mt-2 rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      {state.done ? <p className="mt-2 text-[13px] font-semibold">실제 결과를 기록했습니다.</p> : null}
    </div>
  );
}

/** 양쪽 담당자 승인. 근거 확인에 실패한 항목이 있으면 승인 버튼을 끈다. */
export function ApprovalView() {
  const d = useDiagnosis();
  const { mode, org } = useV3();
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
  // 승인 칸은 합의·확정 대화에만 있다. 담당자에게 넘어갔거나 거절된 대화는 사유와 함께 따로 적는다
  const closed = view.threads.filter((item) => item.status === "handoff" || item.status === "declined");
  const ended = view.session.status === "idle" && view.session.phase === "done";
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
      {closed.length > 0 ? (
        <section className="rounded-lg border border-line p-5">
          <h2 className="text-h2">승인 대상이 아닌 대화</h2>
          <p className="mt-1 text-sm text-muted">
            담당자에게 넘어갔거나 거절로 닫힌 대화에는 승인 칸이 없습니다. 사유를 확인하고 담당자가 직접 처리합니다.
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {closed.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="font-semibold">{item.vendorName}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${item.status === "declined" ? "bg-loss-bg text-loss" : "bg-warn-bg text-warn"}`}
                >
                  {THREAD_LABEL[item.status]}
                </span>
                <span className="text-muted">{item.streamIds.map(streamName).join(", ")}</span>
                <span className="basis-full text-ink-2">{item.statusReason ?? "사유가 기록되지 않았습니다."}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.approvals.length === 0 ? (
        <EmptyState
          title={ended ? "승인할 합의가 남지 않았습니다" : "승인 대기 중인 합의가 없습니다"}
          description={
            ended
              ? "합의 없이 끝났거나 합의한 대화가 모두 담당자에게 넘어갔습니다. 진단·연결 화면에서 사유를 확인하세요."
              : "에이전트 대화에서 합의가 나오면 여기에 나타납니다."
          }
        />
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
        const outcomes = view.feedback.outcomes.filter((item) => item.threadId === approval.threadId);
        const confirmed = thread?.status === "confirmed";
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
            {blocked ? (
              <div className="mt-3">
                <BlockedNotice
                  codes={approval.blockedCodes}
                  reason={reason}
                  canRerun={role === "emitter" && d.canAct}
                  busy={d.busy || view.session.status === "running"}
                  onRerun={d.run}
                />
              </div>
            ) : null}
            {failed.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[13px] text-loss">
                {failed.map((message) => (
                  <li key={message.id}>
                    ✕ {message.seq}번째 메시지 근거 확인 실패
                    {(message.validation.rejections ?? []).map((rejection, index) => (
                      <span key={index} className="block pl-4 text-ink-2">
                        <span className="font-mono">{rejection.code}</span>{" "}
                        {rejectionLabel(rejection.code, rejection.message)}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
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
            {confirmed && (outcomes.length > 0 || role === "vendor") ? (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-label text-muted">실제 결과 (검수 뒤 업체가 기록)</h3>
                {outcomes.length > 0 ? (
                  <div className="mt-2">
                    <OutcomeTable outcomes={outcomes} streamName={streamName} />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted">아직 기록한 실제 결과가 없습니다.</p>
                )}
                {role === "vendor" && d.canAct && rows.length > 0 ? (
                  <OutcomeForm
                    key={approval.threadId}
                    threadId={approval.threadId}
                    rows={rows}
                    streamName={streamName}
                    today={view.session.today}
                    onSubmit={async (body) => {
                      await api.recordOutcome(view.session.id, org.id, body);
                      d.reload();
                    }}
                  />
                ) : null}
              </div>
            ) : null}
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
