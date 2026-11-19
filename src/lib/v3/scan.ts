/**
 * 보관장 3D 스캔의 순수 로직(브라우저 API를 쓰지 않는다). 영상에서 장면을 고르는 수, 사진 크기 줄이기 계산,
 * 점군 바이트(RSPC) 해석, 진행 단계·지표 문구. 브라우저에서 실제로 장면을 뽑는 일은 scan-frames.ts가 한다.
 * 계약: ~/rs-work/scan/CONTRACT.md (1장 입력, 2장 점군 형식, 3장 ScanView)
 * 검사: node --test tests/scan.test.ts
 */
import type { ScanLayoutMetrics, ScanList, ScanStage, ScanView } from "./types";

/** 영상 하나에서 고르는 장면 수의 범위와 사진 여러 장의 범위 */
export const MIN_VIDEO_FRAMES = 24;
export const MAX_VIDEO_FRAMES = 80;
export const MIN_PHOTOS = 12;
export const MAX_PHOTOS = 80;
/** 이보다 짧은 영상은 보관장을 한 바퀴 담지 못한다 */
export const MIN_VIDEO_SEC = 5;
/** 장면 사진의 긴 변(px)과 JPEG 품질. 합계가 상한을 넘으면 다음 품질로 다시 만든다 */
export const LONG_SIDE = 896;
export const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5] as const;
/** 운영 업로드 상한(20MB)보다 조금 작게 잡는다(multipart 머리글 몫) */
export const MAX_TOTAL_BYTES = 19 * 1024 * 1024;

/** 영상 길이 d초에서 고를 장면 수: clamp(round(d × 2), 24, 80) */
export function frameCount(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return MIN_VIDEO_FRAMES;
  return Math.min(MAX_VIDEO_FRAMES, Math.max(MIN_VIDEO_FRAMES, Math.round(durationSec * 2)));
}

/** 장면을 뽑을 시각(초). 구간 n개의 가운데라서 맨 앞(검은 화면)과 맨 끝(마지막 프레임 없음)을 피한다 */
export function frameTimes(durationSec: number, n: number): number[] {
  const step = durationSec / n;
  return Array.from({ length: n }, (_, i) => Math.round((i + 0.5) * step * 1000) / 1000);
}

/** 긴 변을 longSide 이하로 줄인 크기. 이미 작으면 그대로 둔다(키우지 않는다) */
export function fitSize(width: number, height: number, longSide = LONG_SIDE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (!(long > 0)) return { width: 0, height: 0 };
  const ratio = Math.min(1, longSide / long);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** 많이 고른 사진에서 고르게 count장을 남긴다(찍은 순서를 지킨다) */
export function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / count)]);
}

/** 사진 여러 장을 고른 경우의 문제. 없으면 null */
export function photoProblem(count: number): string | null {
  if (count < MIN_PHOTOS) {
    return `사진을 ${MIN_PHOTOS}장 이상 골라 주세요. 보관장을 한 바퀴 돌며 겹치게 찍은 사진이 필요합니다.`;
  }
  return null;
}

/** 다음에 쓸 JPEG 품질. 더 낮출 수 없으면 null */
export function nextQuality(current: number): number | null {
  const next = QUALITY_STEPS.find((q) => q < current - 1e-9);
  return next ?? null;
}

export const TOO_BIG_MESSAGE = "장면 사진이 너무 커서 보내지 못했습니다. 조금 더 짧게 찍은 영상으로 다시 올려 주세요.";

/** 브라우저가 열지 못했거나 고를 수 없는 입력. message는 화면에 그대로 보인다 */
export class ScanInputError extends Error {}

// ── 점군 바이트 ───────────────────────────────────────────────────────

export const POINTS_MAGIC = "RSPC";
const HEADER = 16;
const RECORD = 10;

export type PointCloud = {
  count: number;
  /** x, y, z (m, 바닥 좌표계) 차례 */
  positions: Float32Array;
  /** r, g, b (0~255) 차례 */
  colors: Uint8Array;
  /** 0 = 바닥·배경, k = piles[k-1] */
  labels: Uint8Array;
};

/**
 * 계약 2장의 점군 형식(little-endian). 머리 16바이트: "RSPC", uint32 판(1), uint32 점 개수 N, uint32 0.
 * 그 뒤 N × 10바이트: int16 x, y, z (mm), uint8 r, g, b, uint8 더미 번호. 모양이 틀리면 Error.
 */
export function parsePoints(buffer: ArrayBuffer): PointCloud {
  if (buffer.byteLength < HEADER) throw new Error("점군이 너무 짧습니다.");
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== POINTS_MAGIC) throw new Error("점군 형식이 아닙니다.");
  const version = view.getUint32(4, true);
  if (version !== 1) throw new Error(`모르는 점군 판입니다: ${version}`);
  const count = view.getUint32(8, true);
  if (buffer.byteLength < HEADER + count * RECORD) throw new Error("점군이 잘렸습니다.");
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const labels = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const at = HEADER + i * RECORD;
    positions[i * 3] = view.getInt16(at, true) / 1000;
    positions[i * 3 + 1] = view.getInt16(at + 2, true) / 1000;
    positions[i * 3 + 2] = view.getInt16(at + 4, true) / 1000;
    colors[i * 3] = view.getUint8(at + 6);
    colors[i * 3 + 1] = view.getUint8(at + 7);
    colors[i * 3 + 2] = view.getUint8(at + 8);
    labels[i] = view.getUint8(at + 9);
  }
  return { count, positions, colors, labels };
}

/** 시험·예시용: 점 목록을 같은 형식의 바이트로 만든다 */
export function encodePoints(points: { x: number; y: number; z: number; r: number; g: number; b: number; label: number }[]): ArrayBuffer {
  const buffer = new ArrayBuffer(HEADER + points.length * RECORD);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i += 1) view.setUint8(i, POINTS_MAGIC.charCodeAt(i));
  view.setUint32(4, 1, true);
  view.setUint32(8, points.length, true);
  view.setUint32(12, 0, true);
  const mm = (value: number) => Math.max(-32768, Math.min(32767, Math.round(value * 1000)));
  points.forEach((point, i) => {
    const at = HEADER + i * RECORD;
    view.setInt16(at, mm(point.x), true);
    view.setInt16(at + 2, mm(point.y), true);
    view.setInt16(at + 4, mm(point.z), true);
    view.setUint8(at + 6, point.r);
    view.setUint8(at + 7, point.g);
    view.setUint8(at + 8, point.b);
    view.setUint8(at + 9, point.label);
  });
  return buffer;
}

// ── 진행 단계 ─────────────────────────────────────────────────────────

/** 화면의 진행 단계 넷. 첫째는 브라우저가, 나머지는 서버가 한다 */
export const SCAN_STEPS = [
  { key: "frames", label: "장면 고르는 중" },
  { key: "geometry", label: "3D로 재구성하는 중" },
  { key: "scale", label: "실제 크기 맞추는 중" },
  { key: "piles", label: "바닥과 더미 찾는 중" },
] as const;

export type ScanStepKey = (typeof SCAN_STEPS)[number]["key"];

/** 서버 단계 → 화면 단계. 차례를 기다리는 동안(null)은 재구성 단계로 본다. floor와 piles는 한 줄이다 */
export function stepOf(stage: ScanStage | null | undefined): ScanStepKey {
  if (stage === "scale") return "scale";
  if (stage === "floor" || stage === "piles" || stage === "done") return "piles";
  return "geometry";
}

/** 화면 단계마다의 상태: 끝남 · 지금 · 기다림 */
export function stepStates(current: ScanStepKey): { key: ScanStepKey; label: string; state: "done" | "now" | "waiting" }[] {
  const at = SCAN_STEPS.findIndex((step) => step.key === current);
  return SCAN_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    state: index < at ? "done" : index === at ? "now" : "waiting",
  }));
}

// ── 목록과 요약 ───────────────────────────────────────────────────────

/** 절을 그릴지: 분석을 받을 수 있거나, 이미 스캔이 있을 때만(준비되지 않은 기능은 두지 않는다) */
export function showScanSection(list: ScanList | null | undefined): boolean {
  return Boolean(list && (list.canScan || list.scans.length > 0));
}

/** 진행 중인 스캔이 있으면 그것, 없으면 가장 최근 스캔. 목록은 최근 것이 먼저다 */
export function currentScan(list: ScanList | null | undefined): ScanView | null {
  if (!list || list.scans.length === 0) return null;
  return list.scans.find((scan) => scan.status === "processing") ?? list.scans[0];
}

/**
 * 무게를 계산하지 못한 더미에 대한 한 줄. 없으면 null.
 * 폐기물을 고르지 않은 더미(밀도를 정할 수 없음)와, 골랐지만 밀도가 없어 계량값이 필요한 더미를 따로 센다.
 */
export function pendingText(view: ScanView): string | null {
  if (!view.summary || view.piles.length === 0) return null;
  const unassigned = view.piles.filter((pile) => !pile.streamId).length;
  const needWeigh = view.piles.filter((pile) => pile.streamId && !pile.weight).length;
  if (unassigned === 0 && needWeigh === 0) return null;
  if (unassigned === view.piles.length) return "더미마다 폐기물을 고르면 무게를 계산합니다";
  const parts: string[] = [];
  if (unassigned > 0) parts.push(`${unassigned}개는 폐기물 지정 필요`);
  if (needWeigh > 0) parts.push(`${needWeigh}개는 계량값 필요`);
  return parts.join(" · ");
}

/** 거리·넓이 값. 소수 둘째 자리까지 */
const fixed = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const unitText = (value: number | null | undefined, unit: string) => (value == null ? "없음" : `${fixed.format(value)} ${unit}`);

/**
 * 정리안 지표 표의 줄: 이름 · 지금 · 정리안. footprintM2(더미가 퍼진 볼록 껍질 넓이)는 정리안에서 오히려 커질 수 있어
 * 개선 지표로 읽히지 않게 보이지 않는다.
 */
export function metricRows(
  current: ScanLayoutMetrics,
  proposal: ScanLayoutMetrics | null,
  gapM: number,
): { key: string; label: string; now: string; next: string | null }[] {
  const pick = (metrics: ScanLayoutMetrics | null, read: (m: ScanLayoutMetrics) => string) => (metrics ? read(metrics) : null);
  return [
    {
      key: "mixedPairs",
      label: `다른 폐기물과 ${fixed.format(gapM)} m 안에 붙은 더미 쌍`,
      now: `${current.mixedPairs}쌍`,
      next: pick(proposal, (m) => `${m.mixedPairs}쌍`),
    },
    {
      key: "minMixedGapM",
      label: "다른 폐기물 사이 가장 가까운 간격",
      now: unitText(current.minMixedGapM, "m"),
      next: pick(proposal, (m) => unitText(m.minMixedGapM, "m")),
    },
    {
      key: "weightedDistanceM",
      label: "상차 지점까지 평균 거리(부피 가중)",
      now: unitText(current.weightedDistanceM, "m"),
      next: pick(proposal, (m) => unitText(m.weightedDistanceM, "m")),
    },
  ];
}

/** 정리안 한 줄 요약. 정리안이 없으면 null */
export function proposalSummary(view: ScanView): string | null {
  const layout = view.layout;
  if (!layout?.proposal) return null;
  const now = layout.current;
  const next = layout.proposal.metrics;
  const parts = [`붙은 더미 ${now.mixedPairs}쌍 → ${next.mixedPairs}쌍`];
  if (now.weightedDistanceM != null && next.weightedDistanceM != null) {
    parts.push(`상차 지점까지 평균 ${fixed.format(now.weightedDistanceM)} m → ${fixed.format(next.weightedDistanceM)} m`);
  }
  parts.push(`더미 ${layout.proposal.moved}개 옮김`);
  return parts.join(" · ");
}

/** 폐기물마다 정리안 색 순서(정리안 영역 순서를 따른다). 범례와 3D가 같은 순서를 쓴다 */
export function zoneOrder(view: ScanView): string[] {
  const zones = view.layout?.proposal?.zones ?? [];
  return zones.map((zone) => zone.streamId);
}

/** 정리안 색 토큰. 차트 범주형 고정 순서. 여섯을 넘으면 되돌아간다 */
export const ZONE_TOKENS = [
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-agent-5-ink",
  "--color-agent-6-ink",
] as const;

export function zoneToken(index: number): string {
  return ZONE_TOKENS[((index % ZONE_TOKENS.length) + ZONE_TOKENS.length) % ZONE_TOKENS.length];
}

/** 점이 다각형 안에 있는지(짝홀 규칙). 상차 지점을 바닥 밖에 찍지 않게 한다 */
export function insidePolygon(x: number, y: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 스캔을 만든 시각을 "11월 20일 03:10"으로 적는다(서울 시간) */
export function scanTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** 계량한 무게 입력값. 빈 칸·0 이하·숫자가 아니면 null */
export function weighedValue(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  if (text.trim() === "" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
