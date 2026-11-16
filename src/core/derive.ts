import type { HardwareLine, Part, Project } from './types';
import { BAR_LENGTH, KERF, MATERIALS } from './materials';

export interface CutLine {
  ref: string;
  name: string;
  qty: number;
  stock: string;
  stockKind: Part['stockKind'];
  /** [largo, ancho, grueso] */
  cut: [number, number, number];
  round: boolean;
  material: Part['material'];
  note?: string;
  partIds: string[];
}

/** Lista de corte: una línea por referencia. */
export function cutList(p: Project): CutLine[] {
  const map = new Map<string, CutLine>();
  for (const part of p.parts) {
    const key = part.ref;
    const line = map.get(key);
    if (line) {
      line.qty++;
      line.partIds.push(part.id);
    } else {
      map.set(key, {
        ref: part.ref, name: part.name, qty: 1, stock: part.stock, stockKind: part.stockKind, cut: part.cut,
        round: part.shape === 'cyl', material: part.material, note: part.note, partIds: [part.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.ref.localeCompare(b.ref, 'es', { numeric: true }));
}

export interface StockLine {
  stock: string;
  kind: Part['stockKind'];
  /** Texto de cantidad a comprar: «3 barras de 2,4 m (6,84 m de corte)». */
  buy: string;
  detail: string;
}

/** Reparto de cortes en barras (first-fit decreciente) contando la pérdida del disco. */
export function packBars(lengths: number[], bar: number, kerf: number): number[][] {
  const bars: { left: number; cuts: number[] }[] = [];
  for (const len of [...lengths].sort((a, b) => b - a)) {
    const target = bars.find((b) => b.left >= len);
    if (target) {
      target.cuts.push(len);
      target.left -= len + kerf;
    } else {
      bars.push({ left: Math.max(bar, len) - len - kerf, cuts: [len] });
    }
  }
  return bars.map((b) => b.cuts);
}

const m = (mmv: number) => (mmv / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 });

/** Lista de la compra de material (barras, tableros, malla y herrajes visibles). */
export function stockList(p: Project): StockLine[] {
  const groups = new Map<string, Part[]>();
  for (const part of p.parts) {
    const g = groups.get(part.stock) ?? [];
    g.push(part);
    groups.set(part.stock, g);
  }
  const out: StockLine[] = [];
  for (const [stock, parts] of groups) {
    const kind = parts[0].stockKind;
    if (kind === 'lineal') {
      const metal = MATERIALS[parts[0].material].kind === 'metal';
      const bar = metal ? BAR_LENGTH.acero : BAR_LENGTH.madera;
      const kerf = metal ? KERF.acero : KERF.madera;
      const lengths = parts.map((q) => q.cut[0]);
      const total = lengths.reduce((a, b) => a + b, 0);
      const bars = packBars(lengths, bar, kerf);
      const long = lengths.some((l) => l > bar);
      out.push({
        stock, kind,
        buy: `${bars.length} ${bars.length === 1 ? 'barra' : 'barras'} de ${m(bar)} m`,
        detail: `${m(total)} m en ${lengths.length} ${lengths.length === 1 ? 'pieza' : 'piezas'}${long ? ' · alguna pieza supera la barra habitual: pide largo especial' : ''}`,
      });
    } else if (kind === 'tablero' || kind === 'malla') {
      const area = parts.reduce((a, q) => a + q.cut[0] * q.cut[1], 0) / 1e6;
      const maxL = Math.max(...parts.map((q) => q.cut[0]));
      const maxW = Math.max(...parts.map((q) => q.cut[1]));
      out.push({
        stock, kind,
        buy: `${area.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m²`,
        detail: `${parts.length} ${parts.length === 1 ? 'pieza' : 'piezas'} · la mayor mide ${Math.round(maxL)}×${Math.round(maxW)} mm`,
      });
    } else {
      out.push({ stock, kind, buy: `${parts.length} ud`, detail: parts[0].name });
    }
  }
  const order = { lineal: 0, tablero: 1, malla: 2, unidad: 3 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.stock.localeCompare(b.stock, 'es'));
}

/** Tornillería y consumibles sumados de todos los pasos. */
export function hardwareList(p: Project): HardwareLine[] {
  const map = new Map<string, HardwareLine>();
  for (const s of p.steps) {
    for (const h of s.hardware ?? []) {
      const cur = map.get(h.item);
      if (cur) cur.qty += h.qty;
      else map.set(h.item, { ...h });
    }
  }
  return [...map.values()];
}

export function toolList(p: Project): string[] {
  const set = new Set<string>();
  for (const s of p.steps) for (const t of s.tools ?? []) set.add(t);
  return [...set];
}

/** Piezas visibles al terminar el paso `i` (incluido). */
export function partsUpTo(p: Project, i: number): Set<string> {
  const ids = new Set<string>();
  for (let k = 0; k <= i && k < p.steps.length; k++) for (const id of p.steps[k].parts) ids.add(id);
  return ids;
}

export const fmtCut = (c: CutLine): string =>
  c.round ? `Ø${n(c.cut[1])} × ${n(c.cut[0])}` : `${n(c.cut[0])} × ${n(c.cut[1])} × ${n(c.cut[2])}`;
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
