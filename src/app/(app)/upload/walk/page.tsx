import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Walkthrough } from "@/components/walkthrough/walkthrough";

export const metadata: Metadata = { title: "걸으며 진단" };

const ERRORS: Record<string, string> = { empty: "양을 말한 흐름이 하나 이상 있어야 진단을 시작할 수 있습니다." };

/** 걸으며 진단: 공장을 한 바퀴 돌며 말하면 흐름 카드가 만들어진다. 입력 양식 없이 정부 진단의 현장 조사 장면을 옮긴 것이다 */
export default async function WalkPage({ searchParams }: PageProps<"/upload/walk">) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:px-8">
      <PageHeader
        title="걸으며 진단"
        description="공장을 한 바퀴 돌며 흐름 앞에서 이름·공정·양을 말하면, 에이전트가 받아써서 흐름 카드를 만들고 빠진 것은 되묻습니다. 장갑을 낀 채로도 할 수 있습니다."
      />
      <p className="text-[13px] text-muted">
        사진으로 올리려면{" "}
        <Link href="/upload" className="font-semibold text-ink underline underline-offset-4">
          사진으로 진단 시작
        </Link>
        으로 가세요.
      </p>
      <Walkthrough error={code ? ERRORS[code] : undefined} />
    </div>
  );
}
