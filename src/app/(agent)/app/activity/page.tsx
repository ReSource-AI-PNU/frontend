import type { Metadata } from "next";
import { Overview } from "@/components/agent/overview";

export const metadata: Metadata = { title: "최근 바뀐 것" };

export default function ActivityPage() {
  return <Overview part="activity" />;
}
