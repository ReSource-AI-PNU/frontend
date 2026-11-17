/**
 * 백엔드·통로 오류를 화면 문구로 바꾼다. 원인(코드)은 ApiError.code에 남기고, 사용자에게는 다음 행동을 알려 주는 말만 보인다.
 * 서버 문장을 그대로 보여 주는 것은 승인·답변처럼 업무 상태를 설명하는 코드뿐이다(아래 KEEP_SERVER_MESSAGE).
 * 순수 함수라 node --test로 검사한다(tests/v3-errors.test.ts).
 */

export const UNAVAILABLE = "잠시 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";

/** 업무 상태를 설명하는 코드. 서버가 쓴 한국어 문장이 그대로 다음 행동을 알려 준다. */
const KEEP_SERVER_MESSAGE = new Set([
  "NOT_AGREED",
  "APPROVAL_BLOCKED",
  "PERMIT_MISMATCH",
  "THREAD_NOT_CONFIRMED",
  "INVALID_VALUE",
  "INVALID_ANSWER",
  "NO_CHANGE",
  "STREAM_NOT_IN_THREAD",
  "FILE_REQUIRED",
  // 프런트 통로(src/lib/v3/backend-plan.ts)가 쓴 문구는 이미 사용자 말이다
  "DEMO_READ_ONLY",
  "DEMO_UNAVAILABLE",
  "ORG_MISMATCH",
]);

const BY_CODE: Record<string, string> = {
  LOGIN_REQUIRED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  ORG_REQUIRED: "회사를 먼저 등록해 주세요.",
  TOO_LARGE: "파일이 너무 큽니다. 20MB보다 작은 파일을 올려 주세요.",
  UNSUPPORTED_MEDIA: "사진이나 영상 파일만 올릴 수 있습니다.",
  INVALID_MULTIPART: "파일을 올리지 못했습니다. 다시 올려 주세요.",
  DOCUMENT_INTELLIGENCE_UNAVAILABLE: "이 형식의 문서는 지금 읽을 수 없습니다. 글(텍스트) 파일을 올리거나 값을 직접 적어 주세요.",
  DOCUMENT_FAILED: "이 문서는 읽지 못했습니다. 잠시 후 다시 올리거나 값을 직접 적어 주세요.",
  DETECTOR_FAILED: "이 파일은 분석하지 못했습니다. 다른 사진을 올리거나 수치를 직접 적어 주세요.",
  SHIELD_FAILED: "이 문서는 지금 확인하지 못했습니다. 잠시 후 다시 올려 주세요.",
};

export function userMessage(status: number, code: string, serverMessage: string | null): string {
  if (KEEP_SERVER_MESSAGE.has(code) && serverMessage) return serverMessage;
  if (BY_CODE[code]) return BY_CODE[code];
  if (status === 0 || status >= 500) return UNAVAILABLE;
  if (status === 401) return BY_CODE.LOGIN_REQUIRED;
  if (status === 403) return "이 회사에서는 할 수 없는 일입니다.";
  if (status === 404) return "찾을 수 없습니다. 화면을 새로 고쳐 주세요.";
  if (status === 409) return "다른 변경과 겹쳤습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.";
  if (status === 413) return BY_CODE.TOO_LARGE;
  if (status === 429) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return "입력한 내용을 다시 확인해 주세요.";
}
