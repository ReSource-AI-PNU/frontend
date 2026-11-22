/**
 * 로그인한 뒤 첫 화면(홈)과 업체 대화 화면이 쓰는 묶음. 서버에 남은 내 찾기(진단 뷰 여러 개)를 읽어
 * "거래"(배출 기업 한 곳과 처리 업체 한 곳이 두 AI로 주고받은 대화 하나)와 "확인할 것"(사람이 해야 할 일)으로 바꾼다.
 * 화면은 이 결과만 그린다. 순수 함수만 둔다(tests/overview.test.ts). 네트워크도 React도 부르지 않는다.
 *
 * 숫자는 새로 계산하지 않는다. 결과(assignments)의 근거 붙은 값(claim)을 그대로 넘기고, 화면은 ClaimValue로 그린다.
 */
import { josa } from "../josa.ts";
import { formatClaim } from "./format.ts";
import { DOC_LABEL } from "./labels.ts";
import type { Approval, Assignment, Claim, DiagnosisView, Thread, ThreadMessage, ViewDocument } from "./types.ts";

export type Side = "emitter" | "vendor";

/** 거래 하나의 단계. 화면 왼쪽 점 색과 낱말을 정한다 */
export type DealStage = "talking" | "agreed" | "confirmed" | "handoff" | "declined";

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  talking: "조건 문의 중",
  agreed: "승인 기다림",
  confirmed: "확정",
  handoff: "담당자가 이어받음",
  declined: "거절",
};

/** 품목 하나의 조건(이 거래로 가는 폐기물) */
export type DealItem = {
  streamId: string;
  name: string;
  /** 한 달 발생량(kg). 값이 없으면 null */
  monthlyKg: number | null;
  /** 지금 처리(혼합 소각 등). 무엇이 나아지는지 "소각 → 재활용"으로 보인다 */
  now: string | null;
  /** 처리 방식(재활용, 열분해 등) */
  process: string | null;
  unitPrice: Claim | null;
  /** 지금 처리 대비 한 달 차이(+면 나아짐) */
  difference: Claim | null;
  /** 이 업체와 실제로 오가는 한 달 금액(+ 받음, − 냄) */
  monthlyAfter: Claim | null;
  /** 지금 처리의 한 달 금액(보통 − 냄) */
  monthlyNow: Claim | null;
  status: string;
};

export type Deal = {
  /** 찾기와 대화로 만든 열쇠(주소 ?deal=에 쓴다) */
  key: string;
  sessionId: string;
  threadId: string;
  emitterOrgId: string;
  vendorOrgId: string | null;
  vendorName: string;
  stage: DealStage;
  outcomeText: string | null;
  items: DealItem[];
  approval: {
    emitter: boolean;
    vendor: boolean;
    blocked: boolean;
    blockedReason: string | null;
    /** 계약 검토 담당이 사람에게 확인하라고 남긴 항목 수 */
    checks: number;
    checkTitles: string[];
    /** 허가증 원문 대조가 끝나지 않아 배출 기업이 승인할 수 없음 */
    permitHold: boolean;
  } | null;
  documents: ViewDocument[];
  messageCount: number;
  /** 업체가 반입 검수 결과를 한 건이라도 적었는지 */
  inspected: boolean;
  last: { side: Side | "reviewer"; text: string; at: string | null; type: string } | null;
  updatedAt: string | null;
};

export type TaskKind = "approve" | "permit" | "check" | "answer" | "blocked" | "document" | "outcome";

export type Task = {
  id: string;
  kind: TaskKind;
  /** 앞에 붙는 짧은 낱말(승인, 허가증 대조 …) */
  tag: string;
  title: string;
  detail: string;
  sessionId: string;
  dealKey: string | null;
  /** 어느 화면에서 하는지 */
  target: "approval" | "find" | "deals";
  /** 작을수록 위 */
  rank: number;
  /** 계약 검토 담당이 사람에게 확인하라고 남긴 것(AI 판단 확인). 같은 거래의 승인·허가증 줄에 붙인다 */
  checks?: { count: number; titles: string[] };
};

export const TASK_TAG: Record<TaskKind, string> = {
  approve: "승인",
  permit: "허가증 대조",
  check: "AI 판단 확인",
  answer: "답변",
  blocked: "막힘",
  document: "서류",
  outcome: "검수 기록",
};

const RANK: Record<TaskKind, number> = { blocked: 0, answer: 1, permit: 2, approve: 3, check: 4, outcome: 5, document: 6 };

/** {{claimId}} 자리를 값으로 바꾼 글. 값을 모르면 "확인 필요" */
export function plainText(message: Pick<ThreadMessage, "text" | "claims">): string {
  const byId = new Map(message.claims.map((claim) => [claim.id, claim]));
  return message.text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_, id: string) => {
    const claim = byId.get(id);
    // 처리비는 음수로 오지만 문장("처리비는 …")이 이미 낱말을 쓰므로 크기만 적는다
    const fee = claim?.role === "treatmentFee" || (claim?.unit === "원/kg" && typeof claim.value === "number" && claim.value < 0);
    if (claim && fee && typeof claim.value === "number") return formatClaim({ ...claim, value: Math.abs(claim.value) }) ?? "확인 필요";
    return formatClaim(claim) ?? "확인 필요";
  });
}

/** 미리보기 한 줄: 인사말·빈 줄을 건너뛰고 첫 내용 줄 */
export function snippet(text: string, max = 80): string {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^[\s\-·•]+/, "").trim())
    .filter(Boolean);
  const body = lines.find((line) => !/담당자께|문의드립니다|검토했습니다|다음 폐기물은/.test(line)) ?? lines[0] ?? "";
  return body.length > max ? `${body.slice(0, max - 1)}…` : body;
}

function stageOf(thread: Thread): DealStage | null {
  switch (thread.status) {
    case "open":
      return "talking";
    case "agreed":
      return "agreed";
    case "confirmed":
      return "confirmed";
    case "handoff":
      return "handoff";
    case "declined":
      return "declined";
    default:
      return null;
  }
}

function sideOf(message: ThreadMessage): Side {
  if (message.author?.side === "vendor") return "vendor";
  if (message.author?.side === "company") return "emitter";
  return message.from === "vendor_agent" ? "vendor" : "emitter";
}

function latestAt(values: (string | null | undefined)[]): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

/** 진단 뷰 하나에서 열린 대화를 거래로 바꾼다. 묻지 않은 업체(not_opened)는 넣지 않는다 */
export function dealsOf(view: DiagnosisView): Deal[] {
  const streams = new Map(view.streams.map((stream) => [stream.id, stream]));
  const assignments = view.result?.assignments ?? [];
  const reviewAt = new Map<string, string>();
  for (const event of view.events) {
    if (event.kind === "review" && event.threadId && event.at) reviewAt.set(event.threadId, event.at);
  }
  const out: Deal[] = [];
  for (const thread of view.threads) {
    const stage = stageOf(thread);
    if (!stage || thread.messages.length === 0) continue;
    const mine = assignments.filter((item: Assignment) => item.threadId === thread.id);
    // 아직 배정이 없는 대화(문의 중)는 문의한 폐기물을 보인다. 빈 배열도 "없음"으로 본다
    const assigned = thread.assignedStreamIds ?? [];
    const ids = mine.length > 0 ? mine.map((item) => item.streamId) : assigned.length > 0 ? assigned : thread.streamIds;
    const items: DealItem[] = ids.map((streamId) => {
      const stream = streams.get(streamId);
      const assignment = mine.find((item) => item.streamId === streamId) ?? null;
      const kg = stream?.monthlyKg?.value;
      return {
        streamId,
        name: stream?.name ?? streamId,
        monthlyKg: typeof kg === "number" ? kg : null,
        now: stream?.currentTreatment?.method ?? null,
        process: assignment?.process ?? null,
        unitPrice: assignment?.unitPrice ?? null,
        difference: assignment?.difference ?? null,
        monthlyAfter: assignment?.monthlyAfter ?? null,
        monthlyNow: assignment?.monthlyNow ?? null,
        status: assignment?.status ?? "needs_information",
      };
    });
    const approval: Approval | undefined = view.approvals.find((item) => item.threadId === thread.id);
    const urgent = approval?.review?.items.filter((item) => item.status !== "ok") ?? [];
    const lastMessage = thread.messages[thread.messages.length - 1];
    const docs = view.documents.filter((doc) => doc.threadId === thread.id);
    out.push({
      key: `${view.session.id}:${thread.id}`,
      sessionId: view.session.id,
      threadId: thread.id,
      emitterOrgId: thread.emitterOrgId,
      vendorOrgId: thread.vendorOrgId,
      vendorName: thread.vendorName,
      stage,
      outcomeText: thread.outcomeText ?? null,
      items,
      approval: approval
        ? {
            emitter: approval.emitter,
            vendor: approval.vendor,
            blocked: approval.blocked,
            blockedReason: approval.blockedReason,
            checks: urgent.length,
            checkTitles: urgent.map((item) => item.title),
            permitHold: Boolean(approval.permitHold) && !(approval.emitter && approval.vendor),
          }
        : null,
      documents: docs,
      messageCount: thread.messages.length,
      inspected: view.feedback.outcomes.some((outcome) => outcome.threadId === thread.id),
      last: lastMessage
        ? { side: sideOf(lastMessage), text: snippet(plainText(lastMessage)), at: lastMessage.createdAt ?? null, type: lastMessage.type }
        : null,
      updatedAt: latestAt([
        ...thread.messages.map((message) => message.createdAt),
        reviewAt.get(thread.id),
        ...docs.map((doc) => doc.createdAt),
      ]),
    });
  }
  return out;
}

/** 여러 찾기의 거래를 모은다. 같은 업체와의 거래가 여러 찾기에 있으면 모두 두되, 최근 것이 앞에 온다 */
export function collectDeals(views: DiagnosisView[]): Deal[] {
  const order: Record<DealStage, number> = { agreed: 0, talking: 1, handoff: 2, confirmed: 3, declined: 4 };
  return views.flatMap(dealsOf).sort((a, b) => order[a.stage] - order[b.stage] || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/** 사람이 해야 할 일. 내가 누구냐(배출 기업·처리 업체)에 따라 다르다 */
export function tasksOf(views: DiagnosisView[], side: Side, nameOf: (orgId: string) => string = () => "배출 기업"): Task[] {
  const tasks: Task[] = [];
  for (const view of views) {
    const deals = dealsOf(view);
    const open = view.questions.filter((question) => !question.answered);
    if (side === "emitter" && open.length > 0) {
      const names = [
        ...new Set(open.map((question) => view.streams.find((stream) => stream.id === question.streamId)?.name).filter(Boolean)),
      ];
      tasks.push({
        id: `${view.session.id}:answer`,
        kind: "answer",
        tag: TASK_TAG.answer,
        title: `AI가 물어본 것 ${open.length}개`,
        detail:
          names.length > 0
            ? `${names.join(", ")}에 대한 질문입니다. 모르면 모름으로 답해도 됩니다.`
            : "답하면 AI가 이어서 업체에 묻습니다.",
        sessionId: view.session.id,
        dealKey: null,
        target: "find",
        rank: RANK.answer,
      });
    }
    for (const deal of deals) {
      const what = deal.items.map((item) => item.name).join(", ");
      const counterpart = side === "emitter" ? deal.vendorName : nameOf(deal.emitterOrgId);
      const a = deal.approval;
      if (a && deal.stage === "agreed") {
        if (a.blocked) {
          tasks.push({
            id: `${deal.key}:blocked`,
            kind: "blocked",
            tag: TASK_TAG.blocked,
            title: `${counterpart} · ${what}`,
            detail: a.blockedReason ?? "합의한 뒤 조건이 바뀌어 승인할 수 없습니다. 다시 찾아야 합니다.",
            sessionId: deal.sessionId,
            dealKey: deal.key,
            target: "approval",
            rank: RANK.blocked,
          });
          continue;
        }
        if (side === "emitter" && a.permitHold) {
          tasks.push({
            id: `${deal.key}:permit`,
            kind: "permit",
            tag: TASK_TAG.permit,
            title: `${deal.vendorName} 허가증 확인`,
            detail: `${josa(what, "을/를")} 받을 수 있는 허가인지 원문에서 품목과 처리 방법을 대조해야 승인할 수 있습니다.`,
            sessionId: deal.sessionId,
            dealKey: deal.key,
            target: "find",
            rank: RANK.permit,
            checks: a.checks > 0 ? { count: a.checks, titles: a.checkTitles } : undefined,
          });
        }
        const mine = side === "emitter" ? a.emitter : a.vendor;
        if (!mine && !(side === "emitter" && a.permitHold)) {
          const other = side === "emitter" ? a.vendor : a.emitter;
          tasks.push({
            id: `${deal.key}:approve`,
            kind: "approve",
            tag: TASK_TAG.approve,
            title: `${counterpart} · ${what}`,
            detail: other
              ? "상대는 승인했습니다. 내가 승인하면 확정되고 서류가 만들어집니다."
              : "두 AI가 조건을 맞췄습니다. 양쪽이 승인하면 확정됩니다.",
            sessionId: deal.sessionId,
            dealKey: deal.key,
            target: "approval",
            rank: RANK.approve,
            checks: a.checks > 0 ? { count: a.checks, titles: a.checkTitles } : undefined,
          });
        }
        // 승인·허가증 줄이 없을 때만 AI 판단 확인을 따로 둔다(한 거래에 한 줄)
        const listed = tasks.some((task) => task.dealKey === deal.key);
        if (a.checks > 0 && !mine && !listed) {
          tasks.push({
            id: `${deal.key}:check`,
            kind: "check",
            tag: TASK_TAG.check,
            title: `${counterpart} · 확인할 것 ${a.checks}개`,
            detail: a.checkTitles.join(" · "),
            sessionId: deal.sessionId,
            dealKey: deal.key,
            target: "approval",
            rank: RANK.check,
          });
        }
      }
      if (deal.stage === "confirmed") {
        if (side === "vendor") {
          const recorded = view.feedback.outcomes.some((outcome) => outcome.threadId === deal.threadId);
          if (!recorded) {
            tasks.push({
              id: `${deal.key}:outcome`,
              kind: "outcome",
              tag: TASK_TAG.outcome,
              title: `${what} 검수 결과 적기`,
              detail: "실제 무게·등급·단가를 적으면 배출 기업의 실적과 다음 판단에 쓰입니다.",
              sessionId: deal.sessionId,
              dealKey: deal.key,
              target: "approval",
              rank: RANK.outcome,
            });
          }
        }
      }
    }
  }
  return tasks.sort((a, b) => a.rank - b.rank);
}

/** 맨 위 숫자 칸. 값이 없으면 null(화면은 "—") */
export type Headline = {
  /** 지금 대비 한 달 차이 합계(배출 기업만) */
  difference: Claim | null;
  /** 운반비가 정해지지 않아 잠정인 품목이 있는지 */
  provisional: boolean;
  /** 재활용·열분해 등 처리 업체로 가는 한 달 물량(kg) */
  recycledKg: number;
  dealCount: number;
  agreedCount: number;
  confirmedCount: number;
};

export function headlineOf(views: DiagnosisView[], deals: Deal[]): Headline {
  const latest = views[0] ?? null;
  const totals = latest?.result?.totals ?? null;
  const recycledKg = deals
    .filter((deal) => deal.sessionId === latest?.session.id && deal.stage !== "declined")
    .flatMap((deal) => deal.items)
    .reduce((sum, item) => sum + (item.monthlyKg ?? 0), 0);
  return {
    difference: totals?.difference ?? null,
    provisional: (latest?.result?.transportPending?.length ?? 0) > 0,
    recycledKg,
    dealCount: deals.length,
    agreedCount: deals.filter((deal) => deal.stage === "agreed").length,
    confirmedCount: deals.filter((deal) => deal.stage === "confirmed").length,
  };
}

export type Activity = { id: string; at: string | null; who: string; text: string; dealKey: string | null };

const WHO: Record<string, string> = { company_agent: "회사 측 AI", vendor_agent: "업체 측 AI", contract_reviewer: "계약 검토 담당" };

/** 최근 바뀐 것(말풍선, 계약 검토, 서류). 최근 것이 먼저 */
export function activityOf(views: DiagnosisView[], limit = 6): Activity[] {
  const out: Activity[] = [];
  for (const view of views) {
    const nameOf = (threadId: string | null | undefined) => view.threads.find((item) => item.id === threadId)?.vendorName ?? "";
    for (const thread of view.threads) {
      for (const message of [...thread.messages].reverse()) {
        out.push({
          id: `${view.session.id}:${message.id}`,
          at: message.createdAt ?? null,
          who: `${WHO[message.from] ?? message.author?.label ?? "AI"} · ${thread.vendorName}`,
          text: snippet(plainText(message), 64),
          dealKey: `${view.session.id}:${thread.id}`,
        });
      }
    }
    for (const event of view.events) {
      if (event.kind !== "review") continue;
      out.push({
        id: `${view.session.id}:ev${event.seq}`,
        at: event.at ?? null,
        who: `${WHO.contract_reviewer} · ${nameOf(event.threadId)}`,
        text: snippet(event.summary, 64),
        dealKey: event.threadId ? `${view.session.id}:${event.threadId}` : null,
      });
    }
    for (const doc of view.documents) {
      out.push({
        id: `${view.session.id}:${doc.id}`,
        at: doc.createdAt,
        who: `서류 · ${nameOf(doc.threadId)}`,
        text: `${josa(DOC_LABEL[doc.kind], "이/가")} 만들어졌습니다`,
        dealKey: `${view.session.id}:${doc.threadId}`,
      });
    }
  }
  // 한 거래가 목록을 다 차지하지 않게 거래마다 최근 두 개까지만 둔다
  const perDeal = new Map<string, number>();
  return out
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .filter((item) => {
      const key = item.dealKey ?? item.id;
      const seen = perDeal.get(key) ?? 0;
      perDeal.set(key, seen + 1);
      return seen < 2;
    })
    .slice(0, limit);
}

export type DocItem = { doc: ViewDocument; dealKey: string; sessionId: string; vendorName: string; emitterOrgId: string };

/** 확정한 거래에서 만들어진 서류(요청서, 이행 계획서, 계약서 초안). 최근 것이 먼저 */
export function documentsOf(deals: Deal[], limit = 6): DocItem[] {
  return deals
    .flatMap((deal) =>
      deal.documents.map((doc) => ({
        doc,
        dealKey: deal.key,
        sessionId: deal.sessionId,
        vendorName: deal.vendorName,
        emitterOrgId: deal.emitterOrgId,
      })),
    )
    .sort((a, b) => b.doc.createdAt.localeCompare(a.doc.createdAt))
    .slice(0, limit);
}

/** 거래가 지나는 다섯 단계. 화면마다 같은 막대로 보인다 */
export const DEAL_STEPS = ["문의", "합의", "승인", "확정", "검수"] as const;

export type DealProgress = {
  /** 끝난 단계 수(0~5). 지금 진행 중인 단계의 자리이기도 하다 */
  done: number;
  /** 지금 단계 이름. 다 끝났으면 null */
  current: (typeof DEAL_STEPS)[number] | null;
  /** 거절되었거나 담당자에게 넘어가 막대가 멈춘 까닭 */
  stopped: string | null;
};

/** 거래가 다섯 단계 가운데 어디까지 왔는지. 문의(두 AI가 조건을 묻는 중) → 합의 → 승인(양쪽) → 확정(서류) → 검수(업체 기록) */
export function progressOf(deal: Pick<Deal, "stage" | "inspected">): DealProgress {
  if (deal.stage === "declined" || deal.stage === "handoff") {
    return { done: 1, current: null, stopped: DEAL_STAGE_LABEL[deal.stage] };
  }
  const done = deal.stage === "talking" ? 0 : deal.stage === "agreed" ? 2 : deal.inspected ? 5 : 4;
  const steps: readonly (typeof DEAL_STEPS)[number][] = DEAL_STEPS;
  return { done, current: steps[done] ?? null, stopped: null };
}
