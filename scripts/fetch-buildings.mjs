#!/usr/bin/env node
// 산업단지 bbox 안의 OSM 건물 외곽선을 Overpass API로 받아 GeoJSON으로 저장한다.
//
// 사용법:
//   node scripts/fetch-buildings.mjs            # data/complexes.json의 모든 단지
//   node scripts/fetch-buildings.mjs noksan     # 특정 단지만
//
// 환경 변수:
//   OVERPASS_URL  기본 https://overpass-api.de/api/interpreter
//   DELAY_MS      단지 요청 사이 대기 시간(기본 5000)
//
// 외부 의존성 없이 Node 20+ 내장 fetch만 쓴다.
// 데이터: © OpenStreetMap contributors, ODbL 1.0

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPLEXES = path.join(ROOT, "data", "complexes.json");
const OUT_DIR = path.join(ROOT, "public", "data", "buildings");
const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const DELAY_MS = Number(process.env.DELAY_MS ?? 5000);
const MAX_BYTES = 1.5 * 1024 * 1024;
const USER_AGENT = "resource-ai-seed/0.1";
const LEVEL_HEIGHT_M = 4.2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Overpass ----------

function buildQuery([minLng, minLat, maxLng, maxLat]) {
  const bb = `${minLat},${minLng},${maxLat},${maxLng}`; // Overpass는 (south,west,north,east)
  return `[out:json][timeout:180];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
);
out geom;`;
}

async function overpass(query) {
  const waits = [0, 15_000, 30_000, 60_000, 120_000, 180_000];
  let lastErr;
  for (const wait of waits) {
    if (wait) {
      console.log(`  ${wait / 1000}s 후 재시도`);
      await sleep(wait);
    }
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return await res.json();
      const text = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
      if (res.status === 406) {
        throw new Error(`406 Not Acceptable: User-Agent/Accept 헤더를 확인하라. ${text}`);
      }
      lastErr = new Error(`HTTP ${res.status}: ${text}`);
      if (![429, 502, 503, 504].includes(res.status)) throw lastErr;
      console.log(`  ${lastErr.message}`);
    } catch (err) {
      if (String(err.message).startsWith("406")) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---------- 기하 ----------

const round6 = (v) => Math.round(v * 1e6) / 1e6;

function toRing(geometry) {
  const ring = [];
  for (const { lon, lat } of geometry) {
    const p = [round6(lon), round6(lat)];
    const prev = ring[ring.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) ring.push(p);
  }
  if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) {
    ring.push([...ring[0]]);
  }
  return ring.length >= 4 ? ring : null;
}

// 위경도 링의 면적(㎡, 부호 있음: 반시계 양수). 단지 규모에서는 등장방형 근사로 충분하다.
function signedAreaM2(ring) {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return s / 2;
}

// RFC 7946: 외곽 링은 반시계 방향
function ccw(ring) {
  return signedAreaM2(ring) < 0 ? [...ring].reverse() : ring;
}

// relation 멤버 way 조각을 끝점끼리 이어 닫힌 링으로 만든다.
function joinWays(segments) {
  const pool = segments.map((s) => s.map(({ lon, lat }) => ({ lon, lat })));
  const rings = [];
  const same = (a, b) => a.lon === b.lon && a.lat === b.lat;
  while (pool.length) {
    let ring = pool.shift();
    let guard = 0;
    while (!same(ring[0], ring.at(-1)) && guard++ < 10_000) {
      const end = ring.at(-1);
      const idx = pool.findIndex((s) => same(s[0], end) || same(s.at(-1), end));
      if (idx < 0) break; // 닫히지 않는 조각(bbox 밖으로 잘린 경우 등)
      const seg = pool.splice(idx, 1)[0];
      ring = ring.concat(same(seg[0], end) ? seg.slice(1) : [...seg].reverse().slice(1));
    }
    if (same(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}

// ---------- 높이 ----------

function parseMeters(v) {
  if (v == null) return null;
  const m = String(v).replace(",", ".").match(/^\s*(\d+(?:\.\d+)?)\s*(m|meters?|미터)?\s*$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 400 ? n : null;
}

// osmId 기반의 결정적 해시(0~1). 같은 건물은 항상 같은 값을 얻는다.
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const INDUSTRIAL = new Set(["industrial", "warehouse", "factory", "manufacture", "storage_tank", "hangar"]);
const OFFICE = new Set(["office", "commercial", "retail", "civic", "public", "government", "hospital", "school", "university"]);

function estimateHeight(kind, areaM2, osmId) {
  const j = hash01(String(osmId));
  if (INDUSTRIAL.has(kind)) {
    // 9~14m: 면적이 클수록 높게, 같은 구간 안에서는 해시로 0~1m 흔든다.
    const base = areaM2 < 500 ? 9 : areaM2 < 2000 ? 10 : areaM2 < 8000 ? 12 : 13;
    return Math.min(14, base + (j < 0.5 ? 0 : 1));
  }
  if (OFFICE.has(kind)) {
    // 3~5층
    const levels = areaM2 < 400 ? 3 : areaM2 < 1500 ? 4 : 5;
    return Math.round(levels * LEVEL_HEIGHT_M);
  }
  return 8;
}

function heightOf(tags, areaM2, osmId) {
  const h = parseMeters(tags.height);
  if (h) return { height: Math.max(3, Math.round(h)), heightSource: "osm-height" };
  const lv = parseMeters(tags["building:levels"]);
  if (lv) return { height: Math.max(3, Math.round(lv * LEVEL_HEIGHT_M)), heightSource: "osm-levels" };
  return { height: estimateHeight(tags.building, areaM2, osmId), heightSource: "estimated" };
}

// ---------- 변환 ----------

function toFeature(el) {
  const tags = el.tags ?? {};
  // 프런트(promoteId: "osmId", Company.buildingOsmId: number)에 맞춰 숫자로 둔다.
  // way는 양수 id, relation은 음수 id(-relationId)로 구분한다.
  const osmId = el.type === "relation" ? -el.id : el.id;
  let rings = [];
  if (el.type === "way" && el.geometry) {
    const r = toRing(el.geometry);
    if (r) rings = [r];
  } else if (el.type === "relation" && el.members) {
    const outers = el.members.filter((m) => m.type === "way" && m.role === "outer" && m.geometry);
    rings = joinWays(outers.map((m) => m.geometry)).map(toRing).filter(Boolean);
  }
  rings = rings.map(ccw).filter((r) => Math.abs(signedAreaM2(r)) >= 1);
  if (!rings.length) return null;

  const area = rings.reduce((s, r) => s + Math.abs(signedAreaM2(r)), 0);
  const geometry =
    rings.length === 1
      ? { type: "Polygon", coordinates: [rings[0]] }
      : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
  return {
    type: "Feature",
    properties: { ...heightOf(tags, area, osmId), osmId, kind: tags.building ?? "yes" },
    geometry,
  };
}

// way(양수) 먼저 id 오름차순, 그다음 relation(음수)을 절댓값 오름차순
const osmIdKey = (id) => [id < 0 ? 1 : 0, Math.abs(id)];

async function fetchComplex(complex) {
  console.log(`[${complex.id}] ${complex.name} bbox=${complex.bbox.join(",")}`);
  const data = await overpass(buildQuery(complex.bbox));
  const features = (data.elements ?? [])
    .map(toFeature)
    .filter(Boolean)
    .sort((a, b) => {
      const [ta, na] = osmIdKey(a.properties.osmId);
      const [tb, nb] = osmIdKey(b.properties.osmId);
      return ta - tb || na - nb;
    });

  const fc = {
    type: "FeatureCollection",
    complexId: complex.id,
    bbox: complex.bbox,
    attribution: "© OpenStreetMap contributors",
    license: "ODbL-1.0",
    osmBaseTimestamp: data.osm3s?.timestamp_osm_base ?? null,
    features,
  };
  const json = JSON.stringify(fc);
  const bytes = Buffer.byteLength(json);
  const file = path.join(OUT_DIR, `${complex.id}.geojson`);
  await writeFile(file, json);

  const src = features.reduce((m, f) => ((m[f.properties.heightSource] = (m[f.properties.heightSource] ?? 0) + 1), m), {});
  console.log(`  -> ${path.relative(ROOT, file)} 건물 ${features.length}동, ${(bytes / 1024).toFixed(0)}KB, 높이출처 ${JSON.stringify(src)}`);
  if (bytes > MAX_BYTES) {
    console.warn(`  !! 1.5MB 초과. data/complexes.json에서 ${complex.id}의 bbox를 핵심 구역으로 줄이고 note를 남겨라.`);
    process.exitCode = 1;
  }
  return { id: complex.id, count: features.length, bytes };
}

async function main() {
  const complexes = JSON.parse(await readFile(COMPLEXES, "utf8"));
  const only = process.argv.slice(2);
  const targets = only.length ? complexes.filter((c) => only.includes(c.id)) : complexes;
  if (!targets.length) throw new Error(`대상 단지가 없다: ${only.join(", ")}`);
  await mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await sleep(DELAY_MS); // Overpass 서버 부담을 줄인다
    try {
      results.push(await fetchComplex(targets[i]));
    } catch (err) {
      // 한 단지가 실패해도 나머지는 계속 받는다. 실패한 단지는 id를 인자로 다시 실행한다.
      console.error(`  !! ${targets[i].id} 실패: ${err.message}`);
      results.push({ id: targets[i].id, count: null, bytes: 0, failed: true });
      process.exitCode = 1;
    }
  }
  console.table(results.map((r) => ({ id: r.id, buildings: r.count, KB: Math.round(r.bytes / 1024), failed: !!r.failed })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
