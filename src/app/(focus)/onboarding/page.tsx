import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageSkeleton } from "@/components/ui/skeleton";
import { COMPLEXES } from "@/lib/complexes";
import { getCurrentOrganization } from "@/lib/server/organization";

export const metadata: Metadata = { title: "회사 정보 등록" };

async function Form() {
  const org = await getCurrentOrganization();
  return <OnboardingForm complexes={COMPLEXES} initial={org} />;
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-6 pt-12 lg:px-8">
      <p className="text-label text-muted">처음 한 번만 입력합니다</p>
      <h1 className="mt-1 text-display">회사와 산업단지를 알려 주세요</h1>
      <p className="mt-3 mb-10 max-w-xl text-ink-2">
        같은 단지 안에서 같은 품목을 내놓는 기업을 찾아 묶음 수거를 제안하려면, 어디서 무엇이 얼마나 나오는지 알아야 합니다.
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <Form />
      </Suspense>
    </div>
  );
}
