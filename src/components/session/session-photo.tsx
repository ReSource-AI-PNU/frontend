import type { Detection, Media } from "@/lib/session/types";
import { WastePileIllustration } from "../verdict/waste-pile";

/**
 * 세션 사진과 탐지 박스(읽기 전용). AI 박스는 형광펜, 사람이 고친 박스는 먹색이다 (DESIGN.md).
 * 편집이 필요한 화면은 components/session/detection-editor.tsx를 쓴다.
 */
export function MediaView({ media, label }: { media: Media; label: string }) {
  if (media.kind === "sample") return <WastePileIllustration label={label} />;
  if (media.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- 인증이 필요한 업로드 경로라 next/image 최적화를 쓰지 않는다
    return <img src={media.url} alt={label} className="absolute inset-0 size-full object-cover" />;
  }
  if (media.kind === "video") {
    return <video src={media.url} className="absolute inset-0 size-full object-cover" muted playsInline controls aria-label={label} />;
  }
  return (
    <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
      <span>PDF · {media.name}</span>
    </div>
  );
}

export function DetectionBox({ d, compact = false }: { d: Detection; compact?: boolean }) {
  if (d.removed) return null;
  const human = d.source === "human";
  const [x, y, w, h] = d.box;
  return (
    <div
      className={`absolute rounded-[2px] ${human ? "border-2 border-ink" : d.kind === "contaminant" ? "border-2 border-marker bg-marker/15" : "border-[1.5px] border-marker"}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
    >
      {!compact ? (
        <span
          className={`num absolute -top-[22px] -left-[2px] rounded-[2px] rounded-bl-none px-1.5 text-[11px] leading-5 font-semibold whitespace-nowrap ${human ? "bg-ink text-on-ink" : "bg-marker text-marker-ink"}`}
        >
          {d.label}
          {d.kind === "item" ? ` ${d.confidence.toFixed(2)}` : d.ratio !== undefined ? ` ${Math.round(d.ratio * 100)}%` : ""}
        </span>
      ) : null}
    </div>
  );
}

export function SessionPhoto({
  media,
  detections = [],
  caption,
  className = "",
  compact = false,
}: {
  media: Media | undefined;
  detections?: Detection[];
  caption?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <figure className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-photo ${className}`}>
      {media ? <MediaView media={media} label="업로드한 폐기물 사진" /> : null}
      {detections.map((d) => (
        <DetectionBox key={d.id} d={d} compact={compact} />
      ))}
      {caption ? <figcaption className="absolute bottom-2.5 left-3 text-[12px] text-white/60">{caption}</figcaption> : null}
    </figure>
  );
}
