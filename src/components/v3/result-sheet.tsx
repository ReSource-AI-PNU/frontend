"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { CHECK_KEY_LABEL, FIELD_LABEL, ROUTE_LABEL, STATUS_LABEL, formatValue } from "@/lib/v3/format";
import type { Check, DiagnosisView, EdgeStatus, OrgRole, Result, TriStatus, ViewStream } from "@/lib/v3/types";
import { ClaimText, ClaimValue, NeedsCheck } from "./claim";
import { useV3 } from "./context";
import { StatusChip, type ChipTone } from "./status-chip";

const TONE: Record<TriStatus, ChipTone> = {
  calculated: "done",
  conditional: "warn",
  needs_information: "neutral",
};
const CHECK_LABEL: Record<EdgeStatus, string> = { met: "충족", conditional: "조건부", unmet: "불충족" };
const CHECK_TONE: Record<EdgeStatus, string> = {
  met: "text-ink",
  conditional: "text-warn",
  unmet: "text-loss",
};

const HAS_PLACEHOLDER = /\{\{/;

function CheckLine({ check }: { check: Check }) {
  const { openEvidence } = useV3();
  const claims = check.claims ?? [];
  // 적재 검사처럼 문장에 자리표시자가 없는데 값이 딸려 오면 문장 뒤에 이름과 값을 적는다
  const extra = HAS_PLACEHOLDER.test(check.text) ? [] : claims;
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-x-2">
      <span className={`font-semibold ${CHECK_TONE[check.status]}`}>{CHECK_LABEL[check.status]}</span>
      <span className="min-w-0">
        <span className="text-muted">{CHECK_KEY_LABEL[check.key] ?? check.key}</span>{" "}
        <ClaimText text={check.text} claims={claims} />
        {extra.length > 0 ? (
          <span className="text-ink-2">
            {" "}
            (
            {extra.map((claim, index) => (
              <span key={claim.id}>
                {index > 0 ? " · " : ""}
                {claim.label ?? claim.id} <ClaimValue claim={claim} />
              </span>
            ))}
            )
          </span>
        ) : null}{" "}
        {check.evidence.length > 0 ? (
          <button
            type="button"
            className="underline decoration-dotted underline-offset-4"
            onClick={() => openEvidence(check.evidence, `${CHECK_KEY_LABEL[check.key] ?? "확인 항목"}의 근거`)}
          >
            근거
          </button>
        ) : null}
      </span>
    </li>
  );
}

/**
 * 배정 한 건의 확인 항목. 판정 칸이 길어지지 않게 건수만 먼저 적고 나머지는 접어 둔다.
 * 담당자가 움직여야 하는 것(불충족, 담당자 인계, 모르는 값)은 접지 않는다.
 */
function Checks({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return null;
  const pinned = checks.filter(
    (check) => check.status === "unmet" || check.key === "handoff" || check.key === "unresolved",
  );
  const rest = checks.filter((check) => !pinned.includes(check));
  const conditions = rest.filter((check) => check.key === "vendor_condition");
  const todo = rest.filter((check) => check.key !== "vendor_condition" && check.status !== "met");
  const met = rest.filter((check) => check.key !== "vendor_condition" && check.status === "met");
  const groups = [
    { title: "업체가 내건 조건", items: conditions },
    { title: "확인할 것", items: todo },
    { title: "충족", items: met },
  ].filter((group) => group.items.length > 0);
  return (
    <div className="mt-2 text-[13px]">
      {pinned.length > 0 ? (
        <ul className="mb-1 space-y-1">
          {pinned.map((check, index) => (
            <CheckLine key={`${check.key}-${index}`} check={check} />
          ))}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <>
          <p className="text-ink-2">
            조건 <span className="font-mono font-semibold">{conditions.length}</span>건 · 확인 필요{" "}
            <span className="font-mono font-semibold">{todo.length}</span>건
            {met.length > 0 ? (
              <>
                {" "}
                · 충족 <span className="font-mono font-semibold">{met.length}</span>건
              </>
            ) : null}
          </p>
          <MoreDetails label="펼치기" closeLabel="접기" className="-mt-1.5">
            <div className="space-y-2 pb-1">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="text-label text-muted">{group.title}</p>
                  <ul className="mt-0.5 space-y-1">
                    {group.items.map((check, index) => (
                      <CheckLine key={`${check.key}-${index}`} check={check} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </MoreDetails>
        </>
      ) : null}
    </div>
  );
}

/** 결과 한 장: 흐름별 배정 업체, 경로, 단가, 월 손익과 현행 대비, 탄소, 가정값, 대안, 민감도, 참고 시세 */
export function ResultSheet({
  result,
  streams,
  unresolved,
  role,
  vendorName,
}: {
  result: Result | null;
  streams: ViewStream[];
  unresolved: DiagnosisView["unresolved"];
  /** 업체에게는 배출 기업의 현행 대비 손익이 오지 않는다. 없는 값을 "확인 필요"로 보이지 않게 칸을 뺀다 */
  role: OrgRole;
  vendorName: (orgId: string | null) => string;
}) {
  const { openEvidence } = useV3();
  if (!result) {
    return (
      <p className="p-5 text-sm text-muted">
        아직 결과가 없습니다. 에이전트 대화가 끝나면 흐름별 배정과 월 손익이 여기에 나옵니다.
      </p>
    );
  }
  const stream = (id: string) => streams.find((item) => item.id === id);
  const full = role !== "vendor";
  return (
    <div className="space-y-5 p-5">
      {full ? null : (
        <p className="text-sm text-muted">
          이 업체에 배정된 흐름과 조건만 보입니다. 배출 기업의 현행 처리와 현행 대비 손익, 다른 업체의 조건은
          업체에게 보이지 않습니다.
        </p>
      )}
      <div className={full ? "flex flex-wrap items-end gap-x-8 gap-y-3" : "hidden"}>
        <div>
          <p className="text-label text-muted">현행 대비 월 손익</p>
          <p className="text-display">
            <ClaimValue claim={result.totals.difference} signed title="공장 현행 대비 월 손익" />
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">현행</dt>
          <dd className="text-right">
            <ClaimValue claim={result.totals.monthlyNow} signed />
          </dd>
          <dt className="text-muted">배정 후</dt>
          <dd className="text-right">
            <ClaimValue claim={result.totals.monthlyAfter} signed />
          </dd>
          <dt className="text-muted">탄소 합계</dt>
          <dd className="text-right">
            <ClaimValue claim={result.totals.carbon} />
          </dd>
        </dl>
        <div className="space-y-1">
          <StatusChip tone={TONE[result.status]}>{STATUS_LABEL[result.status]}</StatusChip>
          <p className="text-[12px] text-muted">
            {result.carbonInObjective
              ? "배정을 고를 때 탄소도 가중치로 넣었습니다."
              : "배정은 월 순비용만으로 골랐습니다. 탄소는 참고 값입니다."}
          </p>
        </div>
      </div>

      {unresolved.length > 0 ? (
        <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">
          <span className="font-semibold">확인 필요로 남은 값</span> · 질문 한도를 다 쓰고도 모르는 값입니다:{" "}
          {unresolved
            .map((item) => `${stream(item.streamId)?.name ?? item.streamId} ${FIELD_LABEL[item.field] ?? item.field}`)
            .join(", ")}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-label text-muted">
              <th className="py-2 pr-3 font-semibold">흐름</th>
              <th className="py-2 pr-3 font-semibold">배정 업체 · 경로</th>
              <th className="py-2 pr-3 text-right font-semibold">단가</th>
              {full ? (
                <>
                  <th className="py-2 pr-3 text-right font-semibold">현행 월 손익</th>
                  <th className="py-2 pr-3 text-right font-semibold">배정 후</th>
                  <th className="py-2 pr-3 text-right font-semibold">현행 대비</th>
                  <th className="py-2 pr-3 text-right font-semibold">탄소</th>
                </>
              ) : null}
              <th className="py-2 font-semibold">판정</th>
            </tr>
          </thead>
          <tbody>
            {result.assignments.map((item) => {
              const source = stream(item.streamId);
              return (
                <tr key={item.streamId} className="border-b border-line align-top">
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{source?.name ?? item.streamId}</p>
                    <p className="text-[13px] text-muted">
                      {[source?.material, source?.origin].filter(Boolean).join(" · ")}
                      {source?.grade.value ? ` · ${source.grade.value}등급 (${source.grade.label})` : " · 등급 확인 필요"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {item.vendorOrgId ? (
                      <p className="font-semibold">{item.vendorName ?? vendorName(item.vendorOrgId)}</p>
                    ) : item.checks.some((check) => check.key === "handoff") ? (
                      <StatusChip tone="warn">담당자 인계</StatusChip>
                    ) : (
                      <NeedsCheck />
                    )}
                    <p className="text-[13px] text-muted">
                      {item.route ? (ROUTE_LABEL[item.route] ?? item.route) : "경로 미정"}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <ClaimValue claim={item.unitPrice} price />
                  </td>
                  {full ? (
                    <>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <ClaimValue claim={item.monthlyNow} signed />
                    {item.currentAssumed ? (
                      <p className="text-[12px] font-semibold text-warn">현행은 가정값</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <ClaimValue claim={item.monthlyAfter} signed />
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <ClaimValue claim={item.difference} signed />
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <ClaimValue claim={item.carbon} />
                    {item.carbonValue ? (
                      <p className="text-[12px] text-muted">
                        배출권 환산 <ClaimValue claim={item.carbonValue} />
                      </p>
                    ) : null}
                  </td>
                    </>
                  ) : null}
                  <td className="min-w-[16rem] py-3">
                    <StatusChip tone={TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusChip>
                    <Checks checks={item.checks} />
                    {item.alternatives.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[13px] text-muted">
                        {item.alternatives.map((alt, index) => (
                          <li key={`${alt.vendorOrgId}-${alt.route}-${index}`}>
                            대안: {alt.vendorName ?? (alt.vendorOrgId ? vendorName(alt.vendorOrgId) : "")}
                            {" · "}
                            {ROUTE_LABEL[alt.route] ?? alt.route} <ClaimValue claim={alt.unitPrice} price /> → 월{" "}
                            <ClaimValue claim={alt.monthlyAfter} signed /> {alt.note ? `(${alt.note})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted">
        단가는 배출 기업 기준입니다. <span className="font-semibold text-ink-2">매입</span>은 업체에서 받는 돈,{" "}
        <span className="font-semibold text-ink-2">처리비</span>는 업체에 내는 돈입니다. 월 손익은 받는 돈이 +,
        내는 돈이 −입니다.
      </p>

      {full ? (
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="text-label text-muted">가정값</h3>
          {result.assumptions.length === 0 ? (
            <p className="mt-1 text-sm text-muted">이 결과에 쓴 가정값이 없습니다.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {result.assumptions.map((item) => {
                const value = formatValue(item.value, item.unit);
                return (
                  <li key={item.id} className="flex justify-between gap-4">
                    <button
                      type="button"
                      title="근거 보기"
                      className="min-w-0 text-left underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-ink"
                      onClick={() => openEvidence([item.id], item.label)}
                    >
                      {item.label}
                    </button>
                    {value !== null ? (
                      <span className="font-mono font-semibold whitespace-nowrap tabular-nums">{value}</span>
                    ) : (
                      <span className="text-[13px] whitespace-nowrap text-muted">표 (눌러서 보기)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <h3 className="text-label text-muted">현행 처리에 따른 민감도</h3>
          {result.sensitivity.length === 0 ? (
            <p className="mt-1 text-sm text-muted">계산한 민감도가 없습니다.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {result.sensitivity.map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex justify-between gap-4">
                  <span>{item.label}</span>
                  <span className="whitespace-nowrap">
                    현행 대비 <ClaimValue claim={item.difference} signed />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      ) : null}

      {result.referencePrices.length > 0 ? (
        <section>
          <h3 className="text-label text-muted">참고 시세 (손익 계산에 쓰지 않음)</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {result.referencePrices.map((item) => (
              <li key={item.key} className="flex flex-wrap justify-between gap-x-4">
                <span>
                  {item.label} <span className="font-mono text-[12px] text-muted">기준일 {item.asOf}</span>
                </span>
                <ClaimValue claim={item.price} price={false} />
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[13px] text-muted">{result.referencePrices[0].note}</p>
        </section>
      ) : null}
    </div>
  );
}
