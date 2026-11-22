"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { REVIEWER_NAME } from "@/lib/v3/labels";
import type { ContractReview, ReviewItem } from "@/lib/v3/types";

/**
 * 계약 검토 담당의 검토(백엔드 agents/reviewer.py, 2026-11-19 멘토링 "엄밀하게 체크하는 새 에이전트 · 최소한의 안전장치").
 * 두 AI가 합의한 조건을 사람이 승인하기 전에 규칙으로 다시 대조한 결과를 승인 상자 안에 둔다.
 *
 * - 요약 먼저: 검토 문장 한 줄, 그 아래 막힘·확인할 것은 접지 않고(행동해야 하는 것), 통과한 항목은 "통과한 항목 보기"로 접는다.
 * - 칩 색은 상태 칩 규칙을 따른다: 막힘 `loss-bg`, 확인할 것 `warn-bg`, 통과 `sunken`, 모두 맞음 먹 채움.
 * - 확인할 것이 있으면 담당자가 "확인했습니다"를 골라야 승인 단추가 켜진다(needsAck). 막힘이 있으면 양쪽 모두 승인할 수 없다.
 */

const WORD: Record<ReviewItem["status"], string> = { block: "막힘", check: "확인할 것", ok: "통과" };
const CHIP: Record<ReviewItem["status"], string> = {
  block: "bg-loss-bg text-loss",
  check: "bg-warn-bg text-warn",
  ok: "bg-sunken text-ink-2",
};
const chip = "inline-flex min-h-6 shrink-0 items-center rounded-[6px] px-2 text-[13px] font-medium";

/** 막힘이 있어 양쪽 모두 승인할 수 없다 */
export function reviewBlocked(review: ContractReview | null | undefined): boolean {
  return review?.status === "blocked";
}

/** 승인하기 전에 담당자가 확인했다고 골라야 하는지 */
export function needsAck(review: ContractReview | null | undefined): boolean {
  return Boolean(review && review.status !== "blocked" && review.items.some((item) => item.status === "check"));
}

function OverallChip({ review }: { review: ContractReview }) {
  const checks = review.items.filter((item) => item.status === "check").length;
  if (review.status === "blocked") return <span className={`${chip} bg-loss-bg text-loss`}>승인 불가</span>;
  if (review.status === "needs_check") return <span className={`${chip} bg-warn-bg text-warn`}>확인할 것 {checks}가지</span>;
  return <span className={`${chip} bg-ink text-on-ink`}>모두 맞음</span>;
}

function Line({ item }: { item: ReviewItem }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-2.5 gap-y-0.5">
      <span className={`${chip} ${CHIP[item.status]}`}>{WORD[item.status]}</span>
      <span className="font-medium text-ink">{item.title}</span>
      <span aria-hidden="true" />
      <span className="text-[13.5px] leading-relaxed text-ink-2">{item.text}</span>
    </li>
  );
}

export function ContractReviewBox({
  review,
  acknowledged = false,
  onAcknowledge,
  className = "",
}: {
  review: ContractReview;
  /** 담당자가 확인할 것을 확인했다고 골랐는지 */
  acknowledged?: boolean;
  /** 주면 "확인했습니다" 선택을 보인다(이 화면의 사람이 아직 승인하지 않았을 때만 준다) */
  onAcknowledge?: (value: boolean) => void;
  className?: string;
}) {
  const urgent = review.items.filter((item) => item.status !== "ok");
  const passed = review.items.filter((item) => item.status === "ok");
  const pilot = review.items.find((item) => item.key === "pilot" && item.pilot);
  const checks = review.items.filter((item) => item.status === "check").length;
  const blocking = review.items.filter((item) => item.status === "block");
  return (
    <div className={`border-t border-line pt-4 ${className}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        <span className="font-semibold text-ink-2">{REVIEWER_NAME}</span>
        <span>· 승인 전에 합의 조건을 다시 대조했습니다</span>
        <OverallChip review={review} />
      </p>
      {/* 접혀 있을 때는 무엇을 확인해야 하는지 이름만 보인다. 문장은 "자세히 보기"에 있다 */}
      {urgent.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {urgent.map((item) => (
            <li key={item.key} className={`${chip} ${CHIP[item.status]}`}>
              {item.title}
            </li>
          ))}
        </ul>
      ) : null}
      {/* 승인을 막는 항목은 접지 않는다: 왜 막혔는지는 바로 보여야 한다 */}
      {blocking.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {blocking.map((item) => (
            <Line key={item.key} item={item} />
          ))}
        </ul>
      ) : null}
      <MoreDetails className="mt-1" label="자세히 보기" hint={`통과 ${passed.length} · 확인 ${urgent.length}`}>
        <p className="mt-1 text-[14px] leading-relaxed text-ink">{review.summary}</p>
        {pilot ? <p className="mt-1 text-[13px] text-muted">{pilot.text}</p> : null}
        <ul className="mt-3 space-y-2.5 pb-1">
          {[...urgent.filter((item) => item.status !== "block"), ...passed].map((item) => (
            <Line key={item.key} item={item} />
          ))}
        </ul>
      </MoreDetails>
      {review.status === "blocked" ? (
        <p className="mt-3 text-[13px] font-medium text-loss">막힌 항목이 풀릴 때까지 양쪽 모두 승인할 수 없습니다.</p>
      ) : onAcknowledge && checks > 0 ? (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledge(event.target.checked)}
            className="size-4 accent-ink"
          />
          확인할 것 {checks}가지를 읽고 확인했습니다
        </label>
      ) : null}
    </div>
  );
}
