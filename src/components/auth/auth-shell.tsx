import type { ReactNode } from "react";

/** 시연 공장 (주)한빛정밀(가상)의 진단 결과. 문제 정의 v2 9장, 숫자는 시연용 가정값이다 */
const LEDGER = [
  { label: "공장 폐플라스틱 흐름", value: "4", unit: "개", note: "스프루 · 불량품 · 퍼지 · 포장 필름" },
  { label: "AI가 정한 갈 곳", value: "4", unit: "가지", note: "재투입 · 매각 · 열분해 · 단지 묶음" },
  { label: "공장 월 손익", value: "−387,500 → +595,000", unit: "원", note: "현행 전부 소각 → 흐름별 최적안" },
];

/** 로그인·가입 화면의 2단 구성. 왼쪽은 폼, 오른쪽은 제품이 하는 일을 숫자로 보여 준다. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-12">
      <div className="flex items-center justify-center px-6 py-14 lg:col-span-5 lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-h1">{title}</h1>
          <p className="mt-1 mb-8 text-sm text-muted">{description}</p>
          {children}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-photo text-[#FAFAFA] lg:col-span-7 lg:flex lg:flex-col lg:justify-end lg:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <p className="relative max-w-md text-[40px] leading-[1.15] font-bold tracking-[-0.035em]">
          흐름별 사진이면,
          <br />
          공장 폐플라스틱의 갈 곳까지.
        </p>
        <dl className="relative mt-10 max-w-md border-t border-white/15">
          {LEDGER.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-6 border-b border-white/15 py-3.5">
              <dt className="text-sm text-white/60">
                {row.label}
                <span className="mt-0.5 block text-[12px] text-white/40">{row.note}</span>
              </dt>
              <dd className="shrink-0 text-lg font-semibold whitespace-nowrap">
                <span className="num">{row.value}</span>
                <span className="ml-1 text-[13px] font-normal text-white/60">{row.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="relative mt-4 text-[12px] text-white/40">시연용 가정값</p>
      </aside>
    </div>
  );
}
