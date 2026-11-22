/**
 * 웹을 휴대폰에 설치(PWA): manifest(src/app/manifest.ts), 아이콘(public/icons), 서비스 워커(public/sw.js).
 * 서비스 워커는 정적 파일만 캐시하고 화면 이동·API·데이터는 건드리지 않는지 본다.
 * 실행: node --test tests/pwa.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import manifest, { PWA_COLORS } from "../src/app/manifest.ts";

const root = new URL("../", import.meta.url);

/** PNG 머리(IHDR)에서 너비·높이 */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(new URL(path, root));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("manifest: 이름, /app에서 시작, 독립 창, 토큰 색", () => {
  const m = manifest();
  assert.equal(m.name, "BYPRO");
  assert.ok(m.short_name && m.short_name.length <= 12);
  assert.equal(m.start_url, "/app");
  assert.equal(m.display, "standalone");
  assert.equal(m.lang, "ko");
  // 색은 DESIGN.md 토큰(globals.css의 라이트 --color-bg)과 같다
  const css = readFileSync(new URL("src/app/globals.css", root), "utf8");
  const bg = css.match(/--color-bg:\s*(#[0-9a-f]{6})/i)?.[1]?.toLowerCase();
  assert.equal(m.background_color, bg);
  assert.equal(m.theme_color, bg);
  assert.deepEqual(PWA_COLORS, { background: bg, theme: bg });
});

test("아이콘: 192·512 일반과 maskable이 있고 크기가 맞다", () => {
  const icons = manifest().icons ?? [];
  for (const purpose of ["any", "maskable"]) {
    for (const size of [192, 512]) {
      const icon = icons.find((item) => item.purpose === purpose && item.sizes === `${size}x${size}`);
      assert.ok(icon, `${purpose} ${size}`);
      assert.equal(icon.type, "image/png");
      const file = `public${icon.src}`;
      assert.ok(existsSync(new URL(file, root)), file);
      assert.deepEqual(pngSize(file), [size, size]);
    }
  }
});

type FakeRequest = { url: string; method: string; mode: string; headers: { get: (name: string) => string | null } };

type FakeResponse = { ok: boolean; type: string; headers: { get: (name: string) => string | null }; clone: () => FakeResponse; from: string };

/** public/sw.js를 가짜 self·캐시·네트워크에 올리고 fetch 처리기를 꺼낸다 */
function loadWorker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const stored = new Map<string, FakeResponse>();
  const response = (from: string, control = ""): FakeResponse => {
    const item: FakeResponse = { ok: true, type: "basic", headers: { get: (name) => (name === "cache-control" ? control : null) }, clone: () => item, from };
    return item;
  };
  const self = {
    location: { origin: "https://resource.example" },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    skipWaiting: () => undefined,
    clients: { claim: () => Promise.resolve() },
  };
  const cache = {
    match: async (request: FakeRequest) => stored.get(request.url),
    put: async (request: FakeRequest, value: FakeResponse) => {
      stored.set(request.url, value);
    },
  };
  const context = vm.createContext({
    self,
    URL,
    caches: { open: async () => cache, keys: async () => [] },
    fetch: async (request: FakeRequest) => response("network", request.url.includes("nostore") ? "no-store" : "public, max-age=31536000, immutable"),
  });
  vm.runInContext(readFileSync(new URL("public/sw.js", root), "utf8"), context);
  /** 요청 하나를 보내 본다. 서비스 워커가 맡으면 그 응답을, 맡지 않으면 null(브라우저가 네트워크로 보낸다) */
  const handle = async (request: Partial<FakeRequest> & { url: string }): Promise<FakeResponse | null> => {
    let answer: Promise<FakeResponse> | null = null;
    handlers.fetch({
      request: { method: "GET", mode: "no-cors", headers: { get: () => null }, ...request },
      respondWith: (value: Promise<FakeResponse>) => {
        answer = value;
      },
    });
    return answer ? await answer : null;
  };
  return { handlers, handle, stored };
}

test("서비스 워커: 빌드 산출물·글꼴·아이콘만 캐시하고, 두 번째부터는 캐시에서 준다", async () => {
  const { handlers, handle, stored } = loadWorker();
  assert.ok(handlers.install && handlers.activate && handlers.fetch);
  const origin = "https://resource.example";
  for (const path of ["/_next/static/chunks/app-1a2b.js", "/_next/static/css/x.css?dpl=1", "/fonts/PretendardVariable.woff2", "/icons/icon-192.png", "/icon.svg"]) {
    const first = await handle({ url: `${origin}${path}` });
    assert.equal(first?.from, "network", path);
    assert.ok(stored.has(`${origin}${path}`), path);
    const second = await handle({ url: `${origin}${path}` });
    assert.equal(second, stored.get(`${origin}${path}`));
  }
  // 서버가 저장하지 말라고 한 것은 넣지 않는다
  await handle({ url: `${origin}/_next/static/nostore.js` });
  assert.equal(stored.has(`${origin}/_next/static/nostore.js`), false);
});

test("서비스 워커: 화면 이동, API, 데이터, 다른 출처, 쓰기, 인증 요청은 맡지 않는다", async () => {
  const { handle, stored } = loadWorker();
  const origin = "https://resource.example";
  assert.equal(await handle({ url: `${origin}/app`, mode: "navigate" }), null);
  assert.equal(await handle({ url: `${origin}/_next/static/chunks/a.js`, mode: "navigate" }), null);
  for (const path of ["/api/v3/sessions", "/api/v3/sessions/s1/stream", "/api/v3/trust", "/api/auth/session", "/data/complexes.geojson", "/_next/image?url=x", "/app?_rsc=1", "/manifest.webmanifest", "/sw.js", "/trust", "/demo"]) {
    assert.equal(await handle({ url: `${origin}${path}` }), null, path);
  }
  assert.equal(await handle({ url: "https://cdn.example/_next/static/a.js" }), null);
  assert.equal(await handle({ url: `${origin}/_next/static/a.js`, method: "POST" }), null);
  assert.equal(await handle({ url: `${origin}/icons/icon-192.png`, headers: { get: (name) => (name === "authorization" ? "Bearer x" : null) } }), null);
  assert.equal(stored.size, 0);
});
