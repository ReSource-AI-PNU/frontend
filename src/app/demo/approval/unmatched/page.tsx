import type { Metadata } from "next";
import { ApprovalView } from "@/components/v3/approval-view";

export const metadata: Metadata = { title: "조건이 맞지 않은 곳" };

export default function DemoApprovalUnmatchedPage() {
  return <ApprovalView part="unmatched" />;
}
