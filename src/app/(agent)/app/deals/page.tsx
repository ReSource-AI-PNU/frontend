import type { Metadata } from "next";
import { Suspense } from "react";
import { DealsView } from "@/components/agent/deals";

export const metadata: Metadata = { title: "거래" };

export default function DealsPage() {
  return (
    <Suspense fallback={null}>
      <DealsView />
    </Suspense>
  );
}
