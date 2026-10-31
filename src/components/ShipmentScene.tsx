import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { num0 } from '../lib/format';
import { C } from '../lib/theme';
import type { Mode } from '../lib/types';

/** Parts of the scene the user can click to change the matching input. */
export type Hotspot = 'cargo' | 'vehicle' | 'destination' | 'route';

export interface ShipmentSceneProps {
  tonnes: number;
  material: string;
  mode: Mode;
  km: number;
  seaKm: number;
  emptyReturn: boolean;
  destination: string;
  onPick: (h: Hotspot) => void;
  className?: string;
}

const HINT: Record<Hotspot, string> = {
  cargo: 'Change material or tonnes',
  vehicle: 'Change transport',
  route: 'Change distance or transport',
  destination: 'Change destination',
};

const TRUCK_T = 24;
const WAGON_T = 60;
const BALE_SLOTS = 12;

/**
 * A small 3D diorama of the shipment before it is calculated: the LZP depot in Riga (A), the route
 * to the recycler (B), and the vehicles carrying the load, drawn from the user's inputs. The model
 * is illustrative (distances are not to scale; vehicles are capped at a few for readability).
 */
export function ShipmentScene({ tonnes, material, mode, km, seaKm, emptyReturn, destination, onPick, className = '' }: ShipmentSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Renderer, scene, camera ----------------------------------------------------------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(labels.domElement);

    const BG = 0xeef1ef;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 70, 130);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
    camera.position.set(-6, 36, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 25;
    controls.maxDistance = 95;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb6c0bb, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(18, 40, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 1, far: 120 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const mat = (color: string | number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
    const box = (w: number, h: number, d: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.castShadow = mesh.receiveShadow = true;
      return mesh;
    };
    const tag = (obj: THREE.Object3D, h: Hotspot) => { obj.userData.hotspot = h; return obj; };

    /* Ground and route ------------------------------------------------------------------ */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 140), mat('#E2E7E4', { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-21, 0, 2), new THREE.Vector3(-11, 0, -5), new THREE.Vector3(0, 0, 3), new THREE.Vector3(11, 0, -4), new THREE.Vector3(21, 0, 1),
    ]);
    const len = curve.getLength();
    const tangentAt = (u: number) => curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1));
    /** Point on the route; beyond the ends it continues straight, so queued vehicles wait behind A. */
    const pointAt = (u: number) => {
      if (u >= 0 && u <= 1) return curve.getPointAt(u);
      const end = u < 0 ? 0 : 1;
      return curve.getPointAt(end).add(tangentAt(end).multiplyScalar((u - end) * len));
    };

    const ferry = mode === 'road+ferry';
    const rail = mode === 'rail';
    const seaShare = ferry ? THREE.MathUtils.clamp(seaKm / Math.max(1, km), 0.24, 0.45) : 0;
    const s1 = 0.5 - seaShare / 2, s2 = 0.5 + seaShare / 2;
    const onRoad = (u: number) => !ferry || u < s1 - 0.012 || u > s2 + 0.012;

    const routeGroup = tag(new THREE.Group(), 'route');
    scene.add(routeGroup);
    const N = 240;
    const ribbon = (width: number, y: number, m: THREE.Material, keep: (u: number) => boolean) => {
      const pos: number[] = [];
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N;
        if (!keep((u0 + u1) / 2)) continue;
        const quad = [u0, u1].map((u) => {
          const p = curve.getPointAt(u), t = curve.getTangentAt(u);
          const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
          return [p.clone().add(n), p.clone().sub(n)];
        });
        const [[a, b], [c, d]] = quad;
        pos.push(a.x, y, a.z, c.x, y, c.z, b.x, y, b.z, b.x, y, b.z, c.x, y, c.z, d.x, y, d.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      routeGroup.add(mesh);
    };
    if (rail) {
      ribbon(3.2, 0.03, mat('#C9D0CC', { roughness: 1 }), () => true); // ballast
      for (const off of [-0.7, 0.7]) {
        const pts = Array.from({ length: 120 }, (_, i) => {
          const u = i / 119, p = curve.getPointAt(u), t = curve.getTangentAt(u);
          return p.add(new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(off)).setY(0.22);
        });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.09, 6), mat('#6B7370', { metalness: 0.6, roughness: 0.35 }));
        routeGroup.add(tube);
      }
      for (let d = 0; d < len; d += 0.9) {
        const u = d / len, p = curve.getPointAt(u), t = curve.getTangentAt(u);
        const s = box(0.35, 0.14, 2.2, mat('#7A6A55'));
        s.position.set(p.x, 0.1, p.z);
        s.rotation.y = Math.atan2(-t.z, t.x);
        routeGroup.add(s);
      }
    } else {
      ribbon(3, 0.03, mat('#3A3F3C', { roughness: 0.9 }), onRoad);
      const dash = mat('#F4F6F2');
      for (let d = 1; d < len; d += 2.2) {
        const u = d / len;
        if (!onRoad(u)) continue;
        const p = curve.getPointAt(u), t = curve.getTangentAt(u);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.14), dash);
        m.position.set(p.x, 0.06, p.z);
        m.rotation.y = Math.atan2(-t.z, t.x);
        routeGroup.add(m);
      }
    }

    // Sea between the two ferry docks, with gently moving waves.
    let water: THREE.Mesh | null = null;
    if (ferry) {
      const x1 = curve.getPointAt(s1).x + 1.2, x2 = curve.getPointAt(s2).x - 1.2;
      const geo = new THREE.PlaneGeometry(x2 - x1, 160, 40, 80);
      water = new THREE.Mesh(geo, mat('#A9C4C8', { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95, flatShading: true }));
      water.rotation.x = -Math.PI / 2;
      water.position.set((x1 + x2) / 2, 0.18, 0);
      water.receiveShadow = true;
      scene.add(water);
      for (const u of [s1, s2]) {
        const p = curve.getPointAt(u - (u === s1 ? 0.02 : -0.02));
        const dock = box(3.6, 0.5, 6, mat('#8C8F86'));
        dock.position.set(p.x, 0.25, p.z);
        scene.add(dock);
      }
    }

    /* Buildings ---------------------------------------------------------------------------- */
    const A = curve.getPointAt(0), B = curve.getPointAt(1);
    const depot = new THREE.Group();
    const hall = box(7, 3.4, 6, mat(C.coal));
    hall.position.y = 1.7;
    const band = box(7.05, 0.45, 6.05, mat(C.lime, { emissive: C.lime, emissiveIntensity: 0.15 }));
    band.position.y = 2.9;
    const door = box(0.1, 2.2, 3, mat('#555B58'));
    door.position.set(3.52, 1.1, 0);
    depot.add(hall, band, door);
    depot.position.set(A.x - 6.2, 0, A.z);
    scene.add(depot);

    const plant = tag(new THREE.Group(), 'destination');
    const glow = mat(C.lime, { emissive: C.lime, emissiveIntensity: 0.1 });
    const pHall = box(8, 4, 7, mat('#F5F7F4'));
    pHall.position.y = 2;
    const roof = box(8.2, 0.4, 7.2, glow);
    roof.position.y = 4.2;
    plant.add(pHall, roof);
    [-2, 1.2].forEach((z, i) => {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 5.6 - i, 20), mat('#D8DED9', { metalness: 0.3, roughness: 0.4 }));
      silo.position.set(-1.5 + i * 3, (5.6 - i) / 2, z - 4.8);
      silo.castShadow = true;
      plant.add(silo);
    });
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 8, 12), mat('#9AA29E'));
    chimney.position.set(3, 4, -2.4);
    chimney.castShadow = true;
    plant.add(chimney);
    plant.position.set(B.x + 6.5, 0, B.z);
    scene.add(plant);

    // Low-poly trees, kept off the route and the sea.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const samples = Array.from({ length: 80 }, (_, i) => curve.getPointAt(i / 79));
    const leaf = mat(C.lime700, { flatShading: true }), trunk = mat('#6E6A5E');
    for (let i = 0; i < 70; i++) {
      const x = -48 + rnd() * 96, z = -32 + rnd() * 64;
      const p = new THREE.Vector3(x, 0, z);
      if (samples.some((s) => s.distanceTo(p) < 4.5) || p.distanceTo(depot.position) < 7 || p.distanceTo(plant.position) < 9) continue;
      if (water && Math.abs(x - water.position.x) < (water.geometry as THREE.PlaneGeometry).parameters.width / 2 + 1.5) continue;
      const s = 0.7 + rnd() * 0.7;
      const t = new THREE.Group();
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 2.8 * s, 6), leaf);
      c.position.y = 2.2 * s;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1 * s, 5), trunk);
      st.position.y = 0.5 * s;
      c.castShadow = st.castShadow = true;
      t.add(c, st);
      t.position.copy(p);
      scene.add(t);
    }

    /* Vehicles and load ---------------------------------------------------------------- */
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16).rotateX(Math.PI / 2);
    const wheelMat = mat('#1E211F');
    const wheels: THREE.Mesh[] = [];
    const addWheels = (g: THREE.Group, xs: number[], halfW: number) => {
      for (const x of xs) for (const z of [-halfW, halfW]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(x, 0.42, z);
        w.castShadow = true;
        g.add(w);
        wheels.push(w);
      }
    };
    const baleMat = mat('#F7F9F5', { roughness: 0.35 });
    const strapMat = mat(C.lime);
    const bales: THREE.Object3D[] = [];
    /** Bales on a deck: up to 12 slots (3 long × 2 wide × 2 high), filled to the load share. */
    const load = (g: THREE.Group, x0: number, y0: number, share: number) => {
      const cargo = tag(new THREE.Group(), 'cargo');
      const n = Math.max(share > 0 ? 1 : 0, Math.round(share * BALE_SLOTS));
      for (let i = 0; i < n; i++) {
        const lx = i % 3, lz = Math.floor(i / 3) % 2, ly = Math.floor(i / 6);
        const b = box(1.3, 0.95, 0.95, baleMat);
        b.position.set(x0 + lx * 1.4, y0 + 0.48 + ly * 0.98, (lz - 0.5) * 1.0);
        const strap = box(0.12, 0.97, 0.97, strapMat);
        strap.position.copy(b.position);
        cargo.add(b, strap);
      }
      g.add(cargo);
      bales.push(cargo);
      return cargo;
    };

    const truck = (share: number) => {
      const g = tag(new THREE.Group(), 'vehicle') as THREE.Group;
      const cab = box(1.7, 1.9, 2.1, mat(C.coal));
      cab.position.set(2.45, 1.45, 0);
      const glass = box(0.05, 0.7, 1.8, mat('#2E3A3F', { metalness: 0.4, roughness: 0.15 }));
      glass.position.set(3.31, 1.85, 0);
      const stripe = box(1.72, 0.18, 2.12, mat(C.lime));
      stripe.position.set(2.45, 1.0, 0);
      const deck = box(4.6, 0.25, 2.1, mat(C.olive));
      deck.position.set(-0.75, 0.75, 0);
      g.add(cab, glass, stripe, deck);
      addWheels(g, [2.5, 0.2, -2.2], 0.95);
      load(g, -2.15, 0.87, share);
      return g;
    };
    const locomotive = () => {
      const g = new THREE.Group();
      const body = box(5, 2.1, 2.1, mat(C.coal));
      body.position.set(0, 1.55, 0);
      const s = box(5.02, 0.3, 2.12, mat(C.lime));
      s.position.set(0, 1.2, 0);
      const cabWin = box(0.05, 0.6, 1.7, mat('#2E3A3F', { metalness: 0.4, roughness: 0.15 }));
      cabWin.position.set(2.52, 2.05, 0);
      g.add(body, s, cabWin);
      addWheels(g, [1.6, -1.6], 0.8);
      return g;
    };
    const wagon = (share: number) => {
      const g = new THREE.Group();
      const floor = box(4.8, 0.3, 2.1, mat(C.olive));
      floor.position.y = 0.8;
      for (const z of [-1, 1]) {
        const side = box(4.8, 0.7, 0.08, mat(C.olive));
        side.position.set(0, 1.25, z * 1.02);
        g.add(side);
      }
      g.add(floor);
      addWheels(g, [1.6, -1.6], 0.8);
      load(g, -1.4, 0.95, share);
      return g;
    };

    const units: { obj: THREE.Group; offset: number }[] = [];
    if (rail) {
      const wagons = Math.min(5, Math.max(1, Math.ceil(tonnes / WAGON_T)));
      const train = tag(new THREE.Group(), 'vehicle') as THREE.Group;
      scene.add(train);
      const loco = locomotive();
      train.add(loco);
      units.push({ obj: loco, offset: 0 });
      for (let i = 0; i < wagons; i++) {
        // Loads beyond the wagons shown (capped for readability) fill the last wagon.
        const share = i === wagons - 1 && tonnes > wagons * WAGON_T ? 1 : Math.min(1, (tonnes - i * WAGON_T) / WAGON_T);
        const w = wagon(Math.max(0.1, share));
        train.add(w);
        units.push({ obj: w, offset: (i + 1) * 5.4 });
      }
    } else {
      const trucks = Math.min(ferry ? 2 : 4, Math.max(1, Math.ceil(tonnes / TRUCK_T)));
      for (let i = 0; i < trucks; i++) {
        const share = Math.max(0.1, Math.min(1, (tonnes - i * TRUCK_T) / TRUCK_T));
        const t = truck(i === trucks - 1 && Math.ceil(tonnes / TRUCK_T) > trucks ? 1 : share);
        scene.add(t);
        units.push({ obj: t, offset: i * 7.2 });
      }
    }

    let boat: THREE.Group | null = null;
    if (ferry) {
      boat = tag(new THREE.Group(), 'vehicle') as THREE.Group;
      const hull = box(17, 1.3, 5.2, mat('#F5F7F4'));
      hull.position.y = 0.2;
      const line = box(17.05, 0.35, 5.25, mat(C.coal));
      line.position.y = -0.2;
      const bridge = box(3, 2.2, 4.2, mat('#F5F7F4'));
      bridge.position.set(-6.5, 1.95, 0);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.8, 12), mat(C.lime));
      funnel.position.set(-6.8, 3.9, 0);
      boat.add(hull, line, bridge, funnel);
      scene.add(boat);
    }

    /* Labels (also clickable) ----------------------------------------------------------- */
    const chip = (html: string, cls: string, hot?: Hotspot) => {
      const d = document.createElement('div');
      d.className = `rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-card whitespace-nowrap ${cls} ${hot ? 'cursor-pointer transition-transform hover:scale-105' : ''}`;
      d.innerHTML = html;
      d.style.pointerEvents = hot ? 'auto' : 'none';
      if (hot) {
        d.title = HINT[hot];
        d.addEventListener('click', (e) => { e.stopPropagation(); pick.current(hot); });
      }
      return new CSS2DObject(d);
    };
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const aLabel = chip('<span class="opacity-60">A</span>&nbsp; Riga · LZP depot', 'bg-coal text-white');
    aLabel.position.set(depot.position.x + 0.5, 4.3, depot.position.z);
    scene.add(aLabel);
    const bLabel = chip(`<span class="opacity-60">B</span>&nbsp; ${esc(destination)}`, 'bg-coal text-white', 'destination');
    bLabel.position.set(plant.position.x, 7.4, plant.position.z);
    scene.add(bLabel);
    const mid = curve.getPointAt(ferry ? 0.5 : 0.55);
    const kmLabel = chip(`${num0(km)} km${ferry ? ` · ${num0(seaKm)} km by sea` : ''}`, 'bg-white text-coal', 'route');
    kmLabel.position.set(mid.x, 1.2, mid.z + 4.2);
    scene.add(kmLabel);
    const loadText = `${num0(tonnes)} t ${esc(material)}`;
    const cargoLabel = chip(loadText, 'bg-lime text-coal', 'cargo');
    scene.add(cargoLabel);

    /* Hover and click picking ----------------------------------------------------------- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tip = document.createElement('div');
    tip.className = 'pointer-events-none absolute z-10 hidden rounded-lg bg-coal px-2.5 py-1 text-[11px] font-semibold text-white';
    el.appendChild(tip);
    const hotOf = (o: THREE.Object3D | null): { h: Hotspot; root: THREE.Object3D } | null => {
      for (let x = o; x; x = x.parent) if (x.userData.hotspot) return { h: x.userData.hotspot as Hotspot, root: x };
      return null;
    };
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const i of ray.intersectObjects(scene.children, true)) {
        const h = hotOf(i.object);
        if (h) return h;
      }
      return null;
    };
    let hovered: THREE.Object3D | null = null;
    const highlight = (root: THREE.Object3D | null) => {
      if (hovered === root) return;
      const set = (o: THREE.Object3D | null, on: boolean) => o?.traverse((m) => {
        const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!mm || !('emissive' in mm)) return;
        if (on) {
          m.userData.base = m.userData.base ?? mm;
          const c = mm.clone();
          c.emissive = new THREE.Color(C.lime);
          c.emissiveIntensity = 0.45;
          (m as THREE.Mesh).material = c;
        } else if (m.userData.base) {
          ((m as THREE.Mesh).material as THREE.Material).dispose();
          (m as THREE.Mesh).material = m.userData.base;
        }
      });
      set(hovered, false);
      set(root, true);
      hovered = root;
    };
    let down: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const h = hit(e);
      highlight(h?.root ?? null);
      renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
      const r = el.getBoundingClientRect();
      if (h) {
        tip.textContent = HINT[h.h];
        tip.style.left = `${e.clientX - r.left + 14}px`;
        tip.style.top = `${e.clientY - r.top + 14}px`;
        tip.classList.remove('hidden');
      } else tip.classList.add('hidden');
    };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const h = hit(e);
        if (h) pick.current(h.h);
      }
      down = null;
    };
    const onLeave = () => { highlight(null); tip.classList.add('hidden'); };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    /* Sizing ------------------------------------------------------------------------------ */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      // Pull back on narrow screens so A and B both stay in view.
      camera.fov = w / h < 1.2 ? 52 : 36;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    /* Animation ----------------------------------------------------------------------------- */
    // One loop: load at A, drive to B, unload, then (if the trip back is empty) return empty.
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
    const LOAD = 1.2, DRIVE = 7.5, UNLOAD = 1.6, BACK = emptyReturn ? 5 : 0, REST = 1;
    const period = LOAD + DRIVE + UNLOAD + BACK + REST;
    const lastOffset = units.length ? units[units.length - 1].offset : 0;
    const place = (lead: number, flip: boolean) => {
      for (const { obj, offset } of units) {
        const u = lead - offset / len;
        const p = pointAt(u);
        const t = tangentAt(u);
        const onBoat = ferry && u > s1 && u < s2;
        const lift = onBoat ? 1.05 : 0;
        obj.position.set(p.x, rail ? 0.15 : lift, p.z);
        obj.rotation.y = Math.atan2(-t.z, t.x) + (flip ? Math.PI : 0);
      }
      if (boat) {
        const u = THREE.MathUtils.clamp(lead - lastOffset / len / 2, s1, s2);
        const p = curve.getPointAt(u), t = curve.getTangentAt(u);
        boat.position.set(p.x, 0.25, p.z);
        boat.rotation.y = Math.atan2(-t.z, t.x);
      }
      const head = pointAt(lead);
      cargoLabel.position.set(head.x, 6.2, head.z);
    };

    const clock = new THREE.Clock();
    let raf = 0;
    let lastLead = 0;
    const frame = () => {
      const time = reduce ? LOAD + DRIVE * 0.45 : clock.getElapsedTime() % period;
      let lead: number, flip = false, cargoScale = 1, loaded = true;
      const span = 1; // the front unit stops at B, the rest queue behind it
      if (time < LOAD) lead = 0;
      else if (time < LOAD + DRIVE) lead = ease((time - LOAD) / DRIVE) * span;
      else if (time < LOAD + DRIVE + UNLOAD) {
        lead = span;
        cargoScale = 1 - (time - LOAD - DRIVE) / UNLOAD;
      } else if (time < LOAD + DRIVE + UNLOAD + BACK) {
        lead = span * (1 - ease((time - LOAD - DRIVE - UNLOAD) / BACK));
        flip = true;
        cargoScale = 0;
        loaded = false;
      } else {
        lead = emptyReturn ? 0 : span;
        cargoScale = emptyReturn ? 1 : 0;
        loaded = emptyReturn;
      }
      place(lead, flip);
      for (const c of bales) c.scale.setScalar(Math.max(0.0001, cargoScale));
      (cargoLabel.element as HTMLElement).innerHTML = loaded ? loadText : 'Empty return';
      (cargoLabel.element as HTMLElement).className = (cargoLabel.element as HTMLElement).className.replace(/bg-(lime|white) text-coal/, loaded ? 'bg-lime text-coal' : 'bg-white text-coal');
      glow.emissiveIntensity = time > LOAD + DRIVE && time < LOAD + DRIVE + UNLOAD + 0.6 ? 0.25 + 0.5 * Math.sin(((time - LOAD - DRIVE) / UNLOAD) * Math.PI) : 0.1;
      const spin = ((lead - lastLead) * len) / 0.42;
      for (const w of wheels) w.rotation.z -= flip ? -spin : spin;
      lastLead = lead;
      if (water && !reduce) {
        const pos = (water.geometry as THREE.PlaneGeometry).attributes.position as THREE.BufferAttribute;
        const tt = clock.getElapsedTime();
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.9 + tt * 1.4) * 0.05 + Math.cos(pos.getY(i) * 0.7 + tt) * 0.05);
        pos.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.dispose();
      el.innerHTML = '';
    };
  }, [tonnes, material, mode, km, seaKm, emptyReturn, destination]);

  return <div ref={host} className={`relative overflow-hidden ${className}`} />;
}
