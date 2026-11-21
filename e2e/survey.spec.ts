import { expect, test, type Page } from "@playwright/test";
const API = process.env.E2E_API ?? "http://localhost:8000/api/v3";
async function signIn(page: Page) {
  await page.goto("/login?callbackUrl=/app");
  await page.getByText("개발용 빠른 로그인").click();
  await page.getByLabel("이름", { exact: true }).fill("설문 검증 담당");
  await page
    .getByLabel("업무용 이메일")
    .fill(`survey-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "개발용 계정으로 들어가기" }).click();
  await page.waitForURL(/\/app$/);
}
async function company(page: Page, id: string) {
  const select = page.getByRole("combobox", { name: "회사" });
  await select.selectOption(id);
  await expect(page.locator(`[data-active-org="${id}"]`)).toBeVisible();
  await expect(select).toBeEnabled();
  await page.goto("/app/conditions");
  await expect(
    page.getByRole("heading", { name: "단가·사전 문의", exact: true }),
  ).toBeVisible();
}
test("공개 범위 등록 → 사진 선택 공유 → 범위 좁힘 → 단일 제안 수락", async ({
  page,
  request,
}) => {
  test.skip(process.env.E2E_ACCOUNTS === "1", "가상 회사 개발용 로그인 검사");
  expect(
    (
      await request.post(`${API}/demo/reset`, {
        headers: { "X-Org-Id": "org_admin" },
      })
    ).ok(),
  ).toBeTruthy();
  await signIn(page);
  await company(page, "org_saegil");
  await page.getByLabel("수거 판단 기준").selectOption("distance_vehicle");
  const group = page.getByRole("group", { name: "PP · A", exact: true });
  await group.getByLabel("공개 범위 하한 (원/kg)").fill("300");
  await group.getByLabel("공개 범위 상한 (원/kg)").fill("340");
  await page.getByRole("button", { name: "공개 조건 저장" }).click();
  await expect(
    page.getByText("공개할 조건을 저장했습니다.", { exact: false }),
  ).toBeVisible();
  await company(page, "org_hanbit");
  const candidate = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: /스프루·런너 →/ }) });
  await expect(candidate).toContainText("300~340원/kg");
  await candidate
    .getByRole("button", { name: "이 조건으로 사전 문의" })
    .click();
  const quote = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "스프루·런너 · (주)새길자원",
        exact: true,
      }),
    });
  await expect(quote).toContainText("범위 확인 중");
  await page.getByLabel("사진을 올릴 폐기물").selectOption("st_sprue");
  await page
    .getByLabel("사진 올리기", { exact: true })
    .setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    page.getByRole("button", { name: "사진 공유 대상 저장" }),
  ).toBeVisible();
  await page.getByLabel("(주)새길자원", { exact: true }).check();
  await page.getByRole("button", { name: "사진 공유 대상 저장" }).click();
  await company(page, "org_saegil");
  await page.getByRole("button", { name: "사진 보기", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "수거 전 확인을 위해 공유한 폐기물 사진" }),
  ).toBeVisible();
  await page.getByLabel("새 하한 (원/kg)").fill("310");
  await page.getByLabel("새 상한 (원/kg)").fill("330");
  await page.getByLabel("재질 자료 확인", { exact: true }).check();
  await page
    .getByLabel("확인 내용·범위를 좁힌 이유")
    .fill("원자재 명세와 사진을 확인했습니다.");
  await page.getByRole("button", { name: "확인한 범위 제안" }).click();
  await expect(quote).toContainText("310~330원/kg");
  await page.getByLabel("새 하한 (원/kg)").fill("325");
  await page.getByLabel("새 상한 (원/kg)").fill("325");
  await page.getByLabel("품질·검수 조건 확인", { exact: true }).check();
  await page.getByLabel("수거·운반비 조건 확인", { exact: true }).check();
  await page
    .getByLabel("확인 내용·범위를 좁힌 이유")
    .fill("반입 검수와 단가 포함 운반 조건을 확인했습니다.");
  await page.getByRole("button", { name: "확인한 범위 제안" }).click();
  await expect(quote).toContainText("단일 단가 제안");
  await company(page, "org_hanbit");
  await page.getByRole("button", { name: "이 단가 제안 수락" }).click();
  await expect(quote).toContainText("제안 수락 · 거래 확정 전");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/resource-analysis/survey-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/resource-analysis/survey-mobile.png",
    fullPage: true,
  });
});

test("기존 계량 CSV를 품질 수치 없이 월별로 합산하고 재업로드는 중복 처리한다", async ({
  page,
  request,
}) => {
  test.skip(process.env.E2E_ACCOUNTS === "1", "가상 회사 개발용 로그인 검사");
  expect(
    (
      await request.post(`${API}/demo/reset`, {
        headers: { "X-Org-Id": "org_admin" },
      })
    ).ok(),
  ).toBeTruthy();
  await signIn(page);
  await company(page, "org_hanbit");
  await page.getByLabel("합산할 월").fill("2026-11");
  const f = {
    name: "weigh.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "계량번호,폐기물 이름,계량일,중량(kg)\nS001,스프루·런너,2026-11-01,800\nS002,스프루·런너,2026-10-31,200\n",
    ),
  };
  await page.getByLabel("계량 CSV", { exact: true }).setInputFiles(f);
  await expect(page.getByRole("status")).toContainText("새 기록 1건");
  await page.getByLabel("계량 CSV", { exact: true }).setInputFiles(f);
  await expect(page.getByRole("status")).toContainText("이미 등록된 기록 1건");
  const streams = await (
    await request.get(`${API}/orgs/org_hanbit/streams`, {
      headers: { "X-Org-Id": "org_hanbit" },
    })
  ).json();
  const s = streams.find((s: { id: string }) => s.id === "st_sprue");
  expect(s.monthlyKg).toBe(800);
  expect(s.measure.contaminationPct).toBe(1);
});
