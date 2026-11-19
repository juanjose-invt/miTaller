/**
 * Plan de corte optimizado (lógica pura, sin React ni DOM).
 *
 * - Material lineal (listón, tubo, pletina, redondo): reparte las piezas en barras de largo comercial
 *   contando la pérdida del disco. Prueba primero-que-cabe y mejor-ajuste decrecientes más un
 *   reparto aleatorio reproducible, y se queda con el que usa menos barras (y deja el sobrante
 *   más aprovechable).
 * - Tableros y malla: empaquetado 2D con cortes de guillotina (cada corte atraviesa de lado a lado
 *   el trozo de tablero que se está dividiendo, como en una sierra de mesa), respetando el disco y
 *   la veta de la madera alistonada.
 *
 * Unidades: milímetros. En un tablero, X es el largo del tablero (y la dirección de la veta) e Y el ancho.
 */
import type { Part, Project } from './types';
import { BAR_LENGTH, KERF, MATERIALS } from './materials';

/** Clave de almacenamiento (src/core/store.ts) de los ajustes del plan de corte. */
export const PLAN_KEY = 'plan-corte';

/** Medida habitual de tablero: compruébala con la de tu almacén. */
export const DEFAULT_SHEET: Sheet2D = { length: 2440, width: 1220 };

export interface Sheet2D {
  /** Largo (dirección de la veta), mm. */
  length: number;
  /** Ancho, mm. */
  width: number;
}

export interface PlanOptions {
  /** Largo de barra por material (clave = `part.stock`). Si falta, el habitual (2400 mm madera, 6000 mm acero). */
  barLengths?: Record<string, number>;
  /** Medida de tablero por material (clave = `part.stock`). */
  sheets?: Record<string, Sheet2D>;
  /** Medida de tablero para los materiales sin medida propia. */
  sheet?: Sheet2D;
  /** Permite girar 90° las piezas de madera alistonada (pino, haya), aunque se pierda el sentido de la veta. */
  rotateGrain?: boolean;
}

// ---------- resultado ----------

export interface BarCut {
  id: string;
  ref: string;
  name: string;
  /** Largo del corte, mm. */
  length: number;
}

export interface Bar {
  /** Nº de barra, desde 1. */
  index: number;
  /** Largo de la barra, mm. Si una pieza no cabe en la barra habitual, la barra mide lo que la pieza. */
  length: number;
  /** Cortes en el orden en que se sacan de la barra. */
  cuts: BarCut[];
  /** Suma de los cortes más la pérdida de los cortes intermedios, mm. */
  used: number;
  /** Lo que queda al final de la barra (incluye el último corte de disco), mm. */
  leftover: number;
  /** Pérdida total por disco en esta barra (un corte por pieza, salvo que la última llegue justo al final), mm. */
  kerfLoss: number;
  /** La barra es más larga que la habitual porque una pieza no cabía: hay que pedir largo especial. */
  special: boolean;
}

export interface LinearPlan {
  kind: 'lineal';
  stock: string;
  material: Part['material'];
  /** Largo de barra usado, mm. */
  barLength: number;
  /** Largo habitual de este material, mm. */
  defaultBarLength: number;
  /** Pérdida de disco por corte, mm. */
  kerf: number;
  bars: Bar[];
  pieces: number;
  /** Suma de los cortes, mm. */
  totalCut: number;
  /** Longitud total comprada, mm. */
  totalBought: number;
  /** 0..1 */
  utilisation: number;
  warnings: string[];
}

export interface Placed {
  id: string;
  ref: string;
  name: string;
  /** Esquina superior izquierda, mm. */
  x: number;
  y: number;
  /** Medidas tal y como quedan colocadas (w sobre el largo del tablero, h sobre el ancho). */
  w: number;
  h: number;
  /** Colocada girada 90° respecto a su veta. */
  rotated: boolean;
}

export interface SheetPlan {
  index: number;
  length: number;
  width: number;
  placed: Placed[];
  /** Área de piezas, mm². */
  usedArea: number;
  /** 0..1 */
  utilisation: number;
}

export interface BoardPlan {
  kind: 'tablero' | 'malla';
  stock: string;
  material: Part['material'];
  sheet: Sheet2D;
  defaultSheet: Sheet2D;
  kerf: number;
  /** El material tiene veta (alistonado) que se respeta. */
  grain: boolean;
  /** Se permite girar piezas. */
  canRotate: boolean;
  sheets: SheetPlan[];
  /** Piezas que no caben ni solas en un tablero de esta medida. */
  oversize: { id: string; ref: string; name: string; w: number; h: number }[];
  pieces: number;
  totalArea: number;
  boughtArea: number;
  utilisation: number;
  warnings: string[];
}

export interface CutPlan {
  linear: LinearPlan[];
  boards: BoardPlan[];
  warnings: string[];
  totals: {
    bars: number;
    sheets: number;
    /** Aprovechamiento global del material lineal (0..1), o null si no hay. */
    linearUtilisation: number | null;
    /** Aprovechamiento global de tableros y malla (0..1), o null si no hay. */
    boardUtilisation: number | null;
  };
}

// ---------- utilidades ----------

const EPS = 1e-6;
const r2 = (n: number) => Math.round(n * 100) / 100;
const isMetal = (m: Part['material']) => MATERIALS[m].kind !== 'madera';
const AXI = { x: 0, y: 1, z: 2 } as const;

export const defaultBarLength = (material: Part['material']): number => (isMetal(material) ? BAR_LENGTH.acero : BAR_LENGTH.madera);
export const kerfOf = (material: Part['material']): number => (isMetal(material) ? KERF.acero : KERF.madera);
/** Madera alistonada: tiene veta y por defecto no se gira. */
export const hasGrain = (material: Part['material']): boolean => material === 'pino' || material === 'haya';

/** Generador pseudoaleatorio reproducible (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- material lineal ----------

interface LinPiece { id: string; ref: string; name: string; length: number }

/**
 * Reparte `pieces` en barras de `bar` mm. Una pieza más larga que la barra va sola en una barra
 * del largo de la pieza (`special`). Devuelve las barras con las piezas en orden de corte.
 */
export function packLinear(pieces: LinPiece[], bar: number, kerf: number): { length: number; special: boolean; cuts: LinPiece[] }[] {
  const normal = pieces.filter((p) => p.length <= bar + EPS);
  const long = pieces.filter((p) => p.length > bar + EPS);
  const byLen = (a: LinPiece, b: LinPiece) => b.length - a.length || a.ref.localeCompare(b.ref, 'es', { numeric: true }) || a.id.localeCompare(b.id);
  const base = [...normal].sort(byLen);

  type B = { cur: number; cuts: LinPiece[] };
  const place = (order: LinPiece[], best: boolean): B[] => {
    const bars: B[] = [];
    for (const p of order) {
      let target: B | null = null;
      let slack = Infinity;
      for (const b of bars) {
        const need = b.cur + kerf + p.length;
        if (need <= bar + EPS) {
          const s = bar - need;
          if (!best) { target = b; break; }
          if (s < slack) { slack = s; target = b; }
        }
      }
      if (target) { target.cur += kerf + p.length; target.cuts.push(p); } else bars.push({ cur: p.length, cuts: [p] });
    }
    return bars;
  };
  // menos barras primero; a igualdad, sobrantes más concentrados (un retal grande sirve más que varios pequeños)
  const score = (bars: B[]) => bars.length * 1e12 - bars.reduce((a, b) => a + (bar - b.cur) ** 2, 0);

  let best = place(base, false);
  for (const cand of [place(base, true)]) if (score(cand) < score(best)) best = cand;
  if (base.length > 1 && base.length <= 160) {
    const rand = rng(1234567 + base.length * 31);
    const rounds = base.length <= 40 ? 400 : 120;
    for (let it = 0; it < rounds; it++) {
      const order = [...base];
      // sacudida suave: intercambia unas cuantas piezas cercanas
      const swaps = 1 + Math.floor(rand() * 4);
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(rand() * order.length);
        const j = Math.min(order.length - 1, Math.max(0, i + Math.floor((rand() - 0.5) * 8)));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const cand = place(order, rand() < 0.7);
      if (score(cand) < score(best)) best = cand;
    }
  }
  const out = best.map((b) => ({ length: bar, special: false, cuts: [...b.cuts].sort(byLen) }));
  for (const p of [...long].sort(byLen)) out.push({ length: p.length, special: true, cuts: [p] });
  return out;
}

function planLinear(stock: string, parts: Part[], opts: PlanOptions): LinearPlan {
  const material = parts[0].material;
  const kerf = kerfOf(material);
  const def = defaultBarLength(material);
  const asked = opts.barLengths?.[stock];
  const barLength = asked && Number.isFinite(asked) && asked > 0 ? asked : def;
  const pieces: LinPiece[] = parts.map((p) => ({ id: p.id, ref: p.ref, name: p.name, length: r2(p.cut[0]) }));
  const packed = packLinear(pieces, barLength, kerf);
  const bars: Bar[] = packed.map((b, i) => {
    const sum = b.cuts.reduce((a, c) => a + c.length, 0);
    const used = sum + kerf * (b.cuts.length - 1);
    const leftover = Math.max(0, b.length - used);
    return {
      index: i + 1, length: b.length, special: b.special,
      cuts: b.cuts.map((c) => ({ id: c.id, ref: c.ref, name: c.name, length: c.length })),
      used: r2(used), leftover: r2(leftover), kerfLoss: r2(kerf * (leftover >= kerf - EPS ? b.cuts.length : b.cuts.length - 1)),
    };
  });
  const totalCut = pieces.reduce((a, p) => a + p.length, 0);
  const totalBought = bars.reduce((a, b) => a + b.length, 0);
  const warnings: string[] = [];
  const specials = bars.filter((b) => b.special);
  if (specials.length) {
    warnings.push(`${specials.length === 1 ? 'Una pieza supera' : `${specials.length} piezas superan`} la barra de ${barLength} mm: ${specials.length === 1 ? 'pide' : 'pide'} largo especial o cambia el largo de barra.`);
  }
  return {
    kind: 'lineal', stock, material, barLength, defaultBarLength: def, kerf, bars, pieces: pieces.length,
    totalCut: r2(totalCut), totalBought: r2(totalBought), utilisation: totalBought ? totalCut / totalBought : 0, warnings,
  };
}

// ---------- tableros ----------

interface BoardPiece { id: string; ref: string; name: string; /** sobre la veta */ gl: number; /** a través de la veta */ ac: number }
interface Rect { x: number; y: number; w: number; h: number }

/** Medidas de una pieza de tablero: largo sobre la veta y ancho a través de ella. */
export function boardDims(p: Part): { gl: number; ac: number } {
  const thin = p.size.indexOf(Math.min(...p.size));
  const plane = [0, 1, 2].filter((k) => k !== thin);
  const ai = AXI[p.axis];
  if (ai !== thin && plane.includes(ai)) {
    const other = plane.find((k) => k !== ai)!;
    return { gl: r2(p.size[ai]), ac: r2(p.size[other]) };
  }
  const [a, b] = [p.size[plane[0]], p.size[plane[1]]];
  return { gl: r2(Math.max(a, b)), ac: r2(Math.min(a, b)) };
}

type SortKey = 'area' | 'long' | 'short' | 'perimetro';
type SplitRule = 'short' | 'long' | 'area';
type FitRule = 'bssf' | 'blsf' | 'baf';

interface SheetState { free: Rect[]; placed: Placed[]; used: number }

/** Guillotina: reparte `pieces` en tableros de L × W con disco `kerf`. Devuelve los tableros y lo que no cabe. */
export function packBoards(
  pieces: BoardPiece[], L: number, W: number, kerf: number, canRotate: boolean,
): { sheets: SheetState[]; oversize: BoardPiece[] } {
  const fits = (p: BoardPiece) => (p.gl <= L + EPS && p.ac <= W + EPS) || (canRotate && p.ac <= L + EPS && p.gl <= W + EPS);
  const ok = pieces.filter(fits);
  const oversize = pieces.filter((p) => !fits(p));

  const sorts: Record<SortKey, (p: BoardPiece) => number> = {
    area: (p) => p.gl * p.ac, long: (p) => Math.max(p.gl, p.ac), short: (p) => Math.min(p.gl, p.ac), perimetro: (p) => p.gl + p.ac,
  };

  const run = (sort: SortKey, split: SplitRule, fit: FitRule): SheetState[] => {
    const order = [...ok].sort((a, b) => sorts[sort](b) - sorts[sort](a) || b.gl * b.ac - a.gl * a.ac || a.id.localeCompare(b.id));
    const sheets: SheetState[] = [];
    const newSheet = (): SheetState => { const s = { free: [{ x: 0, y: 0, w: L, h: W }], placed: [], used: 0 }; sheets.push(s); return s; };
    for (const p of order) {
      const orients: { w: number; h: number; rotated: boolean }[] = [{ w: p.gl, h: p.ac, rotated: false }];
      if (canRotate && Math.abs(p.gl - p.ac) > EPS) orients.push({ w: p.ac, h: p.gl, rotated: true });
      let chosen: { s: SheetState; fi: number; o: (typeof orients)[number] } | null = null;
      for (const s of sheets) {
        let bestScore = Infinity;
        s.free.forEach((f, fi) => {
          for (const o of orients) {
            if (o.w > f.w + EPS || o.h > f.h + EPS) continue;
            const lw = f.w - o.w, lh = f.h - o.h;
            const sc = fit === 'bssf' ? Math.min(lw, lh) * 1e4 + Math.max(lw, lh) : fit === 'blsf' ? Math.max(lw, lh) * 1e4 + Math.min(lw, lh) : f.w * f.h - o.w * o.h;
            // a igualdad, mejor sin girar
            const sc2 = sc + (o.rotated ? 0.5 : 0);
            if (sc2 < bestScore) { bestScore = sc2; chosen = { s, fi, o }; }
          }
        });
        if (chosen) break;
      }
      if (!chosen) {
        const s = newSheet();
        const o = orients.find((q) => q.w <= L + EPS && q.h <= W + EPS)!;
        chosen = { s, fi: 0, o };
      }
      const { s, fi, o } = chosen as { s: SheetState; fi: number; o: (typeof orients)[number] };
      const f = s.free[fi];
      s.placed.push({ id: p.id, ref: p.ref, name: p.name, x: r2(f.x), y: r2(f.y), w: o.w, h: o.h, rotated: o.rotated });
      s.used += o.w * o.h;
      s.free.splice(fi, 1);
      // corte de guillotina: o bien el resto de la derecha ocupa todo el alto y el de abajo solo el ancho de la pieza, o al revés
      const rw = f.w - o.w - kerf, rh = f.h - o.h - kerf;
      const lw = f.w - o.w, lh = f.h - o.h;
      let horizontalFirst: boolean; // true: corte horizontal primero (el resto de abajo ocupa todo el ancho)
      if (split === 'short') horizontalFirst = lw < lh;
      else if (split === 'long') horizontalFirst = lw >= lh;
      else {
        // el reparto que deja el mayor rectángulo libre
        const a1 = Math.max(rw * o.h, f.w * rh), a2 = Math.max(rw * f.h, o.w * rh);
        horizontalFirst = a1 >= a2;
      }
      const add = (r: Rect) => { if (r.w > EPS && r.h > EPS) s.free.push(r); };
      if (horizontalFirst) {
        add({ x: f.x + o.w + kerf, y: f.y, w: rw, h: o.h });
        add({ x: f.x, y: f.y + o.h + kerf, w: f.w, h: rh });
      } else {
        add({ x: f.x + o.w + kerf, y: f.y, w: rw, h: f.h });
        add({ x: f.x, y: f.y + o.h + kerf, w: o.w, h: rh });
      }
    }
    return sheets;
  };

  const score = (ss: SheetState[]) => ss.length * 1e12 + (ss.length ? ss[ss.length - 1].used : 0);
  let best: SheetState[] | null = null;
  for (const sort of Object.keys(sorts) as SortKey[]) {
    for (const split of ['short', 'long', 'area'] as SplitRule[]) {
      for (const fit of ['bssf', 'blsf', 'baf'] as FitRule[]) {
        const cand = run(sort, split, fit);
        if (!best || score(cand) < score(best)) best = cand;
      }
    }
  }
  return { sheets: best ?? [], oversize };
}

function planBoard(stock: string, parts: Part[], opts: PlanOptions): BoardPlan {
  const material = parts[0].material;
  const kind = parts[0].stockKind === 'malla' ? 'malla' : 'tablero';
  const kerf = kerfOf(material);
  const def = opts.sheet && opts.sheet.length > 0 && opts.sheet.width > 0 ? opts.sheet : DEFAULT_SHEET;
  const asked = opts.sheets?.[stock];
  const sheet = asked && asked.length > 0 && asked.width > 0 ? asked : def;
  const grain = hasGrain(material);
  const canRotate = !grain || !!opts.rotateGrain;
  const pieces: BoardPiece[] = parts.map((p) => ({ id: p.id, ref: p.ref, name: p.name, ...boardDims(p) }));
  const { sheets, oversize } = packBoards(pieces, sheet.length, sheet.width, kerf, canRotate);
  const plans: SheetPlan[] = sheets.map((s, i) => ({
    index: i + 1, length: sheet.length, width: sheet.width, placed: s.placed, usedArea: s.used,
    utilisation: s.used / (sheet.length * sheet.width),
  }));
  const placedArea = plans.reduce((a, s) => a + s.usedArea, 0);
  const bought = plans.length * sheet.length * sheet.width;
  const warnings: string[] = [];
  if (oversize.length) {
    warnings.push(
      `${oversize.length === 1 ? 'Una pieza no cabe' : `${oversize.length} piezas no caben`} en un tablero de ${sheet.length} × ${sheet.width} mm` +
      `${grain && !canRotate ? ' sin girar' : ''}: ${[...new Set(oversize.map((o) => o.ref))].join(', ')}. Busca un tablero mayor o une dos trozos.`,
    );
  }
  return {
    kind, stock, material, sheet, defaultSheet: def, kerf, grain, canRotate, sheets: plans,
    oversize: oversize.map((o) => ({ id: o.id, ref: o.ref, name: o.name, w: o.gl, h: o.ac })),
    pieces: pieces.length, totalArea: pieces.reduce((a, p) => a + p.gl * p.ac, 0), boughtArea: bought,
    utilisation: bought ? placedArea / bought : 0, warnings,
  };
}

// ---------- plan completo ----------

export function cutPlan(project: Project, opts: PlanOptions = {}): CutPlan {
  const groups = new Map<string, Part[]>();
  for (const p of project.parts) {
    if (p.stockKind !== 'lineal' && p.stockKind !== 'tablero' && p.stockKind !== 'malla') continue;
    const k = `${p.stockKind === 'lineal' ? 'L' : p.stockKind === 'malla' ? 'M' : 'T'}|${p.stock}`;
    const g = groups.get(k) ?? [];
    g.push(p);
    groups.set(k, g);
  }
  const linear: LinearPlan[] = [];
  const boards: BoardPlan[] = [];
  for (const [k, parts] of groups) {
    const stock = k.slice(2);
    if (k[0] === 'L') linear.push(planLinear(stock, parts, opts));
    else boards.push(planBoard(stock, parts, opts));
  }
  linear.sort((a, b) => a.stock.localeCompare(b.stock, 'es'));
  boards.sort((a, b) => a.stock.localeCompare(b.stock, 'es'));
  const cut = linear.reduce((a, l) => a + l.totalCut, 0), bought = linear.reduce((a, l) => a + l.totalBought, 0);
  const area = boards.reduce((a, b) => a + b.utilisation * b.boughtArea, 0), bArea = boards.reduce((a, b) => a + b.boughtArea, 0);
  return {
    linear, boards,
    warnings: [...linear.flatMap((l) => l.warnings.map((w) => `${l.stock}: ${w}`)), ...boards.flatMap((b) => b.warnings.map((w) => `${b.stock}: ${w}`))],
    totals: {
      bars: linear.reduce((a, l) => a + l.bars.length, 0),
      sheets: boards.reduce((a, b) => a + b.sheets.length, 0),
      linearUtilisation: bought ? cut / bought : null,
      boardUtilisation: bArea ? area / bArea : null,
    },
  };
}

/** Texto de un porcentaje: «87 %». */
export const pct = (v: number): string => `${Math.round(v * 100)} %`;
