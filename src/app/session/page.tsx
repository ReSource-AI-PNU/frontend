import type { Metadata } from "next";
import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "세션" };

export default function SessionPage() {
  return (
    <div className="grid max-w-[1200px] gap-6">
      <PageHeader title="세션" description="식별부터 승인까지 8단계를 한 세션에서 진행합니다." />
      <EmptyState
        title="진행 중인 세션이 없습니다"
        description="폐기물 사진이나 영상을 올리면 세션이 만들어지고, 왼쪽 단계가 하나씩 채워집니다."
        action={
          <ButtonLink href="/">
            업로드로 시작
            <ArrowRightIcon />
          </ButtonLink>
        }
      />
    </div>
  );
}
