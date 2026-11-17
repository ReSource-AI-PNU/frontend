import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "자료" };

export default function DemoMaterialsPage() {
  return <MaterialsView />;
}
