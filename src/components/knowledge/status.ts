import type { KnowledgeStatus } from "@/lib/session/types";
import type { BadgeTone } from "../ui/badge";

export const KNOWLEDGE_STATUS: Record<KnowledgeStatus, { label: string; tone: BadgeTone }> = {
  proposed: { label: "제안됨", tone: "neutral" },
  reviewing: { label: "검토 중", tone: "warn" },
  adopted: { label: "채택됨", tone: "gain" },
  rejected: { label: "반려", tone: "loss" },
};

export const KNOWLEDGE_STATUS_ORDER: KnowledgeStatus[] = ["proposed", "reviewing", "adopted", "rejected"];
