import type { StreamOrigin, StreamRoute } from "@/lib/session/types";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

/**
 * 흐름 경로 배지. 새 색을 만들지 않고 기존 토큰으로 구분한다 (DESIGN.md 컴포넌트 규칙).
 * 재투입 = 검정 채움, 매각 = 연한 이익색, 단지 묶음 매각 = 진한 이익색, 열분해 = 확인색, 소각 = 손실색.
 * 색만으로 구분하지 않도록 항상 글자 라벨을 함께 쓴다.
 */
const ROUTE_CLASS: Record<StreamRoute, string> = {
  reuse: "bg-ink text-on-ink",
  sell: "bg-gain-bg text-gain",
  bundle: "bg-gain text-on-ink",
  pyrolysis: "bg-warn-bg text-warn",
  incinerate: "bg-loss-bg text-loss",
};

export function RouteBadge({ route, size = "md" }: { route: StreamRoute; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap ${size === "sm" ? "h-[22px] px-2 text-[12px]" : "h-[26px] px-2.5 text-[13px]"} ${ROUTE_CLASS[route]}`}
    >
      {STREAM_ROUTE_LABEL[route]}
    </span>
  );
}

export const ORIGIN_LABEL: Record<StreamOrigin, { short: string; long: string }> = {
  PIR: { short: "공정 부산물 · PIR", long: "공정 부산물(PIR): 스프루, 불량품, 퍼지처럼 제조 공정에서 나온 것" },
  PCR: { short: "사용 후 포장재 · PCR", long: "사용 후 포장재(PCR): 공장이 원자재 포장으로 쓰고 버린 필름·마대. 재생원료 의무는 PCR만 인정" },
};

/** 출처 칩. AI 판정이면 형광펜 점, 사람이 바꿨으면 검정 점 */
export function OriginChip({ origin, source }: { origin: StreamOrigin; source: "ai" | "human" }) {
  return (
    <span
      title={ORIGIN_LABEL[origin].long}
      className="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[12px] font-semibold whitespace-nowrap text-ink-2"
    >
      <i aria-hidden="true" className={`size-2 rounded-full ${source === "ai" ? "bg-marker shadow-[0_0_0_1px_var(--color-ink)]" : "bg-ink"}`} />
      {ORIGIN_LABEL[origin].short}
      <span className="sr-only">{source === "ai" ? "(AI 판정)" : "(담당자 지정)"}</span>
    </span>
  );
}
