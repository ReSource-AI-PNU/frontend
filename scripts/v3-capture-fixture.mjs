#!/usr/bin/env node
/**
 * v3 예시 데이터(fixture)를 돌고 있는 백엔드 로컬 서버에서 다시 받아 적는다.
 *
 *   (backend) python3 -m app.v3.devserver --port 8000
 *   (frontend) node scripts/v3-capture-fixture.mjs [http://localhost:8000/api/v3]
 *
 * 시연 데이터를 처음 상태로 되돌린 뒤(관리자 조직으로 부른다), 진단을 만들고 승인 전(awaiting_approval)까지 돌린다.
 * 담당자 질문에는 포장 필름 수분만 답하고 나머지는 "모름"으로 답한다. 여기까지가 화면의 예시 데이터다.
 * 이어서 같은 진단에 사람 교정 한 건을 기록하고, 허가증 원문 대조가 남은 경로는 업체가 허가증(가상)을 올리고 배출 기업
 * 담당자가 대조를 기록한 뒤(서버가 대조 전 확정을 막는다), 양쪽 승인으로 확정하고 업체가 실제 결과 한 건을 기록해
 * 확정 뒤 뷰(배출 기업, 업체)와 실적 리포트를 tests/fixtures/에 받는다. 스키마 검사(tests/v3-view.test.ts)가 이 세 뷰와 리포트를 읽는다.
 * 근거는 뷰와 업체 프로필이 직접 가리키는 것과 그 계산 사슬의 바로 아래 단계까지만 담는다(법령 원문 등으로 파일이 커지지 않게).
 * 화면이 쓰는 값은 전부 이 서버가 실제로 낸 응답이다. 손으로 고치지 않는다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://localhost:8000/api/v3").replace(/\/$/, "");
const EMITTER = "org_hanbit";
const ADMIN = "org_admin";
/** 확정 뒤 업체가 본 뷰를 받을 업체와, 그 업체가 기록하는 실제 결과(가상 값) */
const OUTCOME_VENDOR = "org_namhae";
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");
const ANSWERS = { "st_film.moisturePct": "2" }; // 흐름.항목. 나머지는 "unknown"(현행 처리비 질문도 모름으로 답한다)
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/v3/fixture-data");

async function call(pathname, orgId, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (orgId) headers["X-Org-Id"] = orgId;
  if (init.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${pathname}`, { ...init, headers });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${pathname} → ${response.status} ${await response.text()}`);
  return response.json();
}
const post = (pathname, orgId, body) =>
  call(pathname, orgId, { method: "POST", body: body ? JSON.stringify(body) : undefined });

/** 뷰 안에 나오는 근거 ID를 모두 모은다. */
function evidenceIds(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => evidenceIds(item, found));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if ((key === "evidence" || key === "reasonEvidence") && Array.isArray(item)) {
        item.forEach((id) => typeof id === "string" && found.add(id));
      } else if (key === "assumptions" && Array.isArray(item)) {
        // 가정값은 {id, label, value, unit}이고 id가 근거 ID다
        item.forEach((entry) => typeof entry?.id === "string" && found.add(entry.id));
      } else evidenceIds(item, found);
    }
    if (value.type === "evidence" && typeof value.id === "string") found.add(value.id);
  }
  return found;
}

await post("/demo/reset", ADMIN);
const orgs = await call("/orgs", null);
let view = await post("/sessions", EMITTER, { emitterOrgId: EMITTER });
const id = view.session.id;
for (let turn = 0; turn < 6 && view.session.status !== "awaiting_approval"; turn += 1) {
  view = await post(`/sessions/${id}/run`, EMITTER);
  for (const question of view.questions.filter((item) => !item.answered)) {
    view = await post(`/sessions/${id}/answers`, EMITTER, {
      questionId: question.id,
      value: ANSWERS[`${question.streamId}.${question.field}`] ?? "unknown",
    });
  }
}
if (view.session.status !== "awaiting_approval") throw new Error(`승인 전 상태가 아닙니다: ${view.session.status}`);

const streams = await call(`/orgs/${EMITTER}/streams`, EMITTER);
const vendors = {};
for (const org of orgs.filter((item) => item.role === "vendor")) {
  vendors[org.id] = await call(`/vendors/${org.id}`, org.id);
}
// 실행 기록(events)의 근거 ID는 화면에서 열지 않으므로 모으지 않는다
const ids = evidenceIds({ ...view, events: [] });
for (const profile of Object.values(vendors)) evidenceIds(profile, ids);
const evidence = {};
const missing = [];
for (const evidenceId of [...ids].sort()) {
  try {
    const detail = await call(`/evidence/${encodeURIComponent(evidenceId)}`, EMITTER);
    const direct = new Set(detail.evidence.meta?.inputEvidence ?? []);
    for (const item of [detail.evidence, ...detail.chain.filter((link) => direct.has(link.id))]) {
      const record = { ...item };
      delete record.depth;
      evidence[record.id] ??= record;
    }
  } catch {
    missing.push(evidenceId); // 배출 기업이 볼 수 없는 근거(업체 내부 문서 등)는 예시에 넣지 않는다
  }
}

await mkdir(out, { recursive: true });
const write = (name, data) => writeFile(path.join(out, name), `${JSON.stringify(data)}\n`);
await write("view.json", view);
await write("evidence.json", evidence);
await write("records.json", { orgs, streams, vendors });
await write("meta.json", {
  capturedFrom: "backend app.v3.devserver (--llm rule)",
  capturedOn: view.session.today,
  emitterOrgId: EMITTER,
  sessionStatus: view.session.status,
  answers: ANSWERS,
  evidenceCount: Object.keys(evidence).length,
  evidenceNotVisible: missing,
});
console.log(`view ${view.session.status}, 근거 ${Object.keys(evidence).length}건, 볼 수 없는 근거 ${missing.length}건 → ${out}`);

// 여기부터는 테스트용 확정 뒤 뷰. 화면의 예시 데이터(위에서 쓴 승인 전 뷰)에는 들어가지 않는다.
const film = view.streams.find((item) => item.id === "st_film");
await post(`/sessions/${id}/corrections`, EMITTER, {
  streamId: "st_film",
  field: "form",
  before: film?.form ?? null,
  after: "압축",
  note: "예시 데이터용 교정(가상)",
});
// 허가증 원문 대조가 끝나지 않은 경로는 서버가 확정하지 않는다(409 PERMIT_UNVERIFIED). 시연은 새길자원만 대조해 둔 상태라,
// 허가증을 올리지 않은 업체는 업체로 허가증(가상 글 파일)을 올리고, 배출 기업 담당자로 원문 대조를 기록한 뒤 승인한다.
const HOLDERS = {
  org_saegil: ["(주)새길자원", "부산광역시 강서구 미음동"],
  org_namhae: ["(주)남해열분해", "경상남도 김해시 주촌면"],
  org_miso: ["(주)미소환경", "부산광역시 사상구 학장동"],
};
async function uploadPermit(vendorOrgId) {
  const [name, address] = HOLDERS[vendorOrgId];
  const text = `폐기물처리업 허가증(가상)\n상호: ${name}\n소재지: ${address}\n업종: 폐기물 종합재활용업\n영업대상 폐기물: 폐플라스틱(PP, PE, ABS)\n`;
  const form = new FormData();
  form.set("file", new Blob([text], { type: "text/plain" }), "허가증(가상).txt");
  form.set("orgId", vendorOrgId);
  form.set("kind", "permit");
  const response = await fetch(`${base}/intake/documents`, { method: "POST", body: form, headers: { "X-Org-Id": vendorOrgId } });
  if (!response.ok) throw new Error(`허가증 올리기 → ${response.status} ${await response.text()}`);
}
let checking = await call(`/sessions/${id}`, EMITTER);
for (const approval of checking.approvals.filter((item) => item.permitHold)) {
  const thread = checking.threads.find((item) => item.id === approval.threadId);
  if ((approval.permits ?? []).some((permit) => !permit.document)) await uploadPermit(thread.vendorOrgId);
}
checking = await call(`/sessions/${id}`, EMITTER);
for (const approval of checking.approvals.filter((item) => item.permitHold)) {
  const thread = checking.threads.find((item) => item.id === approval.threadId);
  for (const permit of (approval.permits ?? []).filter((item) => item.status !== "met")) {
    const document = permit.document;
    if (!document) throw new Error(`${thread.vendorOrgId}: 대조할 허가증이 없습니다`);
    const read = document.items.find((item) => item.wasteItem === permit.wasteItem);
    checking = await post(`/sessions/${id}/permit-checks`, EMITTER, {
      streamId: permit.streamId,
      vendorOrgId: thread.vendorOrgId,
      documentId: document.id,
      page: read?.page ?? 1,
      itemFound: true,
      processFits: true,
      itemQuote: read?.quote ?? undefined,
      processQuote: document.business?.quote ?? undefined,
    });
  }
}
for (const approval of checking.approvals) {
  const thread = checking.threads.find((item) => item.id === approval.threadId);
  await post(`/sessions/${id}/approvals`, EMITTER, { threadId: approval.threadId });
  await post(`/sessions/${id}/approvals`, thread.vendorOrgId, { threadId: approval.threadId });
}
const mine = checking.approvals.find(
  (approval) => checking.threads.find((item) => item.id === approval.threadId)?.vendorOrgId === OUTCOME_VENDOR,
);
if (!mine) throw new Error(`${OUTCOME_VENDOR}와 합의한 대화가 없습니다`);
const agreed = checking.result.assignments.find((item) => item.threadId === mine.threadId);
await post(`/sessions/${id}/outcomes`, OUTCOME_VENDOR, {
  threadId: mine.threadId,
  streamId: agreed.streamId,
  actualGrade: "등외",
  actualUnitPriceKrwPerKg: agreed.unitPrice.value,
  actualKg: 240,
  inspectedOn: view.session.today,
  note: "예시 데이터용 실제 결과(가상)",
});
const confirmed = await call(`/sessions/${id}`, EMITTER);
if (confirmed.session.status !== "confirmed") throw new Error(`확정 상태가 아닙니다: ${confirmed.session.status}`);
const vendorView = await call(`/sessions/${id}`, OUTCOME_VENDOR);
const report = await call(`/orgs/${EMITTER}/report`, EMITTER);
await mkdir(fixtures, { recursive: true });
await writeFile(path.join(fixtures, "v3-report.json"), `${JSON.stringify(report)}\n`);
await writeFile(path.join(fixtures, "v3-view-confirmed.json"), `${JSON.stringify(confirmed)}\n`);
await writeFile(path.join(fixtures, "v3-view-vendor-confirmed.json"), `${JSON.stringify(vendorView)}\n`);
console.log(
  `확정 뒤 뷰 2건(문서 ${confirmed.documents.length}건, 교정 ${confirmed.feedback.corrections.length}건, 실제 결과 ${confirmed.feedback.outcomes.length}건) → ${fixtures}`,
);
