import type { Part, Project } from './types';
import { BAR_LENGTH, DENSITY, MATERIALS } from './materials';
import { hardwareList, stockList, toolList } from './derive';

/** Volumen de material de una pieza en mm³ (0 si no se puede estimar: herrajes, malla, adornos comprados). */
function volume(p: Part): number {
  if (p.material === 'malla' || p.material === 'herraje') return 0;
  const [x, y, z] = p.size;
  if (p.shape === 'box') {
    if (p.wall) {
      const [a, b] = [x, y, z].filter((_, i) => i !== ['x', 'y', 'z'].indexOf(p.axis));
      const len = p.size[['x', 'y', 'z'].indexOf(p.axis)];
      return (a * b - Math.max(0, a - 2 * p.wall) * Math.max(0, b - 2 * p.wall)) * len;
    }
    return x * y * z;
  }
  if (p.shape === 'cyl') return Math.PI * (p.cut[1] / 2) ** 2 * p.cut[0];
  if (p.shape === 'bola') return (4 / 3) * Math.PI * (x / 2) ** 3;
  if (p.shape === 'cone') return (p.cut[1] ** 2 * p.cut[0]) / 3;
  if (p.shape === 'retorcido') return x * y * z;
  // volutas, aros, arcos, rombos y corazones: barra de sección `bar` y largo desarrollado ≈ corte
  const bar = p.deco?.bar ?? Math.min(x, y, z);
  if (p.shape === 'arco') return p.cut[0] * p.cut[1] * p.cut[2];
  if (p.shape === 'prisma') return 0.6 * x * y * z;
  return Math.PI * (bar / 2) ** 2 * (p.shape === 'aro' ? Math.PI * (Math.max(x, y, z) - bar) : p.cut[0] * 1.6);
}

/** Peso estimado en kg. Orientativo: la densidad de la madera varía mucho con la especie y la humedad. */
export function weight(project: Project): number {
  let kg = 0;
  for (const p of project.parts) kg += (volume(p) / 1e9) * DENSITY[p.material];
  return kg;
}

export interface CostLine {
  key: string;
  label: string;
  /** Cantidad a comprar en la unidad de precio. */
  qty: number;
  /** Unidad a la que se refiere el precio: «barra de 2,4 m», «m²», «ud»… */
  unit: string;
  detail: string;
  kind: 'material' | 'fijacion';
}

/** Líneas de compra con la unidad en la que se pide el precio. */
export function costLines(project: Project): CostLine[] {
  const out: CostLine[] = [];
  for (const s of stockList(project)) {
    if (s.kind === 'lineal') {
      const n = Number(s.buy.split(' ')[0]);
      out.push({ key: s.stock, label: s.stock, qty: n, unit: s.buy.replace(/^\d+\s+barras?\s+/, 'barra '), detail: s.detail, kind: 'material' });
    } else if (s.kind === 'tablero' || s.kind === 'malla') {
      out.push({ key: s.stock, label: s.stock, qty: Number(s.buy.replace(' m²', '').replace(',', '.')), unit: 'm²', detail: s.detail, kind: 'material' });
    } else {
      out.push({ key: s.stock, label: s.stock, qty: Number(s.buy.split(' ')[0]), unit: 'ud', detail: s.detail, kind: 'material' });
    }
  }
  for (const h of hardwareList(project)) out.push({ key: h.item, label: h.item, qty: h.qty, unit: h.unit ?? 'ud', detail: '', kind: 'fijacion' });
  return out;
}

export interface CostSummary {
  total: number;
  /** Líneas con precio / líneas totales. */
  priced: number;
  lines: number;
}

export function cost(project: Project, prices: Record<string, number>): CostSummary {
  const lines = costLines(project);
  let total = 0, priced = 0;
  for (const l of lines) {
    const p = prices[l.key];
    if (typeof p === 'number' && p > 0) {
      total += p * l.qty;
      priced++;
    }
  }
  return { total, priced, lines: lines.length };
}

/** Avisos de diseño. Son reglas prácticas orientativas, no cálculos estructurales. */
export function warnings(project: Project): string[] {
  const out: string[] = [];
  const [w, h, d] = project.dims;
  if (project.craft === 'carpinteria' && h > 1000 && h / Math.min(w, d) > 3) out.push('Es alto y estrecho: fíjalo a la pared para que no pueda volcar.');
  // baldas largas: mayor tramo sin apoyo por debajo, medido sobre las piezas reales
  const shelves = project.parts.filter((p) => MATERIALS[p.material].kind === 'madera' && p.stockKind === 'tablero' && p.shape === 'box' && !p.rot && p.size[1] <= 18 && p.size[1] === Math.min(...p.size));
  for (const sh of shelves) {
    const li = sh.size[0] >= sh.size[2] ? 0 : 2, wi = li === 0 ? 2 : 0;
    const a0 = sh.pos[li] - sh.size[li] / 2, a1 = sh.pos[li] + sh.size[li] / 2;
    const bottom = sh.pos[1] - sh.size[1] / 2;
    const supports = project.parts
      .filter((q) => q !== sh && !q.rot && Math.abs(q.pos[1] + q.size[1] / 2 - bottom) < 1.5
        && Math.abs(q.pos[wi] - sh.pos[wi]) < (q.size[wi] + sh.size[wi]) / 2 && q.pos[li] + q.size[li] / 2 > a0 && q.pos[li] - q.size[li] / 2 < a1)
      .map((q) => [Math.max(a0, q.pos[li] - q.size[li] / 2), Math.min(a1, q.pos[li] + q.size[li] / 2)])
      .sort((x, y) => x[0] - y[0]);
    // una balda encajada entre costados apoya en sus dos extremos aunque nada quede debajo
    let cursor = a0, span = 0;
    for (const [s0, s1] of supports) {
      span = Math.max(span, s0 - cursor);
      cursor = Math.max(cursor, s1);
    }
    span = Math.max(span, a1 - cursor);
    if (span > 820) {
      out.push(`«${sh.name}» salva unos ${Math.round(span / 10)} cm sin apoyo con tablero de ${Math.round(sh.size[1])} mm: con peso puede combarse. Añade un apoyo intermedio, un canto de refuerzo o un tablero más grueso.`);
      break;
    }
  }
  const tooLong = project.parts.find((p) => p.stockKind === 'lineal' && p.cut[0] > (MATERIALS[p.material].kind === 'metal' ? BAR_LENGTH.acero : BAR_LENGTH.madera));
  if (tooLong) out.push(`«${tooLong.name}» mide ${Math.round(tooLong.cut[0])} mm, más que la barra habitual: pide un largo especial en tu almacén.`);
  if (Math.max(w, d) > 2000 || h > 2000) out.push('Supera los 2 m en alguna medida: comprueba que cabe por puertas, pasillos y escalera antes de montarlo.');
  return out;
}

/** Herramientas del proyecto que no están en la lista de las que ya tienes. */
export function missingTools(project: Project, owned: string[]): string[] {
  const have = new Set(owned);
  return toolList(project).filter((t) => !have.has(t));
}

/** Huella de la geometría: sirve para saber si dos opciones dibujan algo distinto. */
export function signature(project: Project): string {
  let a = 0;
  for (const p of project.parts) a += p.size[0] * 3 + p.size[1] * 5 + p.size[2] * 7 + p.pos[0] * 11 + p.pos[1] * 13 + p.pos[2] * 17 + p.shape.length;
  return `${project.parts.length}|${Math.round(a)}|${project.paint ?? ''}|${project.stain ?? ''}`;
}

export const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: n >= 100 ? 0 : 2 });
export const kilos = (n: number) => `${n >= 10 ? Math.round(n) : n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;
