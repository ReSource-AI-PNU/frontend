"use client";

import { usePathname } from "next/navigation";

/**
 * v2 화면(모의 API)의 안내 띠. v3 화면은 백엔드의 실제 에이전트 대화와 실행 기록을 그리고
 * 데이터 출처를 스스로 표시하므로(백엔드 연결됨 / 예시 데이터) 이 띠를 보여 주지 않는다.
 */
export function MockNote() {
  const pathname = usePathname();
  if (pathname === "/v3" || pathname.startsWith("/v3/")) return null;
  return (
    <div role="note" className="border-b border-line bg-sunken px-4 py-3 text-sm font-semibold text-ink">
      시연 환경: 식별·규정·매칭·협상·학습과 실행 기록은 모의 결과이며 외부 발송은 모의 메일함에만 기록됩니다. 경제 미리보기는 가상 데이터로 계산합니다.
    </div>
  );
}
