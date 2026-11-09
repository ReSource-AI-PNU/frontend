import type { ReactNode } from "react";

const LEDGER = [
  { label: "PP 압축품 · 월 800kg", value: "−250 → +300", unit: "원/kg" },
  { label: "녹산단지 묶음 수거 · 3개사", value: "2,410", unit: "kg" },
  { label: "현행 대비 월 손익", value: "+395,000", unit: "원" },
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
          사진 한 장이면,
          <br />
          <span className="bg-[linear-gradient(transparent_58%,var(--color-marker)_58%,var(--color-marker)_92%,transparent_92%)] text-[#FAFAFA] [-webkit-box-decoration-break:clone]">
            견적 요청서
          </span>
          까지.
        </p>
        <dl className="relative mt-10 max-w-md border-t border-white/15">
          {LEDGER.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-6 border-b border-white/15 py-3.5">
              <dt className="text-sm text-white/60">{row.label}</dt>
              <dd className="num text-lg font-semibold">
                {row.value}
                <span className="ml-1 font-sans text-[13px] font-normal text-white/60">{row.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="relative mt-4 text-[12px] text-white/40">시연용 가정값</p>
      </aside>
    </div>
  );
}
