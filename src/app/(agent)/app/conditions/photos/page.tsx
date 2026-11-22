import type { Metadata } from "next";
import { SurveyWorkspace } from "@/components/agent/survey-workspace";

export const metadata: Metadata = { title: "수거 전 확인 사진" };

export default function ConditionsPhotosPage() {
  return <SurveyWorkspace part="photos" />;
}
