"use client";

import { FIELD_LABEL } from "@/lib/v3/format";
import type { DiagnosisView, ViewStream } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";

/** ① 식별·분류 결과: 흐름마다 물량, 오염도, 수분, 등급, 현행 처리. 값마다 근거가 열린다. */
export function StreamTable({
  streams,
  unresolved,
}: {
  streams: ViewStream[];
  unresolved: DiagnosisView["unresolved"];
}) {
  const { openEvidence } = useV3();
  if (streams.length === 0) {
    return <p className="p-5 text-sm text-muted">이 관점에서 볼 수 있는 흐름이 없습니다.</p>;
  }
  const showCurrent = streams.some((stream) => stream.currentTreatment);
  return (
    <div className="overflow-x-auto px-5 py-3">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-label text-muted">
            <th className="py-2 pr-3 font-semibold">흐름</th>
            <th className="py-2 pr-3 text-right font-semibold">월 발생량</th>
            <th className="py-2 pr-3 text-right font-semibold">오염도</th>
            <th className="py-2 pr-3 text-right font-semibold">수분</th>
            <th className="py-2 pr-3 font-semibold">등급</th>
            {showCurrent ? <th className="py-2 font-semibold">현행 처리</th> : null}
          </tr>
        </thead>
        <tbody>
          {streams.map((stream) => {
            const unknown = new Set([
              ...stream.unknownFields,
              ...unresolved.filter((item) => item.streamId === stream.id).map((item) => item.field),
            ]);
            return (
              <tr key={stream.id} className="border-b border-line align-top last:border-b-0">
                <td className="py-2.5 pr-3">
                  <p className="font-semibold">{stream.name}</p>
                  <p className="text-[13px] text-muted">
                    {[stream.process, stream.material, stream.origin, stream.form].filter(Boolean).join(" · ")}
                  </p>
                  {stream.contaminants.length > 0 ? (
                    <p className="text-[12px] text-muted">혼입물: {stream.contaminants.join(", ")}</p>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  <ClaimValue claim={stream.monthlyKg} />
                  {stream.monthlyKgBasis === "estimated" ? (
                    <p className="text-[12px] text-warn">추정</p>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  {stream.contamination ? (
                    <ClaimValue claim={stream.contamination} />
                  ) : stream.photoContamination ? (
                    <>
                      <ClaimValue claim={stream.photoContamination} />
                      <p className="text-[12px] text-muted">사진 추정</p>
                    </>
                  ) : (
                    <ClaimValue claim={null} />
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  <ClaimValue claim={stream.moisture} />
                  {unknown.has("moisturePct") ? <p className="text-[12px] text-muted">담당자 답: 모름</p> : null}
                </td>
                <td className="py-2.5 pr-3">
                  {stream.grade.value ? (
                    <button
                      type="button"
                      disabled={stream.grade.evidence.length === 0}
                      onClick={() => openEvidence(stream.grade.evidence, `${stream.name} 등급`)}
                      className="font-semibold underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-ink"
                    >
                      {stream.grade.value}
                    </button>
                  ) : (
                    <ClaimValue claim={null} />
                  )}
                  {stream.grade.value ? <p className="text-[12px] text-muted">{stream.grade.label}</p> : null}
                  {[...unknown].filter((item) => item !== "moisturePct").length > 0 ? (
                    <p className="text-[12px] text-muted">
                      모르는 값:{" "}
                      {[...unknown]
                        .filter((item) => item !== "moisturePct")
                        .map((item) => FIELD_LABEL[item] ?? item)
                        .join(", ")}
                    </p>
                  ) : null}
                </td>
                {showCurrent ? (
                  <td className="py-2.5">
                    {stream.currentTreatment ? (
                      <>
                        {stream.currentTreatment.method}{" "}
                        {stream.currentTreatment.assumed ? (
                          <span className="rounded-sm bg-warn-bg px-1 py-px text-[11px] font-semibold text-warn">
                            가정값
                          </span>
                        ) : null}
                        <p className="text-[13px] whitespace-nowrap text-muted">
                          내는 돈 <ClaimValue claim={stream.currentTreatment.unitCost} price={false} />
                        </p>
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
