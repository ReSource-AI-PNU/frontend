import type { Metadata } from "next";
import { Suspense } from "react";
import { MaterialsView } from "@/components/v3/materials-view";
import { routeParam } from "@/lib/route-param";

export const metadata: Metadata = { title: "폐기물" };

async function Stream({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  return <MaterialsView part="stream" streamId={routeParam(streamId)} />;
}

/** 폐기물 하나(사진·측정값·문서·지금 처리). 폐기물 목록에서 들어온다 */
export default function DemoMaterialsStreamPage({ params }: PageProps<"/demo/materials/streams/[streamId]">) {
  return (
    <Suspense fallback={null}>
      <Stream params={params} />
    </Suspense>
  );
}
