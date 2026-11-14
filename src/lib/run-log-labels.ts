import type { AgentName, RunEvent } from "@/lib/session/types";

/** 실행 콘솔에 쓰는 에이전트 이름 */
export const AGENT_LABEL: Record<AgentName, string> = {
  orchestrator: "조정",
  classify: "① 식별",
  feasibility: "② 경로 판정",
  regulation: "③ 규정",
  matching: "④ 매칭",
  "cost-carbon": "⑤ 비용·탄소",
  proposal: "⑥ 이행안",
  negotiation: "협상",
  passport: "재생원료 여권",
  walkthrough: "현장 워크스루",
};

export const KIND_LABEL: Record<RunEvent["kind"], string> = {
  start: "시작",
  tool: "도구",
  result: "결과",
  ask: "되묻기",
  decision: "판단",
  command: "명령",
};

/** 화면에 넘길 때 시각을 서버에서 문자열로 만든다(서버·브라우저 시간대 차이로 화면이 어긋나지 않게) */
export type RunEventView = RunEvent & { time: string };
