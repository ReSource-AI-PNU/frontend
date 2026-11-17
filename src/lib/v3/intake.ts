/**
 * 자료 올리기 화면의 순수 함수(tests/intake.test.ts).
 *  - 아직 확인하지 않은 문서 추출값: 새로 고치거나 다음 문서를 올려도 사라지지 않게 탭 저장소(sessionStorage)에 둔다.
 *  - 사진 분석 결과에 찾은 것이 하나도 없는지.
 *  - 수치를 직접 적으면 측정값 CSV 한 줄로 만들어 같은 길(POST /intake/csv)로 올린다.
 */
import type { DocumentUploadResult, MediaUploadResult } from "./types";

/* ── 확인하지 않은 문서 추출값 ─────────────────────────────────────── */

export type PendingDocument = {
  /** 올린 차례로 붙인 ID(파일 이름이 같아도 겹치지 않게) */
  id: string;
  uploadedAt: string;
  result: DocumentUploadResult;
  /** 담당자가 확인 표시한 항목(field → 표시) */
  checked: Record<string, boolean>;
};

/** 한 화면에 남겨 두는 최대 개수(오래된 것부터 버린다) */
export const PENDING_LIMIT = 5;

export function pendingKey(orgId: string, scope: string): string {
  return `rsai-pending-documents:${orgId}:${scope}`;
}

const isObj = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** 저장해 둔 글을 읽는다. 모양이 맞지 않는 항목은 버린다 */
export function parsePending(raw: string | null): PendingDocument[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (item): item is PendingDocument =>
        isObj(item) &&
        typeof item.id === "string" &&
        typeof item.uploadedAt === "string" &&
        isObj(item.result) &&
        typeof item.result.filename === "string" &&
        Array.isArray(item.result.fields) &&
        isObj(item.checked),
    )
    .slice(0, PENDING_LIMIT);
}

/** 새로 올린 문서를 맨 위에 더한다. 뽑은 값이 없거나 쓰지 않는 문서(숨은 지시문)는 남기지 않는다 */
export function addPending(list: PendingDocument[], result: DocumentUploadResult, now: Date): PendingDocument[] {
  if (result.fields.length === 0 || result.blocked) return list;
  const id = `${now.getTime().toString(36)}-${result.filename}`;
  return [{ id, uploadedAt: now.toISOString(), result, checked: {} }, ...list.filter((item) => item.id !== id)].slice(0, PENDING_LIMIT);
}

export function checkPending(list: PendingDocument[], id: string, field: string, value: boolean): PendingDocument[] {
  return list.map((item) => (item.id === id ? { ...item, checked: { ...item.checked, [field]: value } } : item));
}

/** 근거로 등록했거나 버린 문서를 뺀다 */
export function dropPending(list: PendingDocument[], id: string): PendingDocument[] {
  return list.filter((item) => item.id !== id);
}

/* ── 사진 분석 ────────────────────────────────────────────────────── */

/** 분석은 했지만 재질도 이물 비율도 탐지한 것도 없다(다음 행동을 알려 줘야 한다) */
export function nothingDetected(result: MediaUploadResult): boolean {
  if (result.detectorUnavailable) return false;
  const contamination = result.contamination?.claim?.value;
  return !result.material && (contamination === null || contamination === undefined) && (result.detections?.length ?? 0) === 0;
}

/* ── 수치 직접 적기 ───────────────────────────────────────────────── */

export type MeasureInput = {
  name: string;
  process: string;
  material: string;
  contaminationPct: number;
  moisturePct: number;
  /** YYYY-MM-DD */
  measuredOn: string;
};

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 직접 적은 측정값을 백엔드 측정값 CSV 양식 한 줄로 만든다. 머리글은 양식의 필수 열만 쓴다("흐름 이름"은 백엔드 양식의
 * 열 이름이고 화면에는 보이지 않는다). 출처·형태 같은 선택 열은 폐기물 자료에 이미 있으므로 넣지 않는다.
 */
export function measureCsv(input: MeasureInput): string {
  const header = ["흐름 이름", "공정", "재질", "오염도(%)", "수분(%)", "측정일"];
  const row = [input.name, input.process, input.material, input.contaminationPct, input.moisturePct, input.measuredOn];
  return `${header.map(cell).join(",")}\r\n${row.map(cell).join(",")}\r\n`;
}

/** 측정값 칸 검사. 문제가 없으면 null, 있으면 고칠 것 한 줄 */
export function measureProblem(input: { process: string; contamination: string; moisture: string; measuredOn: string }): string | null {
  if (!input.process.trim()) return "공정을 적어 주세요.";
  const contamination = Number(input.contamination);
  const moisture = Number(input.moisture);
  if (input.contamination.trim() === "" || !Number.isFinite(contamination) || contamination < 0 || contamination > 100) {
    return "오염도는 0에서 100 사이의 숫자로 적어 주세요.";
  }
  if (input.moisture.trim() === "" || !Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
    return "수분은 0에서 100 사이의 숫자로 적어 주세요.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.measuredOn)) return "측정일을 골라 주세요.";
  return null;
}
