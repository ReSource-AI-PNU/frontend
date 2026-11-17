import type { Metadata } from "next";
import { ApprovalView } from "@/components/v3/approval-view";

export const metadata: Metadata = { title: "승인" };

export default function ApprovalPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <ApprovalView />
    </div>
  );
}
