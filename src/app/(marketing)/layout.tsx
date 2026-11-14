import Link from "next/link";
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
          <nav aria-label="약관 및 정책" className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <Link href="/terms" className="rounded-md px-2 py-2 hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="rounded-md px-2 py-2 font-semibold text-ink-2 hover:text-ink">
              개인정보처리방침
            </Link>
          </nav>
          <span className="w-full sm:w-auto">숫자는 시연용 가정값입니다. © 2026 Re:Source AI 팀</span>
        </div>
      </footer>
    </>
  );
}
