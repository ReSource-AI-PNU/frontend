import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrgNoticeBanner } from "@/components/agent/membership-sync";
import { CompanyForm, InviteLinkForm, NegotiationTestForm } from "@/components/onboarding/company-form";
import { PhotoPane } from "@/components/photo-pane";
import { PageSkeleton } from "@/components/ui/skeleton";
import { COMPLEXES } from "@/lib/complexes";
import { orgNoticeText } from "@/lib/auth/membership-sync";
import { PHOTOS } from "@/lib/photos";
import { backendConfig } from "@/lib/server/backend";
import { readOrgNotice } from "@/lib/server/org-notice";
import { getWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "회사 등록" };

/**
 * 가입한 뒤 처음 오는 곳. 회사를 새로 등록하거나 받은 초대로 들어간다. 이미 소속이 있으면 회사를 하나 더 등록한다.
 * 마지막 회사에서 나왔거나 빠져서 왔으면 그 안내를 맨 위에 한 번 보이고 가입 환영 인사는 하지 않는다.
 */
async function Form() {
  const [workspace, notice] = await Promise.all([getWorkspace(), readOrgNotice()]);
  if (!workspace) redirect("/login?callbackUrl=/onboarding");
  const first = workspace.memberships.length === 0;
  const backend = backendConfig();
  return (
    <div className="grid flex-1 lg:grid-cols-12">
      <PhotoPane photo={PHOTOS.plantFloor} className="hidden lg:col-span-6 lg:block">
        <p className="max-w-[16ch] text-[32px] leading-[1.2] font-semibold tracking-[-0.035em] text-balance xl:text-[38px]">
          회사만 등록하면 바로 시작합니다.
        </p>
      </PhotoPane>
      <div className="flex items-start justify-center px-5 py-12 sm:px-6 lg:col-span-6 lg:items-center lg:px-12">
        <div className="w-full max-w-md min-w-0">
          {notice ? (
            <div className="mb-8">
              <OrgNoticeBanner inline text={orgNoticeText(notice)} />
            </div>
          ) : null}
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {first ? "회사를 등록합니다" : "회사를 하나 더 등록합니다"}
          </h1>
          <p className="mt-2 mb-8 text-sm text-ink-2">
            {!first
              ? "등록한 회사는 왼쪽 아래 회사 이름을 눌러 바꿔 볼 수 있습니다."
              : notice
                ? "일하시는 회사를 등록하거나 받은 초대 링크로 들어가면 바로 시작할 수 있습니다."
                : `${workspace.user.name}님, 가입을 환영합니다. 일하시는 회사를 등록하면 바로 시작할 수 있습니다.`}
          </p>
          {backend.ok && backend.mode === "bff" ? (
            <div className="mb-8 rounded-xl border border-line p-4">
              <NegotiationTestForm />
            </div>
          ) : null}
          <CompanyForm complexes={COMPLEXES} />
          <div className="mt-10 border-t border-line pt-6">
            <InviteLinkForm />
          </div>
          {!first ? (
            <p className="mt-8 text-sm">
              <Link href="/app" className="text-ink-2 underline underline-offset-4 hover:text-ink">
                등록하지 않고 돌아가기
              </Link>
            </p>
          ) : null}
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
