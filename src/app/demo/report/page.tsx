import type { Metadata } from "next";
import { ReportView } from "@/components/v3/report-view";

export const metadata: Metadata = { title: "재활용 실적" };

export default function DemoReportPage() {
  return <ReportView part="summary" />;
}
