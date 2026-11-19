import type { Generator, HardwareLine, Mark, MaterialId, ParamValues, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, repartir, tornillos } from '../core/builder';

/**
 * MUEBLE MODULAR DE TABLERO.
 *
 * El mueble se compone de uno o varios CUERPOS adosados (columnas). Cada cuerpo es una caja completa
 * (dos costados, base, techo y baldas) con una pila de HUECOS de abajo arriba, separados por baldas.
 * Cada hueco puede quedar abierto, llevar puerta abatible, un cajón con guías o un divisor vertical.
 *
 * Decisiones de diseño (se explican también en el editor y en las notas del proyecto):
 *  - COSTADOS DOBLES: cada cuerpo lleva sus dos costados y se monta, escuadra y mueve por separado;
 *    después los cuerpos se atornillan entre sí por dentro. Cuesta un costado más por unión, pero todos
 *    los cuerpos se montan igual, cada costado queda entero y nada depende de un tablero compartido.
 *  - FRENTES SUPERPUESTOS: puertas y frentes de cajón tapan el canto de costados y baldas, con 3 mm de
 *    holgura entre frentes y 1,5 mm en los bordes. Perdonan mucho más que los frentes embutidos.
 *  - ALTO: los huecos reparten el alto interior en proporción a su alto nominal. Si un hueco quedara por
 *    debajo de 120 mm se fija en 120 mm y el resto se reparte entre los demás; si ni así caben, se unen
 *    los huecos de arriba de ese cuerpo.
 *
 * ===================== FORMATO DE LA DISTRIBUCIÓN (parámetro `distribucion`) =====================
 *
 *   cuerpo_cuerpo_cuerpo          los cuerpos, de izquierda a derecha, separados por «_»
 *   cuerpo = ancho-hueco-hueco…   el ancho exterior del cuerpo en mm y sus huecos DE ABAJO ARRIBA, con «-»
 *   hueco  = tipo + alto          tipo: a = abierto · p = puerta · c = cajón · d = divisor vertical
 *                                 alto: alto libre nominal del hueco en mm (entre baldas)
 *
 *   Ejemplo: «600-p349-p349_800-c227-c227-c226_600-p716»
 *            → tres cuerpos: 600 mm con dos puertas, 800 mm con tres cajones y 600 mm con una puerta alta.
 *
 * Solo usa letras, cifras, «-» y «_», que viajan tal cual en una URL. Lectura tolerante (nunca lanza):
 * mayúsculas → minúsculas; también valen «|», «;» o «/» entre cuerpos y «,», «.», «:» o espacios entre
 * huecos; tipo desconocido → abierto; hueco sin alto → 300 mm; cuerpo sin ancho → 600 mm; cuerpo sin
 * huecos → un hueco abierto; anchos a 250–1000 mm, altos desde 120 mm; como mucho 5 cuerpos y 8 huecos por
 * cuerpo (lo que sobra se descarta); cadena vacía o ilegible → distribución por defecto.
 */

// ---------- límites y constantes ----------

export const LIM = { wMin: 250, wMax: 1000, hMin: 120, hMaxNominal: 2400, maxCuerpos: 5, maxHuecos: 8 } as const;
export type Tipo = 'a' | 'p' | 'c' | 'd';
export const TIPOS: Tipo[] = ['a', 'p', 'c', 'd'];
export const NOMBRE_TIPO: Record<Tipo, string> = { a: 'Abierto', p: 'Puerta', c: 'Cajón', d: 'Divisor' };
export interface Hueco { t: Tipo; h: number }
export interface Cuerpo { w: number; huecos: Hueco[] }

export const DEFAULT_LAYOUT = '600-p349-p349_800-c227-c227-c226_600-p716';

const TB = 6; // trasera y fondo de cajón: contrachapado de 6 mm
const P = 45; // sección de las patas (listón 45 × 45)
export const G = 3; // holgura entre frentes (1,5 mm en cada borde)
const CAJ = 15; // grueso de la caja del cajón (contrachapado)
const GUIA = 13; // hueco lateral para cada guía de cajón (medida de diseño: compruébala con tus guías)
const ES = 40; // escuadra antivuelco
const BIS: Vec3 = [12, 45, 50]; // bulto de una bisagra (para dibujarla)
/** Por encima de este ancho libre el hueco lleva puertas dobles (criterio de diseño). */
export const PUERTA_DOBLE = 600;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Lee la distribución de forma tolerante (ver el formato arriba). Nunca lanza. */
export function parseLayout(raw: unknown): Cuerpo[] {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  const out: Cuerpo[] = [];
  for (const chunk of s.split(/[_|;/]+/)) {
    if (out.length >= LIM.maxCuerpos) break;
    const toks = chunk.split(/[-:,.\s+]+/).filter(Boolean);
    if (!toks.length) continue;
    let w = 600;
    const conAncho = /^\d+$/.test(toks[0]);
    if (conAncho) w = Number(toks.shift());
    const huecos: Hueco[] = [];
    for (const t of toks) {
      if (huecos.length >= LIM.maxHuecos) break;
      const m = /^([a-z]?)(\d*)$/.exec(t);
      if (!m || (!m[1] && !m[2])) continue;
      const tipo = (TIPOS as string[]).includes(m[1]) ? (m[1] as Tipo) : 'a';
      const h = m[2] ? Number(m[2]) : 300;
      huecos.push({ t: tipo, h: clamp(Number.isFinite(h) ? h : 300, LIM.hMin, LIM.hMaxNominal) });
    }
    if (!huecos.length && !conAncho) continue; // trozo ilegible: se descarta
    if (!huecos.length) huecos.push({ t: 'a', h: 300 });
    out.push({ w: clamp(Math.round(Number.isFinite(w) ? w : 600), LIM.wMin, LIM.wMax), huecos });
  }
  return out.length ? out : parseLayout(DEFAULT_LAYOUT);
}

/** Escribe la distribución en su forma canónica. */
export function serializeLayout(c: Cuerpo[]): string {
  return c.map((b) => [Math.round(b.w), ...b.huecos.map((h) => `${h.t}${Math.round(h.h)}`)].join('-')).join('_');
}

// ---------- geometría compartida con el editor ----------

export type Base = 'zocalo' | 'patas' | 'ninguna';
export interface HuecoGeo { t: Tipo; /** cara superior de la balda de abajo */ y0: number; /** cara inferior de la balda de arriba */ y1: number; h: number }
export interface CuerpoGeo { x: number; w: number; huecos: HuecoGeo[]; /** cara inferior de cada balda intermedia */ baldas: number[] }
export interface Geo {
  T: number; H: number; D: number; base: Base; hb: number; tapa: boolean; vu: number;
  /** cara superior del techo de los cuerpos (bajo la tapa, si la hay) */
  yC: number; yInt0: number; yInt1: number; x0: number; W: number;
  cuerpos: CuerpoGeo[]; avisos: string[];
}

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? clamp(n, lo, hi) : d;
};
const isTrue = (v: unknown) => v === true || v === 'true' || v === '1';

/** Reparte `A` mm entre los pesos `w` sin bajar de `m`; enteros que suman exactamente `A`. */
function repartirAlto(w: number[], A: number, m: number): number[] {
  const n = w.length;
  const fijo = new Array<boolean>(n).fill(false);
  for (let it = 0; it < n; it++) {
    const libre = w.reduce((s, x, i) => (fijo[i] ? s : s + x), 0);
    const resto = A - m * fijo.filter(Boolean).length;
    let cambio = false;
    for (let i = 0; i < n; i++) if (!fijo[i] && libre > 0 && (w[i] * resto) / libre < m) { fijo[i] = true; cambio = true; }
    if (!cambio) break;
  }
  const libre = w.reduce((s, x, i) => (fijo[i] ? s : s + x), 0);
  const resto = A - m * fijo.filter(Boolean).length;
  const h = w.map((x, i) => (fijo[i] || libre <= 0 ? m : Math.round((x * resto) / libre)));
  const diff = A - h.reduce((s, x) => s + x, 0);
  let k = 0;
  for (let i = 1; i < n; i++) if (h[i] > h[k]) k = i;
  h[k] += diff;
  return h;
}

/** Medidas reales de todo el mueble a partir de los valores del configurador. La usan el generador y el editor. */
export function geometria(v: ParamValues): Geo {
  const avisos: string[] = [];
  const T = v.grueso === '22' ? 22 : 18;
  const H = num(v.alto, 850, 400, 2400);
  const D = num(v.fondo, 450, 250, 650);
  const base: Base = v.base === 'patas' || v.base === 'ninguna' ? v.base : 'zocalo';
  const tapa = isTrue(v.tapa);
  const vu = tapa ? num(v.vuelo, 20, 10, 40) : 0;
  const yC = H - (tapa ? T : 0);
  let hb = base === 'ninguna' ? 0 : num(v.altBase, 80, 40, 250);
  const hbMax = yC - 2 * T - LIM.hMin;
  if (hb > hbMax) {
    hb = Math.max(0, hbMax);
    avisos.push(`Con ${mm(H)} de alto, ${base === 'patas' ? 'las patas se quedan' : 'el zócalo se queda'} en ${mm(hb)} para que quepa al menos un hueco.`);
  }
  const yInt0 = hb + T, yInt1 = yC - T;
  const interior = yInt1 - yInt0;
  const x0 = vu;
  let x = x0;
  const cuerpos: CuerpoGeo[] = parseLayout(v.distribucion).map((c, i) => {
    const hs = c.huecos.map((q) => ({ ...q }));
    const antes = hs.length;
    while (hs.length > 1 && hs.length * LIM.hMin + (hs.length - 1) * T > interior) {
      const top = hs.pop()!;
      hs[hs.length - 1].h += top.h + T;
    }
    if (hs.length < antes) avisos.push(`Con este alto, en el cuerpo ${i + 1} no caben ${antes} huecos de al menos ${LIM.hMin} mm: se han unido los de arriba y quedan ${hs.length}.`);
    const alturas = repartirAlto(hs.map((q) => q.h), interior - (hs.length - 1) * T, LIM.hMin);
    let y = yInt0;
    const huecos: HuecoGeo[] = [];
    const baldas: number[] = [];
    hs.forEach((q, k) => {
      huecos.push({ t: q.t, y0: y, y1: y + alturas[k], h: alturas[k] });
      y += alturas[k];
      if (k < hs.length - 1) { baldas.push(y); y += T; }
    });
    const g: CuerpoGeo = { x, w: c.w, huecos, baldas };
    x += c.w;
    return g;
  });
  return { T, H, D, base, hb, tapa, vu, yC, yInt0, yInt1, x0, W: x - x0, cuerpos, avisos };
}

/** Distribución con los altos reales (útil para el editor: lo que se ve es lo que se guarda). */
export function layoutReal(geo: Geo): Cuerpo[] {
  return geo.cuerpos.map((c) => ({ w: c.w, huecos: c.huecos.map((h) => ({ t: h.t, h: h.h })) }));
}

// ---------- utilidades de texto ----------

/** Taladro piloto para madera blanda: ~70 % del núcleo (núcleo ≈ 2/3 del diámetro). Regla USDA. */
const piloto = (d: number) => Math.round(d * (2 / 3) * 0.7 * 2) / 2;
const fmtD = (d: number) => String(d).replace('.', ',');
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Letras de la lista de corte: A…Y y después Z1, Z2… (así la lista, que se ordena con comparación
 * numérica, sigue en orden: «AA» quedaría entre la A y la B).
 */
function letras() {
  const m = new Map<string, string>();
  const code = (i: number): string => (i < 25 ? String.fromCharCode(65 + i) : `Z${i - 24}`);
  return (k: string) => {
    if (!m.has(k)) m.set(k, code(m.size));
    return m.get(k)!;
  };
}

type Union = 'tornillo' | 'tubillon' | 'ranura';

// ---------- generador ----------

export const modular: Generator = {
  id: 'modular',
  title: 'Mueble modular',
  craft: 'carpinteria',
  difficulty: 2,
  description:
    'Mueble de tablero que se compone por cuerpos y huecos: aparadores, librerías, armarios bajos, muebles de TV, cómodas o zapateros. Cada hueco puede ir abierto, con puerta, con cajón o partido por un divisor.',
  params: [
    {
      key: 'distribucion', label: 'Cuerpos y huecos', type: 'custom', editor: 'layout', default: DEFAULT_LAYOUT, group: 'Distribución',
    },
    { key: 'alto', label: 'Alto total', type: 'number', min: 400, max: 2400, step: 10, unit: 'mm', default: 850, group: 'Medidas', help: 'Del suelo a lo más alto, tapa incluida. Los huecos se reparten el alto interior.' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 250, max: 650, step: 10, unit: 'mm', default: 450, group: 'Medidas', help: 'Fondo de los costados, trasera incluida. Puertas y frentes salen su grueso por delante.' },
    {
      key: 'material', label: 'Tablero', type: 'select', default: 'pino', group: 'Material',
      options: [
        { value: 'pino', label: 'Pino alistonado', hint: 'Madera maciza vista, para aceite o barniz' },
        { value: 'contrachapado', label: 'Contrachapado', hint: 'Estable, canto de capas a la vista' },
        { value: 'dm', label: 'DM para pintar', hint: 'Liso y estable; canto delicado con tornillos' },
      ],
    },
    {
      key: 'grueso', label: 'Grueso del tablero', type: 'select', default: '18', group: 'Material',
      options: [
        { value: '18', label: '18 mm', hint: 'Lo más habitual y ligero' },
        { value: '22', label: '22 mm', hint: 'Más rígido en baldas largas' },
      ],
    },
    {
      key: 'base', label: 'Apoyo en el suelo', type: 'select', default: 'zocalo', group: 'Base',
      options: [
        { value: 'zocalo', label: 'Zócalo', hint: 'Frente cerrado bajo el mueble' },
        { value: 'patas', label: 'Patas', hint: 'Listón 45 × 45, deja ver el suelo' },
        { value: 'ninguna', label: 'Directo al suelo', hint: 'La base apoya en el suelo' },
      ],
    },
    { key: 'altBase', label: 'Altura del zócalo o las patas', type: 'number', min: 40, max: 250, step: 5, unit: 'mm', default: 80, group: 'Base', visible: (v) => v.base !== 'ninguna' },
    { key: 'trasera', label: 'Trasera de contrachapado', type: 'boolean', default: true, group: 'Detalles', help: 'Cierra el fondo y, sobre todo, impide que cada cuerpo se descuadre.' },
    { key: 'tapa', label: 'Tapa superior con vuelo', type: 'boolean', default: true, group: 'Detalles', help: 'Un solo tablero encima de todos los cuerpos, que sobresale por los lados y por delante.' },
    { key: 'vuelo', label: 'Vuelo de la tapa', type: 'number', min: 10, max: 40, step: 5, unit: 'mm', default: 20, group: 'Detalles', visible: (v) => v.tapa === true },
    { key: 'antivuelco', label: 'Escuadras antivuelco', type: 'boolean', default: true, group: 'Detalles', help: 'Para sujetar el mueble a la pared. Imprescindibles si es alto o lleva cajones.' },
    {
      key: 'union', label: 'Unión de baldas y costados', type: 'select', default: 'tornillo', group: 'Uniones',
      options: [
        { value: 'tornillo', label: 'Tornillo visto con piloto', hint: 'Rápido y desmontable' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos a la vista' },
        { value: 'ranura', label: 'Ranura en el costado', hint: 'Baldas encajadas y encoladas, sin tornillos' },
      ],
    },
  ],
  presets: [
    {
      id: 'aparador', name: 'Aparador de tres cuerpos', blurb: 'Dos armarios con puerta y tres cajones en el centro; 2 m de largo, tapa con vuelo.',
      values: { distribucion: DEFAULT_LAYOUT, alto: 850, fondo: 450, material: 'pino', grueso: '18', base: 'zocalo', altBase: 80, trasera: true, tapa: true, vuelo: 20, antivuelco: true, union: 'tubillon' },
    },
    {
      id: 'libreria', name: 'Librería con puertas bajas', blurb: 'Dos cuerpos de 1,8 m: armario cerrado abajo y cuatro baldas abiertas arriba.',
      values: { distribucion: '800-p500-a280-a280-a270-a280_800-p500-a280-a280-a270-a280', alto: 1800, fondo: 320, material: 'contrachapado', grueso: '18', base: 'zocalo', altBase: 70, trasera: true, tapa: false, antivuelco: true, union: 'ranura' },
    },
    {
      id: 'comoda', name: 'Cómoda de cajones', blurb: 'Cuatro cajones con guías, de más alto a más bajo, sobre patas y en DM para pintar.',
      values: { distribucion: '900-c200-c172-c150-c150', alto: 900, fondo: 450, material: 'dm', grueso: '18', base: 'patas', altBase: 120, trasera: true, tapa: true, vuelo: 15, antivuelco: true, union: 'tornillo', tinte: 'salvia' },
    },
  ],
  dragAxes: { y: 'alto', z: 'fondo' },
  build,
};

function build(v: ParamValues) {
  const geo = geometria(v);
  const { T, H, D, base, hb, tapa, vu, yC, cuerpos, W } = geo;
  const mat: MaterialId = v.material === 'contrachapado' || v.material === 'dm' ? v.material : 'pino';
  const union: Union = v.union === 'tubillon' || v.union === 'ranura' ? v.union : 'tornillo';
  const trasera = isTrue(v.trasera);
  const anti = isTrue(v.antivuelco);
  const ztb = trasera ? TB : 0; // cara trasera de la caja (la trasera va detrás)
  const dc = D - ztb; // fondo de costados y baldas
  const RAN = Math.round(T / 3); // profundidad de la ranura: un tercio del costado
  const nz = dc >= 300 ? 3 : 2;
  const zs = (m: number, k = nz) => repartir(ztb + m, D - m, k);
  const frentes = cuerpos.some((c) => c.huecos.some((h) => h.t === 'p' || h.t === 'c'));
  const Dext = D + (frentes ? T : 0); // fondo con los frentes
  const L = letras();
  const b = new Builder();
  const matName = mat === 'pino' ? 'pino alistonado' : mat === 'dm' ? 'DM' : 'contrachapado';

  // Largo de los cajones: múltiplo de 50 mm que deja sitio a la escuadra antivuelco detrás.
  const Ld = Math.max(150, Math.floor((dc - ES - 5) / 50) * 50);

  // tornillería según grueso
  const dTor = T === 18 ? 3.5 : 4;
  const torUnion = T === 18 ? 'Tornillo para madera de cabeza avellanada 3,5 × 45 mm' : 'Tornillo para madera de cabeza avellanada 4 × 50 mm';
  const torCorto = T === 18 ? 'Tornillo para madera de cabeza avellanada 3,5 × 30 mm' : 'Tornillo para madera de cabeza avellanada 4 × 35 mm';
  const torPata = T === 18 ? 'Tornillo para madera de cabeza avellanada 4 × 50 mm' : 'Tornillo para madera de cabeza avellanada 4 × 60 mm';
  const tubLargo = T === 18 ? 30 : 35;
  const tub = `Tubillón estriado de haya Ø8 × ${tubLargo} mm`;
  const profTub = T === 18 ? 12 : 15; // en el costado, sin atravesarlo

  // ===================== piezas =====================
  interface PiezasCuerpo { ids: string[]; legs: string[]; marks: Mark[]; nUnion: number; nZoc: number; nPata: number; nDiv: number }
  const porCuerpo: PiezasCuerpo[] = [];
  const traseras: string[] = [];
  const cajas: { ids: string[]; marks: Mark[]; nEsq: number; nFondo: number; nGuia: number }[] = [];
  const frentesCaj: { ids: string[]; marks: Mark[] }[] = [];
  const puertas: { ids: string[]; marks: Mark[]; nBis: number }[] = [];
  const escuadras: string[] = [];
  const marksTrasera: Mark[] = [];
  const marksEsc: Mark[] = [];
  const marksPared: Mark[] = [];
  let nCajones = 0, nPuertas = 0, nBisagras = 0, nTiradores = 0;
  const ys0 = base === 'patas' ? hb : 0; // pie de los costados
  const hCost = yC - ys0;
  const fij = (pts: Vec3[], axis: 'x' | 'y' | 'z'): Mark[] => (union === 'tornillo' ? tornillos(pts, axis) : espigas(pts, axis));
  const conRanura = (id: string, extra: number) => {
    if (union !== 'ranura') return;
    const p = b.parts.find((q) => q.id === id)!;
    p.cut = [p.cut[0] + extra, p.cut[1], p.cut[2]].sort((a, c) => c - a) as Vec3;
    p.note = `Incluye ${RAN} mm por cada extremo que entran en la ranura.`;
  };

  cuerpos.forEach((c, i) => {
    const xi = c.x, wi = c.w, wI = wi - 2 * T, xL = xi + T, xR = xi + wi - T;
    const ids: string[] = [];
    const legs: string[] = [];
    const marks: Mark[] = [];
    let nUnion = 0, nZoc = 0, nPata = 0, nDiv = 0;
    ids.push(b.panel({ ref: L(`costado|${hCost}|${dc}`), name: 'Costado', material: mat, thickness: T, face: [hCost, dc], normal: 'x', at: [xi, ys0, ztb], grain: 'y' }));
    const hor = (name: string, key: string, y: number) => {
      const id = b.panel({ ref: L(`${key}|${wI}|${dc}`), name, material: mat, thickness: T, face: [wI, dc], normal: 'y', at: [xL, y, ztb], grain: 'x' });
      conRanura(id, 2 * RAN);
      ids.push(id);
      if (union !== 'ranura') {
        const m = fij([xL, xR].flatMap((x) => zs(35).map((z): Vec3 => [x, y + T / 2, z])), 'x');
        marks.push(...m);
        nUnion += m.length;
      }
    };
    hor('Base del cuerpo', 'base', hb);
    c.baldas.forEach((y) => hor('Balda', 'balda', y));
    hor('Techo del cuerpo', 'techo', yC - T);
    // divisores
    c.huecos.forEach((h) => {
      if (h.t !== 'd') return;
      const xd = xi + wi / 2 - T / 2;
      const id = b.panel({ ref: L(`divisor|${h.h}|${dc}`), name: 'Divisor', material: mat, thickness: T, face: [h.h, dc], normal: 'x', at: [xd, h.y0, ztb], grain: 'y' });
      conRanura(id, 2 * RAN);
      ids.push(id);
      if (union !== 'ranura') {
        const m = fij([h.y0, h.y1].flatMap((y) => zs(50, 2).map((z): Vec3 => [xd + T / 2, y, z])), 'y');
        marks.push(...m);
        nDiv += m.length;
      }
    });
    // zócalo: frente y travesaño trasero entre costados, bajo la base
    if (base === 'zocalo') {
      for (const z of [D - T, ztb]) {
        ids.push(b.panel({ ref: L(`zocalo|${wI}|${hb}`), name: 'Zócalo (delante y detrás)', material: mat, thickness: T, face: [wI, hb], normal: 'z', at: [xL, 0, z], grain: 'x' }));
        const yz = hb >= 70 ? [hb / 3, (2 * hb) / 3] : [hb / 2];
        const m = (union === 'tornillo' ? tornillos : espigas)([xL, xR].flatMap((x) => yz.map((y): Vec3 => [x, y, z + T / 2])), 'x');
        marks.push(...m);
        nZoc += m.length;
      }
    }
    ids.push(b.panel({ ref: L(`costado|${hCost}|${dc}`), name: 'Costado', material: mat, thickness: T, face: [hCost, dc], normal: 'x', at: [xR, ys0, ztb], grain: 'y' }));
    // patas: bajo cada esquina, recogiendo el costado y la base
    if (base === 'patas') {
      for (const [xp, xs] of [[xi, xL + (P - T) / 2], [xi + wi - P, xR - (P - T) / 2]] as const) {
        for (const zp of [ztb + 10, D - 10 - P]) {
          legs.push(b.liston({ ref: L(`pata|${hb}`), name: 'Pata', section: [P, P], length: hb, axis: 'y', at: [xp, 0, zp] }));
          const m = tornillos([[xs, hb + T, zp + P / 2 - 10], [xs, hb + T, zp + P / 2 + 10]], 'y');
          marks.push(...m);
          nPata += m.length;
        }
      }
    }
    porCuerpo.push({ ids, legs, marks, nUnion, nZoc, nPata, nDiv });

    // trasera
    if (trasera) {
      traseras.push(b.panel({ ref: L(`trasera|${wi}|${hCost}`), name: 'Trasera', material: 'contrachapado', thickness: TB, face: [wi, hCost], normal: 'z', at: [xi, ys0, 0] }));
      const nV = Math.max(3, Math.round(hCost / 300) + 1);
      marksTrasera.push(...tornillos([xi + T / 2, xi + wi - T / 2].flatMap((x) => repartir(ys0 + 40, yC - 40, nV).map((y): Vec3 => [x, y, ztb])), 'z'));
      const nH = Math.max(1, Math.round(wI / 280));
      const xsInt = Array.from({ length: nH }, (_, k) => xL + (wI * (k + 1)) / (nH + 1));
      const ysH = [hb + T / 2, ...c.baldas.map((y) => y + T / 2), yC - T / 2];
      marksTrasera.push(...tornillos(ysH.flatMap((y) => xsInt.map((x): Vec3 => [x, y, ztb])), 'z'));
    }

    // escuadras antivuelco bajo el techo, en la esquina trasera
    if (anti) {
      const xs = cuerpos.length === 1 ? [xL, xR - ES] : [xL];
      for (const x of xs) {
        escuadras.push(b.herraje({ ref: L('escuadra'), name: 'Escuadra antivuelco', size: [ES, ES, ES], at: [x, yC - T - ES, ztb], stock: 'Escuadra de acero de 40 × 40 mm con agujeros' }));
        marksEsc.push(...tornillos([[x + 12, yC - T, ztb + 25], [x + 28, yC - T, ztb + 25]], 'y'));
        marksPared.push(...tornillos([[x + ES / 2, yC - T - ES / 2, 0]], 'z'));
      }
    }

    // frentes
    const n = c.huecos.length;
    const fx0 = xi + G / 2, fx1 = xi + wi - G / 2;
    c.huecos.forEach((h, k) => {
      if (h.t !== 'p' && h.t !== 'c') return;
      const fy0 = k === 0 ? hb + (hb === 0 ? 5 : G / 2) : h.y0 - T / 2 + G / 2;
      const fy1 = k === n - 1 ? yC - G / 2 : h.y1 + T / 2 - G / 2;
      const fh = fy1 - fy0;
      if (h.t === 'c') {
        nCajones++;
        const fw = fx1 - fx0;
        const ids2: string[] = [];
        const mk: Mark[] = [];
        // caja del cajón
        const bx0 = xL + GUIA, bx1 = xR - GUIA, bw = bx1 - bx0;
        const hbox = Math.max(60, h.h - 30);
        const yb0 = h.y0 + 12;
        const hs = hbox - TB;
        const z0 = D - Ld;
        ids2.push(b.panel({ ref: L(`fondocaj|${bw}|${Ld}`), name: 'Fondo de cajón', material: 'contrachapado', thickness: TB, face: [bw, Ld], normal: 'y', at: [bx0, yb0, z0] }));
        for (const xs of [bx0, bx1 - CAJ]) ids2.push(b.panel({ ref: L(`latcaj|${hs}|${Ld}`), name: 'Lateral de cajón', material: 'contrachapado', thickness: CAJ, face: [hs, Ld], normal: 'x', at: [xs, yb0 + TB, z0], grain: 'z' }));
        ids2.push(b.panel({ ref: L(`delcaj|${bw - 2 * CAJ}|${hs}`), name: 'Delantera y trasera de cajón', material: 'contrachapado', thickness: CAJ, face: [bw - 2 * CAJ, hs], normal: 'z', at: [bx0 + CAJ, yb0 + TB, D - CAJ], grain: 'x' }));
        ids2.push(b.panel({ ref: L(`delcaj|${bw - 2 * CAJ}|${hs}`), name: 'Delantera y trasera de cajón', material: 'contrachapado', thickness: CAJ, face: [bw - 2 * CAJ, hs], normal: 'z', at: [bx0 + CAJ, yb0 + TB, z0], grain: 'x' }));
        const yEsq = hs >= 90 ? [yb0 + TB + hs / 3, yb0 + TB + (2 * hs) / 3] : [yb0 + TB + hs / 2];
        const mEsq = tornillos([bx0 + CAJ, bx1 - CAJ].flatMap((x) => [D - CAJ / 2, z0 + CAJ / 2].flatMap((z) => yEsq.map((y): Vec3 => [x, y, z]))), 'x');
        const mFondo = tornillos([bx0 + CAJ / 2, bx1 - CAJ / 2].flatMap((x) => repartir(z0 + 30, D - 30, 3).map((z): Vec3 => [x, yb0 + TB, z])), 'y');
        // guías
        const yg = yb0 + TB + hs / 2 - 17.5;
        for (const xg of [xL, xR - GUIA]) ids2.push(b.herraje({ ref: L(`guia|${Ld}`), name: 'Guía de cajón', size: [GUIA, 35, Ld], at: [xg, yg, z0], stock: `Guía telescópica de cajón de ${Ld} mm (se venden por parejas)` }));
        const mGuia = tornillos([xL, xR].flatMap((x) => repartir(z0 + 30, D - 30, 3).map((z): Vec3 => [x, yg + 17.5, z])), 'x');
        mk.push(...mEsq, ...mFondo, ...mGuia);
        cajas.push({ ids: ids2, marks: mk, nEsq: mEsq.length, nFondo: mFondo.length, nGuia: mGuia.length * 2 });
        // frente y tirador
        const fr = b.panel({ ref: L(`frente|${fw}|${fh}`), name: 'Frente de cajón', material: mat, thickness: T, face: [fw, fh], normal: 'z', at: [fx0, fy0, D], grain: 'x' });
        const tl = Math.min(140, Math.round(fw * 0.4));
        const tir = b.herraje({ ref: L(`tirador|${tl}`), name: 'Tirador', size: [tl, 14, 22], at: [fx0 + fw / 2 - tl / 2, fy0 + fh / 2 - 7, D + T], stock: `Tirador para mueble de unos ${tl} mm, con sus tornillos` });
        nTiradores++;
        const mFr = tornillos(repartir(bx0 + CAJ + 30, bx1 - CAJ - 30, 2).flatMap((x) => [yb0 + TB + hs * 0.3, yb0 + TB + hs * 0.7].map((y): Vec3 => [x, y, D])), 'z');
        frentesCaj.push({ ids: [fr, tir], marks: mFr });
      } else {
        const dobles = wI > PUERTA_DOBLE;
        const hojas: [number, number, 'izq' | 'der'][] = dobles
          ? [[fx0, (fx0 + fx1) / 2 - G / 2, 'izq'], [(fx0 + fx1) / 2 + G / 2, fx1, 'der']]
          : [[fx0, fx1, i === cuerpos.length - 1 && cuerpos.length > 1 ? 'der' : 'izq']];
        const ids2: string[] = [];
        const mk: Mark[] = [];
        let nB = 0;
        for (const [a0, a1, lado] of hojas) {
          nPuertas++;
          const pw = a1 - a0;
          ids2.push(b.panel({ ref: L(`puerta|${pw}|${fh}`), name: 'Puerta', material: mat, thickness: T, face: [pw, fh], normal: 'z', at: [a0, fy0, D], grain: 'y' }));
          // bisagras en el costado del lado de giro
          const nb = fh <= 900 ? 2 : fh <= 1500 ? 3 : 4;
          let ys = repartir(fy0 + 100, fy1 - 100, nb).map((y) => clamp(y, h.y0 + BIS[1] / 2 + 3, h.y1 - BIS[1] / 2 - 3));
          if (ys.some((y, j) => j > 0 && y - ys[j - 1] < BIS[1] + 5)) ys = repartir(h.y0 + BIS[1] / 2 + 3, h.y1 - BIS[1] / 2 - 3, nb);
          const xb = lado === 'izq' ? xL : xR - BIS[0];
          for (const y of ys) {
            ids2.push(b.herraje({ ref: L('bisagra'), name: 'Bisagra', size: BIS, at: [xb, y - BIS[1] / 2, D - BIS[2]], stock: 'Bisagra de cazoleta para puerta superpuesta, con su base' }));
            mk.push(...tornillos([[lado === 'izq' ? xL : xR, y, D - 40], [lado === 'izq' ? xL : xR, y, D - 15]], 'x'));
          }
          nB += ys.length;
          // tirador vertical junto al canto que abre
          const tl = Math.round(clamp(fh * 0.45, 60, 160));
          const xt = lado === 'izq' ? a1 - 40 - 7 : a0 + 40 - 7;
          const centro = (fy0 + fy1) / 2;
          const yt = centro < 1000 ? fy1 - 50 - tl : centro > 1300 ? fy0 + 50 : clamp(1000 - tl / 2, fy0 + 20, fy1 - 20 - tl);
          ids2.push(b.herraje({ ref: L(`tiradorP|${tl}`), name: 'Tirador', size: [14, tl, 22], at: [xt, Math.max(fy0 + 10, yt), D + T], stock: `Tirador para mueble de unos ${tl} mm, con sus tornillos` }));
          nTiradores++;
        }
        nBisagras += nB;
        puertas.push({ ids: ids2, marks: mk, nBis: nB });
      }
    });
  });

  // tapa con vuelo: un solo tablero sobre todos los cuerpos
  const Wtapa = W + 2 * vu, Dtapa = Dext + vu;
  const tapaId = tapa ? b.panel({ ref: L('tapa'), name: 'Tapa', material: mat, thickness: T, face: [Wtapa, Dtapa], normal: 'y', at: [0, yC, 0], grain: 'x' }) : '';
  const marksTapa: Mark[] = tapa
    ? tornillos(cuerpos.flatMap((c) => repartir(c.x + T + 40, c.x + c.w - T - 40, 2).flatMap((x) => zs(40, 3).map((z): Vec3 => [x, yC, z]))), 'y')
    : [];

  // uniones entre cuerpos: tornillos por dentro del costado derecho de cada cuerpo
  const marksUnir: Mark[] = cuerpos.slice(0, -1).flatMap((c) => {
    const xj = c.x + c.w - T;
    return tornillos(repartir(ys0 + 80, yC - 80, 3).flatMap((y) => [ztb + 50, D - 50].map((z): Vec3 => [xj, y, z])), 'x');
  });

  // ===================== textos =====================
  const pilotT = piloto(dTor), pilot3 = piloto(3), pilot35 = piloto(3.5), pilot4 = piloto(4);
  const tecTornillo = {
    name: 'Tornillo visto con taladro piloto y avellanado',
    why: 'El tornillo atraviesa el costado y muerde en la testa de la balda. Es la forma más directa de montar una caja: sin cola ni plantillas, desmontable y con las cabezas enrasadas gracias al avellanado.',
    how: [
      `Taladra el costado con una broca de paso del diámetro del tornillo (${fmtD(dTor)} mm), para que la rosca solo agarre en la balda.`,
      `En la testa de la balda haz un piloto de unos ${fmtD(pilotT)} mm: la USDA recomienda en madera blanda en torno al 70 % del núcleo del tornillo, que es unos 2/3 de su diámetro.`,
      'Avellana la entrada hasta que la cabeza quede enrasada, sin pasarte.',
      'Atornilla sin forzar: para en cuanto la cabeza asiente.',
    ],
  };
  const tecTubillon = {
    name: 'Tubillones encolados',
    why: 'Los tubillones alinean balda y costado y dan superficie de encolado. Por fuera los costados quedan limpios, sin ninguna cabeza de tornillo. Ø8 mm cumple la pauta de Fine Woodworking de un tercio a la mitad del grueso de la pieza.',
    how: [
      'Marca los centros en la testa de cada balda, siempre midiendo desde el canto delantero, y taládralos en el centro del grueso.',
      'Pon marcadores de tubillón, presenta la balda en su línea del costado y aprieta: quedan marcados los centros en el costado.',
      `Taladra el costado a ${profTub} mm como máximo con tope de profundidad: con ${T} mm de grueso, más hondo lo atravesarías.`,
      'Monta en seco; luego cola dentro de los agujeros (no sobre el tubillón), cierra con sargentos y limpia lo que rebose con un paño húmedo.',
    ],
  };
  const tecRanura = {
    name: 'Ranura en el costado',
    why: 'Cada balda, la base y el techo entran en una ranura abierta en la cara interior del costado. La ranura sostiene la balda en todo su fondo, deja la caja a escuadra sola y no necesita tornillos: solo cola.',
    how: [
      'Traza las ranuras de los dos costados de cada cuerpo a la vez, juntándolos con sargentos.',
      `Ancho de la ranura: el grueso real de tu tablero (mídelo, unos ${T} mm). Profundidad: ${RAN} mm, un tercio del costado.`,
      'Ábrela con fresadora y regla guía, o con varias pasadas de sierra circular a la profundidad justa limpiando el fondo con formón.',
      'Prueba antes en un recorte: la balda debe entrar a mano con ajuste firme, sin golpearla.',
    ],
  };
  const tec = union === 'tornillo' ? tecTornillo : union === 'tubillon' ? tecTubillon : tecRanura;
  let colaPuesta = false;
  const colaOnce = (): HardwareLine[] => (colaPuesta ? [] : ((colaPuesta = true), [hw('Cola blanca para madera (PVA)', 1, 'bote')]));
  const toolsUnion = union === 'tornillo'
    ? ['Taladro atornillador', `Broca para madera de ${fmtD(dTor)} mm (paso) y de ${fmtD(pilotT)} mm (piloto)`, 'Broca de avellanar']
    : union === 'tubillon'
      ? ['Taladro', 'Broca para madera de 8 mm con tope de profundidad', 'Marcadores de tubillón de 8 mm', 'Sargentos']
      : ['Fresadora con fresa recta o sierra circular', 'Regla guía y sargentos', 'Formón de 20 mm'];
  const hwUnion = (k: number): HardwareLine[] => (k === 0 ? [] : union === 'tornillo' ? [hw(torUnion, k)] : [hw(tub, k), ...colaOnce()]);
  const pared = 'Taco y tornillo adecuados a tu pared (ladrillo, hormigón o pladur): pregúntalo en la tienda llevando el dato de la pared';
  const alto = H >= 1200;
  const nHuecos = cuerpos.reduce((s, c) => s + c.huecos.length, 0);
  const nDivs = cuerpos.reduce((s, c) => s + c.huecos.filter((h) => h.t === 'd').length, 0);

  // ===================== pasos =====================
  const anchos = cuerpos.map((c) => c.w).join(' + ');
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: `Deja cada pieza a su medida y con su letra: ${plural(cuerpos.length, 'cuerpo', 'cuerpos')} de ${anchos} mm.`,
    detail: [
      'Repasa la lista de corte: las medidas son finales. Si te cortan el tablero en la tienda, lleva la lista impresa.',
      `Corta los ${cuerpos.length * 2} costados a ${mm(hCost)} × ${mm(dc)} con un tope, para que salgan idénticos.`,
      `Base, techo y baldas de cada cuerpo miden el ancho del cuerpo menos dos gruesos de tablero (${mm(2 * T)})${union === 'ranura' ? `, más ${mm(2 * RAN)} que entran en las ranuras` : ''}.`,
      ...(frentes ? [`Puertas y frentes de cajón se cortan ${G} mm más estrechos que el cuerpo que tapan (${fmtD(G / 2)} mm por lado): es la holgura entre frentes.`] : []),
      'Escribe la letra de cada pieza en una cara que no se vaya a ver y marca qué canto va delante.',
      ...(mat === 'pino' ? ['En el pino alistonado, deja la veta de costados y puertas en vertical y la de baldas y tapa a lo largo.'] : []),
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz', 'Sierra circular con guía o sierra de mesa', 'Sargentos'],
    check: 'Junta los costados de cada cuerpo cara con cara: deben coincidir en todo el contorno.',
    tip: frentes ? 'Corta los frentes al final, de una misma tabla y seguidos, para que la veta o el tono casen de un frente a otro.' : 'Elige las piezas más rectas para los costados.',
  });

  const alturasCuerpo = cuerpos.map((c, i) => `${cuerpos.length > 1 ? `cuerpo ${i + 1}: ` : ''}${[hb, ...c.baldas, yC - T].map((y) => Math.round(y - ys0)).join(', ')} mm`);
  b.step({
    kind: 'preparar',
    title: union === 'ranura' ? 'Traza y abre las ranuras' : 'Traza y taladra los costados',
    summary: 'Los dos costados de cada cuerpo se trazan juntos para que las baldas queden horizontales.',
    detail: [
      'Junta los dos costados de un cuerpo con sargentos, a ras por abajo y con las caras interiores hacia arriba.',
      `Mide siempre desde el pie del costado y traza con escuadra la cara inferior de cada pieza horizontal (${alturasCuerpo.join('; ')}).`,
      ...(union === 'ranura'
        ? [
            ...tecRanura.how.slice(1),
            `La ranura del techo${base === 'patas' || base === 'ninguna' ? ' y la de la base quedan' : ' queda'} abierta por el extremo del costado: es un galce y se abre igual.`,
            ...(base === 'zocalo' ? [`El zócalo no va en ranura: se une a los costados con tubillones de Ø8 mm, taladrados a ${profTub} mm en el costado.`] : []),
          ]
        : union === 'tubillon'
          ? [`Marca en el costado ${nz} tubillones por pieza, repartidos en el fondo, y taládralos a ${profTub} mm con tope.`]
          : [`Marca ${nz} tornillos por pieza sobre el centro de cada línea, repartidos en el fondo, y taladra desde la cara interior con la broca de paso de ${fmtD(dTor)} mm.`, 'Avellana después por la cara exterior.']),
      ...(nDivs ? [`Los divisores se fijan a las baldas de arriba y abajo: traza también su línea en el centro de esas baldas.`] : []),
    ],
    parts: [],
    technique: union === 'ranura' ? tecRanura : undefined,
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz afilado o cuchilla de marcar', 'Sargentos', ...toolsUnion],
    tip: 'Haz una regla-plantilla con un listón y las alturas marcadas: es más fiable que medir cada vez con el flexómetro.',
    ...(union === 'ranura' ? { warning: 'Con la fresadora: pieza bien sujeta, gafas y protección auditiva, y avanza siempre contra el giro de la fresa.' } : {}),
  });

  cuerpos.forEach((c, i) => {
    const pc = porCuerpo[i];
    const tipos = c.huecos.map((h) => NOMBRE_TIPO[h.t].toLowerCase());
    const hwBody: HardwareLine[] = [
      ...hwUnion(pc.nUnion + pc.nDiv),
      ...(pc.nZoc ? (union === 'tornillo' ? [hw(torUnion, pc.nZoc)] : [hw(tub, pc.nZoc), ...colaOnce()]) : []),
      ...(union === 'ranura' ? colaOnce() : []),
      ...(pc.nPata ? [hw(torPata, pc.nPata)] : []),
    ];
    b.step({
      kind: 'montar',
      title: cuerpos.length > 1 ? `Monta el cuerpo ${i + 1}` : 'Monta el cuerpo',
      summary: `Una caja de ${mm(c.w)} de ancho con ${plural(c.huecos.length, 'hueco', 'huecos')} (de abajo arriba: ${tipos.join(', ')}).`,
      detail: [
        'Tumba un costado en el suelo sobre una manta, con la cara interior hacia arriba.',
        union === 'ranura'
          ? 'Pon cola en las ranuras y en las testas, y encaja de pie la base, las baldas y el techo, con el canto delantero a ras del costado.'
          : union === 'tubillon'
            ? 'Encola los tubillones en las testas de base, baldas y techo y preséntalas de pie sobre sus agujeros, sin cerrar del todo.'
            : `Pon de pie base, baldas y techo sobre sus líneas, a ras por delante, y atornilla desde fuera del costado con piloto de ${fmtD(pilotT)} mm en la testa.`,
        ...(base === 'zocalo' ? [`Las dos tablas del zócalo van bajo la base, una a ras por delante y otra a ras por detrás: las dos de ${mm(hb)} de alto.`] : []),
        'Baja el segundo costado encima, encajando todo a la vez desde un extremo, y fíjalo igual.',
        ...(pc.nDiv || (union === 'ranura' && c.huecos.some((h) => h.t === 'd'))
          ? [union === 'ranura' ? 'Los divisores entran en una ranura abierta en las baldas de arriba y abajo: encólalos al cerrar la caja.' : `Coloca ${c.huecos.filter((h) => h.t === 'd').length > 1 ? 'los divisores' : 'el divisor'} centrado en su hueco y fíjalo a través de la balda de abajo y la de arriba.`]
          : []),
        ...(base === 'patas' ? [`Con la caja boca abajo, presenta las cuatro patas de ${mm(hb)} en las esquinas, a ras del costado, y fíjalas con cola y dos tornillos cada una desde dentro de la base.`] : []),
        'Antes de que agarre la cola, mide las dos diagonales del frente y empuja hasta igualarlas.',
      ],
      parts: [...pc.ids, ...pc.legs],
      marks: pc.marks,
      technique: i === 0 ? tec : undefined,
      hardware: hwBody,
      tools: [...toolsUnion, 'Escuadra de carpintero', 'Sargentos largos', 'Manta o cartón para proteger'],
      check: 'Las dos diagonales del frente deben ser iguales y todas las baldas a ras por delante.',
      warning: union !== 'tornillo' ? 'Deja la caja tumbada y a escuadra hasta que la cola cure; no la levantes antes.' : undefined,
      tip: i > 0 ? 'Los cuerpos se montan todos igual: si te ha salido bien el primero, repite el mismo orden.' : undefined,
    });
  });

  if (cuerpos.length > 1) {
    b.step({
      kind: 'montar',
      title: 'Une los cuerpos',
      summary: `Los ${cuerpos.length} cuerpos se atornillan costado con costado por dentro: por fuera no se ve ningún tornillo.`,
      detail: [
        'Pon los cuerpos de pie en su orden, juntos y sobre un suelo plano.',
        'Enrásalos por delante y por arriba y sujétalos con sargentos en el canto delantero.',
        `Atornilla desde dentro de un cuerpo al de al lado: ${marksUnir.length / (cuerpos.length - 1)} tornillos por unión, con piloto de ${fmtD(piloto(T === 18 ? 3.5 : 4))} mm. El tornillo es más corto que los dos costados juntos (${mm(2 * T)}), así que no asoma.`,
        'Si el suelo no es plano, calza primero los cuerpos para que queden a la misma altura.',
      ],
      parts: [],
      marks: marksUnir,
      hardware: [hw(torCorto, marksUnir.length)],
      tools: ['Taladro atornillador', `Broca de ${fmtD(piloto(T === 18 ? 3.5 : 4))} mm`, 'Sargentos', 'Nivel de burbuja'],
      check: 'Pasa la mano por el frente y por arriba: los cantos de los cuerpos deben quedar a ras, sin escalón.',
      tip: 'Por qué costados dobles: cada cuerpo es una caja completa que se monta, escuadra y mueve por separado. Gasta un costado más por unión, pero todo se monta igual y es mucho más fácil de transportar.',
    });
  }

  if (trasera) {
    b.step({
      kind: 'montar',
      title: 'Escuadra y fija las traseras',
      summary: 'Cada trasera bloquea su cuerpo a escuadra: es lo que da rigidez de lado a lado.',
      detail: [
        'Tumba el mueble boca abajo sobre una manta (con ayuda si es largo).',
        'Mide las dos diagonales de la parte de atrás de cada cuerpo y empuja la esquina larga hasta que coincidan.',
        `Apoya cada trasera a ras con los cantos exteriores de su cuerpo y fíjala primero en dos esquinas opuestas; vuelve a medir y completa el contorno y las baldas: ${marksTrasera.length} tornillos en total.`,
        `Haz taladros piloto de ${fmtD(pilot3)} mm: el canto de una balda de ${T} mm ${mat === 'dm' ? 'de DM se abre' : 'se raja'} con facilidad.`,
      ],
      parts: traseras,
      marks: marksTrasera,
      technique: {
        name: 'Trasera atornillada como arriostrado',
        why: 'Un tablero fino atornillado en todo su contorno forma triángulos indeformables con cada esquina: la caja ya no se puede descuadrar de lado. Por eso se escuadra justo antes de fijarla.',
        how: [
          'Escuadra midiendo diagonales.',
          'Fija dos esquinas opuestas, comprueba de nuevo y completa el perímetro y las baldas.',
          `Longitud del tornillo: Spax propone para uniones no estructurales unas 3 veces el grueso de la pieza que se sujeta (${TB} mm → unos 20 mm).`,
        ],
      },
      hardware: [hw('Tornillo para madera de cabeza plana 3 × 20 mm', marksTrasera.length)],
      tools: ['Atornillador', `Broca de ${fmtD(pilot3)} mm`, 'Flexómetro', 'Manta o cartón para proteger'],
      check: 'Las diagonales de cada cuerpo deben ser iguales antes del primer tornillo.',
    });
  } else {
    b.step({
      kind: 'montar',
      title: 'Pon de pie y comprueba la escuadra',
      summary: 'Sin trasera, la escuadra solo depende de las uniones: revísala bien.',
      detail: [
        'Pon el mueble de pie en su sitio y mide las dos diagonales del frente de cada cuerpo.',
        'Si no coinciden, empuja en diagonal la esquina más larga hasta igualarlas.',
        'Comprueba con el nivel que las baldas quedan horizontales; si el suelo no es plano, calza.',
      ],
      parts: [],
      tools: ['Flexómetro', 'Nivel de burbuja'],
      warning: 'Sin trasera el mueble puede descuadrarse de lado con el uso, y las puertas dejarían de cerrar bien. Si lo notas, añade una trasera.',
    });
  }

  if (tapa) {
    b.step({
      kind: 'montar',
      title: 'Coloca la tapa con vuelo',
      summary: `Un solo tablero de ${mm(Wtapa)} × ${mm(Dtapa)} cubre todos los cuerpos y sobresale ${mm(vu)}.`,
      detail: [
        'Con el mueble de pie, apoya la tapa encima, a ras por detrás.',
        `Centra el vuelo: ${mm(vu)} por cada lado y ${mm(vu)} por delante${frentes ? ' de las puertas y frentes' : ''}.`,
        `Atornilla desde dentro, a través del techo de cada cuerpo: ${marksTapa.length} tornillos cortos que no llegan a asomar por la tapa.`,
        ...(Wtapa > 2000 ? ['Una tapa tan larga puede no salir de un solo tablero: si no lo encuentras, hazla en dos piezas que se junten justo encima de la unión de dos cuerpos.'] : []),
      ],
      parts: [tapaId],
      marks: marksTapa,
      hardware: [hw(torCorto, marksTapa.length)],
      tools: ['Taladro atornillador', `Broca de ${fmtD(piloto(T === 18 ? 3.5 : 4))} mm`, 'Sargentos'],
      tip: mat === 'pino' ? 'En el pino alistonado, deja los taladros del techo algo holgados: la tapa maciza se mueve con la humedad a lo ancho de la veta.' : undefined,
    });
  }

  if (anti) {
    b.step({
      kind: 'montar',
      title: 'Atornilla las escuadras antivuelco',
      summary: `${plural(escuadras.length, 'escuadra', 'escuadras')} bajo el techo sujetarán el mueble a la pared.`,
      detail: [
        'Atornilla cada escuadra bajo el techo, en la esquina de atrás, con dos tornillos.',
        'El ala vertical queda contra la trasera: el tornillo a la pared la atravesará.',
        'No la fijes todavía a la pared: eso se hace al final, con el mueble acabado y en su sitio.',
      ],
      parts: escuadras,
      marks: marksEsc,
      hardware: [hw('Tornillo para madera de cabeza plana 4 × 16 mm', marksEsc.length)],
      tools: ['Atornillador', `Broca de ${fmtD(pilot4)} mm`],
      warning: nCajones
        ? 'Un mueble con cajones puede volcar hacia delante si se abren varios a la vez o si un niño trepa por ellos. Ánclalo siempre a la pared.'
        : 'Un mueble alto o cargado arriba puede volcar. Ánclalo a la pared.',
    });
  }

  if (cajas.length) {
    const allIds = cajas.flatMap((q) => q.ids);
    const nEsq = cajas.reduce((s, q) => s + q.nEsq, 0), nFondo = cajas.reduce((s, q) => s + q.nFondo, 0), nGuia = cajas.reduce((s, q) => s + q.nGuia, 0);
    b.step({
      kind: 'montar',
      title: 'Monta los cajones y sus guías',
      summary: `${plural(cajas.length, 'caja de cajón', 'cajas de cajón')} de contrachapado de ${CAJ} mm, cada una sobre una pareja de guías telescópicas.`,
      detail: [
        'Compra las guías ANTES de cortar los cajones y lee su ficha: dice cuánto hueco piden a cada lado.',
        `Aquí se ha dejado ${GUIA} mm por lado entre la caja y el costado (medida de diseño): si tus guías piden otra cosa, corrige el ancho del fondo y de la delantera y trasera del cajón.`,
        `Arma cada caja: los laterales por fuera de la delantera y la trasera, con cola y tornillos (piloto de ${fmtD(pilot35)} mm, a 1/3 y 2/3 del alto).`,
        'Antes de que seque, mide las diagonales de la caja; luego atornilla el fondo por debajo, que la deja a escuadra.',
        'Separa cada guía en sus dos partes: la del mueble se atornilla al costado, nivelada y a ras del canto delantero; la otra, al lateral del cajón.',
        'Mete el cajón y comprueba que corre suave hasta el fondo.',
      ],
      parts: allIds,
      marks: cajas.flatMap((q) => q.marks),
      technique: {
        name: 'Caja de cajón atornillada sobre guías',
        why: 'Una caja de cuatro lados y un fondo es lo más sencillo de hacer bien: el fondo atornillado la escuadra, y las guías telescópicas se encargan de que corra, así que la precisión importa en el ancho, no en el ajuste.',
        how: [
          'Las dos guías tienen que quedar exactamente a la misma altura y paralelas: traza una línea en cada costado midiendo desde la balda de abajo.',
          'Atornilla primero solo los agujeros alargados de la guía; cuando el cajón corra bien, completa con el resto.',
        ],
      },
      hardware: [
        hw('Tornillo para madera de cabeza avellanada 3,5 × 30 mm', nEsq),
        hw('Tornillo para madera de cabeza plana 3 × 20 mm', nFondo),
        hw('Tornillo de cabeza plana 3,5 × 12 mm para las guías (si no vienen con ellas)', nGuia),
        ...colaOnce(),
      ],
      tools: ['Taladro atornillador', `Broca de ${fmtD(pilot35)} mm y de ${fmtD(pilot3)} mm`, 'Escuadra de carpintero', 'Nivel de burbuja', 'Sargentos'],
      check: 'Cada cajón debe entrar y salir sin rozar, y quedar a ras del frente de los costados al cerrarlo.',
    });
    const nFr = frentesCaj.reduce((s, q) => s + q.marks.length, 0);
    b.step({
      kind: 'montar',
      title: 'Coloca los frentes de cajón',
      summary: `Los frentes tapan la caja y los cantos del mueble, con ${G} mm de holgura entre ellos.`,
      detail: [
        'Empieza por el cajón de abajo. Pega el frente provisionalmente con cinta de doble cara sobre la caja, centrado y con su holgura respecto al de al lado.',
        `Usa de calzo dos tiras de ${G} mm (un trozo de tablero fino o unas monedas) entre frentes para que la holgura salga igual.`,
        `Abre el cajón con cuidado y atornilla el frente desde dentro de la caja: ${nFr / Math.max(1, frentesCaj.length)} tornillos por frente, más cortos que caja y frente juntos.`,
        'Marca el tirador con una plantilla de cartón para que salga igual en todos los frentes y taládralo de fuera a dentro con un taco de madera detrás, para no astillar.',
      ],
      parts: frentesCaj.flatMap((q) => q.ids),
      marks: frentesCaj.flatMap((q) => q.marks),
      hardware: [hw('Tornillo para madera de cabeza plana 3,5 × 25 mm', nFr)],
      tools: ['Atornillador', 'Cinta de doble cara', `Calzos de ${G} mm`, 'Taladro con broca para el tirador'],
      check: 'Mira el mueble de frente: todas las holguras entre frentes deben verse iguales.',
    });
  }

  if (puertas.length) {
    b.step({
      kind: 'montar',
      title: 'Cuelga las puertas',
      summary: `${plural(nPuertas, 'puerta superpuesta', 'puertas superpuestas')} con ${plural(nBisagras, 'bisagra', 'bisagras')} de cazoleta${nPuertas > puertas.length ? `; en huecos de más de ${PUERTA_DOBLE} mm libres van dos hojas` : ''}.`,
      detail: [
        'Las bisagras de cazoleta se ajustan después con sus tornillos: no hace falta que la puerta quede perfecta a la primera.',
        'En cada puerta, marca el centro de cada cazoleta a la distancia del canto que indique el fabricante de la bisagra (suele traer plantilla) y taládrala con la broca Forstner de su medida y tope de profundidad.',
        'Coloca la bisagra en la puerta, presenta la puerta cerrada sobre su hueco, con calzos de la holgura, y marca las bases en el costado.',
        'Atornilla las bases al costado y engancha la puerta.',
        'Ajusta con los tornillos de la bisagra hasta que las holguras sean iguales y la puerta cierre a ras.',
        'Pon los tiradores en el canto que abre, con la misma plantilla de cartón en todas las puertas.',
      ],
      parts: puertas.flatMap((q) => q.ids),
      marks: puertas.flatMap((q) => q.marks),
      technique: {
        name: 'Bisagra de cazoleta para puerta superpuesta',
        why: 'Es la bisagra de cocina de toda la vida: queda oculta por dentro, la puerta tapa el canto del costado y se regula en alto, en ancho y en fondo con un destornillador, así que perdona pequeños errores de montaje.',
        how: [
          'Usa broca Forstner del diámetro que pida la bisagra y tope de profundidad: la cazoleta no debe atravesar la puerta.',
          `Criterio de diseño: dos bisagras hasta 90 cm de alto de puerta, tres hasta 150 y cuatro por encima. Si el fabricante de tus bisagras da otro, manda el suyo.`,
          'Puertas dobles: cuelga primero las dos hojas y ajústalas a la vez para que la junta del centro quede recta.',
        ],
      },
      hardware: [hw('Tornillo de cabeza plana 3,5 × 12 mm para bisagras (si no vienen con ellas)', nBisagras * 4)],
      tools: ['Taladro', 'Broca Forstner del diámetro de la cazoleta, con tope', 'Destornillador', `Calzos de ${G} mm`, 'Plantilla de cartón para tiradores'],
      check: 'Abre y cierra cada puerta: no debe rozar con la de al lado ni con los frentes de arriba o abajo.',
    });
  }

  b.step({
    kind: 'acabar',
    title: anti ? 'Da el acabado y ancla a la pared' : 'Da el acabado',
    summary: mat === 'dm' ? 'Sella los cantos, imprima y pinta; ya en su sitio, sujeta el mueble a la pared.' : 'Lija, protege y, ya en su sitio, sujeta el mueble a la pared antes de cargarlo.',
    detail: [
      'Desmonta tiradores, puertas y cajones para trabajar más cómodo (las bisagras de cazoleta se sueltan sin herramientas en muchos modelos).',
      ...(mat === 'dm'
        ? ['Los cantos del DM absorben mucha pintura: lija suave y dales una mano de imprimación para DM antes que al resto.', 'Imprima todo, lija muy suave entre manos y pinta con rodillo de espuma para que no quede marca.']
        : ['Mata las aristas con un taco de lija y lija a favor de la veta, sin saltarte granos.', 'Aspira el polvo y aplica el acabado (aceite, cera o barniz al agua) siguiendo el bote; lija suave entre manos.']),
      ...(anti
        ? ['Con el acabado seco, coloca el mueble en su sitio, marca en la pared el agujero de cada escuadra, taladra, pon el taco y atornilla.']
        : ['Has elegido no poner escuadras antivuelco: añádelas antes de cargarlo si el mueble es alto, lleva cajones o hay niños en casa.']),
      'Vuelve a montar puertas, cajones y tiradores y repasa el ajuste de las bisagras.',
    ],
    parts: [],
    marks: marksPared,
    hardware: [
      hw('Lija de grano 80, 120 y 180', 2, 'pliegos de cada'),
      mat === 'dm' ? hw('Imprimación para DM y pintura de muebles', 1, 'bote de cada') : hw('Aceite, cera o barniz al agua para muebles', 1, 'bote'),
      ...(anti ? [hw(pared, marksPared.length)] : []),
    ],
    tools: ['Taco de lija o lijadora orbital', mat === 'dm' ? 'Rodillo de espuma y brocha' : 'Brocha o paño de algodón', 'Mascarilla antipolvo', ...(anti ? ['Taladro con broca adecuada a la pared', 'Detector de cables y tuberías'] : [])],
    warning: anti ? 'Antes de taladrar la pared, comprueba que no pasa ningún cable ni tubería por ese punto.' : 'Sin anclaje a la pared el mueble puede volcar.',
  });

  // ===================== proyecto =====================
  const Wext = W + 2 * vu;
  const Dfinal = tapa ? Dtapa : Dext;
  const unionName = tec.name;
  const resumenHuecos = (['p', 'c', 'a', 'd'] as Tipo[])
    .map((t) => {
      const k = cuerpos.reduce((s, c) => s + c.huecos.filter((h) => h.t === t).length, 0);
      return k ? `${k} ${({ p: k === 1 ? 'hueco con puerta' : 'huecos con puerta', c: k === 1 ? 'cajón' : 'cajones', a: k === 1 ? 'hueco abierto' : 'huecos abiertos', d: k === 1 ? 'hueco con divisor' : 'huecos con divisor' } as const)[t]}` : '';
    })
    .filter(Boolean);
  const luzMax = Math.max(...cuerpos.map((c) => c.w - 2 * T));
  return b.finish({
    id: 'modular',
    title: 'Mueble modular',
    craft: 'carpinteria',
    summary: `Mueble de ${plural(cuerpos.length, 'cuerpo', 'cuerpos')} en ${matName} de ${T} mm, ${Math.round(Wext / 10)} × ${Math.round(H / 10)} cm y ${Math.round(Dfinal / 10)} cm de fondo: ${resumenHuecos.join(', ')}.`,
    difficulty: nCajones || nPuertas ? 2 : union === 'tornillo' ? 1 : 2,
    hours: Math.round(3 + cuerpos.length * 1.5 + nHuecos * 0.3 + nCajones * 1.5 + nPuertas * 0.8 + (union === 'tornillo' ? 0 : 2) + (trasera ? 0.5 : 0) + (tapa ? 0.5 : 0) + (base === 'patas' ? 0.5 : 0)),
    dims: [Wext, H, Dfinal],
    stain: mat === 'dm' ? '#ece6da' : undefined,
    safety: [
      'Ancla el mueble a la pared, sobre todo si es alto o lleva cajones: abrir varios cajones a la vez desplaza el peso hacia delante. Los tacos y tornillos de pared dependen de tu pared (ladrillo, hormigón o pladur).',
      'Gafas de protección siempre que cortes, taladres o lijes; mascarilla al lijar, y más con DM, que suelta un polvo muy fino.',
      'Sujeta la pieza con sargentos: nunca con la mano cerca de la línea de corte, de la broca ni de la fresa.',
      'Para levantar, voltear y mover los cuerpos, dos personas.',
      'No dejes que los niños trepen por cajones, puertas ni baldas.',
    ],
    notes: [
      'Las medidas de la lista de corte son finales. Compra el tablero ya cepillado y calibrado, o pide que te lo corten en la tienda.',
      'Costados dobles: cada cuerpo es una caja completa con sus dos costados y los cuerpos se atornillan entre sí por dentro. Gasta un costado más por unión, pero todos los cuerpos se montan igual, se escuadran por separado y se transportan sueltos.',
      'Alto de los huecos: se reparten el alto interior de cada cuerpo en proporción a su alto en la distribución, sin bajar de 120 mm. Si cambias el alto total, todos los huecos crecen o encogen en la misma proporción.',
      `Frentes superpuestos: tapan el canto de costados y baldas, con ${G} mm de holgura entre frentes y ${fmtD(G / 2)} mm en los bordes (medidas de diseño).`,
      ...(nPuertas ? [`Puertas: una hoja hasta ${PUERTA_DOBLE} mm de hueco libre y dos hojas por encima (criterio de diseño, para que las hojas no sean demasiado anchas ni pesadas para la bisagra).`] : []),
      ...(nCajones ? [`Cajones: cajas de contrachapado de ${CAJ} mm con fondo de ${TB} mm, ${Ld} mm de largo y ${GUIA} mm por lado para la guía. El largo y el hueco de la guía son decisiones de diseño: ajústalos a las guías que compres. Si no encuentras contrachapado de ${CAJ} mm, usa el más parecido y corrige la delantera, la trasera y el fondo.`] : []),
      `Luz de la balda más larga: ${mm(luzMax)}. Según Fine Woodworking, duplicar la luz multiplica la flecha por 8 y duplicar el grueso la divide por 8.${luzMax > 813 ? ' En foros de carpintería se aconseja no pasar de unas 32 pulgadas (≈813 mm, conv. propia) en baldas de 3/4 in sin canto: si vas a cargar libros, pega un listón de canto bajo el borde delantero. Es una opinión de oficio, no una norma.' : ''}`,
      'No damos carga máxima por balda ni por cajón: depende del tablero concreto, de las uniones, de las guías y de cómo se reparta el peso.',
      ...(mat === 'dm' ? ['El DM agarra peor los tornillos en el canto que la madera: taladro piloto siempre y no aprietes de más. Si vas a montar y desmontar, mejor tubillones.'] : []),
      ...(alto && !anti ? ['Con este alto, el anclaje a la pared no es opcional: añade las escuadras antivuelco.'] : []),
      ...geo.avisos,
    ],
    sources: [
      { label: 'USDA Wood Handbook, cap. 8 «Fastenings» (taladro guía)', url: 'https://research.fs.usda.gov/download/treesearch/37424.pdf' },
      { label: 'Popular Woodworking: Pilot Holes, Clearance Holes & Countersinks', url: 'https://www.popularwoodworking.com/editors-blog/pilot-holes-clearance-holes-countersinks/' },
      { label: 'Spax: customer service (regla de 3 veces el grueso)', url: 'https://spax.us/customer-service' },
      ...(union === 'tubillon' ? [{ label: 'Fine Woodworking: Make Strong, Simple Joints with Dowels', url: 'https://www.finewoodworking.com/2011/09/29/make-strong-simple-joints-with-dowels' }] : []),
      ...(union === 'ranura' ? [{ label: 'Fine Woodworking: Cutting rabbets two ways', url: 'https://www.finewoodworking.com/2022/12/13/cutting-rabbets-two-ways' }] : []),
      { label: 'Fine Woodworking: Engineer Shelves With The Sagulator', url: 'https://www.finewoodworking.com/2007/01/05/engineer-shelves-with-the-sagulator' },
      ...(luzMax > 813 ? [{ label: 'WoodWeb: Free Span Limits of Cabinet Shelving', url: 'https://www.woodweb.com/knowledge_base/Free_Span_Limits_of_Cabinet_Shelving.html' }] : []),
      { label: 'IKEA: instrucciones de montaje KALLAX (aviso de vuelco)', url: 'https://www.ikea.com/es/es/assembly_instructions/kallax-estanteria-blanco__AA-2703431-1-2.pdf' },
    ],
    spec: [
      { label: 'Medidas', value: `${Math.round(Wext)} × ${H} × ${Math.round(Dfinal)} mm` },
      { label: 'Cuerpos', value: `${cuerpos.length}: ${anchos} mm, costados dobles` },
      { label: 'Huecos', value: resumenHuecos.join(', ') },
      { label: 'Tablero', value: `${matName[0].toUpperCase()}${matName.slice(1)} de ${T} mm` },
      { label: 'Apoyo', value: base === 'zocalo' ? `Zócalo de ${mm(hb)}` : base === 'patas' ? `Patas de ${P} × ${P} mm, ${mm(hb)}` : 'Directo al suelo' },
      { label: 'Trasera', value: trasera ? `Contrachapado de ${TB} mm` : 'No' },
      { label: 'Tapa con vuelo', value: tapa ? `Sí, ${vu} mm` : 'No' },
      ...(nPuertas ? [{ label: 'Puertas', value: `${nPuertas}, con ${nBisagras} bisagras de cazoleta` }] : []),
      ...(nCajones ? [{ label: 'Cajones', value: `${nCajones}, con guías telescópicas de ${Ld} mm` }] : []),
      ...(nTiradores ? [{ label: 'Tiradores', value: String(nTiradores) }] : []),
      { label: 'Antivuelco', value: anti ? `${escuadras.length} escuadras a la pared` : 'No' },
      { label: 'Unión', value: unionName },
    ],
  });
}
