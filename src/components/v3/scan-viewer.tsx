"use client";

/**
 * 보관장 3D 보기(DESIGN.md "보관장 3D 스캔"). 점군과 AI가 찾은 더미 테두리(`marker`), 바닥, 상차 지점을 그리고,
 * "지금 배치 | 정리안"을 바꿔 본다. 정리안은 서버의 배치 규칙이 정한 자리이고 화면은 그대로 그리기만 한다.
 * three.js는 이 보기를 열 때만 불러온다(서버 렌더와 첫 화면에 넣지 않는다). WebGL이 없으면 위에서 본 평면도(SVG)로 대신한다.
 * 자동 회전은 하지 않고, 화면은 움직일 때만 다시 그린다.
 * 상차 지점은 바닥을 누르거나, 키보드로 화살표(0.5 m씩, 3D에서는 보이는 방향 기준)와 Enter로 정한다. Esc로 그만둔다.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type * as Three from "three";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { useEscape } from "@/components/use-escape";
import { ApiError, ApiUnreachable, api } from "@/lib/v3/api";
import { UNAVAILABLE } from "@/lib/v3/errors";
import { insidePolygon, parsePoints, zoneOrder, zoneToken, type PointCloud } from "@/lib/v3/scan";
import type { ScanView } from "@/lib/v3/types";

type Mode = "current" | "proposal";
type XY = readonly [number, number];
type Point = { x: number; y: number };

const PICK_OUTSIDE = "보관장 바닥 안을 골라 주세요.";
const UNASSIGNED_COLOR = "#9a9aa3";
/** 키보드로 상차 지점을 옮기는 한 걸음(m) */
const STEP_M = 0.5;
const MODES: readonly (readonly [Mode, string])[] = [
  ["current", "지금 배치"],
  ["proposal", "정리안"],
];

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

/** 폐기물(streamId) → 정리안 색 토큰. 정리안 영역 순서, 그다음 제자리에 둔 더미의 폐기물 순서 */
function zoneTokens(view: ScanView): Map<string, string> {
  return new Map(zoneOrder(view).map((id, index) => [id, zoneToken(index)]));
}

/**
 * 더미 하나가 놓일 자리. 정리안에서 옮길 자리가 없어 제자리에 둔 더미(kept)는 지금 자리에 그 폐기물 색으로,
 * 폐기물을 고르지 않은 더미는 지금 자리에 회색으로 둔다.
 */
function placed(view: ScanView, mode: Mode) {
  const proposal = mode === "proposal" ? view.layout?.proposal : null;
  const kept = new Set(proposal?.kept ?? []);
  return view.piles.map((pile) => {
    const moved = kept.has(pile.id) ? undefined : proposal?.piles.find((item) => item.id === pile.id);
    return {
      pile,
      footprint: (moved?.footprint ?? pile.footprint) as XY[],
      center: (moved?.center ?? pile.center) as XY,
      zone: moved ? moved.zone : pile.streamId,
      kept: kept.has(pile.id),
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
  labels: { el: HTMLSpanElement; at: Three.Vector3; below: boolean }[];
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

type PickProps = {
  picking: boolean;
  draft: Point | null;
  /** 바닥을 누른 곳으로 바로 정한다 */
  onPick: (x: number, y: number) => void;
  /** 키보드로 후보를 dx, dy(m)만큼 옮긴다 */
  onNudge: (dx: number, dy: number) => void;
  /** 키보드 후보로 정한다 */
  onConfirm: () => void;
};

/** 3D 장면. 점군과 겹쳐 그릴 것을 props가 바뀔 때마다 다시 만든다(점군 자체는 한 번만 만든다) */
function Scene3D({
  view,
  cloud,
  mode,
  resetSignal,
  picking,
  draft,
  onPick,
  onNudge,
  onConfirm,
  onFail,
}: {
  view: ScanView;
  cloud: PointCloud;
  mode: Mode;
  resetSignal: number;
  onFail: () => void;
} & PickProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const pickRef = useRef({ picking, onPick });
  useEffect(() => {
    pickRef.current = { picking, onPick };
  }, [picking, onPick]);

  // 상차 지점을 고르기 시작하면 장면에 초점을 둬 화살표 키를 받는다
  useEffect(() => {
    if (picking) hostRef.current?.focus({ preventScroll: true });
  }, [picking]);

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
            // 더미 이름은 점 위에, 상차 지점은 점 아래에 달아 서로 겹치지 않게 한다
            const lift = label.below ? "translate(-50%, 6px)" : "translate(-50%, -100%)";
            label.el.style.transform = `${lift} translate(${((at.x + 1) / 2) * width}px, ${((1 - at.y) / 2) * height}px)`;
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
    const addLabel = (text: string, x: number, y: number, z: number, below = false) => {
      if (!labelsHost) return;
      const el = document.createElement("span");
      el.textContent = text;
      el.className =
        "pointer-events-none absolute top-0 left-0 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-white";
      labelsHost.append(el);
      engine.labels.push({ el, at: new THREE.Vector3(x, y, z), below });
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

    // 더미. 정리안에서 제자리에 둔 더미는 옅은 면과 점선 테두리로 옮긴 더미와 가른다
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
          opacity: mode === "proposal" ? (item.kept ? 0.25 : 0.55) : 0.1,
          depthWrite: mode === "proposal" && !item.kept,
        }),
      );
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        item.kept && mode === "proposal"
          ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08 })
          : new THREE.LineBasicMaterial({ color }),
      );
      if (item.kept && mode === "proposal") edges.computeLineDistances();
      faces.renderOrder = 2;
      edges.renderOrder = 2;
      engine.overlay.add(faces, edges);
      addLabel(item.kept && mode === "proposal" ? `${item.pile.name} 제자리` : item.pile.name, item.center[0], item.center[1], height + 0.08);
    }

    // 상차 지점과 비워 두는 반경
    const ink = "#f4f4f5";
    const pickup = view.layout?.pickup;
    if (pickup) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 16), new THREE.MeshBasicMaterial({ color: ink }));
      pillar.rotation.x = Math.PI / 2;
      pillar.position.set(pickup.x, pickup.y, 0.8);
      engine.overlay.add(pillar);
      addLabel("상차 지점", pickup.x, pickup.y, 0, true);
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
    // 키보드로 옮기는 상차 지점 후보
    if (picking && draft) {
      const candidate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1.6, 16),
        new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.45 }),
      );
      candidate.rotation.x = Math.PI / 2;
      candidate.position.set(draft.x, draft.y, 0.8);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.24, 32),
        new THREE.MeshBasicMaterial({ color: ink, side: THREE.DoubleSide }),
      );
      ring.position.set(draft.x, draft.y, 0.01);
      engine.overlay.add(candidate, ring);
      addLabel("새 상차 지점", draft.x, draft.y, 1.7);
    }

    // 찍으며 걸은 길(지금 배치에서만)
    if (mode === "current" && view.camera && view.camera.path.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(view.camera.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      engine.overlay.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: floorColor, transparent: true, opacity: 0.7 })));
    }
    engine.render();
  }, [ready, view, cloud, mode, picking, draft]);

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

  /** 화살표는 지금 보이는 방향 기준으로 옮긴다(위 = 화면 안쪽, 오른쪽 = 화면 오른쪽) */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!picking) return;
    const engine = engineRef.current;
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
      return;
    }
    const keys: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] };
    const step = keys[event.key];
    if (!step || !engine) return;
    event.preventDefault();
    const forward = new engine.THREE.Vector2(
      engine.controls.target.x - engine.camera.position.x,
      engine.controls.target.y - engine.camera.position.y,
    );
    if (forward.lengthSq() < 1e-9) forward.set(0, 1);
    forward.normalize();
    const right = new engine.THREE.Vector2(forward.y, -forward.x);
    const dx = (right.x * step[0] + forward.x * step[1]) * STEP_M;
    const dy = (right.y * step[0] + forward.y * step[1]) * STEP_M;
    onNudge(dx, dy);
  };

  return (
    <div
      ref={hostRef}
      role={picking ? "application" : "img"}
      tabIndex={picking ? 0 : -1}
      onKeyDown={onKeyDown}
      aria-label={
        picking
          ? "상차 지점 고르기. 바닥을 누르거나, 화살표 키로 0.5 m씩 옮기고 Enter로 정합니다. Esc로 그만둡니다."
          : "보관장 3D 장면. 끌어서 돌리고, 두 손가락이나 휠로 가까이 볼 수 있습니다."
      }
      className={`relative h-[340px] w-full overflow-hidden rounded-[14px] bg-photo outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink sm:h-[440px] ${picking ? "cursor-crosshair" : "cursor-grab"}`}
    >
      <div ref={labelsRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
      {!ready ? <p className="absolute inset-0 grid place-items-center text-sm text-white/70">3D 장면을 준비하는 중입니다.</p> : null}
    </div>
  );
}

/** WebGL이 없을 때: 위에서 본 평면도. 같은 자리·색·이름으로 그리고, 화살표는 평면도의 위·아래·왼쪽·오른쪽이다 */
function TopView({ view, mode, picking, draft, onPick, onNudge, onConfirm }: { view: ScanView; mode: Mode } & PickProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (picking) svgRef.current?.focus({ preventScroll: true });
  }, [picking]);
  const polygon = view.floor?.polygon ?? [];
  const all: XY[] = [...polygon, ...view.piles.flatMap((pile) => pile.footprint as XY[])];
  for (const item of view.layout?.proposal?.piles ?? []) all.push(...(item.footprint as XY[]));
  if (view.layout) {
    // 비워 두는 원이 가장자리에서 잘리지 않게 반경까지 넣는다
    const { x, y } = view.layout.pickup;
    const r = view.layout.rules.pickupClearM;
    all.push([x - r, y - r], [x + r, y + r]);
  }
  for (const [x, y] of view.camera?.path ?? []) all.push([x, y]);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 0.4;
  const minX = Math.min(...xs, 0) - pad;
  const maxX = Math.max(...xs, 0) + pad;
  const minY = Math.min(...ys, 0) - pad;
  const maxY = Math.max(...ys, 0) + pad;
  // 좌표는 cm로 그린다(m 단위의 아주 작은 글자 크기는 브라우저가 글자를 겹쳐 그린다)
  const S = 100;
  const toSvg = ([x, y]: XY) => `${((x - minX) * S).toFixed(1)},${((maxY - y) * S).toFixed(1)}`;
  const tokens = zoneTokens(view);
  const fillOf = (zone: string | null) => (zone && tokens.has(zone) ? `var(${tokens.get(zone)})` : UNASSIGNED_COLOR);
  const click = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!picking || !svgRef.current) return;
    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onPick(point.x / S + minX, maxY - point.y / S);
  };
  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!picking) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
      return;
    }
    const keys: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] };
    const step = keys[event.key];
    if (!step) return;
    event.preventDefault();
    onNudge(step[0] * STEP_M, step[1] * STEP_M);
  };
  const pickup = view.layout?.pickup;
  return (
    <svg
      ref={svgRef}
      role={picking ? "application" : "img"}
      tabIndex={picking ? 0 : -1}
      aria-label={picking ? "상차 지점 고르기. 평면도를 누르거나, 화살표 키로 0.5 m씩 옮기고 Enter로 정합니다. Esc로 그만둡니다." : "위에서 본 보관장 평면도"}
      viewBox={`0 0 ${((maxX - minX) * S).toFixed(1)} ${((maxY - minY) * S).toFixed(1)}`}
      className={`h-[340px] w-full rounded-[14px] bg-surface ring-1 ring-line outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink sm:h-[440px] ${picking ? "cursor-crosshair" : ""}`}
      onClick={click}
      onKeyDown={onKeyDown}
    >
      {polygon.length >= 3 ? (
        <polygon points={polygon.map(toSvg).join(" ")} fill="var(--color-ground)" stroke="var(--color-line-strong)" strokeWidth={4} />
      ) : null}
      {mode === "current" && view.camera && view.camera.path.length >= 2 ? (
        <polyline
          points={view.camera.path.map(([x, y]) => toSvg([x, y])).join(" ")}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={3.5}
          strokeOpacity={0.8}
        />
      ) : null}
      {mode === "proposal"
        ? (view.layout?.proposal?.zones ?? []).map((zone) => (
            <polygon
              key={zone.streamId}
              points={zone.polygon.map(toSvg).join(" ")}
              fill={fillOf(zone.streamId)}
              fillOpacity={0.15}
              stroke={fillOf(zone.streamId)}
              strokeWidth={3}
            />
          ))
        : null}
      {placed(view, mode).map((item) => {
        const [cx, cy] = toSvg(item.center).split(",").map(Number);
        const side = Math.min(item.pile.sizeM[0], item.pile.sizeM[1]);
        // 작은 더미는 번호만 적고 글자를 줄여 테두리 밖으로 넘치지 않게 한다
        const full = item.pile.name.length * 0.3 <= Math.max(item.pile.sizeM[0], item.pile.sizeM[1]) * 0.9;
        const text = full ? item.pile.name : item.pile.name.replace(/^\D+/, "");
        const fontSize = Math.max(14, Math.min(30, side * 45));
        const kept = mode === "proposal" && item.kept;
        return (
          <g key={item.pile.id}>
            <polygon
              points={item.footprint.map(toSvg).join(" ")}
              fill={mode === "proposal" ? fillOf(item.zone) : "var(--color-marker)"}
              fillOpacity={mode === "proposal" ? (kept ? 0.25 : 0.6) : 0.5}
              stroke={mode === "proposal" ? fillOf(item.zone) : "var(--color-marker-ink)"}
              strokeDasharray={kept ? "12 8" : undefined}
              strokeWidth={4}
            />
            <text x={cx} y={cy} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle" className="fill-ink">
              {text}
            </text>
          </g>
        );
      })}
      {view.layout && pickup ? (
        <g>
          {mode === "proposal" ? (
            <circle
              cx={(pickup.x - minX) * S}
              cy={(maxY - pickup.y) * S}
              r={view.layout.rules.pickupClearM * S}
              fill="none"
              stroke="var(--color-ink)"
              strokeDasharray="12 10"
              strokeWidth={3}
            />
          ) : null}
          <circle cx={(pickup.x - minX) * S} cy={(maxY - pickup.y) * S} r={14} fill="var(--color-ink)" />
        </g>
      ) : null}
      {picking && draft ? (
        <circle cx={(draft.x - minX) * S} cy={(maxY - draft.y) * S} r={20} fill="none" stroke="var(--color-ink)" strokeWidth={5} />
      ) : null}
    </svg>
  );
}

function Swatch({ color, ring = false, dashed = false }: { color: string; ring?: boolean; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 shrink-0 rounded-[3px] ${ring ? "border-2 bg-transparent" : ""} ${dashed ? "border-2 border-dashed" : ""}`}
      style={ring || dashed ? { borderColor: color } : { background: color }}
    />
  );
}

/** 오류를 사용자 문장으로. 코드 오류 문장은 내보내지 않는다 */
function friendly(error: unknown): string {
  return error instanceof ApiError || error instanceof ApiUnreachable ? error.message : UNAVAILABLE;
}

/**
 * 3D 보기 패널: 보기 바꾸기(라디오 그룹, 화살표 키), 장면, 범례, 상차 지점 바꾸기. 점군은 열 때 한 번 받는다.
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
  const [draft, setDraft] = useState<Point | null>(null);
  const [pick, setPick] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });
  const [resetSignal, setResetSignal] = useState(0);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const changeButton = useRef<HTMLButtonElement>(null);
  const use3d = webgl && !failed;
  const layout = view.layout;

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
        const message = error instanceof ApiError || error instanceof ApiUnreachable ? error.message : "3D 장면을 불러오지 못했습니다.";
        setPoints({ id: view.id, cloud: null, error: message });
      });
    return () => {
      alive = false;
    };
  }, [orgId, view.id, use3d, attempt]);

  const stopPicking = useCallback(() => {
    setPicking(false);
    setDraft(null);
    setPick({ busy: false, message: null });
    window.requestAnimationFrame(() => changeButton.current?.focus({ preventScroll: true }));
  }, []);
  // Esc로 상차 지점 고르기를 그만둔다(근거 패널이 위에 열려 있으면 그것부터 닫힌다)
  useEscape(picking, stopPicking);

  const current = points?.id === view.id ? points : null;
  const tokens = zoneTokens(view);
  const unassigned = view.piles.some((pile) => !pile.streamId);
  const kept = view.piles.filter((pile) => proposal?.kept?.includes(pile.id));
  const legendZones = [
    ...(proposal?.zones ?? []).map((zone) => ({ id: zone.streamId, name: zone.name })),
    ...kept
      .filter((pile) => pile.streamId && !(proposal?.zones ?? []).some((zone) => zone.streamId === pile.streamId))
      .map((pile) => ({ id: pile.streamId as string, name: pile.streamName ?? pile.name })),
  ].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  const floorPolygon = view.floor?.polygon ?? [];
  const inside = (x: number, y: number) => floorPolygon.length < 3 || insidePolygon(x, y, floorPolygon);

  const send = async (pickup: Point | null) => {
    setPick({ busy: true, message: null });
    try {
      const next = await api.putScanLayout(orgId, view.id, pickup);
      setPicking(false);
      setDraft(null);
      setPick({ busy: false, message: null });
      onUpdated(next);
      window.requestAnimationFrame(() => changeButton.current?.focus({ preventScroll: true }));
    } catch (error) {
      setPick({ busy: false, message: friendly(error) });
    }
  };
  const choose = (x: number, y: number) => {
    if (pick.busy) return;
    if (!inside(x, y)) {
      setPick({ busy: false, message: PICK_OUTSIDE });
      return;
    }
    void send({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };
  const nudge = (dx: number, dy: number) => {
    const base = draft ?? (layout ? { x: layout.pickup.x, y: layout.pickup.y } : { x: 0, y: 0 });
    const next = { x: Math.round((base.x + dx) * 100) / 100, y: Math.round((base.y + dy) * 100) / 100 };
    if (!inside(next.x, next.y)) {
      setPick({ busy: false, message: PICK_OUTSIDE });
      return;
    }
    setDraft(next);
    setPick({ busy: false, message: null });
  };
  const confirm = () => {
    if (draft) choose(draft.x, draft.y);
  };
  const startPicking = () => {
    setPicking(true);
    setDraft(layout ? { x: layout.pickup.x, y: layout.pickup.y } : null);
    setPick({ busy: false, message: null });
  };

  /** 라디오 그룹: 화살표로 옮기며 고른다. 끈 항목(정리안 없음)은 건너뛴다 */
  const onRadioKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    for (let step = 1; step <= MODES.length; step += 1) {
      const next = (index + delta * step + MODES.length * step) % MODES.length;
      const [key] = MODES[next];
      if (key === "proposal" && !proposal) continue;
      setMode(key);
      radios.current[next]?.focus();
      return;
    }
  };

  const pickProps: PickProps = { picking, draft, onPick: choose, onNudge: nudge, onConfirm: confirm };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="배치 보기" className="inline-flex rounded-[10px] border border-line-strong p-0.5">
          {MODES.map(([key, label], index) => (
            <button
              key={key}
              ref={(element) => {
                radios.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={shownMode === key}
              tabIndex={shownMode === key ? 0 : -1}
              disabled={key === "proposal" && !proposal}
              onClick={() => setMode(key)}
              onKeyDown={(event) => onRadioKey(event, index)}
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

      {use3d ? (
        current?.cloud ? (
          <Scene3D
            view={view}
            cloud={current.cloud}
            mode={shownMode}
            resetSignal={resetSignal}
            onFail={() => setFailed(true)}
            {...pickProps}
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
          <TopView view={view} mode={shownMode} {...pickProps} />
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
            {legendZones.map((zone) => (
              <li key={zone.id} className="flex items-center gap-1.5">
                <Swatch color={`var(${tokens.get(zone.id) ?? "--color-muted"})`} />
                {zone.name}
              </li>
            ))}
            {kept.length > 0 ? (
              <li className="flex items-center gap-1.5">
                <Swatch color="var(--color-ink-2)" dashed />
                점선: 옮길 자리가 없어 제자리
              </li>
            ) : null}
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
        <div className="space-y-1 border-t border-line pt-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-ink-2">상차 지점: {layout.pickup.source === "manual" ? "직접 정한 곳" : "영상을 찍기 시작한 곳"}</span>
            {canAct ? (
              picking ? (
                <>
                  <Button variant="secondary" size="sm" onClick={confirm} disabled={!draft} aria-disabled={pick.busy || undefined}>
                    여기로 정하기
                  </Button>
                  <Button variant="ghost" size="sm" onClick={stopPicking}>
                    그만두기
                  </Button>
                </>
              ) : (
                <>
                  <Button ref={changeButton} variant="ghost" size="sm" onClick={startPicking} aria-disabled={pick.busy || undefined}>
                    상차 지점 바꾸기
                  </Button>
                  {layout.pickup.source === "manual" ? (
                    <Button variant="ghost" size="sm" onClick={() => void send(null)} aria-disabled={pick.busy || undefined}>
                      찍기 시작한 곳으로 되돌리기
                    </Button>
                  ) : null}
                </>
              )
            ) : null}
          </div>
          {picking ? (
            <p className="text-[12.5px] text-ink-2">
              바닥에서 트럭에 싣는 곳을 누르세요. 키보드로는 장면에서 화살표 키로 0.5 m씩 옮기고 Enter로 정합니다. Esc로 그만둡니다.
            </p>
          ) : null}
          <p aria-live="polite" className={pick.message ? "text-[12.5px] text-loss" : "sr-only"}>
            {pick.busy ? "정리안을 다시 그리는 중입니다." : (pick.message ?? "")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
