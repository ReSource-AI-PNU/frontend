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
  // 허가증 원문 대조가 끝나지 않은 경로: 어느 폐기물·업체가 어떤 상태인지와 할 일을 서버가 적는다
  "PERMIT_UNVERIFIED",
  // 허가증 대조 기록: 다른 업체·사업장의 허가증, 없는 쪽, 대조할 경로가 아님 등을 서버가 적는다
  "PERMIT_DOCUMENT_IGNORED",
  "PERMIT_DOCUMENT_NOT_FOUND",
  "PERMIT_NOT_MATCHED",
  "INVALID_PAGE",
  "NOT_AWAITING_APPROVAL",
  "ALREADY_CONFIRMED",
  "ROUTE_NOT_FOUND",
  "THREAD_NOT_CONFIRMED",
  "INVALID_VALUE",
  "INVALID_ANSWER",
  "NO_CHANGE",
  "STREAM_NOT_IN_THREAD",
  "FILE_REQUIRED",
  // 매입 기준표 검토 화면: 몇 번째 줄의 무엇을 고치면 되는지 서버가 적는다
  "INVALID_CRITERIA",
  // 견적 요청서: 후보를 찾은 뒤 무엇이 바뀌어 요청서를 만들지 않았는지 서버가 적는다
  "OUTSIDE_STALE",
  // 실제 결과: 같은 날 같은 계량표 번호를 이미 기록했다(어느 날 무슨 번호인지와 정정하라는 말을 서버가 적는다)
  "DUPLICATE_TICKET",
  // 보관장 3D 스캔: 장면 수, 폐기물을 먼저 골라야 하는 계량값, 분석을 받을 수 없음을 서버가 적는다
  "TOO_FEW_FRAMES",
  "STREAM_REQUIRED",
  "SCAN_UNAVAILABLE",
  "SCAN_NOT_READY",
  // 프런트 통로(src/lib/v3/backend-plan.ts)가 쓴 문구는 이미 사용자 말이다
  "DEMO_READ_ONLY",
  "DEMO_UNAVAILABLE",
  "ORG_MISMATCH",
  "ORG_CHANGED",
]);

const BY_CODE: Record<string, string> = {
  LOGIN_REQUIRED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  NOT_A_MEMBER: "이 회사의 구성원이 아닙니다. 소속 회사를 다시 불러옵니다.",
  OWNER_ONLY: "회사 소유자만 할 수 있습니다.",
  NOT_DEMO_ORG: "지금은 체험 화면을 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
  ORG_REQUIRED: "회사를 먼저 등록해 주세요.",
  TOO_LARGE: "파일이 너무 큽니다. 20MB보다 작은 파일을 올려 주세요.",
  UNSUPPORTED_MEDIA: "사진이나 영상 파일만 올릴 수 있습니다.",
  INVALID_MULTIPART: "파일을 올리지 못했습니다. 다시 올려 주세요.",
  DOCUMENT_INTELLIGENCE_UNAVAILABLE: "이 형식의 문서는 지금 읽을 수 없습니다. 글(텍스트) 파일을 올리거나 값을 직접 적어 주세요.",
  // 파일 자체를 열지 못함(깨진 PDF 등)과 문서를 읽는 서비스에 닿지 못함을 가른다
  DOCUMENT_UNREADABLE: "이 파일을 열지 못했습니다. 손상되지 않은 PDF나 사진(JPG·PNG)으로 다시 올리거나 값을 직접 적어 주세요.",
  DOCUMENT_FAILED: "지금 문서를 읽지 못했습니다. 잠시 후 같은 파일을 다시 올리거나 값을 직접 적어 주세요.",
  DETECTOR_FAILED: "이 파일은 분석하지 못했습니다. 다른 사진을 올리거나 수치를 직접 적어 주세요.",
  SHIELD_FAILED: "이 문서는 지금 확인하지 못했습니다. 잠시 후 다시 올려 주세요.",
  // 보관장 3D 스캔(2026-11-20)
  SCAN_UNAVAILABLE: "지금은 3D 분석을 할 수 없습니다. 잠시 뒤 다시 올려 주세요.",
  TOO_FEW_FRAMES: "장면이 너무 적습니다. 보관장을 천천히 한 바퀴 돌며 다시 찍어 주세요.",
  STREAM_REQUIRED: "먼저 이 더미의 폐기물을 골라 주세요.",
  SCAN_NOT_READY: "3D 장면이 아직 준비되지 않았습니다. 분석이 끝난 뒤 다시 열어 주세요.",
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
