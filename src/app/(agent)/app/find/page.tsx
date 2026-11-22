import type { Metadata } from "next";
import { AgentHome } from "@/components/agent/home";

export const metadata: Metadata = { title: "받아 줄 곳 찾기" };

export default function FindPage() {
  return <AgentHome />;
}
