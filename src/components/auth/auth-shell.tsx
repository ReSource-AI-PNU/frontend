import type { ReactNode } from "react";
import { PhotoPane } from "@/components/photo-pane";
import { PHOTOS } from "@/lib/photos";

/** 로그인·가입 화면. 왼쪽은 폼, 오른쪽은 현장 사진 한 장과 한 문장이다. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-12">
      <div className="flex items-center justify-center px-6 py-14 lg:col-span-5 lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-ink-2">{description}</p>
          {children}
        </div>
      </div>
      <PhotoPane photo={PHOTOS.line} className="hidden lg:col-span-7 lg:block">
        <p className="max-w-[18ch] text-[44px] leading-[1.12] font-extrabold tracking-[-0.035em] text-balance xl:text-[52px]">
          등록하면, 받아 줄 곳은 에이전트가 찾습니다.
        </p>
        <span aria-hidden="true" className="lane mt-8 block h-1 w-40 rounded-full" />
        <p className="mt-5 max-w-md text-[15px] text-white/75">
          공장과 처리 업체가 각자 자료를 올리면, 양쪽을 대변하는 두 에이전트가 근거를 확인하며 조건을 맞춥니다.
        </p>
      </PhotoPane>
    </div>
  );
}
