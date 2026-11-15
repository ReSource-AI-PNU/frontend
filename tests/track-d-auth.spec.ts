import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.TRACK_D_AUTH_E2E !== "1",
  "PLATFORM_DEMO=false, AUTH_DEV_LOGIN=true인 로컬 검사 서버 전용",
);

test("로그인 조직 DB · 멤버 초대 · 역할 위조 차단", async ({
  page,
  browser,
  baseURL,
}) => {
  const suffix = Date.now().toString();
  const owner = `owner-${suffix}@example.com`,
    member = `member-${suffix}@example.com`;
  async function login(p: Page, email: string) {
    await p.goto("/login?callbackUrl=/join");
    await p.getByLabel("이름", { exact: true }).fill("권한 검사");
    await p.getByLabel("업무용 이메일", { exact: true }).fill(email);
    await p.getByRole("button", { name: "시연용 계정으로 로그인" }).click();
    await expect(p).toHaveURL((url) => url.pathname === "/join");
  }
  await login(page, owner);
  const org = await page.request.post("/api/platform/organizations", {
    headers: { Origin: baseURL! },
    data: {
      name: "권한 검사 회사",
      bizNo: suffix.slice(-10),
      industry: "제조",
      complexId: "noksan",
      role: "배출",
      wasteStreams: [],
      location: [128.8, 35.1],
    },
  });
  expect(org.ok(), await org.text()).toBeTruthy();
  const cid = (await org.json()).id;
  await page.goto("/settings/members");
  await page.getByLabel("초대 이메일").fill(member);
  await page.getByRole("button", { name: "초대 만들기" }).click();
  await expect(page.locator("code")).toBeVisible();
  const token = (await page.locator("code").textContent())!;
  const second = await browser.newContext({ baseURL });
  const memberPage = await second.newPage();
  try {
    await login(memberPage, member);
    await memberPage.getByLabel("초대 토큰").fill(token);
    await memberPage
      .getByRole("button", { name: "초대 수락", exact: true })
      .click();
    await expect(memberPage.getByRole("status")).toContainText(
      "초대를 수락했습니다",
    );
    await memberPage.goto("/settings");
    await expect(
      memberPage.getByLabel("회사 이름", { exact: true }),
    ).toHaveValue("권한 검사 회사");
    const profile = await memberPage.request.get("/api/platform/companies/me");
    expect(profile.ok()).toBeTruthy();
    const forged = await memberPage.request.put(
      `/api/platform/companies/${cid}`,
      {
        headers: {
          Origin: baseURL!,
          "X-Member-Role": "admin",
          "X-Demo-Role": "admin",
        },
        data: await profile.json(),
      },
    );
    expect(forged.status()).toBe(403);
    const cross = await memberPage.request.get("/api/platform/sessions", {
      headers: { "X-Company-Id": "noksan-001" },
    });
    expect(cross.status()).toBe(403);
  } finally {
    await second.close();
  }
});
