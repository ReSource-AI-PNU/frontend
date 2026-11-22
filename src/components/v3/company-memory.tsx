"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { api } from "@/lib/v3/api";
import type { MemoryInspection, MemoryStream, OrgMemory, VendorMemory } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";
import { navSpot } from "@/components/agent/nav-spot";

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

function InspectionTable({
  rows,
  label = "업체",
  nameOf = (row) => row.vendorName ?? "업체",
}: {
  rows: MemoryInspection[];
  /** 둘째 칸 머리(배출 기업 화면은 업체, 업체 화면은 폐기물) */
  label?: string;
  nameOf?: (row: MemoryInspection) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[13.5px]">
        <thead className="text-[12.5px] text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">검수일</th>
            <th className="py-2 pr-3 font-medium">{label}</th>
            <th className="py-2 pr-3 font-medium">등급 (합의 → 실제)</th>
            <th className="py-2 font-medium">단가 (합의 → 실제)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.inspectionId} className="border-b border-line align-top last:border-0">
              <td className={`py-2 pr-3 ${num}`}>{row.inspectedOn}</td>
              <td className="py-2 pr-3">{nameOf(row)}</td>
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

type MemoryChange = { enabled?: boolean; applyToJudgment?: boolean };

const pct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;

/**
 * 회사 기록을 판정에 반영(개인화). 되돌리기 어려운 판단 기준을 바꾸므로 승인 게이트처럼 먹색 1px 테두리 상자에 둔다.
 * 비율은 자료 화면의 미리 보기이고, 실제 판정에 쓴 값은 결과 카드의 "회사 기록 반영 예상" 단가가 근거와 함께 보인다.
 */
function Calibration({
  memory,
  busy,
  onChange,
}: {
  memory: OrgMemory;
  busy: boolean;
  onChange: (change: MemoryChange) => Promise<void>;
}) {
  const { canWrite, readOnly } = useV3();
  const calibration = memory.calibration;
  if (!calibration) return null;
  const applied = calibration.applied;
  const strength = applied ? applied.strength : calibration.proposedStrength;
  return (
    <div className="mt-6 rounded-xl border border-line-strong px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold">회사 기록을 판정에 반영</p>
        {applied ? <span className={`${chip} bg-ink text-on-ink`}>반영 중</span> : null}
      </div>
      <p className="mt-1 text-[13.5px] text-ink-2">
        지난 검수에서 실제로 받은 단가가 합의와 얼마나 달랐는지로 업체별 예상 단가를 맞춰 업체를 고릅니다. 기록이 적으면
        계약 단가 쪽으로 당기고(검수 <span className={num}>{strength}</span>건 몫), 같은 업체와의 기록이 없으면 이 회사의
        같은 폐기물 기록을 씁니다. 계약 단가와 업체에 보내는 조건은 바뀌지 않고, 업체는 이 보정을 보지 못합니다.
      </p>
      {calibration.streams.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-[13.5px]">
          {calibration.streams.map((stream) => (
            <li key={stream.streamId}>
              <span className="font-medium text-ink">{stream.name}</span>
              <span className="text-muted">
                {" "}
                · 검수 <span className={num}>{stream.records}</span>건
              </span>
              {stream.vendors.map((vendor) => (
                <span key={vendor.vendorOrgId} className="block pl-3 text-ink-2">
                  {vendor.vendorName ?? "업체"}: 예상 단가 <span className={num}>{pct(vendor.ratePct)}</span>
                  <span className="text-muted">
                    {" "}
                    (같은 업체 검수 <span className={num}>{vendor.records}</span>건)
                  </span>
                </span>
              ))}
              {stream.streamRatePct != null ? (
                <span className="block pl-3 text-ink-2">
                  아직 거래하지 않은 업체: 예상 단가 <span className={num}>{pct(stream.streamRatePct)}</span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13.5px] text-muted">
          합의 단가와 실제 단가를 견줄 검수 기록이 생기면 반영할 수 있습니다.
        </p>
      )}
      <p className="mt-2 text-[12.5px] text-muted">
        {applied
          ? `${applied.approvedOn}에 담당자가 승인했습니다. 다음 찾기부터 판정에 씁니다.`
          : "비율은 계약 단가 대비 미리 보기입니다. 승인하면 다음 찾기부터 판정에 쓰고, 승인 기록이 근거로 남습니다."}
      </p>
      {canWrite ? (
        memory.enabled ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={busy || (!applied && calibration.streams.length === 0)}
            onClick={() => onChange({ applyToJudgment: !applied })}
          >
            {applied ? "반영 멈추기" : "판정에 반영하기"}
          </Button>
        ) : (
          <p className="mt-3 text-[13px] text-muted">아래에서 기록 사용을 다시 켜야 반영할 수 있습니다.</p>
        )
      ) : readOnly ? (
        <p className="mt-3 text-[13px] text-muted">체험 중에는 바꿀 수 없습니다.</p>
      ) : null}
    </div>
  );
}

function MemoryBody({ memory, onChange }: { memory: OrgMemory; onChange: (change: MemoryChange) => Promise<void> }) {
  const { canWrite, readOnly } = useV3();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (change: MemoryChange) => {
    setBusy(true);
    setError(null);
    try {
      await onChange(change);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "바꾸지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
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

      <Calibration memory={memory} busy={busy} onChange={(change) => run(change)} />

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <p className="text-[13.5px] text-ink-2">
          {memory.enabled
            ? "이 기록을 계약 검토와 회사 측 AI의 문의에 씁니다."
            : "이 기록을 계약 검토와 판정에 쓰지 않습니다. 기록은 그대로 남습니다."}
        </p>
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => run({ enabled: !memory.enabled })}
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
    <section aria-labelledby="company-memory-title" {...navSpot("memory", "우리 회사 기록", "기록")} className="mt-12 border-t border-line pt-8">
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
          onChange={async (change) => {
            remote.set(await api.putMemory(org.id, change));
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * 처리 업체의 기록(자료 화면 맨 아래, 업체만). 자기가 기록한 검수를 배출 기업별로 합의와 견줘 보인다.
 * 판정에 쓰지 않고 보여 주기만 한다. 같은 기록은 배출 기업의 계약 검토(지난 검수 기록)에도 보인다.
 */
function VendorMemoryBody({ memory }: { memory: VendorMemory }) {
  const s = memory.summary;
  if (s.inspections + s.deals === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        아직 쌓인 기록이 없습니다. 확정한 거래의 반입 검수 결과를 기록하면 배출 기업별로 여기에 모입니다.
      </p>
    );
  }
  const below = memory.emitters.filter((e) => e.inspections.status === "below");
  return (
    <>
      <p className="mt-4 text-[15px] text-ink-2">
        거래한 배출 기업 <span className={num}>{s.emitters}</span>곳 · 확정 <span className={num}>{s.deals}</span>번 · 검수{" "}
        <span className={num}>{s.inspections}</span>건
      </p>
      {below.length > 0 ? (
        <div role="status" className="mt-4 rounded-md bg-warn-bg px-4 py-3 text-sm text-warn">
          {below.map((e) => e.emitterName ?? "배출 기업").join(", ")}: 검수에서 합의한 등급이나 단가보다 낮게 나온 건이 절반
          이상입니다. 다음 합의 때 계약 검토 담당이 양쪽에 반입 검수 조건을 확인하도록 요청합니다.
        </div>
      ) : null}
      <MoreDetails className="mt-3" hint={`배출 기업 ${memory.emitters.length}곳`}>
        <div className="divide-y divide-line">
          {memory.emitters.map((emitter) => (
            <div key={emitter.emitterOrgId} className="py-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{emitter.emitterName ?? "배출 기업"}</h3>
                <StatusChip summary={emitter.inspections} />
              </div>
              <p className="mt-1 text-[13px] text-muted">
                확정 <span className={num}>{emitter.deals}</span>번 · 검수 <span className={num}>{emitter.inspections.count}</span>건
              </p>
              <InspectionTable
                rows={emitter.inspectionRows}
                label="폐기물"
                nameOf={(row) => ("streamName" in row ? String(row.streamName) : "폐기물")}
              />
            </div>
          ))}
        </div>
      </MoreDetails>
    </>
  );
}

export function VendorMemoryPanel() {
  const { mode, org } = useV3();
  const remote = useRemote(`vendor-memory:${org.id}`, mode === "live" && org.role === "vendor", () =>
    api.getVendorMemory(org.id),
  );
  if (org.role !== "vendor" || mode !== "live") return null;
  return (
    <section aria-labelledby="vendor-memory-title" className="mt-12 border-t border-line pt-8">
      <h2 id="vendor-memory-title" className="text-[20px] leading-[1.35] font-semibold tracking-[-0.02em]">
        거래한 배출 기업 기록
      </h2>
      <p className="mt-1 text-sm text-muted">
        확정한 거래에서 기록한 반입 검수를 배출 기업별로 합의와 견줘 모았습니다. 다른 업체는 이 기록을 볼 수 없습니다.
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
      {remote.data ? <VendorMemoryBody memory={remote.data} /> : null}
    </section>
  );
}
