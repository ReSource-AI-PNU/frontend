import { calledByLabel, rejectionLabel } from "@/lib/v3/format";
import type { RunEvent } from "@/lib/v3/types";

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** 검증 거부 코드: detail.codes와 detail.rejections[].code를 한데 모아 한 번씩만 적는다. */
function rejectionCodes(detail: RunEvent["detail"]): string[] {
  const fromRejections = Array.isArray(detail.rejections)
    ? detail.rejections.flatMap((item) => {
        const code = (item as { code?: unknown } | null)?.code;
        return typeof code === "string" ? [code] : [];
      })
    : [];
  return [...new Set([...strings(detail.codes), ...fromRejections])];
}

/**
 * 실행 기록 한 줄의 덧붙임(events[].detail). 요약 문장(summary)은 서버가 쓴 그대로 두고, 여기서는
 * 누가 한 일인지와 무엇이 빠졌는지를 코드가 준 항목으로만 적는다. 항목이 없으면 아무것도 그리지 않는다.
 */
export function EventDetail({ event, streamName }: { event: RunEvent; streamName: (id: string) => string }) {
  const { detail } = event;
  const hidden = detail.hiddenEvidenceCount;
  const codes = rejectionCodes(detail);
  const excluded = strings(detail.excludedStreamIds);
  const reopened = detail.reopenedSeq;
  const called = event.kind === "tool_call" ? calledByLabel(detail.calledBy) : null;
  const notes = [detail.reportedBy === "vendor" ? "업체 측 AI가 답과 함께 보낸 기록" : null, called].filter(Boolean);
  if (
    notes.length === 0 &&
    codes.length === 0 &&
    excluded.length === 0 &&
    typeof reopened !== "number" &&
    !(typeof hidden === "number" && hidden > 0)
  ) {
    return null;
  }
  return (
    <span className="mt-0.5 block space-y-0.5 text-[12px] text-muted">
      {notes.length > 0 ? <span className="block">{notes.join(" · ")}</span> : null}
      {codes.map((code) => (
        <span key={code} className="block text-ink-2">
          {rejectionLabel(code)}
        </span>
      ))}
      {excluded.length > 0 ? (
        <span className="block text-ink-2">뺀 폐기물: {excluded.map(streamName).join(", ")}</span>
      ) : null}
      {typeof reopened === "number" ? (
        <span className="block text-ink-2">
          <span className="tabular-nums">{reopened}</span>번째 메시지부터 다시 연 대화입니다
        </span>
      ) : null}
      {typeof hidden === "number" && hidden > 0 ? (
        <span className="block">
          상대 조직의 근거 <span className="tabular-nums">{hidden}</span>건은 보이지 않습니다
        </span>
      ) : null}
    </span>
  );
}
