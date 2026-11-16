"use client";

import { ROUTE_LABEL, STATUS_LABEL } from "@/lib/v3/format";
import type { EdgeStatus, Result, TriStatus, ViewStream } from "@/lib/v3/types";
import { ClaimValue, NeedsCheck } from "./claim";
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

/** 결과 한 장: 흐름별 배정 업체, 경로, 단가, 월 손익과 현행 대비, 탄소, 가정값, 대안, 민감도 */
export function ResultSheet({
  result,
  streams,
  vendorName,
}: {
  result: Result | null;
  streams: ViewStream[];
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
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
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
          <dt className="text-muted">탄소</dt>
          <dd className="text-right">
            <ClaimValue claim={result.totals.carbon} />
          </dd>
        </dl>
        <StatusChip tone={TONE[result.status]}>{STATUS_LABEL[result.status]}</StatusChip>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-label text-muted">
              <th className="py-2 pr-3 font-semibold">흐름</th>
              <th className="py-2 pr-3 font-semibold">배정 업체 · 경로</th>
              <th className="py-2 pr-3 text-right font-semibold">단가</th>
              <th className="py-2 pr-3 text-right font-semibold">현행 월 손익</th>
              <th className="py-2 pr-3 text-right font-semibold">배정 후</th>
              <th className="py-2 pr-3 text-right font-semibold">현행 대비</th>
              <th className="py-2 pr-3 text-right font-semibold">탄소</th>
              <th className="py-2 font-semibold">판정</th>
            </tr>
          </thead>
          <tbody>
            {result.assignments.map((item) => {
              const source = stream(item.streamId);
              const price = item.unitPrice?.value;
              return (
                <tr key={item.streamId} className="border-b border-line align-top">
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{source?.name ?? item.streamId}</p>
                    <p className="text-[13px] text-muted">
                      {source?.material}
                      {source?.origin ? ` · ${source.origin}` : ""}
                      {source?.grade ? ` · ${source.grade.value}등급` : ""}
                      {source?.grade?.basis === "photo_estimate" ? " (사진 추정)" : ""}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {item.vendorOrgId ? (
                      <p className="font-semibold">{vendorName(item.vendorOrgId)}</p>
                    ) : (
                      <NeedsCheck />
                    )}
                    <p className="text-[13px] text-muted">
                      {item.route ? (ROUTE_LABEL[item.route] ?? item.route) : "경로 미정"}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ClaimValue claim={item.unitPrice} />
                    {typeof price === "number" ? (
                      <p className="text-[12px] text-muted">{price >= 0 ? "매입" : "처리비"}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ClaimValue claim={item.monthlyNow} signed />
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ClaimValue claim={item.monthlyAfter} signed />
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ClaimValue claim={item.difference} signed />
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ClaimValue claim={item.carbon} />
                  </td>
                  <td className="py-3">
                    <StatusChip tone={TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusChip>
                    {item.checks.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[13px]">
                        {item.checks.map((check) => (
                          <li key={check.key}>
                            <span className={`font-semibold ${CHECK_TONE[check.status]}`}>
                              {CHECK_LABEL[check.status]}
                            </span>{" "}
                            {check.text}{" "}
                            {check.evidence.length > 0 ? (
                              <button
                                type="button"
                                className="underline decoration-dotted underline-offset-4"
                                onClick={() => openEvidence(check.evidence, check.text)}
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
                          <li key={`${alt.route}-${index}`}>
                            대안: {alt.vendorOrgId ? `${vendorName(alt.vendorOrgId)} · ` : ""}
                            {ROUTE_LABEL[alt.route] ?? alt.route}{" "}
                            <ClaimValue claim={alt.monthlyAfter} signed /> {alt.note}
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
                    className="text-left font-mono text-[13px] underline decoration-dotted underline-offset-4"
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
              {result.sensitivity.map((item) => (
                <li key={item.label} className="flex justify-between gap-4">
                  <span>{item.label}</span>
                  <ClaimValue claim={item.difference} signed />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
