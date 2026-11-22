import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "기록" };

export default function MaterialsMemoryPage() {
  return <MaterialsView part="memory" />;
}
