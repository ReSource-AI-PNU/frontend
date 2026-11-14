#!/usr/bin/env node
// 단지별 가상 입주 기업 시드를 만든다. 실제 기업 정보가 아니다(isDemo: true).
//
// 사용법: node scripts/seed-companies.mjs
// 입력: data/complexes.json, public/data/buildings/<id>.geojson (fetch-buildings.mjs 결과)
// 출력: public/data/companies/<id>.json (Company[] 배열, src/lib/domain.ts의 Company 타입)
//
// 고정 seed PRNG(mulberry32)를 쓰므로 입력이 같으면 출력도 같다.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPLEXES = path.join(ROOT, "data", "complexes.json");
const BUILDINGS_DIR = path.join(ROOT, "public", "data", "buildings");
const OUT_DIR = path.join(ROOT, "public", "data", "companies");
const SEED = 20261109;

// ---------- PRNG ----------

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeRng = (key) => {
  const r = mulberry32(SEED ^ hashStr(key));
  const rng = {
    next: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = r() * total;
      for (const [v, w] of pairs) if ((x -= w) < 0) return v;
      return pairs.at(-1)[0];
    },
    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
};

// ---------- 건물 ----------

const round6 = (v) => Math.round(v * 1e6) / 1e6;

function ringStats(ring) {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_540;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (a === 0) {
    const n = ring.length - 1;
    return { areaM2: 0, centroid: [ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n, ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n] };
  }
  return { areaM2: Math.abs((a / 2) * kx * ky), centroid: [cx / (3 * a), cy / (3 * a)] };
}

const INDUSTRIAL = new Set(["industrial", "warehouse", "factory", "manufacture"]);
const GENERIC = new Set(["yes", "commercial", "office", "retail"]);

function candidatesOf(fc) {
  const list = [];
  for (const f of fc.features) {
    const kind = f.properties.kind;
    const tier = INDUSTRIAL.has(kind) ? 0 : GENERIC.has(kind) ? 1 : null;
    if (tier === null) continue; // 주거·학교·종교시설 등은 제외
    const outers = f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
    const stats = outers.map(ringStats).sort((a, b) => b.areaM2 - a.areaM2);
    const areaM2 = stats.reduce((s, x) => s + x.areaM2, 0);
    if (areaM2 < (tier === 0 ? 80 : 200)) continue;
    list.push({ osmId: f.properties.osmId, kind, tier, areaM2, location: stats[0].centroid.map(round6) });
  }
  // 공장·창고 우선, 그다음 면적 큰 순. 동률은 osmId로 고정한다.
  return list.sort((a, b) => a.tier - b.tier || b.areaM2 - a.areaM2 || a.osmId - b.osmId);
}

const distM = ([x1, y1], [x2, y2]) => Math.hypot((x1 - x2) * 91_000, (y1 - y2) * 110_540);

// ---------- 기업 템플릿 ----------

const EMPLOYEES = [["5~9명", 1], ["10~29명", 4], ["30~49명", 3], ["50~99명", 2], ["100~299명", 1]];
const STORAGE = [["실내", 4], ["야외·지붕", 3], ["야외·노출", 2]];

const KG = {
  "폐플라스틱": [150, 1500],
  "금속 스크랩": [300, 5000],
  "폐목재": [200, 2000],
  "포장재": [80, 800],
};

// 배출 기업 업종: [업종, 상호 접미사, 주 배출 [item, detail], 부 배출 후보]
const EMITTERS = [
  ["플라스틱 제품 제조업", ["플라텍", "화성", "폴리머"], ["폐플라스틱", "PP 사출 불량품"], [["포장재", "골판지 박스"], ["폐플라스틱", "PE 필름 스크랩"]]],
  ["플라스틱 제품 제조업", ["팩", "필름"], ["폐플라스틱", "PE 필름 스크랩"], [["포장재", "PP 마대"]]],
  ["1차 금속 제조업", ["금속", "스틸"], ["금속 스크랩", "철 절단 잔재"], [["폐목재", "목재 팔레트"]]],
  ["금속 가공제품 제조업", ["정밀", "메탈"], ["금속 스크랩", "철 절삭칩"], [["포장재", "스트레치 필름"], ["폐목재", "목재 팔레트"]]],
  ["금속 가공제품 제조업", ["알루텍", "금속"], ["금속 스크랩", "알루미늄 칩"], [["포장재", "골판지 박스"]]],
  ["기타 기계 및 장비 제조업", ["기계", "엔지니어링"], ["금속 스크랩", "스테인리스 스크랩"], [["폐목재", "포장 목상자"], ["포장재", "골판지 박스"]]],
  ["자동차 및 트레일러 제조업", ["오토텍", "모터스부품"], ["금속 스크랩", "프레스 타발 잔재"], [["폐플라스틱", "PP 범퍼 불량품"], ["포장재", "골판지 박스"]]],
  ["전기장비 제조업", ["전기", "일렉트릭"], ["금속 스크랩", "구리 전선 스크랩"], [["포장재", "EPS 완충재"]]],
  ["기타 운송장비 제조업", ["마린", "조선기자재"], ["금속 스크랩", "강판 절단 잔재"], [["폐목재", "목재 받침목"]]],
  ["목재 및 나무제품 제조업", ["목재", "우드"], ["폐목재", "자투리 목재·톱밥"], [["포장재", "PP 밴드"]]],
  ["펄프, 종이 및 종이제품 제조업", ["지업", "페이퍼"], ["포장재", "골판지 파지"], [["폐플라스틱", "PE 코팅 필름"]]],
  ["식료품 제조업", ["식품", "푸드"], ["포장재", "골판지 박스"], [["폐플라스틱", "PE 포장 필름"]]],
  ["창고 및 운송관련 서비스업", ["물류", "로지스"], ["폐목재", "폐 목재 팔레트"], [["포장재", "스트레치 필름"]]],
];

const RECYCLERS = [
  ["폐기물 수집, 운반, 처리 및 원료 재생업", ["리사이클", "자원", "환경"], ["폐플라스틱", "포장재"]],
  ["폐기물 수집, 운반, 처리 및 원료 재생업", ["메탈리사이클", "자원"], ["금속 스크랩"]],
  ["폐기물 수집, 운반, 처리 및 원료 재생업", ["환경", "그린"], ["폐목재", "포장재"]],
];

// 수요처: 재생 원료를 사들이는 기업. demands는 받아 쓰는 재생 원료다.
const BUYERS = [
  ["플라스틱 제품 제조업", ["재생수지", "폴리텍"], ["폐플라스틱", "PP 분쇄품(재생 원료)"]],
  ["1차 금속 제조업", ["주강", "제강"], ["금속 스크랩", "철 스크랩(용해 원료)"]],
  ["목재 및 나무제품 제조업", ["바이오연료", "펠릿"], ["폐목재", "목재 칩(연료용)"]],
  ["펄프, 종이 및 종이제품 제조업", ["제지", "판지"], ["포장재", "골판지 파지(원료)"]],
];

// 실존 유명 기업과 겹치지 않도록 고른 상호 앞말
const PREFIXES = [
  "가람", "누리", "다온", "새솔", "청림", "미르", "해솔", "너울", "솔빛", "단비",
  "라온", "마루", "여울", "나래", "한결", "도담", "이음", "늘봄", "푸른들", "바름",
  "온누리", "새벽", "참빛", "은결", "하람", "다솜", "슬기", "아름", "꽃뫼", "구름",
  "물결", "별빛", "산들", "하늬", "새온", "나린", "누리봄", "모람", "희나", "길벗",
  "든솔", "예담", "새길", "참솔", "하얀", "늘품", "고운", "다래", "미소", "잎새",
];

const RESERVED_NAMES = new Set(["(주)한빛정밀 사출공장", "(주)녹산리사이클", "(주)동남환경", "(주)세움플라텍", "가온포장", "(주)윤슬몰드"]);

function makeNamer(rng) {
  const used = new Set(RESERVED_NAMES);
  const prefixes = rng.shuffle(PREFIXES);
  let i = 0;
  return (suffixes) => {
    for (let tries = 0; tries < 200; tries++) {
      const p = prefixes[i++ % prefixes.length];
      const s = rng.pick(suffixes);
      const style = rng.weighted([["(주){p}{s}", 5], ["{p}{s}", 3], ["{p}{s}(주)", 2]]);
      const name = style.replace("{p}", p).replace("{s}", s);
      if (!used.has(name) && ![...used].some((u) => u.replace(/\(주\)/g, "") === name.replace(/\(주\)/g, ""))) {
        used.add(name);
        return name;
      }
    }
    throw new Error("상호 생성 실패");
  };
}

const kg = (rng, item, scale = 1) => {
  const [lo, hi] = KG[item];
  return Math.round((rng.int(lo, hi) * scale) / 10) * 10;
};

function stream(rng, [item, detail], scale = 1) {
  return { item, detail, monthlyKg: kg(rng, item, scale), storage: rng.weighted(STORAGE) };
}

function emitter(rng, namer) {
  const [industry, suffixes, main, extras] = rng.pick(EMITTERS);
  const wasteStreams = [stream(rng, main)];
  for (const ex of extras) if (rng.next() < 0.5) wasteStreams.push(stream(rng, ex, 0.5));
  return { name: namer(suffixes), industry, role: "배출", wasteStreams, employees: rng.weighted(EMPLOYEES) };
}

function recycler(rng, namer) {
  const [industry, suffixes, permits] = rng.pick(RECYCLERS);
  return { name: namer(suffixes), industry, role: "처리업체", wasteStreams: [], permits: [...permits], employees: rng.weighted(EMPLOYEES.slice(1, 4)) };
}

function buyer(rng, namer) {
  const [industry, suffixes, [item, detail]] = rng.pick(BUYERS);
  return {
    name: namer(suffixes),
    industry,
    role: "수요처",
    wasteStreams: rng.next() < 0.5 ? [stream(rng, ["포장재", "골판지 박스"], 0.5)] : [],
    demands: [{ item, detail, monthlyKg: kg(rng, item, 3) }],
    employees: rng.weighted(EMPLOYEES.slice(2)),
  };
}

// ---------- 녹산 시나리오(설계안 데모) ----------
// 한빛정밀 PP 800kg + 근처 소량 PP 3곳 1,350kg = 2,150kg → 묶음 수거 시 2톤 초과
// 녹산리사이클: PP 허가 있음 / 동남환경: 폐플라스틱 허가 없음 → 허가 불일치 경고
const NOKSAN_SCENARIO = [
  {
    key: "anchor",
    scenario: "hanbit-anchor",
    name: "(주)한빛정밀 사출공장",
    industry: "플라스틱 제품 제조업",
    role: "배출",
    wasteStreams: [
      { item: "폐플라스틱", detail: "PP 압축품", monthlyKg: 800, storage: "야외·지붕" },
      { item: "포장재", detail: "골판지 박스", monthlyKg: 120, storage: "실내" },
    ],
    employees: "50~99명",
  },
  {
    key: "near",
    scenario: "pp-bundle",
    name: "(주)세움플라텍",
    industry: "플라스틱 제품 제조업",
    role: "배출",
    wasteStreams: [{ item: "폐플라스틱", detail: "PP 사출 스프루·불량품", monthlyKg: 520, storage: "야외·지붕" }],
    employees: "10~29명",
  },
  {
    key: "near",
    scenario: "pp-bundle",
    name: "가온포장",
    industry: "펄프, 종이 및 종이제품 제조업",
    role: "배출",
    wasteStreams: [
      { item: "폐플라스틱", detail: "PP 밴드·마대", monthlyKg: 450, storage: "실내" },
      { item: "포장재", detail: "골판지 파지", monthlyKg: 300, storage: "실내" },
    ],
    employees: "10~29명",
  },
  {
    key: "near",
    scenario: "pp-bundle",
    name: "(주)윤슬몰드",
    industry: "금속 가공제품 제조업",
    role: "배출",
    wasteStreams: [
      { item: "폐플라스틱", detail: "PP 시제품 사출물", monthlyKg: 380, storage: "야외·노출" },
      { item: "금속 스크랩", detail: "금형강 절삭칩", monthlyKg: 900, storage: "야외·지붕" },
    ],
    employees: "5~9명",
  },
  {
    key: "large",
    scenario: "recycler-match",
    name: "(주)녹산리사이클",
    industry: "폐기물 수집, 운반, 처리 및 원료 재생업",
    role: "처리업체",
    wasteStreams: [],
    permits: ["폐플라스틱", "포장재"],
    employees: "30~49명",
  },
  {
    key: "large",
    scenario: "permit-mismatch",
    name: "(주)동남환경",
    industry: "폐기물 수집, 운반, 처리 및 원료 재생업",
    role: "처리업체",
    wasteStreams: [],
    permits: ["금속 스크랩", "폐목재", "포장재"],
    note: "폐플라스틱(PP) 처리 허가가 없다. PP 압축품을 맡기면 허가 불일치 경고가 떠야 한다.",
    employees: "10~29명",
  },
];

// ---------- 생성 ----------

function plan(complexId, rng) {
  if (complexId === "noksan") return { total: 30, recyclers: 2, buyers: 3 }; // 시나리오 처리업체 2곳 별도
  const total = rng.int(8, 12);
  return { total, recyclers: 1, buyers: rng.int(1, 2) };
}

async function seedComplex(complex, namer) {
  const fc = JSON.parse(await readFile(path.join(BUILDINGS_DIR, `${complex.id}.geojson`), "utf8"));
  const rng = makeRng(complex.id);
  const cands = candidatesOf(fc);
  const { total, recyclers, buyers } = plan(complex.id, rng);
  if (cands.length < total) throw new Error(`${complex.id}: 배정 가능한 건물 ${cands.length}동 < 기업 ${total}곳`);

  // 상위 후보 풀(필요 수의 2배)에서 무작위로 고른다. 공장·대형 건물이 우선 남는다.
  const pool = cands.slice(0, Math.min(cands.length, total * 2));
  const taken = new Set();
  const take = (c) => (taken.add(c.osmId), c);
  const takeRandom = () => take(rng.pick(pool.filter((c) => !taken.has(c.osmId))) ?? cands.find((c) => !taken.has(c.osmId)));

  const companies = [];
  const add = (body, b) => companies.push({ ...body, buildingOsmId: b.osmId, location: b.location });

  if (complex.id === "noksan") {
    const free = () => cands.filter((c) => !taken.has(c.osmId));
    // 앵커: 공장 건물 중 중간 크기(너무 큰 물류센터는 피함)
    const anchor = take(free().filter((c) => c.tier === 0 && c.areaM2 < 15_000)[0] ?? free()[0]);
    for (const s of NOKSAN_SCENARIO) {
      let b;
      if (s.key === "anchor") b = anchor;
      else if (s.key === "near") b = take(free().sort((a, z) => distM(a.location, anchor.location) - distM(z.location, anchor.location))[0]);
      else b = take(free()[0]);
      const body = { ...s };
      delete body.key;
      add(body, b);
    }
  }

  const remaining = total - companies.length;
  const roles = [...Array(recyclers).fill("처리업체"), ...Array(buyers).fill("수요처")];
  while (roles.length < remaining) roles.push("배출");
  for (const role of rng.shuffle(roles)) {
    const body = role === "처리업체" ? recycler(rng, namer) : role === "수요처" ? buyer(rng, namer) : emitter(rng, namer);
    add(body, takeRandom());
  }

  const out = companies.map((c, i) => {
    const o = {
      id: `${complex.id}-${String(i + 1).padStart(3, "0")}`,
      name: c.name,
      buildingOsmId: c.buildingOsmId,
      location: c.location,
      industry: c.industry,
      role: c.role,
      wasteStreams: c.wasteStreams,
    };
    if (c.role === "처리업체") o.permits = c.permits;
    if (c.demands) o.demands = c.demands;
    o.employees = c.employees;
    if (c.scenario) o.scenario = c.scenario;
    if (c.note) o.note = c.note;
    o.isDemo = true;
    return o;
  });

  const file = path.join(OUT_DIR, `${complex.id}.json`);
  // src/lib/server/companies.ts가 Company[] 배열을 그대로 읽으므로 배열로 저장한다.
  await writeFile(file, JSON.stringify(out, null, 2) + "\n");
  const byRole = out.reduce((m, c) => ((m[c.role] = (m[c.role] ?? 0) + 1), m), {});
  console.log(`[${complex.id}] 기업 ${out.length}곳 ${JSON.stringify(byRole)} (후보 건물 ${cands.length}동)`);
  return out;
}

async function main() {
  const complexes = JSON.parse(await readFile(COMPLEXES, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });
  // 상호는 전체 단지에서 겹치지 않게 하나의 namer를 쓴다(단지 순서가 고정이라 결정적이다).
  const namer = makeNamer(makeRng("names"));
  for (const c of complexes) await seedComplex(c, namer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
