import type { Metadata } from "next";
import { DiagnosisView } from "@/components/v3/diagnosis-view";

export const metadata: Metadata = { title: "진단·연결" };

export default function DiagnosisPage() {
  return <DiagnosisView />;
}
