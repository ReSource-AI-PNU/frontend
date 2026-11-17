import type { Metadata } from "next";
import { MaterialsView } from "@/components/v3/materials-view";

export const metadata: Metadata = { title: "자료 올리기" };

export default function MaterialsPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <MaterialsView />
    </div>
  );
}
