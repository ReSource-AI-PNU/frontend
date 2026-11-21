/** Local-only real browser flow. Synthetic companies and text documents; no LLM/OCR,
 * screenshots, video, traces, external messages, or deployment. Start the local
 * verification backend and frontend first; CHROME_CDP_URL selects a test Chrome.
 */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.LOCAL_QA_URL || "http://127.0.0.1:5300";
const endpoint = process.env.CHROME_CDP_URL || "http://127.0.0.1:59333";
for (const address of [baseURL, endpoint]) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(address).hostname), "Local verification only");
}
const browser = await chromium.connectOverCDP(endpoint);
const run = Date.now();
const contexts = [];
const steps = [];
async function page(role) {
  const context = await browser.newContext({ baseURL, locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block" });
  contexts.push(context);
  const p = await context.newPage();
  p.setDefaultTimeout(30000);
  await p.goto("/signup");
  await p.getByLabel("이름", { exact: true }).fill(`로컬검증 ${role}`);
  await p.getByLabel("이메일", { exact: true }).fill(`${role}-${run}@example.com`);
  await p.getByLabel("비밀번호", { exact: true }).fill(`local-test-${run}-Password!`);
  await p.getByLabel("비밀번호 확인").fill(`local-test-${run}-Password!`);
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "가입하기", exact: true }).click();
  await p.waitForURL(/onboarding/);
  await p.locator(`input[name=kind][value=${role}]`).check({ force: true });
  await p.getByLabel("회사 이름").fill(`가상검증 ${role} ${run}`);
  await p.getByRole("button", { name: "등록하고 시작하기" }).click();
  await p.waitForURL(/\/app$/);
  await p.getByRole("link", { name: role === "vendor" ? "업체 정보" : "자료", exact: true }).waitFor();
  await p.waitForLoadState("networkidle");
  steps.push(`${role}: UI signup and company created`);
  return p;
}
async function upload(p, filename, text) {
  await p.locator("input[type=file]").setInputFiles({ name: filename, mimeType: "text/plain", buffer: Buffer.from(text) });
}
try {
  const e = await page("emitter");
  const v = await page("vendor");
  await v.goto("/app/materials");
  await v.getByLabel("가장 낮게 부를 단가").fill("100");
  await v.getByLabel("가장 높게 부를 단가").fill("90");
  await v.getByRole("button", { name: "저장", exact: true }).click();
  await expect(v.getByText("최저 단가는 최고 단가보다 클 수 없습니다. 기존 설정은 유지됩니다.")).toBeVisible();
  steps.push("UI rejected inverted price bounds");
  await v.getByLabel("가장 낮게 부를 단가").fill("-100");
  await v.getByLabel("업체가 적용할 처리 방식", { exact: true }).selectOption("물질 재활용");
  await v.getByLabel("가장 높게 부를 단가").fill("1000");
  await v.getByLabel("한 달 최소 수거 횟수").fill("1");
  await v.getByLabel("수거할 수 있는 요일").fill("화");
  await v.getByLabel("수거 가능 지역 (쉼표로 구분)").fill("부산");
  await v.getByLabel("추가비 없이 수거").check();
  await v.getByRole("button", { name: "저장", exact: true }).click();
  await expect(v.getByText("저장했습니다.", { exact: true })).toBeVisible();
  await upload(v, "가상검증-허가증.txt", `가상 테스트 문서 (실제 허가증 아님)\n폐기물 처리업 허가증\n상호: 가상검증 vendor ${run}\n허가 번호: 제2026-TEST-001호\n허가 품목: 폐합성수지(PP)\n처리 방법: 재활용(물질 재활용)\n허가일: 2026-01-15\n부산광역시`);
  await v.getByRole("checkbox").check();
  await v.getByRole("button", { name: "확인한 값 1개를 근거로 등록" }).click();
  await v.getByLabel("문서 종류").selectOption("purchase_criteria");
  await upload(v, "가상검증-매입기준표.txt", "가상 테스트 매입 기준표\n재질\t형태\t등급\t매입 단가(원/kg)\t오염도 상한\t수분 상한\nPP\t가공 전\tA\t300\t2%\t1%\n1회 계약 최소 물량 월 300kg. 수거 요일 화.");
  await v.getByRole("button", { name: "고른 1줄 저장" }).click();
  await expect(v.getByText("아직 등록된 매입 기준이 없습니다.", { exact: false })).toHaveCount(0);
  steps.push("UI uploaded synthetic text permit and price table; operator confirmed extracted rows");

  await e.goto("/app");
  await e.getByLabel("무엇이 나오나요").fill("가상 PP 스프루");
  await e.getByLabel("한 달에 얼마나").fill("1000");
  await e.getByRole("button", { name: "폐기물 등록", exact: true }).click();
  await expect(e.getByRole("button", { name: "받아 줄 곳 찾기" })).toBeVisible();
  await e.goto("/app/materials");
  await expect(e.getByText("기존 처리 방법과 단가를 확인해야", { exact: false })).toBeVisible();
  await e.getByLabel("지금 어떻게 처리하나요").fill("소각");
  await e.getByLabel("kg당 내는 돈").fill("250");
  await e.getByRole("button", { name: "저장", exact: true }).first().click();
  await expect(e.getByText("저장했습니다.", { exact: true })).toBeVisible();
  await e.getByText("측정값", { exact: true }).click();
  await e.getByLabel("오염도").fill("1");
  await e.getByLabel("수분").fill("0.3");
  await e.getByLabel("공정", { exact: true }).fill("사출");
  await e.getByRole("button", { name: "측정값 등록", exact: true }).click();
  await expect(e.getByText("측정값을 등록했습니다.", { exact: false })).toBeVisible();
  await e.getByText("비용", { exact: true }).click();
  await e.getByLabel("한 달 작업 시간").fill("0");
  await e.getByRole("button", { name: "저장", exact: true }).last().click();
  await expect(e.getByText("저장했습니다. 다음에 찾을 때부터 계산에 넣습니다.")).toBeVisible();
  await e.goto("/app");
  await e.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await expect(e.getByRole("button", { name: /매입 조건 확인 필요/ }).first()).toBeVisible({ timeout: 60000 });
  assert.doesNotMatch(await e.locator("body").innerText(), /이 배정이 탄소도 가장 많이 줄입니다/);
  await e.getByRole("button", { name: /매입 조건 확인 필요/ }).first().click();
  await e.getByLabel("원문에 있음", { exact: true }).check();
  await e.getByLabel("업종·처리 방법 맞음", { exact: true }).check();
  await e.getByRole("button", { name: "대조 결과 기록" }).click();
  await expect(e.getByText("허가증 대조 완료", { exact: true }).first()).toBeVisible();
  steps.push("UI waste, costs, synthetic quality inputs, rule negotiation and permit comparison recorded");
  await e.goto("/app/approval");
  await e.getByLabel(/확인할 것 \d+가지를 읽고 확인했습니다/).check();
  await e.getByRole("button", { name: "승인", exact: true }).click();
  await expect(e.getByText("배출 기업 승인함", { exact: true })).toBeVisible();
  await expect(e.getByText("아직 만들어진 서류가 없습니다.", { exact: false })).toBeVisible();
  await v.goto("/app/approval");
  await v.getByLabel(/확인할 것 \d+가지를 읽고 확인했습니다/).check();
  await v.getByRole("button", { name: "승인", exact: true }).click();
  await expect(v.getByText("처리 업체 승인함", { exact: true })).toBeVisible();
  await expect(v.getByRole("button", { name: "새 반입 기록", exact: true })).toBeVisible();
  const documents = await v.locator("body").innerText();
  assert.ok(documents.includes("요청서") && documents.includes("이행 계획서") && documents.includes("위탁 계약서 초안"));
  assert.ok((documents.match(/운반비 단가 포함/g) || []).length >= 3);
  assert.doesNotMatch(documents, /다음 등급|현행 처리 단가가 없어/);
  steps.push("One approval left transaction pending; both approvals generated three consistent draft documents");
  await v.getByLabel("실제 등급").selectOption("A");
  await v.getByLabel("실제 단가", { exact: true }).fill("330");
  await v.getByLabel("실제 중량 (kg)").fill("900");
  await v.getByLabel("실제 처리 방식").selectOption("재활용");
  await v.getByLabel("계량표 번호 (선택)").fill("LOCAL-TEST-001");
  await v.getByRole("button", { name: "새 반입 기록", exact: true }).click();
  await v.getByRole("button", { name: "정정", exact: true }).click();
  await v.getByLabel("실제 중량 (kg)").first().fill("920");
  await v.getByLabel("정정 사유").fill("가상 계량표 오기 수정");
  await v.getByRole("button", { name: "정정 기록", exact: true }).click();
  await expect(v.getByText("정정 전 900 kg", { exact: true })).toBeVisible().catch(async () => {
    await expect(v.getByText("920 kg", { exact: true }).first()).toBeVisible();
  });
  await e.goto("/app/report");
  await expect(e.getByRole("button", { name: "303,600원", exact: true })).toBeVisible();
  await expect(e.getByText("산정 보류", { exact: true })).toBeVisible();
  await expect(e.getByText("정정 전 900 kg", { exact: true })).toBeVisible();
  const downloading = e.waitForEvent("download");
  await e.getByRole("button", { name: "CSV 내려받기" }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  assert.match(csv, /,920,330,303600,,계산하지 않음/);
  assert.match(csv, /1판 중량 900kg/);
  assert.match(csv, /가상 계량표 오기 수정/);
  steps.push("Inspection 900kg -> corrected 920kg; report and CSV both 303600 KRW, carbon held, original revision retained");
  const emitterOrg = (await (await e.request.get("/api/v3/orgs")).json())[0].id;
  assert.ok([403,404].includes((await v.request.get(`/api/v3/orgs/${emitterOrg}/streams`)).status()));
  steps.push("Vendor account denied emitter's private stream endpoint");
  console.log(JSON.stringify({ status: "passed", mode: "local BFF; rule model; synthetic text documents; browser UI", screenshots: false, steps }, null, 2));
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
