"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { api } from "@/lib/v3/api";
import type { MemoryInspection, MemoryStream, OrgMemory } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

/**
 * 우리 회사 기록(자료 화면 맨 아래, 배출 기업만). 지난 찾기와 거래에서 남은 기록을 회사 단위로 모아 보인다.
 * 백엔드 app/v3/memory.py가 이미 남은 기록(질문 답, 업체 검수, 담당자 교정, 확정 거래)을 묶은 것이고 새 숫자를 만들지 않는다.
 * 요약 먼저, 건별 표는 "상세 보기"로 접는다. 담당자가 움직여야 하는 것(모름으로 남은 답, 합의보다 낮게 나온 폐기물)은 접지 않는다.
 */

const num = "font-mono tabular-nums";
const chip = "inline-flex h-[24px] items-center rounded-full px-2.5 text-[12.5px] font-semibold";

function StatusChip({ summary }: { summary: MemoryStream["inspections"] }) {
  if (summary.status === "below") return <span className={`${chip} bg-warn-bg text-warn`}>합의보다 낮게 나옴</span>;
  if (summary.status === "as_agreed") return <span className={`${chip} bg-ink text-on-ink`}>합의대로</span>;
  if (summary.status === "few") return <span className={`${chip} bg-sunken text-ink-2`}>기록이 적어 참고만</span>;
  return null;
}

function Compare({ value }: { value: MemoryInspection["grade"] }) {
  if (value === "lower") return <span className="ml-1 text-[12px] font-semibold text-warn">낮음</span>;
  if (value === "higher") return <span className="ml-1 text-[12px] text-muted">높음</span>;
  return null;
}

function InspectionTable({ rows }: { rows: MemoryInspection[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[13.5px]">
        <thead className="text-[12.5px] text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">검수일</th>
            <th className="py-2 pr-3 font-medium">업체</th>
            <th className="py-2 pr-3 font-medium">등급 (합의 → 실제)</th>
            <th className="py-2 font-medium">단가 (합의 → 실제)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.inspectionId} className="border-b border-line align-top last:border-0">
              <td className={`py-2 pr-3 ${num}`}>{row.inspectedOn}</td>
              <td className="py-2 pr-3">{row.vendorName ?? "업체"}</td>
              <td className="py-2 pr-3">
                {row.agreedGrade ?? "확인 필요"} → {row.actualGrade ?? "기록 없음"}
                <Compare value={row.grade} />
              </td>
              <td className="py-2">
                {row.agreedPrice ? <ClaimValue claim={row.agreedPrice} /> : "확인 필요"} →{" "}
                {row.actualPrice ? <ClaimValue claim={row.actualPrice} /> : "기록 없음"}
                <Compare value={row.price} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function answerText(answer: MemoryStream["answers"][number]) {
  if (answer.unknown) return answer.stillUnknown ? "모름 (아직 비어 있음)" : "모름 (뒤에 채움)";
  if (answer.answer == null) return "기록 없음";
  return `${answer.answer}${answer.unit ? ` ${answer.unit}` : ""}`;
}

function StreamDetail({ stream }: { stream: MemoryStream }) {
  const summary = stream.inspections;
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{stream.name}</h3>
        <StatusChip summary={summary} />
      </div>
      {summary.count > 0 ? (
        <p className="mt-1 text-[13px] text-muted">
          검수 <span className={num}>{summary.count}</span>건 · 합의보다 낮게 나온 건{" "}
          <span className={num}>{summary.below}</span>건.
          {summary.status === "few" ? (
            <>
              {" "}
              검수가 <span className={num}>{summary.minRecords}</span>건 이상 쌓이면 계약 검토에서 합의와 견줘 확인합니다.
            </>
          ) : null}
        </p>
      ) : null}
      <InspectionTable rows={stream.inspectionRows} />
      {stream.answers.length > 0 ? (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-ink-2">지난 찾기에서 답한 것</p>
          <ul className="mt-1 space-y-1 text-[13.5px]">
            {stream.answers.map((answer) => (
              <li key={`${answer.streamId}-${answer.field}`}>
                {answer.label}: <span className={answer.unknown ? "text-warn" : ""}>{answerText(answer)}</span>
                {answer.answeredOn ? (
                  <span className="text-muted">
                    {" "}
                    · <span className={num}>{answer.answeredOn}</span> 찾기
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {stream.corrections.length > 0 ? (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-ink-2">담당자가 고친 판정</p>
          <ul className="mt-1 space-y-1 text-[13.5px]">
            {stream.corrections.map((fix) => (
              <li key={fix.id}>
                {fix.label}: <span className="text-muted line-through">{fix.before ?? "없음"}</span> → {fix.after ?? "없음"}
                <span className="text-muted">
                  {" "}
                  · <span className={num}>{fix.recordedOn}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MemoryBody({ memory, onToggle }: { memory: OrgMemory; onToggle: (next: boolean) => Promise<void> }) {
  const { canWrite, readOnly } = useV3();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = memory.summary;
  const empty = s.inspections + s.answers + s.corrections + s.deals === 0;
  const below = memory.streams.filter((stream) => stream.inspections.status === "below");
  const unknown = memory.streams.flatMap((stream) =>
    stream.answers.filter((a) => a.stillUnknown).map((a) => ({ ...a, name: stream.name })),
  );

  if (empty) {
    return (
      <p className="mt-4 text-sm text-muted">
        아직 쌓인 기록이 없습니다. 찾기에서 질문에 답하고, 확정한 거래의 검수 결과를 업체가 기록하면 여기에 모입니다.
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-[15px] text-ink-2">
        검수 <span className={num}>{s.inspections}</span>건 · 거래한 업체 <span className={num}>{s.vendors}</span>곳 ·
        지난 답변 <span className={num}>{s.answers}</span>개 · 담당자 교정 <span className={num}>{s.corrections}</span>건
      </p>

      {below.length > 0 ? (
        <div role="status" className="mt-4 rounded-md bg-warn-bg px-4 py-3 text-sm text-warn">
          {below.map((stream) => stream.name).join(", ")}: 지난 검수에서 합의한 등급이나 단가보다 낮게 나온 건이 절반
          이상입니다. 같은 업체와 다시 합의하면 계약 검토 담당이 승인 전에 반입 검수 조건을 확인하도록 요청합니다.
        </div>
      ) : null}

      {unknown.length > 0 ? (
        <div className="mt-4 rounded-md bg-warn-bg px-4 py-3 text-sm text-warn">
          <p className="font-semibold">
            &lsquo;모름&rsquo;으로 남은 답이 <span className={num}>{unknown.length}</span>개 있습니다
          </p>
          <p className="mt-1">
            모름으로 답한 항목은 다음 찾기에서 다시 묻지 않습니다. 위 폐기물 카드에서 값을 적어 두면 다음 찾기부터
            씁니다.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {unknown.map((a) => (
              <li key={`${a.streamId}-${a.field}`}>
                {a.name} · {a.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MoreDetails className="mt-3" hint={`폐기물 ${memory.streams.length}개`}>
        <div className="divide-y divide-line">
          {memory.streams.map((stream) => (
            <StreamDetail key={stream.streamId} stream={stream} />
          ))}
        </div>
        {memory.deals.length > 0 ? (
          <div className="border-t border-line py-5">
            <p className="text-[13px] font-medium text-ink-2">함께 확정한 업체</p>
            <ul className="mt-1 space-y-1 text-[13.5px]">
              {memory.deals.map((deal) => (
                <li key={deal.vendorOrgId}>
                  {deal.vendorName ?? "업체"} · 확정 <span className={num}>{deal.count}</span>번
                  {deal.lastOn ? (
                    <span className="text-muted">
                      {" "}
                      · 마지막 <span className={num}>{deal.lastOn}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </MoreDetails>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <p className="text-[13.5px] text-ink-2">
          {memory.enabled
            ? "이 기록을 계약 검토에 씁니다."
            : "이 기록을 계약 검토에 쓰지 않습니다. 기록은 그대로 남습니다."}
        </p>
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onToggle(!memory.enabled);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "바꾸지 못했습니다. 다시 시도해 주세요.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {memory.enabled ? "계약 검토에 쓰지 않기" : "다시 쓰기"}
          </Button>
        ) : readOnly ? (
          <p className="text-[13px] text-muted">체험 중에는 바꿀 수 없습니다.</p>
        ) : null}
        {error ? (
          <p role="alert" className="w-full text-sm text-loss">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function CompanyMemory() {
  const { mode, org } = useV3();
  const remote = useRemote(`memory:${org.id}`, mode === "live" && org.role === "emitter", () =>
    api.getMemory(org.id),
  );
  if (org.role !== "emitter" || mode !== "live") return null;
  return (
    <section aria-labelledby="company-memory-title" className="mt-12 border-t border-line pt-8">
      <h2 id="company-memory-title" className="text-[20px] leading-[1.35] font-semibold tracking-[-0.02em]">
        우리 회사 기록
      </h2>
      <p className="mt-1 text-sm text-muted">
        지난 찾기와 거래에서 남은 기록을 회사 단위로 모았습니다. 판정 숫자를 바꾸지 않고, 같은 업체와 다시 거래할 때
        계약 검토 담당이 지난 검수를 확인하는 데 씁니다.
      </p>
      {remote.loading ? <p className="mt-4 text-sm text-muted">기록을 불러오는 중입니다.</p> : null}
      {remote.error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-loss">
            잠시 연결이 원활하지 않습니다. 다시 시도해 주세요.
          </p>
          <Button variant="secondary" size="sm" onClick={remote.reload}>
            다시 시도
          </Button>
        </div>
      ) : null}
      {remote.data ? (
        <MemoryBody
          memory={remote.data}
          onToggle={async (next) => {
            remote.set(await api.putMemory(org.id, next));
          }}
        />
      ) : null}
    </section>
  );
}
