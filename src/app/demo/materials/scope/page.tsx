import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "AI가 지킬 범위" };

export default function DemoMaterialsScopePage() {
  return <MaterialsView part="scope" />;
}
