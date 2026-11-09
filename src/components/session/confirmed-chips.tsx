import { formatNumber, formatSigned } from "@/lib/format";
import type { Session } from "@/lib/session/types";
import { CheckIcon } from "../icons";

const VERDICT = { reuse: "재사용 가능", recycle: "재활용 가능", dispose: "폐기 처리" } as const;

/** 앞 단계에서 확정한 사실을 다음 화면에서도 보이게 누적한다 (v2 감사 "길 찾기" 항목). */
export function ConfirmedChips({ session }: { session: Session }) {
  const chips: { k: string; v: string; sub?: string }[] = [];
  const volume = session.questions.find((q) => q.id === "volume")?.answer;
  chips.push({ k: "품목", v: session.classify.detail, sub: `${formatNumber(Number(volume ?? session.classify.estimatedKg))}kg/월` });
  if (session.feasibility) chips.push({ k: "판정", v: VERDICT[session.feasibility.verdict], sub: `작업 후 ${formatSigned(session.feasibility.afterPerKg)}/kg` });
  if (session.regulation) chips.push({ k: "규정", v: session.regulation.conclusion.tone === "gain" ? "인정 신청 가능" : "폐기물로 처리" });
  if (session.matching) chips.push({ k: "묶음", v: `${session.matching.group.length}개사 ${formatNumber(session.matching.totalKg)}kg`, sub: session.matching.collector.name });
  if (session.selectedRoute && session.costCarbon) {
    const r = session.costCarbon.routes.find((x) => x.id === session.selectedRoute);
    if (r) chips.push({ k: "경로", v: `${r.id}. ${r.name}`, sub: `${formatSigned(r.monthlyKrw)}원/월` });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[12px] text-muted">지금까지 확정</span>
      {chips.map((c) => (
        <span key={c.k} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[13px] [&_svg]:size-[13px] [&_svg]:text-gain">
          <CheckIcon />
          {c.k} <b className="font-semibold">{c.v}</b>
          {c.sub ? <span className="text-[12px] text-muted">{c.sub}</span> : null}
        </span>
      ))}
    </div>
  );
}
