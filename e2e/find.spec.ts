/**
 * 배출 기업 담당자가 들어와서 받아 줄 곳을 찾고, 양쪽이 승인해 서류가 만들어지기까지. 체험하기와 회사 묶기도 본다.
 * 회사·업체·단가·물량은 모두 시연용 가상 데이터다. 금액은 시드가 바뀌면 달라지므로 값이 아니라 모양을 본다.
 *
 * 프런트는 통로(/api/v3)를 거쳐 백엔드 로컬 서버(header 모드)를 부른다. 로그인은 개발용 빠른 로그인(AUTH_DEV_LOGIN)으로 하고,
 * 이 계정은 시연 데이터의 모든 회사에 속한 것으로 보므로 사이드바의 "회사"에서 바꿔 가며 양쪽을 시험한다.
 * 이메일·비밀번호 가입은 백엔드 계정 API가 있을 때만 돈다(E2E_ACCOUNTS=1).
 */
import { expect, test, type Page } from "@playwright/test";
import demoView from "../src/lib/v3/fixture-data/view.json";
import circularFixture from "../tests/fixtures/v3-circular.json";
import complexFixture from "../tests/fixtures/v3-complex.json";

const API = (process.env.E2E_API ?? "http://localhost:8000/api/v3").replace(/\/$/, "");
const WON = /[+−-]?\d{1,3}(,\d{3})*원/;
/** 백엔드가 bff 모드(계정 API)로 떠 있으면 1. 개발용 로그인은 bff가 아닐 때만 켜지므로 그 검사들은 건너뛴다 */
const BFF = process.env.E2E_ACCOUNTS === "1";

async function signIn(page: Page) {
  await page.goto("/login?callbackUrl=/app");
  if (!/\/login/.test(new URL(page.url()).pathname)) return; // 이미 들어와 있다
  await page.getByText("개발용 빠른 로그인").click();
  await page.getByLabel("이름", { exact: true }).fill("김담당");
  await page.getByLabel("업무용 이메일").fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "개발용 계정으로 들어가기" }).click();
  await page.waitForURL(/\/app$/);
}

/** 사이드바의 회사 바꾸기. 세션의 활성 회사를 바꾸고 화면을 다시 그린다. */
async function pickOrg(page: Page, orgId: string) {
  const select = page.getByRole("combobox", { name: "회사" });
  await expect(select).toBeVisible();
  if ((await select.inputValue()) === orgId) return;
  await select.selectOption(orgId);
  // 세션을 고친 뒤 서버가 새 회사로 다시 그릴 때까지 기다린다
  await expect(page.locator(`[data-active-org="${orgId}"]`)).toBeVisible();
  await expect(select).toBeEnabled();
}

/**
 * 질문이 더 나오지 않을 때까지 답한다. 시연 담당자 답(백엔드 DEMO_ANSWERS)처럼 포장 필름 수분은 2, 현행 처리비는
 * kg당 250원으로 답하고 나머지는 모름이다. 현행 처리비를 모름으로 두면 가정값 없이 그 폐기물을 배정에서 뺀다.
 */
async function answerQuestions(page: Page) {
  const result = page.getByRole("region", { name: "결과" });
  for (let turn = 0; turn < 30; turn += 1) {
    if (await result.isVisible()) return;
    const film = page.getByLabel("포장 필름의 수분은 대략 몇 %인가요?");
    const cost = page.getByLabel(/지금 처리하는 데 kg당 얼마를 내고 계신가요/).first();
    if (await film.isVisible().catch(() => false)) {
      await film.fill("2");
      await film.press("Enter");
    } else if (await cost.isVisible().catch(() => false)) {
      await cost.fill("250");
      await cost.press("Enter");
    } else {
      const unknown = page.getByRole("button", { name: "모름" }).first();
      if (await unknown.isVisible().catch(() => false)) await unknown.click();
    }
    await page.waitForTimeout(700);
  }
  await expect(result).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  if (BFF) return; // bff 모드의 시연 되돌리기는 운영 계정만 부른다
  const reset = await request.post(`${API}/demo/reset`, { headers: { "X-Org-Id": "org_admin" } });
  expect(reset.ok(), "시연 데이터를 처음 상태로 되돌린다").toBeTruthy();
});

test("받아 줄 곳을 찾으면 폐기물마다 받는 곳, 조건, 한 달 차이가 나오고 숫자마다 근거가 열린다", async ({ page }) => {
  test.skip(BFF, "개발용 로그인은 bff 모드에서 꺼진다");
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  await expect(page.getByRole("heading", { name: "받아 줄 곳을 찾아볼까요?" })).toBeVisible();
  await page.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await expect(page.getByRole("heading", { name: /가지를 여쭙겠습니다/ })).toBeVisible();
  await answerQuestions(page);

  const result = page.getByRole("region", { name: "결과" });
  await expect(result.getByRole("heading", { level: 2 })).toContainText("처리 후보를 찾았습니다");
  const rows = result.getByRole("list", { name: "품목별 처리 후보" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  for (const name of ["불량 사출품", "포장 필름", "퍼지 덩어리", "스프루·런너"]) {
    await expect(rows.filter({ hasText: name })).toContainText(WON);
  }
  await expect(result.getByText("한 달 합계")).toBeVisible();
  // 원문 경계를 확인한 배출계수와 실제 운송 조건이 없으면 탄소는 0으로 두지 않고 산정 보류로 보인다
  await expect(result.getByRole("button", { name: /tCO2e\/월/ })).toHaveCount(0);
  const effects = page.getByRole("region", { name: "자원순환 효과" });
  await expect(effects.getByText("문헌·입력값 기반 추정").first()).toBeVisible();
  await expect(effects.getByText("폐기물마다 어떻게 순환하나요")).toHaveCount(0);
  await expect(effects.getByText("시나리오 비교")).toHaveCount(0);

  // 순비용의 내역: 매각 수익, 운반비, 전처리 인건비
  const sprue = rows.filter({ hasText: "스프루·런너" });
  await sprue.getByRole("button", { name: /매입표 기준 충족|매입 조건 확인 필요|계산 내역/ }).click();
  await expect(sprue.getByText("매각 수익")).toBeVisible();
  await expect(sprue.getByText("운반비", { exact: true })).toBeVisible();
  await expect(sprue.getByText("전처리 인건비")).toBeVisible();
  // 공정에서 나온 한 가지 재질이라 다시 넣는 길이 후보로 나온다
  await expect(sprue.getByText("공정에 다시 넣을 수 있는 후보입니다.")).toBeVisible();

  // 숫자를 누르면 근거가 열린다
  await sprue.getByRole("button", { name: /매입 kg당/ }).first().click();
  const evidence = page.getByRole("dialog", { name: "근거" });
  await expect(evidence).toBeVisible();
  // 패널 제목(값 이름). 계산 사슬의 "… 매입 단가 계산" 제목과 가르려고 이름을 정확히 맞춘다
  await expect(evidence.getByRole("heading", { name: "매입 단가", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // 분리 개선 안내: 더 받는 기준과 한 달 차이(근거가 열린다), 섞인 재질을 나누면 받는 곳
  const improve = page.getByRole("region", { name: "분리 개선 안내" });
  await expect(improve.getByRole("heading", { level: 2 })).toContainText("한 달 손익이 나아지는 폐기물");
  await expect(improve.getByText("더 받는 길 있음").first()).toBeVisible();
  await expect(improve.getByText("재질별로 따로 모으면 이렇게 받습니다.")).toBeVisible();
  await improve.getByRole("button", { name: /^\+[\d,]+원/ }).first().click();
  await expect(evidence.getByRole("heading", { name: /분리 개선 뒤 한 달 차이 계산/ })).toBeVisible();
});

test("배출 기업과 처리 업체가 모두 승인하면 요청서, 이행 계획서, 위탁 계약서 초안이 만들어진다", async ({ page }) => {
  test.skip(BFF, "개발용 로그인은 bff 모드에서 꺼진다");
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  await page.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await answerQuestions(page);
  // 계약 검토 담당이 합의 조건을 대조했고, 확인할 것을 읽고 확인해야 승인 단추가 켜진다(안전장치)
  const approveAll = page.getByRole("button", { name: "승인하고 진행" });
  await expect(page.getByText(/승인 전에 두 AI가 합의한 조건을 항목마다 다시 대조했습니다/)).toBeVisible();
  await expect(approveAll).toBeDisabled();
  await page.getByLabel("계약 검토의 확인할 것을 읽고 확인했습니다").check();
  // 허가증 원문 대조가 끝나지 않은 합의(시연 시드의 남해열분해·미소환경)는 이 단추로 승인하지 않고 보류로 남는다
  await approveAll.click();
  await expect(page.getByRole("heading", { name: /승인을 기다리고 있습니다/ })).toBeVisible();

  for (const vendor of ["org_saegil", "org_namhae", "org_miso"]) {
    await pickOrg(page, vendor);
    await page.getByRole("link", { name: "승인·서류" }).click();
    await expect(page.getByRole("heading", { name: "승인·서류" })).toBeVisible();
    const approve = page.getByRole("button", { name: "승인", exact: true });
    await expect(approve.first()).toBeVisible();
    if (vendor === "org_miso") {
      // 시연 시드의 미소환경은 노선 밖 운반비가 정해지지 않았다. 계약 검토 담당이 필수 운반비 미정으로 막아
      // 양쪽 모두 승인할 수 없다(견적이 오기 전에는 확정하지 않는다)
      await expect(page.getByText(/필수 운반비가 미정입니다/).first()).toBeVisible();
      await expect(page.getByText(/막힌 항목이 풀릴 때까지 양쪽 모두 승인할 수 없습니다/).first()).toBeVisible();
      await expect(approve.first()).toBeDisabled();
      continue;
    }
    while ((await approve.count()) > 0) {
      // 업체 쪽도 계약 검토의 확인할 것을 확인해야 승인할 수 있다
      const ack = page.getByLabel(/확인할 것 \d+가지를 읽고 확인했습니다/).first();
      if (await ack.isVisible().catch(() => false)) await ack.check();
      await expect(approve.first()).toBeEnabled();
      await approve.first().click();
      await page.waitForTimeout(800);
    }
  }

  await pickOrg(page, "org_hanbit");
  const documents = page.locator("section").filter({ has: page.getByRole("heading", { name: "요청서 · 이행 계획서 · 계약서 초안" }) });
  await expect(documents.getByRole("article").first()).toBeVisible();
  await expect(documents.getByText("근거 확인됨").first()).toBeVisible();
  await expect(documents.getByText("근거 확인에 실패한 문서입니다")).toHaveCount(0);
  // 계약 검토 담당이 쓴 계약서 초안: 서명 전에 법무 검토가 필요하다고 적는다
  await expect(documents.getByRole("heading", { name: /^위탁 계약서 초안/ }).first()).toBeVisible();
  await expect(documents.getByText(/서명하기 전에 양쪽의 법무 검토/).first()).toBeVisible();

  // 확정한 합의는 실적 화면에 한 달 예상으로 보인다(검수 기록 전이라 합계는 없다)
  await page.getByRole("link", { name: "실적" }).click();
  await expect(page.getByRole("heading", { name: "재활용 실적" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "확정한 합의 · 한 달 예상" })).toBeVisible();
  // 합의의 이행 계획서: 조건 변경은 양쪽 승인 뒤 적용한다. 승인 기록이 있는 시세 변동 폭이 없으면 단가 재협의
  // 폭을 계약에 넣지 않는다(근거 없는 정책값을 쓰지 않는다)
  await page.getByRole("button", { name: "합의 조건과 이행 계획서 보기" }).click();
  await expect(page.getByRole("heading", { name: "승인·서류" })).toBeVisible();
  await expect(page.getByText(/양쪽 담당자가 새 조건을 승인한 뒤에 적용합니다/).first()).toBeVisible();
  await expect(page.getByText(/넘게 오르거나 내리면 단가를 다시 협의합니다/)).toHaveCount(0);
});

test("처리 업체에는 배출 기업의 현행 처리비와 다른 업체의 조건이 보이지 않는다", async ({ page, request }) => {
  test.skip(BFF, "개발용 로그인은 bff 모드에서 꺼진다");
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  await page.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await answerQuestions(page);

  // 같은 찾기를 업체가 받아 본다(화면이 그리는 것과 같은 응답)
  const sessions = await request.get(`${API}/sessions`, { headers: { "X-Org-Id": "org_saegil" } });
  expect(sessions.ok()).toBeTruthy();
  const list = (await sessions.json()) as { id: string }[];
  expect(list.length).toBeGreaterThan(0);
  const view = await request.get(`${API}/sessions/${list[list.length - 1].id}`, { headers: { "X-Org-Id": "org_saegil" } });
  const text = await view.text();
  expect(text).not.toContain("costInputs");
  expect(text).not.toContain("남해열분해");
  expect(text).not.toContain("미소환경");
  const body = JSON.parse(text) as { streams: { currentTreatment: unknown }[]; result: { assignments: { reuse: unknown; monthlyNow: unknown }[] } };
  expect(body.streams.every((stream) => stream.currentTreatment === null)).toBeTruthy();
  expect(body.result.assignments.every((item) => item.reuse === null && item.monthlyNow === null)).toBeTruthy();

  // 화면에서도 업체로 바꾸면 한 달 차이와 현행 처리비가 나오지 않는다
  await pickOrg(page, "org_saegil");
  await expect(page.getByText(/에서 폐기물 \d+가지를 문의했습니다/)).toBeVisible();
  // 사이드바의 회사 목록(개발용 계정은 모든 회사에 속한다)은 빼고 본문만 본다
  const main = page.getByRole("main");
  await expect(main.getByText("지금은 한 달에")).toHaveCount(0);
  await expect(main.getByText("남해열분해")).toHaveCount(0);

  // 다른 기기에서 들어온 업체 담당자도(이 기기에 적어 둔 찾기 번호가 없어도) 받은 문의가 바로 열린다
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith("rsai-v3-session")) window.localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.getByText(/에서 폐기물 \d+가지를 문의했습니다/)).toBeVisible();
});

test("통로는 세션의 회사로만 부른다: 다른 회사 주소와 바꿔 보낸 X-Org-Id는 통하지 않는다", async ({ page }) => {
  test.skip(BFF, "개발용 로그인은 bff 모드에서 꺼진다");
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  const other = await page.request.get("/api/v3/orgs/org_saegil/streams");
  expect(other.status()).toBe(403);
  expect((await other.json()).error.code).toBe("ORG_MISMATCH");
  // 머리글을 바꿔 보내도 세션의 회사(한빛정밀)의 폐기물이 온다
  const mine = await page.request.get("/api/v3/orgs/org_hanbit/streams", { headers: { "X-Org-Id": "org_saegil" } });
  expect(mine.ok()).toBeTruthy();
  const streams = (await mine.json()) as { orgId: string }[];
  expect(streams.length).toBeGreaterThan(0);
  expect(streams.every((item) => item.orgId === "org_hanbit")).toBeTruthy();
  // 로그인하지 않으면 통로를 지나가지 못한다
  const anonymous = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin });
  const denied = await anonymous.request.get("/api/v3/sessions");
  expect(denied.status()).toBe(401);
  await anonymous.close();
});

test("체험하기는 로그인 없이 시연 회사를 읽기 전용으로 보여 준다", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /체험하기/ }).click();
  await page.waitForURL(/\/demo$/);
  await expect(page.getByText("둘러보기 전용입니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "가입하기" })).toBeVisible();
  // 쓰기는 백엔드에 닿기 전에 막힌다
  const write = await request.post("/api/v3-demo/sessions", { data: {} });
  expect(write.status()).toBe(403);
  expect((await write.json()).error.code).toBe("DEMO_READ_ONLY");
  // 승인·찾기·저장 단추는 없거나 꺼져 있다
  await expect(page.getByRole("button", { name: "승인하고 진행" })).toHaveCount(0);
  const find = page.getByRole("button", { name: "받아 줄 곳 찾기" });
  if ((await find.count()) > 0) await expect(find).toBeDisabled();
});

test("체험 결과에서 매입 기준, 수거 확인, 반입 검수와 승인을 따로 표시한다", async ({ page }) => {
  const view = structuredClone(demoView);
  const defectApproval = view.approvals.find((item) => item.streamIds.includes("st_defect"));
  if (!defectApproval) throw new Error("시연 데이터에 불량품 승인 상태가 있어야 합니다.");
  defectApproval.emitter = true;
  const purgeThreadId = view.result.assignments.find((item) => item.streamId === "st_purge")?.threadId;
  view.approvals = view.approvals.filter((item) => item.threadId !== purgeThreadId);
  view.threads = view.threads.filter((item) => item.id !== purgeThreadId);

  await page.route("**/api/v3-demo/sessions", (route) => route.fulfill({ json: [view.session] }));
  await page.route(`**/api/v3-demo/sessions/${view.session.id}`, (route) => route.fulfill({ json: view }));
  await page.goto("/demo");

  const result = page.getByRole("region", { name: "결과" });
  await expect(result.getByRole("heading", { level: 2 })).toHaveText("4개 품목의 처리 후보를 찾았습니다");
  const sprue = result.getByRole("list", { name: "품목별 처리 후보" }).getByRole("listitem").filter({ hasText: "스프루·런너" });
  await expect(sprue).toContainText("한 달 600 kg");
  await expect(sprue).toContainText("+354,000원");
  await expect(sprue).toContainText("매입표 기준 충족");
  await expect(sprue).toContainText("업체 수거 확인 전");
  await expect(sprue).toContainText("양측 승인 전");
  await expect(sprue).toContainText("화·목 수거 일정을 업체에 확인");
  const conditional = result.getByRole("list", { name: "품목별 처리 후보" }).getByRole("listitem").filter({ hasText: "불량 사출품" });
  await expect(conditional).toContainText("매입 조건 확인 필요");
  await expect(conditional).toContainText("반입 검수 필요");
  await expect(conditional).toContainText("배출 기업 승인 완료 · 업체 승인 전");
  const unknown = result.getByRole("list", { name: "품목별 처리 후보" }).getByRole("listitem").filter({ hasText: "퍼지 덩어리" });
  await expect(unknown).toContainText("양측 승인 상태 확인 필요");
  await expect(unknown).toContainText("수거 가능 여부와 일정을 업체에 확인");
  await expect(result).not.toContainText("인수 확정");

  await sprue.getByRole("button", { name: /매입 kg당 340원/ }).click();
  await expect(page.getByRole("dialog", { name: "근거" })).toBeVisible();
});

test("배정할 곳이 없으면 현행 비용만 보여 주고 공개 명부는 접어 둔다", async ({ page }) => {
  const base = structuredClone(demoView);
  const view = {
    ...base,
    session: { ...base.session, status: "idle", phase: "done" },
    approvals: [],
    threads: [],
    result: {
      ...base.result,
      circular: circularFixture.circular,
      complexPartners: complexFixture.complexPartners,
      greenest: { ...base.result.greenest, same: true, changes: [] },
      assignments: base.result.assignments.map((item) => ({
        ...item, vendorOrgId: null, vendorName: null, threadId: null, route: "keep", unitPrice: null,
      })),
      totals: { ...base.result.totals, monthlyAfter: base.result.totals.monthlyNow },
    },
  };
  await page.route("**/api/v3-demo/sessions", (route) => route.fulfill({ json: [view.session] }));
  await page.route(`**/api/v3-demo/sessions/${view.session.id}`, (route) => route.fulfill({ json: view }));
  await page.goto("/demo");

  const result = page.getByRole("region", { name: "결과" });
  await expect(result.getByRole("heading")).toHaveText("처리 후보를 찾지 못했습니다");
  await expect(result).toContainText("지금은 한 달에");
  await expect(result).toContainText("지금 방식 그대로");
  await expect(result).not.toContainText(/이대로 바꾸면|한 달 차이|한 달 합계|탄소도 가장 많이/);
  await expect(page.getByRole("region", { name: "자원순환 효과" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "처리 흐름" })).toHaveCount(0);

  const directory = page.getByRole("heading", { name: "녹산국가산업단지 공개 명부 참고" });
  await expect(directory).toBeHidden();
  await page.getByText("공개 명부에서 문의할 곳 보기", { exact: true }).click();
  await expect(directory).toBeVisible();
});

test("이메일로 가입하면 회사를 등록하고 빈 상태에서 폐기물 등록으로 시작한다", async ({ page }) => {
  test.skip(!BFF, "백엔드 계정 API(bff)가 있을 때만 돈다");
  await page.goto("/signup");
  await page.getByLabel("이름", { exact: true }).fill("김담당");
  await page.getByLabel("이메일", { exact: true }).fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("비밀번호", { exact: true }).fill("password123");
  await page.getByLabel("비밀번호 확인").fill("password123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("회사 이름").fill("(주)이투이정밀");
  await page.getByRole("button", { name: "등록하고 시작하기" }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "먼저 폐기물을 등록해 주세요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "폐기물 등록" })).toBeVisible();
});

test("처리 업체는 문서와 명부 결과 없이 품목과 건별 협의 기준을 저장할 수 있다", async ({ page, request }) => {
  test.skip(BFF, "개발용 로그인은 bff 모드에서 꺼진다");
  const orgId = "org_miso";
  const headers = { "X-Org-Id": orgId };
  const blank = await request.put(`${API}/vendors/${orgId}`, {
    headers,
    data: { permits: [], criteria: [] },
  });
  expect(blank.ok()).toBeTruthy();

  await signIn(page);
  await pickOrg(page, orgId);
  await page.getByRole("link", { name: "업체 정보 등록" }).click();
  await expect(page.getByRole("heading", { name: "업체 정보", exact: true })).toBeVisible();
  const permits = page.locator("section").filter({ has: page.getByRole("heading", { name: "허가 품목", exact: true }) });
  const criteria = page.locator("section").filter({ has: page.getByRole("heading", { name: "매입 기준표", exact: true }) });
  await expect(permits.getByLabel("허가증 업로드")).toBeEnabled();
  await expect(criteria.getByLabel("기준표 업로드")).toBeEnabled();

  await permits.getByRole("button", { name: "목록에서 선택" }).click();
  const search = permits.getByRole("searchbox", { name: "품목명 또는 분류코드 검색" });
  await search.fill("51-03-01");
  await permits.getByRole("checkbox", { name: /51-03-01 폐합성수지류/ }).check();
  await search.fill("플라스틱폐포장재");
  await permits.getByRole("checkbox", { name: /51-03-07 플라스틱폐포장재/ }).check();
  await permits.getByLabel(/51-03-01.*재질/).fill("PP");
  await permits.getByLabel(/51-03-07.*재질/).fill("LDPE");
  await permits.getByRole("button", { name: "허가 품목 저장" }).click();
  await expect(permits.getByText("담당자 입력 · 허가증 원본 확인 필요", { exact: true })).toHaveCount(2);
  await permits.getByRole("button", { name: "직접 입력", exact: true }).click();
  await permits.getByLabel("허가 품목명").fill("폐목재");
  await permits.getByRole("button", { name: "허가 품목 저장" }).click();
  await expect(permits.getByText("폐목재", { exact: true })).toBeVisible();

  await criteria.getByRole("button", { name: "매입 기준 추가" }).click();
  await expect(criteria.getByText("실제로 적용하는 조건인지 확인한 뒤 저장해 주세요.")).toBeVisible();
  await criteria.getByRole("combobox", { name: "재질", exact: true }).fill("PP");
  await criteria.getByRole("textbox", { name: "형태", exact: true }).fill("분쇄");
  await criteria.getByRole("combobox", { name: "등급", exact: true }).fill("B");
  await criteria.getByText("건별 협의", { exact: true }).click();
  await criteria.getByRole("button", { name: "고른 1줄 저장" }).click();
  await expect(criteria.getByRole("row").filter({ hasText: "담당자 견적 필요" })).toHaveCount(1);
  await page.reload();
  await expect(permits.getByText("담당자 입력 · 허가증 원본 확인 필요", { exact: true })).toHaveCount(3);
  await expect(criteria.getByRole("row").filter({ hasText: "담당자 견적 필요" })).toHaveCount(1);
  await expect(page.getByText("업체 정보 저장됨")).toBeVisible();
  await expect(page.getByText(/문의 후보군에 포함 · 실제 문의는 물량별/)).toBeVisible();
  await expect(page.getByText(/거래 확정은 물량별 허가증 원본/)).toBeVisible();

  const saved = await request.get(`${API}/vendors/${orgId}`, { headers });
  expect(saved.ok()).toBeTruthy();
  expect(await saved.json()).toMatchObject({
    criteria: [{ material: "PP", form: "분쇄", grade: "B", priceMode: "negotiated", unitPriceKrwPerKg: null }],
  });

  await permits.getByLabel("허가증 업로드").setInputFiles({
    name: "허가증.txt", mimeType: "text/plain",
    buffer: Buffer.from("폐기물처리업 허가증\n상호: (주)미소환경\n업종: 폐기물 종합재활용업\n영업대상 폐기물: 폐플라스틱(PS)"),
  });
  await permits.getByRole("checkbox", { name: /허가 품목.*확인/ }).first().check();
  await permits.getByRole("button", { name: "확인한 값 1개를 근거로 등록" }).click();
  await expect(permits.getByText("PS", { exact: true })).toBeVisible();
  await expect(permits.getByText("담당자 입력 · 허가증 원본 확인 필요", { exact: true })).toHaveCount(3);

  await criteria.getByLabel("기준표 업로드").setInputFiles({
    name: "매입 기준표.txt", mimeType: "text/plain",
    buffer: Buffer.from("재질\t형태\t등급\t매입 단가(원/kg)\nPS\t분쇄\tA\t125"),
  });
  await criteria.getByRole("button", { name: "고른 1줄 저장" }).click();
  await expect(criteria.getByLabel("PS A등급 분쇄 단가 (원/kg)")).toHaveValue("125");
  await expect(criteria.getByRole("row").filter({ hasText: "담당자 견적 필요" })).toHaveCount(1);
});
