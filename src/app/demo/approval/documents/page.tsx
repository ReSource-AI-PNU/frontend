import type { Metadata } from "next";
import { ApprovalView } from "@/components/v3/approval-view";

export const metadata: Metadata = { title: "요청서 · 이행 계획서 · 계약서" };

export default function DemoApprovalDocumentsPage() {
  return <ApprovalView part="documents" />;
}
