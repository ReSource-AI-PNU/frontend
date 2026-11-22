import { expect, test } from '@playwright/test';
const API = process.env.E2E_API || 'http://localhost:8000/api/v3';
const headers = { 'X-Org-Id': 'org_hanbit' };
test('조건 비교는 원본을 보존하고 적용하면 새 재협상과 알림으로 연결된다', async ({ page, request }) => {
  await request.post(`${API}/demo/reset`, { headers: { 'X-Org-Id': 'org_admin' } });
  let v = await (await request.post(`${API}/sessions`, { headers, data: {} })).json();
  const source = v.session.id;
  for (let i=0; i<5; i++) {
    v = await (await request.post(`${API}/sessions/${source}/run`, { headers })).json();
    if (v.session.status !== 'awaiting_answers') break;
    for (const q of v.questions.filter((q: { answered: boolean }) => !q.answered)) {
      const value = q.field === 'currentCost' ? 250 : q.streamId === 'st_film' && q.field === 'moisturePct' ? 2 : 'unknown';
      await request.post(`${API}/sessions/${source}/answers`, { headers, data: { questionId: q.id, value } });
    }
  }
  await page.goto('/login?callbackUrl=/app');
  await page.getByText('개발용 빠른 로그인').click();
  await page.getByLabel('이름', { exact: true }).fill('조건비교 담당자');
  await page.getByLabel('업무용 이메일').fill('adaptive@example.com');
  await page.getByRole('button', { name: '개발용 계정으로 들어가기' }).click();
  await page.waitForURL(/\/app$/);
  const org = page.getByRole('combobox', { name: '회사' });
  await org.selectOption('org_hanbit');
  await expect(page.locator('[data-active-org="org_hanbit"]')).toBeVisible();
  await page.getByRole('button', { name: /이어서|지난|이전/ }).first().click();
  await page.getByText('조건을 바꿔 비교하기', { exact: true }).click();
  await page.getByLabel('비교할 폐기물').selectOption('st_sprue');
  await page.getByLabel('비교할 월 발생량').fill('800');
  await page.getByRole('button', { name: '대안 계산', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 조건으로 재협상' })).toBeEnabled();
  const streams = await (await request.get(`${API}/orgs/org_hanbit/streams`, { headers })).json();
  expect(streams.find((s: { id: string }) => s.id === 'st_sprue').monthlyKg).toBe(600);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('region', { name: '조건 변경과 대안 비교' }).screenshot({ path: '/tmp/rs-adaptive-mobile-panel.png' });
  await page.getByRole('button', { name: '이 조건으로 재협상' }).click();
  await expect(page.getByText('새 조건으로 대안을 준비했습니다', { exact: true })).toBeVisible({ timeout: 60000 });
  const change = await (await request.get(`${API}/sessions/${source}/adaptive`, { headers })).json();
  expect(change.change.sessionId).not.toBe(source);
  const result = await (await request.get(`${API}/sessions/${change.change.sessionId}`, { headers })).json();
  expect(result.documents).toHaveLength(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('region', { name: '조건 변경과 대안 비교' }).screenshot({ path: '/tmp/rs-adaptive-desktop-panel.png' });
  const profile = await (await request.get(`${API}/vendors/org_saegil`, { headers: { 'X-Org-Id': 'org_saegil' } })).json();
  profile.criteria.find((c: { id: string }) => c.id === 'pc_saegil_pp_a').minMonthlyKg = 9999;
  await request.put(`${API}/vendors/org_saegil`, { headers: { 'X-Org-Id': 'org_saegil' }, data: { criteria: profile.criteria } });
  await expect(page.getByRole('button', { name: '새 대안과 진행 보기' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: '새 대안과 진행 보기' }).click();
  await expect(page.getByText('새 조건으로 대안을 준비했습니다', { exact: true })).toBeVisible({ timeout: 60000 });
});
