import type { ReactNode } from "react";
import { PhotoPane } from "@/components/photo-pane";
import { PHOTOS } from "@/lib/photos";

/** 로그인·가입 화면. 왼쪽은 폼, 오른쪽은 현장 사진 한 장과 한 문장이다. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-12">
      <div className="flex items-center justify-center px-6 py-14 lg:col-span-5 lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-ink-2">{description}</p>
          {children}
        </div>
      </div>
      <PhotoPane photo={PHOTOS.line} className="hidden lg:col-span-7 lg:block">
        <p className="max-w-[18ch] text-[32px] leading-[1.2] font-semibold tracking-[-0.035em] text-balance xl:text-[38px]">
          적어 두면, 받아 줄 곳은 AI가 대신 물어봅니다.
        </p>
      </PhotoPane>
    </div>
  );
}
