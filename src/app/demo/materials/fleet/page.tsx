import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "노선·차량" };

export default function DemoMaterialsFleetPage() {
  return <MaterialsView part="fleet" />;
}
