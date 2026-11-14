import { formatNumber, formatSigned } from "@/lib/format";
import type { Session, StreamRoute } from "@/lib/session/types";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";
import { CheckIcon } from "../icons";

/** 앞 단계에서 확정한 사실을 다음 화면에서도 보이게 누적한다 (v2 감사 "길 찾기" 항목). */
export function ConfirmedChips({ session }: { session: Session }) {
  const chips: { k: string; v: string; sub?: string }[] = [];
  const totalKg = session.streams.reduce((a, s) => a + s.monthlyKg, 0);
  chips.push({ k: "흐름", v: `${session.streams.length}개`, sub: `월 ${formatNumber(totalKg)}kg` });
  const f = session.feasibility;
  if (f) {
    const counts = new Map<StreamRoute, number>();
    for (const d of f.decisions) counts.set(d.route, (counts.get(d.route) ?? 0) + 1);
    chips.push({ k: "경로", v: [...counts].map(([r, n]) => `${STREAM_ROUTE_LABEL[r]} ${n}`).join(" · ") });
    chips.push({ k: "공장 월 손익", v: `${formatSigned(f.totalNow)} → ${formatSigned(f.totalAfter)}원` });
  }
  if (session.regulation) {
    const asks = session.regulation.items.filter((i) => i.status === "ask").length;
    chips.push({ k: "규정", v: asks ? `확인 ${asks}건 남음` : "모두 가능" });
  }
  if (session.matching?.bundles.length) {
    const b = session.matching.bundles[0];
    chips.push({ k: "묶음", v: `${b.group.length}개사 ${formatNumber(b.totalKg)}kg`, sub: `적재율 ${Math.round(b.fillRate * 100)}%` });
  }
  if (session.selectedRoute && session.costCarbon) {
    const r = session.costCarbon.routes.find((x) => x.id === session.selectedRoute);
    if (r) chips.push({ k: "시나리오", v: `${r.id}. ${r.name}` });
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
