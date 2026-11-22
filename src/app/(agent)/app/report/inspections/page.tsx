import type { Metadata } from "next";
import { ReportView } from "@/components/v3/report-view";

export const metadata: Metadata = { title: "검수 기록" };

export default function ReportInspectionsPage() {
  return <ReportView part="inspections" />;
}
