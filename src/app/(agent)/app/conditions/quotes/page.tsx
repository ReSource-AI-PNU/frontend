import type { Metadata } from "next";
import { SurveyWorkspace } from "@/components/agent/survey-workspace";

export const metadata: Metadata = { title: "거래별 단가 확인" };

export default function ConditionsQuotesPage() {
  return <SurveyWorkspace part="quotes" />;
}
