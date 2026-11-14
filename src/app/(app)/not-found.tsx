import { ButtonLink } from "@/components/ui/button";

/** 앱 안에서 notFound()가 불렸을 때 (예: 다른 회사 세션, 지워진 세션). 앱 헤더는 레이아웃이 그린다. */
export default function AppNotFound() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] px-6 py-16 lg:px-8">
      <div className="grid max-w-[640px] gap-5">
        <p className="num text-[13px] tracking-[0.04em] text-muted">404</p>
        <h1 className="text-h1">이 자료를 열 수 없습니다</h1>
        <p className="text-ink-2">
          지워졌거나, 다른 회사의 자료이거나, 주소가 잘못되었습니다. 세션과 견적 요청서는 같은 회사 멤버만 볼 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/session">세션 목록으로</ButtonLink>
          <ButtonLink href="/upload" variant="secondary">
            새로 업로드하기
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
