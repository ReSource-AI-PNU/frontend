"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { ClaimText, ClaimValue, Glue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { CHECK_KEY_LABEL, ROUTE_LABEL, formatNumber, isAssumed } from "@/lib/v3/format";
import { numberOf, priceText, signedWon, won } from "@/lib/v3/money";
import type { Assignment, OrgRole, Result, ViewStream } from "@/lib/v3/types";

const CHECK_WORD = { met: "충족", conditional: "확인 필요", unmet: "맞지 않음", needs_information: "값 없음" } as const;
const STATUS_WORD = { calculated: "조건 확정", conditional: "조건 확인 뒤 확정", needs_information: "값 확인 필요" } as const;

function isEmitterRole(role: OrgRole) {
  return role === "emitter";
}

function Row({
  assignment,
  stream,
  role,
  onOpenTalk,
}: {
  assignment: Assignment;
  stream: ViewStream | undefined;
  role: OrgRole;
  onOpenTalk: (threadId: string) => void;
}) {
  const { openEvidence } = useV3();
  const [open, setOpen] = useState(false);
  const placed = Boolean(assignment.vendorOrgId);
  const reused = assignment.route === "reuse";
  const reuse = assignment.reuse;
  const reuseCandidate = Boolean(isEmitterRole(role) && reuse?.eligible && !reused);
  const todo = assignment.checks.filter((item) => item.status !== "met");
  const met = assignment.checks.length - todo.length;
  const hasDetail =
    assignment.checks.length > 0 || assignment.alternatives.length > 0 || Boolean(assignment.threadId) || reuseCandidate || reused;
  const facts = [stream?.material, stream?.form].filter(Boolean).join(" · ");
  const panelId = `route-${assignment.streamId}`;
  const isEmitter = role === "emitter";

  return (
    <li className="py-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7.5rem] sm:items-baseline">
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
        <p className="text-right tabular-nums sm:order-last">
          {isEmitter && assignment.difference ? (
            <>
              <ClaimValue claim={assignment.difference} signed hideAssumed display={signedWon(assignment.difference)} />
              {isAssumed(assignment.difference) ? <span className="block text-[12px] text-muted">가정값 포함</span> : null}
            </>
          ) : isEmitter ? (
            <span className="text-[13px] text-muted">{placed ? "계산 전" : "변화 없음"}</span>
          ) : null}
        </p>

        <div className="min-w-0">
          {reused ? (
            <p className="font-medium">사내 공정에 다시 넣기</p>
          ) : isEmitter || !placed ? (
            <p className={placed ? "font-medium" : "text-ink-2"}>{placed ? assignment.vendorName : "지금 방식 그대로"}</p>
          ) : null}
          {(placed || reused || reuseCandidate) && hasDetail ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((before) => !before)}
              className="-my-2 -ml-1 flex min-h-11 items-center gap-0.5 rounded-md px-1 text-left text-[13px] text-muted hover:bg-sunken hover:text-ink"
            >
              {placed ? STATUS_WORD[assignment.status] : reused ? "계산 내역" : "재투입 후보"}
              {todo.length > 0 ? ` · 확인할 것 ${todo.length}개` : ""}
              <ChevronDownIcon className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          ) : placed ? (
            <p className="text-[13px] text-muted">{STATUS_WORD[assignment.status]}</p>
          ) : null}
        </div>

        <p className="col-span-2 min-w-0 text-[15px] text-ink-2 sm:col-span-1">
          {reused ? (
            "신재 구입을 줄입니다"
          ) : assignment.unitPrice ? (
            <ClaimValue claim={assignment.unitPrice} display={priceText(assignment.unitPrice)} className="!font-normal" />
          ) : placed ? (
            "단가 확인 필요"
          ) : (
            <span className="text-muted">옮길 곳이 정해지지 않았습니다</span>
          )}
          {isEmitter && placed && assignment.transportPaidBy ? (
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
        </p>
      </div>

      {hasDetail ? (
        <>
          {open ? (
            <div id={panelId} className="mt-3 rounded-xl bg-ground px-4 py-4 text-sm">
              {isEmitter && assignment.revenue ? (
                <dl className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 border-b border-line pb-4 tabular-nums">
                  <dt className="text-ink-2">
                    {reused ? "신재 절감액" : (numberOf(assignment.revenue) ?? 0) < 0 ? "처리비" : "매각 수익"}
                  </dt>
                  <dd className="text-right">
                    <ClaimValue claim={assignment.revenue} signed display={signedWon(assignment.revenue)} className="!font-normal" />
                  </dd>
                  {placed ? (
                    <>
                      <dt className="text-ink-2">운반비</dt>
                      <dd className="text-right">
                        {assignment.transportPaidBy === "vendor" ? (
                          <span className="text-ink-2">업체 단가에 포함</span>
                        ) : assignment.transport ? (
                          <ClaimValue claim={assignment.transport} display={`−${won(assignment.transport)}`} className="!font-normal" />
                        ) : (
                          <span className="text-warn">확인 필요</span>
                        )}
                      </dd>
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
                  <dt className="mt-1 border-t border-line pt-2 font-medium">옮긴 뒤 한 달</dt>
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
                    {assignment.checks
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
                          </>
                        ) : null}
                        {item.note ? <span className="block text-[13px] text-muted">{item.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isEmitter && assignment.carbon ? (
                <p className="mt-4 border-t border-line pt-3 text-ink-2">
                  탄소 배출 변화 <ClaimValue claim={assignment.carbon} className="!font-normal" />
                </p>
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

/** 한 달 손익을 담당자가 읽는 문장으로 푼다. 숫자는 누르면 근거가 열린다. */
function MoneySentence({ totals, conditional }: { totals: Result["totals"]; conditional: boolean }) {
  const now = numberOf(totals.monthlyNow);
  const after = numberOf(totals.monthlyAfter);
  const difference = numberOf(totals.difference);
  if (now === null && after === null && difference === null) {
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
      {after !== null ? (
        <>
          {conditional ? "조건이 확인되면" : "이대로 바꾸면"} 한 달에{" "}
          <Glue>
            <ClaimValue claim={totals.monthlyAfter} display={won(totals.monthlyAfter)} className="text-ink" />을
          </Glue>{" "}
          {after < 0 ? "내게" : "받게"} 됩니다.
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
}: {
  result: Result;
  streams: ViewStream[];
  role: OrgRole;
  counterpart: string;
  onOpenTalk: (threadId: string) => void;
}) {
  const { openEvidence } = useV3();
  const { totals } = result;
  const count = result.assignments.length;
  const placed = result.assignments.filter((item) => item.vendorOrgId || item.route === "reuse").length;
  const assumptionIds = result.assumptions.map((item) => item.id);
  const isEmitter = role === "emitter";
  const conditional = result.status === "conditional";

  return (
    <section aria-label="결과">
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.025em] sm:text-[24px]">
        {!isEmitter
          ? `${counterpart}에서 폐기물 ${count}가지를 문의했습니다.`
          : placed === 0
            ? "지금보다 나은 곳을 찾지 못했습니다."
            : placed === count
              ? `${count}가지 모두 보낼 곳을 찾았습니다.`
              : `${count}가지 가운데 ${placed}가지는 보낼 곳을 찾았습니다.`}
      </h2>
      {isEmitter ? <MoneySentence totals={totals} conditional={conditional} /> : null}

      <div className="mt-6">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7.5rem] gap-x-4 border-b border-line pb-2 text-[13px] text-muted sm:grid">
          <span>폐기물</span>
          <span>{isEmitter ? "받는 곳" : "상태"}</span>
          <span>조건</span>
          <span className="text-right">{isEmitter ? "한 달 차이" : ""}</span>
        </div>
        <ul className="divide-y divide-line border-b border-line sm:border-t-0">
          {result.assignments.map((assignment) => (
            <Row
              key={assignment.streamId}
              assignment={assignment}
              stream={streams.find((item) => item.id === assignment.streamId)}
              role={role}
              onOpenTalk={onOpenTalk}
            />
          ))}
        </ul>
        {isEmitter && totals.difference ? (
          <p className="flex items-baseline justify-between gap-4 py-4 font-semibold">
            <span>한 달 합계</span>
            <span className="text-[18px] tabular-nums">
              <ClaimValue claim={totals.difference} signed display={signedWon(totals.difference)} />
            </span>
          </p>
        ) : null}
      </div>

      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {conditional ? "‘조건 확인 뒤 확정’은 업체가 물건을 받아 확인한 뒤에 이 조건이 굳어진다는 뜻입니다. " : ""}
        숫자를 누르면 계약서·측정값·법 조항 같은 근거가 열립니다.
        {assumptionIds.length > 0 ? (
          <>
            {" "}
            측정값이 없어 가정한 값이 {assumptionIds.length}개 있습니다.{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-ink"
              onClick={() => openEvidence(assumptionIds, "이 결과에 쓴 가정값")}
            >
              가정값 보기
            </button>
          </>
        ) : null}
        {isEmitter && totals.carbon ? (
          <>
            {" "}
            탄소 배출 변화는{" "}
            <Glue>
              <ClaimValue claim={totals.carbon} className="!font-normal" />
              입니다.
            </Glue>
          </>
        ) : null}
      </p>
    </section>
  );
}
