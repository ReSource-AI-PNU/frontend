import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { QuickOnboarding } from "@/components/onboarding/quick-onboarding";
import { PhotoPane } from "@/components/photo-pane";
import { PageSkeleton } from "@/components/ui/skeleton";
import { COMPLEXES } from "@/lib/complexes";
import { PHOTOS } from "@/lib/photos";
import { getCurrentOrganization } from "@/lib/server/organization";

export const metadata: Metadata = { title: "회사 등록" };

/** 처음이면 세 가지만 묻는 간단 등록, 이미 등록했으면 전체 회사 정보를 고치는 폼을 보여 준다. */
async function Form() {
  const org = await getCurrentOrganization();
  if (org) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 pt-12 lg:px-8">
        <h1 className="text-display">회사 정보 고치기</h1>
        <p className="mt-3 mb-10 max-w-xl text-ink-2">사업자등록번호, 업종, 품목별 배출량을 채우거나 고칩니다.</p>
        <OnboardingForm complexes={COMPLEXES} initial={org} />
      </div>
    );
  }
  return (
    <div className="grid flex-1 lg:grid-cols-12">
      <PhotoPane photo={PHOTOS.plantFloor} className="hidden lg:col-span-6 lg:block">
        <p className="max-w-[16ch] text-[32px] leading-[1.2] font-semibold tracking-[-0.035em] text-balance xl:text-[38px]">
          세 가지만 알려 주시면 바로 시작합니다.
        </p>
      </PhotoPane>
      <div className="flex items-center justify-center px-6 py-14 lg:col-span-6 lg:px-12">
        <div className="w-full max-w-md">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">회사를 등록합니다</h1>
          <p className="mt-2 mb-8 text-sm text-ink-2">처음 한 번만 합니다. 등록이 끝나면 곧바로 받아 줄 곳을 찾을 수 있습니다.</p>
          <QuickOnboarding complexes={COMPLEXES} />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Form />
    </Suspense>
  );
}
