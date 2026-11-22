/**
 * BYPRO 서비스 워커. 정적 파일(빌드 산출물, 글꼴, 아이콘)만 캐시한다.
 *  - 화면 이동(navigate)과 API(/api/*), 데이터(/data/*), 이미지 최적화(/_next/image)는 캐시하지 않고 그대로 네트워크로 보낸다.
 *    로그인한 화면과 회사 데이터는 기기에 남지 않는다.
 *  - 빌드 산출물(/_next/static/*)은 이름에 내용 해시가 있어 바뀌지 않으므로 먼저 캐시에서 찾는다.
 *  - 운영 빌드에서만 등록한다(src/components/pwa/register.tsx). 검사: tests/pwa.test.ts
 */
const CACHE = "rsai-static-v1";
const STATIC_PATHS = [/^\/_next\/static\//, /^\/fonts\//, /^\/icons\//, /^\/(?:icon\.svg|apple-icon\.png|favicon\.ico)$/];

function cacheable(request) {
  if (request.method !== "GET") return false;
  if (request.mode === "navigate") return false;
  if (request.headers && request.headers.get("authorization")) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return STATIC_PATHS.some((pattern) => pattern.test(url.pathname));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("rsai-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!cacheable(event.request)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      const control = response.headers.get("cache-control") || "";
      if (response.ok && response.type === "basic" && !/no-store|private/.test(control)) {
        await cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
