/**
 * 같은 단지 평면도 계산(src/lib/v3/complex-plan.ts). 지도 서비스의 좌표·건물은 저장하면 안 되므로(카카오·VWorld 이용 조건)
 * 시험 자료는 가짜 좌표로 만든다. 후보 목록은 실제 백엔드 결과(tests/fixtures/v3-complex.json)를 쓴다.
 * 실행: node --test tests/complex-plan.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildingOf,
  buildingRoles,
  clampView,
  edgeMarker,
  fullView,
  missingLine,
  nodeLabel,
  partnerView,
  percentIn,
  placeLabels,
  planNodes,
  planSourceLine,
  projection,
  shortItem,
} from "../src/lib/v3/complex-plan.ts";
import { complexPartnersSchema, complexPlanSchema } from "../src/lib/v3/schema.ts";
import type { ComplexPlan } from "../src/lib/v3/types.ts";
import { layerUrl, pageTotal, parseBuildings, type PlanBuilding } from "../src/lib/v3/vworld.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/v3-complex.json", import.meta.url), "utf8")) as { complexPartners: unknown };
const partners = complexPartnersSchema.parse(fixture.complexPartners);
const ids = [...new Set(partners.streams.flatMap((stream) => [...stream.takes, ...stream.uses].map((item) => item.id)))];

// 가짜 평면도: 우리 회사는 서쪽, 후보는 동쪽에 일정 간격으로. 마지막 후보는 위치를 찾지 못한 것으로 둔다
const BBOX: [number, number, number, number] = [128.82, 35.08, 128.87, 35.1];
const places = Object.fromEntries(
  ids.slice(0, -1).map((id, i) => [id, { location: [128.85 + 0.0005 * i, 35.09] as [number, number], buildingId: `b${i}`, source: "kakao" as const }]),
);
const plan: ComplexPlan = complexPlanSchema.parse({
  complex: partners.complex,
  bbox: BBOX,
  scale: 100000,
  self: { location: [128.825, 35.085], buildingId: "bself", source: "org" },
  places,
  buildings: [],
  buildingLayer: { provider: "vworld", url: "https://api.vworld.kr/req/data", layer: "LT_C_SPBD", key: "test-key", domain: "https://example.test", pageSize: 1000, maxPages: 3 },
  missing: [ids[ids.length - 1]],
  notes: { buildings: null, locations: null },
  sources: ["카카오 주소 검색", "VWorld 도로명주소 건물(화면을 열 때 조회하고 저장하지 않음)"],
});

test("투영: 서남쪽 모서리는 왼쪽 아래, 동북쪽 모서리는 오른쪽 위이고 폭은 1000이다", () => {
  const proj = projection(plan)!;
  assert.deepEqual(proj.point([128.82, 35.1]).map(Math.round), [0, 0]);
  const [x, y] = proj.point([128.87, 35.08]);
  assert.equal(Math.round(x), 1000);
  assert.equal(Math.round(y), Math.round(proj.height));
  // 위도 35도에서 경도 1도는 위도 1도보다 짧다(cos): 0.05×0.02도 범위의 높이는 1000×0.4/cos(35°)보다 크다
  assert.ok(proj.height > 400 / Math.cos((35.09 * Math.PI) / 180) - 1);
  assert.match(proj.ring([[128.82, 35.1], [128.83, 35.1], [128.83, 35.09]]), /^M0\.0 0\.0L[\d.]+ 0\.0L[\d.]+ [\d.]+Z$/);
  assert.equal(projection({ bbox: null }), null);
});

test("그릴 회사: 우리 회사가 먼저, 받는 곳이 쓰는 곳보다 앞이고, 위치를 찾지 못한 곳은 빠진다", () => {
  const nodes = planNodes(plan, partners, null);
  assert.equal(nodes[0].role, "self");
  assert.equal(nodes.length, 1 + ids.length - 1);
  const roles = nodes.slice(1).map((node) => node.role);
  assert.deepEqual(roles, [...roles].sort((a, b) => (a === b ? 0 : a === "takes" ? -1 : 1)));
  assert.equal(missingLine(plan), "위치를 찾지 못한 1곳은 평면도에 없고 아래 목록에만 있습니다.");
});

test("폐기물을 고르면 그 폐기물의 후보만 남는다", () => {
  const film = planNodes(plan, partners, "st_film");
  const filmIds = new Set(partners.streams.find((s) => s.streamId === "st_film")!.takes.map((c) => c.id));
  for (const node of film.slice(1)) {
    assert.ok(node.streamIds.includes("st_film"));
    if (filmIds.has(node.id)) assert.equal(node.role, "takes");
  }
});

/** 점 둘레 약 20m 정사각형 건물 */
const square = (id: string, [lon, lat]: [number, number]): PlanBuilding => ({
  id,
  rings: [[[lon - 0.0001, lat - 0.0001], [lon + 0.0001, lat - 0.0001], [lon + 0.0001, lat + 0.0001], [lon - 0.0001, lat + 0.0001]]],
  floors: 2,
  address: null,
  name: null,
});
const shapes = [square("bself", plan.self!.location), ...Object.entries(plan.places).map(([, place], i) => square(`b${i}`, place.location))];

test("회사 좌표가 든 건물을 그 회사 건물로 보고, 밖이면 40m 안의 가까운 건물을 본다", () => {
  assert.equal(buildingOf([128.825, 35.085], shapes), "bself");
  assert.equal(buildingOf([128.82525, 35.085], shapes), "bself"); // 건물 밖 약 23m
  assert.equal(buildingOf([128.83, 35.085], shapes), null);
});

test("건물 칠은 우리 회사 > 받는 곳 > 쓰는 곳 순서로 정한다", () => {
  const plain = { ...plan, self: { ...plan.self!, buildingId: null }, places: Object.fromEntries(Object.entries(plan.places).map(([id, place]) => [id, { ...place, buildingId: null }])) };
  const nodes = planNodes(plain, partners, null, shapes);
  const roles = buildingRoles(nodes);
  assert.equal(roles.get("bself"), "self");
  const takes = nodes.find((node) => node.role === "takes")!;
  assert.equal(roles.get(takes.buildingId!), "takes");
});

test("후보 주변 보기는 받는 곳을 덮고 비율을 1:0.4~1:0.7로 맞추며 전체 범위 밖으로 나가지 않는다", () => {
  const proj = projection(plan)!;
  const nodes = planNodes(plan, partners, null);
  const view = partnerView(nodes, proj)!;
  for (const node of nodes.filter((n) => n.role === "takes")) assert.ok(percentIn(view, node.x, node.y));
  const ratio = view.height / view.width;
  assert.ok(ratio >= 0.4 - 1e-9 && ratio <= 0.7 + 1e-9, String(ratio));
  assert.ok(view.x >= 0 && view.y >= 0 && view.x + view.width <= proj.width + 1e-9);
  const full = fullView(proj);
  assert.ok(full.width <= proj.width && full.height <= proj.height);
  const tall = clampView(proj, 500, 200, 100, 400);
  assert.ok(tall.height / tall.width <= 0.7 + 1e-9);
});

test("화면 밖의 우리 회사는 가장자리에 방향 표시를 둔다", () => {
  const view = { x: 500, y: 0, width: 400, height: 200 };
  const marker = edgeMarker(view, 0, 100)!;
  assert.ok(marker.left <= 6 + 1e-9);
  assert.ok(Math.abs(marker.top - 50) < 1);
  assert.equal(edgeMarker(view, 700, 100), null);
});

test("이름표는 겹치지 않게 놓고, 자리가 없으면 숨기되 고른 회사는 꼭 보인다", () => {
  const item = (id: string, left: number, force = false) => ({ id, left, top: 50, width: 120, height: 30, force });
  // 떨어진 점은 오른쪽에 놓는다
  assert.equal(placeLabels([item("solo", 30)], 600, 200).get("solo"), "right");
  // 붙은 점 셋: 이름표가 놓였다면 서로, 그리고 다른 핀과 겹치지 않는다(같은 쪽에 나란히 놓이지 않는다)
  const sides = placeLabels([item("a", 30), item("b", 32), item("c", 34)], 600, 200);
  assert.ok(sides.get("a"));
  const placed = ["a", "b", "c"].map((id) => sides.get(id)).filter(Boolean);
  assert.ok(new Set(placed).size === placed.length || placed.length < 3);
  const crowded = placeLabels(
    Array.from({ length: 12 }, (_, i) => item(`n${i}`, 50 + i * 0.2)),
    300,
    60,
  );
  assert.ok([...crowded.values()].some((side) => side === null));
  const forced = placeLabels([item("x", 50), item("y", 50.5, true)], 300, 60);
  assert.notEqual(forced.get("y"), null);
});

test("핀 이름과 출처 문장", () => {
  const nodes = planNodes(plan, partners, null);
  assert.equal(nodeLabel(nodes[0]), "우리 회사");
  const takes = nodes.find((node) => node.role === "takes")!;
  assert.ok(nodeLabel(takes).startsWith(`${takes.name} · 받아서 재생원료로 만드는 곳`));
  assert.ok((shortItem(takes.candidate) ?? "").length <= 14);
  assert.match(planSourceLine(plan), /연결 후보이며 실제 거래가 아닙니다/);
});

test("VWorld 응답을 건물로 읽고, 쪽 수와 요청 주소를 만든다", () => {
  const data = {
    response: {
      status: "OK",
      page: { total: "2" },
      result: {
        featureCollection: {
          features: [
            {
              geometry: { type: "MultiPolygon", coordinates: [[[[128.1, 35.1], [128.2, 35.1], [128.2, 35.2], [128.1, 35.1]]]] },
              properties: { bd_mgt_sn: "x1", rd_nm: "녹산산업중로", buld_no: "365", gro_flo_co: "2", buld_nm: "" },
            },
            { geometry: { type: "Point", coordinates: [128.1, 35.1] }, properties: {} },
            { geometry: { type: "Polygon", coordinates: [[[128.1, 35.1], [128.2, 35.1]]] }, properties: {} },
          ],
        },
      },
    },
  };
  const parsed = parseBuildings(data);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], { id: "x1", rings: [[[128.1, 35.1], [128.2, 35.1], [128.2, 35.2], [128.1, 35.1]]], floors: 2, address: "녹산산업중로 365", name: null });
  assert.equal(pageTotal(data), 2);
  assert.equal(pageTotal({}), 1);
  const url = new URL(layerUrl(plan.buildingLayer!, [128.82, 35.08, 128.87, 35.1], 2));
  assert.equal(url.searchParams.get("data"), "LT_C_SPBD");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("geomFilter"), "BOX(128.820000,35.080000,128.870000,35.100000)");
  assert.equal(url.searchParams.get("domain"), "https://example.test");
});
