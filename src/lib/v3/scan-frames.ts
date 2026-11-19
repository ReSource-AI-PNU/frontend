/**
 * 브라우저에서 영상이나 사진 여러 장을 장면 사진(JPEG)으로 바꾼다. 영상 원본은 보내지 않는다:
 * 운영 업로드 상한이 20MB이고, 소리와 고화질 원본을 서버에 남기지 않기 위함이다(계약 1장).
 * 계산(장면 수, 크기, 품질 단계)은 scan.ts의 순수 함수가 정한다.
 */
import {
  LONG_SIDE,
  MAX_PHOTOS,
  MAX_TOTAL_BYTES,
  MIN_VIDEO_SEC,
  QUALITY_STEPS,
  ScanInputError,
  TOO_BIG_MESSAGE,
  fitSize,
  frameCount,
  frameTimes,
  nextQuality,
  photoProblem,
  spread,
} from "./scan";

export type FrameSet = { frames: Blob[]; source: "video" | "photos"; durationSec: number | null };
type Progress = (done: number, total: number) => void;

const OPEN_FAILED = "이 영상을 열지 못했습니다. 휴대폰에서 바로 찍어 올리거나 MP4 영상으로 다시 올려 주세요.";
const SEEK_FAILED = "영상에서 장면을 고르지 못했습니다. 휴대폰에서 바로 찍어 올리거나 MP4 영상으로 다시 올려 주세요.";

function waitFor(target: HTMLVideoElement, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, ms);
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("error"));
    };
    function cleanup() {
      window.clearTimeout(timer);
      target.removeEventListener(event, done);
      target.removeEventListener("error", fail);
    }
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", fail, { once: true });
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", quality);
  });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ScanInputError(SEEK_FAILED);
  return { canvas, context };
}

/** 영상 길이 d초에서 고르게 장면을 뽑는다. 합계가 상한을 넘으면 품질을 낮춰 다시 뽑는다 */
export async function framesFromVideo(file: File, onProgress?: Progress): Promise<FrameSet> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    try {
      await waitFor(video, "loadeddata", 20000);
    } catch {
      throw new ScanInputError(OPEN_FAILED);
    }
    const duration = video.duration;
    if (!Number.isFinite(duration) || video.videoWidth === 0) throw new ScanInputError(OPEN_FAILED);
    if (duration < MIN_VIDEO_SEC) {
      throw new ScanInputError(`영상이 너무 짧습니다. 보관장을 한 바퀴 돌며 ${MIN_VIDEO_SEC}초 넘게 찍어 주세요.`);
    }
    const times = frameTimes(duration, frameCount(duration));
    const size = fitSize(video.videoWidth, video.videoHeight, LONG_SIDE);
    const { canvas, context } = canvasOf(size.width, size.height);
    let quality: number | null = QUALITY_STEPS[0];
    while (quality !== null) {
      const frames: Blob[] = [];
      let total = 0;
      for (const [index, time] of times.entries()) {
        video.currentTime = time;
        try {
          await waitFor(video, "seeked", 10000);
        } catch {
          throw new ScanInputError(SEEK_FAILED);
        }
        context.drawImage(video, 0, 0, size.width, size.height);
        const blob = await toJpeg(canvas, quality);
        frames.push(blob);
        total += blob.size;
        onProgress?.(index + 1, times.length);
        if (total > MAX_TOTAL_BYTES) break;
      }
      if (total <= MAX_TOTAL_BYTES && frames.length === times.length) {
        return { frames, source: "video", durationSec: Math.round(duration * 10) / 10 };
      }
      quality = nextQuality(quality);
    }
    throw new ScanInputError(TOO_BIG_MESSAGE);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ScanInputError(`${file.name} 사진을 열지 못했습니다. JPG나 PNG 사진으로 다시 골라 주세요.`);
  }
}

/** 사진 여러 장을 찍은 순서대로 줄여 쓴다. 80장보다 많으면 고르게 80장만 쓴다 */
export async function framesFromPhotos(files: File[], onProgress?: Progress): Promise<FrameSet> {
  const problem = photoProblem(files.length);
  if (problem) throw new ScanInputError(problem);
  const ordered = [...files].sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name));
  const chosen = spread(ordered, MAX_PHOTOS);
  let quality: number | null = QUALITY_STEPS[0];
  while (quality !== null) {
    const frames: Blob[] = [];
    let total = 0;
    for (const [index, file] of chosen.entries()) {
      const bitmap = await decode(file);
      const size = fitSize(bitmap.width, bitmap.height, LONG_SIDE);
      const { canvas, context } = canvasOf(size.width, size.height);
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      bitmap.close();
      const blob = await toJpeg(canvas, quality);
      frames.push(blob);
      total += blob.size;
      onProgress?.(index + 1, chosen.length);
      if (total > MAX_TOTAL_BYTES) break;
    }
    if (total <= MAX_TOTAL_BYTES && frames.length === chosen.length) return { frames, source: "photos", durationSec: null };
    quality = nextQuality(quality);
  }
  throw new ScanInputError(TOO_BIG_MESSAGE);
}
