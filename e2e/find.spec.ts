/**
 * 배출 기업 담당자가 들어와서 받아 줄 곳을 찾고, 양쪽이 승인해 서류가 만들어지기까지.
 * 회사·업체·단가·물량은 모두 시연용 가상 데이터다. 금액은 시드가 바뀌면 달라지므로 값이 아니라 모양을 본다.
 */
import { expect, test, type Page } from "@playwright/test";

const API = (process.env.E2E_API ?? "http://localhost:8000/api/v3").replace(/\/$/, "");
const WON = /[+−-]?\d{1,3}(,\d{3})*원/;

async function signIn(page: Page) {
  await page.goto("/login?callbackUrl=/app");
  if (!/\/login/.test(new URL(page.url()).pathname)) return; // 이미 들어와 있다
  await page.getByLabel("이름").fill("김담당");
  await page.getByLabel("업무용 이메일").fill(`e2e-${Date.now()}@example.com`);
  const agree = page.getByRole("checkbox");
  if ((await agree.count()) > 0 && !(await agree.first().isChecked())) await agree.first().check();
  await page.getByRole("button", { name: /시연용 계정으로/ }).click();
  await page.waitForURL(/\/(onboarding|app)/);
  if (/\/onboarding/.test(page.url())) {
    await page.getByLabel("회사 이름").fill("(주)한빛정밀");
    await page.getByRole("button", { name: "등록하고 시작하기" }).click();
    await page.waitForURL(/\/app$/);
  }
}

async function pickOrg(page: Page, orgId: string) {
  await page.getByLabel("시연 회사").selectOption(orgId);
}

/** 질문이 더 나오지 않을 때까지 답한다. 포장 필름 수분만 숫자로 답하고 나머지는 모름이다. */
async function answerQuestions(page: Page) {
  const result = page.getByRole("region", { name: "결과" });
  for (let turn = 0; turn < 30; turn += 1) {
    if (await result.isVisible()) return;
    const film = page.getByLabel("포장 필름의 수분은 대략 몇 %인가요?");
    if (await film.isVisible().catch(() => false)) {
      await film.fill("2");
      await film.press("Enter");
    } else {
      const unknown = page.getByRole("button", { name: "모름" }).first();
      if (await unknown.isVisible().catch(() => false)) await unknown.click();
    }
    await page.waitForTimeout(700);
  }
  await expect(result).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  const reset = await request.post(`${API}/demo/reset`, { headers: { "X-Org-Id": "org_admin" } });
  expect(reset.ok(), "시연 데이터를 처음 상태로 되돌린다").toBeTruthy();
});

test("받아 줄 곳을 찾으면 폐기물마다 받는 곳, 조건, 한 달 차이가 나오고 숫자마다 근거가 열린다", async ({ page }) => {
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  await expect(page.getByRole("heading", { name: "받아 줄 곳을 찾아볼까요?" })).toBeVisible();
  await page.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await expect(page.getByRole("heading", { name: /가지만 여쭤볼게요/ })).toBeVisible();
  await answerQuestions(page);

  const result = page.getByRole("region", { name: "결과" });
  await expect(result.getByRole("heading", { level: 2 })).toContainText("보낼 곳을 찾았습니다");
  const rows = result.getByRole("listitem");
  await expect(rows).toHaveCount(4);
  for (const name of ["불량 사출품", "포장 필름", "퍼지 덩어리", "스프루·런너"]) {
    await expect(rows.filter({ hasText: name })).toContainText(WON);
  }
  await expect(result.getByText("한 달 합계")).toBeVisible();
  // 탄소는 공식 배출계수로 계산한 값이 단위와 함께 나온다
  await expect(result.getByRole("button", { name: /tCO2e\/월/ })).toBeVisible();

  // 순비용의 내역: 매각 수익, 운반비, 전처리 인건비
  const sprue = rows.filter({ hasText: "스프루·런너" });
  await sprue.getByRole("button", { name: /조건 확정|조건 확인 뒤 확정|계산 내역/ }).click();
  await expect(sprue.getByText("매각 수익")).toBeVisible();
  await expect(sprue.getByText("운반비", { exact: true })).toBeVisible();
  await expect(sprue.getByText("전처리 인건비")).toBeVisible();
  // 공정에서 나온 한 가지 재질이라 다시 넣는 길이 후보로 나온다
  await expect(sprue.getByText("공정에 다시 넣을 수 있는 후보입니다.")).toBeVisible();

  // 숫자를 누르면 근거가 열린다
  await sprue.getByRole("button", { name: /매입 kg당/ }).click();
  const evidence = page.getByRole("dialog", { name: "근거" });
  await expect(evidence).toBeVisible();
  await expect(evidence.getByRole("heading", { name: "매입 단가" })).toBeVisible();
});

test("배출 기업과 처리 업체가 모두 승인하면 요청서와 이행 계획서가 만들어진다", async ({ page }) => {
  await signIn(page);
  await pickOrg(page, "org_hanbit");
  await page.getByRole("button", { name: "받아 줄 곳 찾기" }).click();
  await answerQuestions(page);
  await page.getByRole("button", { name: "승인하고 진행" }).click();
  await expect(page.getByRole("button", { name: "승인하고 진행" })).toBeHidden();

  for (const vendor of ["org_saegil", "org_namhae", "org_miso"]) {
    await pickOrg(page, vendor);
    await page.getByRole("link", { name: "승인·서류" }).click();
    await expect(page.getByRole("heading", { name: "승인·서류" })).toBeVisible();
    const approve = page.getByRole("button", { name: "승인", exact: true });
    await expect(approve.first()).toBeVisible();
    while ((await approve.count()) > 0) {
      await approve.first().click();
      await page.waitForTimeout(800);
    }
  }

  await pickOrg(page, "org_hanbit");
  const documents = page.locator("section").filter({ has: page.getByRole("heading", { name: "요청서와 이행 계획서" }) });
  await expect(documents.getByRole("article").first()).toBeVisible();
  await expect(documents.getByText("근거 확인됨").first()).toBeVisible();
  await expect(documents.getByText("근거 확인에 실패한 문서입니다")).toHaveCount(0);
});

test("처리 업체에는 배출 기업의 현행 처리비와 다른 업체의 조건이 보이지 않는다", async ({ page, request }) => {
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
  await expect(page.getByText("지금은 한 달에")).toHaveCount(0);
  await expect(page.getByText("남해열분해")).toHaveCount(0);

  // 다른 기기에서 들어온 업체 담당자도(이 기기에 적어 둔 찾기 번호가 없어도) 받은 문의가 바로 열린다
  await page.evaluate(() => window.localStorage.removeItem("rsai-v3-session"));
  await page.reload();
  await expect(page.getByText(/에서 폐기물 \d+가지를 문의했습니다/)).toBeVisible();
});
