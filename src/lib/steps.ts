/** 설계안 v1 "화면 단위 흐름"의 8단계. slug는 /session 하위 경로로 쓴다. */
export const SESSION_STEPS = [
  { no: 1, slug: "upload", label: "업로드" },
  { no: 2, slug: "classify", label: "식별 결과" },
  { no: 3, slug: "feasibility", label: "판정" },
  { no: 4, slug: "regulation", label: "규정 검토" },
  { no: 5, slug: "matching", label: "묶음 수거 매칭" },
  { no: 6, slug: "cost-carbon", label: "비용·탄소 비교" },
  { no: 7, slug: "proposal", label: "최적안·승인" },
  { no: 8, slug: "dashboard", label: "대시보드" },
] as const;

export type SessionStep = (typeof SESSION_STEPS)[number];
export type SessionStepSlug = SessionStep["slug"];
