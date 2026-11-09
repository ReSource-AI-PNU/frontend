import type { ReactNode } from "react";
import { ConfirmedChips } from "@/components/session/confirmed-chips";
import { SessionRail, type RailItem } from "@/components/session/session-rail";
import { SessionStatusBadge } from "@/components/dashboard/session-status";
import { findComplex } from "@/lib/complexes";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";
import { FLOW_STEPS, type Session } from "@/lib/session/types";

function railItems(s: Session): RailItem[] {
  const has: Record<string, boolean> = {
    classify: s.status !== "analyzing",
    feasibility: Boolean(s.feasibility),
    regulation: Boolean(s.regulation),
    matching: Boolean(s.matching),
    "cost-carbon": Boolean(s.costCarbon),
    proposal: Boolean(s.proposal),
  };
  let nextGiven = false;
  const flow: RailItem[] = FLOW_STEPS.map((f) => {
    if (has[f.slug]) return { slug: f.slug, no: f.no, label: f.label, state: "done" };
    if (!nextGiven && s.status !== "analyzing") {
      nextGiven = true;
      return { slug: f.slug, no: f.no, label: f.label, state: "next" };
    }
    return { slug: f.slug, no: f.no, label: f.label, state: "locked" };
  });
  return [{ slug: "upload", no: 1, label: "업로드", state: "done" }, ...flow, { slug: "dashboard", no: 8, label: "대시보드", state: "done" }];
}

export default async function SessionLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const complex = findComplex(session.complexId);

  return (
    <div className="grid flex-1 lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line px-3 py-6 lg:flex lg:flex-col lg:gap-6">
        <SessionRail sessionId={session.id} items={railItems(session)} />
        <div className="mt-auto border-t border-line px-2 pt-3 text-[12px] leading-relaxed text-muted">
          <p className="text-[13px] font-semibold text-ink">{session.title}</p>
          <p>{complex?.name}</p>
          <p className="num">{session.id}</p>
        </div>
      </aside>
      <div className="min-w-0 px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <ConfirmedChips session={session} />
          <SessionStatusBadge status={session.status} />
        </div>
        {children}
      </div>
    </div>
  );
}
