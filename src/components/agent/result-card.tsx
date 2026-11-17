"use client";

import { ChevronDownIcon } from "@/components/icons";
import { ClaimText, ClaimValue } from "@/components/v3/claim";
import { useV3 } from "@/components/v3/context";
import { CHECK_KEY_LABEL, ROUTE_LABEL, STATUS_LABEL } from "@/lib/v3/format";
import type { Assignment, OrgRole, Result, ViewStream } from "@/lib/v3/types";

const STATUS_TONE = {
  calculated: "bg-brand-bg text-brand",
  conditional: "bg-warn-bg text-warn",
  needs_information: "bg-sunken text-ink-2",
} as const;
const CHECK_DOT = {
  met: "bg-brand",
  conditional: "bg-warn",
  unmet: "bg-loss",
  needs_information: "bg-line-strong",
} as const;
const CHECK_WORD = { met: "충족", conditional: "조건부", unmet: "불충족", needs_information: "확인 필요" } as const;

function Route({
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
  const placed = Boolean(assignment.vendorOrgId);
  const open = assignment.checks.filter((item) => item.status !== "met");
  const facts = [stream?.material, stream?.form].filter(Boolean).join(" · ");
  return (
    <li className="py-5">
      <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(40px,1fr)_auto]">
        <div className="min-w-0">
          <p className="font-semibold">{stream?.name ?? assignment.streamId}</p>
          <p className="text-[13px] text-muted">
            {facts}
            {facts && stream?.monthlyKg ? " · " : ""}
            {stream?.monthlyKg ? <ClaimValue claim={stream.monthlyKg} className="font-normal" /> : null}
          </p>
        </div>
        {/* 안전선: 흐름이 업체로 이어진다. 받을 곳이 없으면 끊긴 회색 선 */}
        <span
          aria-hidden="true"
          className={`hidden h-[3px] rounded-full sm:block ${placed ? "lane" : "bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_6px,transparent_6px_12px)]"}`}
        />
        <div className="min-w-0 sm:text-right">
          <p className="font-semibold">
            {placed ? assignment.vendorName : "받을 곳을 찾지 못했습니다"}
            <span
              className={`ml-2 inline-flex h-6 items-center rounded-full px-2 align-middle text-[12px] font-semibold ${STATUS_TONE[assignment.status]}`}
            >
              {STATUS_LABEL[assignment.status]}
            </span>
          </p>
          <p className="text-[13px] text-ink-2">
            {assignment.route ? `${ROUTE_LABEL[assignment.route] ?? assignment.route} · ` : ""}
            {assignment.unitPrice ? <ClaimValue claim={assignment.unitPrice} className="font-normal" /> : placed ? "단가 확인 필요" : "지금 방식 유지"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        {role === "emitter" && assignment.difference ? (
          <span className="text-ink-2">
            지금보다 <ClaimValue claim={assignment.difference} signed />
          </span>
        ) : null}
        {role === "emitter" && assignment.carbon ? (
          <span className="text-muted">
            탄소 <ClaimValue claim={assignment.carbon} className="font-normal" />
          </span>
        ) : null}
        {assignment.threadId ? (
          <button
            type="button"
            onClick={() => onOpenTalk(assignment.threadId as string)}
            className="rounded-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            대화 보기
          </button>
        ) : null}
      </div>

      {assignment.checks.length > 0 || assignment.alternatives.length > 0 ? (
        <details className="group mt-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon className="transition-transform group-open:rotate-180" />
            {open.length > 0 ? `확인할 것 ${open.length}개` : "조건을 모두 충족했습니다"}
            {assignment.alternatives.length > 0 ? ` · 다른 선택지 ${assignment.alternatives.length}개` : ""}
          </summary>
          <ul className="mt-1 space-y-2.5 border-l-2 border-line pl-4 text-sm">
            {assignment.checks.map((check, index) => (
              <li key={`${check.key}-${index}`} className="grid grid-cols-[auto_1fr] gap-x-2">
                <span aria-hidden="true" className={`mt-[9px] size-1.5 rounded-full ${CHECK_DOT[check.status]}`} />
                <p className="min-w-0">
                  <span className="font-semibold">{CHECK_KEY_LABEL[check.key] ?? check.key}</span>{" "}
                  <span className="text-[12px] text-muted">{CHECK_WORD[check.status]}</span>
                  <span className="block text-ink-2">
                    <ClaimText text={check.text} claims={check.claims ?? []} />{" "}
                    {check.evidence.length > 0 ? (
                      <button
                        type="button"
                        className="text-[13px] underline decoration-dotted underline-offset-4 hover:text-ink"
                        onClick={() => openEvidence(check.evidence, CHECK_KEY_LABEL[check.key] ?? check.key)}
                      >
                        근거
                      </button>
                    ) : null}
                  </span>
                </p>
              </li>
            ))}
            {assignment.alternatives.map((item, index) => (
              <li key={`alt-${index}`} className="grid grid-cols-[auto_1fr] gap-x-2">
                <span aria-hidden="true" className="mt-[9px] size-1.5 rounded-full border border-line-strong" />
                <p className="min-w-0">
                  <span className="font-semibold">다른 선택지 · {item.vendorName ?? ROUTE_LABEL[item.route] ?? item.route}</span>
                  <span className="block text-ink-2">
                    {item.unitPrice ? <ClaimValue claim={item.unitPrice} className="font-normal" /> : null}
                    {item.unitPrice && item.monthlyAfter ? " · " : ""}
                    {item.monthlyAfter ? <ClaimValue claim={item.monthlyAfter} signed className="font-normal" /> : null}
                    {item.note ? <span className="block text-[13px] text-muted">{item.note}</span> : null}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/**
 * 결과. 맨 위에 한 달 손익 차이 하나를 크게 쓰고, 그 아래 흐름마다 어느 업체로 가는지를 한 줄씩 잇는다.
 * 조건과 다른 선택지는 접어 둔다.
 */
export function ResultCard({
  result,
  streams,
  role,
  onOpenTalk,
}: {
  result: Result;
  streams: ViewStream[];
  role: OrgRole;
  onOpenTalk: (threadId: string) => void;
}) {
  const { openEvidence } = useV3();
  const { totals } = result;
  const placed = result.assignments.filter((item) => item.vendorOrgId).length;
  const assumptionIds = result.assumptions.map((item) => item.id);
  return (
    <div>
      {role === "emitter" ? (
        <>
          <p className="text-[15px] text-ink-2">
            흐름 {result.assignments.length}개 가운데 {placed}개가 갈 곳을 찾았습니다.
          </p>
          <p className="mt-2 text-[34px] leading-[1.15] font-bold tracking-[-0.03em] text-balance sm:text-[44px]">
            {totals.difference ? (
              <>
                지금보다 한 달에{" "}
                <ClaimValue claim={totals.difference} signed className="!font-bold decoration-2 underline-offset-[6px]" />
              </>
            ) : (
              "금액은 확인이 더 필요합니다"
            )}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            {totals.monthlyNow ? (
              <span>
                지금 <ClaimValue claim={totals.monthlyNow} signed className="font-normal" />
              </span>
            ) : null}
            {totals.monthlyNow && totals.monthlyAfter ? <span aria-hidden="true" className="lane h-[3px] w-8 rounded-full" /> : null}
            {totals.monthlyAfter ? (
              <span>
                바꾸면 <ClaimValue claim={totals.monthlyAfter} signed className="font-normal" />
              </span>
            ) : null}
            {totals.carbon ? (
              <span className="text-muted">
                · 탄소 <ClaimValue claim={totals.carbon} className="font-normal" />
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-[26px] leading-tight font-bold tracking-[-0.025em]">
          들어온 흐름 {result.assignments.length}개
        </p>
      )}

      {result.status !== "calculated" ? (
        <p className="mt-4 rounded-lg bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
          {result.status === "conditional"
            ? "조건이 붙은 결과입니다. 흐름마다 ‘확인할 것’이 맞아야 이 조건으로 진행됩니다."
            : "모르는 값이 남아 있어 일부 금액을 계산하지 못했습니다."}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {result.assignments.map((assignment) => (
          <Route
            key={assignment.streamId}
            assignment={assignment}
            stream={streams.find((item) => item.id === assignment.streamId)}
            role={role}
            onOpenTalk={onOpenTalk}
          />
        ))}
      </ul>

      {assumptionIds.length > 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          이 계산에는 가정값 {assumptionIds.length}개가 쓰였습니다.{" "}
          <button
            type="button"
            className="underline decoration-dotted underline-offset-4 hover:text-ink"
            onClick={() => openEvidence(assumptionIds, "이 결과에 쓴 가정값")}
          >
            가정값 보기
          </button>
        </p>
      ) : null}
    </div>
  );
}
