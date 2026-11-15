"use client";
import { useState } from "react";
import Link from "next/link";
import type { State } from "@/lib/platform/client";

export const steps = [
  ["classify", "식별·분류"],
  ["feasibility", "경로 판정"],
  ["regulation", "규정 검토"],
  ["matching", "업체·묶음"],
  ["cost-carbon", "비용·탄소"],
  ["proposal", "이행안"],
] as const;
const button =
  "min-h-11 rounded border border-line-strong px-4 py-2 text-sm disabled:opacity-40";
const money = (v: number | null | undefined) =>
  v == null ? "자료 없음" : `${v.toLocaleString("ko-KR")}원`;
export function Stages({
  state,
  step,
  busy,
  act,
  mutate,
}: {
  state: State;
  step?: string;
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
  mutate: (path: string, body: object) => Promise<void>;
}) {
  const s = state.session;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [route, setRoute] = useState("A");
  return (
    <section className="my-6 space-y-4" aria-label="단계 실행">
      <nav aria-label="진단 단계" className="flex flex-wrap gap-2">
        {steps.map(([id, label], i) => (
          <Link
            key={id}
            href={`/session/${s.id}/${id}`}
            aria-current={step === id ? "step" : undefined}
            className={`${button} ${step === id ? "bg-ink text-bg" : ""}`}
          >
            {i + 1}. {label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted">
        현재 단계: {steps.find(([id]) => id === s.step)?.[1]} · 상태:{" "}
        {s.approval
          ? "승인 완료"
          : s.status === "awaiting-approval"
            ? "승인 대기"
            : "검토 중"}
      </p>
      {!s.approval && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              act(() => mutate("advance", { step: step ?? "proposal" }))
            }
          >
            {step ? "이 단계까지 실행" : "전체 단계 이어서 실행"}
          </button>
          {step === "classify" && (
            <button
              disabled={busy}
              className={button}
              onClick={() => act(() => mutate("classify", {}))}
            >
              식별 서비스로 재검토
            </button>
          )}
        </div>
      )}
      {s.questions
        .filter(
          (q) => !q.id.startsWith("volume:") && (!step || q.step === step),
        )
        .map((q) => (
          <form
            key={q.id}
            className="space-y-2 border-l-2 border-ink pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                mutate("questions", {
                  questionId: q.id,
                  answer: answers[q.id] ?? "",
                }),
              );
            }}
          >
            <label className="grid gap-2">
              {q.text}
              {q.kind === "choice" ? (
                <select
                  required
                  className={button}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                >
                  <option value="">선택하세요</option>
                  {q.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  className={button}
                  type={q.kind === "number" ? "number" : "text"}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
              )}
            </label>
            <p className="text-sm text-muted">
              {q.why} {q.answer ? `· 확인: ${q.answer}` : ""}
            </p>
            <button className={button} disabled={busy || Boolean(s.approval)}>
              답변 저장
            </button>
          </form>
        ))}
      {step === "classify" && (
        <ul className="space-y-2">
          {s.streams.map((st) => (
            <li key={st.id}>
              {st.name} · {st.classify.material} · {st.origin} · 월{" "}
              {st.monthlyKg}kg ·{" "}
              {st.monthlyKgConfirmed ? "물량 확인 완료" : "물량 확인 필요"}
            </li>
          ))}
        </ul>
      )}
      {s.feasibility && (!step || step === "feasibility") && (
        <div>
          <h3 className="font-semibold">흐름별 경로 판정</h3>
          {s.feasibility.decisions.map((d) => (
            <article className="border-b border-line py-3" key={d.streamId}>
              <b>
                {s.streams.find((st) => st.id === d.streamId)?.name} ·{" "}
                {d.route ?? "추가 정보 필요"}
              </b>
              <p>{d.reason}</p>
              <p className="text-sm">
                현재 {money(d.monthlyNow)} → 변경 후 {money(d.monthlyAfter)}
              </p>
            </article>
          ))}
        </div>
      )}
      {s.regulation && (!step || step === "regulation") && (
        <div>
          <h3 className="font-semibold">규정 검토</h3>
          <p>{s.regulation.conclusion.text}</p>
          {s.regulation.items.map((r) => (
            <article className="border-b border-line py-3" key={r.id}>
              <b>
                {r.label} ·{" "}
                {r.status === "ok"
                  ? "통과"
                  : r.status === "no"
                    ? "불가"
                    : "확인 필요"}
              </b>
              <p>{r.result}</p>
              <p className="text-sm text-muted">
                {r.citation} · {r.excerpt}
              </p>
            </article>
          ))}
        </div>
      )}
      {s.costCarbon && (!step || step === "cost-carbon") && (
        <div>
          <h3 className="font-semibold">비용·탄소 시나리오</h3>
          {s.costCarbon.routes.map((r) => (
            <article key={r.id} className="border-b border-line py-3">
              <b>
                {r.id}. {r.name}
              </b>
              <p>{r.description}</p>
              <p>
                월 {money(r.monthlyKrw)} · 탄소{" "}
                {r.carbonT == null ? "자료 없음" : `${r.carbonT}t`}
              </p>
              <p className="text-sm">{r.condition}</p>
            </article>
          ))}
          {s.costCarbon.assumptions.map((a, i) => (
            <p key={i} className="text-sm text-muted">
              {a.label}: {a.value}
            </p>
          ))}
        </div>
      )}
      {s.proposal && (!step || step === "proposal") && (
        <div className="space-y-3">
          <h3 className="font-semibold">검토할 이행안</h3>
          <p>{s.proposal.summary}</p>
          {s.proposal.documents.map((d) => (
            <details className="border border-line p-3" key={d.id}>
              <summary className="cursor-pointer">
                {d.title} · {d.to} ·{" "}
                {d.external ? "외부 발송 대상" : "내부 검토"}
              </summary>
              <p className="mt-3 whitespace-pre-wrap">{d.body}</p>
              {d.fields.map((f, i) => (
                <p key={i}>
                  {f.label}: {f.value}
                </p>
              ))}
              <button
                type="button"
                className={`${button} mt-3`}
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob(
                      [
                        `${d.title}\n수신: ${d.to}\n\n${d.fields.map((f) => `${f.label}: ${f.value}`).join("\n")}\n\n${d.body}`,
                      ],
                      { type: "text/plain;charset=utf-8" },
                    ),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${d.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                문서 내려받기
              </button>
            </details>
          ))}
          {!s.approval && (
            <>
              <label className="flex gap-2">
                승인 시나리오
                <select
                  aria-label="승인 시나리오"
                  className={button}
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                >
                  {s.costCarbon?.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}. {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                문서와 수신인, 시나리오를 확인했습니다.
              </label>
              <button
                className={button}
                disabled={busy || !confirm}
                onClick={() =>
                  act(() =>
                    mutate("approval", { confirm: true, routeId: route }),
                  )
                }
              >
                이행안 승인·동결
              </button>
            </>
          )}
          {s.approval && (
            <p className="border-l-2 border-ink pl-4">
              {s.approval.approvedBy} 승인 완료 · 시나리오 {s.approval.routeId}{" "}
              · 외부 발송은 아래 발송함에서 별도로 확인하세요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
