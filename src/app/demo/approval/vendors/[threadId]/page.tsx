import type { Metadata } from "next";
import { Suspense } from "react";
import { ApprovalView } from "@/components/v3/approval-view";
import { routeParam } from "@/lib/route-param";

export const metadata: Metadata = { title: "업체 승인" };

async function Vendor({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ApprovalView part="vendor" threadId={routeParam(threadId)} />;
}

/** 업체(대화) 하나의 승인. 업체별 승인 목록에서 들어온다 */
export default function DemoApprovalVendorPage({ params }: PageProps<"/demo/approval/vendors/[threadId]">) {
  return (
    <Suspense fallback={null}>
      <Vendor params={params} />
    </Suspense>
  );
}
