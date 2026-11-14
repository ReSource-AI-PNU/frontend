import "server-only";
import { notFound } from "next/navigation";
import type { KnowledgeCard, LabelTask, OutboxMessage, Session } from "@/lib/session/types";
import { collection, newId, nowIso } from "./mock/db";
import { requireOrganization } from "./organization";

export const sessions = collection<Session>("sessions");
export const knowledgeCards = collection<KnowledgeCard>("knowledge");
export const labelTasks = collection<LabelTask>("labels");
export const outbox = collection<OutboxMessage>("outbox");

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

/** 다른 회사 사용자가 남긴 것처럼 보이는 시연용 시드. 비어 있을 때만 넣는다. */
export async function ensureSeeds() {
  await knowledgeCards.seed(() => [
    {
      id: "kc_rain_pp",
      item: "폐플라스틱",
      condition: "비 온 다음 날, 야외에 둔 PP 베일",
      judgment: "수분이 5% 넘는 것으로 보고 한 등급 낮춰 매입한다",
      rationale: "수거 기사 경험. 지난 3개월 매입 기록 12건 중 10건이 수분 감량 정산이었다.",
      step: "feasibility",
      author: "박기사",
      orgName: "(주)녹산리사이클",
      createdAt: daysAgo(41),
      status: "adopted",
      agrees: ["u1", "u2", "u3", "u4", "u5", "u6", "u7"],
      citedCount: 23,
    },
    {
      id: "kc_clear_tape",
      item: "폐플라스틱",
      condition: "사진에서 베일 표면에 광택 나는 띠가 보일 때",
      judgment: "투명 테이프로 보고 이물질에 포함한다",
      rationale: "투명 테이프는 모델이 자주 놓친다. 현장 확인 9건 중 8건이 테이프였다.",
      step: "classify",
      author: "이대리",
      orgName: "(주)세움플라텍",
      createdAt: daysAgo(12),
      status: "reviewing",
      agrees: ["u2", "u8"],
      citedCount: 0,
    },
    {
      id: "kc_purge_abs",
      item: "폐플라스틱",
      condition: "퍼지 덩어리에 검은 줄무늬가 섞여 있을 때",
      judgment: "ABS 혼입으로 보고 매각 대신 열분해로 보낸다",
      rationale: "PP 매입처 입고 검사에서 ABS 혼입으로 반송된 사례 5건.",
      step: "feasibility",
      author: "정과장",
      orgName: "(주)단비화성",
      createdAt: daysAgo(27),
      status: "adopted",
      agrees: ["u3", "u9", "u10"],
      citedCount: 8,
    },
    {
      id: "kc_film_label",
      item: "포장재",
      condition: "스트레치 필름에 종이 라벨이 붙은 채 모였을 때",
      judgment: "라벨 부분을 잘라 내고 필름만 마대에 모은다",
      rationale: "필름 매입처가 종이 혼입 2%를 넘으면 감량 정산했다. 지난달 2건.",
      step: "classify",
      author: "최반장",
      orgName: "(주)길벗필름",
      createdAt: daysAgo(6),
      status: "proposed",
      agrees: [],
      citedCount: 0,
    },
  ]);
  await labelTasks.seed(() => [
    { id: "lt_seed1", sessionId: "seed", kind: "box", title: "테이프 박스 위치 수정", before: "x 0.40 y 0.54 · 20×15%", after: "x 0.38 y 0.52 · 24×16%", source: "현장 수정", createdAt: daysAgo(3), status: "pending" },
    { id: "lt_seed2", sessionId: "seed", kind: "ratio", title: "ABS 혼입 비율", before: "3%", after: "8%", source: "현장 수정", createdAt: daysAgo(2), status: "pending" },
    { id: "lt_seed3", sessionId: "seed", kind: "outcome", title: "실제 매입 결과", before: "예상 +300원/kg", after: "실제 +270원/kg · B등급", source: "업체 실제 결과", createdAt: daysAgo(2), status: "pending" },
    { id: "lt_seed4", sessionId: "seed", kind: "origin", title: "포장 필름 출처 변경", before: "공정 부산물 · PIR", after: "사용 후 포장재 · PCR", source: "현장 수정", createdAt: daysAgo(1), status: "pending" },
    { id: "lt_seed6", sessionId: "seed", kind: "route", title: "퍼지 경로 변경", before: "매각", after: "열분해", source: "현장 수정", createdAt: daysAgo(1), status: "pending" },
    { id: "lt_seed5", sessionId: "seed", kind: "outcome", title: "매입 거절", before: "예상 재활용 가능", after: "거절 · 이물질 15%", source: "업체 실제 결과", createdAt: daysAgo(9), status: "accepted", reviewer: "ML 담당" },
  ]);
}

/** 현재 사용자 회사의 세션만 꺼낸다. 다른 회사 세션이면 404. */
export async function getSessionForCurrentOrg(id: string) {
  const org = await requireOrganization();
  const session = await sessions.get(id);
  if (!session || session.orgId !== org.id) notFound();
  return { session, org };
}

export async function listSessionsForCurrentOrg() {
  const org = await requireOrganization();
  const rows = await sessions.filter((s) => s.orgId === org.id);
  return { org, sessions: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export async function saveSession(id: string, patch: (s: Session) => Session) {
  return sessions.update(id, (s) => ({ ...patch(s), updatedAt: nowIso() }));
}

export async function addLabelTask(task: Omit<LabelTask, "id" | "createdAt" | "status">) {
  return labelTasks.insert({ ...task, id: newId("lt"), createdAt: nowIso(), status: "pending" });
}
