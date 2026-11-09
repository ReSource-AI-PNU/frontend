"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { WASTE_ITEMS } from "@/lib/domain";
import type { Detection, FlowStep, Media, Route, Session } from "@/lib/session/types";
import { FLOW_STEPS } from "@/lib/session/types";
import { getCompanies } from "./companies";
import { ensureLearningSeeds, models } from "./mock/learning";
import { ensureOwnerMember, findMemberForUser } from "./mock/members";
import { newId, nowIso, UPLOAD_DIR } from "./mock/db";
import {
  buildClassify,
  buildCostCarbon,
  buildFeasibility,
  buildMatching,
  buildProposal,
  buildRegulation,
} from "./mock/pipeline";
import { requireOrganization } from "./organization";
import { getCurrentUser } from "./session";
import {
  addLabelTask,
  ensureSeeds,
  getSessionForCurrentOrg,
  knowledgeCards,
  outbox,
  saveSession,
  sessions,
} from "./sessions";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = /^(image\/(jpeg|png|webp|heic)|video\/(mp4|quicktime)|application\/pdf)$/;

/** 업로드 → 세션 생성 → 분석 화면. sample=1이면 시연용 사진으로 시작한다. */
export async function startSession(formData: FormData) {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  await ensureSeeds();

  const media: Media[] = [];
  if (formData.get("sample") === "1") {
    media.push({ id: "sample", kind: "sample", name: "녹산_PP베일_시연.jpg", url: "sample" });
  } else {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) redirect("/upload?error=empty");
    await mkdir(UPLOAD_DIR, { recursive: true });
    for (const file of files.slice(0, 10)) {
      if (file.size > MAX_BYTES || !ACCEPT.test(file.type)) redirect("/upload?error=type");
      const id = newId("up");
      await writeFile(path.join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()));
      await writeFile(path.join(UPLOAD_DIR, `${id}.json`), JSON.stringify({ type: file.type, name: file.name, orgId: org.id }));
      const kind = file.type.startsWith("video") ? "video" : file.type === "application/pdf" ? "pdf" : "image";
      media.push({ id, kind, name: file.name, url: `/api/uploads/${id}`, size: file.size });
    }
  }

  const { classify, questions } = buildClassify(org);
  // 학습 콘솔에서 배포한 운영 모델로 판정한 것으로 기록한다
  await ensureLearningSeeds();
  const production = await models.find((m) => m.status === "production");
  if (production) classify.model = { name: production.name, version: production.version };
  const now = nowIso();
  const session: Session = {
    id: newId("ses"),
    orgId: org.id,
    ownerId: user.id,
    complexId: org.complexId,
    title: `${classify.item} · ${classify.detail}`,
    createdAt: now,
    updatedAt: now,
    status: "analyzing",
    step: "classify",
    media,
    questions,
    classify,
    corrections: [],
  };
  await sessions.insert(session);
  redirect(`/session/${session.id}/analyzing`);
}

/** 분석 진행 화면이 끝나면 호출한다. */
export async function finishAnalyzing(sessionId: string) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) => ({ ...s, status: s.status === "analyzing" ? "in-progress" : s.status }));
  redirect(`/session/${sessionId}/classify`);
}

export async function answerQuestion(sessionId: string, questionId: string, formData: FormData) {
  await getSessionForCurrentOrg(sessionId);
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return;
  await saveSession(sessionId, (s) => ({
    ...s,
    questions: s.questions.map((q) => (q.id === questionId ? { ...q, answer } : q)),
    // 답이 바뀌면 그 뒤 단계 결과를 다시 계산하도록 비운다
    ...(questionId === "analysis" ? { regulation: undefined, proposal: undefined } : {}),
    ...(questionId === "volume" || questionId === "storage"
      ? { feasibility: undefined, matching: undefined, costCarbon: undefined, proposal: undefined }
      : {}),
  }));
  revalidatePath(`/session/${sessionId}`, "layout");
}

const boxSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]);
const detectionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(40),
  kind: z.enum(["item", "contaminant"]),
  confidence: z.number(),
  box: boxSchema,
  source: z.enum(["ai", "human"]),
  ratio: z.number().min(0).max(1).optional(),
  removed: z.boolean().optional(),
  original: z.object({ label: z.string(), box: boxSchema, ratio: z.number().optional() }).optional(),
});

/**
 * 식별 결과 수정 저장. 바뀐 항목마다 수정 기록(Correction)과 라벨 검수 작업(LabelTask)을 만든다.
 * 이유를 적었으면 현장 지식 카드(제안됨)로도 남긴다.
 */
export async function saveDetections(
  sessionId: string,
  input: { detections: unknown; rationale?: string; condition?: string; judgment?: string; makeCard?: boolean },
) {
  const { session, org } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  const detections = z.array(detectionSchema).parse(input.detections) as Detection[];
  const before = new Map(session.classify.detections.map((d) => [d.id, d]));
  const corrections: Session["corrections"] = [];

  let cardId: string | undefined;
  if (input.makeCard && input.condition && input.judgment) {
    cardId = newId("kc");
    await knowledgeCards.insert({
      id: cardId,
      item: session.classify.item,
      condition: input.condition.slice(0, 120),
      judgment: input.judgment.slice(0, 120),
      rationale: (input.rationale ?? "").slice(0, 400),
      step: "classify",
      author: user.name,
      orgName: org.name,
      createdAt: nowIso(),
      status: "proposed",
      agrees: [],
      sourceSessionId: sessionId,
      citedCount: 0,
    });
  }

  const describe = (d: Detection) =>
    `${d.label}${d.ratio !== undefined ? ` ${Math.round(d.ratio * 100)}%` : ""} · ${d.box.map((n) => n.toFixed(2)).join(", ")}`;

  for (const d of detections) {
    const prev = before.get(d.id);
    const changed = !prev || prev.label !== d.label || prev.ratio !== d.ratio || prev.removed !== d.removed || prev.box.some((n, i) => Math.abs(n - d.box[i]) > 0.005);
    if (!changed) continue;
    const field = !prev ? "추가" : d.removed ? "삭제" : prev.label !== d.label ? "라벨" : prev.ratio !== d.ratio ? "비율" : "위치";
    corrections.push({
      id: newId("cor"),
      at: nowIso(),
      by: user.name,
      step: "classify",
      field: `${d.label} ${field}`,
      before: prev ? describe(prev) : "없음",
      after: d.removed ? "삭제" : describe(d),
      rationale: input.rationale,
      knowledgeCardId: cardId,
    });
    await addLabelTask({
      sessionId,
      kind: field === "비율" ? "ratio" : field === "라벨" ? "grade" : "box",
      title: `${d.label} ${field} 수정`,
      before: prev ? describe(prev) : "없음",
      after: d.removed ? "삭제" : describe(d),
      source: "현장 수정",
    });
  }

  await saveSession(sessionId, (s) => ({
    ...s,
    classify: { ...s.classify, detections },
    corrections: [...s.corrections, ...corrections],
    feasibility: undefined,
    costCarbon: undefined,
    proposal: undefined,
  }));
  revalidatePath(`/session/${sessionId}`, "layout");
  return { saved: corrections.length, cardId };
}

/** 지정한 단계까지 필요한 결과를 차례로 계산하고 그 화면으로 보낸다. */
export async function goToStep(sessionId: string, to: FlowStep) {
  const { session: initial, org } = await getSessionForCurrentOrg(sessionId);
  await ensureSeeds();
  const target = FLOW_STEPS.findIndex((s) => s.slug === to);
  let s: Session = { ...initial };
  const cards = await knowledgeCards.all();
  if (target >= 1 && !s.feasibility) {
    s = { ...s, feasibility: buildFeasibility(s, cards) };
    // 근거로 인용된 현장 지식 카드의 인용 수를 올린다
    for (const r of s.feasibility?.reasons ?? []) {
      if (r.knowledgeCardId) await knowledgeCards.update(r.knowledgeCardId, (c) => ({ ...c, citedCount: c.citedCount + 1 }));
    }
  }
  if (target >= 2 && !s.regulation) s = { ...s, regulation: buildRegulation(s) };
  if (target >= 3 && !s.matching) s = { ...s, matching: buildMatching(s, org, await getCompanies(s.complexId)) };
  if (target >= 4 && !s.costCarbon) s = { ...s, costCarbon: buildCostCarbon(s) };
  if (target >= 5 && !s.proposal) s = { ...s, proposal: buildProposal(s, org) };
  if (target >= 5 && !s.selectedRoute) s = { ...s, selectedRoute: s.proposal?.recommended };
  const final = s;
  await saveSession(sessionId, () => ({
    ...final,
    step: to,
    status: final.status === "analyzing" ? "in-progress" : final.status === "in-progress" && to === "proposal" ? "awaiting-approval" : final.status,
  }));
  revalidatePath(`/session/${sessionId}`, "layout");
  redirect(`/session/${sessionId}/${to}`);
}

export async function selectRoute(sessionId: string, routeId: Route["id"]) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) => ({ ...s, selectedRoute: routeId }));
  revalidatePath(`/session/${sessionId}`, "layout");
}

/** 사람 승인 게이트. 승인해야만 외부(모의 메일함)로 나간다. */
export async function approveAndSend(sessionId: string, formData: FormData) {
  const { session, org } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  // 외부 발송 승인은 승인권자 이상만 할 수 있다 (설정 > 멤버의 역할 권한 표)
  await ensureOwnerMember(org, user);
  const member = await findMemberForUser(org.id, user.id);
  if (member?.role === "담당자") return { error: "견적 발송 승인은 승인권자 이상만 할 수 있습니다. 승인권자에게 요청해 주세요." };
  if (formData.get("confirm") !== "on") return { error: "발송 내용을 확인했다는 항목에 체크해 주세요." };
  if (session.approval) return { error: "이미 발송한 세션입니다." };
  const routeId = (session.selectedRoute ?? session.proposal?.recommended ?? "A") as Route["id"];
  const m = session.matching;
  const sentTo: { name: string; kind: string }[] = [];
  if (m?.collector.companyId) {
    await outbox.insert({
      id: newId("ob"),
      sessionId,
      orgId: org.id,
      fromOrg: org.name,
      toCompanyId: m.collector.companyId,
      toName: m.collector.name,
      kind: "quote",
      subject: `[견적 요청] ${session.classify.detail} 월 ${m.totalKg.toLocaleString("ko-KR")}kg 묶음 수거`,
      sentAt: nowIso(),
      status: "sent",
    });
    sentTo.push({ name: m.collector.name, kind: "견적 요청서" });
  }
  if (routeId === "A" && m) {
    for (const g of m.group.filter((x) => !x.isSelf)) {
      await outbox.insert({
        id: newId("ob"),
        sessionId,
        orgId: org.id,
        fromOrg: org.name,
        toCompanyId: g.companyId,
        toName: g.name,
        kind: "bundle-invite",
        subject: `[묶음 수거 제안] ${session.classify.item} 공동 수거 참여 요청`,
        sentAt: nowIso(),
        status: "sent",
      });
      sentTo.push({ name: g.name, kind: "묶음 참여 제안" });
    }
  }
  await saveSession(sessionId, (s) => ({
    ...s,
    status: "sent",
    approval: { approvedBy: user.name, approvedAt: nowIso(), routeId, sentTo },
  }));
  revalidatePath(`/session/${sessionId}`, "layout");
  return { ok: true as const };
}

const outcomeSchema = z.object({
  accepted: z.enum(["yes", "no"]),
  actualGrade: z.string().trim().min(1, "등급을 입력해 주세요.").max(20),
  actualPerKg: z.coerce.number().int().min(-5000).max(5000),
  actualKg: z.coerce.number().int().min(1, "실제 수거량을 입력해 주세요.").max(1_000_000),
  reason: z.string().trim().max(200).optional(),
});

/** 수거 후 실제 결과. 업체 화면과 담당자 화면에서 모두 기록할 수 있다. 가장 강한 학습 신호가 된다. */
export async function recordOutcome(sessionId: string, recorderRole: "처리업체" | "담당자", _prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  const session = await sessions.get(sessionId);
  if (!session) return { error: "세션을 찾을 수 없습니다." };
  const parsed = outcomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const o = parsed.data;
  await saveSession(sessionId, (s) => ({
    ...s,
    status: "completed",
    outcome: {
      recordedAt: nowIso(),
      recordedBy: user.name,
      recorderRole,
      accepted: o.accepted === "yes",
      actualGrade: o.actualGrade,
      actualPerKg: o.actualPerKg,
      actualKg: o.actualKg,
      reason: o.reason,
    },
  }));
  await addLabelTask({
    sessionId,
    kind: "outcome",
    title: o.accepted === "yes" ? "실제 매입 결과" : "매입 거절",
    before: `예상 ${session.feasibility ? `${session.feasibility.afterPerKg > 0 ? "+" : ""}${session.feasibility.afterPerKg}원/kg` : "-"}`,
    after: o.accepted === "yes" ? `실제 ${o.actualPerKg > 0 ? "+" : ""}${o.actualPerKg}원/kg · ${o.actualGrade}` : `거절 · ${o.reason ?? o.actualGrade}`,
    source: "업체 실제 결과",
  });
  await outbox.update(
    (await outbox.find((m) => m.sessionId === sessionId && m.kind === "quote"))?.id ?? "",
    (m) => ({ ...m, status: "completed" }),
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const cardSchema = z.object({
  item: z.enum(WASTE_ITEMS),
  condition: z.string().trim().min(4, "조건을 4자 이상 적어 주세요.").max(120),
  judgment: z.string().trim().min(4, "판단을 4자 이상 적어 주세요.").max(120),
  rationale: z.string().trim().min(4, "근거를 4자 이상 적어 주세요.").max(400),
  step: z.enum(["classify", "feasibility", "regulation", "matching", "cost-carbon", "proposal"]),
  sessionId: z.string().optional(),
});

export async function createKnowledgeCard(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const c = parsed.data;
  await knowledgeCards.insert({
    id: newId("kc"),
    item: c.item,
    condition: c.condition,
    judgment: c.judgment,
    rationale: c.rationale,
    step: c.step,
    author: user.name,
    orgName: org.name,
    createdAt: nowIso(),
    status: "proposed",
    agrees: [],
    sourceSessionId: c.sessionId || undefined,
    citedCount: 0,
  });
  revalidatePath("/knowledge");
  return { ok: true as const };
}

export async function toggleAgree(cardId: string) {
  const user = await getCurrentUser();
  await knowledgeCards.update(cardId, (c) => ({
    ...c,
    agrees: c.agrees.includes(user.id) ? c.agrees.filter((a) => a !== user.id) : [...c.agrees, user.id],
  }));
  revalidatePath("/knowledge");
}

export async function setKnowledgeStatus(cardId: string, status: "reviewing" | "adopted" | "rejected") {
  await getCurrentUser();
  await knowledgeCards.update(cardId, (c) => ({ ...c, status }));
  revalidatePath("/knowledge");
  revalidatePath("/admin/learning");
}
