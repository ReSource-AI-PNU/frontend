"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { ClaimText, ClaimValue, Glue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { josa } from "@/lib/josa";
import { CHECK_KEY_LABEL, ROUTE_LABEL, carbonText, formatNumber, isAssumed, placedCount, placedHeadline } from "@/lib/v3/format";
import { processLabel } from "@/lib/v3/flow";
import { numberOf, priceText, signedWon, won } from "@/lib/v3/money";
import type { Approval, Assignment, OrgRole, PermitCheckInput, Result, Thread, ViewStream } from "@/lib/v3/types";
import { BlockedRoutes, PermitChip, PermitDetail, PermitSummary } from "./permit-check";
import { PickupBrief, RoomNote, TransportRows } from "./pickup-line";

const CHECK_WORD = { met: "충족", conditional: "확인 필요", unmet: "맞지 않음", needs_information: "값 없음" } as const;
const STATUS_WORD = { calculated: "매입표 기준 충족", conditional: "매입 조건 확인 필요", needs_information: "값 확인 필요" } as const;
const INSPECTION_CHECKS = new Set(["contamination_basis", "contaminationPct", "moisture_basis", "moisturePct", "mixture", "monthly_kg_basis"]);

function isEmitterRole(role: OrgRole) {
  return role === "emitter";
}

const RESULT_COLUMNS = "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7.5rem]";
const CURRENT_COLUMNS = "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)]";

function Row({
  assignment,
  stream,
  role,
  showComparison,
  onOpenTalk,
  onPermitCheck,
  busy,
  approval,
  thread,
}: {
  assignment: Assignment;
  stream: ViewStream | undefined;
  role: OrgRole;
  showComparison: boolean;
  onOpenTalk: (threadId: string) => void;
  onPermitCheck?: (input: PermitCheckInput) => Promise<string | null>;
  busy: boolean;
  approval?: Approval;
  thread?: Thread;
}) {
  const { openEvidence } = useV3();
  const [open, setOpen] = useState(false);
  const placed = Boolean(assignment.vendorOrgId);
  const reused = assignment.route === "reuse";
  const reuse = assignment.reuse;
  const reuseCandidate = Boolean(isEmitterRole(role) && reuse?.eligible && !reused);
  const permit = placed ? (assignment.permit ?? null) : null;
  const blockedRoutes = assignment.blockedRoutes ?? [];
  // 허가 확인은 위 한 줄과 펼친 곳의 "허가 확인"에 따로 그린다(같은 내용을 확인 항목에 다시 적지 않는다)
  const shownChecks = permit ? assignment.checks.filter((item) => item.key !== "permit_level") : assignment.checks;
  const todo = shownChecks.filter((item) => item.status !== "met");
  const met = shownChecks.length - todo.length;
  const hasDetail =
    assignment.checks.length > 0 ||
    assignment.alternatives.length > 0 ||
    Boolean(assignment.threadId) ||
    reuseCandidate ||
    reused ||
    Boolean(permit);
  const facts = [stream?.material, stream?.form].filter(Boolean).join(" · ");
  // 수거 불가라고 밝혀 배정에서 빠진 업체(옮길 곳이 없어진 까닭을 접지 않고 한 줄로 보인다)
  const noPickup = placed
    ? []
    : assignment.alternatives.filter((item) => item.note.startsWith("수거 불가")).map((item) => item.vendorName ?? "업체");
  const panelId = `route-${assignment.streamId}`;
  const isEmitter = role === "emitter";
  const pickup = assignment.pickup;
  const terms = thread?.messages?.find((message) => message.seq === thread.agreedSeq)?.meta?.terms;
  const pickupKnown = pickup?.status === "route" || pickup?.status === "visit";
  const days = pickupKnown || !pickup ? (pickup?.days ?? terms?.pickup?.days ?? terms?.days ?? []) : [];
  const approvalLabel = !approval ? "양측 승인 상태 확인 필요"
    : approval.emitter && approval.vendor ? "양측 승인 완료"
    : approval.emitter ? "배출 기업 승인 완료 · 업체 승인 전"
    : approval.vendor ? "업체 승인 완료 · 배출 기업 승인 전"
    : "양측 승인 전";
  const pickupCommitted = pickupKnown && thread?.status === "confirmed" &&
    Boolean(approval?.emitter && approval.vendor && !approval.blocked);
  const statusLabel = STATUS_WORD[assignment.status] ?? "매입 조건 상태 확인 필요";
  const inspectionRequired = todo.some((item) => INSPECTION_CHECKS.has(item.key));
  const hasDifferenceColumn = showComparison || !isEmitter;
  const columns = hasDifferenceColumn ? RESULT_COLUMNS : CURRENT_COLUMNS;

  return (
    <li className="py-3.5">
      <div className={`grid ${hasDifferenceColumn ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"} ${columns} gap-x-4 gap-y-1 sm:items-baseline`}>
        <div className="min-w-0">
          <p className="font-medium">{stream?.name ?? assignment.streamId}</p>
          <p className="text-[13px] text-muted">
            {stream?.monthlyKg ? (
              <ClaimValue
                claim={stream.monthlyKg}
                display={numberOf(stream.monthlyKg) === null ? undefined : `한 달 ${formatNumber(numberOf(stream.monthlyKg) as number)} kg`}
                className="!font-normal"
              />
            ) : null}
            {stream?.monthlyKg && facts ? " · " : ""}
            {facts}
          </p>
        </div>

        {/* 좁은 화면에서는 한 달 차이를 이름 옆에 둔다 */}
        {hasDifferenceColumn ? (
          <p className="text-right tabular-nums sm:order-last">
            {isEmitter && assignment.difference ? (
              <>
                <ClaimValue claim={assignment.difference} signed hideAssumed display={signedWon(assignment.difference)} />
                {(assignment.transportPending || assignment.costPending) ? (
                  <span className="block text-[12px] text-warn">미확인 비용 반영 전</span>
                ) : assignment.bundleBelowCurrent?.bundle ? (
                  <span className="block text-[12px] text-warn">
                    묶음 전체{" "}
                    <ClaimValue
                      claim={assignment.bundleBelowCurrent.bundle}
                      signed
                      hideAssumed
                      display={signedWon(assignment.bundleBelowCurrent.bundle)}
                      className="!font-normal"
                    />
                  </span>
                ) : isAssumed(assignment.difference) ? (
                  <span className="block text-[12px] text-muted">가정값 포함</span>
                ) : null}
              </>
            ) : isEmitter ? (
              <span className="text-[13px] text-muted">{placed ? "계산 전" : "변화 없음"}</span>
            ) : null}
          </p>
        ) : null}

        <div className="min-w-0">
          {reused ? (
            <p className="font-medium">사내 공정에 다시 넣기</p>
          ) : isEmitter || !placed ? (
            <p className={placed ? "font-medium" : "text-ink-2"}>
              {placed ? assignment.vendorName : "지금 방식 그대로"}
              {placed && assignment.process ? (
                <span className="ml-1.5 text-[13px] font-normal text-muted">{processLabel(assignment.route, assignment.process)}</span>
              ) : null}
            </p>
          ) : null}
          {hasDetail ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((before) => !before)}
              className="-my-2 -ml-1 flex min-h-11 items-center gap-0.5 rounded-md px-1 text-left text-[13px] text-muted hover:bg-sunken hover:text-ink"
            >
              {placed ? statusLabel : reused ? "계산 내역" : reuseCandidate ? "재투입 후보" : "옮기지 않은 까닭"}
              {todo.length > 0 ? ` · 확인할 것 ${todo.length}개` : ""}
              <ChevronDownIcon className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          ) : placed ? (
            <p className="text-[13px] text-muted">{statusLabel}</p>
          ) : null}
        </div>

        <p className={`min-w-0 text-[15px] text-ink-2 ${hasDifferenceColumn ? "col-span-2 sm:col-span-1" : ""}`}>
          {reused ? (
            "신재 구입을 줄입니다"
          ) : assignment.unitPrice ? (
            <ClaimValue claim={assignment.unitPrice} display={priceText(assignment.unitPrice)} className="!font-normal" />
          ) : placed ? (
            "단가 확인 필요"
          ) : (
            <span className="text-muted">옮길 곳이 정해지지 않았습니다</span>
          )}
          {noPickup.length > 0 ? (
            <span className="block text-[13px] text-warn">{noPickup.join(", ")} · 수거 불가</span>
          ) : null}
          {placed && pickup ? (
            <PickupBrief pickup={pickup} />
          ) : isEmitter && placed && assignment.transportPaidBy ? (
            <span className="block text-[13px] text-muted">
              {assignment.transportPaidBy === "vendor" ? (
                "운반비 포함"
              ) : assignment.transport ? (
                <>
                  운반비 한 달 <ClaimValue claim={assignment.transport} display={won(assignment.transport)} className="!font-normal" /> 별도
                </>
              ) : (
                "운반비 별도(금액 확인 필요)"
              )}
            </span>
          ) : null}
          {placed ? (
            <span className="block text-[13px] text-muted">
              {inspectionRequired ? <span className="block">반입 검수 필요</span> : null}
              {pickup?.status !== "unavailable" ? (
                <>
                  <span className="block">{pickupCommitted ? "업체 수거 확약" : "업체 수거 확인 전"}</span>
                  {!pickupCommitted ? (
                    <span className="block">
                      {days.length > 0 ? `${days.join("·")} 수거 일정을 업체에 확인` : "수거 가능 여부와 일정을 업체에 확인"}
                    </span>
                  ) : null}
                </>
              ) : null}
              <span className="block">{approvalLabel}</span>
            </span>
          ) : null}
        </p>
      </div>

      {permit ? <PermitSummary permit={permit} /> : null}
      {isEmitter ? <BlockedRoutes routes={blockedRoutes} placedName={placed ? assignment.vendorName : null} /> : null}

      {hasDetail ? (
        <>
          {open ? (
            <div id={panelId} className="mt-3 rounded-xl bg-ground px-4 py-4 text-sm">
              {permit && assignment.vendorOrgId ? (
                <PermitDetail
                  permit={permit}
                  streamId={assignment.streamId}
                  vendorOrgId={assignment.vendorOrgId}
                  onRecord={isEmitter ? onPermitCheck : undefined}
                  disabled={busy}
                />
              ) : null}
              {isEmitter ? (
                <RoomNote
                  assignment={assignment}
                  vendorName={(id) => assignment.alternatives.find((item) => item.vendorOrgId === id)?.vendorName}
                />
              ) : null}
              {isEmitter && assignment.revenue ? (
                <dl className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 border-b border-line pb-4 tabular-nums">
                  <dt className="text-ink-2">
                    {reused ? "신재 절감액" : (numberOf(assignment.revenue) ?? 0) < 0 ? "처리비" : "매각 수익"}
                  </dt>
                  <dd className="text-right">
                    <ClaimValue claim={assignment.revenue} signed display={signedWon(assignment.revenue)} className="!font-normal" />
                  </dd>
                  {placed && assignment.pickup ? (
                    <TransportRows
                      assignment={assignment}
                      onOpenTalk={assignment.threadId ? () => onOpenTalk(assignment.threadId as string) : undefined}
                    />
                  ) : null}
                  {placed ? (
                    <>
                      {assignment.pickup ? null : <dt className="text-ink-2">운반비</dt>}
                      {assignment.pickup ? null : (
                      <dd className="text-right">
                        {assignment.transportPaidBy === "vendor" ? (
                          <span className="text-ink-2">업체 단가에 포함</span>
                        ) : assignment.transport ? (
                          <ClaimValue claim={assignment.transport} display={`−${won(assignment.transport)}`} className="!font-normal" />
                        ) : (
                          <span className="text-warn">확인 필요</span>
                        )}
                      </dd>
                      )}
                      <dt className="text-ink-2">전처리 인건비</dt>
                      <dd className="text-right">
                        {assignment.labor ? (
                          <ClaimValue claim={assignment.labor} display={`−${won(assignment.labor)}`} className="!font-normal" />
                        ) : (
                          <span className="text-ink-2">넣지 않음</span>
                        )}
                      </dd>
                    </>
                  ) : null}
                  <dt className="mt-1 border-t border-line pt-2 font-medium">
                    옮긴 뒤 한 달
                    {(assignment.transportPending || assignment.costPending) ? <span className="ml-1.5 text-[12px] font-normal text-warn">미확인 비용 반영 전</span> : null}
                  </dt>
                  <dd className="mt-1 border-t border-line pt-2 text-right font-medium">
                    {assignment.monthlyAfter ? (
                      <ClaimValue claim={assignment.monthlyAfter} signed display={signedWon(assignment.monthlyAfter)} />
                    ) : null}
                  </dd>
                  <dt className="text-ink-2">지금 한 달</dt>
                  <dd className="text-right">
                    {assignment.monthlyNow ? (
                      <ClaimValue claim={assignment.monthlyNow} signed display={signedWon(assignment.monthlyNow)} className="!font-normal" />
                    ) : null}
                  </dd>
                </dl>
              ) : null}
              {reuseCandidate && reuse ? (
                <p className="mb-4 border-b border-line pb-4 text-ink-2">
                  <span className="font-medium text-ink">공정에 다시 넣을 수 있는 후보입니다.</span>{" "}
                  {reuse.monthlyAfter ? (
                    <>
                      다시 넣으면 한 달{" "}
                      <ClaimValue claim={reuse.monthlyAfter} signed display={signedWon(reuse.monthlyAfter)} className="!font-normal" />
                      으로 계산됩니다.
                    </>
                  ) : (
                    <>
                      신재 구입 단가와 한 달에 다시 넣을 수 있는 양을{" "}
                      <Link href="/app/materials" className="underline underline-offset-4 hover:text-ink">
                        자료
                      </Link>
                      에 넣으면 업체에 보내는 것과 함께 견줍니다.
                    </>
                  )}
                </p>
              ) : null}
              {todo.length > 0 ? (
                <ul className="space-y-3">
                  {todo.map((check, index) => (
                    <li key={`${check.key}-${index}`}>
                      <p className="font-medium">
                        {CHECK_KEY_LABEL[check.key] ?? "확인 항목"}
                        {check.status !== "conditional" ? (
                          <span className="ml-2 text-[12px] font-normal text-warn">{CHECK_WORD[check.status]}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-ink-2">
                        <ClaimText text={check.text} claims={check.claims ?? []} />{" "}
                        {check.evidence.length > 0 ? (
                          <button
                            type="button"
                            className="text-[13px] text-muted underline underline-offset-4 hover:text-ink"
                            onClick={() => openEvidence(check.evidence, CHECK_KEY_LABEL[check.key] ?? "확인 항목")}
                          >
                            근거
                          </button>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {met > 0 ? (
                <details className={todo.length > 0 ? "mt-4 border-t border-line pt-3" : ""}>
                  <summary className="cursor-pointer text-[13px] text-ink-2 hover:text-ink">이미 맞는 조건 {met}개</summary>
                  <ul className="mt-2 space-y-2 text-ink-2">
                    {shownChecks
                      .filter((item) => item.status === "met")
                      .map((check, index) => (
                        <li key={`${check.key}-${index}`}>
                          <span className="font-medium text-ink">{CHECK_KEY_LABEL[check.key] ?? "확인 항목"}</span>{" "}
                          <ClaimText text={check.text} claims={check.claims ?? []} />
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}

              {assignment.alternatives.length > 0 ? (
                <div className={todo.length > 0 || met > 0 ? "mt-4 border-t border-line pt-3" : ""}>
                  <p className="text-[13px] text-muted">다른 선택지</p>
                  <ul className="mt-1.5 space-y-2">
                    {assignment.alternatives.map((item, index) => (
                      <li key={`alt-${index}`} className="text-ink-2">
                        <span className="font-medium text-ink">{item.vendorName ?? ROUTE_LABEL[item.route] ?? item.route}</span>
                        {item.permit ? (
                          <span className="ml-2 inline-flex align-middle">
                            <PermitChip permit={item.permit} />
                          </span>
                        ) : null}
                        {item.unitPrice ? (
                          <>
                            {" · "}
                            <ClaimValue claim={item.unitPrice} display={priceText(item.unitPrice)} className="!font-normal" />
                          </>
                        ) : null}
                        {item.monthlyAfter ? (
                          <>
                            {" · 한 달 "}
                            <ClaimValue claim={item.monthlyAfter} signed display={signedWon(item.monthlyAfter)} className="!font-normal" />
                            {(item.transportPending || item.costPending) ? <span className="ml-1 text-[12px] text-warn">미확인 비용 반영 전</span> : null}
                          </>
                        ) : null}
                        {isEmitter && item.carbon ? (
                          <>
                            {" · 탄소 "}
                            <ClaimValue claim={item.carbon} display={carbonText(item.carbon)} className="!font-normal" />
                          </>
                        ) : null}
                        {item.note ? <span className="block text-[13px] text-muted">{item.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isEmitter && (assignment.carbon || assignment.carbonTransport) ? (
                <div className="mt-4 border-t border-line pt-3 text-ink-2">
                  <p>
                    처리 단계 배출 변화{" "}
                    {assignment.carbon ? (
                      <ClaimValue claim={assignment.carbon} className="!font-normal" />
                    ) : (
                      <span className="text-warn">처리 방식 배출계수 없음</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    국내 처리 공정 계수로 낸 배정 판단용 값입니다. 신재 대체는 넣지 않아 자원순환 효과의 감축량과 다릅니다.
                  </p>
                  {assignment.carbonProcess || assignment.carbonTransport ? (
                    <p className="mt-0.5 text-[13px] text-muted">
                      {assignment.carbonProcess ? (
                        <>
                          처리 방식 <ClaimValue claim={assignment.carbonProcess} className="!font-normal" />
                        </>
                      ) : null}
                      {assignment.carbonProcess && assignment.carbonTransport ? " · " : null}
                      {assignment.carbonTransport ? (
                        <>
                          운송{" "}
                          <ClaimValue claim={assignment.carbonTransport} display={carbonText(assignment.carbonTransport, true)} className="!font-normal" />
                          {assignment.transportKm && numberOf(assignment.transportKm) !== null ? (
                            <>
                              {" "}
                              (공장에서 업체까지{" "}
                              <ClaimValue
                                claim={assignment.transportKm}
                                display={`${formatNumber(Math.round((numberOf(assignment.transportKm) as number) * 10) / 10)} km`}
                                className="!font-normal"
                              />
                              )
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {assignment.threadId ? (
                <p className="mt-4">
                  <button
                    type="button"
                    onClick={() => onOpenTalk(assignment.threadId as string)}
                    className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  >
                    이 업체와 AI가 나눈 대화 보기
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * 탄소를 가장 많이 줄이는 배정과 고른 배정의 비교. 같으면 한 줄로 그렇다고 적고, 다르면 무엇을 바꾸면 되는지와
 * 그때의 돈·탄소 차이를 적는다. 고른 배정은 돈 차이가 배출권 시세로 환산한 탄소 차이보다 크다(백엔드 최적 배정의 목적).
 */
function GreenestNote({ greenest }: { greenest: NonNullable<Result["greenest"]> }) {
  if (greenest.same) {
    return (
      <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
        이 배정이 탄소도 가장 많이 줄입니다. 처리 방식과 업체까지 실어 가는 운송 배출을 함께 비교했습니다.
      </p>
    );
  }
  const moves = greenest.changes.map((change) => {
    const where = change.vendorName ?? (change.route === "reuse" ? "사내 공정" : "지금 처리하는 곳");
    return `${josa(change.streamName ?? "폐기물", "을/를")} ${where}에`;
  });
  const money = numberOf(greenest.moneyGap);
  const carbon = numberOf(greenest.carbonGap);
  return (
    <p className="mt-3 rounded-xl bg-ground px-4 py-3 text-[14px] leading-relaxed text-ink-2">
      <span className="font-medium text-ink">탄소를 가장 많이 줄이려면</span> {moves.join(", ")} 보내면 됩니다.{" "}
      {money !== null && carbon !== null && greenest.moneyGap && greenest.carbonGap ? (
        <>
          그러면 한 달 손익이{" "}
          <Glue>
            <ClaimValue claim={greenest.moneyGap} display={won(greenest.moneyGap)} className="!font-normal" />
            {money <= 0 ? " 줄고" : " 늘고"}
          </Glue>{" "}
          탄소를{" "}
          <Glue>
            <ClaimValue
              claim={greenest.carbonGap}
              display={carbonText({ ...greenest.carbonGap, value: Math.abs(carbon) })}
              className="!font-normal"
            />
            {carbon <= 0 ? " 더 줄입니다." : " 덜 줄입니다."}
          </Glue>{" "}
          줄어드는 돈이 그 탄소를 배출권 시세로 환산한 값보다 커서 지금 배정을 골랐습니다.
        </>
      ) : null}
    </p>
  );
}

/** 한 달 손익을 담당자가 읽는 문장으로 푼다. 숫자는 누르면 근거가 열린다. */
function MoneySentence({
  totals,
  conditional,
  showComparison,
  pending,
}: {
  totals: Result["totals"];
  conditional: boolean;
  showComparison: boolean;
  pending: number;
}) {
  const now = numberOf(totals.monthlyNow);
  const after = numberOf(totals.monthlyAfter);
  const difference = numberOf(totals.difference);
  if (now === null && (!showComparison || (after === null && difference === null))) {
    return <p className="mt-2 text-ink-2">금액은 확인이 더 필요합니다.</p>;
  }
  return (
    <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
      {now !== null ? (
        <>
          지금은 한 달에{" "}
          <Glue>
            <ClaimValue claim={totals.monthlyNow} display={won(totals.monthlyNow)} className="text-ink" />을
          </Glue>{" "}
          {now < 0 ? "내고" : "받고"} 있습니다.{" "}
        </>
      ) : null}
      {showComparison && after !== null ? (
        <>
          {conditional ? "조건이 확인되면" : "이대로 바꾸면"} 한 달에{" "}
          <Glue>
            <ClaimValue claim={totals.monthlyAfter} display={won(totals.monthlyAfter)} className="text-ink" />을
          </Glue>{" "}
          {after < 0 ? "내게" : "받게"} 됩니다.
          {pending > 0 ? (
            <span className="text-warn"> 운반비가 정해지지 않은 폐기물 {pending}가지는 별도 운반비를 빼기 전 금액이라 잠정값입니다.</span>
          ) : null}
        </>
      ) : null}
    </p>
  );
}

/**
 * 결과. 문장 두 줄로 요약하고, 폐기물마다 누가 얼마에 받는지를 표 한 장으로 보여 준다.
 * 조건과 다른 선택지는 줄마다 접어 둔다.
 */
export function ResultCard({
  result,
  streams,
  role,
  counterpart,
  onOpenTalk,
  onPermitCheck,
  busy = false,
  threads,
  approvals,
}: {
  result: Result;
  streams: ViewStream[];
  role: OrgRole;
  counterpart: string;
  onOpenTalk: (threadId: string) => void;
  threads: Thread[];
  approvals: Approval[];
  /** 배출 기업 담당자가 허가증 원문 대조를 기록한다(승인 대기 중, 체험하기가 아닐 때만 준다) */
  onPermitCheck?: (input: PermitCheckInput) => Promise<string | null>;
  busy?: boolean;
}) {
  const { openEvidence } = useV3();
  const { totals } = result;
  const count = result.assignments.length;
  const placed = placedCount(result.assignments);
  const assumptionIds = result.assumptions.map((item) => item.id);
  const isEmitter = role === "emitter";
  const showComparison = isEmitter && placed > 0;
  const columns = isEmitter && !showComparison ? CURRENT_COLUMNS : RESULT_COLUMNS;
  // 받는 곳은 정해졌는데 탄소를 계산하지 못한 폐기물(배출계수가 없는 처리 방식). 합계에서 빠졌다는 것을 숨기지 않는다
  const carbonGap = result.assignments.filter((item) => item.vendorOrgId && item.carbon === null).length;
  const conditional = result.status === "conditional";
  // 운반비가 정해지지 않아 별도 운반비 반영 전 값이 합계에 섞인 폐기물
  const pending = result.transportPending ?? [];

  return (
    <section aria-label="결과">
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em] sm:text-[24px]">
        {!isEmitter
          ? `${counterpart}에서 폐기물 ${count}가지를 문의했습니다.`
          : placedHeadline(count, placed)}
      </h2>
      {isEmitter ? <MoneySentence totals={totals} conditional={conditional} showComparison={showComparison} pending={pending.length} /> : null}

      <div className="mt-6">
        <div className={`hidden ${columns} gap-x-4 border-b border-line pb-2 text-[13px] text-muted sm:grid`}>
          <span>폐기물</span>
          <span>{isEmitter ? "처리 후보" : "상태"}</span>
          <span>조건</span>
          {showComparison ? <span className="text-right">한 달 차이</span> : !isEmitter ? <span /> : null}
        </div>
        <ul aria-label="품목별 처리 후보" className="divide-y divide-line border-b border-line sm:border-t-0">
          {result.assignments.map((assignment) => (
            <Row
              key={assignment.streamId}
              assignment={assignment}
              stream={streams.find((item) => item.id === assignment.streamId)}
              role={role}
              showComparison={showComparison}
              onOpenTalk={onOpenTalk}
              onPermitCheck={onPermitCheck}
              busy={busy}
              thread={threads.find((item) => item.id === assignment.threadId)}
              approval={approvals.find((item) => item.threadId === assignment.threadId && item.streamIds.includes(assignment.streamId))}
            />
          ))}
        </ul>
        {showComparison && totals.difference ? (
          <p className="flex items-baseline justify-between gap-4 py-4 font-semibold">
            <span>
              한 달 합계
              {pending.length > 0 ? (
                <span className="ml-2 text-[13px] font-normal text-warn">잠정 · 미확인 비용 반영 전 {pending.length}가지 포함</span>
              ) : null}
            </span>
            <span className="text-[18px] tabular-nums">
              <ClaimValue claim={totals.difference} signed display={signedWon(totals.difference)} />
            </span>
          </p>
        ) : null}
      </div>

      {showComparison && result.greenest ? <GreenestNote greenest={result.greenest} /> : null}

      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {conditional && (showComparison || !isEmitter) ? "조건부 후보의 매입 조건은 검수 등 확인 결과에 따라 달라질 수 있습니다. " : ""}
        숫자를 누르면 계약서·측정값·법 조항 같은 근거가 열립니다.
        {assumptionIds.length > 0 ? (
          <>
            {" "}
            별도 확인할 가정·운영 정책이 {assumptionIds.length}개 있습니다. 근거에서 구분과 결정 주체를 확인하세요.{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-ink"
              onClick={() => openEvidence(assumptionIds, "이 결과의 가정·운영 정책")}
            >
              가정·정책 보기
            </button>
          </>
        ) : null}
        {showComparison && totals.carbon ? (
          <>
            {" "}
            처리 단계 배출 변화(국내 처리 공정 계수)는 운송 배출을 더해{" "}
            <Glue>
              <ClaimValue claim={totals.carbon} className="!font-normal" />
              입니다.
            </Glue>
            {carbonGap > 0 ? ` 근거가 부족한 처리(열분해 등)로 보내는 ${carbonGap}가지는 처리 방식의 탄소를 합계에 넣지 않았습니다.` : null}
            {result.carbonInObjective
              ? " 받는 곳을 고를 때 이 값을 배출권 시세로 환산해 한 달 손익과 함께 봤습니다. 판단용 환산이며 받거나 팔 수 있는 돈이 아닙니다."
              : null}
          </>
        ) : null}
      </p>
      {showComparison && (result.scope ?? []).length > 0 ? (
        <div className="mt-2 text-[13px] leading-relaxed text-muted">
          <p className="font-medium text-ink-2">계산 범위</p>
          <ul className="mt-0.5 space-y-0.5">
            {(result.scope ?? []).map((item) => (
              <li key={item.key}>{item.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
