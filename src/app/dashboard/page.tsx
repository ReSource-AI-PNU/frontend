import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "대시보드" };

const KPIS = ["누적 절감 비용", "누적 절감 탄소", "처리 건수"];

export default function DashboardPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:px-8">
      <PageHeader title="대시보드" description="월별 처리 이력과 절감한 비용·탄소를 누적해서 보여 줍니다." />

      <dl className="grid border-y border-line sm:grid-cols-3">
        {KPIS.map((label) => (
          <div key={label} className="border-line py-5 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0">
            <dt className="text-label text-muted">{label}</dt>
            <dd className="num mt-1 text-[32px] font-medium text-muted">—</dd>
          </div>
        ))}
      </dl>

      <EmptyState
        title="아직 처리 이력이 없습니다"
        description="승인한 견적 요청이 처리되면 여기에 월별로 쌓입니다."
      />
    </div>
  );
}
