import { MoreDetails } from "@/components/ui/more-details";
import { formatNumber, priceSide } from "@/lib/v3/format";
import type { DiagnosisView } from "@/lib/v3/types";

type Comparison = NonNullable<DiagnosisView["vendorComparison"]>;

function quotePrice(price: number) {
  const direction = priceSide(price);
  if (direction === "무상") return direction;
  return `${direction} ${formatNumber(Math.abs(price))}원/kg`;
}

export function VendorComparison({ comparison }: { comparison: Comparison }) {
  if (comparison.status === "unavailable") {
    return <p className="text-[14px] text-ink-2">예시 업체 견적을 불러오지 못했습니다. 다시 찾기를 눌러 주세요.</p>;
  }
  if (comparison.items.length === 0) return null;

  return (
    <section aria-labelledby="vendor-comparison-heading" className="border-t border-line pt-6">
      <h2 id="vendor-comparison-heading" className="text-[20px] leading-snug font-semibold tracking-[-0.02em]">
        업체 견적 비교
      </h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
        등록한 폐기물 조건으로 계산한 예시 견적입니다. 실제 거래와 승인에는 반영되지 않습니다.
      </p>
      <div className="mt-5 space-y-5">
        {comparison.items.map((item) => (
          <div key={item.streamId}>
            <h3 className="font-medium">{item.name}</h3>
            <ul className="mt-2 grid gap-2.5 sm:grid-cols-3">
              {item.quotes.map((quote) => (
                <li key={quote.name} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <h4 className="font-medium">{quote.name}</h4>
                    {/* 상태 표시는 다른 화면과 같은 네모 태그로 둔다(화면 규칙) */}
                    {quote.selected ? (
                      <span className="inline-flex h-6 items-center rounded-[6px] bg-gain-bg px-2 text-[13px] font-medium text-gain">
                        예시 선택안
                      </span>
                    ) : null}
                  </div>
                  {quote.finalPrice !== null ? (
                    <p className="mt-2 text-[16px] font-semibold tabular-nums">{quotePrice(quote.finalPrice)}</p>
                  ) : (
                    <p className="mt-2 text-[14px] text-ink-2">{quote.reason}</p>
                  )}
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    월 최소 {formatNumber(quote.minimumKg)}kg · {quote.pickupDay}요일 수거 ·{" "}
                    {quote.pickupFee ? `수거비 ${formatNumber(quote.pickupFee)}원/회` : "수거비 포함"}
                  </p>
                  {quote.requestedPrice !== null && quote.firstPrice !== null && quote.finalPrice !== null ? (
                    <MoreDetails label="단가 협상 보기" closeLabel="단가 협상 접기" className="mt-1">
                      <dl className="space-y-1.5 text-[13px] text-ink-2 tabular-nums">
                        <div><dt className="inline text-muted">업체 첫 제안</dt>{" "}<dd className="inline">{quotePrice(quote.firstPrice)}</dd></div>
                        <div><dt className="inline text-muted">회사 측 요청</dt>{" "}<dd className="inline">{quotePrice(quote.requestedPrice)}</dd></div>
                        <div><dt className="inline text-muted">업체 최종 답변</dt>{" "}<dd className="inline">{quotePrice(quote.finalPrice)}</dd></div>
                      </dl>
                    </MoreDetails>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
