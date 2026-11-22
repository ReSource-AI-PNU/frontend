import type { ReactNode } from "react";
import { AgentHome } from "@/components/agent/home";

/**
 * 찾기 한 건의 화면들(진행·결과, 자세한 내용, AI끼리 나눈 대화, 승인, 서류, 판단 표·근거)은 각자 주소를 갖지만,
 * 이 레이아웃이 찾기 화면을 계속 그려 두어 하위 화면을 옮겨 다녀도 실시간 진행과 대화 패널이 끊기지 않는다.
 * 어느 화면을 보일지는 주소로 정하고(AgentHome), 각 page.tsx는 화면 제목만 정한다.
 */
export default function FindLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AgentHome />
    </>
  );
}
