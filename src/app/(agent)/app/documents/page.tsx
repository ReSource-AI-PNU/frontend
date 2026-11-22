import type { Metadata } from "next";
import { Overview } from "@/components/agent/overview";

export const metadata: Metadata = { title: "서류 모음" };

export default function DocumentsPage() {
  return <Overview part="documents" />;
}
