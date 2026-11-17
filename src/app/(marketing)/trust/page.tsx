import type { Metadata } from "next";
import { TrustReport } from "@/components/trust/trust-report";

export const metadata: Metadata = {
  title: "AI 신뢰도",
  description: "Re:Source AI의 AI를 공개한 시험으로 잰 결과입니다. 목표에 못 미친 것과 아직 재지 못한 것도 함께 적습니다.",
};

/** 공개 화면(로그인 없음). 평가 결과는 브라우저가 /api/v3/trust에서 읽는다 */
export default function TrustPage() {
  return <TrustReport />;
}
