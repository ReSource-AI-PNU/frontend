import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "자료·업체 정보" };

export default function MaterialsPage() {
  return <MaterialsView part="main" />;
}
