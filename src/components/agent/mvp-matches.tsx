import { formatNumber, formatSignedPrice } from "@/lib/v3/format";
import type { DiagnosisView } from "@/lib/v3/types";

type Matches = NonNullable<DiagnosisView["mvpMatches"]>;

export function MvpMatches({ items }: { items: Matches }) {
  return (
    <section aria-labelledby="mvp-matches-heading" className="border-t border-line pt-6">
      <h2 id="mvp-matches-heading" className="text-[22px] font-semibold">시범 업체 매칭 결과</h2>
      <p className="mt-1 text-sm text-ink-2">
        등록 업체에 배정되지 않은 품목을 시범 업체 조건으로 매칭했습니다. 실제 거래에는 사용할 수 없습니다.
      </p>

      {items.map((item) => (
        <div key={item.streamId} className="mt-5">
          <h3 className="font-medium">{item.name}</h3>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-3">
            {item.quotes.map((quote) => (
              <li key={quote.name} className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <h4 className="font-medium">{quote.name}</h4>
                  {quote.selected ? <span className="text-xs font-medium text-good">시범 선택안</span> : null}
                </div>
                <p className="mt-2 text-base font-semibold tabular-nums">{formatSignedPrice(quote.finalPrice)}</p>
                {quote.conditional ? <p className="mt-1 text-sm text-ink-2">반입 조건 확인 뒤 적용</p> : null}
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  월 최소 {formatNumber(quote.minimumKg)}kg · {quote.pickupDay}요일 수거 ·{" "}
                  {quote.pickupFee ? `수거비 ${formatNumber(quote.pickupFee)}원/회` : "수거비 포함"}
                </p>
                <details className="mt-3 text-sm text-ink-2">
                  <summary className="cursor-pointer font-medium">{quote.requestedPrice === null ? "매입 조건 보기" : "단가 협상 보기"}</summary>
                  <p className="mt-2 text-xs text-muted">
                    오염도 {formatNumber(quote.maxContaminationPct)}% 이하 · 수분 {formatNumber(quote.maxMoisturePct)}% 이하
                  </p>
                  {quote.requestedPrice !== null ? (
                    <dl className="mt-2 space-y-1.5 text-xs tabular-nums">
                      <div><dt className="inline text-muted">업체 첫 제안</dt>{" "}<dd className="inline">{formatSignedPrice(quote.firstPrice)}</dd></div>
                      <div><dt className="inline text-muted">회사 측 요청</dt>{" "}<dd className="inline">{formatSignedPrice(quote.requestedPrice)}</dd></div>
                      <div><dt className="inline text-muted">업체 최종 답변</dt>{" "}<dd className="inline">{formatSignedPrice(quote.finalPrice)}</dd></div>
                    </dl>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
