import { useId, type ReactNode } from "react";
import { WastePileIllustration } from "../verdict/waste-pile";

/**
 * 시연 공장 흐름별 사진 일러스트(800×520). 실제 서비스에서는 업로드한 사진으로 바뀐다.
 * 탐지 박스 좌표(mock/pipeline.ts SAMPLE_FACTORY)와 그림 속 이물 위치를 맞춰 그렸다.
 */
export type SampleVariant = "bale" | "sprue" | "defect" | "purge" | "film" | "scrap" | "pallet" | "box";

/** 같은 입력이면 같은 그림이 나오도록 하는 작은 난수 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Frame({ label, children, floor = "#3a372f" }: { label: string; children: ReactNode; floor?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} className="absolute inset-0 size-full">
      <defs>
        <filter id={`g${uid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#46443d" />
          <stop offset="1" stopColor={floor} />
        </linearGradient>
      </defs>
      <g filter={`url(#g${uid})`}>
        <rect width="800" height="520" fill={`url(#bg${uid})`} />
        {children}
        <rect y="470" width="800" height="50" fill="#000" fillOpacity=".2" />
      </g>
    </svg>
  );
}

function Crate({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={color} />
      <rect x={x + 14} y={y + 14} width={w - 28} height={h - 28} rx="6" fill="#000" fillOpacity=".22" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={x + 30 + i * ((w - 60) / 6)} y={y + h - 10} width={(w - 60) / 6 - 12} height="6" rx="2" fill="#000" fillOpacity=".18" />
      ))}
    </g>
  );
}

function Sprue() {
  const r = rng(7);
  const trees = Array.from({ length: 22 }, (_, i) => ({ x: 110 + (i % 11) * 56 + r() * 20, y: 140 + Math.floor(i / 11) * 140 + r() * 30, rot: r() * 70 - 35, tone: r() > 0.5 ? "#ebe7da" : "#d9d3c0" }));
  return (
    <Frame label="파란 상자에 담긴 PP 사출 스프루와 러너">
      <Crate x={60} y={90} w={680} h={370} color="#2f5d8a" />
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`} stroke={t.tone} strokeLinecap="round" fill="none">
          <path d="M0 0 V110" strokeWidth="9" />
          <path d="M0 25 H-34 M0 25 H34 M0 60 H-30 M0 60 H30 M0 92 H-26 M0 92 H26" strokeWidth="5" />
          <g fill={t.tone} stroke="none">
            <circle cx="-38" cy="25" r="8" />
            <circle cx="38" cy="25" r="8" />
            <circle cx="-34" cy="60" r="7" />
            <circle cx="34" cy="60" r="7" />
            <circle cx="0" cy="-6" r="10" />
          </g>
        </g>
      ))}
    </Frame>
  );
}

function Defect() {
  const r = rng(11);
  const parts = Array.from({ length: 24 }, (_, i) => ({ x: 70 + (i % 8) * 84 + r() * 10, y: 110 + Math.floor(i / 8) * 108 + r() * 12, rot: r() * 24 - 12 }));
  return (
    <Frame label="회색 상자에 담긴 PP 불량 하우징. 종이 라벨과 금속 인서트가 섞여 있음">
      <Crate x={40} y={80} w={720} h={385} color="#5b6168" />
      {parts.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}>
          <rect width="74" height="54" rx="12" fill="#cfd3d6" />
          <rect x="10" y="10" width="54" height="34" rx="7" fill="#b9bec2" />
          <circle cx="37" cy="27" r="6" fill="#a7adb2" />
        </g>
      ))}
      {/* 종이 라벨 (0.30, 0.30, 0.16, 0.14) */}
      <g>
        <rect x="252" y="166" width="46" height="28" rx="2" fill="#f4f1e6" transform="rotate(-8 275 180)" />
        <rect x="312" y="190" width="42" height="26" rx="2" fill="#efeadb" transform="rotate(6 333 203)" />
        <rect x="270" y="200" width="20" height="4" fill="#9c958a" />
      </g>
      {/* 금속 인서트 (0.62, 0.52, 0.12, 0.12) */}
      {[[516, 290], [548, 300], [530, 318], [566, 286]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="11" fill="#c7ccd1" />
          <circle cx={cx - 3} cy={cy - 3} r="4" fill="#fff" fillOpacity=".7" />
          <circle cx={cx} cy={cy} r="11" fill="none" stroke="#7f868c" strokeWidth="2" />
        </g>
      ))}
    </Frame>
  );
}

function Purge() {
  const r = rng(23);
  const blob = (cx: number, cy: number, rad: number, fill: string, key: number) => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const rr = rad * (0.7 + r() * 0.5);
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr * 0.75}`;
    });
    return <polygon key={key} points={pts.join(" ")} fill={fill} />;
  };
  const base = Array.from({ length: 26 }, (_, i) => blob(110 + (i % 9) * 72 + r() * 20, 160 + Math.floor(i / 9) * 95 + r() * 30, 34, ["#ddd5c2", "#cfc6b0", "#e6dfcd"][i % 3], i));
  return (
    <Frame label="철판 위에 쌓인 PP 퍼지 덩어리. 빨강·검정 ABS가 섞여 있고 탄화된 덩어리가 있음" floor="#2f2d27">
      <rect x="70" y="110" width="660" height="360" rx="8" fill="#6d7276" />
      {base}
      {/* ABS 혼입 (0.52, 0.34, 0.22, 0.24) */}
      {blob(462, 214, 40, "#b8352d", 100)}
      {blob(540, 240, 36, "#1f1f22", 101)}
      {blob(500, 280, 30, "#c9452f", 102)}
      {blob(560, 196, 24, "#2a2a2e", 103)}
      {/* 탄화물 (0.24, 0.56, 0.14, 0.14) */}
      {blob(246, 326, 34, "#2b2118", 104)}
      {blob(272, 344, 18, "#3a2d20", 105)}
    </Frame>
  );
}

function Film() {
  const r = rng(31);
  const sheets = Array.from({ length: 40 }, (_, i) => {
    const cx = 90 + r() * 620;
    const cy = 130 + r() * 300;
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + r();
      const rr = 40 + r() * 60;
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr * 0.6}`;
    });
    return <polygon key={i} points={pts.join(" ")} fill="#f2f4f5" fillOpacity={0.22 + r() * 0.25} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" />;
  });
  return (
    <Frame label="마대 위에 뭉쳐 쌓인 투명 스트레치 필름. 종이 태그와 테이프가 붙어 있음">
      <rect x="50" y="110" width="700" height="350" rx="30" fill="#d9d6cc" />
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${60 + i * 50} 115 V455`} stroke="#bdb8aa" strokeWidth="2" />
      ))}
      {sheets}
      {/* 종이 태그 (0.60, 0.30, 0.12, 0.12) */}
      <g transform="rotate(10 528 186)">
        <rect x="500" y="166" width="58" height="38" rx="3" fill="#d6b77a" />
        <circle cx="510" cy="176" r="4" fill="#8a7650" />
        <rect x="518" y="184" width="30" height="3" fill="#8a7650" />
      </g>
      {/* 테이프 (0.26, 0.58, 0.14, 0.10) */}
      <rect x="214" y="314" width="96" height="18" rx="2" fill="#c9a160" transform="rotate(-9 262 323)" />
    </Frame>
  );
}

function Scrap() {
  const r = rng(41);
  return (
    <Frame label="철 가공 칩 더미. 절삭유가 고여 있음">
      {Array.from({ length: 70 }, (_, i) => {
        const x = 80 + r() * 640;
        const y = 140 + r() * 300;
        return <path key={i} d={`M${x} ${y} q 14 -18 28 0 t 28 0`} stroke={r() > 0.5 ? "#9aa1a6" : "#7d848a"} strokeWidth="5" fill="none" strokeLinecap="round" />;
      })}
      <ellipse cx="336" cy="306" rx="80" ry="34" fill="#1b1a17" fillOpacity=".75" />
      <ellipse cx="320" cy="298" rx="30" ry="8" fill="#fff" fillOpacity=".15" />
    </Frame>
  );
}

function Pallet() {
  return (
    <Frame label="쌓인 목재 팔레트. 못과 철물이 박혀 있음">
      {[0, 1, 2, 3].map((k) => (
        <g key={k} transform={`translate(${100 + k * 10} ${380 - k * 70})`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={i * 100} y="0" width="88" height="14" fill={["#b98d56", "#a87d48", "#c39a63"][i % 3]} />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={i * 250} y="14" width="40" height="40" fill="#8f6a3c" />
          ))}
        </g>
      ))}
      {[[210, 236], [236, 250], [258, 232]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="5" height="16" fill="#cfd3d6" />
      ))}
    </Frame>
  );
}

export function SampleIllustration({ variant, label }: { variant: string; label: string }) {
  switch (variant as SampleVariant) {
    case "sprue":
      return <Sprue />;
    case "defect":
      return <Defect />;
    case "purge":
      return <Purge />;
    case "film":
      return <Film />;
    case "scrap":
      return <Scrap />;
    case "pallet":
      return <Pallet />;
    default:
      return <WastePileIllustration label={label} />;
  }
}
