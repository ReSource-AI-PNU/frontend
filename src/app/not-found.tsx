import type { Metadata } from "next";
import { FocusHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다" };

/** 없는 주소와 notFound()를 처리한다. 루트 레이아웃에는 헤더가 없으므로 여기서 직접 넣는다. */
export default function NotFound() {
  return (
    <>
      <FocusHeader />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto grid w-full max-w-[720px] gap-6 px-6 pt-20 pb-24 lg:px-8">
          <p className="num text-[13px] tracking-[0.04em] text-muted">404 · NOT FOUND</p>
          <h1 className="text-display">찾는 페이지가 없습니다</h1>
          <p className="max-w-xl text-lg text-ink-2">
            주소가 바뀌었거나 삭제되었을 수 있습니다. 다른 회사의 세션은 같은 회사 멤버만 열 수 있습니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ButtonLink href="/">홈으로 가기</ButtonLink>
            <ButtonLink href="/session" variant="secondary">
              내 세션 보기
            </ButtonLink>
          </div>
          <p className="border-t border-line pt-6 text-sm text-muted">
            링크를 받아서 들어왔다면, 링크를 보낸 사람에게 주소가 맞는지 확인해 주세요.
          </p>
        </div>
      </main>
    </>
  );
}
