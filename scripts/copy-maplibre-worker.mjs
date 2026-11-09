// MapLibre 6의 워커는 런타임에 경로를 계산하므로 번들러가 찾지 못한다.
// public/vendor로 복사하고 컴포넌트에서 setWorkerUrl로 지정한다.
import { copyFile, mkdir, readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../node_modules/maplibre-gl/package.json", import.meta.url), "utf8"));
const target = new URL(`../public/vendor/maplibre-gl-worker-${pkg.version}.mjs`, import.meta.url);
await mkdir(new URL("../public/vendor/", import.meta.url), { recursive: true });
await copyFile(new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url), target);
console.log(`maplibre worker → public/vendor/maplibre-gl-worker-${pkg.version}.mjs`);
