"use client";

import { FIELD_LABEL, ROUTE_LABEL, STATUS_LABEL } from "@/lib/v3/format";
import type { DiagnosisView, EdgeStatus, OrgRole, Result, TriStatus, ViewStream } from "@/lib/v3/types";
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
                    {item.checks.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[13px]">
                        {item.checks.map((check, index) => (
                          <li key={`${check.key}-${index}`}>
                            <span className={`font-semibold ${CHECK_TONE[check.status]}`}>
                              {CHECK_LABEL[check.status]}
                            </span>{" "}
                            <ClaimText text={check.text} claims={check.claims ?? []} />{" "}
                            {check.evidence.length > 0 ? (
                              <button
                                type="button"
                                className="underline decoration-dotted underline-offset-4"
                                onClick={() => openEvidence(check.evidence, "이 확인 항목의 근거")}
                              >
                                근거
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
              {result.assumptions.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="text-left font-mono text-[13px] break-all underline decoration-dotted underline-offset-4"
                    onClick={() => openEvidence([id], "가정값")}
                  >
                    {id}
                  </button>
                </li>
              ))}
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
