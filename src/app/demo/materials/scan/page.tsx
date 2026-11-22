import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "보관장 3D 스캔" };

export default function DemoMaterialsScanPage() {
  return <MaterialsView part="scan" />;
}
