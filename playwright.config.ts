/**
 * 브라우저로 처음부터 끝까지 눌러 보는 검사(E2E).
 *
 * 백엔드는 표준 라이브러리 로컬 서버(app.v3.devserver, 규칙 정책, 가상 시연 데이터)를 쓴다. 모델과 Azure는 부르지 않는다.
 *   BACKEND_DIR=../backend npm run test:e2e
 * 이미 떠 있는 서버로 돌리려면 주소를 준다(서버를 새로 띄우지 않는다).
 *   E2E_BASE_URL=http://localhost:3000 E2E_API=http://localhost:8000/api/v3 npm run test:e2e
 */
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const external = Boolean(process.env.E2E_BASE_URL);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const backendDir = path.resolve(process.env.BACKEND_DIR ?? "../backend");
const python = process.env.PYTHON ?? "python3";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  // 시연 데이터를 되돌리며 도는 검사라 한 줄로 돌린다
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}) },
    },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: `${python} -m app.v3.devserver --port 8000`,
          cwd: backendDir,
          env: { PYTHONPATH: backendDir },
          url: "http://localhost:8000/api/v3/health",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // CI에서는 배포 이미지와 같은 방식(standalone의 server.js)으로 띄운다. 빌드와 정적 파일 복사는 CI 단계가 한다.
          command: process.env.CI ? "node .next/standalone/server.js" : "npm run dev",
          url: `${baseURL}/login`,
          env: {
            NEXT_PUBLIC_API_BASE: "http://localhost:8000/api/v3",
            AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-check-only-not-a-real-secret-0123456789",
            AUTH_TRUST_HOST: "true",
            AUTH_DEV_LOGIN: "true",
            AUTH_URL: baseURL,
            PORT: new URL(baseURL).port || "3000",
            HOSTNAME: "localhost",
          },
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
