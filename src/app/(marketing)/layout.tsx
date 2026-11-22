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
          </span>
          <nav aria-label="약관 및 정책" className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <Link href="/trust" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink">
              AI 신뢰도
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-ink-2 hover:text-ink">
              개인정보처리방침
            </Link>
          </nav>
          <span className="w-full sm:w-auto">© 2026 BYPRO 팀</span>
        </div>
      </footer>
    </>
  );
}
