import { Suspense, type ReactNode } from "react";
import { SettingsNav, SettingsNavList } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <PageHeader title="설정" description="회사 정보와 멤버, 내 계정과 데이터를 관리합니다." />
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="설정 메뉴" className="lg:sticky lg:top-[84px] lg:self-start">
          <Suspense fallback={<SettingsNavList pathname={null} />}>
            <SettingsNav />
          </Suspense>
        </nav>
        <div className="grid min-w-0 content-start gap-10">{children}</div>
      </div>
    </div>
  );
}
