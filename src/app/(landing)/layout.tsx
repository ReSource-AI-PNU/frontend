import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { PHOTOS } from "@/lib/photos";

export default function LandingLayout({ children }: { children: ReactNode }) {
  const photos = Object.values(PHOTOS);
  return (
    <>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer>
        <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-12 text-[13px] text-muted lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="flex items-center gap-2.5 font-medium text-ink">
              <BrandMark />
              Re:Source AI
            </p>
            <p className="mt-3 max-w-xl">
              소개 화면과 체험하기에 나오는 회사·업체·단가·물량은 가상입니다. 사진은 Unsplash 라이선스로 받은 실제 산업 현장
              사진이며 저희 고객사의 모습이 아닙니다.
            </p>
            <p className="mt-2">
              사진:{" "}
              {photos.map((photo, index) => (
                <span key={photo.src}>
                  {index > 0 ? ", " : ""}
                  <a href={photo.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                    {photo.by}
                  </a>
                </span>
              ))}
            </p>
          </div>
          <nav aria-label="약관 및 정책" className="flex flex-wrap items-start gap-x-1">
            <Link href="/trust" className="rounded-md px-2 py-2 hover:text-ink">
              AI 신뢰도
            </Link>
            <Link href="/terms" className="rounded-md px-2 py-2 hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="rounded-md px-2 py-2 hover:text-ink">
              개인정보처리방침
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
