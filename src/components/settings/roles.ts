import type { Member } from "@/lib/session/types";

export type MemberRole = Member["role"];

/** 권한이 큰 순서 */
export const MEMBER_ROLES = ["관리자", "승인권자", "담당자"] as const satisfies readonly MemberRole[];

export const ROLE_SUMMARY: Record<MemberRole, string> = {
  관리자: "회사 정보, 멤버, 데이터를 관리하고 견적 발송을 승인합니다.",
  승인권자: "담당자가 만든 견적 요청서를 확인하고 외부 발송을 승인합니다.",
  담당자: "사진을 올리고 판정을 고치며 견적 요청서 초안을 만듭니다.",
};

/** 역할별 권한 표. 소유자 전용 항목은 ownerOnly로 따로 표시한다. */
export const PERMISSIONS: { label: string; roles: MemberRole[]; ownerOnly?: boolean }[] = [
  { label: "사진 업로드와 세션 진행", roles: ["관리자", "승인권자", "담당자"] },
  { label: "AI 판정 수정, 현장 지식 카드 작성", roles: ["관리자", "승인권자", "담당자"] },
  { label: "견적 요청서 초안 작성", roles: ["관리자", "승인권자", "담당자"] },
  { label: "견적 요청서·묶음 제안 외부 발송 승인", roles: ["관리자", "승인권자"] },
  { label: "회사 정보 수정", roles: ["관리자"] },
  { label: "멤버 초대, 역할 변경, 제거", roles: ["관리자"] },
  { label: "회사 데이터 내보내기", roles: ["관리자"] },
  { label: "회원 탈퇴 (회사 데이터 전체 삭제)", roles: ["관리자"], ownerOnly: true },
];
