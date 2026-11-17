import type { Metadata } from "next";
import { ApprovalView } from "@/components/v3/approval-view";

export const metadata: Metadata = { title: "승인·서류" };

export default function DemoApprovalPage() {
  return <ApprovalView />;
}
