import { test, expect } from "@playwright/test";

test("D 트랙: 저장 → 묶음 → 이웃 동의 → 모의 협상 → 승인", async ({ page }) => {
  await page.goto("/track-d");
  await expect(page.getByLabel("가상 기업").locator("option")).toHaveCount(30);
  await page.getByRole("button", { name: "가상 흐름으로 진단 시작" }).click();
  const area = page.getByRole("region", { name: "진단 작업" });
  await expect(area).toBeVisible();
  await page.getByRole("button", { name: "물량·출처 확인" }).click();
  await expect(page.getByRole("button", { name: "묶음 계산" })).toBeEnabled();
  await page.getByRole("button", { name: "묶음 계산" }).click();
  await expect(area.getByText("1,230kg", { exact: true })).toBeVisible();
  await expect(area.getByText("비공개", { exact: true })).toHaveCount(2);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "참여 제안 승인" }).click();
  await expect(area.getByText("회신 대기", { exact: true })).toHaveCount(2);
  for (const id of ["noksan-017", "noksan-018"]) {
    await page.getByLabel("가상 기업").selectOption(id);
    const reply = page
      .getByRole("button", { name: "참여 동의", exact: true })
      .last();
    await expect(reply).toBeVisible();
    await reply.click();
    await expect(reply).not.toBeVisible();
  }
  await page.getByLabel("가상 기업").selectOption("noksan-001");
  await expect(area.getByText("수거 조건 충족", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "모의 협상 시작" }).click();
  await expect(
    area.getByRole("heading", { name: "협상: 합의안 · 사람 승인 대기" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "합의안 승인", exact: true }).click();
  await expect(
    area.getByRole("heading", { name: "협상: 승인 완료" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    area.getByRole("heading", { name: "협상: 승인 완료" }),
  ).toBeVisible();
  await page.getByLabel("실행 명령").fill("승인하고 발송해 줘");
  await page.getByRole("button", { name: "명령 실행" }).click();
  await expect(
    page
      .getByText(
        "승인과 발송은 명령으로 실행하지 않습니다. 승인 버튼을 사용하세요.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/track-d-review.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("BFF는 다른 출처의 변경 요청과 임의 경로를 거부한다", async ({
  request,
}) => {
  const denied = await request.post("/api/platform/sessions", {
    headers: { Origin: "https://example.invalid" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  expect((await request.get("/api/platform/unknown")).status()).toBe(404);
  const outside = await request.get("/api/platform/sessions", {
    headers: {
      Host: "public.example",
      "X-Demo-Company": "noksan-001",
      "X-Member-Role": "admin",
    },
  });
  expect(outside.status()).toBe(401);
});

test("기존 진단 시작·목록·단계 경로에서 여러 흐름을 저장한다", async ({
  page,
}) => {
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "흐름 등록" })).toBeVisible();
  await page.getByLabel("흐름 1 이름", { exact: true }).fill("현장 PP 스프루");
  await page.getByLabel("발생 공정", { exact: true }).fill("사출 1라인");
  await page.getByLabel("재질", { exact: true }).fill("PP");
  await page.getByRole("button", { name: "흐름 추가", exact: true }).click();
  await page.getByLabel("흐름 2 이름", { exact: true }).fill("현장 포장 필름");
  await page.getByLabel("발생 공정", { exact: true }).nth(1).fill("원료 입고");
  await page.getByRole("button", { name: "입력한 흐름으로 진단 시작" }).click();
  await expect(page).toHaveURL(/\/session\/ses_.*\/classify$/);
  await expect(page.getByLabel("작업 흐름").locator("option")).toHaveCount(2);
  await page.getByLabel("작업 흐름").selectOption("stream-2");
  await page.getByLabel("월 발생량", { exact: true }).fill("450");
  await page.getByLabel("흐름 출처").selectOption("PCR");
  await page
    .getByRole("button", { name: "물량·출처 확인", exact: true })
    .click();
  await expect(
    page.getByText(/현장 포장 필름 · LDPE · PCR · 월 450kg · 물량 확인 완료/),
  ).toBeVisible();
  const url = page.url();
  await page.getByRole("link", { name: "진단 목록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "진단 목록", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(
    page.getByText(/현장 포장 필름 · LDPE · PCR · 월 450kg · 물량 확인 완료/),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/track-d-stages.png",
    fullPage: true,
  });
});

test("전체 단계는 이웃 동의를 기다리고 문서 승인 후 변경을 막는다", async ({
  page,
  request,
  baseURL,
}) => {
  const h = {
    Origin: baseURL!,
    "X-Demo-Company": "noksan-001",
    "X-Demo-Role": "admin",
  };
  async function api(path: string, body: object, company = "noksan-001") {
    const response = await request.post(`/api/platform/${path}`, {
      headers: { ...h, "X-Demo-Company": company },
      data: body,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const { demoInput } = await import("../src/lib/platform/client");
  const input = demoInput("noksan-001");
  input.streams[0].monthlyKgConfirmed = true;
  let state = await api("sessions", input);
  const sid = state.session.id;
  const progress = await api(`sessions/${sid}/advance`, {
    version: state.version,
    step: "proposal",
  });
  expect(progress.blockedStep).toBe("matching");
  state = progress.state;
  const bundle = state.bundles[0];
  state = await api(`sessions/${sid}/invites`, {
    version: state.version,
    bundleId: bundle.id,
    confirm: true,
  });
  for (const member of bundle.members.filter(
    (m: { state: string }) => m.state !== "self",
  )) {
    const reply = await api(
      `sessions/${sid}/bundles/${bundle.id}/reply`,
      { version: state.version, decision: "accepted" },
      member.companyId,
    );
    state.version = reply.version;
  }
  const ready = await api(`sessions/${sid}/advance`, {
    version: state.version,
    step: "proposal",
  });
  expect(ready.blockedStep).toBeNull();
  await page.goto(`/session/${sid}/proposal`);
  await expect(
    page.getByRole("heading", { name: "검토할 이행안" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "이행안 승인·동결" }),
  ).toBeDisabled();
  await page.getByLabel("문서와 수신인, 시나리오를 확인했습니다.").check();
  await page.getByRole("button", { name: "이행안 승인·동결" }).click();
  await expect(
    page.getByRole("button", { name: "물량·출처 확인" }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/승인 완료 · 시나리오 A/)).toBeVisible();
  await page.getByRole("button", { name: "발송 상태 조회" }).click();
  await expect(
    page.getByRole("button", { name: "승인 문서 외부 발송·재확인" }),
  ).toHaveCount(0);
});

test("기존 이웃·업체·프로필 화면이 백엔드 연결 화면을 연다", async ({
  page,
}) => {
  for (const [path, title] of [
    ["/neighbor", "이웃 기업 수신함"],
    ["/vendor", "수거 업체 수신함"],
    ["/settings", "회사 설정"],
    ["/settings/members", "회사 멤버"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/settings");
  await expect(page.getByLabel("회사 이름", { exact: true })).not.toHaveValue(
    "",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
