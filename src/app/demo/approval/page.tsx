import type { Metadata } from "next";
import { ApprovalView } from "@/components/v3/approval-view";

export const metadata: Metadata = { title: "업체별 승인" };

export default function DemoApprovalPage() {
  return <ApprovalView part="list" />;
}
