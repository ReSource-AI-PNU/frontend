import { formatNumber, formatSigned } from "@/lib/format";
import { CONSENT_LABEL, CONSENT_TONE, type ConsentState } from "@/lib/bundle-consent";
import type { Approval, Outcome, StreamRoute } from "@/lib/session/types";
import { CheckIcon } from "../icons";
import { Badge } from "../ui/badge";
import { RouteBadge } from "./stream-badges";

export function formatKoreanTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 발송 완료 상태: 누구에게 무엇이 갔는지, 승인자와 시각. 승인은 사람이 한 일이므로 먹색으로 표시한다. */
export function ProposalSent({
  approval,
  routeLabel,
  internalDocs,
  replies,
}: {
  approval: Approval;
  routeLabel: string;
  internalDocs: string[];
  /** 받는 곳 이름 → 묶음 참여 제안 회신 상태 */
  replies?: Record<string, ConsentState>;
}) {
  const places = new Set(approval.sentTo.map((t) => t.name)).size;
  return (
    <section aria-labelledby="sent-title" className="grid gap-3 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sent-title" className="text-[16px] font-semibold">
            {approval.sentTo.length ? `${places}곳에 서류 ${approval.sentTo.length}건을 발송했습니다` : "외부로 보낸 서류가 없습니다"}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">승인한 방안: {routeLabel}</p>
        </div>
        <Badge tone="gain">승인 완료</Badge>
      </div>
      {approval.sentTo.length ? (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">발송 내역</caption>
          <thead>
            <tr className="border-b border-ink text-left text-[12px] text-muted">
              <th scope="col" className="pb-2 font-[550]">
                받는 곳
              </th>
              <th scope="col" className="pb-2 pl-3 font-[550]">
                보낸 서류
              </th>
              {replies ? (
                <th scope="col" className="pb-2 pl-3 text-right font-[550]">
                  회신
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {approval.sentTo.map((t, i) => (
              <tr key={`${t.name}-${t.kind}-${i}`} className="border-b border-line">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-ink">
                    <CheckIcon />
                    <span className="font-semibold">{t.name}</span>
                  </span>
                </td>
                <td className="py-2 pl-3 text-ink-2">{t.kind}</td>
                {replies ? (
                  <td className="py-2 pl-3 text-right">
                    {t.kind === "묶음 참여 제안" && replies[t.name] ? (
                      <Badge tone={CONSENT_TONE[replies[t.name]]}>{CONSENT_LABEL[replies[t.name]]}</Badge>
                    ) : (
                      <span className="text-[12.5px] text-muted">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span className="rounded-sm bg-ink px-1.5 text-[12px] font-semibold text-on-ink">승인</span>
        {approval.approvedBy} · <span className="tabular-nums">{formatKoreanTime(approval.approvedAt)}</span>
      </p>
      <p className="text-[12.5px] text-muted">
        묶음 참여 동의는 위 표와 업체·묶음 매칭 화면에 바로 반영됩니다. 시연에서는 메뉴의 &ldquo;이웃 기업 화면으로 보기&rdquo;에서 그 기업 시점으로 회신해 볼 수 있습니다.
        {internalDocs.length ? ` ${internalDocs.join(", ")}은(는) 내부용으로 저장했습니다.` : ""}
      </p>
    </section>
  );
}

type Row = { label: string; unit?: string; expected: string; actual: string; diff?: number; money?: boolean };

/**
 * 흐름 하나의 예상 대비 실제. 손익 차이는 부호와 색을 함께 쓴다. 사람이 기록한 실제값은 먹색으로 굵게 쓴다.
 * 예상 단가는 경로 판정의 kg당 손익(묶음은 운반비 분담 후), 예상 수거량은 그 흐름의 월 발생량이다.
 */
export function ProposalOutcomeCompare({
  outcome,
  expected,
}: {
  outcome: Outcome;
  expected: { streamName: string; route: StreamRoute; perKg: number; kg: number };
}) {
  const expectedAmount = expected.perKg * expected.kg;
  const actualAmount = outcome.accepted ? outcome.actualPerKg * outcome.actualKg : 0;
  const rows: Row[] = [
    { label: "매입 여부", expected: "매입", actual: outcome.accepted ? "매입" : "거절" },
    { label: "등급", expected: "—", actual: outcome.actualGrade },
    {
      label: "단가",
      unit: "원/kg",
      expected: formatSigned(expected.perKg),
      actual: formatSigned(outcome.actualPerKg),
      diff: outcome.actualPerKg - expected.perKg,
      money: true,
    },
    {
      label: "수거량",
      unit: "kg/월",
      expected: formatNumber(expected.kg),
      actual: formatNumber(outcome.actualKg),
      diff: outcome.actualKg - expected.kg,
    },
    {
      label: "정산 금액",
      unit: "원",
      expected: formatSigned(expectedAmount),
      actual: formatSigned(actualAmount),
      diff: actualAmount - expectedAmount,
      money: true,
    },
  ];
  const amountDiff = actualAmount - expectedAmount;

  return (
    <section aria-labelledby={`compare-${outcome.streamId ?? "stream"}`} className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`compare-${outcome.streamId ?? "stream"}`} className="flex flex-wrap items-center gap-2 text-h2">
          {expected.streamName} · 예상과 실제
          <RouteBadge route={expected.route} size="sm" />
        </h2>
        <p className="text-[13px] text-muted">
          {outcome.recordedBy} · {outcome.recorderRole} · <span className="tabular-nums">{formatKoreanTime(outcome.recordedAt)}</span>
        </p>
      </div>
      <p className="text-[15px] text-ink-2">
        {outcome.accepted
          ? amountDiff === 0
            ? "실제 정산 금액이 예상과 같습니다."
            : `${expected.streamName}의 실제 정산 금액이 예상보다 ${formatNumber(Math.abs(amountDiff))}원 ${amountDiff > 0 ? "많았습니다" : "적었습니다"}.`
          : `업체가 ${expected.streamName} 매입을 거절했습니다.${outcome.reason ? ` 사유는 "${outcome.reason}"입니다.` : ""}`}{" "}
        이 차이는 라벨 검수 대기열에 올라가 다음 학습에 쓰입니다.
      </p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{expected.streamName}의 예상 대비 실제 결과</caption>
        <thead>
          <tr className="border-b border-ink text-left text-[12px] text-muted">
            <th scope="col" className="pb-2 font-[550]">
              항목
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-[550]">
              AI 예상
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-[550]">
              실제
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-[550]">
              차이
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const numeric = r.diff !== undefined;
            const tone = r.money && r.diff ? (r.diff > 0 ? "text-gain font-semibold" : "text-loss") : "text-ink-2";
            return (
              <tr key={r.label} className="border-b border-line">
                <th scope="row" className="py-2.5 text-left font-normal text-ink-2">
                  {r.label}
                  {r.unit ? <span className="ml-1 text-[12px] text-muted">({r.unit})</span> : null}
                </th>
                <td className={`py-2.5 pl-3 text-right text-muted ${numeric ? "num" : ""}`}>
                  {r.expected === "—" ? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">예상 없음</span>
                    </>
                  ) : (
                    r.expected
                  )}
                </td>
                <td className={`py-2.5 pl-3 text-right font-semibold text-ink ${numeric ? "num" : ""}`}>{r.actual}</td>
                <td className={`py-2.5 pl-3 text-right ${numeric ? `num ${tone}` : "text-muted"}`}>
                  {numeric ? formatSigned(r.diff ?? 0) : r.expected === "—" ? "" : r.expected === r.actual ? "같음" : "다름"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {outcome.reason && outcome.accepted ? <p className="text-[13px] text-ink-2">감량·감가 사유: {outcome.reason}</p> : null}
    </section>
  );
}
