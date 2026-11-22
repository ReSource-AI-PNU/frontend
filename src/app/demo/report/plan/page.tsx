import type { Metadata } from "next";
import { ReportView } from "@/components/v3/report-view";

export const metadata: Metadata = { title: "확정한 합의 · 한 달 예상" };

export default function DemoReportPlanPage() {
  return <ReportView part="plan" />;
}
