"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { WASTE_ITEMS } from "@/lib/domain";
import { formatSigned } from "@/lib/format";
import { josa } from "@/lib/josa";
import type { Detection, FlowStep, Media, Route, Session, Stream, StreamOrigin, StreamRoute } from "@/lib/session/types";
import { FLOW_STEPS, STREAM_ROUTE_LABEL } from "@/lib/session/types";
import { getCompanies } from "./companies";
import { ensureLearningSeeds, models } from "./mock/learning";
import { ensureOwnerMember, findMemberForUser } from "./mock/members";
import { newId, nowIso, UPLOAD_DIR } from "./mock/db";
import { negotiate, termsText, WEEKDAYS } from "./mock/negotiation";
import { appendRun, classifyEvents, human, reply, startEvents, STEP_OF_WORD, stepEvents } from "./mock/run-log";
import {
  buildCostCarbon,
  buildFeasibility,
  buildMatching,
  buildProposal,
  buildRegulation,
  buildStream,
  initialQuestions,
  profileFor,
  routeOverrides,
  SAMPLE_FACTORY,
  sampleMedia,
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
const MAX_STREAMS = 8;

/** 흐름 데이터가 바뀌면 그 뒤 단계 결과를 다시 계산하도록 비운다 */
const CLEAR_FROM_FEASIBILITY = { feasibility: undefined, regulation: undefined, matching: undefined, costCarbon: undefined, proposal: undefined, selectedRoute: undefined };
const CLEAR_FROM_MATCHING = { regulation: undefined, matching: undefined, costCarbon: undefined, proposal: undefined, selectedRoute: undefined };

function mapStream(s: Session, streamId: string, fn: (x: Stream) => Stream): Stream[] {
  return s.streams.map((x) => (x.id === streamId ? fn(x) : x));
}

/**
 * 업로드 → 진단 세션 생성 → 분석 화면.
 * sample=1이면 시연용 사출 공장의 네 흐름으로 시작한다. 아니면 stream-<i>-name, stream-<i>-files로 흐름을 받는다.
 */
export async function startSession(formData: FormData) {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  await ensureSeeds();
  await ensureLearningSeeds();
  const production = await models.find((m) => m.status === "production");
  const modelVersion = production?.version ?? "v3.2";
  const fallbackItem = org.wasteStreams[0]?.item ?? "폐플라스틱";

  const streams: Stream[] = [];
  if (formData.get("sample") === "1") {
    for (const p of SAMPLE_FACTORY) {
      streams.push(buildStream(newId("st"), p, { media: sampleMedia(p), modelVersion }));
    }
  } else {
    const count = Math.min(Number(formData.get("stream-count") ?? 0) || 0, MAX_STREAMS);
    await mkdir(UPLOAD_DIR, { recursive: true });
    for (let i = 0; i < count; i++) {
      const name = String(formData.get(`stream-${i}-name`) ?? "").trim().slice(0, 30);
      const files = formData.getAll(`stream-${i}-files`).filter((f): f is File => f instanceof File && f.size > 0);
      if (!name && files.length === 0) continue;
      if (!name) redirect("/upload?error=name");
      if (files.length === 0) redirect("/upload?error=empty");
      const media: Media[] = [];
      for (const file of files.slice(0, 6)) {
        if (file.size > MAX_BYTES || !ACCEPT.test(file.type)) redirect("/upload?error=type");
        const id = newId("up");
        await writeFile(path.join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()));
        await writeFile(path.join(UPLOAD_DIR, `${id}.json`), JSON.stringify({ type: file.type, name: file.name, orgId: org.id }));
        const kind = file.type.startsWith("video") ? "video" : file.type === "application/pdf" ? "pdf" : "image";
        media.push({ id, kind, name: file.name, url: `/api/uploads/${id}`, size: file.size });
      }
      streams.push(buildStream(newId("st"), profileFor(name, fallbackItem), { name, media, modelVersion }));
    }
    if (streams.length === 0) redirect("/upload?error=empty");
  }

  const now = nowIso();
  const session: Session = {
    id: newId("ses"),
    orgId: org.id,
    ownerId: user.id,
    complexId: org.complexId,
    title: `${org.name} 폐플라스틱 진단 · ${streams.length}개 흐름`,
    createdAt: now,
    updatedAt: now,
    status: "analyzing",
    step: "classify",
    streams,
    questions: initialQuestions(streams),
    corrections: [],
  };
  await sessions.insert(appendRun(session, startEvents(session)));
  redirect(`/session/${session.id}/analyzing`);
}

/** 분석 진행 화면이 끝나면 호출한다. */
export async function finishAnalyzing(sessionId: string) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) => (s.status === "analyzing" ? appendRun({ ...s, status: "in-progress" }, classifyEvents(s)) : s));
  revalidatePath(`/session/${sessionId}`, "layout");
  redirect(`/session/${sessionId}/classify`);
}

/** 규정 단계의 되묻기(성분분석표, PCR 출처 증빙) */
export async function answerQuestion(sessionId: string, questionId: string, formData: FormData) {
  await getSessionForCurrentOrg(sessionId);
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return;
  await saveSession(sessionId, (s) =>
    appendRun(
      {
        ...s,
        questions: s.questions.map((q) => (q.id === questionId ? { ...q, answer } : q)),
        regulation: undefined,
        proposal: undefined,
      },
      [human(`답변 · ${s.questions.find((q) => q.id === questionId)?.text ?? "되묻기"} → ${answer}`, { agent: "regulation", step: "regulation" })],
    ),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
}

/** 흐름의 월 발생량 확정(사진으로는 부피만 알 수 있어 담당자가 확정한다) */
export async function setStreamVolume(sessionId: string, streamId: string, formData: FormData) {
  const { session } = await getSessionForCurrentOrg(sessionId);
  const kg = Math.round(Number(String(formData.get("kg") ?? "").replace(/[^0-9]/g, "")));
  if (!Number.isFinite(kg) || kg < 1 || kg > 1_000_000) return;
  const before = session.streams.find((x) => x.id === streamId);
  await saveSession(sessionId, (s) =>
    appendRun(
      {
        ...s,
        streams: mapStream(s, streamId, (x) => ({ ...x, monthlyKg: kg, monthlyKgConfirmed: true })),
        ...(before && before.monthlyKg !== kg ? CLEAR_FROM_FEASIBILITY : {}),
      },
      [human(`${before?.name ?? "흐름"} 월 발생량 확정 · ${kg.toLocaleString("ko-KR")}kg`, { agent: "classify", step: "classify", streamId, detail: before && before.monthlyKg !== kg ? `AI 추정 ${before.monthlyKg.toLocaleString("ko-KR")}kg을 고쳤습니다. 경로 판정부터 다시 계산합니다.` : undefined })],
    ),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
}

/** 남은 흐름의 발생량을 AI 추정값 그대로 확정한다 */
export async function confirmAllVolumes(sessionId: string) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) =>
    appendRun({ ...s, streams: s.streams.map((x) => ({ ...x, monthlyKgConfirmed: true })) }, [
      human(`월 발생량을 AI 추정값으로 확정 · 흐름 ${s.streams.filter((x) => !x.monthlyKgConfirmed).length}개`, { agent: "classify", step: "classify" }),
    ]),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
}

/** 출처(PIR/PCR)를 담당자가 바꾼다. 규제상 가치가 달라지므로 수정 기록과 라벨 작업을 남긴다 */
export async function setStreamOrigin(sessionId: string, streamId: string, origin: StreamOrigin) {
  const { session } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  const st = session.streams.find((x) => x.id === streamId);
  if (!st || st.origin === origin) return;
  const label = (o: StreamOrigin) => (o === "PIR" ? "공정 부산물(PIR)" : "사용 후 포장재(PCR)");
  await addLabelTask({ sessionId, kind: "origin", title: `${st.name} 출처 변경`, before: label(st.origin), after: label(origin), source: "현장 수정" });
  await saveSession(sessionId, (s) => ({
    ...s,
    streams: mapStream(s, streamId, (x) => ({ ...x, origin, originSource: "human" })),
    questions: s.questions.some((q) => q.id === `pcr-proof:${streamId}`) || origin !== "PCR"
      ? s.questions
      : [...s.questions, { id: `pcr-proof:${streamId}`, step: "regulation" as const, streamId, text: `${st.name}의 입고 기록(원자재 납품서·포장 사양)이 있나요?`, why: "사용 후(PCR) 재생원료로 팔려면 출처를 증명해야 합니다.", kind: "choice" as const, options: ["있음", "없음"] }],
    corrections: [...s.corrections, { id: newId("cor"), at: nowIso(), by: user.name, step: "classify", streamId, field: `${st.name} 출처`, before: label(st.origin), after: label(origin) }],
    ...CLEAR_FROM_FEASIBILITY,
  }));
  await saveSession(sessionId, (s) =>
    appendRun(s, [human(`${st.name} 출처 변경 · ${label(st.origin)} → ${label(origin)}`, { agent: "classify", step: "classify", streamId, detail: "수정 기록과 라벨 검수 작업을 남겼습니다. 다음 학습에 쓰입니다." })]),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
}

/** 흐름 경로를 담당자가 직접 고른다. AI 추천은 aiRoute로 남는다 */
export async function setStreamRoute(sessionId: string, streamId: string, route: StreamRoute) {
  const { session } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  const st = session.streams.find((x) => x.id === streamId);
  const prev = session.feasibility?.decisions.find((d) => d.streamId === streamId);
  if (!st || !prev || prev.route === route) return;
  const cards = await knowledgeCards.all();
  const overrides = { ...routeOverrides(session), [streamId]: route };
  if ((prev.aiRoute ?? prev.route) === route) delete overrides[streamId];
  const feasibility = buildFeasibility(session, cards, overrides);
  await addLabelTask({ sessionId, kind: "route", title: `${st.name} 경로 변경`, before: STREAM_ROUTE_LABEL[prev.route], after: STREAM_ROUTE_LABEL[route], source: "현장 수정" });
  await saveSession(sessionId, (s) => ({
    ...s,
    feasibility,
    corrections: [...s.corrections, { id: newId("cor"), at: nowIso(), by: user.name, step: "feasibility", streamId, field: `${st.name} 경로`, before: STREAM_ROUTE_LABEL[prev.route], after: STREAM_ROUTE_LABEL[route] }],
    ...CLEAR_FROM_MATCHING,
  }));
  await saveSession(sessionId, (s) =>
    appendRun(s, [
      human(`${st.name} 경로 변경 · ${STREAM_ROUTE_LABEL[prev.route]} → ${STREAM_ROUTE_LABEL[route]}`, { agent: "feasibility", step: "feasibility", streamId, detail: "AI 원래 경로는 남겨 두고, 규정 검토부터 다시 계산합니다." }),
    ]),
  );
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
 * 흐름 하나의 식별 결과 수정 저장. 바뀐 항목마다 수정 기록(Correction)과 라벨 검수 작업(LabelTask)을 만든다.
 * 이유를 적었으면 현장 지식 카드(제안됨)로도 남긴다.
 */
export async function saveDetections(
  sessionId: string,
  streamId: string,
  input: { detections: unknown; rationale?: string; condition?: string; judgment?: string; makeCard?: boolean },
) {
  const { session, org } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  const stream = session.streams.find((x) => x.id === streamId);
  if (!stream) return { saved: 0, cardId: undefined as string | undefined };
  const detections = z.array(detectionSchema).parse(input.detections) as Detection[];
  const before = new Map(stream.classify.detections.map((d) => [d.id, d]));
  const corrections: Session["corrections"] = [];

  let cardId: string | undefined;
  if (input.makeCard && input.condition && input.judgment) {
    cardId = newId("kc");
    await knowledgeCards.insert({
      id: cardId,
      item: stream.classify.item,
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
      streamId,
      field: `${stream.name} · ${d.label} ${field}`,
      before: prev ? describe(prev) : "없음",
      after: d.removed ? "삭제" : describe(d),
      rationale: input.rationale,
      knowledgeCardId: cardId,
    });
    await addLabelTask({
      sessionId,
      kind: field === "비율" ? "ratio" : field === "라벨" ? "grade" : "box",
      title: `${stream.name} · ${d.label} ${field} 수정`,
      before: prev ? describe(prev) : "없음",
      after: d.removed ? "삭제" : describe(d),
      source: "현장 수정",
    });
  }

  await saveSession(sessionId, (s) => ({
    ...s,
    streams: mapStream(s, streamId, (x) => ({ ...x, classify: { ...x.classify, detections } })),
    corrections: [...s.corrections, ...corrections],
    ...CLEAR_FROM_FEASIBILITY,
  }));
  if (corrections.length) {
    await saveSession(sessionId, (s) =>
      appendRun(s, [
        human(`${stream.name} 박스 수정 ${corrections.length}건`, { agent: "classify", step: "classify", streamId, detail: cardId ? "이유를 현장 지식 카드(제안됨)로도 남겼습니다." : "라벨 검수 대기열에 올렸습니다." }),
      ]),
    );
  }
  revalidatePath(`/session/${sessionId}`, "layout");
  return { saved: corrections.length, cardId };
}

/** 지정한 단계까지 필요한 결과를 차례로 계산하고 그 화면으로 보낸다. */
export async function goToStep(sessionId: string, to: FlowStep) {
  await computeTo(sessionId, to);
  redirect(`/session/${sessionId}/${to}`);
}

/** 지정한 단계까지 빠진 결과를 차례로 계산해 저장한다. 새로 계산한 단계는 실행 기록에 남긴다 */
async function computeTo(sessionId: string, to: FlowStep) {
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
  const final = appendRun(s, stepEvents(initial, s));
  await saveSession(sessionId, () => ({
    ...final,
    step: to,
    status: final.status === "analyzing" ? "in-progress" : final.status === "in-progress" && to === "proposal" ? "awaiting-approval" : final.status,
  }));
  revalidatePath(`/session/${sessionId}`, "layout");
}

export async function selectRoute(sessionId: string, routeId: Route["id"]) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) =>
    s.selectedRoute === routeId ? s : appendRun({ ...s, selectedRoute: routeId }, [human(`시나리오 ${routeId} 선택`, { agent: "cost-carbon", step: "cost-carbon" })]),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
}

/**
 * 사람 승인 게이트. 승인해야만 외부(모의 메일함)로 나간다.
 * 순회 수거 요청서 → 수거 업체, 묶음 참여 제안 → 같은 단지 기업, 매각 견적 요청서 → 매입처, 열분해 위탁 요청서 → 열분해 업체.
 * 경로 B·C·D(묶음 없음)를 고르면 순회 수거와 묶음 제안은 보내지 않는다.
 */
export async function approveAndSend(sessionId: string, formData: FormData) {
  const { session, org } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  // 외부 발송 승인은 승인권자 이상만 할 수 있다 (설정 > 멤버의 역할 권한 표)
  await ensureOwnerMember(org, user);
  const member = await findMemberForUser(org.id, user.id);
  if (member?.role === "담당자") return { error: "견적 발송 승인은 승인권자 이상만 할 수 있습니다. 승인권자에게 요청해 주세요." };
  if (formData.get("confirm") !== "on") return { error: "발송 내용을 확인했다는 항목에 체크해 주세요." };
  if (session.approval) return { error: "이미 발송한 진단입니다." };
  const routeId = (session.selectedRoute ?? session.proposal?.recommended ?? "A") as Route["id"];
  const m = session.matching;
  const byStream = new Map(session.streams.map((x) => [x.id, x]));
  const sentTo: { name: string; kind: string }[] = [];
  const send = async (toCompanyId: string, toName: string, kind: "quote" | "bundle-invite" | "pickup", subject: string, label: string, streamId?: string) => {
    if (!toCompanyId) return;
    await outbox.insert({ id: newId("ob"), sessionId, orgId: org.id, fromOrg: org.name, toCompanyId, toName, kind, subject, sentAt: nowIso(), status: "sent", streamId });
    sentTo.push({ name: toName, kind: label });
  };
  if (routeId === "A") {
    for (const b of m?.bundles ?? []) {
      const st = byStream.get(b.streamId);
      await send(b.collector.companyId, b.collector.name, "pickup", `[순회 수거 요청] ${st?.classify.detail} 월 ${b.totalKg.toLocaleString("ko-KR")}kg · ${b.group.length}개 사업장`, "순회 수거 요청서", b.streamId);
      for (const g of b.group.filter((x) => !x.isSelf)) {
        await send(g.companyId, g.name, "bundle-invite", `[묶음 수거 제안] ${st?.name} 순회 수거 참여 요청`, "묶음 참여 제안", b.streamId);
      }
    }
  }
  if (routeId === "A" || routeId === "B") {
    for (const p of m?.partners.filter((x) => x.companyId) ?? []) {
      const st = byStream.get(p.streamId);
      const pyro = p.route === "pyrolysis";
      await send(p.companyId!, p.name, "quote", `[${pyro ? "열분해 위탁 요청" : "매각 견적 요청"}] ${st?.classify.detail} 월 ${st?.monthlyKg.toLocaleString("ko-KR")}kg`, pyro ? "열분해 위탁 요청서" : "매각 견적 요청서", p.streamId);
    }
  }
  await saveSession(sessionId, (s) =>
    appendRun(
      { ...s, status: "sent", approval: { approvedBy: user.name, approvedAt: nowIso(), routeId, sentTo } },
      [
        human(`승인 · ${user.name} · 시나리오 ${routeId}`, { agent: "proposal", step: "proposal", detail: "승인권자가 발송 대상과 확인 항목을 체크했습니다." }),
        {
          agent: "proposal",
          actor: "ai",
          kind: "tool",
          tool: "모의 메일함 발송",
          title: `${new Set(sentTo.map((t) => t.name)).size}곳에 서류 ${sentTo.length}건 발송`,
          refs: sentTo.map((t) => `${t.name} · ${t.kind}`),
          step: "proposal",
          durationMs: 600,
        },
      ],
    ),
  );
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
  const decisions = session.feasibility?.decisions ?? [];
  const streamId = String(formData.get("streamId") ?? "") || decisions.find((d) => d.route === "bundle")?.streamId || decisions.find((d) => d.route === "sell")?.streamId;
  const decision = decisions.find((d) => d.streamId === streamId);
  const stream = session.streams.find((x) => x.id === streamId);
  const outcome = {
    recordedAt: nowIso(),
    recordedBy: user.name,
    recorderRole,
    streamId,
    accepted: o.accepted === "yes",
    actualGrade: o.actualGrade,
    actualPerKg: o.actualPerKg,
    actualKg: o.actualKg,
    reason: o.reason,
  };
  await saveSession(sessionId, (s) => {
    const outcomes = [...(s.outcomes ?? (s.outcome ? [s.outcome] : [])).filter((x) => x.streamId !== streamId), outcome];
    // 외부로 보낸 흐름(묶음·매각·열분해)의 결과가 모두 모이면 수거 완료로 본다
    const sentIds = new Set((s.matching?.bundles ?? []).map((b) => b.streamId).concat((s.matching?.partners ?? []).filter((p) => p.companyId).map((p) => p.streamId)));
    const expected = (s.feasibility?.decisions ?? []).filter((d) => sentIds.has(d.streamId) && (s.approval?.routeId === "A" || d.route !== "bundle")).length || 1;
    const done = outcomes.length >= expected;
    return appendRun({ ...s, outcome, outcomes, status: done ? "completed" : s.status }, [
      human(`${stream?.name ?? "흐름"} 실제 결과 기록 · ${o.accepted === "yes" ? `${o.actualPerKg > 0 ? "+" : ""}${o.actualPerKg}원/kg, ${o.actualKg}kg` : "매입 거절"}`, {
        agent: "proposal",
        step: "proposal",
        streamId,
        detail: `${recorderRole}가 기록했습니다. 예상과의 차이는 라벨 검수 대기열에 올라가 다음 학습에 쓰입니다.`,
      }),
      ...(done ? [reply("모든 흐름의 결과가 모여 수거 완료로 바꿨습니다.")] : []),
    ]);
  });
  await addLabelTask({
    sessionId,
    kind: "outcome",
    title: `${stream?.name ?? "흐름"} · ${o.accepted === "yes" ? "실제 매입 결과" : "매입 거절"}`,
    before: `예상 ${decision ? `${decision.afterPerKg > 0 ? "+" : ""}${decision.afterPerKg}원/kg` : "-"}`,
    after: o.accepted === "yes" ? `실제 ${o.actualPerKg > 0 ? "+" : ""}${o.actualPerKg}원/kg · ${o.actualGrade}` : `거절 · ${o.reason ?? o.actualGrade}`,
    source: "업체 실제 결과",
  });
  await outbox.update(
    (await outbox.find((m) => m.sessionId === sessionId && (m.kind === "pickup" || m.kind === "quote") && (!m.streamId || m.streamId === streamId)))?.id ?? "",
    (m) => ({ ...m, status: "completed" }),
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const ROUTE_WORDS: [RegExp, StreamRoute][] = [
  [/재투입/, "reuse"],
  [/묶음/, "bundle"],
  [/열분해/, "pyrolysis"],
  [/소각/, "incinerate"],
  [/매각|판매|팔아|팔기/, "sell"],
];
const CLEAR_FROM: Partial<Record<FlowStep, Partial<Session>>> = {
  feasibility: CLEAR_FROM_FEASIBILITY,
  regulation: CLEAR_FROM_MATCHING,
  matching: { matching: undefined, costCarbon: undefined, proposal: undefined, selectedRoute: undefined },
  "cost-carbon": { costCarbon: undefined, proposal: undefined, selectedRoute: undefined },
  proposal: { proposal: undefined },
};
const COMMAND_HELP = '예: "필름은 매각으로 바꿔 줘", "규정 다시 검토해 줘", "탄소 매립 대비로 보여 줘", "지금 상황 요약해 줘"';

/**
 * 실행 콘솔의 명령. 대화가 아니라 화면에서 할 수 있는 일을 말로 시키는 것이다.
 * 경로 바꾸기, 단계 다시 계산, 탄소 기준 바꾸기, 상황 요약을 알아듣고, 외부 발송 승인은 하지 않는다(사람 승인 게이트).
 * 실제 서비스에서는 조정 에이전트가 의도를 분류하고 같은 도구를 부른다.
 */
export async function runCommand(sessionId: string, _prev: unknown, formData: FormData): Promise<{ message?: string; error?: string }> {
  const { session } = await getSessionForCurrentOrg(sessionId);
  const text = String(formData.get("command") ?? "").trim().slice(0, 200);
  if (!text) return { error: "명령을 입력해 주세요." };
  const cmd = human(text, { kind: "command" });
  const log = (...drafts: Parameters<typeof appendRun>[1]) => saveSession(sessionId, (s) => appendRun(s, drafts));
  const done = async (message: string, detail?: string) => {
    await log(cmd, reply(message, detail));
    revalidatePath(`/session/${sessionId}`, "layout");
    return { message };
  };

  if (/승인|발송|보내/.test(text)) {
    return done("외부 발송은 에이전트가 대신 승인하지 않습니다.", "승인권자가 이행안 화면에서 발송 대상과 확인 항목을 직접 체크해야 나갑니다.");
  }

  const route = ROUTE_WORDS.find(([re]) => re.test(text))?.[1];
  const stream = session.streams.find((x) =>
    x.name
      .split(/[\s·]+/)
      .filter((t) => t.length >= 2)
      .some((t) => text.includes(t)),
  );
  if (route && stream) {
    const d = session.feasibility?.decisions.find((x) => x.streamId === stream.id);
    if (!d) return done("경로 판정을 먼저 해야 경로를 바꿀 수 있습니다.");
    if (session.approval) return done("발송을 마친 진단이라 경로를 바꿀 수 없습니다.");
    if (d.route === route) return done(`${josa(stream.name, "은/는")} 이미 ${STREAM_ROUTE_LABEL[route]}입니다.`);
    await log(cmd);
    await setStreamRoute(sessionId, stream.id, route);
    await log(reply(`${stream.name} 경로를 ${josa(STREAM_ROUTE_LABEL[route], "으로/로")} 바꿨습니다.`, "규정 검토부터 다시 계산해야 합니다. 다음 단계로 넘어가면 바뀐 경로로 계산합니다."));
    revalidatePath(`/session/${sessionId}`, "layout");
    redirect(`/session/${sessionId}/feasibility`);
  }

  const step = STEP_OF_WORD.find(([re]) => re.test(text))?.[1];
  if (/매립 대비|신재 대비/.test(text)) {
    await log(cmd, reply(`탄소 기준을 ${/매립/.test(text) ? "매립" : "신재"} 대비로 보여 줍니다.`));
    await computeTo(sessionId, "cost-carbon");
    redirect(`/session/${sessionId}/cost-carbon${/매립/.test(text) ? "?base=landfill" : ""}`);
  }
  if (/다시/.test(text) && step) {
    if (step === "classify") return done("식별은 사진을 다시 올려야 다시 할 수 있습니다.");
    if (session.approval) return done("발송을 마친 진단이라 다시 계산하지 않습니다.");
    const label = FLOW_STEPS.find((f) => f.slug === step)?.label ?? step;
    await saveSession(sessionId, (s) => appendRun({ ...s, ...CLEAR_FROM[step] }, [cmd, reply(`${label}부터 다시 계산합니다.`)]));
    await goToStep(sessionId, step);
  }
  if (/요약|상황|어디까지|지금/.test(text)) {
    const f = session.feasibility;
    const next = FLOW_STEPS.find((x) => !({ feasibility: f, regulation: session.regulation, matching: session.matching, "cost-carbon": session.costCarbon, proposal: session.proposal, classify: true } as Record<string, unknown>)[x.slug]);
    const asks = session.questions.filter((q) => !q.answer).length;
    const parts = [
      `흐름 ${session.streams.length}개`,
      f ? `공장 월 손익 ${formatSigned(f.totalNow)}원 → ${formatSigned(f.totalAfter)}원` : "경로 판정 전",
      session.approval ? `발송 완료(${session.approval.sentTo.length}건)` : next ? `다음 단계: ${next.label}` : "승인 대기",
      asks ? `답하지 않은 되묻기 ${asks}건` : "",
    ].filter(Boolean);
    return done(parts.join(" · "));
  }
  if (step && /보여|열어|가 ?줘|이동/.test(text)) {
    await log(cmd, reply(`${FLOW_STEPS.find((f) => f.slug === step)?.label} 화면으로 이동합니다.`));
    await goToStep(sessionId, step);
  }
  return done("아직 이해하지 못하는 명령입니다.", COMMAND_HELP);
}

const guardrailSchema = z.object({
  minPerKg: z.coerce.number().int().min(50, "하한 단가는 50원 이상이어야 합니다.").max(300),
  minPerMonth: z.coerce.number().int().min(1).max(4),
  days: z.array(z.enum(WEEKDAYS)).min(1, "가능한 요일을 하나 이상 골라 주세요."),
});

/**
 * 수거 조건 협상을 에이전트에게 맡긴다. 사람은 가드레일(하한 단가, 가능 요일, 월 최소 횟수)만 정하고,
 * 우리 에이전트와 수거 업체 에이전트가 조건을 주고받는다. 합의안은 승인권자가 승인해야 확정된다.
 */
export async function startNegotiation(sessionId: string, streamId: string, _prev: unknown, formData: FormData) {
  const { session } = await getSessionForCurrentOrg(sessionId);
  const bundle = session.matching?.bundles.find((b) => b.streamId === streamId);
  if (!session.approval || session.approval.routeId !== "A" || !bundle) return { error: "A. 흐름별 최적안을 승인해 순회 수거 요청서를 보낸 뒤에 협상할 수 있습니다." };
  if (session.negotiations?.some((n) => n.streamId === streamId && n.status === "approved")) return { error: "이미 승인한 합의안이 있습니다." };
  const parsed = guardrailSchema.safeParse({ minPerKg: formData.get("minPerKg"), minPerMonth: formData.get("minPerMonth"), days: formData.getAll("days") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "가드레일을 확인해 주세요." };
  const g = { ...parsed.data, maxRounds: 6 };
  const n = negotiate(bundle, g);
  const who = (by: "ours" | "theirs") => (by === "ours" ? "우리 에이전트" : `${bundle.collector.name} 에이전트`);
  await saveSession(sessionId, (s) =>
    appendRun({ ...s, negotiations: [...(s.negotiations ?? []).filter((x) => x.streamId !== streamId), n] }, [
      human(`협상 위임 · 하한 ${g.minPerKg}원/kg, ${g.days.join("·")}요일, 월 ${g.minPerMonth}회 이상`, {
        agent: "negotiation",
        step: "proposal",
        streamId,
        detail: "에이전트는 이 범위 안에서만 양보하고, 벗어나면 사람에게 넘깁니다.",
      }),
      ...n.rounds.map((r) => ({
        agent: "negotiation" as const,
        actor: "ai" as const,
        kind: "decision" as const,
        tool: "A2A · 에이전트 간 메시지",
        title: `${who(r.by)} · ${termsText(r.terms)}${r.accept ? " · 수락" : ""}`,
        detail: r.message,
        refs: [r.within ? "우리 가드레일 안" : "우리 가드레일 밖"],
        step: "proposal" as const,
        streamId,
        durationMs: 1600,
      })),
      n.status === "agreed"
        ? { agent: "negotiation" as const, actor: "ai" as const, kind: "ask" as const, title: `합의안 · ${termsText(n.agreed!)} · 사람 승인 대기`, step: "proposal" as const, streamId, durationMs: 100 }
        : { agent: "negotiation" as const, actor: "ai" as const, kind: "ask" as const, title: "합의하지 못해 사람에게 넘깁니다", detail: n.note, step: "proposal" as const, streamId, durationMs: 100 },
    ]),
  );
  revalidatePath(`/session/${sessionId}`, "layout");
  return { ok: true as const };
}

/** 합의안 승인(승인권자). 순회 수거 일정과 업체 회신을 확정하고 이웃 기업에 알린다 */
export async function approveNegotiation(sessionId: string, negotiationId: string) {
  const { session, org } = await getSessionForCurrentOrg(sessionId);
  const user = await getCurrentUser();
  await ensureOwnerMember(org, user);
  const member = await findMemberForUser(org.id, user.id);
  if (member?.role === "담당자") return { error: "합의안 승인은 승인권자 이상만 할 수 있습니다." };
  const n = session.negotiations?.find((x) => x.id === negotiationId);
  if (!n || n.status !== "agreed" || !n.agreed) return { error: "승인할 합의안이 없습니다." };
  const agreed = n.agreed;
  const schedule = `매월 ${agreed.perMonth === 2 ? "둘째·넷째 주" : `${agreed.perMonth}회`} ${agreed.day}요일 ${agreed.slot}, 사업장별 순회`;
  const neighbors = session.matching?.bundles.find((b) => b.streamId === n.streamId)?.group.filter((g) => !g.isSelf).length ?? 0;
  await saveSession(sessionId, (s) =>
    appendRun(
      {
        ...s,
        negotiations: (s.negotiations ?? []).map((x) => (x.id === negotiationId ? { ...x, status: "approved", approvedBy: user.name, approvedAt: nowIso() } : x)),
        matching: s.matching ? { ...s.matching, bundles: s.matching.bundles.map((b) => (b.streamId === n.streamId ? { ...b, schedule } : b)) } : s.matching,
      },
      [
        human(`합의안 승인 · ${termsText(agreed)}`, { agent: "negotiation", step: "proposal", streamId: n.streamId, detail: `${josa(user.name, "이/가")} 승인했습니다.` }),
        reply(`순회 일정 확정 · ${schedule}`, `${n.counterparty.name}의 순회 수거 요청서에 수락 회신을 남기고, 이웃 기업 ${neighbors}곳에 확정 일정을 알렸습니다(모의).`),
      ],
    ),
  );
  const pickup = await outbox.find((m) => m.sessionId === sessionId && m.kind === "pickup" && m.streamId === n.streamId);
  if (pickup) await outbox.update(pickup.id, (m) => ({ ...m, status: m.status === "completed" ? m.status : "replied", reply: { decision: "accepted", at: nowIso(), by: `${n.counterparty.name} 에이전트`, reason: termsText(agreed) } }));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** 합의하지 못했거나 조건을 바꾸고 싶을 때 협상 기록을 지우고 가드레일부터 다시 정한다(승인 전만) */
export async function resetNegotiation(sessionId: string, negotiationId: string) {
  await getSessionForCurrentOrg(sessionId);
  await saveSession(sessionId, (s) => {
    const n = s.negotiations?.find((x) => x.id === negotiationId);
    if (!n || n.status === "approved") return s;
    return appendRun({ ...s, negotiations: (s.negotiations ?? []).filter((x) => x.id !== negotiationId) }, [
      human("협상 다시 하기 · 가드레일부터 다시 정합니다", { agent: "negotiation", step: "proposal", streamId: n.streamId }),
    ]);
  });
  revalidatePath(`/session/${sessionId}`, "layout");
}

const replySchema = z.object({
  decision: z.enum(["accepted", "declined"]),
  reason: z.string().trim().max(200).optional(),
});

/**
 * 이웃 기업이 묶음 참여 제안에 회신한다(이웃 기업 화면). 시연에서는 한 계정이 그 기업 시점으로 바꿔 본다.
 * 참여하지 않으면 그 기업 물량만 묶음에서 빠지고, 나머지 기업의 순회 수거는 그대로 둔다.
 */
export async function respondBundleInvite(messageId: string, _prev: unknown, formData: FormData) {
  await getCurrentUser();
  const message = await outbox.get(messageId);
  if (!message || message.kind !== "bundle-invite") return { error: "묶음 참여 제안을 찾을 수 없습니다." };
  const parsed = replySchema.safeParse({ decision: formData.get("decision"), reason: formData.get("reason") || undefined });
  if (!parsed.success) return { error: "참여 여부를 골라 주세요." };
  if (parsed.data.decision === "declined" && !parsed.data.reason) return { error: "참여하지 않는 이유를 적어 주세요. 묶음을 다시 짤 때 씁니다." };
  await outbox.update(messageId, (m) => ({
    ...m,
    status: "replied",
    reply: { decision: parsed.data.decision, at: nowIso(), by: `${m.toName} 담당자`, reason: parsed.data.reason },
  }));
  await saveSession(message.sessionId, (s) =>
    appendRun(s, [
      human(`${message.toName} 묶음 참여 ${parsed.data.decision === "accepted" ? "동의" : "불참"}`, {
        agent: "matching",
        step: "matching",
        streamId: message.streamId,
        detail: parsed.data.reason ? `사유: ${parsed.data.reason}` : "이웃 기업 담당자의 회신입니다.",
      }),
    ]),
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
