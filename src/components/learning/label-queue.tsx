import Link from "next/link";
import { reviewLabel } from "@/lib/server/learning-actions";
import type { LabelTask } from "@/lib/session/types";
import { formatDateTime } from "../dashboard/format-date";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";

const KIND: Record<LabelTask["kind"], string> = { box: "박스", ratio: "오염 비율", grade: "라벨", outcome: "실제 결과" };

/**
 * 라벨 검수 큐. AI 원래 값은 지우지 않고 취소선으로, 사람이 고친 값은 먹색 굵은 글씨로 보여 준다
 * (DESIGN.md "사람과 AI의 표시 구분").
 */
export function LabelQueue({ pending, reviewed }: { pending: LabelTask[]; reviewed: LabelTask[] }) {
  return (
    <div className="grid gap-4">
      {pending.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
          검수할 라벨이 없습니다. 현장 담당자가 식별 결과를 고치거나 업체가 실제 결과를 기록하면 여기에 쌓입니다.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line" aria-label={`검수 대기 ${pending.length}건`}>
          {pending.map((t) => (
            <li key={t.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <span className="font-semibold text-ink-2">{t.source}</span>· {KIND[t.kind]} ·{" "}
                  <span className="tabular-nums">{formatDateTime(t.createdAt)}</span>
                  {t.sessionId !== "seed" ? (
                    <Link href={`/session/${t.sessionId}`} className="underline underline-offset-4">
                      세션 보기
                    </Link>
                  ) : (
                    <span>시연용 예시</span>
                  )}
                </p>
                <p className="mt-0.5 text-[15px] font-semibold">{t.title}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="sr-only">수정 전 AI 값:</span>
                  <del className="text-muted decoration-1">{t.before}</del>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                  <span className="sr-only">사람이 고친 값:</span>
                  <ins className="font-semibold text-ink no-underline">{t.after}</ins>
                </p>
              </div>
              <div className="flex gap-2">
                <form action={reviewLabel.bind(null, t.id, "accepted")}>
                  <button type="submit" className={buttonClass("secondary", "sm")} aria-label={`${t.title} 수락`}>
                    수락
                  </button>
                </form>
                <form action={reviewLabel.bind(null, t.id, "rejected")}>
                  <button type="submit" className={buttonClass("ghost", "sm")} aria-label={`${t.title} 반려`}>
                    반려
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviewed.length > 0 ? (
        <details>
          <summary className="min-h-[34px] cursor-pointer text-[13px] font-semibold text-ink-2">최근 검수한 라벨 {reviewed.length}건 보기</summary>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {reviewed.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{t.title}</span>{" "}
                  <span className="text-muted">
                    <del>{t.before}</del> → <span className="text-ink">{t.after}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  {t.reviewer ? `${t.reviewer} 검수` : null}
                  <Badge tone={t.status === "accepted" ? "gain" : "loss"}>{t.status === "accepted" ? "수락" : "반려"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
