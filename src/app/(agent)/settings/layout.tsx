import { Suspense, type ReactNode } from "react";
import { SettingsNav, SettingsNavList } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[880px] gap-8 px-5 py-8 sm:px-8 lg:py-12">
      <PageHeader title="설정" description="회사 정보와 구성원, 내 계정을 관리합니다." />
      <div className="grid min-w-0 gap-8">
        {/* 넓은 화면에서는 사이드바 둘째 칸이 같은 메뉴를 보인다 */}
        <nav aria-label="설정 메뉴" className="min-w-0 lg:hidden">
          <Suspense fallback={<SettingsNavList pathname={null} />}>
            <SettingsNav />
          </Suspense>
        </nav>
        <div className="grid min-w-0 content-start gap-10">{children}</div>
      </div>
    </div>
  );
}
