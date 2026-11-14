import type { ReactNode } from "react";
import { ConfirmedChips } from "@/components/session/confirmed-chips";
import { SessionShell } from "@/components/session/session-shell";
import { SessionRail, type RailItem } from "@/components/session/session-rail";
import { SessionStatusBadge } from "@/components/dashboard/session-status";
import { summarizeConsent } from "@/lib/bundle-consent";
import { findComplex } from "@/lib/complexes";
import type { RunEventView } from "@/lib/run-log-labels";
import { bundleConsents } from "@/lib/server/bundle-consent";
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

/** 콘솔의 시각 표기(14:05:09). 서버에서 만들어 넘긴다 */
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** 콘솔 머리말의 지금 상태. 사람이 해야 할 일이 있으면 그것을 먼저 알린다 */
async function consoleStatus(s: Session) {
  if (s.status === "analyzing") return { label: "식별·분류 에이전트 실행 중", live: true };
  if (s.status === "awaiting-approval") return { label: "사람 승인 대기 · 이행안 화면에서 승인해야 발송됩니다", live: false };
  const deal = s.negotiations?.find((n) => n.status === "agreed");
  if (deal) return { label: `협상 합의안 승인 대기 · ${deal.counterparty.name}`, live: false };
  if (s.status === "sent") {
    const consents = await bundleConsents(s);
    const pending = (s.matching?.bundles ?? []).reduce((a, b) => a + summarizeConsent(b, consents.get(b.streamId) ?? []).pending, 0);
    if (pending) return { label: `이웃 기업 회신 대기 ${pending}곳`, live: true };
    return { label: "수거와 실제 결과 기록 대기", live: false };
  }
  if (s.status === "completed") return { label: "수거 완료 · 결과가 다음 학습에 쓰입니다", live: false };
  const asks = s.questions.filter((q) => !q.answer && (q.step !== "regulation" || s.regulation)).length;
  return { label: asks ? `되묻기 ${asks}건이 답을 기다립니다` : "다음 단계 대기", live: false };
}

export default async function SessionLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  const complex = findComplex(session.complexId);
  const events: RunEventView[] = (session.runLog ?? []).map((e) => ({
    ...e,
    time: TIME.format(new Date(e.at)),
  }));

  return (
    <SessionShell
      sessionId={session.id}
      events={events}
      status={await consoleStatus(session)}
      rail={
        <aside className="hidden border-r border-line px-3 py-6 lg:flex lg:flex-col lg:gap-6 xl:group-data-[console=open]/shell:px-2">
          <SessionRail sessionId={session.id} items={railItems(session)} />
          <div className="mt-auto border-t border-line px-2 pt-3 text-[12px] leading-relaxed text-muted xl:group-data-[console=open]/shell:hidden">
            <p className="text-[13px] font-semibold text-ink">{session.title}</p>
            <p>{complex?.name}</p>
            <p className="num">{session.id}</p>
          </div>
        </aside>
      }
    >
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <ConfirmedChips session={session} />
          <SessionStatusBadge status={session.status} />
        </div>
        {children}
      </div>
    </SessionShell>
  );
}
