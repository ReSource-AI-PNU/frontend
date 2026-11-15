import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyzingView } from "@/components/session/analyzing-view";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

export const metadata: Metadata = { title: "분석 중" };

export default async function AnalyzingPage({ params }: PageProps<"/session/[id]/analyzing">) {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute params={params} step="classify" />;
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  if (session.status !== "analyzing") redirect(`/session/${id}/classify`);
  return <AnalyzingView sessionId={session.id} streams={session.streams} />;
}
