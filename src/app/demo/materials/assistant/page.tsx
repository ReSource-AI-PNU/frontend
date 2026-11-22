import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "AI 도우미로 등록" };

export default function DemoMaterialsAssistantPage() {
  return <MaterialsView part="assistant" />;
}
