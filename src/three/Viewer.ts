import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Axis, Mark, Part, Project, Vec3 } from '../core/types';
import { MATERIALS } from '../core/materials';
import { boundsOf } from '../core/builder';
import { corazonPoints, romboPoints, volutaPoints } from '../core/curves';

const AX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const ACCENT = new THREE.Color('#c7341b');
const SELECT = new THREE.Color('#f2c230');
const BLACK = new THREE.Color(0x000000);
const EDGE_DARK = new THREE.Color('#3a2f22');
const EDGE_STEEL = new THREE.Color('#20262b');
const WELD = new THREE.Color('#ff7a1a');
const INK = '#1d1b18';

// ---------- texturas procedurales (compartidas) ----------

let grainTex: THREE.CanvasTexture | null = null;
function woodGrain(): THREE.CanvasTexture {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // bandas anchas de tono (anillos de crecimiento cortados a lo largo)
  for (let i = 0; i < 26; i++) {
    const y = rnd() * c.height;
    const h = 8 + rnd() * 34;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    const a = 0.04 + rnd() * 0.08;
    grad.addColorStop(0, 'rgba(120, 78, 30, 0)');
    grad.addColorStop(0.5, `rgba(120, 78, 30, ${a})`);
    grad.addColorStop(1, 'rgba(120, 78, 30, 0)');
    g.fillStyle = grad;
    g.fillRect(0, y, c.width, h);
  }
  // vetas finas onduladas
  for (let i = 0; i < 170; i++) {
    const y = rnd() * c.height;
    g.strokeStyle = `rgba(92, 56, 20, ${0.03 + rnd() * 0.1})`;
    g.lineWidth = 0.5 + rnd() * 2;
    g.beginPath();
    const wob = rnd() * 7, ph = rnd() * 6, f = 1 + Math.floor(rnd() * 3);
    for (let x = 0; x <= c.width; x += 16) {
      const yy = y + Math.sin((x / c.width) * Math.PI * 2 * f + ph) * wob;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // algún nudo
  for (let i = 0; i < 5; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, r = 5 + rnd() * 9;
    for (let k = 4; k >= 1; k--) {
      g.strokeStyle = `rgba(80, 46, 16, ${0.1 + 0.05 * (4 - k)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, r * k * 1.9, r * k * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(70, 40, 14, 0.42)';
    g.beginPath();
    g.ellipse(x, y, r * 1.2, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.colorSpace = THREE.SRGBColorSpace;
  grainTex.anisotropy = 8;
  return grainTex;
}

let meshTexBase: HTMLCanvasElement | null = null;
function meshTexture(repU: number, repV: number): THREE.CanvasTexture {
  if (!meshTexBase) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 7);
    g.fillRect(0, 0, 7, 64);
    meshTexBase = c;
  }
  const t = new THREE.CanvasTexture(meshTexBase);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repU, repV);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** UV en milímetros reales para que la veta siga el largo de la pieza (vale para cajas rectas y biseladas). */
function grainUV(geo: THREE.BufferGeometry, grain: Axis, offset: number): void {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const gi = AX[grain];
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const ni = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    const plane = [0, 1, 2].filter((k) => k !== ni);
    if (ni === gi) uv.setXY(i, p[plane[0]] / 60 + offset, p[plane[1]] / 60 + offset); // testa
    else {
      const other = plane.find((k) => k !== gi)!;
      uv.setXY(i, p[gi] / 1400 + offset, p[other] / 380 + offset * 3);
    }
  }
  uv.needsUpdate = true;
}

function solidBox(size: Vec3, bevel: number): THREE.BufferGeometry {
  const min = Math.min(...size);
  if (min < 5 || bevel <= 0) return new THREE.BoxGeometry(size[0], size[1], size[2]);
  return new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(bevel, min / 4));
}

/** Coloca una curva plana (u, v) en el plano de una pieza decorativa y la convierte en tubo. */
function planeMapper(part: Part) {
  const thin = part.size.indexOf(Math.min(...part.size)) as 0 | 1 | 2;
  const plane = ([0, 1, 2] as const).filter((k) => k !== thin);
  const [ui, vi] = plane.includes(1) ? [plane.find((k) => k !== 1)!, 1] : [plane[0], plane[1]];
  const to3 = (u: number, v: number): THREE.Vector3 => {
    const p = [0, 0, 0];
    p[ui] = u - part.size[ui] / 2;
    p[vi] = v - part.size[vi] / 2;
    return new THREE.Vector3(p[0], p[1], p[2]);
  };
  return { thin, ui, vi, to3 };
}

function decoGeometry(part: Part): THREE.BufferGeometry {
  const bar = part.deco?.bar ?? Math.min(...part.size);
  const { thin, ui, vi, to3 } = planeMapper(part);
  if (part.shape === 'cone') {
    const li = AX[part.axis];
    const d = part.size[(li + 1) % 3];
    const sides = part.deco?.sides ?? 4;
    const geo = new THREE.ConeGeometry(sides <= 4 ? d / Math.SQRT2 : d / 2, part.size[li], sides);
    if (sides === 4) geo.rotateY(Math.PI / 4);
    if (part.axis === 'x') geo.rotateZ(-Math.PI / 2);
    if (part.axis === 'z') geo.rotateX(Math.PI / 2);
    return geo;
  }
  if (part.shape === 'bola') return new THREE.SphereGeometry(part.size[0] / 2, 24, 16);
  if (part.shape === 'aro') {
    const geo = new THREE.TorusGeometry((part.size[ui] - bar) / 2, bar / 2, 10, 40);
    if (thin === 0) geo.rotateY(Math.PI / 2);
    if (thin === 1) geo.rotateX(Math.PI / 2);
    return geo;
  }
  if (part.shape === 'retorcido') {
    const li = AX[part.axis];
    const side = part.size[(li + 1) % 3], len = part.size[li];
    const geo = new THREE.BoxGeometry(side, len, side, 1, Math.max(8, Math.round(len / (side * 0.6))), 1);
    const pos = geo.attributes.position;
    const turns = Math.max(1, Math.round((len * 0.7) / (side * 9)));
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      // los extremos quedan rectos para poder soldarlos; se retuerce el 70 % central
      const k = Math.min(1, Math.max(0, (y / len + 0.5 - 0.15) / 0.7));
      const a = k * turns * Math.PI * 2;
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
    }
    geo.computeVertexNormals();
    if (part.axis === 'x') geo.rotateZ(Math.PI / 2);
    if (part.axis === 'z') geo.rotateX(Math.PI / 2);
    return geo;
  }
  if (part.shape === 'prisma' && part.poly) {
    const n = part.polyNormal ?? 'z';
    const us = part.poly.map((q) => q[0]), vs = part.poly.map((q) => q[1]);
    const U = Math.max(...us), V = Math.max(...vs);
    const t = part.size[AX[n]];
    const shape = new THREE.Shape(part.poly.map(([u, v]) => new THREE.Vector2(u - U / 2, v - V / 2)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    geo.translate(0, 0, -t / 2);
    const uv = geo.attributes.uv;
    const along = U >= V;
    for (let i = 0; i < uv.count; i++) {
      const a = uv.getX(i), b = uv.getY(i);
      uv.setXY(i, (along ? a : b) / 1400, (along ? b : a) / 380);
    }
    if (n === 'x') geo.rotateY(-Math.PI / 2);
    if (n === 'y') geo.rotateX(Math.PI / 2);
    return geo;
  }
  let pts: THREE.Vector3[];
  let closed = false;
  if (part.shape === 'arco') {
    const w = part.size[ui];
    const rise = part.size[vi] - bar;
    const r = rise > 0 ? (w * w) / (8 * rise) + rise / 2 : 0;
    pts = Array.from({ length: 33 }, (_, i) => {
      const x = (w * i) / 32;
      const y = rise > 0 ? Math.sqrt(Math.max(0, r * r - (x - w / 2) ** 2)) - (r - rise) : 0;
      return to3(x, y + bar / 2);
    });
  } else if (part.shape === 'rombo') {
    const p2 = romboPoints(part.size[ui], part.size[vi], bar);
    // tramos rectos: se dibuja como polilínea, no como curva suavizada
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < p2.length; i++) path.add(new THREE.LineCurve3(to3(...p2[i - 1]), to3(...p2[i])));
    return new THREE.TubeGeometry(path, 64, bar / 2, 8, true);
  } else if (part.shape === 'corazon') {
    pts = corazonPoints(part.size[ui], part.size[vi], bar).map(([u, v]) => to3(u, v));
  } else {
    const w = part.size[ui], h = part.size[vi];
    pts = volutaPoints(w, h, part.deco?.curve ?? 'C', bar).map(([u, v]) => to3(part.deco?.mirror ? w - u : u, v));
  }
  const path = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  return new THREE.TubeGeometry(path, Math.max(48, pts.length * 2), bar / 2, 8, closed);
}

interface Item {
  part: Part;
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  edgeMat: THREE.LineBasicMaterial;
  ghost: THREE.LineSegments;
  step: number;
  home: THREE.Vector3;
  from: THREE.Vector3; // posición de partida de la animación de entrada
  appear: number; // 0..1
}

export interface ViewerOptions {
  interactive?: boolean;
  preserveDrawingBuffer?: boolean;
  background?: string | null;
}

export type DragPhase = 'start' | 'move' | 'end';

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 5, 200000);
  private controls: OrbitControls | null = null;
  private root = new THREE.Group();
  private marksGroup = new THREE.Group();
  private labelsGroup = new THREE.Group();
  private dimGroup = new THREE.Group();
  private handleGroup = new THREE.Group();
  private figure: THREE.Mesh | null = null;
  private items: Item[] = [];
  private project: Project | null = null;
  private stepIndex = 0;
  private center = new THREE.Vector3();
  private bmin = new THREE.Vector3();
  private bmax = new THREE.Vector3();
  private radius = 1000;
  private baseDist = 3000;
  private explode = 0;
  private explodeTarget = 0;
  private showGhost = true;
  private showLabels = true;
  private showDims = false;
  private showFigure = false;
  private autoFocus = false;
  private handleAxes: Axis[] = [];
  private selected: string | null = null;
  private raf = 0;
  private dirty = true;
  private last = 0;
  private sun = new THREE.DirectionalLight(0xfff4e2, 2.0);
  private floor: THREE.Mesh;
  private envTex: THREE.Texture | null = null;
  private disposed = false;
  private reduceMotion = false;
  private despiece = false;
  private baseZoom = 1;
  private lastZoom = 1;
  private markT = 1;
  private cam: { t: number; p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3 } | null = null;
  private drag:
    | { kind: 'handle'; axis: Axis; origin: THREE.Vector3; dir: THREE.Vector3; t0: number }
    | { kind: 'part'; id: string; plane: THREE.Plane; start: THREE.Vector3; home: THREE.Vector3; moved: boolean }
    | null = null;

  onSelect: ((partId: string | null) => void) | null = null;
  /** Arrastre de un tirador de medida: `delta` en mm respecto al inicio del arrastre. */
  onHandleDrag: ((axis: Axis, delta: number, phase: DragPhase) => void) | null = null;
  /** Modo libre: arrastre de una pieza. `pos` es el nuevo centro en mm. */
  onPartDrag: ((partId: string, pos: Vec3, phase: DragPhase) => void) | null = null;
  /** Modo libre: ajusta la posición propuesta (imanes). */
  snap: ((partId: string, pos: Vec3) => Vec3) | null = null;
  /** Modo libre: permite arrastrar piezas. */
  partDrag = false;
  /** Modo libre: el arrastre mueve en vertical en lugar de sobre el suelo. */
  dragVertical = false;

  constructor(private canvas: HTMLCanvasElement, opts: ViewerOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (opts.background) this.scene.background = new THREE.Color(opts.background);

    // iluminación de entorno: da reflejos creíbles al acero y matiza la madera
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.62;
      pmrem.dispose();
    } catch {
      /* sin entorno: quedan las luces directas */
    }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a58a, 0.55));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 2;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-1, 0.6, -0.8);
    this.scene.add(fill);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor, this.root, this.marksGroup, this.labelsGroup, this.dimGroup, this.handleGroup);

    if (opts.interactive !== false) {
      this.reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.addEventListener('change', () => (this.dirty = true));
      this.controls.addEventListener('start', () => (this.cam = null)); // la persona manda sobre la cámara
      this.bindPointer();
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  // ---------- construcción ----------

  setProject(project: Project, opts: { keepView?: boolean } = {}): void {
    const first = !this.project;
    this.project = project;
    this.clear();
    const b = boundsOf(project.parts);
    this.center.set(b.center[0], b.center[1], b.center[2]);
    this.bmin.set(...b.min);
    this.bmax.set(...b.max);
    this.radius = Math.max(120, Math.hypot(b.size[0], b.size[1], b.size[2]) / 2);

    const stepOf = new Map<string, number>();
    project.steps.forEach((s, i) => s.parts.forEach((id) => stepOf.set(id, i)));

    project.parts.forEach((part, idx) => {
      const info = MATERIALS[part.material];
      const group = new THREE.Group();
      const mats: THREE.MeshStandardMaterial[] = [];
      let geo: THREE.BufferGeometry;
      let edgeSrc: THREE.BufferGeometry | null = null;
      const jitter = 0.95 + (((idx * 37) % 11) / 10) * 0.09;
      const wood = info.kind === 'madera';
      const tint = wood ? project.stain : part.material === 'acero' ? project.paint : undefined;
      const color = tint ? new THREE.Color(tint).multiplyScalar(wood ? jitter : 1) : new THREE.Color(info.color).multiplyScalar(jitter);
      const painted = !!tint && !wood;
      const matOpts = {
        color,
        roughness: painted ? 0.55 : info.roughness,
        metalness: painted ? 0.25 : info.metalness,
      };

      if (part.material === 'malla') {
        const thin = part.size.indexOf(Math.min(...part.size)) as 0 | 1 | 2;
        // el plano se crea en XY: para un paño lateral (normal X) el ancho es el fondo (Z) y el alto es Y
        const [u, v] = thin === 0 ? [2, 1] : [0, 1, 2].filter((k) => k !== thin);
        geo = new THREE.PlaneGeometry(part.size[u], part.size[v]);
        if (thin === 0) geo.rotateY(Math.PI / 2);
        if (thin === 1) geo.rotateX(-Math.PI / 2);
        const cell = part.meshCell ?? 25;
        const mat = new THREE.MeshStandardMaterial({
          ...matOpts, map: meshTexture(part.size[u] / cell, part.size[v] / cell), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
        });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else if (part.shape !== 'box' && part.shape !== 'cyl') {
        geo = decoGeometry(part);
        const mat = new THREE.MeshStandardMaterial({ ...matOpts, flatShading: part.shape === 'cone', map: wood ? woodGrain() : null });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else if (part.shape === 'cyl') {
        const d = part.axis === 'x' ? part.size[1] : part.size[0];
        const len = part.size[AX[part.axis]];
        geo = new THREE.CylinderGeometry(d / 2, d / 2, len, 24);
        if (part.axis === 'x') geo.rotateZ(Math.PI / 2);
        if (part.axis === 'z') geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial(matOpts);
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else {
        geo = solidBox(part.size, wood ? 1.6 : part.material === 'herraje' ? 1 : 2);
        if (wood) grainUV(geo, part.axis, (idx * 0.173) % 1);
        edgeSrc = new THREE.BoxGeometry(...part.size);
        const mat = new THREE.MeshStandardMaterial({ ...matOpts, map: wood ? woodGrain() : null });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
        if (part.wall && part.material === 'acero') {
          // interior oscuro en las bocas del tubo
          const inner: Vec3 = [...part.size];
          const li = AX[part.axis];
          for (let k = 0; k < 3; k++) inner[k] = k === li ? part.size[k] + 0.8 : Math.max(1, part.size[k] - part.wall * 2);
          const im = new THREE.MeshStandardMaterial({ color: '#15181b', roughness: 0.9 });
          mats.push(im);
          group.add(new THREE.Mesh(new THREE.BoxGeometry(...inner), im));
        }
      }
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = part.material !== 'malla';
          o.receiveShadow = true;
          o.userData.partId = part.id;
        }
      });

      const curved = part.shape !== 'box' && part.shape !== 'cyl' && part.shape !== 'cone' && part.shape !== 'prisma';
      const edgeGeo = new THREE.EdgesGeometry(edgeSrc ?? geo, curved ? 50 : 30);
      edgeSrc?.dispose();
      const edgeMat = new THREE.LineBasicMaterial({ color: wood ? EDGE_DARK : EDGE_STEEL, transparent: true, opacity: 0.4 });
      group.add(new THREE.LineSegments(edgeGeo, edgeMat));

      const ghost = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: '#5b5346', transparent: true, opacity: 0.22 }));

      const home = new THREE.Vector3(...part.pos);
      group.position.copy(home);
      ghost.position.copy(home);
      if (part.rot) {
        group.rotation.set(...part.rot);
        ghost.rotation.set(...part.rot);
      }
      const dir = home.clone().sub(this.center);
      dir.y = Math.abs(dir.y) * 0.4 + this.radius * 0.5;
      if (dir.lengthSq() < 1) dir.set(0, 1, 0);
      dir.normalize().multiplyScalar(this.radius * 0.45);

      this.root.add(group, ghost);
      this.items.push({ part, group, mats, edgeMat, ghost, step: stepOf.get(part.id) ?? 0, home, from: home.clone().add(dir), appear: 1 });
    });

    // suelo y luz a escala
    const R = this.radius;
    this.floor.scale.setScalar(R * 3);
    this.floor.position.set(this.center.x, 0, this.center.z);
    this.sun.position.set(this.center.x + R * 0.9, this.center.y + R * 2.2, this.center.z + R * 1.3);
    this.sun.target.position.copy(this.center);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -R * 1.6;
    sc.right = sc.top = R * 1.6;
    sc.near = R * 0.2;
    sc.far = R * 6;
    sc.updateProjectionMatrix();

    this.buildDims();
    this.buildHandles();
    this.buildFigure();
    if (!opts.keepView || first) this.resetView();
    else this.fitDistances();
    this.setStep(Math.min(this.stepIndex, project.steps.length - 1), false);
  }

  private clear(): void {
    for (const it of this.items) {
      it.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      it.mats.forEach((m) => {
        if (m.map && m.map !== grainTex) m.map.dispose();
        m.dispose();
      });
      it.edgeMat.dispose();
      (it.ghost.material as THREE.Material).dispose();
    }
    this.items = [];
    this.root.clear();
    this.clearGroup(this.marksGroup);
    this.clearGroup(this.labelsGroup);
    this.clearGroup(this.dimGroup);
    this.clearGroup(this.handleGroup);
    if (this.figure) {
      this.scene.remove(this.figure);
      this.figure.geometry.dispose();
      (this.figure.material as THREE.MeshBasicMaterial).map?.dispose();
      (this.figure.material as THREE.Material).dispose();
      this.figure = null;
    }
  }

  private clearGroup(g: THREE.Group): void {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) {
        const map = (mat as THREE.SpriteMaterial).map;
        if (map) map.dispose();
        mat.dispose();
      }
    });
    g.clear();
  }

  // ---------- estado ----------

  setStep(i: number, animate = true): void {
    if (!this.project) return;
    const prev = this.stepIndex;
    this.stepIndex = Math.max(0, Math.min(i, this.project.steps.length - 1));
    const st = this.project.steps[this.stepIndex];
    this.despiece = st.parts.length === 0 && st.kind === 'cortar';
    const anim = animate && !this.reduceMotion && !!this.controls;
    const forward = anim && this.stepIndex > prev;
    for (const it of this.items) it.appear = it.step === this.stepIndex && forward ? 0 : 1;
    this.markT = anim ? 0 : 1;
    this.buildMarks();
    this.buildLabels();
    this.applyState();
    if (this.autoFocus && animate) this.focusStep(anim);
    this.dirty = true;
  }

  setExplode(f: number): void {
    this.explodeTarget = f;
    if (this.reduceMotion || !this.controls) this.explode = f;
    this.applyState();
    this.dirty = true;
  }
  setGhost(v: boolean): void {
    this.showGhost = v;
    this.applyState();
    this.dirty = true;
  }
  setLabels(v: boolean): void {
    this.showLabels = v;
    this.labelsGroup.visible = v;
    this.applyState();
    this.dirty = true;
  }
  /** Cotas generales (ancho, alto y fondo) dibujadas sobre el modelo. */
  setDimensions(v: boolean): void {
    this.showDims = v;
    this.applyState();
    this.dirty = true;
  }
  /** Tiradores para estirar el modelo en los ejes indicados. */
  setHandles(axes: Axis[]): void {
    this.handleAxes = axes;
    this.buildHandles();
    this.dirty = true;
  }
  /** Silueta humana de 1,70 m para dar escala. */
  setScaleFigure(v: boolean): void {
    this.showFigure = v;
    if (this.figure) this.figure.visible = v;
    this.dirty = true;
  }
  /** La cámara se acerca a las piezas de cada paso. */
  setAutoFocus(v: boolean): void {
    this.autoFocus = v;
    if (!v) this.flyTo(this.center, this.baseDist, true);
    else this.focusStep(true);
  }
  select(id: string | null): void {
    this.selected = id;
    this.applyState();
    this.dirty = true;
  }

  /** Factor de despiece efectivo: los pasos de corte muestran todas las piezas separadas. */
  private get spread(): number {
    return Math.max(this.explode, this.despiece ? 0.55 : 0);
  }

  private exploded(v: THREE.Vector3): THREE.Vector3 {
    return v.clone().add(v.clone().sub(this.center).multiplyScalar(this.spread * 0.85));
  }

  private applyZoom(): void {
    const z = this.baseZoom / (1 + this.spread * 0.7);
    if (Math.abs(z - this.lastZoom) > 1e-4) {
      this.camera.zoom = this.lastZoom = z;
      this.camera.updateProjectionMatrix();
    }
  }

  private applyState(): void {
    const ease = (t: number) => 1 - Math.pow(2, -9 * t);
    for (const it of this.items) {
      const visible = this.despiece || it.step <= this.stepIndex;
      const current = !this.despiece && it.step === this.stepIndex;
      it.group.visible = visible;
      it.ghost.visible = !visible && this.showGhost;
      const home = this.exploded(it.home);
      it.ghost.position.copy(home);
      if (!visible) continue;
      const t = it.appear >= 1 ? 1 : ease(it.appear);
      it.group.position.lerpVectors(it.from, home, t);
      const fading = it.appear < 1;
      const sel = this.selected === it.part.id;
      it.mats.forEach((m, k) => {
        const isMesh = it.part.material === 'malla';
        m.transparent = fading || isMesh;
        m.opacity = fading ? Math.min(1, it.appear * 1.6) : 1;
        if (k === 0) {
          m.emissive.copy(sel ? SELECT : current ? ACCENT : BLACK);
          m.emissiveIntensity = sel ? 0.5 : current ? 0.22 : 0;
        }
      });
      it.edgeMat.color.copy(sel ? new THREE.Color('#7a5c00') : current ? ACCENT : MATERIALS[it.part.material].kind === 'madera' ? EDGE_DARK : EDGE_STEEL);
      it.edgeMat.opacity = current || sel ? 0.95 : 0.38;
    }
    const flat = this.spread < 0.02;
    this.marksGroup.visible = this.showLabels && flat;
    this.dimGroup.visible = this.showDims && flat;
    this.handleGroup.visible = this.handleAxes.length > 0 && flat;
    this.applyZoom();
  }

  // ---------- marcas de fijación ----------

  private buildMarks(): void {
    this.clearGroup(this.marksGroup);
    const marks = this.project?.steps[this.stepIndex]?.marks ?? [];
    if (!marks.length) return;
    const k = Math.max(1, this.radius / 700); // se agrandan un poco en proyectos grandes para que se vean
    const beads: THREE.Vector3[] = [];
    for (const m of marks) {
      const at = new THREE.Vector3(...m.at);
      if (m.type === 'soldadura' && m.to) {
        const to = new THREE.Vector3(...m.to);
        const n = Math.max(2, Math.round(at.distanceTo(to) / (4.2 * k)));
        for (let i = 0; i <= n; i++) beads.push(at.clone().lerp(to, i / n));
      } else if (m.type === 'punto' || m.type === 'soldadura') {
        const s = new THREE.Mesh(new THREE.SphereGeometry(5.5 * k, 12, 10), weldMat());
        s.position.copy(at);
        s.renderOrder = 5;
        this.marksGroup.add(s);
      } else this.marksGroup.add(this.fastener(m, k));
    }
    if (beads.length) {
      // cordón: una fila de gotas solapadas, como las aguas de una soldadura
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(3.4 * k, 8, 6), weldMat(), beads.length);
      const mtx = new THREE.Matrix4();
      beads.forEach((p, i) => inst.setMatrixAt(i, mtx.makeTranslation(p.x, p.y, p.z)));
      inst.renderOrder = 5;
      inst.frustumCulled = false;
      this.marksGroup.add(inst);
    }
  }

  /** Tornillo (cabeza con ranura en cruz) o tubillón. */
  private fastener(m: Mark, k: number): THREE.Object3D {
    const g = new THREE.Group();
    const screw = m.type === 'tornillo';
    const r = (screw ? 5 : 4) * k, h = (screw ? 4 : 14) * k;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, screw ? r * 0.7 : r, h, 16),
      new THREE.MeshStandardMaterial({
        color: screw ? '#2a2826' : '#a8763f', emissive: screw ? ACCENT : BLACK, emissiveIntensity: screw ? 0.6 : 0,
        roughness: 0.45, metalness: screw ? 0.6 : 0, depthTest: false, transparent: true,
      }),
    );
    body.renderOrder = 5;
    g.add(body);
    if (screw) {
      const slotMat = new THREE.MeshBasicMaterial({ color: '#f6f1e7', depthTest: false, transparent: true });
      for (const rot of [0, Math.PI / 2]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, 0.6 * k, r * 0.28), slotMat);
        slot.position.y = h / 2;
        slot.rotation.y = rot;
        slot.renderOrder = 6;
        g.add(slot);
      }
    }
    const axis = m.axis ?? 'y';
    if (axis === 'x') g.rotation.z = -Math.PI / 2;
    if (axis === 'z') g.rotation.x = Math.PI / 2;
    g.position.set(...m.at);
    g.userData.home = g.position.clone();
    g.userData.axis = axis;
    return g;
  }

  // ---------- etiquetas de referencia ----------

  private buildLabels(): void {
    this.clearGroup(this.labelsGroup);
    if (!this.project) return;
    const seen = new Set<string>();
    for (const it of this.items) {
      if ((!this.despiece && it.step !== this.stepIndex) || seen.has(it.part.ref)) continue;
      seen.add(it.part.ref);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(it.part.ref), depthTest: false, sizeAttenuation: false }));
      s.scale.set(0.052, 0.052, 1);
      s.renderOrder = 10;
      s.userData.partId = it.part.id;
      this.labelsGroup.add(s);
    }
    this.placeLabels();
  }

  private placeLabels(): void {
    for (const s of this.labelsGroup.children) {
      const it = this.items.find((x) => x.part.id === s.userData.partId);
      if (it) s.position.copy(it.group.position);
    }
  }

  // ---------- cotas y tiradores ----------

  private buildDims(): void {
    this.clearGroup(this.dimGroup);
    const { bmin: a, bmax: b } = this;
    const gap = this.radius * 0.09, tick = this.radius * 0.03;
    const pts: number[] = [];
    const seg = (p: THREE.Vector3, q: THREE.Vector3) => pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const dim = (p: THREE.Vector3, q: THREE.Vector3, out: THREE.Vector3, text: string) => {
      const p2 = p.clone().addScaledVector(out, gap), q2 = q.clone().addScaledVector(out, gap);
      seg(p2, q2);
      seg(p.clone().addScaledVector(out, gap * 0.35), p.clone().addScaledVector(out, gap + tick));
      seg(q.clone().addScaledVector(out, gap * 0.35), q.clone().addScaledVector(out, gap + tick));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dimTexture(text), depthTest: false, sizeAttenuation: false }));
      s.scale.set(0.105, 0.042, 1);
      s.position.copy(p2).add(q2).multiplyScalar(0.5);
      s.renderOrder = 11;
      this.dimGroup.add(s);
    };
    dim(V(a.x, a.y, b.z), V(b.x, a.y, b.z), V(0, 0, 1), `${Math.round(b.x - a.x)}`);
    dim(V(b.x, a.y, a.z), V(b.x, a.y, b.z), V(1, 0, 0), `${Math.round(b.z - a.z)}`);
    dim(V(a.x, a.y, b.z), V(a.x, b.y, b.z), V(-1, 0, 0), `${Math.round(b.y - a.y)}`);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: INK, depthTest: false, transparent: true, opacity: 0.85 }));
    lines.renderOrder = 9;
    this.dimGroup.add(lines);
    this.dimGroup.visible = this.showDims && this.spread < 0.02;
  }

  private handleOrigin(axis: Axis): THREE.Vector3 {
    const p = this.center.clone();
    const off = this.radius * 0.07;
    if (axis === 'x') p.x = this.bmax.x + off;
    if (axis === 'y') p.y = this.bmax.y + off;
    if (axis === 'z') p.z = this.bmax.z + off;
    return p;
  }

  private buildHandles(): void {
    this.clearGroup(this.handleGroup);
    if (!this.project) return;
    for (const axis of this.handleAxes) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: '#c7341b', depthTest: false, transparent: true });
      const ring = new THREE.MeshBasicMaterial({ color: '#fffdf8', depthTest: false, transparent: true });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 20), mat);
      cone.position.y = 0.95;
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), ring);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat);
      for (const m of [base, core, cone]) m.renderOrder = 20;
      g.add(base, core, cone);
      if (axis === 'x') g.rotation.z = -Math.PI / 2;
      if (axis === 'z') g.rotation.x = Math.PI / 2;
      g.position.copy(this.handleOrigin(axis));
      g.userData.axis = axis;
      g.traverse((o) => (o.userData.axis = axis));
      this.handleGroup.add(g);
    }
    this.handleGroup.visible = this.handleAxes.length > 0 && this.spread < 0.02;
  }

  private buildFigure(): void {
    const h = 1700, w = 620;
    const mat = new THREE.MeshBasicMaterial({ map: figureTexture(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.figure = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.figure.position.set(this.bmin.x - 520, h / 2, this.center.z);
    this.figure.visible = this.showFigure;
    this.scene.add(this.figure);
  }

  // ---------- cámara ----------

  private fitDistances(): void {
    this.baseDist = (this.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.08;
    this.camera.near = Math.max(5, this.baseDist / 200);
    this.camera.far = this.baseDist * 12;
    this.camera.updateProjectionMatrix();
    if (this.controls) {
      this.controls.minDistance = this.baseDist * 0.12;
      this.controls.maxDistance = this.baseDist * 2.4;
    }
  }

  resetView(): void {
    this.cam = null;
    this.fitDistances();
    const dir = new THREE.Vector3(0.95, 0.62, 1.25).normalize();
    this.camera.position.copy(this.center).add(dir.multiplyScalar(this.baseDist));
    this.camera.lookAt(this.center);
    if (this.controls) {
      this.controls.target.copy(this.center);
      this.controls.maxPolarAngle = Math.PI * 0.56;
      this.controls.update();
    }
    this.dirty = true;
  }

  private flyTo(target: THREE.Vector3, dist: number, animate: boolean): void {
    if (!this.controls) return;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const p1 = target.clone().addScaledVector(dir, dist);
    if (!animate || this.reduceMotion) {
      this.camera.position.copy(p1);
      this.controls.target.copy(target);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.cam = { t: 0, p0: this.camera.position.clone(), p1, t0: this.controls.target.clone(), t1: target.clone() };
  }

  /** Encuadra las piezas del paso actual sin perder de vista el conjunto. */
  private focusStep(animate: boolean): void {
    const cur = this.items.filter((it) => !this.despiece && it.step === this.stepIndex);
    if (!cur.length) return this.flyTo(this.center, this.baseDist, animate);
    const box = new THREE.Box3();
    for (const it of cur) {
      const h = new THREE.Vector3(...it.part.size).multiplyScalar(0.5);
      box.expandByPoint(it.home.clone().sub(h));
      box.expandByPoint(it.home.clone().add(h));
    }
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const target = this.center.clone().lerp(c, 0.7);
    const dist = THREE.MathUtils.clamp((r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.5, this.baseDist * 0.45, this.baseDist);
    this.flyTo(target, dist, animate);
  }

  resize(w: number, h: number, pixelRatio = Math.min(2, window.devicePixelRatio || 1)): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // en vertical la escena se aleja para que quepa el ancho
    this.baseZoom = this.camera.aspect < 1 ? Math.max(0.55, this.camera.aspect * 0.95) : 1;
    this.lastZoom = -1;
    this.camera.updateProjectionMatrix();
    this.applyZoom();
    this.dirty = true;
  }

  // ---------- bucle ----------

  private perFrame(): void {
    this.placeLabels();
    // los tiradores mantienen tamaño constante en pantalla
    for (const g of this.handleGroup.children) {
      const d = this.camera.position.distanceTo(g.position);
      g.scale.setScalar((d * 0.011) / this.camera.zoom);
    }
    if (this.figure?.visible) this.figure.rotation.y = Math.atan2(this.camera.position.x - this.figure.position.x, this.camera.position.z - this.figure.position.z);
    // los tornillos entran y los cordones crecen al cambiar de paso
    const e = 1 - Math.pow(1 - this.markT, 3);
    for (const o of this.marksGroup.children) {
      const home = o.userData.home as THREE.Vector3 | undefined;
      if (home) {
        const ax = AX[(o.userData.axis as Axis) ?? 'y'];
        o.position.copy(home);
        o.position.setComponent(ax, home.getComponent(ax) + (1 - e) * 60 * Math.max(1, this.radius / 700));
        o.scale.setScalar(0.4 + 0.6 * e);
      } else if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).count = Math.ceil(((o as THREE.InstancedMesh).instanceMatrix.count) * e);
      else o.scale.setScalar(Math.max(0.01, e));
    }
  }

  private loop(now: number): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    let animating = false;
    for (const it of this.items) {
      if (it.appear < 1) {
        it.appear = Math.min(1, it.appear + dt / 0.75);
        animating = true;
      }
    }
    if (this.markT < 1) {
      this.markT = Math.min(1, this.markT + dt / 0.9);
      this.dirty = true;
    }
    if (Math.abs(this.explode - this.explodeTarget) > 0.001) {
      this.explode += (this.explodeTarget - this.explode) * Math.min(1, dt * 9);
      animating = true;
    } else if (this.explode !== this.explodeTarget) {
      this.explode = this.explodeTarget;
      animating = true;
    }
    if (this.cam && this.controls) {
      this.cam.t = Math.min(1, this.cam.t + dt / 0.9);
      const e = 1 - Math.pow(2, -8 * this.cam.t);
      const k = this.cam.t >= 1 ? 1 : e;
      this.camera.position.lerpVectors(this.cam.p0, this.cam.p1, k);
      this.controls.target.lerpVectors(this.cam.t0, this.cam.t1, k);
      if (this.cam.t >= 1) this.cam = null;
      this.dirty = true;
    }
    if (animating) {
      this.applyState();
      this.dirty = true;
    }
    this.controls?.update();
    if (this.dirty) {
      this.perFrame();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** Dibuja un fotograma inmediato (para capturas sin bucle). */
  renderNow(): void {
    this.explode = this.explodeTarget;
    this.markT = 1;
    for (const it of this.items) it.appear = 1;
    this.applyState();
    this.perFrame();
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- puntero: selección, tiradores y arrastre de piezas ----------

  private ray = new THREE.Raycaster();
  private setRay(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
  }
  /** Parámetro del punto de la recta (origin, dir) más cercano al rayo del puntero. */
  private alongAxis(origin: THREE.Vector3, dir: THREE.Vector3): number {
    const r = this.ray.ray;
    const w = origin.clone().sub(r.origin);
    const b = dir.dot(r.direction), d = dir.dot(w), e = r.direction.dot(w);
    const den = 1 - b * b;
    return Math.abs(den) < 1e-5 ? 0 : (b * e - d) / den;
  }
  private pickPart(): { id: string; point: THREE.Vector3 } | null {
    const targets: THREE.Object3D[] = [];
    for (const it of this.items) if (it.group.visible) it.group.traverse((o) => (o as THREE.Mesh).isMesh && targets.push(o));
    const hit = this.ray.intersectObjects(targets, false)[0];
    return hit ? { id: hit.object.userData.partId as string, point: hit.point } : null;
  }

  private bindPointer(): void {
    let down: { x: number; y: number } | null = null;
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      this.setRay(e);
      if (this.handleGroup.visible) {
        const hit = this.ray.intersectObjects(this.handleGroup.children, true)[0];
        if (hit) {
          const axis = hit.object.userData.axis as Axis;
          const dir = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
          const origin = this.handleOrigin(axis);
          this.drag = { kind: 'handle', axis, origin, dir, t0: this.alongAxis(origin, dir) };
          this.controls!.enabled = false;
          c.setPointerCapture(e.pointerId);
          this.onHandleDrag?.(axis, 0, 'start');
          return;
        }
      }
      if (this.partDrag) {
        const hit = this.pickPart();
        const it = hit && this.items.find((x) => x.part.id === hit.id);
        if (hit && it) {
          const normal = this.dragVertical
            ? this.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate()
            : new THREE.Vector3(0, 1, 0);
          this.drag = { kind: 'part', id: hit.id, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point), start: hit.point.clone(), home: it.home.clone(), moved: false };
          this.controls!.enabled = false;
          c.setPointerCapture(e.pointerId);
        }
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag) {
        if (this.handleGroup.visible && e.pointerType === 'mouse') {
          this.setRay(e);
          c.style.cursor = this.ray.intersectObjects(this.handleGroup.children, true).length ? 'grab' : '';
        }
        return;
      }
      this.setRay(e);
      if (this.drag.kind === 'handle') {
        this.onHandleDrag?.(this.drag.axis, this.alongAxis(this.drag.origin, this.drag.dir) - this.drag.t0, 'move');
        return;
      }
      if (!down || (!this.drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6)) return;
      const p = this.ray.ray.intersectPlane(this.drag.plane, new THREE.Vector3());
      const it = this.items.find((x) => x.part.id === (this.drag as { id: string }).id);
      if (!p || !it) return;
      if (!this.drag.moved) {
        this.drag.moved = true;
        this.select(this.drag.id);
        this.onSelect?.(this.drag.id);
        this.onPartDrag?.(this.drag.id, it.home.toArray() as Vec3, 'start');
      }
      const d = p.sub(this.drag.start);
      if (this.dragVertical) d.set(0, d.y, 0);
      else d.y = 0;
      let pos = this.drag.home.clone().add(d).toArray() as Vec3;
      if (this.snap) pos = this.snap(this.drag.id, pos);
      it.home.set(...pos);
      it.group.position.copy(it.home);
      this.onPartDrag?.(this.drag.id, pos, 'move');
      this.dirty = true;
    });
    const up = (e: PointerEvent) => {
      const drag = this.drag;
      this.drag = null;
      if (this.controls) this.controls.enabled = true;
      if (drag?.kind === 'handle') {
        this.setRay(e);
        this.onHandleDrag?.(drag.axis, this.alongAxis(drag.origin, drag.dir) - drag.t0, 'end');
        return;
      }
      if (drag?.kind === 'part' && drag.moved) {
        const it = this.items.find((x) => x.part.id === drag.id);
        if (it) this.onPartDrag?.(drag.id, it.home.toArray() as Vec3, 'end');
        return;
      }
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      this.setRay(e);
      const id = this.pickPart()?.id ?? null;
      this.select(id === this.selected && !this.partDrag ? null : id);
      this.onSelect?.(this.selected);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => {
      this.drag = null;
      if (this.controls) this.controls.enabled = true;
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    this.clear();
    this.envTex?.dispose();
    this.renderer.dispose();
  }
}

let weldMaterial: THREE.MeshStandardMaterial | null = null;
function weldMat(): THREE.MeshStandardMaterial {
  // cada grupo de marcas libera su material al limpiarse, así que se crea uno nuevo cada vez
  weldMaterial = new THREE.MeshStandardMaterial({ color: WELD, emissive: WELD, emissiveIntensity: 0.75, roughness: 0.55, metalness: 0.3, depthTest: false, transparent: true });
  return weldMaterial;
}

const labelCache = new Map<string, HTMLCanvasElement>();
function labelTexture(text: string): THREE.CanvasTexture {
  let c = labelCache.get(text);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fillStyle = '#f2c230';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = INK;
    g.font = `700 ${text.length > 1 ? 54 : 68}px "Bricolage Grotesque Variable", "Arial Narrow", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 69);
    labelCache.set(text, c);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Etiqueta de cota: número en mm sobre una pastilla clara. */
function dimTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fffdf8';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(6, 14, 308, 100, 22);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.font = '700 66px "Bricolage Grotesque Variable", "Arial Narrow", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 160, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Silueta de persona de 1,70 m (pictograma) para dar escala. */
function figureTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 186;
  c.height = 510; // 0,3 px por mm
  const g = c.getContext('2d')!;
  g.fillStyle = INK;
  const cx = 93;
  g.beginPath();
  g.arc(cx, 36, 30, 0, Math.PI * 2); // cabeza
  g.fill();
  g.beginPath();
  g.roundRect(cx - 50, 76, 100, 190, 28); // tronco
  g.fill();
  g.beginPath();
  g.roundRect(cx - 82, 84, 26, 170, 13); // brazos
  g.roundRect(cx + 56, 84, 26, 170, 13);
  g.fill();
  g.beginPath();
  g.roundRect(cx - 46, 250, 40, 258, 16); // piernas
  g.roundRect(cx + 6, 250, 40, 258, 16);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
