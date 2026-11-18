"use client";

import { MoreDetails } from "@/components/ui/more-details";
import { ClaimValue } from "@/components/v3/claim";
import { StatusChip, type ChipTone } from "@/components/v3/status-chip";
import { REGULATION_FOOT, REGULATION_LEAD, STATUS_WORD, planRegulation, type Todo } from "@/lib/v3/regulation";
import type { Claim, Regulation, ViewStream } from "@/lib/v3/types";

const TONE: Record<string, ChipTone> = { met: "done", conditional: "warn", unmet: "stop", needs_information: "warn" };

function Clauses({ clauses }: { clauses: Claim[] }) {
  if (clauses.length === 0) return null;
  return (
    <ul className="space-y-2 pb-2">
      {clauses.map((claim) => (
        <li key={claim.id} className="border-l-2 border-ink pl-3 text-[13px] leading-relaxed text-ink-2">
          {claim.label ? <span className="block text-[12px] text-muted">{claim.label}</span> : null}
          <ClaimValue claim={claim} title={claim.label ?? "법령 조항"} className="!font-normal text-left" />
        </li>
      ))}
    </ul>
  );
}

function TodoDetail({ todo }: { todo: Todo }) {
  return (
    <li className="py-3">
      <p className="font-medium">{todo.title}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{todo.action}</p>
      {todo.only.length > 0 ? <p className="mt-0.5 text-[13px] text-muted">해당 폐기물: {todo.only.join(", ")}</p> : null}
      {todo.applies ? <p className="mt-0.5 text-[13px] text-muted">적용: {todo.applies}</p> : null}
      <div className="mt-2">
        <Clauses clauses={todo.clauses} />
      </div>
    </li>
  );
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed marker:text-muted">
        {todos.map((todo) => (
          <li key={todo.key}>
            {todo.title}
            {todo.only.length > 0 ? <span className="text-[13px] text-muted"> ({todo.only.join(", ")})</span> : null}
          </li>
        ))}
      </ol>
      <MoreDetails label="할 일마다 방법과 근거 조항 보기" closeLabel="간단히 보기">
        <ul className="divide-y divide-line border-b border-line">
          {todos.map((todo) => (
            <TodoDetail key={todo.key} todo={todo} />
          ))}
        </ul>
      </MoreDetails>
    </>
  );
}

/** 결과 아래(배출 기업만): ③ 법령 요건 확인. 업체 허가 판정은 표로, 담당자 할 일은 한 번씩 */
export function RegulationSection({ sections, streams }: { sections: Regulation[]; streams: ViewStream[] }) {
  const nameOf = (id: string) => {
    const stream = streams.find((item) => item.id === id);
    return stream?.name ?? stream?.label ?? "폐기물";
  };
  const plan = planRegulation(sections, nameOf);
  if (plan.permits.length === 0 && plan.todos.length === 0) return null;
  return (
    <section aria-label="법령 요건 확인" className="border-t border-line pt-6">
      <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{plan.headline}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{REGULATION_LEAD}</p>

      {plan.permits.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[14px] font-medium text-muted">받는 업체의 허가</h3>
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {plan.permits.map((row) => (
              <li key={row.streamId} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[14px]">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted">{row.route}</span>
                <StatusChip tone={TONE[row.status] ?? "warn"}>{STATUS_WORD[row.status]}</StatusChip>
                <span className="basis-full text-[13px] text-ink-2 sm:basis-auto">{row.note}</span>
              </li>
            ))}
          </ul>
          <MoreDetails label="허가 근거 조항 보기" closeLabel="접기">
            <Clauses clauses={plan.permits[0].clauses} />
          </MoreDetails>
        </div>
      ) : null}

      {plan.todos.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[14px] font-medium text-muted">담당자가 챙길 일 {plan.todos.length}가지</h3>
          <TodoList todos={plan.todos} />
        </div>
      ) : null}

      {plan.reuse ? (
        <MoreDetails className="mt-1" label={`공정에 다시 넣을 때 지킬 것 (${plan.reuse.names.join(", ")})`} closeLabel="접기">
          <TodoList todos={plan.reuse.todos} />
        </MoreDetails>
      ) : null}

      {plan.related.length > 0 ? (
        <MoreDetails className="mt-1" label="관련 조항 더 보기" closeLabel="접기" hint={`${plan.related.length}개`}>
          <Clauses clauses={plan.related} />
        </MoreDetails>
      ) : null}
      <p className="mt-3 text-[12px] leading-relaxed text-muted">{REGULATION_FOOT}</p>
    </section>
  );
}
