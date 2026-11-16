import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Axis, Mark, Part, Project, Vec3 } from '../core/types';
import { MATERIALS } from '../core/materials';
import { boundsOf } from '../core/builder';

const AX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const ACCENT = new THREE.Color('#c7341b');
const SELECT = new THREE.Color('#f2c230');
const EDGE_DARK = new THREE.Color('#3a2f22');
const EDGE_STEEL = new THREE.Color('#20262b');
const WELD = new THREE.Color('#ff7a1a');

// ---------- texturas procedurales (compartidas) ----------

let grainTex: THREE.CanvasTexture | null = null;
function woodGrain(): THREE.CanvasTexture {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const y = rnd() * c.height;
    const a = 0.03 + rnd() * 0.09;
    g.strokeStyle = `rgba(92, 56, 20, ${a})`;
    g.lineWidth = 0.6 + rnd() * 2.4;
    g.beginPath();
    const wob = rnd() * 5;
    const ph = rnd() * 6;
    for (let x = 0; x <= c.width; x += 16) {
      const yy = y + Math.sin((x / c.width) * Math.PI * 2 + ph) * wob;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.colorSpace = THREE.SRGBColorSpace;
  grainTex.anisotropy = 4;
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

/** Caja con UV en milímetros reales para que la veta siga el largo de la pieza. */
function woodBox(size: Vec3, grain: Axis, offset: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const gi = AX[grain];
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const ni = n[0] > 0.5 ? 0 : n[1] > 0.5 ? 1 : 2;
    const plane = [0, 1, 2].filter((k) => k !== ni);
    if (ni === gi) {
      uv.setXY(i, p[plane[0]] / 40 + offset, p[plane[1]] / 40 + offset); // testa
    } else {
      const other = plane.find((k) => k !== gi)!;
      uv.setXY(i, p[gi] / 900 + offset, p[other] / 220 + offset * 3);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Curva plana (u, v) de una voluta dentro de su caja w × h. */
function volutaPoints(w: number, h: number, curve: 'C' | 'S' | 'espiral', bar: number): [number, number][] {
  const spiral = (cx: number, cy: number, R: number, turns: number): [number, number][] => {
    const tmax = turns * Math.PI * 2;
    const pts: [number, number][] = [];
    const n = Math.round(turns * 28);
    for (let i = 0; i <= n; i++) {
      const t = tmax * (0.12 + 0.88 * (i / n));
      const r = R * (t / tmax);
      const phi = tmax - t; // termina en phi = 0 (punto más a la derecha), bajando
      pts.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi)]);
    }
    return pts;
  };
  const m = bar / 2;
  const W = w - bar, H = h - bar;
  if (curve === 'espiral') {
    const R = Math.min(W, H) / 2;
    return spiral(m + W / 2, m + H / 2, R, 2.25);
  }
  const R = Math.min(W / 2, H / 4);
  const top = spiral(m + W - R, m + H - R, R, 1.35); // acaba en (m + W, m + H - R)
  const bottom: [number, number][] = curve === 'C'
    ? top.map(([x, y]): [number, number] => [x, 2 * m + H - y]).reverse()
    : top.map(([x, y]): [number, number] => [2 * m + W - x, 2 * m + H - y]).reverse();
  return [...top, ...bottom];
}

function decoGeometry(part: Part): THREE.BufferGeometry {
  const thin = part.size.indexOf(Math.min(...part.size)) as 0 | 1 | 2;
  const bar = part.deco?.bar ?? Math.min(...part.size);
  // ejes del plano: v es el vertical (Y) siempre que el plano lo contenga
  const plane = ([0, 1, 2] as const).filter((k) => k !== thin);
  const [ui, vi] = plane.includes(1) ? [plane.find((k) => k !== 1)!, 1] : [plane[0], plane[1]];
  const to3 = (u: number, v: number): THREE.Vector3 => {
    const p = [0, 0, 0];
    p[ui] = u - part.size[ui] / 2;
    p[vi] = v - part.size[vi] / 2;
    return new THREE.Vector3(p[0], p[1], p[2]);
  };
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
  if (part.shape === 'bola') return new THREE.SphereGeometry(part.size[0] / 2, 20, 14);
  if (part.shape === 'aro') {
    const d = part.size[ui];
    const geo = new THREE.TorusGeometry((d - bar) / 2, bar / 2, 8, 36);
    if (thin === 0) geo.rotateY(Math.PI / 2);
    if (thin === 1) geo.rotateX(Math.PI / 2);
    return geo;
  }
  let pts: THREE.Vector3[];
  if (part.shape === 'arco') {
    const w = part.size[ui];
    const rise = part.size[vi] - bar;
    const r = rise > 0 ? (w * w) / (8 * rise) + rise / 2 : 0;
    pts = Array.from({ length: 33 }, (_, i) => {
      const x = (w * i) / 32;
      const y = rise > 0 ? Math.sqrt(Math.max(0, r * r - (x - w / 2) ** 2)) - (r - rise) : 0;
      return to3(x, y + bar / 2);
    });
  } else {
    const w = part.size[ui], h = part.size[vi];
    pts = volutaPoints(w, h, part.deco?.curve ?? 'C', bar).map(([u, v]) => to3(part.deco?.mirror ? w - u : u, v));
  }
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(path, Math.max(48, pts.length * 2), bar / 2, 8, false);
}

interface Item {
  part: Part;
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  edges: THREE.LineSegments;
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

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 5, 200000);
  private controls: OrbitControls | null = null;
  private root = new THREE.Group();
  private marksGroup = new THREE.Group();
  private labelsGroup = new THREE.Group();
  private items: Item[] = [];
  private project: Project | null = null;
  private stepIndex = 0;
  private center = new THREE.Vector3();
  private radius = 1000;
  private explode = 0;
  private explodeTarget = 0;
  private showGhost = true;
  private showLabels = true;
  private selected: string | null = null;
  private raf = 0;
  private dirty = true;
  private last = 0;
  private sun = new THREE.DirectionalLight(0xfff4e2, 2.3);
  private floor: THREE.Mesh;
  private disposed = false;
  private reduceMotion = false;
  private despiece = false;
  private baseZoom = 1;
  private lastZoom = 1;
  onSelect: ((partId: string | null) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, opts: ViewerOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (opts.background) this.scene.background = new THREE.Color(opts.background);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a58a, 1.15));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 2;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    fill.position.set(-1, 0.6, -0.8);
    this.scene.add(fill);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: 0.2 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor, this.root, this.marksGroup, this.labelsGroup);

    if (opts.interactive !== false) {
      this.reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.addEventListener('change', () => (this.dirty = true));
      this.bindPicking();
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  // ---------- construcción ----------

  setProject(project: Project): void {
    this.project = project;
    this.clear();
    const b = boundsOf(project.parts);
    this.center.set(b.center[0], b.center[1], b.center[2]);
    this.radius = Math.max(120, Math.hypot(b.size[0], b.size[1], b.size[2]) / 2);

    const stepOf = new Map<string, number>();
    project.steps.forEach((s, i) => s.parts.forEach((id) => stepOf.set(id, i)));

    project.parts.forEach((part, idx) => {
      const info = MATERIALS[part.material];
      const group = new THREE.Group();
      const mats: THREE.MeshStandardMaterial[] = [];
      let geo: THREE.BufferGeometry;
      const jitter = 0.94 + (((idx * 37) % 11) / 10) * 0.1;
      const painted = project.paint && part.material === 'acero';
      const color = painted ? new THREE.Color(project.paint!) : new THREE.Color(info.color).multiplyScalar(jitter);

      if (part.material === 'malla') {
        const thin = part.size.indexOf(Math.min(...part.size)) as 0 | 1 | 2;
        const [u, v] = [0, 1, 2].filter((k) => k !== thin);
        geo = new THREE.PlaneGeometry(part.size[u], part.size[v]);
        if (thin === 0) geo.rotateY(Math.PI / 2);
        if (thin === 1) geo.rotateX(-Math.PI / 2);
        const cell = part.meshCell ?? 25;
        const mat = new THREE.MeshStandardMaterial({
          color, map: meshTexture(part.size[u] / cell, part.size[v] / cell), transparent: true, alphaTest: 0.35,
          side: THREE.DoubleSide, roughness: info.roughness, metalness: info.metalness,
        });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else if (part.shape !== 'box' && part.shape !== 'cyl') {
        geo = decoGeometry(part);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: info.roughness, metalness: info.metalness, flatShading: part.shape === 'cone' });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else if (part.shape === 'cyl') {
        const d = part.axis === 'x' ? part.size[1] : part.size[0];
        const len = part.size[AX[part.axis]];
        geo = new THREE.CylinderGeometry(d / 2, d / 2, len, 20);
        if (part.axis === 'x') geo.rotateZ(Math.PI / 2);
        if (part.axis === 'z') geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: info.roughness, metalness: info.metalness });
        mats.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      } else {
        const wood = info.kind === 'madera';
        geo = wood ? woodBox(part.size, part.axis, (idx * 0.173) % 1) : new THREE.BoxGeometry(...part.size);
        const mat = new THREE.MeshStandardMaterial({
          color, roughness: info.roughness, metalness: info.metalness, map: wood ? woodGrain() : null,
        });
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

      const curved = part.shape === 'voluta' || part.shape === 'aro' || part.shape === 'arco' || part.shape === 'bola';
      const edgeGeo = new THREE.EdgesGeometry(geo, curved ? 50 : 30);
      const edgeMat = new THREE.LineBasicMaterial({ color: info.kind === 'madera' ? EDGE_DARK : EDGE_STEEL, transparent: true, opacity: 0.55 });
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      group.add(edges);

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
      this.items.push({ part, group, mats, edges, edgeMat, ghost, step: stepOf.get(part.id) ?? 0, home, from: home.clone().add(dir), appear: 1 });
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

    this.resetView();
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
    this.selected = null;
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
    const anim = animate && !this.reduceMotion && this.stepIndex > prev;
    for (const it of this.items) {
      if (it.step === this.stepIndex && anim) it.appear = 0;
      else it.appear = 1;
    }
    this.buildMarks();
    this.buildLabels();
    this.applyState();
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
    this.marksGroup.visible = v;
    this.dirty = true;
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
          m.emissive.copy(sel ? SELECT : current ? ACCENT : new THREE.Color(0x000000));
          m.emissiveIntensity = sel ? 0.5 : current ? 0.2 : 0;
        }
      });
      it.edgeMat.color.copy(sel ? new THREE.Color('#7a5c00') : current ? ACCENT : MATERIALS[it.part.material].kind === 'madera' ? EDGE_DARK : EDGE_STEEL);
      it.edgeMat.opacity = current || sel ? 0.95 : 0.5;
    }
    this.marksGroup.visible = this.showLabels && this.spread < 0.02;
    this.applyZoom();
  }

  // ---------- marcas de fijación ----------

  private buildMarks(): void {
    this.clearGroup(this.marksGroup);
    const marks = this.project?.steps[this.stepIndex]?.marks ?? [];
    const k = Math.max(1, this.radius / 700); // se agrandan un poco en proyectos grandes para que se vean
    for (const m of marks) this.marksGroup.add(this.markMesh(m, k));
  }

  private markMesh(m: Mark, k: number): THREE.Object3D {
    const at = new THREE.Vector3(...m.at);
    if (m.type === 'soldadura' && m.to) {
      const to = new THREE.Vector3(...m.to);
      const len = at.distanceTo(to);
      const geo = new THREE.CylinderGeometry(3 * k, 3 * k, len, 8);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: WELD, emissive: WELD, emissiveIntensity: 0.7, roughness: 0.6, depthTest: false, transparent: true }));
      mesh.renderOrder = 5;
      mesh.position.copy(at).add(to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(at).normalize());
      return mesh;
    }
    if (m.type === 'punto' || m.type === 'soldadura') {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(5 * k, 12, 10), new THREE.MeshStandardMaterial({ color: WELD, emissive: WELD, emissiveIntensity: 0.7, depthTest: false, transparent: true }));
      mesh.renderOrder = 5;
      mesh.position.copy(at);
      return mesh;
    }
    const screw = m.type === 'tornillo';
    const geo = new THREE.CylinderGeometry((screw ? 5 : 4) * k, (screw ? 5 : 4) * k, (screw ? 5 : 12) * k, 14);
    const axis = m.axis ?? 'y';
    if (axis === 'x') geo.rotateZ(Math.PI / 2);
    if (axis === 'z') geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: screw ? '#1d1b18' : '#8a5a2b', emissive: screw ? ACCENT : new THREE.Color('#000'), emissiveIntensity: screw ? 0.55 : 0, roughness: 0.5, metalness: screw ? 0.4 : 0, depthTest: false, transparent: true,
    }));
    mesh.renderOrder = 5;
    mesh.position.copy(at);
    return mesh;
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

  // ---------- cámara ----------

  resetView(): void {
    const dist = (this.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.08;
    const dir = new THREE.Vector3(0.95, 0.62, 1.25).normalize();
    this.camera.position.copy(this.center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(5, dist / 200);
    this.camera.far = dist * 12;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.center);
    if (this.controls) {
      this.controls.target.copy(this.center);
      this.controls.minDistance = dist * 0.25;
      this.controls.maxDistance = dist * 2.4;
      this.controls.maxPolarAngle = Math.PI * 0.56;
      this.controls.update();
    }
    this.dirty = true;
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
    if (Math.abs(this.explode - this.explodeTarget) > 0.001) {
      this.explode += (this.explodeTarget - this.explode) * Math.min(1, dt * 9);
      animating = true;
    } else if (this.explode !== this.explodeTarget) {
      this.explode = this.explodeTarget;
      animating = true;
    }
    if (animating) {
      this.applyState();
      this.dirty = true;
    }
    this.controls?.update();
    if (this.dirty) {
      this.placeLabels();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** Dibuja un fotograma inmediato (para capturas sin bucle). */
  renderNow(): void {
    this.explode = this.explodeTarget;
    for (const it of this.items) it.appear = 1;
    this.applyState();
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- selección ----------

  private bindPicking(): void {
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = this.canvas.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, this.camera);
      const targets: THREE.Object3D[] = [];
      for (const it of this.items) if (it.group.visible) it.group.traverse((o) => (o as THREE.Mesh).isMesh && targets.push(o));
      const hit = ray.intersectObjects(targets, false)[0];
      const id = (hit?.object.userData.partId as string | undefined) ?? null;
      this.select(id === this.selected ? null : id);
      this.onSelect?.(this.selected);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    this.clear();
    this.renderer.dispose();
  }
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
    g.strokeStyle = '#1d1b18';
    g.stroke();
    g.fillStyle = '#1d1b18';
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
