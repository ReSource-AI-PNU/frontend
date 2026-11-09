import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AgreeButton } from "@/components/knowledge/agree-button";
import { KnowledgeReceipt } from "@/components/knowledge/knowledge-receipt";
import { NewCardDialog } from "@/components/knowledge/new-card-dialog";
import { KNOWLEDGE_STATUS, KNOWLEDGE_STATUS_ORDER } from "@/components/knowledge/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { WASTE_ITEMS, type WasteItem } from "@/lib/domain";
import { requireOrganization } from "@/lib/server/organization";
import { getCurrentUser } from "@/lib/server/session";
import { ensureSeeds, knowledgeCards } from "@/lib/server/sessions";
import { FLOW_STEPS, type KnowledgeStatus } from "@/lib/session/types";

export const metadata: Metadata = { title: "현장 지식" };

function FilterRow({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: { key: string | null; label: string; n: number }[];
  current: string | null;
  hrefFor: (key: string | null) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-10 text-label text-muted">{label}</span>
      <ul className="flex flex-wrap gap-1 rounded-md bg-sunken p-1">
        {options.map((o) => (
          <li key={o.label}>
            <Link
              href={hrefFor(o.key)}
              aria-current={o.key === current ? "page" : undefined}
              className="flex min-h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold text-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
            >
              {o.label}
              <span className="text-[12px] font-medium tabular-nums">{o.n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function KnowledgePageContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const org = await requireOrganization();
  const user = await getCurrentUser();
  await ensureSeeds();
  const all = (await knowledgeCards.all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const item = WASTE_ITEMS.includes(sp.item as WasteItem) ? (sp.item as WasteItem) : null;
  const status = KNOWLEDGE_STATUS_ORDER.includes(sp.status as KnowledgeStatus) ? (sp.status as KnowledgeStatus) : null;
  const cards = all.filter((c) => (!item || c.item === item) && (!status || c.status === status));

  const href = (next: { item?: string | null; status?: string | null }) => {
    const q = new URLSearchParams();
    const i = next.item === undefined ? item : next.item;
    const s = next.status === undefined ? status : next.status;
    if (i) q.set("item", i);
    if (s) q.set("status", s);
    const qs = q.toString();
    return qs ? `/knowledge?${qs}` : "/knowledge";
  };

  const adopted = all.filter((c) => c.status === "adopted");
  const example = adopted.sort((a, b) => b.citedCount - a.citedCount)[0];
  const exampleStep = example ? FLOW_STEPS.find((s) => s.slug === example.step) : null;
  const myItem = org.wasteStreams[0]?.item;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-h1">현장 지식</h1>
          <p className="mt-1 text-sm text-muted">
            AI 판정과 현장 판단이 갈릴 때 남긴 기준입니다. 숙련자의 암묵지를 조건 → 판단 → 근거로 적어 두면, 동의를 모으고 관리자가 채택한 카드가 다음 판정의 근거가 됩니다.
          </p>
        </div>
        <NewCardDialog defaultItem={item ?? myItem} />
      </header>

      <section aria-labelledby="how-cited" className="grid gap-3 border-y border-line py-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <div>
          <h2 id="how-cited" className="text-label text-muted">
            채택 카드는 이렇게 인용됩니다
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            채택된 카드 <span className="tabular-nums">{adopted.length}</span>장이 지금까지 판정 <span className="tabular-nums">{adopted.reduce((s, c) => s + c.citedCount, 0)}</span>건의 근거로 쓰였습니다.
          </p>
        </div>
        {example ? (
          <div className="min-w-0">
            <p className="text-sm text-ink-2">
              같은 품목을 판정할 때 {exampleStep?.agent ?? "에이전트"} 근거 기록에 한 줄로 붙고, 출처에 작성 회사가 남습니다.
            </p>
            <div className="mt-2 grid gap-1 rounded-md bg-sunken px-4 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
              <span className="text-[12px] font-semibold text-muted">{exampleStep?.agent}</span>
              <span>
                {example.condition} → {example.judgment}
              </span>
              <span className="text-[12px] text-muted">출처: 현장 지식 · {example.orgName}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">아직 채택된 카드가 없습니다. 채택되면 판정 근거 기록에 출처와 함께 한 줄로 붙습니다.</p>
        )}
      </section>

      <div className="grid gap-2">
        <FilterRow
          label="품목"
          current={item}
          hrefFor={(k) => href({ item: k })}
          options={[
            { key: null, label: "전체", n: all.filter((c) => !status || c.status === status).length },
            ...WASTE_ITEMS.map((i) => ({ key: i, label: i, n: all.filter((c) => c.item === i && (!status || c.status === status)).length })),
          ]}
        />
        <FilterRow
          label="상태"
          current={status}
          hrefFor={(k) => href({ status: k })}
          options={[
            { key: null, label: "전체", n: all.filter((c) => !item || c.item === item).length },
            ...KNOWLEDGE_STATUS_ORDER.map((s) => ({ key: s, label: KNOWLEDGE_STATUS[s].label, n: all.filter((c) => c.status === s && (!item || c.item === item)).length })),
          ]}
        />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="조건에 맞는 카드가 없습니다"
          description="다른 품목이나 상태를 고르거나, 현장에서 쓰는 기준을 새 카드로 남겨 주세요."
          action={
            <ButtonLink href="/knowledge" variant="secondary">
              필터 지우기
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label={`현장 지식 카드 ${cards.length}장`}>
          {cards.map((card) => (
            <li key={card.id}>
              <KnowledgeReceipt
                card={card}
                actions={<AgreeButton cardId={card.id} agreed={card.agrees.includes(user.id)} count={card.agrees.length} />}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-muted">
        다른 회사 이름으로 보이는 카드 일부는 시연용 예시입니다. 카드 채택과 반려는 관리자 학습 콘솔에서 합니다.
      </p>
    </div>
  );
}

/** 클라이언트 이동이 바로 보이도록 페이지 안에 Suspense 경계를 둔다 (Next 16 instant navigation). */
export default function KnowledgePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KnowledgePageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
