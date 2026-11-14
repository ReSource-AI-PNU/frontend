import type { SessionStatus } from "@/lib/session/types";
import { Badge, type BadgeTone } from "../ui/badge";

/** 세션 상태 표기. 세션 화면 레이아웃(session/[id]/layout.tsx)의 배지와 같은 이름·색을 쓴다. */
export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: BadgeTone }> = {
  analyzing: { label: "분석 중", tone: "ai" },
  "in-progress": { label: "진행 중", tone: "neutral" },
  "awaiting-approval": { label: "승인 대기", tone: "warn" },
  sent: { label: "발송 완료", tone: "gain" },
  completed: { label: "수거 완료", tone: "gain" },
};

export const SESSION_STATUS_ORDER: SessionStatus[] = ["analyzing", "in-progress", "awaiting-approval", "sent", "completed"];

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const s = SESSION_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
