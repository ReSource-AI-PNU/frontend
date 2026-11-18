"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { ClaimValue, Glue } from "@/components/v3/claim";
import { StatusChip } from "@/components/v3/status-chip";
import {
  IMPROVE_FOOT,
  IMPROVE_LEAD,
  SPLIT_LEAD,
  gradeText,
  needsText,
  planImprovements,
  splitNobody,
  type ImproveStream,
} from "@/lib/v3/improve";
import { josa } from "@/lib/josa";
import { formatNumber } from "@/lib/v3/format";
import type { Improvement, ViewStream } from "@/lib/v3/types";

function Option({ item }: { item: ImproveStream }) {
  const option = item.option;
  if (!option) return null;
  const vendor = option.vendorName ?? "대화한 업체";
  const gain = typeof option.monthlyGain?.value === "number" ? option.monthlyGain.value : null;
  return (
    <div className="mt-2 rounded-xl bg-ground px-4 py-3">
      <p className="text-[15px] leading-relaxed">
        {josa(vendor, "은/는")} {josa(gradeText(option.grade), "을/를")}{" "}
        <Glue>
          <ClaimValue claim={option.unitPrice} title={`${vendor} ${gradeText(option.grade)} 단가`} />으로
        </Glue>{" "}
        받습니다. {josa(needsText(option.needs), "을/를")} 기준 안으로 낮추면 지금보다 한 달 손익이
        {gain !== null ? (
          <>
            {" "}
            <Glue>
              <ClaimValue
                claim={option.monthlyGain}
                signed
                display={`+${formatNumber(gain)}원`}
                title={`${item.name} 손질 뒤 한 달 차이`}
              />{" "}
              나아집니다.
            </Glue>
          </>
        ) : (
          " 나아집니다."
        )}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        {option.maxContamination ? (
          <>
            오염도 상한 <ClaimValue claim={option.maxContamination} title={`${vendor} ${gradeText(option.grade)} 오염도 상한`} />
          </>
        ) : null}
        {option.maxContamination && option.maxMoisture ? " · " : null}
        {option.maxMoisture ? (
          <>
            수분 상한 <ClaimValue claim={option.maxMoisture} title={`${vendor} ${gradeText(option.grade)} 수분 상한`} />
          </>
        ) : null}
        <span className="text-muted"> · 검수에서 기준 안으로 확인되면</span>
      </p>
    </div>
  );
}

function Split({ item }: { item: ImproveStream }) {
  if (item.split.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[14px] text-ink-2">{SPLIT_LEAD}</p>
      <ul className="mt-1 divide-y divide-line border-y border-line">
        {item.split.map((part) => (
          <li key={part.material} className="grid gap-x-3 gap-y-0.5 py-2.5 text-[14px] sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <span className="font-semibold">{part.material}</span>
            {part.vendorOrgId ? (
              <span className="text-ink-2">
                {part.vendorName ?? "대화한 업체"} {gradeText(part.grade)} ·{" "}
                <ClaimValue claim={part.unitPrice} title={`${part.material} ${gradeText(part.grade)} 단가`} />
                {part.maxContamination ? (
                  <>
                    {" "}
                    · 오염도 상한{" "}
                    <ClaimValue claim={part.maxContamination} title={`${part.material} ${gradeText(part.grade)} 오염도 상한`} />
                  </>
                ) : null}
                {part.meetsNow ? <span className="text-muted"> · 지금 오염도로도 기준 안</span> : null}
              </span>
            ) : (
              <span className="text-ink-2">{splitNobody(part.material)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 결과 아래(배출 기업만): 폐기물마다 무엇을 하면 어느 업체가 얼마에 더 받는지 */
export function ImprovementsSection({ items, streams }: { items: Improvement[]; streams: ViewStream[] }) {
  const nameOf = (id: string) => {
    const stream = streams.find((item) => item.id === id);
    return stream?.name ?? stream?.label ?? "폐기물";
  };
  const plan = planImprovements(items, nameOf);
  if (plan.streams.length === 0 && plan.common.length === 0) return null;
  const better = plan.streams.filter((item) => item.option);
  const others = plan.streams.filter((item) => !item.option);
  return (
    <section aria-label="분리 개선 안내" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{plan.headline}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{IMPROVE_LEAD}</p>
      <ul className="mt-4 space-y-6">
        {[...better, ...others].map((item) => (
          <li key={item.streamId}>
            <h3 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
              {item.name}
              {item.option ? <StatusChip tone="neutral">더 받는 길 있음</StatusChip> : null}
            </h3>
            <Option item={item} />
            <Split item={item} />
            {item.actions.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-ink-2 marker:text-muted">
                {item.actions.map((action) => (
                  <li key={action.key}>{action.text}</li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
      {plan.common.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-[14px] font-medium text-muted">모든 폐기물에 해 두면 좋은 기록</h3>
          <ul className="mt-1.5 space-y-1.5 text-[14px] leading-relaxed text-ink-2">
            {plan.common.map((item) => (
              <li key={item.key}>
                {item.text} <span className="text-muted">({item.names.join(", ")})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <MoreDetails className="mt-2" label="계산 방법 보기" closeLabel="접기">
        <p className="pb-2 text-[13px] leading-relaxed text-muted">{IMPROVE_FOOT}</p>
      </MoreDetails>
    </section>
  );
}
