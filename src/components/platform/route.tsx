import { Suspense } from "react";
import { connection } from "next/server";
import { PlatformWorkbench } from "./workbench";
import { localPlatformDemo } from "@/lib/platform/server";

export type PlatformView =
  | "workspace"
  | "upload"
  | "sessions"
  | "neighbor"
  | "vendor"
  | "profile"
  | "members";
async function Content({
  params,
  view,
  step,
}: {
  params?: Promise<{ id: string }>;
  view?: PlatformView;
  step?: string;
}) {
  await connection();
  return (
    <PlatformWorkbench
      demo={await localPlatformDemo()}
      sessionId={(await params)?.id}
      view={view}
      step={step}
    />
  );
}
export function PlatformRoute(props: {
  params?: Promise<{ id: string }>;
  view?: PlatformView;
  step?: string;
}) {
  return (
    <Suspense fallback={<p className="p-8">진단 불러오는 중…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
