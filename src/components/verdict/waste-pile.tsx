import { useId } from "react";

/** 시연용 현장 사진 일러스트: 압축 PP 베일 더미. 실제 화면에서는 업로드한 사진으로 바뀐다. */
export function WastePileIllustration({ label }: { label: string }) {
  const uid = useId().replace(/:/g, "");
  const grain = `grain-${uid}`;
  const strap = `strap-${uid}`;
  const sky = `sky-${uid}`;
  const floor = `floor-${uid}`;

  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} className="absolute inset-0 size-full">
      <defs>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
        <pattern id={strap} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
          <path d="M0 3h14M0 9h14" stroke="#000" strokeOpacity=".16" strokeWidth="2" />
        </pattern>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4840" />
          <stop offset="1" stopColor="#2a2924" />
        </linearGradient>
        <linearGradient id={floor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b574c" />
          <stop offset="1" stopColor="#3a372f" />
        </linearGradient>
      </defs>
      <g filter={`url(#${grain})`}>
        <rect width="800" height="520" fill={`url(#${sky})`} />
        <rect y="360" width="800" height="160" fill={`url(#${floor})`} />
        <g transform="rotate(-2 400 260)">
          {[
            [88, 128, 210, 150, "#8d959b"],
            [304, 112, 228, 164, "#a9b1b4"],
            [538, 136, 196, 142, "#7f8a86"],
          ].map(([x, y, w, h, fill]) => (
            <g key={`${x}`}>
              <rect x={x} y={y} width={w} height={h} rx="8" fill={fill as string} />
              <rect x={x} y={y} width={w} height={h} rx="8" fill={`url(#${strap})`} />
            </g>
          ))}
        </g>
        <g transform="rotate(1.5 400 380)">
          {[
            [40, 270, 250, 170, "#b4b8b0"],
            [296, 262, 262, 182, "#9aa4a8"],
            [564, 276, 214, 164, "#c2c0b4"],
          ].map(([x, y, w, h, fill]) => (
            <g key={`${x}`}>
              <rect x={x} y={y} width={w} height={h} rx="8" fill={fill as string} />
              <rect x={x} y={y} width={w} height={h} rx="8" fill={`url(#${strap})`} />
            </g>
          ))}
        </g>
        <g fill="#c9a160">
          <rect x="350" y="300" width="70" height="16" rx="2" transform="rotate(-12 385 308)" />
          <rect x="410" y="350" width="54" height="14" rx="2" transform="rotate(8 437 357)" />
          <rect x="120" y="318" width="60" height="14" rx="2" transform="rotate(-6 150 325)" />
        </g>
        <g fill="#efeee6">
          <rect x="470" y="306" width="40" height="28" rx="2" transform="rotate(5 490 320)" />
          <rect x="618" y="180" width="34" height="24" rx="2" />
        </g>
        <path d="M640 330l40-12 18 26-30 16z" fill="#d8dcdf" />
        <rect y="440" width="800" height="80" fill="#000" fillOpacity=".18" />
      </g>
    </svg>
  );
}
