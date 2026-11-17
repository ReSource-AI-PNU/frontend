import type { Metadata } from "next";
import { Inquiries } from "@/components/agent/inquiries";

export const metadata: Metadata = { title: "받은 문의" };

export default function InquiriesPage() {
  return <Inquiries />;
}
