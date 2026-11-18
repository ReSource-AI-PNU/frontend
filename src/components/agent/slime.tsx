/**
 * AI 작업실의 캐릭터(말랑한 방울 모양). 회사 측 AI는 먹색, 업체 측 AI는 흰 몸에 먹색 테두리, 전문 AI는 역할마다 옅은 색이다.
 * 색만으로 누구인지 전하지 않도록 늘 이름표와 함께 쓴다. 움직임은 globals.css의 rs-slime-* 이고,
 * 움직임 줄이기 설정이면 전역 규칙으로 모두 멈춘다.
 */

export type SlimeTone = "company" | "vendor" | "s1" | "s2" | "s3" | "s4" | "s5" | "s6";
export type SlimeState = "wait" | "idle" | "work" | "talk" | "done";

const BODY: Record<SlimeTone, { fill: string; stroke: string; eye: string }> = {
  company: {
    fill: "var(--color-ink)",
    stroke: "var(--color-ink)",
    eye: "var(--color-surface)",
  },
  vendor: {
    fill: "var(--color-surface)",
    stroke: "var(--color-ink)",
    eye: "var(--color-ink)",
  },
  s1: {
    fill: "var(--color-agent-1)",
    stroke: "var(--color-agent-1-ink)",
    eye: "var(--color-ink)",
  },
  s2: {
    fill: "var(--color-agent-2)",
    stroke: "var(--color-agent-2-ink)",
    eye: "var(--color-ink)",
  },
  s3: {
    fill: "var(--color-agent-3)",
    stroke: "var(--color-agent-3-ink)",
    eye: "var(--color-ink)",
  },
  s4: {
    fill: "var(--color-agent-4)",
    stroke: "var(--color-agent-4-ink)",
    eye: "var(--color-ink)",
  },
  s5: {
    fill: "var(--color-agent-5)",
    stroke: "var(--color-agent-5-ink)",
    eye: "var(--color-ink)",
  },
  s6: {
    fill: "var(--color-agent-6)",
    stroke: "var(--color-agent-6-ink)",
    eye: "var(--color-ink)",
  },
};

const MOTION: Record<SlimeState, string> = {
  wait: "",
  idle: "[animation:rs-slime-idle_2.8s_var(--ease-in-out)_infinite]",
  work: "[animation:rs-slime-idle_1.1s_var(--ease-in-out)_infinite]",
  talk: "[animation:rs-slime-talk_0.9s_var(--ease-out)_infinite]",
  done: "[animation:rs-slime-idle_3.6s_var(--ease-in-out)_infinite]",
};

export function Slime({
  tone,
  state,
  size = 56,
  className = "",
}: {
  tone: SlimeTone;
  state: SlimeState;
  size?: number;
  className?: string;
}) {
  const body = BODY[tone];
  const dim = state === "wait";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 92"
      width={size}
      height={size * 0.92}
      className={`block overflow-visible transition-opacity duration-300 ${dim ? "opacity-40 saturate-50" : ""} ${className}`}
    >
      <ellipse cx="50" cy="88" rx="34" ry="4" fill="var(--color-ink)" opacity={dim ? 0.05 : 0.1} />
      <g className={`origin-[50%_100%] [transform-box:fill-box] ${MOTION[state]}`}>
        <path
          d="M9 70 C5 44 22 12 50 11 C78 12 95 44 91 70 C89 84 72 88 50 88 C28 88 11 84 9 70 Z"
          fill={body.fill}
          stroke={body.stroke}
          strokeWidth={tone === "vendor" ? 3 : 2}
        />
        <ellipse cx="33" cy="30" rx="9" ry="4.5" fill="#fff" opacity={tone === "company" ? 0.16 : 0.55} transform="rotate(-24 33 30)" />
        <g className="origin-center [transform-box:fill-box] [animation:rs-slime-blink_4.2s_linear_infinite]">
          <ellipse cx="38" cy="52" rx="4.6" ry="6.4" fill={body.eye} />
          <ellipse cx="62" cy="52" rx="4.6" ry="6.4" fill={body.eye} />
        </g>
        {state === "talk" ? (
          <ellipse cx="50" cy="67" rx="5" ry="3.6" fill={body.eye} opacity="0.85" />
        ) : state === "done" ? (
          <path d="M43 65 Q50 71 57 65" fill="none" stroke={body.eye} strokeWidth="2.6" strokeLinecap="round" />
        ) : (
          <path d="M45 66 Q50 68.5 55 66" fill="none" stroke={body.eye} strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
        )}
      </g>
    </svg>
  );
}
