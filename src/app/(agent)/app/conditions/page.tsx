import type { Metadata } from "next";
import { SurveyWorkspace } from "@/components/agent/survey-workspace";

export const metadata: Metadata = { title: "단가·사전 문의" };

export default function ConditionsPage() {
  return <SurveyWorkspace part="main" />;
}
