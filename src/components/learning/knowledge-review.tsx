import { setKnowledgeStatus } from "@/lib/server/session-actions";
import type { KnowledgeCard } from "@/lib/session/types";
import { KnowledgeReceipt } from "../knowledge/knowledge-receipt";
import { buttonClass } from "../ui/button";

/** 제안됨·검토 중 카드의 채택/반려. 채택한 카드는 다음 판정의 근거로 인용된다. */
export function KnowledgeReview({ cards }: { cards: KnowledgeCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
        검토할 카드가 없습니다. 담당자가 AI와 판단이 갈린 이유를 남기면 &ldquo;제안됨&rdquo;으로 들어옵니다.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {cards.map((c) => (
        <li key={c.id}>
          <KnowledgeReceipt
            card={c}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted">
                  동의 <span className="tabular-nums">{c.agrees.length}</span>
                </span>
                {c.status === "proposed" ? (
                  <form action={setKnowledgeStatus.bind(null, c.id, "reviewing")}>
                    <button type="submit" className={buttonClass("ghost", "sm")}>
                      검토 시작
                    </button>
                  </form>
                ) : null}
                <form action={setKnowledgeStatus.bind(null, c.id, "adopted")}>
                  <button type="submit" className={buttonClass("secondary", "sm")} aria-label={`${c.condition} 카드 채택`}>
                    채택
                  </button>
                </form>
                <form action={setKnowledgeStatus.bind(null, c.id, "rejected")}>
                  <button type="submit" className={buttonClass("ghost", "sm")} aria-label={`${c.condition} 카드 반려`}>
                    반려
                  </button>
                </form>
              </div>
            }
          />
        </li>
      ))}
    </ul>
  );
}
