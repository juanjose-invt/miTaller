import type { Generator, Mark, ParamDef, ParamValues, SourceRef, Step, Technique, Vec3 } from '../core/types';
import { Builder, alturaArco, cordon, cordonPerimetral, hw, mm, punto, radioArco, tornillos } from '../core/builder';
import { corazonPoints, hojaPolygon, polyLength, romboPoints, volutaPoints } from '../core/curves';
import {
  TEC_PUNTEO, cordonesTope, fuentesSoldaduraProyecto, infoProceso, pasoCordones, pasoCortar, pasoPreparar, pasoRepasar,
  pieza, puntosTope, seguridadSoldadura, type Proceso,
} from './taburete-acero';

/**
 * PUERTA DE VERJA (soldadura, cerrajería).
 * Hoja (o dos hojas) de cancela peatonal: marco de tubo cuadrado, travesaño intermedio y
 * barrotes. Del estilo liso al de forja: remate recto, en arco o con barrotes pasantes en
 * lanza; zócalo de chapa, friso de aros o volutas, volutas en C o en S entre barrotes,
 * puntas, bolas, pernios, cierre, batiente y postes con placa de anclaje.
 *
 * Este archivo exporta además las ayudas de forja decorativa que usan `valla` y `reja`:
 * reparto de barrotes, volutas ajustadas al hueco real, aros, puntas, bolas, textos y pasos.
 */

// =====================================================================================
// Ayudas de forja decorativa compartidas (puerta-verja, valla, reja)
// =====================================================================================

export type End = 'min' | 'max';
export type J = [string, End];
export type ModoForja = 'comprada' | 'curvada';
export type Remate = 'ninguno' | 'lanza' | 'pincho';
type Pt = [number, number];

/** Grueso de la barra de volutas y aros (mm): decisión de diseño. */
export const VB = 12;

/** Letras A…Z y después AA, AB… en orden de aparición; piezas idénticas comparten letra. */
export function letrasForja() {
  const m = new Map<string, { ref: string; name: string }>();
  const code = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  return (firma: string, name: string) => {
    if (!m.has(firma)) m.set(firma, { ref: code(m.size), name });
    return m.get(firma)!;
  };
}

export interface Forja {
  b: Builder;
  L: (firma: string, name: string) => { ref: string; name: string };
  modo: ModoForja;
}

export const r1 = (n: number) => Math.round(n * 10) / 10;
const fx = (n: number) => r1(n).toFixed(1);

// ---------- materiales ----------
export interface BarSpec { key: string; d: number; kind: 'cuad' | 'red' | 'tubo'; wall?: number; label: string }
export const BARROTES: Record<string, BarSpec> = {
  cuad12: { key: 'cuad12', d: 12, kind: 'cuad', label: 'Cuadradillo macizo 12 mm' },
  cuad16: { key: 'cuad16', d: 16, kind: 'cuad', label: 'Cuadradillo macizo 16 mm' },
  red16: { key: 'red16', d: 16, kind: 'red', label: 'Redondo macizo Ø16 mm' },
  tubo20: { key: 'tubo20', d: 20, kind: 'tubo', wall: 1.5, label: 'Tubo 20 × 20 × 1,5 mm' },
};
export const OPC_BARROTE = [
  { value: 'cuad12', label: 'Cuadradillo macizo 12 mm', hint: 'Fino y clásico de forja' },
  { value: 'cuad16', label: 'Cuadradillo macizo 16 mm', hint: 'Más presencia' },
  { value: 'red16', label: 'Redondo macizo Ø16 mm', hint: 'Aspecto suave' },
  { value: 'tubo20', label: 'Tubo 20 × 20 × 1,5 mm', hint: 'Ligero; pared fina, cuidado al soldar' },
];

export const TUBOS: Record<string, { s: number; wall: number; label: string }> = {
  '40': { s: 40, wall: 1.5, label: '40 × 40 × 1,5 mm' },
  '40g': { s: 40, wall: 2, label: '40 × 40 × 2 mm' },
  '50': { s: 50, wall: 2, label: '50 × 50 × 2 mm' },
  '60': { s: 60, wall: 2, label: '60 × 60 × 2 mm' },
  '80': { s: 80, wall: 2, label: '80 × 80 × 2 mm' },
};

export const ACABADOS: Record<string, { hex?: string; label: string }> = {
  negro: { hex: '#26282b', label: 'Negro forja' },
  antracita: { hex: '#4a4f55', label: 'Gris antracita' },
  verde: { hex: '#2f4a3a', label: 'Verde carruaje' },
  blanco: { hex: '#e9e6df', label: 'Blanco' },
  visto: { label: 'Acero visto (sin pintar)' },
};

export const paramAcabado = (def = 'negro'): ParamDef => ({
  key: 'acabado', label: 'Acabado', type: 'select', default: def, group: 'Material',
  options: [
    { value: 'negro', label: 'Negro forja', hint: 'El clásico de la forja' },
    { value: 'antracita', label: 'Gris antracita' },
    { value: 'verde', label: 'Verde carruaje' },
    { value: 'blanco', label: 'Blanco' },
    { value: 'visto', label: 'Acero visto', hint: 'Sin pintar: se oxida a la intemperie' },
  ],
});
export const PARAM_FORJA: ParamDef = {
  key: 'forja', label: 'Volutas, aros y arco', type: 'select', default: 'comprada', group: 'Uniones',
  help: 'Las volutas, aros y puntas se venden hechos como elementos de forja. Curvarlos tú es más barato y personal, pero mucho más laborioso. Las puntas y bolas se compran siempre.',
  options: [
    { value: 'comprada', label: 'Elementos comprados', hint: 'Lo realista para empezar' },
    { value: 'curvada', label: 'Curvados por ti', hint: 'En frío, con plantilla: avanzado' },
  ],
};
export const PARAM_PROCESO: ParamDef = {
  key: 'proceso', label: 'Proceso de soldadura', type: 'select', default: 'electrodo', group: 'Uniones',
  options: [
    { value: 'electrodo', label: 'Electrodo revestido E6013', hint: 'Inverter MMA' },
    { value: 'hilo', label: 'Hilo tubular sin gas', hint: 'Soldadora de hilo, sin botella; bueno en exterior' },
  ],
};
export const OPC_REMATE = [
  { value: 'ninguno', label: 'Sin puntas' },
  { value: 'lanza', label: 'Puntas de lanza', hint: 'Piramidales, de forja' },
  { value: 'pincho', label: 'Pinchos cónicos', hint: 'Más finos y agresivos' },
];

// ---------- piezas lineales ----------
/** Barrote o tramo de barrote vertical. `xMin` es su cara izquierda; queda centrado en `zc`. */
export function barrote(f: Forja, sp: BarSpec, name: string, len: number, xMin: number, yMin: number, zc: number, retorcido = false): string {
  const at: Vec3 = [xMin, yMin, zc - sp.d / 2];
  if (retorcido && sp.kind === 'cuad') {
    const rt = f.L(`ret|${sp.key}|${fx(len)}`, `${name} retorcido`);
    return f.b.retorcido({ ref: rt.ref, name: rt.name, side: sp.d, length: len, axis: 'y', at, stock: `Cuadradillo retorcido de forja ${sp.d} mm` });
  }
  const r = f.L(`bar|${sp.key}|${fx(len)}`, name);
  if (sp.kind === 'red') return f.b.redondo({ ref: r.ref, name: r.name, material: 'acero', diameter: sp.d, length: len, axis: 'y', at });
  if (sp.kind === 'tubo') return f.b.tubo({ ref: r.ref, name: r.name, section: [sp.d, sp.d], wall: sp.wall ?? 1.5, length: len, axis: 'y', at });
  const id = f.b.pletina({ ref: r.ref, name: r.name, section: [sp.d, sp.d], length: len, axis: 'y', at });
  pieza(f.b, id).stock = `Cuadradillo macizo de acero ${sp.d} mm`;
  return id;
}

/** Tubo cuadrado del marco o de los postes. */
export function tuboQ(f: Forja, s: number, wall: number, name: string, len: number, axis: 'x' | 'y' | 'z', at: Vec3): string {
  const r = f.L(`tubo|${s}|${wall}|${fx(len)}`, name);
  return f.b.tubo({ ref: r.ref, name: r.name, section: [s, s], wall, length: len, axis, at });
}

/**
 * Reparte barrotes de grueso `d` entre xa y xb con un hueco libre que no pase de `hmax`.
 * Devuelve la cara izquierda de cada barrote y el hueco real.
 */
export function reparto(xa: number, xb: number, d: number, hmax: number): { xs: number[]; g: number } {
  const S = xb - xa;
  const n = Math.max(0, Math.ceil((S - hmax) / (d + hmax)));
  const g = (S - n * d) / (n + 1);
  return { xs: Array.from({ length: n }, (_, i) => xa + g * (i + 1) + d * i), g };
}

// =====================================================================================
// Motor de decoración de forja: motivos, patrones repetibles y frisos
// =====================================================================================

/** Motivos que se pueden poner en un patrón. `vacio` deja el hueco libre para espaciar. */
export type Motivo = 'C' | 'S' | 'espiral' | 'aro' | 'rombo' | 'corazon' | 'hoja' | 'vacio';
/** Motivos de barra curvada que dibuja el visor con las curvas de `core/curves.ts`. */
type Curva = 'C' | 'S' | 'espiral' | 'rombo' | 'corazon';
type Lado = 'l' | 'r' | 't' | 'b';

export const OPC_MOTIVO: { value: Motivo; label: string; hint?: string }[] = [
  { value: 'C', label: 'Voluta en C', hint: 'La clásica: dos espirales hacia el mismo lado' },
  { value: 'S', label: 'Voluta en S', hint: 'Más movida; cabe en huecos bajos' },
  { value: 'espiral', label: 'Espiral', hint: 'Voluta simple enrollada' },
  { value: 'aro', label: 'Aro' },
  { value: 'rombo', label: 'Rombo' },
  { value: 'corazon', label: 'Corazón', hint: 'Dos volutas unidas en punta' },
  { value: 'hoja', label: 'Hojas', hint: 'Hojas de chapa soldadas al barrote' },
  { value: 'vacio', label: 'Hueco libre', hint: 'Sin adorno: sirve para espaciar los motivos' },
];
const VALIDOS = new Set<string>(OPC_MOTIVO.map((o) => o.value));
/** Motivos con mano: al reflejarlos cambian de sentido (se colocan con `mirror`). */
const CON_MANO = new Set<Motivo>(['C', 'S', 'espiral']);

const NOMBRE: Record<Motivo, [string, string, 'm' | 'f']> = {
  C: ['voluta en C', 'volutas en C', 'f'], S: ['voluta en S', 'volutas en S', 'f'], espiral: ['espiral', 'espirales', 'f'],
  aro: ['aro', 'aros', 'm'], rombo: ['rombo', 'rombos', 'm'], corazon: ['corazón', 'corazones', 'm'], hoja: ['hoja', 'hojas', 'f'],
  vacio: ['hueco libre', 'huecos libres', 'm'],
};
const unNombre = (m: Motivo) => `${NOMBRE[m][2] === 'f' ? 'una' : 'un'} ${NOMBRE[m][0]}`;

/** Lee el valor de un parámetro de patrón («C,aro,S») y descarta los códigos desconocidos. */
export function leerPatron(v: unknown): Motivo[] {
  if (typeof v !== 'string') return [];
  return v.split(',').map((c) => c.trim()).filter((c) => VALIDOS.has(c)) as Motivo[];
}
/** Un patrón decora algo si tiene al menos un motivo que no sea hueco libre. */
export const patronActivo = (p: Motivo[]) => p.some((m) => m !== 'vacio');

export function paramPatron(key: string, label: string, def: string, help: string, visible?: (v: ParamValues) => boolean): ParamDef {
  return { key, label, type: 'pattern', options: OPC_MOTIVO, max: 8, default: def, group: 'Decoración', help, visible };
}
export const paramSimetria = (visible?: (v: ParamValues) => boolean): ParamDef => ({
  key: 'simetria', label: 'Simetría', type: 'boolean', default: true, group: 'Decoración', visible,
  help: 'Refleja el patrón respecto al eje central: la mitad derecha es el espejo de la izquierda y las piezas con mano (volutas y espirales) se colocan dadas la vuelta.',
});
export const paramTipoBarrote = (visible?: (v: ParamValues) => boolean): ParamDef => ({
  key: 'tipoBarrote', label: 'Tipo de barrote', type: 'select', default: 'liso', group: 'Material',
  visible: (v) => (v.barrote === 'cuad12' || v.barrote === 'cuad16') && (visible ? visible(v) : true),
  help: 'El retorcido (entorchado) solo se hace en cuadradillo macizo y se compra ya retorcido, con los extremos rectos para soldarlo.',
  options: [
    { value: 'liso', label: 'Liso' },
    { value: 'retorcido', label: 'Retorcido', hint: 'Cuadradillo entorchado de forja' },
    { value: 'alterno', label: 'Alterno liso y retorcido' },
  ],
});

/** Qué barrotes de una fila van retorcidos (solo cuadradillo). Devuelve también si se ha podido. */
export function barrotesRetorcidos(sel: string, sp: BarSpec, n: number): { tw: boolean[]; aviso?: string } {
  if (sel !== 'retorcido' && sel !== 'alterno') return { tw: Array(n).fill(false) };
  if (sp.kind !== 'cuad') return { tw: Array(n).fill(false), aviso: 'Los barrotes retorcidos solo se hacen en cuadradillo macizo: con este barrote van lisos.' };
  return { tw: Array.from({ length: n }, (_, i) => sel === 'retorcido' || i % 2 === 1) };
}
/** Lo que sobresalen las aristas de un cuadradillo retorcido respecto a su cara (mm por lado). */
export const sobreRetorcido = (d: number) => d * (Math.SQRT2 - 1) / 2;
export const NOTA_MOTIVOS = 'Cada motivo se dimensiona con el hueco libre real: apoya en los dos barrotes (o barrote y montante) y en el travesaño, o en los dos travesaños del friso, para poder soldarlo. Si en un hueco no cabe, se cambia por otro que sí o se deja libre, y se avisa aquí.';
export const NOTA_HOJAS = 'Las hojas de forja se compran recortadas y repujadas en chapa; aquí se dibujan de 3 mm. Se sueldan solo por la base, con un punto por cada cara, sin calentar la hoja.';
export const NOTA_RETORCIDO = 'Los barrotes retorcidos se compran ya entorchados, con los extremos rectos para soldarlos a tope como los lisos. Al girar, sus aristas ocupan algo más que el cuadradillo: los motivos se han ajustado para apoyar en esas aristas.';

/** Resumen legible: «6 volutas en C, 1 aro y 4 rombos». */
export function resumenMotivos(cuenta: Partial<Record<Motivo, number>>): string {
  const partes = OPC_MOTIVO.map((o) => o.value).filter((m) => m !== 'vacio' && (cuenta[m] ?? 0) > 0)
    .map((m) => `${cuenta[m]} ${NOMBRE[m][cuenta[m] === 1 ? 0 : 1]}`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0] ?? '';
}
export const sumaCuenta = (...cs: Partial<Record<Motivo, number>>[]): Partial<Record<Motivo, number>> => {
  const out: Partial<Record<Motivo, number>> = {};
  for (const c of cs) for (const [k, n] of Object.entries(c) as [Motivo, number][]) out[k] = (out[k] ?? 0) + n;
  return out;
};
export const totalMotivos = (c: Partial<Record<Motivo, number>>) => Object.values(c).reduce((s, n) => s + (n ?? 0), 0);
export const multiplicaCuenta = (c: Partial<Record<Motivo, number>>, k: number) =>
  Object.fromEntries(Object.entries(c).map(([m, n]) => [m, (n ?? 0) * k])) as Partial<Record<Motivo, number>>;

// ---------- geometría: la misma curva que dibuja el visor ----------
function curvaPts(c: Curva, w: number, h: number, mirror: boolean): Pt[] {
  if (c === 'rombo') return romboPoints(w, h, VB);
  if (c === 'corazon') return corazonPoints(w, h, VB);
  const p = volutaPoints(w, h, c, VB);
  return mirror ? p.map(([u, v]): Pt => [w - u, v]) : p;
}

/**
 * Envolvente real del tubo de barra que dibuja el visor: cada tramo de la curva desplazado
 * medio grueso a cada lado según su normal (en los vértices del rombo el tubo no sobresale
 * medio grueso entero, y esto lo tiene en cuenta).
 */
interface Env { pts: Pt[]; off: Pt[]; u0: number; u1: number; v0: number; v1: number }
function envolvente(pts: Pt[]): Env {
  const r = VB / 2;
  const off: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (const q of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt]) off.push([q[0] + r * nx, q[1] + r * ny], [q[0] - r * nx, q[1] - r * ny]);
  }
  const us = off.map((q) => q[0]), vs = off.map((q) => q[1]);
  return { pts, off, u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) };
}

/**
 * Busca la caja (w × h) que hay que dar al visor para que la curva real mida tw × th.
 * Con `th` nulo la caja es cuadrada y solo se ajusta el ancho (espiral). `ok` = lo ha conseguido.
 */
const memoFit = new Map<string, { w: number; h: number; e: Env; ok: boolean }>();
function ajustar(c: Curva, tw: number, th: number | null, mirror: boolean) {
  const key = `${c}|${tw.toFixed(2)}|${th === null ? '-' : th.toFixed(2)}|${mirror}`;
  const hit = memoFit.get(key);
  if (hit) return hit;
  let w = tw, h = th ?? tw;
  let e = envolvente(curvaPts(c, w, h, mirror));
  let prev = Infinity;
  for (let k = 0; k < 150; k++) {
    const dw = tw - (e.u1 - e.u0), dh = th === null ? 0 : th - (e.v1 - e.v0);
    const err = Math.abs(dw) + Math.abs(dh);
    if (err < 0.04) break;
    if (k % 15 === 14) { if (err > prev * 0.9) break; prev = err; } // no converge: la curva no llega
    w = Math.min(tw * 3, Math.max(VB * 2 + 2, w + dw * 0.9));
    h = th === null ? w : Math.min(th * 3, Math.max(VB * 2 + 2, h + dh * 0.9));
    e = envolvente(curvaPts(c, w, h, mirror));
  }
  const out = { w, h, e, ok: Math.abs(e.u1 - e.u0 - tw) < 0.5 && (th === null || Math.abs(e.v1 - e.v0 - th) < 0.5) };
  if (memoFit.size > 6000) memoFit.clear();
  memoFit.set(key, out);
  return out;
}

/**
 * Alto mínimo para que una voluta en C llegue a tocar los dos lados de un hueco de ancho tw.
 * La curva es casi proporcional (solo el grueso de la barra no escala): se parte de la recta
 * ajustada a la curva real y se comprueba con el ajuste exacto, subiendo de 1 en 1 mm si hace falta.
 */
const memoAlto = new Map<string, number>();
export function altoMinC(tw: number): number {
  const key = tw.toFixed(1);
  const hit = memoAlto.get(key);
  if (hit) return hit;
  let h = Math.ceil(2.225 * tw - 14.5) - 2;
  while (h > tw && ajustar('C', tw, h, false).ok) h -= 1;
  while (!ajustar('C', tw, h, false).ok && h < tw * 4) h += 1;
  const r = h + 1;
  memoAlto.set(key, r);
  return r;
}
/** Alto de una espiral cuya curva mide tw de ancho. */
export const altoEspiral = (tw: number) => { const e = ajustar('espiral', tw, null, false).e; return e.v1 - e.v0; };

/** Puntos de la envolvente que tocan cada borde, agrupados (coordenadas de la caja). */
function bordes(e: Env): Record<Lado, Pt[]> {
  const tol = Math.max(0.8, 0.012 * Math.max(e.u1 - e.u0, e.v1 - e.v0));
  const out = { l: [], r: [], t: [], b: [] } as Record<Lado, Pt[]>;
  for (const lado of ['l', 'r', 't', 'b'] as Lado[]) {
    const sel = e.off.filter(([u, v]) => (lado === 'l' ? u - e.u0 : lado === 'r' ? e.u1 - u : lado === 'b' ? v - e.v0 : e.v1 - v) < tol);
    const key = (q: Pt) => (lado === 'l' || lado === 'r' ? q[1] : q[0]);
    sel.sort((a, c) => key(a) - key(c));
    const grupos: Pt[][] = [];
    for (const q of sel) {
      const g = grupos[grupos.length - 1];
      if (g && key(q) - key(g[g.length - 1]) < VB * 2) g.push(q);
      else grupos.push([q]);
    }
    for (const g of grupos) {
      const m = g.reduce((s, q) => s + key(q), 0) / g.length;
      out[lado].push(lado === 'l' ? [e.u0, m] : lado === 'r' ? [e.u1, m] : lado === 'b' ? [m, e.v0] : [m, e.v1]);
    }
  }
  return out;
}

export interface Pieza { id: string; contactos: Vec3[]; bordes: Record<Lado, Vec3[]> }

const NOMBRE_PIEZA: Record<Curva, string> = { C: 'Voluta en C', S: 'Voluta en S', espiral: 'Espiral', rombo: 'Rombo', corazon: 'Corazón' };

/**
 * Coloca un motivo de barra cuya curva real (no su caja) ocupa exactamente [x0,x1] × [y0,y1]:
 * así apoya justo en los barrotes o travesaños vecinos sin atravesarlos. Devuelve el id, los
 * puntos de contacto en los lados pedidos y todos los puntos de cada borde (para los frisos).
 * Devuelve null si la curva no se puede ajustar a esa caja (una C demasiado baja, p. ej.).
 */
export function curvaEn(
  f: Forja, o: { c: Curva; x0: number; x1: number; y0: number; y1: number; zc: number; mirror: boolean; lados: Lado[]; name?: string; libre?: boolean },
): Pieza | null {
  const tw = o.x1 - o.x0, th = o.y1 - o.y0;
  const fit = ajustar(o.c, tw, o.libre ? null : th, o.mirror);
  if (!fit.ok) return null;
  const { w, h, e } = fit;
  const at: Vec3 = [o.x0 - e.u0, o.y0 - e.v0, o.zc - VB / 2];
  const ew = e.u1 - e.u0, eh = e.v1 - e.v0;
  const dev = polyLength(e.pts);
  const curvada = f.modo === 'curvada';
  const base = NOMBRE_PIEZA[o.c];
  const r = f.L(`${o.c}|${fx(ew)}|${fx(eh)}|${f.modo}`, o.name ? `${base} ${o.name}` : base);
  const medida = `${Math.round(eh)} × ${Math.round(ew)} mm`;
  const stock = curvada ? 'Pletina de acero 12×6 mm' : `${base} de forja de ${medida}, barra de ${VB} mm`;
  const id = o.c === 'rombo'
    ? f.b.rombo({ ref: r.ref, name: r.name, face: [w, h], normal: 'z', bar: VB, at, stock })
    : o.c === 'corazon'
      ? f.b.corazon({ ref: r.ref, name: r.name, face: [w, h], normal: 'z', bar: VB, at, stock })
      : f.b.voluta({ ref: r.ref, name: r.name, face: [w, h], normal: 'z', bar: VB, curve: o.c, mirror: o.mirror, at, stock });
  const p = pieza(f.b, id);
  if (curvada) {
    p.stockKind = 'lineal';
    p.cut = [Math.round(dev + 20), 12, 6];
    p.note = `${base} curvado en frío sobre plantilla: ${medida} terminado (desarrollo unos ${Math.round(dev)} mm, más 20 mm para recortar${o.c === 'rombo' ? '; se dobla en cuatro esquinas y se cierra con un punto' : ''}).`;
  } else {
    p.stockKind = 'unidad';
    p.note = `Medida exterior terminada: ${Math.round(eh)} mm de alto × ${Math.round(ew)} mm de ancho.`;
  }
  const bs = bordes(e);
  const w3 = (q: Pt): Vec3 => [r1(at[0] + q[0]), r1(at[1] + q[1]), o.zc];
  const todos = { l: bs.l.map(w3), r: bs.r.map(w3), t: bs.t.map(w3), b: bs.b.map(w3) };
  return { id, contactos: o.lados.flatMap((l) => todos[l]), bordes: todos };
}

/** Aro de diámetro exterior `d` centrado en (cx, cy); contactos en los lados pedidos. */
export function aroEn(f: Forja, o: { cx: number; cy: number; d: number; zc: number; lados: Lado[]; name?: string }): Pieza {
  const curvada = f.modo === 'curvada';
  const r = f.L(`aro|${fx(o.d)}|${f.modo}`, o.name ? `Aro ${o.name}` : 'Aro');
  const id = f.b.aro({
    ref: r.ref, name: r.name, diameter: o.d, bar: VB, normal: 'z', at: [o.cx - o.d / 2, o.cy - o.d / 2, o.zc - VB / 2],
    stock: curvada ? 'Pletina de acero 12×6 mm' : `Aro de forja Ø${Math.round(o.d)} mm exterior, barra de ${VB} mm`,
  });
  const p = pieza(f.b, id);
  if (curvada) {
    const dev = Math.PI * (o.d - VB);
    p.stockKind = 'lineal';
    p.cut = [Math.round(dev + 15), 12, 6];
    p.note = `Aro de Ø${Math.round(o.d)} mm exterior curvado sobre un mandril y cerrado con un punto (desarrollo unos ${Math.round(dev)} mm).`;
  }
  const R = o.d / 2;
  const c: Record<Lado, Vec3> = {
    l: [r1(o.cx - R), r1(o.cy), o.zc], r: [r1(o.cx + R), r1(o.cy), o.zc], t: [r1(o.cx), r1(o.cy + R), o.zc], b: [r1(o.cx), r1(o.cy - R), o.zc],
  };
  return { id, contactos: o.lados.map((l) => c[l]), bordes: { l: [c.l], r: [c.r], t: [c.t], b: [c.b] } };
}

const HOJA_T = 3; // grueso de la chapa de las hojas (decisión de diseño)
/**
 * Hoja de chapa con la base en (xb, yb) y la punta hacia arriba, inclinada `ang` radianes hacia +x
 * (negativo: hacia −x). Su base se suelda al barrote (o al travesaño).
 */
export function hojaEn(f: Forja, o: { xb: number; yb: number; ang: number; L: number; zc: number }): { id: string; contacto: Vec3 } {
  const L = Math.round(o.L), Wh = Math.round(o.L * 0.42);
  const U = Math.max(...hojaPolygon(Wh, L).map((q) => q[0]));
  const a = -o.ang; // giro alrededor de Z (positivo: antihorario)
  const ox = Wh / 2 - U / 2, oy = -L / 2; // base respecto al centro de la caja
  const cx = o.xb - (ox * Math.cos(a) - oy * Math.sin(a)), cy = o.yb - (ox * Math.sin(a) + oy * Math.cos(a));
  const r = f.L(`hoja|${L}|${Wh}`, 'Hoja');
  const id = f.b.hoja({
    ref: r.ref, name: r.name, face: [Wh, L], normal: 'z', thickness: HOJA_T, at: [cx - U / 2, cy - L / 2, o.zc - HOJA_T / 2],
    stock: `Hoja de forja de chapa de ${HOJA_T} mm, ${L} × ${Wh} mm`,
  });
  pieza(f.b, id).note = 'Se compra recortada y repujada; se suelda por la base con un punto por cada cara.';
  if (Math.abs(o.ang) > 1e-6) f.b.rotate(id, [0, 0, a]);
  return { id, contacto: [r1(o.xb), r1(o.yb), o.zc] };
}

/** Huecos libres entre los obstáculos (caras de montante y barrotes; aristas si el barrote va retorcido). */
export function huecos(xa: number, xb: number, xs: number[], d: number, tw: boolean[] = []): [number, number][] {
  const k = sobreRetorcido(d);
  const edges = [xa, ...xs.flatMap((x, i) => (tw[i] ? [x - k, x + d + k] : [x, x + d])), xb];
  const out: [number, number][] = [];
  for (let i = 0; i < edges.length; i += 2) out.push([edges[i], edges[i + 1]]);
  return out;
}

export interface Deco { ids: string[]; contactos: Vec3[]; cuenta: Partial<Record<Motivo, number>>; avisos: string[]; alto: number }
const decoVacia = (): Deco => ({ ids: [], contactos: [], cuenta: {}, avisos: [], alto: 0 });
const anota = (d: Deco, m: Motivo) => { d.cuenta[m] = (d.cuenta[m] ?? 0) + 1; };

/** Índice del patrón y sentido de cada posición de una fila de n, con o sin simetría. */
function secuencia(patron: Motivo[], n: number, simetria: boolean, invertir = false) {
  const c = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => {
    const j = invertir ? n - 1 - i : i;
    let k = j, mirror = false;
    if (simetria && j > c) { k = n - 1 - j; mirror = true; }
    if (invertir) mirror = !mirror;
    return { m: patron[k % patron.length], mirror, centro: simetria && j === c };
  });
}

/** Alto que ocupa cada motivo en un hueco de ancho g con hv de alto libre (null: no cabe). */
function altoMotivo(m: Motivo, g: number, hv: number): number | null {
  const lim = (min: number, pref: number) => (hv < min ? null : Math.min(hv, pref));
  switch (m) {
    case 'C': { const need = altoMinC(g); return lim(need, need + 6); }
    case 'S': return lim(g * 0.8, g * 1.9);
    case 'espiral': { const h = altoEspiral(g); return lim(h, h); }
    case 'aro': return lim(g, g);
    case 'rombo': return lim(g * 1.15, g * 1.6);
    case 'corazon': return lim(g * 0.85, g * 1.05);
    case 'hoja': { const h = HOJA_L * Math.cos(HOJA_ANG) * g + g * 0.38; return lim(h, h); }
    default: return null;
  }
}
const HOJA_ANG = (32 * Math.PI) / 180; // inclinación de las hojas respecto a la vertical
const HOJA_L = 0.45 / Math.sin(HOJA_ANG); // largo de la hoja por mm de hueco: llega a 0,45 del hueco

/**
 * Decora los huecos entre barrotes de un paño: repite el patrón cíclicamente hueco a hueco.
 * Cada motivo se ajusta al hueco libre real y apoya en los dos barrotes y en el travesaño
 * (`anchor`: arriba, colgando del travesaño superior; abajo, sobre el inferior). Lo que no
 * cabe se sustituye (C → S) o se omite, y se avisa en `avisos`.
 * `hvAt` permite limitar la altura hueco a hueco (bajo un arco). `barY` es el tramo vertical de
 * los barrotes: los retorcidos tienen los extremos rectos (15 % del largo, como los dibuja el
 * visor) y un motivo que apoya solo ahí toca la cara del cuadradillo, no sus aristas giradas.
 */
export function filaMotivos(f: Forja, o: {
  xa: number; xb: number; xs: number[]; d: number; tw?: boolean[]; barY?: [number, number]; yRail: number; anchor: 'top' | 'bottom'; hv: number; zc: number;
  patron: Motivo[]; simetria: boolean; invertir?: boolean; zona: string; hvAt?: (g0: number, g1: number) => number;
}): Deco {
  const out = decoVacia();
  if (!patronActivo(o.patron)) return out;
  const gapsT = huecos(o.xa, o.xb, o.xs, o.d, o.tw);
  const gapsL = huecos(o.xa, o.xb, o.xs, o.d);
  const seq = secuencia(o.patron, gapsT.length, o.simetria, o.invertir);
  const rail: Lado = o.anchor === 'top' ? 't' : 'b';
  const omitidos = new Map<Motivo, number>();
  const rango = (h: number, dy = 0): [number, number] => (o.anchor === 'top' ? [o.yRail - h - dy, o.yRail - dy] : [o.yRail + dy, o.yRail + h + dy]);
  // barrotes retorcidos: tramo girado (el visor deja recto el 15 % de cada extremo) y lo que tarda la arista en salir
  const nb = o.xs.length, kT = sobreRetorcido(o.d);
  const tz = o.barY && o.tw?.some(Boolean) ? (() => {
    const [A, B] = o.barY!, L = B - A;
    const vueltas = Math.max(1, Math.round((L * 0.7) / (o.d * 9)));
    return { z0: A + 0.15 * L, z1: B - 0.15 * L, giro: (0.7 * L) / vueltas / 8 };
  })() : null;
  /** Envolvente real de un motivo de barra colocado en la caja dada (coordenadas del alzado). */
  const envMundo = (mm_: Motivo, g0: number, g1: number, y0: number, y1: number, mirror: boolean): Pt[] | null => {
    if (mm_ === 'aro') {
      const R = (g1 - g0) / 2, cx = (g0 + g1) / 2, cy = (y0 + y1) / 2;
      return Array.from({ length: 144 }, (_, k) => [cx + R * Math.cos((k * Math.PI) / 72), cy + R * Math.sin((k * Math.PI) / 72)] as Pt);
    }
    if (mm_ === 'hoja' || mm_ === 'vacio') return null;
    const fit = ajustar(mm_, g1 - g0, mm_ === 'espiral' ? null : y1 - y0, CON_MANO.has(mm_) && mirror);
    if (!fit.ok) return null;
    return fit.e.off.map(([u, v]): Pt => [g0 + u - fit.e.u0, y0 + v - fit.e.v0]);
  };
  /**
   * Comprueba un motivo junto a barrotes retorcidos. Con el hueco medido a las caras (`liso`), ninguna
   * parte que caiga en el tramo girado puede pisar las aristas; con el hueco medido a las aristas,
   * cada lado retorcido tiene que tocar dentro del tramo girado (si no, quedaría separado de la cara).
   */
  const apoyaBien = (i: number, pts: Pt[], g0: number, g1: number, liso: boolean): boolean => {
    if (!tz) return true;
    const lados: ['l' | 'r', boolean][] = [['l', i > 0 && !!o.tw?.[i - 1]], ['r', i < nb && !!o.tw?.[i]]];
    for (const [lado, torcido] of lados) {
      if (!torcido) continue;
      const borde = lado === 'l' ? g0 : g1, sg = lado === 'l' ? 1 : -1;
      if (liso) {
        if (pts.some(([x, y]) => y > tz.z0 - 1 && y < tz.z1 + 1 && sg * (x - borde) < kT - 0.3)) return false;
      } else if (!pts.some(([x, y]) => y > tz.z0 + tz.giro && y < tz.z1 - tz.giro && Math.abs(x - borde) < 1)) return false;
    }
    return true;
  };
  const add = (p: Pieza | null, m: Motivo, alto: number) => {
    if (!p) return false;
    out.ids.push(p.id); out.contactos.push(...p.contactos); anota(out, m); out.alto = Math.max(out.alto, alto);
    return true;
  };
  gapsT.forEach((gt, i) => {
    let { m } = seq[i];
    const { mirror, centro } = seq[i];
    if (m === 'vacio') return;
    if (centro && CON_MANO.has(m)) {
      out.avisos.push(`${o.zona}: el hueco central lleva un aro en lugar de ${unNombre(m)}, para que el dibujo quede simétrico.`);
      m = 'aro';
    }
    /**
     * Elige el hueco (caras o aristas del retorcido), el alto y, si hace falta, cuánto se separa
     * del travesaño para apoyar en las aristas del retorcido; null si no cabe.
     */
    const medir = (mm_: Motivo): { g0: number; g1: number; h: number; dy: number } | null => {
      const gl = gapsL[i];
      const torcido = gl[0] !== gt[0] || gl[1] !== gt[1];
      const prueba = ([g0, g1]: [number, number], liso: boolean, dy = 0) => {
        const hv = Math.min(o.hv, o.hvAt ? o.hvAt(g0, g1) : Infinity) - dy;
        const h = altoMotivo(mm_, g1 - g0, hv);
        if (h === null) return null;
        if (!torcido || mm_ === 'hoja') return { g0, g1, h, dy };
        const [y0, y1] = rango(h, dy);
        const pts = envMundo(mm_, g0, g1, y0, y1, mirror);
        return pts && apoyaBien(i, pts, g0, g1, liso) ? { g0, g1, h, dy } : null;
      };
      if (!torcido || mm_ === 'hoja') return prueba(gl, true);
      const r = prueba(gl, true) ?? prueba(gt, false);
      if (r || !tz) return r;
      // último recurso: se separa del travesaño hasta el tramo girado y apoya solo en las aristas
      const dy = o.anchor === 'top' ? o.yRail - (tz.z1 - tz.giro - 1) : tz.z0 + tz.giro + 1 - o.yRail;
      if (dy <= 0) return null;
      const q = prueba(gt, false, dy);
      if (q) out.avisos.push(`${o.zona}: algún motivo se separa un poco del travesaño para apoyar en las aristas del barrote retorcido (sus extremos son rectos y más estrechos).`);
      return q;
    };
    const poner = (mm_: Motivo): boolean => {
      const q = medir(mm_);
      if (!q) return false;
      const { g0, g1, h, dy } = q;
      const g = g1 - g0;
      const [y0, y1] = rango(h, dy);
      const lados: Lado[] = dy > 0 ? ['l', 'r'] : ['l', 'r', rail];
      switch (mm_) {
        case 'C': case 'S': case 'rombo': case 'corazon':
          return add(curvaEn(f, { c: mm_, x0: g0, x1: g1, y0, y1, zc: o.zc, mirror: CON_MANO.has(mm_) && mirror, lados }), mm_, h + dy);
        case 'espiral':
          return add(curvaEn(f, { c: 'espiral', x0: g0, x1: g1, y0, y1, zc: o.zc, mirror, lados, libre: true }), 'espiral', h + dy);
        case 'aro':
          return add(aroEn(f, { cx: (g0 + g1) / 2, cy: (y0 + y1) / 2, d: g, zc: o.zc, lados }), 'aro', g + dy);
        case 'hoja': {
          // pareja de hojas en V que nacen de los dos barrotes y se abren hacia el centro del hueco
          const yb = o.anchor === 'top' ? y0 + g * 0.12 : y0 + g * 0.22;
          for (const [xb, sg] of [[g0 - 1, 1], [g1 + 1, -1]] as const) {
            const hj = hojaEn(f, { xb, yb, ang: sg * HOJA_ANG, L: HOJA_L * g, zc: o.zc });
            out.ids.push(hj.id); out.contactos.push(hj.contacto); anota(out, 'hoja');
          }
          out.alto = Math.max(out.alto, h);
          return true;
        }
        default: return false;
      }
    };
    if (poner(m)) return;
    if ((m === 'C' || m === 'espiral') && !centro && poner('S')) {
      out.avisos.push(`${o.zona}: algún hueco es demasiado bajo para ${unNombre(m)}; se ha puesto una voluta en S, que cabe en menos altura.`);
      return;
    }
    omitidos.set(m, (omitidos.get(m) ?? 0) + 1);
  });
  for (const [m, n] of omitidos) {
    out.avisos.push(`${o.zona}: ${n === 1 ? `en un hueco no cabe ${unNombre(m)}` : `en ${n} huecos no cabe ${unNombre(m)}`} (falta alto libre junto al travesaño) y ${n === 1 ? 'se queda' : 'se quedan'} sin adorno.`);
  }
  out.avisos = [...new Set(out.avisos)];
  return out;
}

// ---------- frisos ----------
/** Ancho de cada motivo en un friso de alto h (toca los dos travesaños). */
const memoAnchoC = new Map<string, number>();
function anchoC(h: number): number {
  const key = h.toFixed(1);
  const hit = memoAnchoC.get(key);
  if (hit) return hit;
  let tw = Math.floor(((h - 4 + 14.5) / 2.225) * 2) / 2 + 1;
  while (tw > VB * 2 && altoMinC(tw) + 4 > h) tw -= 0.5;
  memoAnchoC.set(key, tw);
  return tw;
}
let ratioEspiral = 0;
function anchoFriso(m: Motivo, h: number): number {
  switch (m) {
    case 'aro': return h;
    case 'rombo': return h * 0.62;
    case 'corazon': return h * 0.95;
    case 'S': return h * 0.55;
    case 'C': return anchoC(h);
    case 'espiral': {
      if (!ratioEspiral) { const e = ajustar('espiral', 100, null, false).e; ratioEspiral = (e.u1 - e.u0) / (e.v1 - e.v0); }
      // la barra no escala: se corrige el ancho hasta que la espiral mida justo h de alto
      let tw = h * ratioEspiral;
      for (let k = 0; k < 3; k++) tw *= h / altoEspiral(tw);
      return tw;
    }
    case 'hoja': return h * 0.5;
    default: return h * 0.5; // hueco libre
  }
}

/** Nº de motivos de barra (los que se curvan); las hojas se compran siempre hechas. */
export const motivosBarra = (c: Partial<Record<Motivo, number>>) => totalMotivos(c) - (c.hoja ?? 0) - (c.vacio ?? 0);

/** Líneas del paso «Curva…» con lo que hay que fabricar de cada tipo. */
export function lineasCurvar(c: Partial<Record<Motivo, number>>): string[] {
  const vol = (c.C ?? 0) + (c.S ?? 0) + (c.espiral ?? 0) + (c.corazon ?? 0);
  const sinHojas = { ...c, hoja: 0, rombo: 0, aro: 0 };
  return [
    ...(vol ? [`${resumenMotivos(sinHojas).replace(/^./, (x) => x.toUpperCase())}: dibuja a tamaño real cada tipo con la medida exterior de la lista de piezas y fabrica su plantilla. Los corazones son dos volutas enfrentadas: curva primero los ojos y cierra la punta al final.`] : []),
    ...(c.rombo ? [`Rombos: ${c.rombo}. Marca las cuatro esquinas sobre la pletina repartiendo el desarrollo de la lista de piezas, dóblala en el tornillo de banco con la escuadra y cierra el rombo con un punto.`] : []),
    ...(c.aro ? [`Aros: ${c.aro}. Curva un muelle largo de pletina alrededor de un tubo que haga de mandril, corta los aros uno a uno y ciérralos con un punto.`] : []),
    ...(c.hoja ? [`Las ${c.hoja} hojas no se curvan: se compran recortadas y repujadas.`] : []),
  ];
}

/** Líneas del paso de montaje de la decoración. */
export function lineasMontaje(o: { g: number; simetria: boolean; panos: Partial<Record<Motivo, number>>; friso?: Partial<Record<Motivo, number>>; frisoH?: number }): string[] {
  const nP = totalMotivos(o.panos), nF = o.friso ? totalMotivos(o.friso) : 0;
  return [
    ...(nP ? [`Entre barrotes: ${resumenMotivos(o.panos)}. Cada pieza ocupa un hueco de unos ${mm(o.g)} y apoya en los dos barrotes y en el travesaño${o.panos.hoja ? '; las hojas se sueldan por la base, una a cada barrote, abiertas en V hacia el centro del hueco' : ''}.`] : []),
    ...(nP && o.simetria ? ['La mitad derecha es el reflejo de la izquierda: las volutas y espirales de ese lado se colocan dadas la vuelta. Presenta primero el hueco central y ve hacia los lados por parejas.'] : []),
    ...(nF ? [`Friso de ${mm(o.frisoH ?? 0)} de alto: ${resumenMotivos(o.friso!)}. Cada motivo toca los dos travesaños del friso; empieza por el centro y ve hacia los montantes.`] : []),
  ];
}

export interface PlanFriso { h: number; sep: number; items: { m: Motivo; w: number; mirror: boolean }[]; avisos: string[] }

/** Secuencia del friso: con simetría se refleja; las C o S seguidas se alternan (espalda con espalda). */
function secuenciaFriso(patron: Motivo[], n: number, simetria: boolean) {
  const seq = secuencia(patron, n, simetria).map((s) => ({ ...s, m: s.centro && CON_MANO.has(s.m) ? ('aro' as Motivo) : s.m }));
  const mitad = simetria ? Math.ceil(n / 2) : n;
  for (let i = 0; i < mitad; i++) {
    const prev = i > 0 ? seq[i - 1] : null;
    seq[i].mirror = CON_MANO.has(seq[i].m) && !!prev && prev.m === seq[i].m && !prev.mirror;
  }
  if (simetria) for (let i = mitad; i < n; i++) seq[i].mirror = !seq[n - 1 - i].mirror;
  return seq;
}

/**
 * Reparte el patrón a lo largo de un friso de luz `span`: cada motivo toca los dos travesaños y
 * a sus vecinos. Se elige el nº de motivos cuyo alto de friso queda más cerca de `objetivo`.
 */
export function planFriso(span: number, objetivo: number, patron: Motivo[], simetria: boolean): PlanFriso | null {
  if (!patronActivo(patron)) return null;
  const avisos: string[] = [];
  const ratios = new Map<Motivo, number>();
  const ratio = (m: Motivo) => { if (!ratios.has(m)) ratios.set(m, anchoFriso(m, objetivo) / objetivo); return ratios.get(m)!; };
  let best: { n: number; h: number } | null = null;
  for (let n = 2; n <= 60; n++) {
    const seq = secuenciaFriso(patron, n, simetria);
    if (!seq.some((s) => s.m !== 'vacio')) continue;
    const h = span / seq.reduce((s, it) => s + ratio(it.m), 0);
    if (h < 60) break;
    if (!best || Math.abs(h - objetivo) < Math.abs(best.h - objetivo)) best = { n, h };
  }
  if (!best) return null;
  const seq = secuenciaFriso(patron, best.n, simetria);
  const total = (h: number) => seq.reduce((s, it) => s + anchoFriso(it.m, h), 0);
  // el ancho de cada motivo es casi proporcional al alto: unas pocas correcciones bastan
  let hh = best.h;
  for (let k = 0; k < 4; k++) hh *= span / total(hh);
  while (total(hh) > span) hh -= 0.5;
  const h = Math.floor(hh * 10) / 10;
  const items = seq.map((s) => ({ m: s.m, w: anchoFriso(s.m, h), mirror: s.mirror }));
  const sep = Math.max(0, (span - items.reduce((s, it) => s + it.w, 0)) / (items.length + 1));
  if (simetria && best.n % 2 === 1 && CON_MANO.has(secuencia(patron, best.n, true)[(best.n - 1) / 2].m)) {
    avisos.push('Friso: el motivo central es un aro, para que el dibujo quede simétrico.');
  }
  return { h, sep, items, avisos };
}

/** Coloca los motivos de un friso ya planificado entre xa y el travesaño en y0. */
export function frisoMotivos(f: Forja, plan: PlanFriso, o: { xa: number; y0: number; zc: number; invertir?: boolean }): Deco {
  if (o.invertir) plan = { ...plan, items: [...plan.items].reverse().map((it) => ({ ...it, mirror: !it.mirror })) };
  const out = decoVacia();
  out.avisos = [...plan.avisos];
  out.alto = plan.h;
  const { h } = plan;
  const y0 = o.y0, y1 = o.y0 + h;
  const piezas: (Pieza | null)[] = [];
  let x = o.xa + plan.sep;
  for (const it of plan.items) {
    const x0 = x, x1 = x + it.w;
    x = x1 + plan.sep;
    let p: Pieza | null = null;
    if (it.m === 'aro') p = aroEn(f, { cx: (x0 + x1) / 2, cy: y0 + h / 2, d: h, zc: o.zc, lados: ['t', 'b'], name: 'del friso' });
    else if (it.m === 'hoja') {
      const hj = hojaEn(f, { xb: (x0 + x1) / 2, yb: y0 - 1, ang: 0, L: h + 2, zc: o.zc });
      out.ids.push(hj.id); out.contactos.push(hj.contacto, [hj.contacto[0], r1(y1), o.zc]); anota(out, 'hoja');
    } else if (it.m !== 'vacio') {
      p = curvaEn(f, { c: it.m, x0, x1, y0, y1, zc: o.zc, mirror: it.mirror, lados: ['t', 'b'], name: 'del friso', libre: it.m === 'espiral' });
      if (!p && it.m === 'C') p = curvaEn(f, { c: 'S', x0, x1, y0, y1, zc: o.zc, mirror: it.mirror, lados: ['t', 'b'], name: 'del friso' });
    }
    if (p) { out.ids.push(p.id); out.contactos.push(...p.contactos); anota(out, it.m); }
    else if (it.m !== 'vacio' && it.m !== 'hoja') out.avisos.push(`Friso: ${unNombre(it.m)} no se ha podido ajustar a la banda y ese hueco se queda libre.`);
    piezas.push(p);
  }
  // contactos laterales: con el montante en los extremos y entre vecinos que se tocan a la misma altura
  const near = (a: Vec3, b: Vec3) => Math.abs(a[0] - b[0]) < 1.5 && Math.abs(a[1] - b[1]) < VB;
  if (plan.sep < 1) {
    const [a, z] = [piezas[0], piezas[piezas.length - 1]];
    if (a) out.contactos.push(...a.bordes.l);
    if (z) out.contactos.push(...z.bordes.r);
  }
  for (let i = 1; i < piezas.length; i++) {
    const [a, b] = [piezas[i - 1], piezas[i]];
    if (!a || !b) continue;
    for (const p of a.bordes.r) {
      const q = b.bordes.l.find((c) => near(p, c));
      if (q) out.contactos.push([r1((p[0] + q[0]) / 2), r1((p[1] + q[1]) / 2), o.zc]);
    }
  }
  return out;
}

// ---------- remates ----------
/** Punta de lanza o pincho centrada sobre un barrote de grueso d cuya cara superior está en `ytop`. */
export function puntaSobre(f: Forja, tipo: Exclude<Remate, 'ninguno'>, d: number, xc: number, ytop: number, zc: number): string {
  const base = tipo === 'lanza' ? Math.max(24, d * 2) : d;
  const len = tipo === 'lanza' ? Math.round(base * 2.5) : Math.round(d * 5);
  const stock = tipo === 'lanza'
    ? `Punta de lanza de forja para barrote de ${d} mm (base ${base} mm, alto ${len} mm)`
    : `Pincho cónico de forja para barrote de ${d} mm (alto ${len} mm)`;
  const r = f.L(`punta|${tipo}|${d}`, tipo === 'lanza' ? 'Punta de lanza' : 'Pincho');
  return f.b.punta({ ref: r.ref, name: r.name, base, length: len, sides: tipo === 'lanza' ? 4 : 16, at: [xc - base / 2, ytop, zc - base / 2], stock });
}

/** Bola de forja asentada sobre una cara superior en `ytop` (hunde un poco para que asiente). */
export function bolaSobre(f: Forja, d: number, xc: number, ytop: number, zc: number, name: string, stock?: string): string {
  const r = f.L(`bola|${d}|${name}`, name);
  const yc = ytop + d / 2 - d * 0.12;
  return f.b.bola({ ref: r.ref, name: r.name, diameter: d, at: [xc - d / 2, yc - d / 2, zc - d / 2], stock });
}

// ---------- marcas ----------
export const puntos = (cs: Vec3[]): Mark[] => cs.map((c) => punto(c));
/** Cordón corto de lado a lado de la barra decorativa en cada contacto. */
export const cordonesDeco = (cs: Vec3[], t = VB): Mark[] => cs.map((c) => cordon([c[0], c[1], c[2] - t / 2], [c[0], c[1], c[2] + t / 2]));
/** Círculo de cordón alrededor de una base redonda (bola o pincho) sobre una cara horizontal. */
export function cordonAnillo(c: Vec3, d: number, n = 12): Mark[] {
  const pt = (a: number): Vec3 => [c[0] + (d / 2) * Math.cos(a), c[1], c[2] + (d / 2) * Math.sin(a)];
  return Array.from({ length: n }, (_, k) => cordon(pt((2 * Math.PI * k) / n), pt((2 * Math.PI * (k + 1)) / n)));
}
export const ptsJ = (b: Builder, js: J[], lado: 'x' | 'y' | 'z' = 'z'): Mark[] => js.flatMap(([id, e]) => puntosTope(b, id, e, lado));
export const cordJ = (b: Builder, js: J[]): Mark[] => js.flatMap(([id, e]) => cordonesTope(b, id, e));
export const ends = (ids: string[]): J[] => ids.flatMap((id) => [[id, 'min'], [id, 'max']] as J[]);
/** Cordones de cosido (tramos cortos) a lo largo de una línea, para chapas y pletinas largas. */
export function cosido(a: Vec3, b: Vec3, paso = 150, largo = 30): Mark[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.round(L / paso) + 1);
  const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const h = Math.min(0.5, largo / 2 / Math.max(L, 1));
  return Array.from({ length: n }, (_, i) => {
    const t = Math.min(1 - h, Math.max(h, i / (n - 1)));
    return cordon(at(t - h), at(t + h));
  });
}

// ---------- textos de forja ----------
export function tecDecoracion(modo: ModoForja): Technique {
  if (modo === 'comprada') {
    return {
      name: 'Elementos de forja comprados, presentados y soldados',
      why: 'Las volutas, aros y puntas se venden ya hechos como elementos de forja. Comprarlos te da piezas regulares e iguales entre sí sin fragua ni plantillas: solo tienes que elegir la medida que encaje en tu hueco y soldarlos. Es la forma realista de hacer tu primera verja decorada.',
      how: [
        'Compra por la medida exterior que da la lista de piezas: el ancho de cada voluta es el hueco libre real entre barrotes, para que apoye justa en los dos.',
        'Si alguna llega un poco más ancha, rebaja la punta del ojo con el disco de láminas; si llega estrecha, no la fuerces abriéndola: pide la medida siguiente.',
        'Presenta cada pieza en su hueco con una pinza de presión o un sargento pequeño y comprueba con la escuadra que queda vertical y a la altura de sus compañeras.',
        'Puntea cada contacto con un toque corto, apuntando el arco más al barrote o al tubo que a la voluta: la barra de forja es fina y se funde antes.',
        'Cuando estén todas punteadas y alineadas, suelda cada contacto con un cordón corto por delante y otro por detrás.',
      ],
    };
  }
  return {
    name: 'Volutas y aros curvados en frío sobre plantilla',
    why: 'Curvar tú las volutas sale más barato y te deja ajustar cada pieza al hueco exacto, pero es trabajo de paciencia: todas deben salir iguales. La clave es una plantilla (o una horquilla de curvar) que repita siempre la misma curva.',
    how: [
      'Dibuja cada voluta a tamaño real (1:1) sobre un tablero o una chapa con la medida exterior de la lista de piezas; mide su desarrollo con un cordel siguiendo el dibujo y corta la pletina algo más larga.',
      'Fabrica la plantilla: una espiral de pletina gruesa soldada sobre una chapa que se sujeta en el tornillo de banco, o usa una horquilla de curvar (dos tetones en una barra) para ir doblando poco a poco.',
      'Empieza siempre por el ojo: enrolla el extremo con unos alicates o golpeando sobre el borde del yunque, y después ve abrazando la plantilla con pasadas cortas.',
      'Compara cada pieza con el dibujo y corrige antes de seguir. Cuánto se puede cerrar la curva depende del material y del grueso: prueba primero en un recorte; si la barra se agrieta o se aplasta, abre la curva o usa una barra más fina.',
      'Los aros se curvan alrededor de un tubo o redondo que haga de mandril, se cortan a la medida y se cierran con un punto.',
      'Presenta, puntea y suelda igual que si fueran comprados: un punto en cada contacto y luego un cordón corto por cada cara.',
    ],
  };
}

export const herramientasDeco = (modo: ModoForja): string[] => (modo === 'comprada'
  ? ['Pinzas de presión (gripadoras)', 'Sargentos pequeños', 'Escuadra de acero', 'Disco de láminas']
  : ['Plantilla o horquilla de curvar sujeta en el tornillo de banco', 'Tornillo de banco robusto', 'Martillo de bola y alicates', 'Tablero o chapa con el dibujo 1:1', 'Cordel para medir el desarrollo', 'Pinzas de presión (gripadoras)', 'Escuadra de acero']);

export function seguridadForja(o: { puntas: boolean; escalable: boolean; puerta?: boolean; curvada: boolean; proceso: Proceso }): string[] {
  return [
    ...seguridadSoldadura(o.proceso, true),
    ...(o.puntas ? ['Las puntas de lanza y los pinchos pueden causar lesiones graves a quien trepe, resbale o caiga sobre ellos, y su uso en cerramientos puede estar regulado por la normativa municipal y de edificación. Consulta en tu ayuntamiento la normativa local antes de instalarlos.'] : []),
    ...(o.escalable ? ['Los travesaños, frisos, volutas y cualquier barra horizontal hacen de escalón: un niño puede trepar por ellos. Tenlo en cuenta si la verja da a una zona de juego, una piscina o un desnivel.'] : []),
    ...(o.puerta ? ['Una hoja de acero pesa mucho: muévela y cuélgala entre dos personas. Una puerta mal colgada puede caerse encima de alguien: si la hoja es grande o pesada, que un profesional dimensione los postes, su anclaje y los pernios.'] : []),
    ...(o.curvada ? ['Al curvar en frío la barra hace mucha fuerza y puede saltar de la plantilla: sujeta la plantilla firme en el tornillo de banco, trabaja con guantes y gafas y no pongas la cara en la dirección del tirón.'] : []),
  ];
}

export function pasoPintarForja(acabado: string): Step {
  const ac = ACABADOS[acabado] ?? ACABADOS.negro;
  const visto = !ac.hex;
  return {
    kind: 'acabar',
    title: visto ? 'Protege el acero visto' : `Imprima y pinta en ${ac.label.toLowerCase()}`,
    summary: visto
      ? 'Sin pintura el acero se oxida al aire: necesita al menos una protección transparente y revisiones frecuentes.'
      : 'Imprimación antioxidante y dos manos de esmalte para metal, entrando bien en volutas y rincones.',
    detail: [
      'Quita por completo la escoria y el polvo de amolar antes de pintar: TWI cita como motivo para retirar la escoria dejar una superficie limpia para la pintura.',
      'Desengrasa toda la pieza y deja que se seque. Cuélgala o apóyala sobre caballetes para llegar a todas las caras.',
      ...(visto
        ? [
            'Si quieres el aspecto del acero visto, protégelo con un barniz o una cera para metal siguiendo la ficha del fabricante.',
            'A la intemperie, el acero sin pintar acaba oxidándose aunque lleve barniz: revísalo a menudo. La opción duradera en exterior es imprimar y pintar.',
          ]
        : [
            'Aplica la imprimación antioxidante a brocha, insistiendo en los cordones, en los contactos de las volutas y en los rincones donde se queda el agua.',
            `Da dos manos de esmalte para metal apto para exterior en ${ac.label.toLowerCase()}, respetando los tiempos de secado y repintado de la ficha técnica del fabricante.`,
            'Las volutas y los aros tienen muchas caras escondidas: usa un pincel redondo fino y gira la pieza para llegar por detrás.',
          ]),
    ],
    parts: [],
    hardware: visto
      ? [hw('Barniz o cera de protección para metal', 1, 'bote')]
      : [hw('Imprimación antioxidante para metal', 1, 'bote'), hw(`Esmalte para metal apto para exterior, color ${ac.label.toLowerCase()}`, 1, 'bote')],
    tools: ['Brocha', 'Pincel redondo fino para volutas', 'Caballetes', 'Paños', 'Guantes de nitrilo', 'Mascarilla para vapores orgánicos si pintas a pistola'],
    tip: 'Empieza pintando las volutas y los rincones con el pincel fino y termina con la brocha en las caras planas: así no dejas goterones en las curvas.',
  };
}

export const NOTA_PUNTAS = 'Las puntas y las bolas se compran siempre hechas: forjarlas requiere fragua. Se sueldan centradas sobre el barrote con un cordón alrededor de la base.';

export function fuentesForja(proceso: Proceso): SourceRef[] {
  return fuentesSoldaduraProyecto(proceso);
}

// =====================================================================================
// Generador de la puerta de verja
// =====================================================================================

const HOLGURA = 50; // hueco bajo la hoja cuando va colgada (decisión de diseño)
const GAP_H = 20; // hueco entre poste y hoja en el lado de los pernios
const GAP_L = 15; // hueco del lado del cierre
const GAP_C = 10; // hueco entre las dos hojas
const ARC_A = 20; // cuadradillo del arco
const PLACA_T = 8; // grueso de la placa de anclaje
const PERNIO = { w: GAP_H, h: 100, t: 20 };

export const puertaVerja: Generator = {
  id: 'puerta-verja',
  title: 'Puerta de verja',
  craft: 'soldadura',
  difficulty: 2,
  description:
    'Cancela peatonal de una o dos hojas con marco de tubo y barrotes, desde la puerta lisa hasta la de forja con arco, volutas, aros, lanzas y bolas. Incluye pernios, cierre y postes con placa de anclaje.',
  params: [
    { key: 'ancho', label: 'Ancho de cada hoja', type: 'number', min: 700, max: 1200, step: 10, unit: 'mm', default: 1000, group: 'Medidas', help: 'Por fuera del marco de una hoja.' },
    { key: 'alto', label: 'Alto de la hoja', type: 'number', min: 1000, max: 2200, step: 10, unit: 'mm', default: 1200, group: 'Medidas', help: 'Hasta lo más alto del marco (la clave del arco si la hay), sin contar puntas ni bolas.' },
    { key: 'hueco', label: 'Hueco máximo entre barrotes', type: 'number', min: 80, max: 160, step: 5, unit: 'mm', default: 110, group: 'Medidas', help: 'Hueco libre entre barrotes. Se recalcula el nº de barrotes para no pasar de él. Si va a haber niños pequeños cerca, un hueco estrecho evita que metan la cabeza; consulta la normativa de tu municipio.' },
    {
      key: 'forma', label: 'Remate superior', type: 'select', default: 'recto', group: 'Forma',
      options: [
        { value: 'recto', label: 'Recto', hint: 'Travesaño superior horizontal' },
        { value: 'arco', label: 'En arco', hint: 'Arco curvado sobre el marco; los barrotes suben hasta él' },
        { value: 'lanza', label: 'Barrotes en lanza', hint: 'Los barrotes sobrepasan el marco' },
      ],
    },
    { key: 'flecha', label: 'Flecha del arco', type: 'number', min: 80, max: 400, step: 10, unit: 'mm', default: 220, group: 'Forma', help: 'Cuánto sube el arco en el centro.', visible: (v) => v.forma === 'arco' },
    { key: 'sobresale', label: 'Altura de las lanzas', type: 'number', min: 80, max: 250, step: 10, unit: 'mm', default: 140, group: 'Forma', help: 'Cuánto sobresale cada barrote por encima del marco o del arco.', visible: (v) => v.forma === 'lanza' || (v.forma === 'arco' && v.remate !== 'ninguno') },
    {
      key: 'hojas', label: 'Nº de hojas', type: 'select', default: '1', group: 'Forma',
      options: [
        { value: '1', label: 'Una hoja', hint: 'Puerta peatonal' },
        { value: '2', label: 'Dos hojas', hint: 'Cancela doble, simétrica' },
      ],
    },
    { key: 'travesano', label: 'Altura del travesaño intermedio', type: 'number', min: 250, max: 900, step: 10, unit: 'mm', default: 420, group: 'Forma', help: 'Desde abajo de la hoja hasta su cara inferior. Se ajusta solo si no cabe.' },
    { key: 'zocalo', label: 'Zócalo de chapa', type: 'boolean', default: false, group: 'Forma', help: 'Chapa lisa entre el travesaño inferior y el intermedio en lugar de barrotes.' },
    { key: 'remate', label: 'Puntas', type: 'select', default: 'ninguno', group: 'Detalles', options: OPC_REMATE, help: 'Centradas sobre cada barrote.' },
    { key: 'bolas', label: 'Bolas en los montantes', type: 'boolean', default: false, group: 'Detalles' },
    {
      key: 'cierre', label: 'Cierre', type: 'select', default: 'pasador', group: 'Detalles',
      options: [
        { value: 'ninguno', label: 'Sin cierre' },
        { value: 'pasador', label: 'Pasador de soldar' },
        { value: 'cerradura', label: 'Cerradura de caja para soldar' },
      ],
    },
    { key: 'batiente', label: 'Pletina batiente', type: 'boolean', default: true, group: 'Detalles', help: 'Hace de tope al cerrar y tapa la rendija del lado del cierre.' },
    { key: 'postes', label: 'Postes para colgarla', type: 'boolean', default: true, group: 'Detalles', help: 'Sin postes, la hoja se cuelga de pilares o postes que ya tengas.' },
    {
      key: 'anclaje', label: 'Fijación de los postes', type: 'select', default: 'placa', group: 'Detalles', visible: (v) => v.postes === true,
      options: [
        { value: 'placa', label: 'Placa de anclaje atornillada', hint: 'Sobre solera o muro de hormigón' },
        { value: 'empotrar', label: 'Poste para empotrar', hint: 'En un dado de hormigón' },
      ],
    },
    {
      key: 'remPoste', label: 'Remate de los postes', type: 'select', default: 'tapa', group: 'Detalles', visible: (v) => v.postes === true,
      options: [
        { value: 'tapa', label: 'Tapa de pletina soldada' },
        { value: 'bola', label: 'Bola de forja' },
      ],
    },
    {
      key: 'marco', label: 'Tubo del marco', type: 'select', default: '40', group: 'Material',
      options: [
        { value: '40', label: '40 × 40 × 1,5 mm', hint: 'Hojas pequeñas' },
        { value: '40g', label: '40 × 40 × 2 mm', hint: 'Más robusto' },
        { value: '50', label: '50 × 50 × 2 mm', hint: 'Hojas grandes' },
      ],
    },
    { key: 'barrote', label: 'Barrotes', type: 'select', default: 'cuad12', group: 'Material', options: OPC_BARROTE },
    paramTipoBarrote(),
    {
      key: 'poste', label: 'Tubo de los postes', type: 'select', default: '60', group: 'Material', visible: (v) => v.postes === true,
      options: [
        { value: '60', label: '60 × 60 × 2 mm' },
        { value: '80', label: '80 × 80 × 2 mm', hint: 'Para hojas grandes o pesadas' },
      ],
    },
    paramPatron('patSup', 'Paño superior', '', 'Motivos entre barrotes, colgados del travesaño superior. Se repiten en orden hueco a hueco.'),
    paramPatron('patInf', 'Paño inferior', '', 'Motivos entre los barrotes de abajo, sobre el travesaño inferior (con zócalo, en la parte baja del paño de arriba).'),
    paramPatron('patFriso', 'Friso', '', 'Banda de motivos sobre el travesaño intermedio, cerrada por otro travesaño. Vacío: sin friso.'),
    paramSimetria(),
    paramAcabado('negro'),
    PARAM_FORJA,
    PARAM_PROCESO,
  ],
  dragAxes: { x: 'ancho', y: 'alto' },
  presets: [
    {
      id: 'lisa', name: 'Cancela lisa', blurb: 'Una hoja de 90 × 120 cm, barrotes rectos y zócalo de chapa. Sin adornos: aprende a escuadrar y colgar.',
      values: { ancho: 900, alto: 1200, hueco: 110, forma: 'recto', hojas: '1', travesano: 400, zocalo: true, remate: 'ninguno', patSup: '', patInf: '', patFriso: '', simetria: true, bolas: false, cierre: 'pasador', batiente: true, postes: true, anclaje: 'placa', remPoste: 'tapa', marco: '40', barrote: 'cuad12', poste: '60', acabado: 'antracita', forja: 'comprada', proceso: 'electrodo' },
    },
    {
      id: 'lanzas', name: 'Puerta de lanzas', blurb: '100 × 150 cm con barrotes pasantes rematados en lanza, friso de aros y bolas en los montantes.',
      values: { ancho: 1000, alto: 1500, hueco: 110, forma: 'lanza', sobresale: 150, hojas: '1', travesano: 380, zocalo: false, remate: 'lanza', patSup: '', patInf: '', patFriso: 'aro', simetria: true, bolas: true, cierre: 'pasador', batiente: true, postes: true, anclaje: 'placa', remPoste: 'bola', marco: '40g', barrote: 'cuad16', poste: '60', acabado: 'verde', forja: 'comprada', proceso: 'electrodo' },
    },
    {
      id: 'forja', name: 'Puerta de forja con volutas', blurb: 'En arco, con lanzas sobre el arco, volutas en C arriba y abajo, friso de volutas y bolas: la más ornamentada.',
      values: { ancho: 1000, alto: 1900, hueco: 105, forma: 'arco', flecha: 260, sobresale: 130, hojas: '1', travesano: 520, zocalo: false, remate: 'lanza', patSup: 'C', patInf: 'C', patFriso: 'C', simetria: true, bolas: true, cierre: 'cerradura', batiente: true, postes: true, anclaje: 'placa', remPoste: 'bola', marco: '40g', barrote: 'cuad12', poste: '80', acabado: 'negro', forja: 'comprada', proceso: 'electrodo' },
    },
    {
      id: 'corazones', name: 'Puerta de corazones y rombos', blurb: 'Barrotes alternos lisos y retorcidos, corazones bajo el travesaño, friso de rombos y aros, hojas abajo y pinchos.',
      values: { ancho: 1000, alto: 1600, hueco: 110, forma: 'recto', hojas: '1', travesano: 450, zocalo: false, remate: 'pincho', patSup: 'corazon,vacio', patInf: 'hoja', patFriso: 'rombo,aro', simetria: true, bolas: true, cierre: 'pasador', batiente: true, postes: true, anclaje: 'placa', remPoste: 'bola', marco: '40g', barrote: 'cuad12', tipoBarrote: 'alterno', poste: '60', acabado: 'negro', forja: 'comprada', proceso: 'electrodo' },
    },
  ],
  build: buildPuerta,
};

interface Hoja {
  montantes: string[]; travesanos: string[]; chapa: string[]; barras: string[]; deco: string[]; arco: string[]; bajoArco: string[];
  remates: string[]; bolas: string[];
  jMarco: J[]; jBarras: J[]; jBajoArco: J[]; jRemate: J[];
  pChapa: Mark[]; cChapa: Mark[]; decoC: Vec3[]; arcoC: Vec3[]; puntasC: Mark[]; bolaC: Mark[];
  nBar: number; g: number; nRet: number; nPuntas: number;
  cuenta: Partial<Record<Motivo, number>>; cuentaFriso: Partial<Record<Motivo, number>>; avisos: string[];
  hingeLeft: boolean;
  hingeX: number; closeX: number; // cara exterior del montante de bisagras / de cierre
  stileTop: number; cierreStile: [number, number]; // [x mín, x máx] del montante de cierre
  ym: number; yTB: number; rise: number; friso: boolean;
}

function buildPuerta(v: ParamValues) {
  const W = Number(v.ancho), H = Number(v.alto), hmax = Number(v.hueco);
  const forma = String(v.forma) as 'recto' | 'arco' | 'lanza';
  const dos = v.hojas === '2';
  const zocalo = v.zocalo === true;
  const remate = String(v.remate) as Remate;
  const patSup = leerPatron(v.patSup), patInf = leerPatron(v.patInf), patFriso = leerPatron(v.patFriso);
  const simetria = v.simetria !== false;
  const bolas = v.bolas === true;
  const cierre = String(v.cierre);
  const batiente = v.batiente === true;
  const postes = v.postes === true;
  const placa = v.anclaje !== 'empotrar';
  const bolaPoste = v.remPoste === 'bola';
  const fr = TUBOS[String(v.marco)] ?? TUBOS['40'];
  const s = fr.s, wall = fr.wall;
  const sp = BARROTES[String(v.barrote)] ?? BARROTES.cuad12;
  const d = sp.d;
  const pt = TUBOS[String(v.poste)] ?? TUBOS['60'];
  const P = pt.s;
  const acabado = String(v.acabado);
  const modo: ModoForja = v.forja === 'curvada' ? 'curvada' : 'comprada';
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);
  const Lsob = Number(v.sobresale);

  const b = new Builder();
  const f: Forja = { b, L: letrasForja(), modo };
  const y0 = postes ? HOLGURA : 0;
  const zc = s / 2;
  const span = W - 2 * s;

  // --- alzado común a las hojas ---
  const rise = forma === 'arco' ? Math.max(60, Math.min(Number(v.flecha), 0.45 * span, 0.3 * H)) : 0;
  const yRailTop = forma === 'arco' ? y0 + H - rise - ARC_A : y0 + H; // cara superior del travesaño superior
  const yTB = yRailTop - s; // cara inferior del travesaño superior
  const stileTop = forma === 'arco' ? yRailTop + Math.max(ARC_A + 30, Math.round(rise * 0.5)) : y0 + H;
  let plan = planFriso(span, Math.max(90, Math.min(150, hmax * 1.05)), patFriso, simetria);
  let hbF = plan ? plan.h : 0;
  const upperMin = 180;
  const ymMin = y0 + s + 150;
  let ymMax = yTB - upperMin - (hbF ? hbF + s : 0) - s;
  let notaFriso = '';
  if (plan && ymMax < ymMin) {
    notaFriso = 'Con esta altura no cabe el friso: se ha quitado. Sube el alto de la hoja o baja la flecha del arco para recuperarlo.';
    plan = null; hbF = 0; ymMax = yTB - upperMin - s;
  } else if (patronActivo(patFriso) && !plan) {
    notaFriso = 'El patrón del friso no deja sitio a ningún motivo con este ancho: se ha quitado el friso.';
  }
  const ym = Math.max(ymMin, Math.min(y0 + Number(v.travesano), ymMax)); // cara inferior del travesaño intermedio
  const friso = plan !== null;
  const yF = ym + s; // arranque del friso
  const upperBot = friso ? yF + hbF + s : ym + s;
  const lowerH = ym - (y0 + s), upperH = yTB - upperBot;
  const decoArriba = patronActivo(patSup);
  const decoAbajo = patronActivo(patInf);

  const hojas: Hoja[] = [];
  const mkHoja = (xL: number, hingeLeft: boolean): Hoja => {
    const xa = xL + s, xb = xL + W - s;
    const h: Hoja = {
      montantes: [], travesanos: [], chapa: [], barras: [], deco: [], arco: [], bajoArco: [], remates: [], bolas: [],
      jMarco: [], jBarras: [], jBajoArco: [], jRemate: [], pChapa: [], cChapa: [], decoC: [], arcoC: [], puntasC: [], bolaC: [],
      nBar: 0, g: 0, nRet: 0, nPuntas: 0, cuenta: {}, cuentaFriso: {}, avisos: [], hingeLeft,
      hingeX: hingeLeft ? xL : xL + W, closeX: hingeLeft ? xL + W : xL, stileTop,
      cierreStile: hingeLeft ? [xL + W - s, xL + W] : [xL, xL + s], ym, yTB, rise, friso,
    };
    // marco
    h.montantes.push(tuboQ(f, s, wall, 'Montante', stileTop - y0, 'y', [xL, y0, 0]), tuboQ(f, s, wall, 'Montante', stileTop - y0, 'y', [xL + W - s, y0, 0]));
    const rail = (y: number) => {
      const id = tuboQ(f, s, wall, 'Travesaño', span, 'x', [xa, y, 0]);
      h.travesanos.push(id);
      h.jMarco.push([id, 'min'], [id, 'max']);
      return id;
    };
    rail(y0); rail(ym); if (friso) rail(yF + hbF); rail(yTB);
    // barrotes
    const { xs, g } = reparto(xa, xb, d, hmax);
    h.nBar = xs.length; h.g = g;
    const ret = barrotesRetorcidos(String(v.tipoBarrote), sp, xs.length);
    if (ret.aviso) h.avisos.push(ret.aviso);
    const tw = ret.tw;
    const regiones: [number, number][] = [[upperBot, yTB]];
    if (!zocalo) regiones.unshift([y0 + s, ym]);
    for (const [ya, yb] of regiones) {
      xs.forEach((x, i) => {
        const id = barrote(f, sp, ya < ym ? 'Barrote inferior' : 'Barrote', yb - ya, x, ya, zc, tw[i]);
        h.barras.push(id); h.jBarras.push([id, 'min'], [id, 'max']);
        if (tw[i]) h.nRet++;
      });
    }
    if (zocalo) {
      const r = f.L(`chapa|${fx(span)}|${fx(lowerH)}`, 'Chapa del zócalo');
      const id = b.pletina({ ref: r.ref, name: r.name, section: [lowerH, 2], length: span, axis: 'x', at: [xa, y0 + s, zc - 1] });
      const p = pieza(b, id);
      p.stock = 'Chapa de acero lisa de 2 mm'; p.stockKind = 'tablero';
      h.chapa.push(id);
      const zf = zc - 1;
      h.pChapa.push(punto([xa + 15, y0 + s, zf]), punto([xb - 15, y0 + s, zf]), punto([xa + 15, ym, zf]), punto([xb - 15, ym, zf]), punto([xa, (y0 + s + ym) / 2, zf]), punto([xb, (y0 + s + ym) / 2, zf]));
      h.cChapa.push(...cosido([xa, y0 + s, zf], [xb, y0 + s, zf]), ...cosido([xa, ym, zf], [xb, ym, zf]), ...cosido([xa, y0 + s, zf], [xa, ym, zf]), ...cosido([xb, y0 + s, zf], [xb, ym, zf]));
    }
    // motivos entre barrotes (la segunda hoja es el reflejo de la primera)
    const filas: { yRail: number; anchor: 'top' | 'bottom'; regionH: number; dosFilas: boolean; patron: Motivo[]; zona: string; barY: [number, number] }[] = [];
    if (decoArriba) filas.push({ yRail: yTB, anchor: 'top', regionH: upperH, dosFilas: decoAbajo && zocalo, patron: patSup, zona: 'Paño superior', barY: [upperBot, yTB] });
    if (decoAbajo) filas.push(zocalo
      ? { yRail: upperBot, anchor: 'bottom', regionH: upperH, dosFilas: decoArriba, patron: patInf, zona: 'Paño inferior', barY: [upperBot, yTB] }
      : { yRail: y0 + s, anchor: 'bottom', regionH: lowerH, dosFilas: false, patron: patInf, zona: 'Paño inferior', barY: [y0 + s, ym] });
    for (const fl of filas) {
      const hv = Math.min(g * 2.6, fl.regionH * (fl.dosFilas ? 0.38 : 0.62));
      const out = filaMotivos(f, { xa, xb, xs, d, tw, barY: fl.barY, yRail: fl.yRail, anchor: fl.anchor, hv, zc, patron: fl.patron, simetria, invertir: !hingeLeft, zona: fl.zona });
      h.deco.push(...out.ids); h.decoC.push(...out.contactos); h.cuenta = sumaCuenta(h.cuenta, out.cuenta); h.avisos.push(...out.avisos);
    }
    // friso
    if (plan) {
      const out = frisoMotivos(f, plan, { xa, y0: yF, zc, invertir: !hingeLeft });
      h.deco.push(...out.ids); h.decoC.push(...out.contactos); h.cuentaFriso = out.cuenta; h.avisos.push(...out.avisos);
    }
    // remate superior
    const xcs = xs.map((x) => x + d / 2);
    if (forma === 'arco') {
      const r = f.L(`arco|${fx(span)}|${fx(rise)}|${modo}`, 'Arco');
      h.arco.push(b.arco({ ref: r.ref, name: r.name, width: span, rise, section: [ARC_A, ARC_A], normal: 'z', at: [xa, yRailTop, zc - ARC_A / 2], stock: `Cuadradillo macizo de acero ${ARC_A} mm` }));
      pieza(b, h.arco[0]).note = `Arco de ${mm(span)} de luz y ${mm(rise)} de flecha (radio ${mm(radioArco(span, rise))}), curvado en frío.`;
      h.arcoC.push([xa, yRailTop + ARC_A / 2, zc], [xb, yRailTop + ARC_A / 2, zc], [xa + 6, yRailTop, zc], [xb - 6, yRailTop, zc]);
      for (const xc of xcs) {
        const u = xc - xa;
        const hA = alturaArco(u, span, rise);
        const slope = (alturaArco(Math.min(span, u + 1), span, rise) - alturaArco(Math.max(0, u - 1), span, rise)) / 2;
        const half = (ARC_A / 2) * Math.sqrt(1 + slope * slope);
        const yUnder = yRailTop + hA + ARC_A / 2 - half; // cara inferior del arco sobre el barrote
        const yOver = yRailTop + hA + ARC_A / 2 + half; // cara superior
        if (yUnder - yRailTop >= 15) {
          const id = barrote(f, sp, 'Barrote bajo el arco', r1(yUnder - yRailTop), xc - d / 2, yRailTop, zc);
          h.bajoArco.push(id); h.jBajoArco.push([id, 'min'], [id, 'max']);
        }
        if (remate !== 'ninguno') {
          const id = barrote(f, sp, 'Lanza sobre el arco', Lsob, xc - d / 2, r1(yOver), zc);
          h.remates.push(id); h.jRemate.push([id, 'min'], [id, 'max']);
          h.remates.push(puntaSobre(f, remate, d, xc, r1(yOver) + Lsob, zc)); h.nPuntas++;
        }
      }
    } else if (forma === 'lanza') {
      for (const xc of xcs) {
        const id = barrote(f, sp, 'Lanza', Lsob, xc - d / 2, y0 + H, zc);
        h.remates.push(id); h.jRemate.push([id, 'min'], [id, 'max']);
        if (remate !== 'ninguno') { h.remates.push(puntaSobre(f, remate, d, xc, y0 + H + Lsob, zc)); h.nPuntas++; }
      }
    } else if (remate !== 'ninguno') {
      for (const xc of xcs) {
        h.remates.push(puntaSobre(f, remate, d, xc, y0 + H, zc)); h.nPuntas++;
        const base = remate === 'lanza' ? Math.max(24, d * 2) : d;
        h.puntasC.push(...cordonPerimetral([xc, y0 + H, zc], 'y', base, base));
      }
    }
    if (bolas) {
      for (const xm of [xL + s / 2, xL + W - s / 2]) {
        h.bolas.push(bolaSobre(f, s + 16, xm, stileTop, zc, 'Bola de montante', `Bola de forja Ø${s + 16} mm (para tubo de ${s} mm)`));
        h.bolaC.push(...cordonAnillo([xm, stileTop, zc], s * 0.85));
      }
    }
    return h;
  };

  const xL1 = postes ? P + GAP_H : 0;
  hojas.push(mkHoja(xL1, true));
  if (dos) hojas.push(mkHoja(xL1 + W + GAP_C, false));
  const last = hojas[hojas.length - 1];
  const h0 = hojas[0];

  // --- postes y herrajes ---
  const postIds: string[] = [], placaIds: string[] = [], capIds: string[] = [];
  const jPostes: J[] = [];
  const capC: Mark[] = [];
  const anclajes: Vec3[] = [];
  const PL = P + 140;
  const postTop = stileTop + 60;
  const postX: number[] = [];
  if (postes) {
    postX.push(0, dos ? last.hingeX + GAP_H : last.closeX + GAP_L);
    const yP = placa ? PLACA_T : 0;
    for (const x of postX) {
      const id = tuboQ(f, P, pt.wall, 'Poste', postTop - yP, 'y', [x, yP, 0]);
      postIds.push(id);
      if (!placa) pieza(b, id).note = 'Visible sobre el suelo. Córtalo más largo: lo que haya que empotrar lo decide quien haga el dado de hormigón, según el terreno y el tamaño de la puerta.';
      if (placa) {
        const r = f.L(`placa|${PL}`, 'Placa de anclaje');
        placaIds.push(b.pletina({ ref: r.ref, name: r.name, section: [PLACA_T, PL], length: PL, axis: 'x', at: [x + P / 2 - PL / 2, 0, P / 2 - PL / 2] }));
        jPostes.push([id, 'min']);
        const o = PL / 2 - 25;
        for (const [dx, dz] of [[-o, -o], [o, -o], [-o, o], [o, o]]) anclajes.push([x + P / 2 + dx, PLACA_T, P / 2 + dz]);
      }
      if (bolaPoste) {
        capIds.push(bolaSobre(f, P + 20, x + P / 2, postTop, P / 2, 'Bola de poste', `Bola de forja Ø${P + 20} mm (para tubo de ${P} mm)`));
        capC.push(...cordonAnillo([x + P / 2, postTop, P / 2], P * 0.85));
      } else {
        const r = f.L(`tapa|${P}`, 'Tapa del poste');
        capIds.push(b.pletina({ ref: r.ref, name: r.name, section: [4, P + 10], length: P + 10, axis: 'x', at: [x - 5, postTop, -5] }));
        capC.push(...cordonPerimetral([x + P / 2, postTop, P / 2], 'y', P, P));
      }
    }
  }
  // pernios
  const nPer = H > 1600 ? 3 : 2;
  const perY = nPer === 3 ? [y0 + 120, (y0 + 120 + stileTop - 220) / 2, stileTop - 220] : [y0 + 120, stileTop - 220];
  const pernios: string[] = [];
  const perC: Mark[] = [], perP: Mark[] = [];
  const rPer = f.L('pernio', 'Pernio de soldar');
  for (const h of hojas) {
    const hl = h.hingeLeft;
    const x0 = hl ? h.hingeX - GAP_H : h.hingeX;
    for (const y of perY) {
      pernios.push(b.herraje({ ref: rPer.ref, name: rPer.name, size: [PERNIO.w, PERNIO.h, PERNIO.t], at: [x0, y, zc - PERNIO.t / 2], stock: 'Pernio de soldar de 100 mm para puerta de hierro (elige el grueso según el peso de la hoja)' }));
      const faces = postes ? [x0, x0 + GAP_H] : [hl ? x0 + GAP_H : x0];
      for (const xf of faces) {
        for (const z of [zc - PERNIO.t / 2, zc + PERNIO.t / 2]) perC.push(cordon([xf, y + 5, z], [xf, y + PERNIO.h - 5, z]));
        perP.push(punto([xf, y + PERNIO.h / 2, zc - PERNIO.t / 2]));
      }
    }
  }
  // cierre
  const herrajes: string[] = [];
  const herrC: Mark[] = [], herrP: Mark[] = [];
  const yLock = y0 + Math.min(1000, H * 0.5);
  const cierreEn = (h: Hoja, tipo: 'pasador' | 'cerradura') => {
    const [cx0, cx1] = h.cierreStile;
    const closeRight = h.closeX === cx1;
    const size: Vec3 = tipo === 'cerradura' ? [70, 150, 25] : [150, 35, 20];
    const x = closeRight ? cx1 - size[0] : cx0;
    const r = f.L(`cierre|${tipo}`, tipo === 'cerradura' ? 'Cerradura' : 'Pasador');
    herrajes.push(b.herraje({ ref: r.ref, name: r.name, size, at: [x, yLock - size[1] / 2, s], stock: tipo === 'cerradura' ? 'Cerradura de caja para soldar en puerta metálica, con cerradero y llaves' : 'Pasador (cerrojo) de soldar de 150 mm con cerradero' }));
    const xi0 = Math.max(x, cx0), xi1 = Math.min(x + size[0], cx1);
    herrC.push(cordon([xi0, yLock - size[1] / 2, s], [xi0, yLock + size[1] / 2, s]), cordon([xi1, yLock - size[1] / 2, s], [xi1, yLock + size[1] / 2, s]));
    herrP.push(punto([xi0, yLock, s]), punto([xi1, yLock, s]));
  };
  if (cierre === 'pasador' || cierre === 'cerradura') {
    cierreEn(last, cierre);
    if (dos) {
      const [cx0, cx1] = h0.cierreStile;
      const r = f.L('pasadorSuelo', 'Pasador de suelo');
      herrajes.push(b.herraje({ ref: r.ref, name: r.name, size: [25, 250, 25], at: [(cx0 + cx1) / 2 - 12.5, y0, s], stock: 'Pasador de suelo (cerrojo vertical) de soldar de 250 mm' }));
      herrC.push(cordon([(cx0 + cx1) / 2 - 12.5, y0 + 10, s], [(cx0 + cx1) / 2 - 12.5, y0 + 240, s]), cordon([(cx0 + cx1) / 2 + 12.5, y0 + 10, s], [(cx0 + cx1) / 2 + 12.5, y0 + 240, s]));
      herrP.push(punto([(cx0 + cx1) / 2, y0 + 125, s]));
    }
  }
  // batiente
  if (batiente) {
    const r = f.L(`batiente|${fx(stileTop - y0)}`, 'Pletina batiente');
    const xB = dos ? last.closeX - GAP_C - 20 : last.closeX - 20;
    const wB = dos ? 40 + GAP_C : 40 + GAP_L;
    const id = b.pletina({ ref: r.ref, name: r.name, section: [wB, 4], length: stileTop - y0, axis: 'y', at: [xB, y0, -4] });
    if (wB !== 40) pieza(b, id).stock = `Pletina de acero ${wB}×4 mm`;
    herrajes.push(id);
    const xw = dos ? last.closeX + 20 : last.closeX - 20; // canto soldado sobre el montante de la hoja que lo lleva
    herrC.push(...cosido([xw, y0 + 20, 0], [xw, stileTop - 20, 0], 200, 40));
    herrP.push(punto([xw, y0 + 30, 0]), punto([xw, stileTop - 30, 0]));
  }

  // --- totales ---
  const all = <K extends keyof Hoja>(k: K) => hojas.flatMap((h) => h[k] as unknown as string[]);
  const allJ = (k: 'jMarco' | 'jBarras' | 'jBajoArco' | 'jRemate') => hojas.flatMap((h) => h[k]);
  const allM = (k: 'pChapa' | 'cChapa' | 'puntasC' | 'bolaC') => hojas.flatMap((h) => h[k]);
  const decoC = hojas.flatMap((h) => h.decoC);
  const arcoC = hojas.flatMap((h) => h.arcoC);
  const nH = hojas.length;
  const nBar = h0.nBar, g = h0.g;
  const nPuntas = h0.nPuntas * nH;
  const cPanos = sumaCuenta(...hojas.map((h) => h.cuenta)), cFriso = sumaCuenta(...hojas.map((h) => h.cuentaFriso));
  const cTodo = sumaCuenta(cPanos, cFriso);
  const nRet = h0.nRet * nH;
  const avisos = [...new Set(hojas.flatMap((h) => h.avisos))];
  const hayDeco = all('deco').length > 0 || forma === 'arco';
  const hayRemates = all('remates').length > 0 || all('bolas').length > 0;
  const hayHerr = pernios.length > 0;

  // --- pasos ---
  const lineasCorte = [
    `Marco${nH > 1 ? ` (por hoja)` : ''}: 2 montantes de ${mm(stileTop - y0)} y ${1 + 1 + (friso ? 1 : 0) + 1} travesaños de ${mm(span)} en tubo ${fr.label}.`,
    `Barrotes: ${nBar} por tramo en ${sp.label.toLowerCase()}, con un hueco libre de ${mm(g)}: ${zocalo ? '' : `${nBar} de ${mm(lowerH)} abajo y `}${nBar} de ${mm(upperH)} arriba${nRet ? ` (${nRet} de ellos, retorcidos, se compran ya entorchados y se cortan igual)` : ''}.`,
    ...(forma === 'lanza' ? [`Lanzas: ${nBar * nH} trozos de ${mm(Lsob)} del mismo barrote, que se sueldan a tope sobre el travesaño superior.`] : []),
    ...(forma === 'arco' ? [`Arco: ${nH} de cuadradillo de ${ARC_A} mm de ${mm(span)} de luz y ${mm(rise)} de flecha. Los barrotes bajo el arco tienen cada uno su largo (míralo en la lista de piezas): córtalos después de presentar el arco, midiendo cada uno en su sitio.`] : []),
    ...(zocalo ? [`Zócalo: ${nH} chapa${nH > 1 ? 's' : ''} de 2 mm de ${mm(span)} × ${mm(lowerH)}.`] : []),
    ...(postes ? [`Postes: 2 tubos ${pt.label} de ${mm(postTop - (placa ? PLACA_T : 0))}${placa ? `, con placas de ${PL} × ${PL} × ${PLACA_T} mm taladradas en las cuatro esquinas a 25 mm de los bordes (el diámetro, el que pida el anclaje que vayas a usar)` : '. Si van empotrados, córtalos más largos: lo que se empotra lo decide quien haga el dado de hormigón'}.`] : []),
  ];
  b.step(pasoCortar({ proceso, lineas: lineasCorte }));
  b.step(pasoPreparar({
    proceso,
    extra: [
      'Compra tubo y barra negros o decapados, no galvanizados: la puerta irá pintada.',
      ...(modo === 'comprada' && hayDeco ? ['Ten a mano todos los elementos de forja comprados y comprueba sus medidas con la lista de piezas antes de empezar a soldar el marco.'] : []),
    ],
  }));

  if (modo === 'curvada' && (forma === 'arco' || motivosBarra(cTodo) > 0)) {
    b.step({
      kind: 'preparar',
      title: forma === 'arco' ? 'Curva los motivos y el arco' : 'Curva los motivos de forja',
      summary: 'Antes de soldar nada, fabrica todas las piezas curvas iguales entre sí con una plantilla.',
      detail: [
        ...lineasCurvar(cTodo),
        ...(forma === 'arco' ? [`Arco: traza en el suelo del taller el arco de ${mm(span)} de luz y ${mm(rise)} de flecha (radio ${mm(radioArco(span, rise))}) con un compás de cordel y curva el cuadradillo poco a poco hasta que coincida. Si no te ves capaz, en muchos almacenes de hierros lo curvan por encargo.`] : []),
        'Coloca cada pieza terminada sobre el dibujo: si no coincide, corrígela ahora. Una voluta mal hecha se nota mucho en la puerta acabada.',
      ],
      parts: [],
      technique: tecDecoracion('curvada'),
      tools: herramientasDeco('curvada'),
      check: 'Apila las volutas iguales una sobre otra: deben coincidir. Las que se separen, a la plantilla otra vez.',
      warning: 'La barra puede saltar de la plantilla al curvar: gafas, guantes y la plantilla bien sujeta en el tornillo de banco.',
    });
  }

  const diag = Math.round(Math.hypot(W, stileTop - y0));
  b.step({
    kind: 'soldar',
    title: nH > 1 ? 'Puntea los marcos en plano' : 'Puntea el marco en plano',
    summary: `Montantes y travesaños forman ${nH > 1 ? 'cada marco' : 'el marco'}: se puntean tumbados sobre una superficie plana comprobando las diagonales.`,
    detail: [
      'Tumba los dos montantes sobre la mesa de soldar o sobre el suelo plano del taller, calzados con tacos iguales, y mete entre ellos los travesaños a tope.',
      `Travesaños: el inferior enrasado abajo; el intermedio con su cara inferior a ${mm(ym - y0)} del extremo inferior de la hoja${friso ? `; el del friso ${mm(hbF)} por encima del intermedio (hueco libre del friso)` : ''}; el superior con su cara superior a ${mm(yRailTop - y0)}.`,
      ...(forma === 'arco' ? [`Los montantes sobresalen ${mm(stileTop - yRailTop)} por encima del travesaño superior: entre ellos irá el arco.`] : []),
      ...TEC_PUNTEO.how.slice(0, 2),
      'Da la vuelta al marco y puntea las caras opuestas.',
    ],
    parts: [...all('montantes'), ...all('travesanos')],
    marks: ptsJ(b, allJ('jMarco')),
    technique: TEC_PUNTEO,
    tools: ['Mesa de soldar o suelo plano', 'Tacos de calzo iguales', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', 'Flexómetro', info.equipo[0]],
    check: `Mide las dos diagonales del marco de esquina exterior a esquina exterior (unos ${mm(diag)}): deben ser iguales. Si no lo son, corrige ahora con un sargento en diagonal o rompiendo un punto.`,
    warning: 'Solo puntos, todavía ningún cordón. Un marco descuadrado soldado del todo ya no se arregla, y una puerta descuadrada roza o no cierra.',
  });

  b.step({
    kind: 'soldar',
    title: 'Reparte y puntea los barrotes',
    summary: `${nBar} barrotes por tramo con un hueco libre de ${mm(g)}, repartidos con una galga para que queden todos iguales.`,
    detail: [
      `Corta una galga de separación: un taco de madera o un trozo de pletina de ${mm(g)} exactos de ancho. Es más fiable que medir cada hueco con el flexómetro.`,
      'Marca el centro del travesaño y reparte desde los montantes hacia el centro: montante, galga, barrote, galga… Si el último hueco no sale igual, revisa la galga antes de puntear.',
      'Puntea cada barrote arriba y abajo por la cara delantera, centrado en el grueso del tubo, comprobando con la escuadra o un nivel que queda vertical.',
      ...(zocalo ? ['Presenta la chapa del zócalo entre el travesaño inferior, el intermedio y los montantes, centrada en el grueso del tubo, y puntéala en las esquinas y en el centro de cada lado.'] : []),
      'Cuando estén todos, da la vuelta a la hoja y puntea también la cara trasera de cada barrote.',
    ],
    parts: [...all('barras'), ...all('chapa')],
    marks: [...ptsJ(b, allJ('jBarras')), ...allM('pChapa')],
    technique: TEC_PUNTEO,
    tools: ['Galga de separación', 'Escuadra de acero', 'Nivel', 'Pinzas de presión', 'Rotulador de pintura', info.equipo[0]],
    check: 'Mira la hoja desde un extremo, a ras: todos los barrotes deben verse en fila, sin ninguno adelantado o torcido. Vuelve a medir las diagonales del marco.',
    tip: zocalo ? 'La chapa fina se perfora enseguida: en el zócalo da puntos muy cortos y espaciados, apuntando el arco más al tubo que a la chapa.' : 'Si los barrotes son macizos y el marco de tubo fino, apunta el arco más al barrote: el macizo aguanta más calor que la pared del tubo.',
  });

  b.step(pasoCordones({
    proceso,
    nUniones: allJ('jMarco').length + allJ('jBarras').length,
    marks: [...cordJ(b, allJ('jMarco')), ...cordJ(b, allJ('jBarras')), ...allM('cChapa')],
    orden: [
      'Empieza por las cuatro esquinas del marco, cara delantera, saltando en diagonal de una esquina a la opuesta; después el travesaño intermedio y, por último, las caras de detrás.',
      'Sigue con los barrotes alternando: uno del extremo izquierdo, otro del derecho, otro del centro… nunca todos seguidos por el mismo lado, o la hoja se curvará como un plátano.',
      ...(zocalo ? ['La chapa del zócalo se cose con cordones cortos y separados, saltando de un lado a otro; nunca un cordón seguido en chapa de 2 mm.'] : []),
      'Deja la hoja sujeta a la mesa con sargentos mientras sueldas y hasta que se enfríe.',
    ],
  }));

  if (hayDeco) {
    const decoIds = [...all('deco'), ...all('arco'), ...all('bajoArco')];
    b.step({
      kind: 'soldar',
      title: 'Presenta y suelda las decoraciones',
      summary: [
        forma === 'arco' && 'el arco y los barrotes bajo él',
        totalMotivos(cPanos) > 0 && resumenMotivos(cPanos) + ' entre barrotes',
        totalMotivos(cFriso) > 0 && `el friso de ${resumenMotivos(cFriso)}`,
      ].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase()) + ': cada pieza apoya en dos barrotes o en barrote y travesaño.',
      detail: [
        ...(forma === 'arco' ? [
          `Presenta el arco entre los montantes, apoyado en el travesaño superior. Sus extremos tocan la cara interior de cada montante: puntéalos ahí y en el apoyo sobre el travesaño.`,
          ...(h0.bajoArco.length ? [`Mide en su sitio cada barrote bajo el arco (de ${mm(Math.min(...h0.bajoArco.map((id) => pieza(b, id).size[1])))} junto a los extremos a ${mm(Math.max(...h0.bajoArco.map((id) => pieza(b, id).size[1])))} en el centro), córtalo y puntéalo en la vertical del barrote de abajo: deben verse como un solo barrote que atraviesa el travesaño.`] : []),
        ] : []),
        ...lineasMontaje({ g, simetria, panos: cPanos, friso: cFriso, frisoH: hbF }),
        ...(nH > 1 && totalMotivos(cPanos) > 0 && !simetria ? ['La segunda hoja lleva el patrón reflejado, para que la cancela cerrada se vea simétrica.'] : []),
        'Puntea todas las piezas primero, mira la puerta de pie a unos metros y corrige lo que se vea desigual. Solo entonces suelda cada contacto con un cordón corto por delante y otro por detrás.',
      ],
      parts: decoIds,
      marks: [...puntos(decoC), ...cordonesDeco(decoC), ...puntos(arcoC), ...cordonesDeco(arcoC, ARC_A), ...ptsJ(b, allJ('jBajoArco')), ...cordJ(b, allJ('jBajoArco'))],
      technique: tecDecoracion(modo),
      tools: [...herramientasDeco(modo), ...info.equipo.slice(0, 1)],
      check: `Con la hoja de pie y a unos pasos, los motivos iguales deben verse a la misma altura${simetria ? ' y simétricos respecto al centro' : ''}. Ninguno debe atravesar un barrote ni quedar en el aire: todos tocan por al menos dos sitios (las hojas, por su base).`,
      warning: 'La barra de una voluta es fina y se funde mucho antes que el tubo: arco corto, poco tiempo y el calor apuntado al barrote o al travesaño.',
    });
  }

  if (hayRemates) {
    const jR = allJ('jRemate');
    b.step({
      kind: 'soldar',
      title: 'Suelda ' + [jR.length && 'las lanzas', nPuntas && (jR.length ? 'sus puntas' : 'las puntas'), bolas && 'las bolas'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' y $1'),
      summary: `${nPuntas ? `${nPuntas} ${remate === 'lanza' ? 'puntas de lanza' : 'pinchos'} centrados sobre cada barrote` : 'Los barrotes sobrepasan el marco'}${bolas ? ` y ${2 * nH} bolas rematando los montantes` : ''}.`,
      detail: [
        ...(forma === 'lanza' ? [`Suelda a tope un trozo de barrote de ${mm(Lsob)} sobre el travesaño superior, en la vertical exacta de cada barrote: ayúdate de una regla apoyada en el barrote de abajo.`] : []),
        ...(forma === 'arco' && remate !== 'ninguno' ? [`Sobre el arco, en la vertical de cada barrote, suelda a tope un trozo de ${mm(Lsob)}: sus extremos superiores quedan siguiendo la curva del arco.`] : []),
        ...(nPuntas ? ['Presenta cada punta centrada sobre su barrote (marca el centro con dos diagonales en la testa), compruébala a plomo por dos caras y puntéala.', 'Suelda la base con un cordón corto alrededor, sin hacer un pegote: la punta es maciza y aguanta, el barrote fino se quema antes.'] : []),
        ...(bolas ? [`Las bolas cierran la boca de los montantes: asiéntalas centradas y suéldalas alrededor. Así no entra agua en el tubo.`] : []),
        NOTA_PUNTAS,
      ],
      parts: [...all('remates'), ...all('bolas')],
      marks: [...ptsJ(b, jR), ...cordJ(b, jR), ...allM('puntasC'), ...allM('bolaC')],
      tools: ['Regla de acero', 'Escuadra', 'Nivel pequeño', 'Pinzas de presión', ...info.equipo.slice(0, 1)],
      check: 'Mira la fila de puntas desde un extremo: todas en línea y a plomo. Una punta torcida se nota desde la calle.',
      warning: nPuntas ? 'Las puntas pinchan y cortan: desde este momento mueve la hoja con guantes y ten cuidado al girarla en la mesa. Antes de instalarlas, consulta la normativa de tu ayuntamiento.' : undefined,
    });
  }

  if (hayHerr) {
    b.step({
      kind: 'soldar',
      title: postes ? 'Prepara los postes y suelda los herrajes' : 'Suelda los pernios y el cierre',
      summary: postes
        ? `Los postes reciben su ${placa ? 'placa y su ' : ''}remate; después se presenta la hoja entre ellos y se sueldan los pernios${herrajes.length ? ', el cierre y la batiente' : ''}.`
        : `Los pernios se sueldan a la hoja${herrajes.length ? ', junto con el cierre y la batiente' : ''}; la otra mitad irá al poste o pilar que ya tengas.`,
      detail: [
        ...(postes ? [
          ...(placa ? ['Suelda cada poste centrado y a escuadra sobre su placa de anclaje, alrededor de todo el contorno.'] : []),
          bolaPoste ? 'Suelda una bola de forja sobre la boca de cada poste.' : 'Suelda la tapa de pletina sobre la boca de cada poste, alrededor del contorno: así no entra agua.',
          `Tumba los postes sobre el suelo plano y mete la hoja entre ellos con calzos: ${mm(GAP_H)} de hueco en el lado de los pernios${dos ? `, ${mm(GAP_C)} entre las hojas` : `, ${mm(GAP_L)} en el lado del cierre`} y la hoja ${mm(HOLGURA)} levantada respecto al pie de los postes.`,
        ] : ['Tumba la hoja en la mesa y marca la altura de los pernios según el poste o pilar donde la vayas a colgar.']),
        `Pernios: ${nPer} por hoja, a ${mm(perY[0] - y0)} y ${mm(perY[perY.length - 1] - y0)} del pie de la hoja. Monta cada pernio cerrado (macho dentro de la hembra) y alinéalos todos con una regla: si no están en el mismo eje, la puerta se clava.`,
        postes ? 'Puntea cada pernio a la hoja y al poste, comprueba que la hoja abre y cierra sin forzar y, solo entonces, suelda los cordones a cada lado.' : 'Suelda la mitad del pernio que va a la hoja; la otra mitad se suelda (o se atornilla con su placa) al poste existente en el momento de colgarla.',
        ...(cierre !== 'ninguno' ? [`Suelda ${cierre === 'cerradura' ? 'la caja de la cerradura' : 'el pasador'} por detrás del montante de cierre, a unos ${mm(yLock - y0)} del pie de la hoja${dos ? ', y el pasador de suelo en la hoja que queda fija' : ''}. El cerradero va en el ${dos ? 'montante de la otra hoja' : 'poste'}, enfrentado.`] : []),
        ...(batiente ? [`La pletina batiente se suelda por delante del montante de cierre ${dos ? 'de la hoja que abre primero, solapando la otra hoja' : 'y solapa el poste'}: hace de tope. La puerta abre hacia el lado contrario a la pletina.`] : []),
      ],
      parts: [...postIds, ...placaIds, ...capIds, ...pernios, ...herrajes],
      marks: [...perP, ...perC, ...herrP, ...herrC, ...cordJ(b, jPostes), ...capC],
      tools: ['Calzos de madera de varios gruesos', 'Regla de acero larga', 'Nivel', 'Escuadra', 'Sargentos', ...info.equipo.slice(0, 1)],
      check: 'Antes de soldar del todo los pernios, abre y cierra la hoja varias veces: debe girar sin rozar y quedarse quieta en cualquier posición. Si se va sola hacia un lado, los pernios no están a plomo.',
      tip: 'Un punto de soldadura sobre la cabeza del pernio (o un tope encima de la hoja) impide que se pueda levantar y sacar de los pernios desde fuera.',
      warning: 'Mueve la hoja entre dos personas. Si es grande o pesada, que un profesional dimensione postes, anclajes y pernios.',
    });
  }

  b.step(pasoRepasar([
    'Repasa con el disco de láminas los cordones vistos de las uniones a tope y deja el marco liso, sin comer el tubo.',
    ...(hayDeco ? ['En las volutas no amoles: limpia la escoria con un cepillo de alambre pequeño y repasa solo las gotas que sobresalgan.'] : []),
    ...(nPuntas ? ['Repasa las bases de las puntas con cuidado: si el disco toca la punta, la deforma.'] : []),
  ]));

  b.step(pasoPintarForja(acabado));

  b.step({
    kind: 'acabar',
    title: postes ? (placa ? 'Ancla los postes y cuelga la puerta' : 'Empotra los postes y cuelga la puerta') : 'Cuelga la puerta',
    summary: postes ? 'Los postes se fijan a plomo, con la hoja ya colgada y calzada para que el conjunto no se mueva mientras se ancla.' : 'La hoja se cuelga de los postes o pilares existentes con la otra mitad de los pernios.',
    detail: [
      ...(postes && placa ? [
        `Presenta el conjunto sobre la solera de hormigón con la hoja cerrada y calzada a ${mm(HOLGURA)} del suelo. Aploma los dos postes en las dos direcciones.`,
        `Marca los ${anclajes.length} taladros de las placas, retira el conjunto, taladra el hormigón con el diámetro y la profundidad que indique el fabricante del anclaje y fija cada placa.`,
      ] : []),
      ...(postes && !placa ? [
        'Haz los hoyos y los dados de hormigón con las medidas que te indique quien conozca el terreno; mete los postes con la hoja colgada y calzada, aplómalos y arriostra el conjunto con listones hasta que fragüe.',
        'No cuelgues peso ni abras la puerta hasta que el hormigón haya fraguado según las indicaciones del fabricante del cemento.',
      ] : []),
      ...(!postes ? ['Suelda o atornilla las hembras de los pernios al poste o pilar existente, a la misma altura que las de la hoja, comprobando con la regla que están en el mismo eje.', 'Cuelga la hoja entre dos personas y comprueba que gira sin rozar.'] : []),
      'Retoca con pintura cualquier roce del montaje y engrasa los pernios y el cierre.',
      'Abre y cierra la puerta en todo su recorrido: no debe rozar el suelo ni el poste, y el cierre debe entrar sin forzar.',
    ],
    parts: [],
    marks: anclajes.length ? tornillos(anclajes, 'y') : undefined,
    hardware: [
      ...(postes && placa ? [hw('Anclaje para hormigón (taco químico o de expansión) del diámetro que admitan los taladros de la placa; elige tipo y métrica con el fabricante según tu soporte', anclajes.length)] : []),
      ...(postes && !placa ? [hw('Hormigón o mortero para los dados de los postes', 2, 'sacos (o lo que pida el hoyo)')] : []),
      hw('Grasa para pernios y cerraduras', 1, 'tubo'),
      hw('Esmalte del mismo color para retoques', 1, 'bote pequeño'),
    ],
    tools: [...(postes ? ['Taladro percutor con broca para hormigón', 'Nivel', 'Llave para los anclajes'] : ['Llave o soldadora para las hembras de los pernios']), 'Calzos de madera', 'Pincel fino'],
    check: 'Con la puerta cerrada, comprueba con el nivel que los postes siguen a plomo y que la hoja está horizontal. Empuja la hoja abierta hacia abajo por el extremo: no debe ceder.',
    warning: 'Una puerta mal colgada puede caer: no la dejes colgada sin anclar ni con el hormigón fresco, y si la hoja es grande o pesada, deja el anclaje y los pernios en manos de un profesional.',
  });

  // --- resumen ---
  const ac = ACABADOS[acabado] ?? ACABADOS.negro;
  const decor = totalMotivos(cTodo);
  const ornado = decor > 0 || nPuntas > 0 || forma === 'arco';
  const totalW = postes ? postX[postX.length - 1] + P : dos ? 2 * W + GAP_C : W;
  const horas = 8 * nH + nBar * nH * 0.2 + (zocalo ? 1 : 0) + (forma === 'arco' ? 2 : 0) + (forma === 'lanza' ? 1 : 0)
    + decor * (modo === 'curvada' ? 0.7 : 0.25) + nPuntas * 0.08 + (postes ? 3 : 1);
  const formaTxt = { recto: 'remate recto', arco: 'remate en arco', lanza: 'barrotes en lanza' }[forma];

  return b.finish({
    id: 'puerta-verja',
    title: 'Puerta de verja',
    craft: 'soldadura',
    summary: `Puerta de verja de ${nH > 1 ? 'dos hojas' : 'una hoja'} de ${Math.round(W / 10)} × ${Math.round(H / 10)} cm${nH > 1 ? ' cada una' : ''}, ${formaTxt}${zocalo ? ', zócalo de chapa' : ''}${nRet ? (nRet === nBar * nH * (zocalo ? 1 : 2) ? ', barrotes retorcidos' : ', barrotes lisos y retorcidos') : ''}${decor ? `, ${resumenMotivos(cTodo)}` : ''}${nPuntas ? `, ${remate === 'lanza' ? 'lanzas' : 'pinchos'}` : ''}. ${ac.label}.`,
    difficulty: modo === 'curvada' && (decor > 0 || forma === 'arco') ? 3 : 2,
    hours: Math.round(horas * 2) / 2,
    paint: ac.hex,
    safety: seguridadForja({ puntas: nPuntas > 0, escalable: true, puerta: true, curvada: modo === 'curvada', proceso }),
    notes: [
      `Barrotes repartidos para no pasar de ${mm(hmax)} de hueco libre: salen ${nBar} por tramo con ${mm(g)} reales. Si cambias el ancho, el nº de barrotes y el tamaño de las volutas se recalculan.`,
      'Las uniones del marco y de los barrotes son a tope con cortes rectos: el barrote apoya contra la cara del travesaño.',
      ...(forma === 'arco' ? ['El marco es rectangular (fácil de escuadrar) y el arco va encima, entre los montantes: es más sencillo que curvar el propio marco.'] : []),
      ...(ornado ? [NOTA_MOTIVOS] : []),
      ...(notaFriso ? [notaFriso] : []),
      ...avisos,
      ...(nRet ? [NOTA_RETORCIDO] : []),
      ...(cTodo.hoja ? [NOTA_HOJAS] : []),
      NOTA_PUNTAS,
      `Holgura bajo la hoja de ${mm(HOLGURA)}, ${mm(GAP_H)} en el lado de los pernios y ${mm(dos ? GAP_C : GAP_L)} en el de cierre: son decisiones de diseño; ajústalas a tu suelo y a tus pernios.`,
      'No se indica carga ni peso admisible: depende de tus soldaduras y del anclaje. Las secciones de tubo y barra son decisiones de diseño; compruébalas en tu almacén de hierros.',
    ],
    sources: fuentesForja(proceso),
    spec: [
      { label: 'Medidas', value: `${nH > 1 ? '2 hojas de ' : ''}${W} × ${H} mm${forma === 'arco' ? ` (arco de ${Math.round(rise)} mm de flecha)` : ''}; ancho total ${Math.round(totalW)} mm` },
      { label: 'Remate', value: forma === 'arco' ? 'En arco' : forma === 'lanza' ? `Barrotes pasantes ${Lsob} mm` : 'Recto' },
      { label: 'Marco', value: `Tubo ${fr.label}` },
      { label: 'Barrotes', value: `${nBar} por tramo, ${sp.label.toLowerCase()}, hueco ${Math.round(g)} mm` },
      { label: 'Zócalo', value: zocalo ? 'Chapa de 2 mm' : 'No' },
      { label: 'Puntas', value: nPuntas ? `${nPuntas} ${remate === 'lanza' ? 'de lanza' : 'pinchos'}` : 'No' },
      { label: 'Tipo de barrote', value: nRet === 0 ? 'Liso' : nRet === nBar * nH * (zocalo ? 1 : 2) ? 'Retorcido' : 'Alterno liso y retorcido' },
      { label: 'Entre barrotes', value: totalMotivos(cPanos) ? resumenMotivos(cPanos) + (simetria ? ', simétrico' : '') : 'Sin decoración' },
      { label: 'Friso', value: totalMotivos(cFriso) ? `${resumenMotivos(cFriso)}, ${Math.round(hbF)} mm de alto` : 'No' },
      { label: 'Bolas en montantes', value: bolas ? 'Sí' : 'No' },
      { label: 'Herrajes', value: `${pernios.length} pernios${cierre !== 'ninguno' ? `, ${cierre}` : ''}${batiente ? ', batiente' : ''}` },
      { label: 'Postes', value: postes ? `${pt.label}, ${placa ? 'placa de anclaje' : 'para empotrar'}, ${bolaPoste ? 'bola' : 'tapa'}` : 'No' },
      { label: 'Decoración', value: modo === 'comprada' ? 'Elementos de forja comprados' : 'Curvados en frío por ti' },
      { label: 'Acabado', value: ac.label },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}
