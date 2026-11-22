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
    return <p className="text-sm text-muted">예시 업체 견적을 불러오지 못했습니다. 다시 찾기를 눌러 주세요.</p>;
  }
  if (comparison.items.length === 0) return null;

  return (
    <section aria-labelledby="vendor-comparison-heading" className="border-t border-line pt-6">
      <h2 id="vendor-comparison-heading" className="text-xl font-semibold">업체 견적 비교</h2>
      <p className="mt-1 text-sm text-ink-2">
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
                    {quote.selected ? <span className="text-xs font-medium text-good">예시 선택안</span> : null}
                  </div>
                  {quote.finalPrice !== null ? (
                    <p className="mt-2 text-base font-semibold tabular-nums">{quotePrice(quote.finalPrice)}</p>
                  ) : (
                    <p className="mt-2 text-sm text-ink-2">{quote.reason}</p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    월 최소 {formatNumber(quote.minimumKg)}kg · {quote.pickupDay}요일 수거 ·{" "}
                    {quote.pickupFee ? `수거비 ${formatNumber(quote.pickupFee)}원/회` : "수거비 포함"}
                  </p>
                  {quote.requestedPrice !== null && quote.firstPrice !== null && quote.finalPrice !== null ? (
                    <details className="mt-3 text-xs text-ink-2">
                      <summary className="cursor-pointer font-medium">단가 협상 보기</summary>
                      <dl className="mt-2 space-y-1.5 tabular-nums">
                        <div><dt className="inline text-muted">업체 첫 제안</dt>{" "}<dd className="inline">{quotePrice(quote.firstPrice)}</dd></div>
                        <div><dt className="inline text-muted">회사 측 요청</dt>{" "}<dd className="inline">{quotePrice(quote.requestedPrice)}</dd></div>
                        <div><dt className="inline text-muted">업체 최종 답변</dt>{" "}<dd className="inline">{quotePrice(quote.finalPrice)}</dd></div>
                      </dl>
                    </details>
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
