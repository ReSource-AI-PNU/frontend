/**
 * 실행 기록(view.events)을 그림으로 그리기 좋게 센다. 네트워크도 React도 부르지 않는 순수 함수다(tests/run-log.test.ts).
 * 기록에 없는 값은 만들지 않는다: 걸린 시간은 다루지 않는다(규칙으로 돌린 찾기는 기록 시각이 거의 같다).
 */
import { AI_NAME, REVIEWER_NAME, TOOL_LABEL } from "./labels.ts";
import type { RunEvent } from "./types";

/** 줄 순서: 위에서 아래로 일이 넘어가는 차례 */
const ACTORS: { key: RunEvent["actor"]; label: string }[] = [
  { key: "system", label: "시스템" },
  { key: "tool", label: "판단 도구" },
  { key: "company_agent", label: AI_NAME.company },
  { key: "vendor_agent", label: AI_NAME.vendor },
  { key: "validator", label: "근거 검증기" },
  { key: "contract_reviewer", label: REVIEWER_NAME },
];

export const RUN_KIND_LABEL: Record<RunEvent["kind"], string> = {
  message: "메시지",
  tool_call: "판단 도구 호출",
  validation: "근거 검증",
  handoff: "사람에게 넘김",
  approval: "승인",
  thread: "대화",
  question: "담당자 질문",
  document: "서류",
  stage: "단계",
  feedback: "의견",
  review: "계약 검토",
};

/** 판단 도구가 낸 판정(labels.ts TOOL_STATUS와 같은 낱말) */
const STATUS_LABEL: Record<string, string> = { calculated: "확인됨", conditional: "조건부", needs_information: "확인 필요", error: "실패" };
const STATUS_ORDER = ["calculated", "conditional", "needs_information", "error"];

export type RunLogSummary = {
  total: number;
  toolCalls: number;
  toolKinds: number;
  validations: number;
  validationsPassed: number;
  messages: number;
  questions: number;
  /** 줄마다: 누가, 몇 건, 몇 번째 기록인지(0부터) */
  lanes: { key: string; label: string; count: number; at: { index: number; message: boolean }[] }[];
  /** 도구별 호출 횟수(많은 순) */
  tools: { id: string; label: string; count: number }[];
  /** 도구가 낸 판정별 횟수 */
  statuses: { key: string; label: string; count: number }[];
};

export function actorLabel(actor: string): string {
  return ACTORS.find((item) => item.key === actor)?.label ?? "시스템";
}

export function summarizeRun(events: RunEvent[]): RunLogSummary {
  const tools = new Map<string, number>();
  const statuses = new Map<string, number>();
  let validationsPassed = 0;
  for (const event of events) {
    if (event.kind === "tool_call") {
      const id = typeof event.detail.tool === "string" ? event.detail.tool : "";
      tools.set(id, (tools.get(id) ?? 0) + 1);
      const status = typeof event.detail.status === "string" ? event.detail.status : "";
      if (status) statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }
    if (event.kind === "validation" && event.detail.ok === true) validationsPassed += 1;
  }
  const count = (kind: RunEvent["kind"]) => events.filter((event) => event.kind === kind).length;
  return {
    total: events.length,
    toolCalls: count("tool_call"),
    toolKinds: tools.size,
    validations: count("validation"),
    validationsPassed,
    messages: count("message"),
    questions: count("question"),
    lanes: ACTORS.map(({ key, label }) => {
      const at = events.flatMap((event, index) => (event.actor === key ? [{ index, message: event.kind === "message" }] : []));
      return { key, label, count: at.length, at };
    }).filter((lane) => lane.count > 0),
    tools: [...tools.entries()]
      .map(([id, n]) => ({ id, label: TOOL_LABEL[id] ?? "판단 도구", count: n }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko")),
    statuses: [...statuses.entries()]
      .map(([key, n]) => ({ key, label: STATUS_LABEL[key] ?? key, count: n }))
      .sort((a, b) => STATUS_ORDER.indexOf(a.key) - STATUS_ORDER.indexOf(b.key)),
  };
}
