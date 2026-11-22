import type { Metadata } from "next";
import { SurveyWorkspace } from "@/components/agent/survey-workspace";

export const metadata: Metadata = { title: "계량 기록으로 물량 채우기" };

export default function ConditionsWeightsPage() {
  return <SurveyWorkspace part="weights" />;
}
