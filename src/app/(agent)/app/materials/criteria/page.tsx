import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "매입 기준표" };

export default function MaterialsCriteriaPage() {
  return <MaterialsView part="criteria" />;
}
