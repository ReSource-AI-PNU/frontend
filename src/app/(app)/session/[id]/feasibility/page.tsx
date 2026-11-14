import type { Metadata } from "next";
import { FeasibilityPreview } from "@/components/session/feasibility-preview";
import { StepFooter, StepHeader } from "@/components/session/step-chrome";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "경로 판정" };

export default async function FeasibilityPage({ params }: PageProps<"/session/[id]/feasibility">) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  return <div className="grid gap-8">
    <StepHeader step="feasibility" title="흐름별 경로 판정" description="흐름별 가상 경로와 경제 효과를 백엔드에서 계산합니다." />
    <FeasibilityPreview streams={session.streams} />
    <StepFooter sessionId={session.id} step="feasibility" nextLabel="규정 검토" />
  </div>;
}
