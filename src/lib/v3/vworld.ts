/**
 * VWorld 도로명주소 건물(LT_C_SPBD)을 사용자의 브라우저에서 받는다(단지 평면도의 건물 도형).
 *
 * - 서버(운영 VM, 미국)에서 부르면 VWorld가 연결을 끊는다(해외 IP 차단, 2026-11-22 확인). 그래서 국내 사용자의
 *   브라우저가 직접 부른다. VWorld는 CORS를 열지 않아 JSONP(callback)로 받는다.
 * - 열쇠와 발급 도메인은 서버가 평면도 응답의 buildingLayer로 준다. 웹 페이지에서 쓰라고 내주는, 도메인에 묶인 열쇠다.
 * - VWorld 이용 조건대로 받은 도형은 화면에만 쓰고 저장하지 않는다.
 * parseBuildings는 순수 함수다(tests/complex-plan.test.ts).
 */
import type { ComplexPlan } from "./types.ts";

export type BuildingLayer = NonNullable<ComplexPlan["buildingLayer"]>;

/** 브라우저가 받은 건물 하나. 꼭짓점은 [경도, 위도] */
export type PlanBuilding = {
  id: string;
  rings: [number, number][][];
  floors: number | null;
  address: string | null;
  name: string | null;
};

type Feature = {
  id?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

type DataResponse = {
  response?: {
    status?: string;
    page?: { total?: string | number };
    result?: { featureCollection?: { features?: Feature[] } };
  };
};

/** VWorld 데이터 API 응답 → 건물. 다각형이 아닌 것과 꼭짓점이 셋보다 적은 것은 버린다 */
export function parseBuildings(data: DataResponse): PlanBuilding[] {
  const features = data.response?.result?.featureCollection?.features ?? [];
  const out: PlanBuilding[] = [];
  for (const feature of features) {
    const geometry = feature.geometry ?? {};
    let polygons = (geometry.coordinates ?? []) as number[][][][];
    if (geometry.type === "Polygon") polygons = [polygons as unknown as number[][][]];
    else if (geometry.type !== "MultiPolygon") continue;
    const rings = polygons
      .filter((polygon) => Array.isArray(polygon) && Array.isArray(polygon[0]) && polygon[0].length >= 3)
      .map((polygon) => polygon[0].map(([x, y]) => [Number(x), Number(y)] as [number, number]));
    if (rings.length === 0) continue;
    const props = feature.properties ?? {};
    const road = String(props.rd_nm ?? "");
    const number = String(props.buld_no ?? "");
    const floors = Number(props.gro_flo_co);
    out.push({
      id: String(props.bd_mgt_sn ?? feature.id ?? out.length),
      rings,
      floors: Number.isFinite(floors) && String(props.gro_flo_co ?? "") !== "" ? floors : null,
      address: `${road} ${number}`.trim() || null,
      name: String(props.buld_nm ?? "").trim() || null,
    });
  }
  return out;
}

/** 쪽 수: VWorld 응답의 page.total(없으면 1) */
export function pageTotal(data: DataResponse): number {
  const total = Number(data.response?.page?.total ?? 1);
  return Number.isFinite(total) && total > 0 ? total : 1;
}

export function layerUrl(layer: BuildingLayer, bbox: [number, number, number, number], page: number): string {
  const [x0, y0, x1, y1] = bbox;
  const params = new URLSearchParams({
    service: "data",
    request: "GetFeature",
    data: layer.layer,
    geomFilter: `BOX(${x0.toFixed(6)},${y0.toFixed(6)},${x1.toFixed(6)},${y1.toFixed(6)})`,
    size: String(layer.pageSize),
    page: String(page),
    format: "json",
    crs: "EPSG:4326",
    geometry: "true",
    attribute: "true",
    key: layer.key,
  });
  if (layer.domain) params.set("domain", layer.domain);
  return `${layer.url}?${params.toString()}`;
}

let counter = 0;

/** JSONP 한 번. 시간이 지나면 실패로 끝내고, 늦게 온 답은 빈 함수가 받는다 */
function jsonp<T>(url: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    counter += 1;
    const name = `__rsVworld${Date.now().toString(36)}${counter}`;
    const holder = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const finish = () => {
      window.clearTimeout(timer);
      holder[name] = () => undefined;
      script.remove();
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error("timeout"));
    }, timeoutMs);
    holder[name] = (data: T) => {
      finish();
      resolve(data);
    };
    script.onerror = () => {
      finish();
      reject(new Error("load"));
    };
    script.src = `${url}&callback=${name}`;
    document.head.appendChild(script);
  });
}

/** 범위 안 건물을 쪽마다 받는다(최대 layer.maxPages쪽). 실패하면 던진다 */
export async function fetchBuildings(layer: BuildingLayer, bbox: [number, number, number, number], timeoutMs = 12000): Promise<PlanBuilding[]> {
  const out: PlanBuilding[] = [];
  for (let page = 1; page <= layer.maxPages; page += 1) {
    const data = await jsonp<DataResponse>(layerUrl(layer, bbox, page), timeoutMs);
    const status = data.response?.status;
    if (status === "NOT_FOUND") break;
    if (status !== "OK") throw new Error(`status ${status ?? "none"}`);
    out.push(...parseBuildings(data));
    if (page >= pageTotal(data)) break;
  }
  return out;
}
