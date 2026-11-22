import type { Metadata } from "next";
import { Overview } from "@/components/agent/overview";

export const metadata: Metadata = { title: "홈" };

export default function AgentPage() {
  return <Overview />;
}
