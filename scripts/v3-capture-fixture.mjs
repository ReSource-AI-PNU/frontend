#!/usr/bin/env node
/**
 * v3 예시 데이터(fixture)를 돌고 있는 백엔드 로컬 서버에서 다시 받아 적는다.
 *
 *   (backend) python3 -m app.v3.devserver --port 8000
 *   (frontend) node scripts/v3-capture-fixture.mjs [http://localhost:8000/api/v3]
 *
 * 시연 데이터를 처음 상태로 되돌린 뒤, 진단을 만들고 승인 전(awaiting_approval)까지 돌린다.
 * 담당자 질문에는 포장 필름 수분만 답하고 나머지는 "모름"으로 답한다.
 * 근거는 뷰와 업체 프로필이 직접 가리키는 것과 그 계산 사슬의 바로 아래 단계까지만 담는다(법령 원문 등으로 파일이 커지지 않게).
 * 화면이 쓰는 값은 전부 이 서버가 실제로 낸 응답이다. 손으로 고치지 않는다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://localhost:8000/api/v3").replace(/\/$/, "");
const EMITTER = "org_hanbit";
const ANSWERS = { st_film: "2" }; // 나머지는 "unknown"
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
      if ((key === "evidence" || key === "reasonEvidence" || key === "assumptions") && Array.isArray(item)) {
        item.forEach((id) => typeof id === "string" && found.add(id));
      } else evidenceIds(item, found);
    }
    if (value.type === "evidence" && typeof value.id === "string") found.add(value.id);
  }
  return found;
}

await post("/demo/reset", EMITTER);
const orgs = await call("/orgs", null);
let view = await post("/sessions", EMITTER, { emitterOrgId: EMITTER });
const id = view.session.id;
for (let turn = 0; turn < 6 && view.session.status !== "awaiting_approval"; turn += 1) {
  view = await post(`/sessions/${id}/run`, EMITTER);
  for (const question of view.questions.filter((item) => !item.answered)) {
    view = await post(`/sessions/${id}/answers`, EMITTER, {
      questionId: question.id,
      value: ANSWERS[question.streamId] ?? "unknown",
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
