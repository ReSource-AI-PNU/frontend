import { formatUnitPrice } from "@/lib/v3/format";
import type { Assignment, Thread, ViewStream } from "@/lib/v3/types";
import { ClaimValue } from "@/components/v3/claim";

export function VendorComparison({
  assignments,
  streams,
  threads,
  onOpenTalk,
}: {
  assignments: Assignment[];
  streams: ViewStream[];
  threads: Thread[];
  onOpenTalk: (threadId: string) => void;
}) {
  const matched = assignments.filter((item) => item.vendorOrgId && item.unitPrice);
  if (matched.length === 0) return null;

  return (
    <section aria-labelledby="vendor-comparison-heading" className="border-t border-line pt-6">
      <h2 id="vendor-comparison-heading" className="text-[20px] leading-snug font-semibold tracking-[-0.02em]">
        업체 견적 비교
      </h2>
      <div className="mt-5 space-y-5">
        {matched.map((item) => {
          const itemThreads = threads.filter((thread) => thread.streamIds.includes(item.streamId));
          const stream = streams.find((row) => row.id === item.streamId);
          const quotes = [
            { ...item, selected: true, threadId: item.threadId },
            ...item.alternatives
              .filter((row) =>
                row.vendorOrgId && row.unitPrice && row.pickupStatus !== "unavailable" && row.permit?.level !== "mismatch",
              )
              .map((row) => ({
                ...row,
                selected: false,
                threadId: itemThreads.find((thread) => thread.vendorOrgId === row.vendorOrgId)?.id,
              })),
          ];

          return (
            <div key={item.streamId}>
              <h3 className="font-medium">{stream?.name ?? stream?.label ?? "폐기물"}</h3>
              <ul className="mt-2 grid gap-2.5 sm:grid-cols-3">
                {quotes.map((quote) => (
                  <li key={quote.vendorOrgId} className="rounded-xl border border-line p-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <h4 className="font-medium">{quote.vendorName ?? "처리 업체"}</h4>
                      {/* 상태 표시는 다른 화면과 같은 네모 태그로 둔다(AGENTS.md 화면 규칙) */}
                      {quote.selected ? <span className="inline-flex h-6 items-center rounded-[6px] bg-gain-bg px-2 text-[13px] font-medium text-gain">선택된 처리 후보</span> : null}
                    </div>
                    <div className="mt-2 text-[16px] font-semibold tabular-nums">
                      <ClaimValue claim={quote.unitPrice} display={formatUnitPrice(quote.unitPrice) ?? undefined} />
                    </div>
                    {quote.transportPending ? <p className="mt-1 text-[13px] text-warn">운반비 확인 필요</p> : null}
                    {quote.threadId ? (
                      <button
                        type="button"
                        className="mt-1 min-h-11 text-[13.5px] font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
                        onClick={() => { if (quote.threadId) onOpenTalk(quote.threadId); }}
                      >
                        협상 대화 보기
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
