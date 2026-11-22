import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer>
        <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-12 text-[13px] text-muted lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="flex items-center gap-2.5 font-medium text-ink">
              <BrandMark />
            </p>
          </div>
          <nav aria-label="약관 및 정책" className="flex flex-wrap items-start gap-x-1">
            <Link href="/trust" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink">
              AI 신뢰도
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink">
              개인정보처리방침
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
