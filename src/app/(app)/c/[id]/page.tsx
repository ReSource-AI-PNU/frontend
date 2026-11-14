import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { CQuestions } from "@/components/c-question/c-questions";

async function CContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  if (session.kind !== "c-manual") notFound();
  return <CQuestions sessionId={id} />;
}

export default function CPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-6">세션을 불러오는 중…</p>}><CContent params={params} /></Suspense>;
}
