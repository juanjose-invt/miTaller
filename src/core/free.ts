/**
 * MODO LIBRE: la persona coloca a mano listones, tableros, tubos, pletinas y redondos, y de aquí
 * sale un `Project` normal (modelo 3D, lista de corte, compra y manual).
 *
 * Lógica pura, sin React. Unidades en mm; ejes como en `types.ts` (Y hacia arriba, suelo en y = 0).
 * Cada pieza se guarda por su esquina mínima `at`, igual que en el `Builder`.
 *
 * El modo libre no inventa técnica: detecta los encuentros (piezas en contacto), deja elegir una
 * unión genérica por encuentro y redacta los pasos de forma honesta.
 */
import type { Axis, Craft, HardwareLine, Mark, MaterialId, Part, Project, Step, Vec3 } from './types';
import { Builder, boundsOf, cordonPerimetral, espigas, tornillos } from './builder';
import { MATERIALS } from './materials';
import { cutList, fmtCut } from './derive';

// ---------- modelo de datos ----------

export type FreeKind = 'liston' | 'tablero' | 'tubo' | 'pletina' | 'redondo';
export type JointKind = 'tornillo' | 'tubillon' | 'cola' | 'soldadura';

export interface FreePart {
  id: string;
  kind: FreeKind;
  /** Nombre que le da la persona («Pata», «Travesaño»…). */
  name: string;
  material: MaterialId;
  /**
   * Sección [a, b] en mm (listón, tubo, pletina). Se orienta como en `Builder.liston`:
   * eje 'y' → a en X y b en Z · eje 'x' → a en Y y b en Z · eje 'z' → a en X y b en Y.
   */
  section?: [number, number];
  /** Espesor de pared (tubo). */
  wall?: number;
  /** Diámetro (redondo). */
  diameter?: number;
  /** Grueso (tablero). */
  thickness?: number;
  /** Ancho (tablero). La cara del tablero mide `length` × `width`. */
  width?: number;
  /** Largo de la pieza (en tableros, el lado mayor de la cara si no se gira). */
  length: number;
  /**
   * Orientación. Piezas lineales: eje del largo. Tableros: normal de la cara
   * ('y' tumbado, 'x' de canto a lo fondo, 'z' de canto a lo ancho), con la cara [length, width]
   * repartida como en `Builder.panel`.
   */
  axis: Axis;
  /** Esquina mínima en mm. */
  at: Vec3;
  /** Grupo de montaje (texto libre). */
  group?: string;
}

export interface FreeDesign {
  name: string;
  /** Oficio; sin valor se deduce de los materiales. */
  craft?: Craft;
  parts: FreePart[];
  /** Unión elegida por encuentro: clave `jointKey(a, b)`. */
  joints?: Record<string, JointKind>;
}

export const KIND_LABEL: Record<FreeKind, string> = {
  liston: 'Listón', tablero: 'Tablero', tubo: 'Tubo', pletina: 'Pletina', redondo: 'Redondo',
};

export const JOINT_LABEL: Record<JointKind, string> = {
  tornillo: 'Tornillo', tubillon: 'Tubillón', cola: 'Cola', soldadura: 'Soldadura',
};

/** Materiales que admite cada tipo de pieza (el primero es el de por defecto). */
export const KIND_MATERIALS: Record<FreeKind, MaterialId[]> = {
  liston: ['pino', 'haya'],
  tablero: ['pino', 'contrachapado', 'dm'],
  tubo: ['acero'],
  pletina: ['acero'],
  redondo: ['acero', 'haya', 'pino'],
};

export interface SectionPreset {
  label: string;
  /** Valores que se aplican a la pieza. */
  set: Partial<FreePart>;
}

/**
 * Secciones de partida habituales para empezar rápido. Son decisiones de diseño, no un catálogo:
 * todas se pueden editar y conviene comprobarlas en el almacén.
 */
export const PRESETS: Record<FreeKind, SectionPreset[]> = {
  liston: [
    { label: '45 × 45', set: { section: [45, 45] } },
    { label: '70 × 20', set: { section: [70, 20] } },
    { label: '95 × 20', set: { section: [95, 20] } },
    { label: '34 × 34', set: { section: [34, 34] } },
    { label: '20 × 20', set: { section: [20, 20] } },
  ],
  tablero: [
    { label: '18 mm', set: { thickness: 18 } },
    { label: '15 mm', set: { thickness: 15 } },
    { label: '10 mm', set: { thickness: 10 } },
  ],
  tubo: [
    { label: '30 × 30 × 1,5', set: { section: [30, 30], wall: 1.5 } },
    { label: '40 × 40 × 1,5', set: { section: [40, 40], wall: 1.5 } },
    { label: '40 × 40 × 2', set: { section: [40, 40], wall: 2 } },
    { label: '40 × 20 × 1,5', set: { section: [40, 20], wall: 1.5 } },
  ],
  pletina: [
    { label: '30 × 4', set: { section: [30, 4] } },
    { label: '40 × 4', set: { section: [40, 4] } },
    { label: '20 × 3', set: { section: [20, 3] } },
  ],
  redondo: [
    { label: 'Ø 12', set: { diameter: 12 } },
    { label: 'Ø 16', set: { diameter: 16 } },
    { label: 'Ø 20', set: { diameter: 20 } },
  ],
};

/** Pieza nueva con valores de partida razonables (sin posición). */
export function newPart(kind: FreeKind, id: string): FreePart {
  const base = { id, kind, name: KIND_LABEL[kind], at: [0, 0, 0] as Vec3 };
  switch (kind) {
    case 'liston': return { ...base, material: 'pino', section: [45, 45], length: 600, axis: 'y' };
    case 'tablero': return { ...base, material: 'pino', thickness: 18, length: 800, width: 400, axis: 'y' };
    case 'tubo': return { ...base, material: 'acero', section: [30, 30], wall: 1.5, length: 600, axis: 'y' };
    case 'pletina': return { ...base, material: 'acero', section: [30, 4], length: 400, axis: 'x' };
    case 'redondo': return { ...base, material: 'acero', diameter: 12, length: 500, axis: 'y' };
  }
}

/** Límites de medida aceptados (mm). */
export const LIMITS = { min: 1, max: 6000, pos: 20000 } as const;
const clampDim = (n: number, d: number) => (Number.isFinite(n) ? Math.min(LIMITS.max, Math.max(LIMITS.min, n)) : d);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Deja una pieza con todos sus campos coherentes (medidas positivas, campos del tipo). */
export function normalizePart(p: FreePart): FreePart {
  const d = newPart(p.kind, p.id);
  const mats = KIND_MATERIALS[p.kind];
  const out: FreePart = {
    id: p.id, kind: p.kind, name: (p.name ?? '').trim() || d.name,
    material: mats.includes(p.material) ? p.material : mats[0],
    length: r1(clampDim(p.length, d.length)),
    axis: p.axis === 'x' || p.axis === 'y' || p.axis === 'z' ? p.axis : d.axis,
    at: [0, 1, 2].map((i) => {
      const v = Number(p.at?.[i]);
      return Number.isFinite(v) ? r1(Math.min(LIMITS.pos, Math.max(i === 1 ? 0 : -LIMITS.pos, v))) : 0;
    }) as Vec3,
    group: p.group?.trim() || undefined,
  };
  if (p.kind === 'liston' || p.kind === 'tubo' || p.kind === 'pletina') {
    const s = p.section ?? d.section!;
    out.section = [r1(clampDim(s[0], d.section![0])), r1(clampDim(s[1], d.section![1]))];
  }
  if (p.kind === 'tubo') {
    const minSide = Math.min(...out.section!);
    out.wall = r1(Math.min(minSide / 2 - 0.1, clampDim(p.wall ?? d.wall!, d.wall!)));
    if (!(out.wall > 0)) out.wall = Math.max(0.1, r1(minSide / 4));
  }
  if (p.kind === 'redondo') out.diameter = r1(clampDim(p.diameter ?? d.diameter!, d.diameter!));
  if (p.kind === 'tablero') {
    out.thickness = r1(clampDim(p.thickness ?? d.thickness!, d.thickness!));
    out.width = r1(clampDim(p.width ?? d.width!, d.width!));
  }
  return out;
}

/** Caja envolvente [x, y, z] de la pieza en mm. */
export function sizeOf(p: FreePart): Vec3 {
  const L = p.length;
  if (p.kind === 'tablero') {
    const t = p.thickness ?? 18, u = L, v = p.width ?? 400;
    return p.axis === 'y' ? [u, t, v] : p.axis === 'x' ? [t, u, v] : [u, v, t];
  }
  const [a, b] = p.kind === 'redondo' ? [p.diameter ?? 12, p.diameter ?? 12] : (p.section ?? [45, 45]);
  if (p.axis === 'y') return [a, L, b];
  if (p.axis === 'x') return [L, a, b];
  return [a, b, L];
}

export const centerOf = (p: FreePart): Vec3 => {
  const s = sizeOf(p);
  return [p.at[0] + s[0] / 2, p.at[1] + s[1] / 2, p.at[2] + s[2] / 2];
};

/** Texto corto de la sección: «45 × 45», «30 × 30 × 1,5», «Ø 12», «18 mm». */
export function sectionLabel(p: FreePart): string {
  const f = (n: number) => String(n).replace('.', ',');
  if (p.kind === 'tablero') return `${f(p.thickness ?? 0)} mm`;
  if (p.kind === 'redondo') return `Ø ${f(p.diameter ?? 0)}`;
  const [a, b] = p.section ?? [0, 0];
  return p.kind === 'tubo' ? `${f(a)} × ${f(b)} × ${f(p.wall ?? 0)}` : `${f(a)} × ${f(b)}`;
}

/** Medidas de una pieza en texto: «Listón 45 × 45 · 600 mm». */
export function partLabel(p: FreePart): string {
  const f = (n: number) => String(n).replace('.', ',');
  if (p.kind === 'tablero') return `${KIND_LABEL[p.kind]} ${f(p.length)} × ${f(p.width ?? 0)} × ${sectionLabel(p)}`;
  return `${KIND_LABEL[p.kind]} ${sectionLabel(p)} · ${f(p.length)} mm`;
}

/** Cambia la orientación manteniendo el centro de la pieza (y sin bajar del suelo). */
export function reorient(p: FreePart, axis: Axis): FreePart {
  const c = centerOf(p);
  const q = { ...p, axis };
  const s = sizeOf(q);
  q.at = [r1(c[0] - s[0] / 2), r1(Math.max(0, c[1] - s[1] / 2)), r1(c[2] - s[2] / 2)];
  return q;
}

/** Gira la sección 90° sobre su propio largo (listón de canto ↔ tumbado; tablero: largo ↔ ancho). */
export function turnSection(p: FreePart): FreePart {
  const c = centerOf(p);
  let q: FreePart;
  if (p.kind === 'tablero') q = { ...p, length: p.width ?? p.length, width: p.length };
  else if (p.section) q = { ...p, section: [p.section[1], p.section[0]] };
  else return p;
  const s = sizeOf(q);
  q.at = [r1(c[0] - s[0] / 2), r1(Math.max(0, c[1] - s[1] / 2)), r1(c[2] - s[2] / 2)];
  return q;
}

export function craftOf(d: FreeDesign): Craft {
  if (d.craft) return d.craft;
  const steel = d.parts.filter((p) => MATERIALS[p.material].kind === 'metal').length;
  return steel > d.parts.length / 2 ? 'soldadura' : 'carpinteria';
}

/** Siguiente id libre: p1, p2… */
export function nextId(d: FreeDesign): string {
  let n = d.parts.length + 1;
  const ids = new Set(d.parts.map((p) => p.id));
  while (ids.has(`p${n}`)) n++;
  return `p${n}`;
}

// ---------- geometría: cajas, solapes, encuentros ----------

interface Box { min: Vec3; max: Vec3 }
export function boxOf(p: FreePart, at: Vec3 = p.at): Box {
  const s = sizeOf(p);
  return { min: [...at] as Vec3, max: [at[0] + s[0], at[1] + s[1], at[2] + s[2]] };
}
function overlaps3(a: Box, b: Box): Vec3 {
  return [0, 1, 2].map((i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i])) as Vec3;
}

export interface Overlap { a: string; b: string; /** mm³ */ volume: number }

/** Pares de piezas que ocupan el mismo volumen (con 0,5 mm de tolerancia, como `validate.ts`). */
export function findOverlaps(d: FreeDesign, override?: { id: string; at: Vec3 }): Overlap[] {
  const boxes = d.parts.map((p) => boxOf(p, override && override.id === p.id ? override.at : p.at));
  const out: Overlap[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const o = overlaps3(boxes[i], boxes[j]);
      if (o.some((v) => v <= 0.5)) continue;
      const vol = o[0] * o[1] * o[2];
      if (vol > 50) out.push({ a: d.parts[i].id, b: d.parts[j].id, volume: vol });
    }
  }
  return out;
}

/** Encuentro: dos piezas que se tocan cara con cara. */
export interface Contact {
  key: string;
  a: string;
  b: string;
  /** Normal del plano de contacto. */
  axis: Axis;
  /** Parche de contacto (caja plana en `axis`). */
  min: Vec3;
  max: Vec3;
}

const AXES: Axis[] = ['x', 'y', 'z'];
const TOUCH = 1; // mm: holgura con la que dos caras se consideran en contacto
const MIN_PATCH = 1; // mm: solape mínimo en las otras dos direcciones

export const jointKey = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);

export function findContacts(d: FreeDesign): Contact[] {
  const out: Contact[] = [];
  for (let i = 0; i < d.parts.length; i++) {
    for (let j = i + 1; j < d.parts.length; j++) {
      const A = boxOf(d.parts[i]), B = boxOf(d.parts[j]);
      const o = overlaps3(A, B);
      const touching = [0, 1, 2].filter((k) => Math.abs(o[k]) <= TOUCH);
      const spread = [0, 1, 2].filter((k) => o[k] > MIN_PATCH);
      if (touching.length !== 1 || spread.length !== 2) continue;
      const k = touching[0];
      const min = [0, 1, 2].map((m) => Math.max(A.min[m], B.min[m])) as Vec3;
      const max = [0, 1, 2].map((m) => Math.min(A.max[m], B.max[m])) as Vec3;
      const plane = (A.max[k] + B.min[k]) / 2;
      const face = Math.abs(A.max[k] - B.min[k]) <= TOUCH ? plane : (B.max[k] + A.min[k]) / 2;
      min[k] = max[k] = face;
      out.push({ key: jointKey(d.parts[i].id, d.parts[j].id), a: d.parts[i].id, b: d.parts[j].id, axis: AXES[k], min, max });
    }
  }
  return out;
}

/** Uniones que tiene sentido ofrecer según los materiales del encuentro. */
export function allowedJoints(a: FreePart, b: FreePart): JointKind[] {
  const ma = MATERIALS[a.material].kind === 'metal', mb = MATERIALS[b.material].kind === 'metal';
  if (ma && mb) return ['soldadura', 'tornillo'];
  if (ma || mb) return ['tornillo'];
  return ['tornillo', 'tubillon', 'cola'];
}

function jointMarks(c: Contact, j: JointKind): Mark[] {
  const ctr: Vec3 = [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2];
  const k = AXES.indexOf(c.axis);
  const [u, v] = [0, 1, 2].filter((m) => m !== k);
  const du = c.max[u] - c.min[u], dv = c.max[v] - c.min[v];
  if (j === 'soldadura') return cordonPerimetral(ctr, c.axis, du, dv);
  if (j === 'cola') return [];
  // dos marcas si el contacto es alargado; una si es pequeño (las marcas enseñan dónde, no cuántos)
  const pts: Vec3[] = [];
  const long = du >= dv ? u : v, len = Math.max(du, dv);
  if (len >= 120) {
    for (const f of [0.25, 0.75]) {
      const p: Vec3 = [...ctr];
      p[long] = c.min[long] + (c.max[long] - c.min[long]) * f;
      pts.push(p);
    }
  } else pts.push(ctr);
  return j === 'tornillo' ? tornillos(pts, c.axis) : espigas(pts, c.axis);
}

/** Línea de fijaciones genérica (sin medidas: dependen de las piezas y las elige la persona). */
function jointHardware(j: JointKind, metal: boolean): string {
  if (j === 'tornillo') return metal
    ? 'Tornillos con tuerca y arandela: elige métrica y largo según el grueso de las piezas'
    : 'Tornillos para madera: elige medida y cantidad según el grueso de las piezas';
  if (j === 'tubillon') return 'Tubillones y cola: elige diámetro y largo según el grueso de las piezas';
  if (j === 'cola') return 'Cola para madera';
  return 'Material de aportación (electrodo o hilo) según tu equipo y el espesor';
}

// ---------- imanes ----------

export interface SnapOpts {
  /** Paso de la rejilla en mm (5 o 10). */
  grid?: number;
  /** Distancia a la que actúan los imanes de cara, ras, centro y suelo (mm). */
  threshold?: number;
  /** Ejes que se ajustan (los que se están moviendo). Por defecto, los tres. */
  axes?: Axis[];
}
export type SnapKind = 'cara' | 'ras' | 'centro' | 'suelo' | 'rejilla';
export interface SnapHit { axis: Axis; kind: SnapKind; with?: string }

const NEAR = 300; // mm: hasta qué distancia una pieza cuenta como vecina para alinear a ras o centrar

/**
 * Ajusta la posición propuesta `at` (esquina mínima) de la pieza `id`: primero a caras de las
 * piezas vecinas (cara con cara, a ras, centrado) y al suelo si están a menos de `threshold`;
 * si no, a la rejilla. Nunca deja la pieza por debajo del suelo.
 */
export function snapDetailed(d: FreeDesign, id: string, at: Vec3, opts: SnapOpts = {}): { at: Vec3; hits: SnapHit[] } {
  const grid = opts.grid ?? 10, th = opts.threshold ?? 15;
  const axes = opts.axes ?? AXES;
  const me = d.parts.find((p) => p.id === id);
  if (!me) return { at, hits: [] };
  const s = sizeOf(me);
  const out: Vec3 = [...at];
  const hits: SnapHit[] = [];
  const others = d.parts.filter((p) => p.id !== id).map((p) => ({ p, b: boxOf(p) }));
  for (const ax of axes) {
    const i = AXES.indexOf(ax);
    const [j, k] = [0, 1, 2].filter((m) => m !== i);
    let best: { v: number; score: number; kind: SnapKind; with?: string } | null = null;
    const offer = (v: number, kind: SnapKind, bonus: number, w?: string) => {
      const dist = Math.abs(v - at[i]);
      if (dist > th) return;
      const score = dist - bonus;
      if (!best || score < best.score) best = { v, score, kind, with: w };
    };
    if (i === 1) offer(0, 'suelo', 4);
    for (const { p, b } of others) {
      // hueco entre las cajas en las otras dos direcciones (negativo = se cruzan)
      const gap = (m: number) => Math.max(b.min[m] - (out[m] + s[m]), out[m] - b.max[m]);
      const gj = gap(j), gk = gap(k);
      if (gj < -MIN_PATCH && gk < -MIN_PATCH) {
        // se cruzan en las otras dos direcciones: imán cara con cara
        offer(b.max[i], 'cara', 6, p.id);
        offer(b.min[i] - s[i], 'cara', 6, p.id);
      }
      if (gj <= NEAR && gk <= NEAR) {
        offer(b.min[i], 'ras', 2, p.id);
        offer(b.max[i] - s[i], 'ras', 2, p.id);
        offer((b.min[i] + b.max[i]) / 2 - s[i] / 2, 'centro', 1, p.id);
      }
    }
    const chosen = best as { v: number; kind: SnapKind; with?: string } | null;
    if (chosen) {
      out[i] = r1(chosen.v);
      hits.push({ axis: ax, kind: chosen.kind, with: chosen.with });
    } else {
      out[i] = Math.round(at[i] / grid) * grid;
      hits.push({ axis: ax, kind: 'rejilla' });
    }
  }
  if (out[1] < 0) out[1] = 0;
  return { at: out, hits };
}

/** Versión corta de `snapDetailed`: solo la posición ajustada. */
export function snap(d: FreeDesign, id: string, at: Vec3, opts?: SnapOpts): Vec3 {
  return snapDetailed(d, id, at, opts).at;
}

/** Sitio visible y libre para una pieza nueva: a la derecha o delante de lo que ya hay, sobre el suelo. */
export function placeNew(d: FreeDesign, p: FreePart): Vec3 {
  if (!d.parts.length) return [0, 0, 0];
  const s = sizeOf(p);
  const boxes = d.parts.map((q) => boxOf(q));
  const min = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))) as Vec3;
  const max = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i]))) as Vec3;
  const gap = 80;
  const right: Vec3 = [Math.ceil((max[0] + gap) / 10) * 10, 0, Math.round(min[2] / 10) * 10];
  const front: Vec3 = [Math.round(min[0] / 10) * 10, 0, Math.ceil((max[2] + gap) / 10) * 10];
  const spanX = Math.max(max[0], right[0] + s[0]) - min[0];
  const spanZ = Math.max(max[2], front[2] + s[2]) - min[2];
  const grow = (sx: number, sz: number) => Math.max(sx, sz, max[0] - min[0], max[2] - min[2]);
  return grow(spanX, max[2] - min[2]) <= grow(max[0] - min[0], spanZ) ? right : front;
}

// ---------- de diseño libre a proyecto ----------

function letter(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Firma de corte: piezas con la misma firma son idénticas y comparten letra. */
function signature(p: FreePart): string {
  const dims = p.kind === 'tablero'
    ? [p.thickness, Math.max(p.length, p.width ?? 0), Math.min(p.length, p.width ?? 0)]
    : p.kind === 'redondo' ? [p.diameter, p.length] : [...(p.section ?? [0, 0])].sort((x, y) => y - x).concat(p.length, p.wall ?? 0);
  return `${p.kind}|${p.material}|${dims.map((n) => r1(n ?? 0)).join('x')}`;
}

/** Letra de referencia de cada pieza: piezas idénticas comparten letra, por orden de aparición. */
export function refsOf(d: FreeDesign): Map<string, string> {
  const bySig = new Map<string, string>();
  const out = new Map<string, string>();
  for (const p of d.parts) {
    const sig = signature(p);
    if (!bySig.has(sig)) bySig.set(sig, letter(bySig.size));
    out.set(p.id, bySig.get(sig)!);
  }
  return out;
}

interface Batch { title: string; label: string; ids: string[] }

/** Tandas de montaje: los grupos que define la persona o, si no hay ninguno, por alturas. */
export function batchesOf(d: FreeDesign): Batch[] {
  const parts = d.parts;
  if (!parts.length) return [];
  const bottom = (p: FreePart) => p.at[1];
  const top = (p: FreePart) => p.at[1] + sizeOf(p)[1];
  if (parts.some((p) => p.group)) {
    const groups = new Map<string, FreePart[]>();
    for (const p of parts) {
      const g = p.group ?? '';
      groups.set(g, [...(groups.get(g) ?? []), p]);
    }
    const named = [...groups.entries()].filter(([g]) => g).sort((a, b) => {
      const ya = Math.min(...a[1].map(bottom)), yb = Math.min(...b[1].map(bottom));
      return ya - yb || a[0].localeCompare(b[0], 'es');
    });
    const out: Batch[] = named.map(([g, ps]) => ({ title: `Monta: ${g}`, label: g, ids: ps.map((p) => p.id) }));
    const rest = groups.get('');
    if (rest?.length) out.push({ title: 'Monta las piezas sin grupo', label: 'Sin grupo', ids: rest.map((p) => p.id) });
    return out;
  }
  const sorted = [...parts].sort((a, b) => bottom(a) - bottom(b) || top(a) - top(b));
  const n = sorted.length;
  const k = n <= 3 ? 1 : n <= 8 ? 2 : n <= 16 ? 3 : 4;
  const out: Batch[] = [];
  let start = 0;
  for (let t = 0; t < k && start < n; t++) {
    let end = t === k - 1 ? n : Math.round(((t + 1) * n) / k);
    // no se separan piezas que arrancan a la misma altura
    while (end < n && end > start && Math.abs(bottom(sorted[end]) - bottom(sorted[end - 1])) < 1) end++;
    if (end <= start) continue;
    const slice = sorted.slice(start, end);
    const hTop = Math.round(Math.max(...slice.map(top)));
    const pos = k === 1 ? '' : t === 0 ? ' (abajo)' : end >= n ? ' (arriba)' : '';
    const title = k === 1 ? 'Monta el conjunto' : `Monta la tanda ${out.length + 1}${pos}`;
    out.push({ title, label: `Tanda ${out.length + 1}: hasta ${hTop} mm de altura`, ids: slice.map((p) => p.id) });
    start = end;
  }
  return out;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

export const LIBRE_DISCLAIMER = 'El modo libre no elige las uniones por ti: decide cómo unir cada encuentro; mira Consejos.';

/**
 * Convierte un diseño libre en un proyecto: letras automáticas, un paso de corte, un paso de
 * montaje por grupo (o por tandas de altura) y un paso de acabado. Lanza un error si no hay piezas.
 */
export function toProject(design: FreeDesign): Project {
  const d: FreeDesign = { ...design, parts: design.parts.map(normalizePart) };
  if (!d.parts.length) throw new Error('El diseño no tiene piezas');
  const craft = craftOf(d);
  const refs = refsOf(d);
  const byId = new Map(d.parts.map((p) => [p.id, p]));
  const b = new Builder();
  for (const p of d.parts) {
    const ref = refs.get(p.id)!;
    const common = { ref, name: p.name, at: p.at, id: p.id };
    if (p.kind === 'liston') b.liston({ ...common, material: p.material, section: p.section!, length: p.length, axis: p.axis });
    else if (p.kind === 'tubo') b.tubo({ ...common, section: p.section!, wall: p.wall!, length: p.length, axis: p.axis });
    else if (p.kind === 'pletina') b.pletina({ ...common, section: p.section!, length: p.length, axis: p.axis });
    else if (p.kind === 'redondo') b.redondo({ ...common, material: p.material, diameter: p.diameter!, length: p.length, axis: p.axis });
    else b.panel({ ...common, material: p.material, thickness: p.thickness!, face: [p.length, p.width!], normal: p.axis });
  }
  const metal = d.parts.some((p) => MATERIALS[p.material].kind === 'metal');
  const wood = d.parts.some((p) => MATERIALS[p.material].kind === 'madera');
  const cuts = cutList({ parts: b.parts } as Project);

  // 1) corte
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: `Deja las ${d.parts.length} piezas a su medida y marca cada una con su letra antes de montar nada.`,
    detail: [
      ...cuts.map((c) => `${c.ref} · ${c.name}: ${c.qty} ${c.qty === 1 ? 'pieza' : 'piezas'} de ${fmtCut(c)} mm (${c.stock.charAt(0).toLowerCase()}${c.stock.slice(1)}).`),
      'Mide y marca con escuadra; las piezas con la misma letra deben salir idénticas, así que córtalas con un tope.',
      'Escribe la letra de cada pieza a lápiz o con rotulador en una cara que no se vaya a ver.',
    ],
    parts: [],
    tools: [
      'Flexómetro', 'Escuadra',
      ...(wood ? ['Lápiz', 'Sierra de mano, circular o ingletadora'] : []),
      ...(metal ? ['Rotulador o rayador', 'Tronzadora, sierra de cinta o amoladora con disco de corte'] : []),
    ],
    warning: 'Sujeta siempre la pieza con sargentos o en el tornillo de banco: nunca con la mano cerca de la línea de corte.',
  });

  // 2…n) montaje por grupos o tandas
  const contacts = findContacts(d);
  const batches = batchesOf(d);
  const stepOf = new Map<string, number>();
  batches.forEach((bt, i) => bt.ids.forEach((id) => stepOf.set(id, i)));
  const joints = d.joints ?? {};
  const nameRef = (id: string) => `${refs.get(id)} (${byId.get(id)!.name.toLowerCase()})`;
  batches.forEach((bt, i) => {
    const mine = contacts.filter((c) => Math.max(stepOf.get(c.a)!, stepOf.get(c.b)!) === i);
    const marks: Mark[] = [];
    const hwCount = new Map<JointKind, number>();
    const hwItems = new Map<string, number>();
    const lines = new Map<string, { text: string; n: number; joint?: JointKind }>();
    for (const c of mine) {
      const pa = byId.get(c.a)!, pb = byId.get(c.b)!;
      const jRaw = joints[c.key];
      const j = jRaw && allowedJoints(pa, pb).includes(jRaw) ? jRaw : undefined;
      if (j) {
        marks.push(...jointMarks(c, j));
        hwCount.set(j, (hwCount.get(j) ?? 0) + 1);
        const item = jointHardware(j, MATERIALS[pa.material].kind === 'metal' || MATERIALS[pb.material].kind === 'metal');
        hwItems.set(item, (hwItems.get(item) ?? 0) + 1);
      }
      const [x, y] = [c.a, c.b].sort((u, v) => refs.get(u)!.localeCompare(refs.get(v)!, 'es', { numeric: true }));
      const key = `${refs.get(x)}|${refs.get(y)}|${j ?? ''}`;
      const cur = lines.get(key);
      if (cur) cur.n++;
      else lines.set(key, { text: `Une ${nameRef(x)} con ${nameRef(y)}`, n: 1, joint: j });
    }
    const counts = new Map<string, number>();
    for (const id of bt.ids) counts.set(refs.get(id)!, (counts.get(refs.get(id)!) ?? 0) + 1);
    const placed = [...counts.entries()]
      .sort((a, b2) => a[0].localeCompare(b2[0], 'es', { numeric: true }))
      .map(([ref, n]) => `${ref} · ${d.parts.find((p) => refs.get(p.id) === ref)!.name}${n > 1 ? ` ×${n}` : ''}`);
    const jointLines = [...lines.values()].map((l) => {
      const many = l.n > 1 ? ` (${l.n} encuentros)` : '';
      if (!l.joint) return `${l.text}${many}: unión por decidir.`;
      return `${l.text}${many}: ${l.joint === 'tornillo' ? 'con tornillos' : l.joint === 'tubillon' ? 'con tubillones' : l.joint === 'cola' ? 'encolado' : 'con soldadura'}.`;
    });
    const welds = hwCount.has('soldadura');
    const hardware: HardwareLine[] = [...hwItems.entries()].map(([item, n]) => ({ item, qty: n, unit: n === 1 ? 'unión' : 'uniones' }));
    const tools = new Set<string>(['Escuadra', 'Flexómetro', 'Sargentos']);
    if (hwCount.has('tornillo')) tools.add('Taladro atornillador');
    if (hwCount.has('tubillon')) tools.add('Taladro y broca del diámetro del tubillón');
    if (welds) tools.add('Equipo de soldadura y su protección');
    b.step({
      kind: welds ? 'soldar' : 'montar',
      title: bt.title,
      summary: `Coloca ${bt.ids.length === 1 ? 'una pieza' : `${bt.ids.length} piezas`}${mine.length ? ` y resuelve ${mine.length === 1 ? 'un encuentro' : `${mine.length} encuentros`}` : ''}${bt.title.startsWith('Monta la tanda') ? ` (${bt.label.split(': ')[1]})` : ''}.`,
      detail: [
        `Coloca en su sitio, como en el modelo: ${list(placed)}.`,
        ...(jointLines.length ? jointLines : ['Estas piezas no tocan a ninguna otra en el modelo: revisa en qué apoyan antes de fijarlas.']),
        LIBRE_DISCLAIMER,
        'Presenta las piezas en seco y sujétalas con sargentos antes de fijar nada.',
      ],
      parts: bt.ids,
      marks: marks.length ? marks : undefined,
      hardware: hardware.length ? hardware : undefined,
      tools: [...tools],
      check: 'Antes de seguir, comprueba con el flexómetro y la escuadra que todo está en su sitio y a escuadra.',
    });
  });

  // último) acabado
  b.step({
    kind: 'acabar',
    title: 'Repasa y da el acabado',
    summary: 'Revisa todas las uniones y protege el conjunto.',
    detail: [
      'Revisa todas las uniones y que el conjunto apoya bien y no cojea.',
      ...(wood ? ['Matiza aristas y lija la madera; quita el polvo y aplica el acabado que prefieras (aceite, barniz o pintura) siguiendo las indicaciones del fabricante.'] : []),
      ...(metal ? ['Limpia escoria y salpicaduras; amola los cordones que tengan que quedar a ras. Desengrasa el acero y aplica imprimación antioxidante y pintura siguiendo las indicaciones del fabricante.'] : []),
    ],
    parts: [],
    tools: [...(wood ? ['Lija', 'Brocha o paño'] : []), ...(metal ? ['Amoladora con disco de láminas', 'Brocha o pistola'] : [])],
  });

  const nJoined = contacts.filter((c) => joints[c.key] && allowedJoints(byId.get(c.a)!, byId.get(c.b)!).includes(joints[c.key])).length;
  const proj = b.finish({
    id: 'libre',
    title: d.name.trim() || 'Diseño libre',
    craft,
    summary: `Diseño libre de ${d.parts.length} ${d.parts.length === 1 ? 'pieza' : 'piezas'}, montado en ${batches.length} ${batches.length === 1 ? 'tanda' : 'tandas'}.`,
    difficulty: 2,
    hours: Math.max(1, Math.round(1 + d.parts.length * 0.4 + contacts.length * 0.15)),
    safety: [
      'Gafas de protección siempre que cortes, taladres, amoles o lijes; mascarilla al lijar.',
      'Sujeta la pieza con sargentos: nunca con la mano cerca de la línea de corte o de la broca.',
      'Desenchufa la herramienta o quita la batería antes de cambiar la broca, la hoja o el disco.',
      ...(metal ? [
        'Para soldar: careta con el filtro adecuado a tu proceso, guantes de soldador, ropa ignífuga de manga larga y calzado de seguridad.',
        'No respires el humo de soldadura: trabaja con extracción localizada o al aire libre. No sueldes acero galvanizado sin quitar antes el recubrimiento.',
        'Aparta todo lo que pueda arder, ten un extintor a mano y vigila la zona un buen rato después de terminar. El acero recién soldado quema aunque no lo parezca.',
      ] : []),
    ],
    notes: [
      'Diseño hecho a mano en el modo libre: todas las medidas y secciones son decisiones tuyas.',
      'El modo libre no comprueba la resistencia del conjunto ni da carga máxima. Si va a soportar peso o personas, pide consejo a alguien con oficio.',
      LIBRE_DISCLAIMER,
      'El tiempo es una estimación gruesa a partir del número de piezas y de encuentros.',
    ],
    spec: [
      { label: 'Piezas', value: `${d.parts.length} (${new Set(refs.values()).size} referencias)` },
      { label: 'Encuentros', value: contacts.length ? `${contacts.length}, ${nJoined} con unión elegida` : 'Ninguno' },
      { label: 'Montaje', value: batches.map((bt) => bt.label).join(' · ') },
    ],
  });
  return proj;
}

/**
 * Proyecto para el editor: todas las piezas a la vista con su letra y todas las marcas de las
 * uniones elegidas (un solo paso de montaje). `null` si no hay piezas.
 */
export function previewProject(design: FreeDesign): Project | null {
  return design.parts.length ? asPreview(toProject(design)) : null;
}

/**
 * Versión «editor» de un proyecto ya generado: un paso con todas las piezas (sin resaltar) y
 * un segundo paso vacío con todas las marcas de unión. Muéstralo en su último paso.
 */
export function asPreview(full: Project): Project {
  const marks = full.steps.flatMap((s) => s.marks ?? []);
  const all: Step = { kind: 'preparar', title: 'Piezas', summary: 'Piezas', detail: ['Piezas'], parts: full.parts.map((p) => p.id) };
  const joints: Step = { kind: 'montar', title: 'Uniones', summary: 'Uniones', detail: ['Uniones'], parts: [], marks };
  return { ...full, steps: [all, joints] };
}

/** Las piezas del proyecto, para la interfaz (por id). */
export function partsById(p: Project): Map<string, Part> {
  return new Map(p.parts.map((q) => [q.id, q]));
}

export function designBounds(d: FreeDesign): { min: Vec3; size: Vec3 } | null {
  if (!d.parts.length) return null;
  const parts = d.parts.map((p) => ({ pos: centerOf(p), size: sizeOf(p) }) as Part);
  const b = boundsOf(parts);
  return { min: b.min, size: b.size };
}

// ---------- serialización ----------
/*
 * Texto compacto y apto para URL sin codificar (solo letras, cifras y - _ . ! ~ * ' ( ) ):
 *
 *   L1!<nombre>!<oficio a|c|s>!<grupos ~>!<piezas ~>!<uniones ~>
 *   pieza  = tipo*material*medidas*largo*eje*x*y*z*grupo*nombre
 *            tipo l listón · t tablero · u tubo · p pletina · r redondo
 *            material p pino · h haya · c contrachapado · d dm · a acero
 *            medidas: listón/pletina «AxB», tubo «AxBxPared», redondo «D», tablero «GruesoxAncho»
 *            grupo: índice en la lista de grupos o vacío
 *   unión  = i.j.T|D|C|S   (índices de pieza; tornillo, tubillón, cola, soldadura)
 *   textos: espacio → «.», resto de caracteres especiales → «'» + byte UTF-8 en hex.
 */

const KIND_CODE: Record<FreeKind, string> = { liston: 'l', tablero: 't', tubo: 'u', pletina: 'p', redondo: 'r' };
const MAT_CODE: Partial<Record<MaterialId, string>> = { pino: 'p', haya: 'h', contrachapado: 'c', dm: 'd', acero: 'a' };
const JOINT_CODE: Record<JointKind, string> = { tornillo: 'T', tubillon: 'D', cola: 'C', soldadura: 'S' };
const inv = <K extends string>(o: Partial<Record<K, string>>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<string, K>;
const KIND_DEC = inv(KIND_CODE), MAT_DEC = inv(MAT_CODE), JOINT_DEC = inv(JOINT_CODE);

function encText(s: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(s)) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9-]/.test(ch)) out += ch;
    else if (ch === ' ') out += '.';
    else out += "'" + byte.toString(16).padStart(2, '0');
  }
  return out;
}
function decText(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.') bytes.push(32);
    else if (ch === "'" && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(ch));
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}
const num = (n: number) => String(r1(n));

export function serializeDesign(d: FreeDesign): string {
  const groups = [...new Set(d.parts.map((p) => p.group).filter((g): g is string => !!g))];
  const idx = new Map(d.parts.map((p, i) => [p.id, i]));
  const parts = d.parts.map((p) => {
    const dims = p.kind === 'tablero' ? `${num(p.thickness ?? 18)}x${num(p.width ?? 400)}`
      : p.kind === 'redondo' ? num(p.diameter ?? 12)
      : p.kind === 'tubo' ? `${num(p.section![0])}x${num(p.section![1])}x${num(p.wall ?? 1.5)}`
      : `${num(p.section![0])}x${num(p.section![1])}`;
    const g = p.group ? String(groups.indexOf(p.group)) : '';
    const name = p.name === KIND_LABEL[p.kind] ? '' : encText(p.name);
    return [KIND_CODE[p.kind], MAT_CODE[p.material] ?? 'p', dims, num(p.length), p.axis, num(p.at[0]), num(p.at[1]), num(p.at[2]), g, name].join('*');
  });
  const joints = Object.entries(d.joints ?? {}).flatMap(([k, j]) => {
    const [a, b] = k.split('+');
    const ia = idx.get(a), ib = idx.get(b);
    return ia === undefined || ib === undefined ? [] : [`${ia}.${ib}.${JOINT_CODE[j]}`];
  });
  const craft = d.craft === 'carpinteria' ? 'c' : d.craft === 'soldadura' ? 's' : 'a';
  return ['L1', encText(d.name), craft, groups.map(encText).join('~'), parts.join('~'), joints.join('~')].join('!');
}

/**
 * Lee un diseño serializado. Tolerante: ignora piezas o uniones mal formadas, corrige medidas
 * fuera de rango y acepta el texto ya codificado para URL. Devuelve `null` si no hay nada legible.
 */
export function parseDesign(text: string | null | undefined): FreeDesign | null {
  if (!text) return null;
  let s = text.trim();
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      /* se queda tal cual */
    }
  }
  const top = s.split('!');
  if (!/^L\d+$/.test(top[0] ?? '')) return null;
  const name = decText(top[1] ?? '').slice(0, 120);
  const craft: Craft | undefined = top[2] === 'c' ? 'carpinteria' : top[2] === 's' ? 'soldadura' : undefined;
  const groups = (top[3] ?? '').split('~').filter(Boolean).map((g) => decText(g).slice(0, 60));
  const parts: FreePart[] = [];
  const idxMap = new Map<number, string>();
  (top[4] ?? '').split('~').forEach((raw, i) => {
    if (!raw) return;
    const f = raw.split('*');
    const kind = KIND_DEC[f[0]];
    if (!kind) return;
    const id = `p${parts.length + 1}`;
    const base = newPart(kind, id);
    const dims = (f[2] ?? '').split('x').map(Number);
    const p: FreePart = {
      ...base,
      material: MAT_DEC[f[1]] ?? base.material,
      length: Number(f[3]),
      axis: (['x', 'y', 'z'] as Axis[]).includes(f[4] as Axis) ? (f[4] as Axis) : base.axis,
      at: [Number(f[5]), Number(f[6]), Number(f[7])],
      group: f[8] !== undefined && f[8] !== '' ? groups[Number(f[8])] : undefined,
      name: f[9] ? decText(f[9]).slice(0, 80) : base.name,
    };
    if (kind === 'tablero') {
      p.thickness = dims[0];
      p.width = dims[1];
    } else if (kind === 'redondo') p.diameter = dims[0];
    else {
      p.section = [dims[0], dims[1]];
      if (kind === 'tubo') p.wall = dims[2];
    }
    idxMap.set(i, id);
    parts.push(normalizePart(p));
  });
  if (!parts.length && !name) return null;
  const joints: Record<string, JointKind> = {};
  for (const raw of (top[5] ?? '').split('~')) {
    const [a, b, c] = raw.split('.');
    const ia = idxMap.get(Number(a)), ib = idxMap.get(Number(b)), j = JOINT_DEC[c];
    if (ia && ib && ia !== ib && j) joints[jointKey(ia, ib)] = j;
  }
  return { name, craft, parts, joints };
}

// ---------- ejemplos ----------

function mk(d: FreeDesign, p: Omit<FreePart, 'id'>): void {
  d.parts.push(normalizePart({ ...p, id: `p${d.parts.length + 1}` }));
}

/**
 * Banco sencillo de listones: cuatro patas 45 × 45, travesaños 70 × 20 a los lados y lamas 95 × 20
 * encima. Medidas de diseño, para empezar a jugar.
 */
export function ejemploBanco(): FreeDesign {
  const d: FreeDesign = { name: 'Banco de listones', craft: 'carpinteria', parts: [], joints: {} };
  const W = 1000, D = 320, H = 430, T = 20, leg = 45, apron = 70;
  const legH = H - T;
  for (const [x, z] of [[40, 0], [W - 40 - leg, 0], [40, D - leg], [W - 40 - leg, D - leg]] as const) {
    mk(d, { kind: 'liston', name: 'Pata', material: 'pino', section: [leg, leg], length: legH, axis: 'y', at: [x, 0, z], group: 'Caballetes' });
  }
  // travesaños de cabecera por fuera de las patas (a lo fondo), bajo las lamas
  for (const x of [40 - T, W - 40]) {
    mk(d, { kind: 'liston', name: 'Travesaño', material: 'pino', section: [T, apron], length: D, axis: 'z', at: [x, legH - apron, 0], group: 'Caballetes' });
  }
  // faldones largos por fuera, delante y detrás
  for (const z of [-T, D]) {
    mk(d, { kind: 'liston', name: 'Faldón', material: 'pino', section: [apron, T], length: W - 80 + 2 * T, axis: 'x', at: [40 - T, legH - apron, z], group: 'Faldones' });
  }
  // lamas del asiento
  const n = 3, gap = (D + 2 * T - n * 95) / (n - 1);
  for (let i = 0; i < n; i++) {
    mk(d, { kind: 'liston', name: 'Lama', material: 'pino', section: [T, 95], length: W, axis: 'x', at: [0, legH, -T + i * (95 + gap)], group: 'Asiento' });
  }
  for (const c of findContacts(d)) d.joints![c.key] = 'tornillo';
  return d;
}

/** Bastidor de tubo 30 × 30 × 1,5: dos marcos laterales unidos por largueros, para mesa auxiliar o soporte. */
export function ejemploBastidor(): FreeDesign {
  const d: FreeDesign = { name: 'Bastidor de tubo', craft: 'soldadura', parts: [], joints: {} };
  const W = 800, D = 400, H = 700, s = 30, w = 1.5;
  for (const [x, z] of [[0, 0], [W - s, 0], [0, D - s], [W - s, D - s]] as const) {
    mk(d, { kind: 'tubo', name: 'Pata', material: 'acero', section: [s, s], wall: w, length: H - s, axis: 'y', at: [x, 0, z], group: 'Laterales' });
  }
  // travesaño bajo de cada lateral (a lo fondo), entre las patas
  for (const x of [0, W - s]) {
    mk(d, { kind: 'tubo', name: 'Travesaño lateral', material: 'acero', section: [s, s], wall: w, length: D - 2 * s, axis: 'z', at: [x, 120, s], group: 'Laterales' });
  }
  // marco superior: largueros a lo ancho y cabeceros a lo fondo, apoyados sobre las patas
  for (const z of [0, D - s]) {
    mk(d, { kind: 'tubo', name: 'Larguero superior', material: 'acero', section: [s, s], wall: w, length: W, axis: 'x', at: [0, H - s, z], group: 'Marco superior' });
  }
  for (const x of [0, W - s]) {
    mk(d, { kind: 'tubo', name: 'Cabecero superior', material: 'acero', section: [s, s], wall: w, length: D - 2 * s, axis: 'z', at: [x, H - s, s], group: 'Marco superior' });
  }
  // larguero bajo central que ata los dos travesaños laterales
  mk(d, { kind: 'tubo', name: 'Larguero bajo', material: 'acero', section: [s, s], wall: w, length: W - 2 * s, axis: 'x', at: [s, 120, D / 2 - s / 2], group: 'Larguero bajo' });
  for (const c of findContacts(d)) d.joints![c.key] = 'soldadura';
  return d;
}

export const EXAMPLES: { id: string; name: string; blurb: string; make: () => FreeDesign }[] = [
  { id: 'banco', name: 'Banco de listones', blurb: 'Patas 45 × 45, travesaños y lamas de pino', make: ejemploBanco },
  { id: 'bastidor', name: 'Bastidor de tubo', blurb: 'Tubo 30 × 30 × 1,5 para soldar', make: ejemploBastidor },
];

export const emptyDesign = (): FreeDesign => ({ name: '', parts: [], joints: {} });
