"use client";

/**
 * 보관장 3D 보기(DESIGN.md "보관장 3D 스캔"). 점군과 AI가 찾은 더미 테두리(`marker`), 바닥, 상차 지점을 그리고,
 * "지금 배치 | 정리안"을 바꿔 본다. 정리안은 서버의 배치 규칙이 정한 자리이고 화면은 그대로 그리기만 한다.
 * three.js는 이 보기를 열 때만 불러온다(서버 렌더와 첫 화면에 넣지 않는다). WebGL이 없으면 위에서 본 평면도(SVG)로 대신한다.
 * 자동 회전은 하지 않고, 화면은 움직일 때만 다시 그린다.
 */
import { useEffect, useRef, useState } from "react";
import type * as Three from "three";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { ApiError, ApiUnreachable, api } from "@/lib/v3/api";
import { insidePolygon, parsePoints, zoneOrder, zoneToken, type PointCloud } from "@/lib/v3/scan";
import type { ScanView } from "@/lib/v3/types";

type Mode = "current" | "proposal";
type XY = readonly [number, number];

const PICK_OUTSIDE = "보관장 바닥 안을 눌러 주세요.";
const UNASSIGNED_COLOR = "#9a9aa3";

function hasWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** 폐기물(streamId) → 정리안 색 토큰. 정리안 영역 순서를 따른다 */
function zoneTokens(view: ScanView): Map<string, string> {
  return new Map(zoneOrder(view).map((id, index) => [id, zoneToken(index)]));
}

/** 정리안에서 더미 하나가 놓일 자리. 정리안이 없거나 그 더미가 빠졌으면 지금 자리 */
function placed(view: ScanView, mode: Mode) {
  const proposal = mode === "proposal" ? view.layout?.proposal : null;
  return view.piles.map((pile) => {
    const moved = proposal?.piles.find((item) => item.id === pile.id);
    return {
      pile,
      footprint: (moved?.footprint ?? pile.footprint) as XY[],
      center: (moved?.center ?? pile.center) as XY,
      zone: moved ? moved.zone : pile.streamId,
    };
  });
}

type Engine = {
  THREE: typeof Three;
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  controls: OrbitControlsType;
  points: Three.Group;
  overlay: Three.Group;
  labels: { el: HTMLSpanElement; at: Three.Vector3 }[];
  cache: { cloud: PointCloud | null; background: Three.Points | null; piles: Three.Points | null };
  render: () => void;
  dispose: () => void;
};

function disposeGroup(group: Three.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((node) => {
      const mesh = node as Three.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as Three.Material | Three.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
  }
}

function pointsOf(THREE: typeof Three, cloud: PointCloud, pick: (label: number) => boolean, size: number): Three.Points {
  let count = 0;
  for (let i = 0; i < cloud.count; i += 1) if (pick(cloud.labels[i])) count += 1;
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  let at = 0;
  for (let i = 0; i < cloud.count; i += 1) {
    if (!pick(cloud.labels[i])) continue;
    positions.set(cloud.positions.subarray(i * 3, i * 3 + 3), at * 3);
    colors.set(cloud.colors.subarray(i * 3, i * 3 + 3), at * 3);
    at += 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3, true));
  const material = new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: true });
  return new THREE.Points(geometry, material);
}

/** 3D 장면. 점군과 겹쳐 그릴 것을 props가 바뀔 때마다 다시 만든다(점군 자체는 한 번만 만든다) */
function Scene3D({
  view,
  cloud,
  mode,
  picking,
  resetSignal,
  onPick,
  onFail,
}: {
  view: ScanView;
  cloud: PointCloud;
  mode: Mode;
  picking: boolean;
  resetSignal: number;
  onPick: (x: number, y: number) => void;
  onFail: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const pickRef = useRef({ picking, onPick });
  useEffect(() => {
    pickRef.current = { picking, onPick };
  }, [picking, onPick]);

  // 엔진: 한 번만 만든다
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let engine: Engine | null = null;
    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (!alive) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(new THREE.Color(cssColor("--color-photo", "#18181b")));
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";
        host.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
        camera.up.set(0, 0, 1);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.maxPolarAngle = Math.PI * 0.49; // 바닥 아래로 내려가지 않는다
        const points = new THREE.Group();
        const overlay = new THREE.Group();
        scene.add(points, overlay);
        const at = new THREE.Vector3();
        const render = () => {
          renderer.render(scene, camera);
          const width = renderer.domElement.clientWidth;
          const height = renderer.domElement.clientHeight;
          for (const label of engine?.labels ?? []) {
            at.copy(label.at).project(camera);
            const visible = at.z < 1 && Math.abs(at.x) <= 1.05 && Math.abs(at.y) <= 1.05;
            label.el.style.display = visible ? "block" : "none";
            label.el.style.transform = `translate(-50%, -100%) translate(${((at.x + 1) / 2) * width}px, ${((1 - at.y) / 2) * height}px)`;
          }
        };
        const resize = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (width === 0 || height === 0) return;
          renderer.setSize(width, height, false);
          renderer.domElement.style.width = `${width}px`;
          renderer.domElement.style.height = `${height}px`;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        controls.addEventListener("change", render);

        // 상차 지점 고르기: 끌지 않고 누른 곳만 본다
        let down: { x: number; y: number } | null = null;
        const ray = new THREE.Raycaster();
        const floor = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const onDown = (event: PointerEvent) => {
          down = { x: event.clientX, y: event.clientY };
        };
        const onUp = (event: PointerEvent) => {
          const start = down;
          down = null;
          if (!start || !pickRef.current.picking) return;
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
          const rect = renderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
          );
          ray.setFromCamera(ndc, camera);
          const hit = new THREE.Vector3();
          if (ray.ray.intersectPlane(floor, hit)) pickRef.current.onPick(hit.x, hit.y);
        };
        renderer.domElement.addEventListener("pointerdown", onDown);
        renderer.domElement.addEventListener("pointerup", onUp);

        engine = {
          THREE,
          renderer,
          scene,
          camera,
          controls,
          points,
          overlay,
          labels: [],
          cache: { cloud: null, background: null, piles: null },
          render,
          dispose: () => {
            observer.disconnect();
            controls.removeEventListener("change", render);
            controls.dispose();
            renderer.domElement.removeEventListener("pointerdown", onDown);
            renderer.domElement.removeEventListener("pointerup", onUp);
            disposeGroup(points);
            disposeGroup(overlay);
            renderer.dispose();
            renderer.domElement.remove();
          },
        };
        engineRef.current = engine;
        resize();
        setReady(true);
      } catch {
        if (alive) onFail();
      }
    })();
    return () => {
      alive = false;
      engine?.dispose();
      engineRef.current = null;
    };
    // onFail은 처음 것만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 점군과 겹쳐 그릴 것
  useEffect(() => {
    const engine = engineRef.current;
    if (!ready || !engine) return;
    const { THREE } = engine;
    const span = view.bounds ? Math.max(view.bounds.max[0] - view.bounds.min[0], view.bounds.max[1] - view.bounds.min[1]) : 10;
    const pointSize = Math.min(0.05, Math.max(0.012, span / 600));
    if (engine.cache.cloud !== cloud) {
      disposeGroup(engine.points);
      engine.cache.background = pointsOf(THREE, cloud, (label) => label === 0, pointSize);
      engine.cache.piles = pointsOf(THREE, cloud, (label) => label > 0, pointSize);
      engine.cache.cloud = cloud;
      engine.points.add(engine.cache.background, engine.cache.piles);
    }
    const background = engine.cache.background;
    const pilePoints = engine.cache.piles;
    if (background) {
      const material = background.material as Three.PointsMaterial;
      material.transparent = mode === "proposal";
      material.opacity = mode === "proposal" ? 0.22 : 1;
      material.depthWrite = mode !== "proposal";
      material.needsUpdate = true;
    }
    if (pilePoints) pilePoints.visible = mode === "current";

    disposeGroup(engine.overlay);
    const labelsHost = labelsRef.current;
    if (labelsHost) labelsHost.replaceChildren();
    engine.labels = [];
    const addLabel = (text: string, x: number, y: number, z: number) => {
      if (!labelsHost) return;
      const el = document.createElement("span");
      el.textContent = text;
      el.className =
        "pointer-events-none absolute top-0 left-0 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-white";
      labelsHost.append(el);
      engine.labels.push({ el, at: new THREE.Vector3(x, y, z) });
    };
    const shapeOf = (polygon: readonly XY[]) => new THREE.Shape(polygon.map(([x, y]) => new THREE.Vector2(x, y)));
    const line = (polygon: readonly XY[], z: number, color: string, opacity = 1) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(polygon.map(([x, y]) => new THREE.Vector3(x, y, z)));
      const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
      return new THREE.LineLoop(geometry, material);
    };

    // 바닥
    const floorColor = cssColor("--color-muted", "#6e6e78");
    if (view.floor && view.floor.polygon.length >= 3) engine.overlay.add(line(view.floor.polygon, 0.002, floorColor, 0.9));

    const marker = cssColor("--color-marker", "#d7ecdf");
    const tokens = zoneTokens(view);
    const colorOf = (zone: string | null) => (zone && tokens.has(zone) ? cssColor(tokens.get(zone)!, UNASSIGNED_COLOR) : UNASSIGNED_COLOR);

    // 정리안의 폐기물 영역
    if (mode === "proposal") {
      for (const zone of view.layout?.proposal?.zones ?? []) {
        if (zone.polygon.length < 3) continue;
        const color = colorOf(zone.streamId);
        const fill = new THREE.Mesh(
          new THREE.ShapeGeometry(shapeOf(zone.polygon)),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
        );
        fill.position.z = 0.004;
        fill.renderOrder = 1; // 옅게 그린 점군보다 나중에 그려 구역이 묻히지 않게 한다
        const outline = line(zone.polygon, 0.006, color, 1);
        outline.renderOrder = 1;
        engine.overlay.add(fill, outline);
      }
    }

    // 더미
    for (const item of placed(view, mode)) {
      if (item.footprint.length < 3) continue;
      const height = Math.max(0.05, item.pile.heightM);
      const geometry = new THREE.ExtrudeGeometry(shapeOf(item.footprint), { depth: height, bevelEnabled: false });
      const color = mode === "proposal" ? colorOf(item.zone) : marker;
      const faces = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: mode === "proposal" ? 0.55 : 0.1,
          depthWrite: mode === "proposal",
        }),
      );
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color }));
      faces.renderOrder = 2;
      edges.renderOrder = 2;
      engine.overlay.add(faces, edges);
      addLabel(item.pile.name, item.center[0], item.center[1], height + 0.08);
    }

    // 상차 지점과 비워 두는 반경
    const pickup = view.layout?.pickup;
    if (pickup) {
      const ink = "#f4f4f5";
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 16), new THREE.MeshBasicMaterial({ color: ink }));
      pillar.rotation.x = Math.PI / 2;
      pillar.position.set(pickup.x, pickup.y, 0.8);
      engine.overlay.add(pillar);
      addLabel("상차 지점", pickup.x, pickup.y, 1.7);
      if (mode === "proposal" && view.layout) {
        const radius = view.layout.rules.pickupClearM;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(Math.max(0, radius - 0.03), radius, 64),
          new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
        );
        ring.position.set(pickup.x, pickup.y, 0.008);
        engine.overlay.add(ring);
      }
    }

    // 찍으며 걸은 길(지금 배치에서만)
    if (mode === "current" && view.camera && view.camera.path.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(view.camera.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      engine.overlay.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: floorColor, transparent: true, opacity: 0.7 })));
    }
    engine.render();
  }, [ready, view, cloud, mode]);

  // 처음 시점: 영상을 찍기 시작한 쪽에서 보관장 가운데를 내려다본다
  useEffect(() => {
    const engine = engineRef.current;
    if (!ready || !engine) return;
    const { THREE, camera, controls } = engine;
    const min = view.bounds?.min ?? [-5, -5, 0];
    const max = view.bounds?.max ?? [5, 5, 2];
    const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, 0);
    const radius = Math.max(2, Math.hypot(max[0] - min[0], max[1] - min[1]) / 2);
    const start = view.camera?.path[0];
    const direction = new THREE.Vector2(start ? start[0] - center.x : 0, start ? start[1] - center.y : -1);
    if (direction.lengthSq() < 1e-6) direction.set(0, -1);
    direction.normalize();
    // 좁은 화면(휴대폰)은 가로가 짧아 보관장 양 끝이 잘리지 않게 더 물러선다
    const back = 1.25 * Math.max(1, 1.4 / Math.max(0.5, camera.aspect));
    camera.position.set(center.x + direction.x * radius * back, center.y + direction.y * radius * back, radius * 0.95 * (back / 1.25));
    controls.target.copy(center);
    controls.update();
    engine.render();
  }, [ready, view.id, view.bounds, view.camera, resetSignal]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="보관장 3D 장면. 끌어서 돌리고, 두 손가락이나 휠로 가까이 볼 수 있습니다."
      className={`relative h-[340px] w-full overflow-hidden rounded-[14px] bg-photo sm:h-[440px] ${picking ? "cursor-crosshair" : "cursor-grab"}`}
    >
      <div ref={labelsRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
      {!ready ? <p className="absolute inset-0 grid place-items-center text-sm text-white/70">3D 장면을 준비하는 중입니다.</p> : null}
    </div>
  );
}

/** WebGL이 없을 때: 위에서 본 평면도. 같은 자리·색·이름으로 그린다 */
function TopView({ view, mode, picking, onPick }: { view: ScanView; mode: Mode; picking: boolean; onPick: (x: number, y: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const polygon = view.floor?.polygon ?? [];
  const all: XY[] = [...polygon, ...view.piles.flatMap((pile) => pile.footprint as XY[])];
  if (view.layout) all.push([view.layout.pickup.x, view.layout.pickup.y]);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 0.6;
  const minX = Math.min(...xs, 0) - pad;
  const maxX = Math.max(...xs, 0) + pad;
  const minY = Math.min(...ys, 0) - pad;
  const maxY = Math.max(...ys, 0) + pad;
  const toSvg = ([x, y]: XY) => `${(x - minX).toFixed(3)},${(maxY - y).toFixed(3)}`;
  const tokens = zoneTokens(view);
  const fillOf = (zone: string | null) => (zone && tokens.has(zone) ? `var(${tokens.get(zone)})` : UNASSIGNED_COLOR);
  const click = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!picking || !svgRef.current) return;
    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onPick(point.x + minX, maxY - point.y);
  };
  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="위에서 본 보관장 평면도"
      viewBox={`0 0 ${(maxX - minX).toFixed(3)} ${(maxY - minY).toFixed(3)}`}
      className={`h-[340px] w-full rounded-[14px] bg-surface ring-1 ring-line sm:h-[440px] ${picking ? "cursor-crosshair" : ""}`}
      onClick={click}
    >
      {polygon.length >= 3 ? (
        <polygon points={polygon.map(toSvg).join(" ")} fill="var(--color-ground)" stroke="var(--color-line-strong)" strokeWidth={0.04} />
      ) : null}
      {mode === "proposal"
        ? (view.layout?.proposal?.zones ?? []).map((zone) => (
            <polygon
              key={zone.streamId}
              points={zone.polygon.map(toSvg).join(" ")}
              fill={fillOf(zone.streamId)}
              fillOpacity={0.15}
              stroke={fillOf(zone.streamId)}
              strokeWidth={0.03}
            />
          ))
        : null}
      {placed(view, mode).map((item) => {
        const [cx, cy] = toSvg(item.center).split(",").map(Number);
        return (
          <g key={item.pile.id}>
            <polygon
              points={item.footprint.map(toSvg).join(" ")}
              fill={mode === "proposal" ? fillOf(item.zone) : "var(--color-marker)"}
              fillOpacity={mode === "proposal" ? 0.6 : 0.5}
              stroke={mode === "proposal" ? fillOf(item.zone) : "var(--color-marker-ink)"}
              strokeWidth={0.04}
            />
            <text x={cx} y={cy} fontSize={0.32} textAnchor="middle" dominantBaseline="middle" className="fill-ink font-mono">
              {item.pile.name}
            </text>
          </g>
        );
      })}
      {view.layout ? (
        <g>
          {mode === "proposal" ? (
            <circle
              cx={view.layout.pickup.x - minX}
              cy={maxY - view.layout.pickup.y}
              r={view.layout.rules.pickupClearM}
              fill="none"
              stroke="var(--color-ink)"
              strokeDasharray="0.12 0.1"
              strokeWidth={0.03}
            />
          ) : null}
          <circle cx={view.layout.pickup.x - minX} cy={maxY - view.layout.pickup.y} r={0.14} fill="var(--color-ink)" />
        </g>
      ) : null}
    </svg>
  );
}

function Swatch({ color, ring = false }: { color: string; ring?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 shrink-0 rounded-[3px] ${ring ? "border-2 bg-transparent" : ""}`}
      style={ring ? { borderColor: color } : { background: color }}
    />
  );
}

/**
 * 3D 보기 패널: 보기 바꾸기, 장면, 범례, 상차 지점 바꾸기. 점군은 열 때 한 번 받는다.
 */
export function ScanViewer({
  view,
  orgId,
  canAct,
  onUpdated,
}: {
  view: ScanView;
  orgId: string;
  canAct: boolean;
  onUpdated: (view: ScanView) => void;
}) {
  const proposal = view.layout?.proposal ?? null;
  const [mode, setMode] = useState<Mode>("current");
  const shownMode: Mode = mode === "proposal" && proposal ? "proposal" : "current";
  const [webgl] = useState(() => hasWebgl());
  const [failed, setFailed] = useState(false);
  const [points, setPoints] = useState<{ id: string; cloud: PointCloud | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });
  const [resetSignal, setResetSignal] = useState(0);
  const use3d = webgl && !failed;

  useEffect(() => {
    if (!use3d) return;
    let alive = true;
    api
      .getScanPoints(orgId, view.id)
      .then((buffer) => {
        if (alive) setPoints({ id: view.id, cloud: parsePoints(buffer), error: null });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        const message =
          error instanceof ApiError || error instanceof ApiUnreachable ? error.message : "3D 장면을 불러오지 못했습니다.";
        setPoints({ id: view.id, cloud: null, error: message });
      });
    return () => {
      alive = false;
    };
  }, [orgId, view.id, use3d, attempt]);

  const current = points?.id === view.id ? points : null;
  const layout = view.layout;
  const tokens = zoneTokens(view);
  const unassigned = view.piles.some((pile) => !pile.streamId);

  const choose = (x: number, y: number) => {
    if (pick.busy) return;
    const polygon = view.floor?.polygon ?? [];
    if (polygon.length >= 3 && !insidePolygon(x, y, polygon)) {
      setPick({ busy: false, message: PICK_OUTSIDE });
      return;
    }
    void send({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };
  const send = async (pickup: { x: number; y: number } | null) => {
    setPick({ busy: true, message: null });
    try {
      const next = await api.putScanLayout(orgId, view.id, pickup);
      setPicking(false);
      setPick({ busy: false, message: null });
      onUpdated(next);
    } catch (error) {
      setPick({ busy: false, message: error instanceof Error ? error.message : "상차 지점을 바꾸지 못했습니다." });
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="배치 보기" className="inline-flex rounded-[10px] border border-line-strong p-0.5">
          {(
            [
              ["current", "지금 배치"],
              ["proposal", "정리안"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={shownMode === key}
              disabled={key === "proposal" && !proposal}
              onClick={() => setMode(key)}
              className={`min-h-11 rounded-[8px] px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:text-muted ${
                shownMode === key ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {use3d ? (
          <Button variant="ghost" size="sm" onClick={() => setResetSignal((value) => value + 1)}>
            시점 처음으로
          </Button>
        ) : null}
      </div>
      {!proposal && layout?.unavailable ? <p className="text-[13px] text-muted">{layout.unavailable}</p> : null}

      {use3d ? (
        current?.cloud ? (
          <Scene3D
            view={view}
            cloud={current.cloud}
            mode={shownMode}
            picking={picking}
            resetSignal={resetSignal}
            onPick={choose}
            onFail={() => setFailed(true)}
          />
        ) : current?.error ? (
          <div role="alert" className="grid h-[200px] place-items-center rounded-[14px] bg-ground px-4 text-center text-sm">
            <div>
              <p className="text-ink-2">{current.error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAttempt((value) => value + 1)}>
                다시 시도
              </Button>
            </div>
          </div>
        ) : (
          <p className="grid h-[340px] place-items-center rounded-[14px] bg-photo text-sm text-white/70 sm:h-[440px]">
            3D 장면을 불러오는 중입니다.
          </p>
        )
      ) : (
        <>
          <TopView view={view} mode={shownMode} picking={picking} onPick={choose} />
          <p className="text-[12.5px] text-muted">이 브라우저에서는 3D를 그리지 못해 위에서 본 평면도로 보여 드립니다.</p>
        </>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2" aria-label="범례">
        {shownMode === "current" ? (
          <>
            <li className="flex items-center gap-1.5">
              <Swatch color="var(--color-marker)" />
              AI가 찾은 더미
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch color="var(--color-muted)" />
              찍으며 걸은 길
            </li>
          </>
        ) : (
          <>
            {(proposal?.zones ?? []).map((zone) => (
              <li key={zone.streamId} className="flex items-center gap-1.5">
                <Swatch color={`var(${tokens.get(zone.streamId) ?? "--color-muted"})`} />
                {zone.name}
              </li>
            ))}
            {unassigned ? (
              <li className="flex items-center gap-1.5">
                <Swatch color={UNASSIGNED_COLOR} />
                폐기물 미지정(제자리)
              </li>
            ) : null}
            {layout ? (
              <li className="flex items-center gap-1.5">
                <Swatch color="var(--color-ink)" ring />
                상차 지점 둘레 {layout.rules.pickupClearM} m 비움
              </li>
            ) : null}
          </>
        )}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-1 rounded-full bg-ink" />
          상차 지점
        </li>
      </ul>

      {layout ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[13px]">
          <span className="text-ink-2">
            상차 지점: {layout.pickup.source === "manual" ? "직접 정한 곳" : "영상을 찍기 시작한 곳"}
          </span>
          {canAct ? (
            picking ? (
              <>
                <span className="font-medium text-ink">바닥에서 트럭에 싣는 곳을 눌러 주세요.</span>
                <Button variant="ghost" size="sm" onClick={() => setPicking(false)} disabled={pick.busy}>
                  그만두기
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setPicking(true)} disabled={pick.busy}>
                  상차 지점 바꾸기
                </Button>
                {layout.pickup.source === "manual" ? (
                  <Button variant="ghost" size="sm" onClick={() => void send(null)} disabled={pick.busy}>
                    찍기 시작한 곳으로 되돌리기
                  </Button>
                ) : null}
              </>
            )
          ) : null}
          {pick.busy ? <span className="text-muted">정리안을 다시 그리는 중입니다.</span> : null}
          {pick.message ? (
            <span role="alert" className="text-loss">
              {pick.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
