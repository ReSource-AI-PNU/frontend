import type { ReactNode } from "react";
import { BrandMark, MarketingHeader } from "@/components/site-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-10 text-[13px] text-muted lg:px-8">
          <span className="flex items-center gap-2.5 font-semibold text-ink">
            <BrandMark />
            Re:Source AI
          </span>
          <span>숫자는 시연용 가정값입니다.</span>
        </div>
      </footer>
    </>
  );
}
