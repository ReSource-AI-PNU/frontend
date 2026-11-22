import type { Metadata } from "next";
import { Overview } from "@/components/agent/overview";

export const metadata: Metadata = { title: "진행 중인 거래" };

export default function ActiveDealsPage() {
  return <Overview part="active" />;
}
