import type { Generator, HardwareLine, Mark, ParamValues, Part, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, tornillos } from '../core/builder';

/**
 * CUNA DE MADERA CON BARROTES REDONDOS.
 *
 * Ejes: X = largo de la cuna (cabeceros en los extremos de X), Z = ancho (laterales en
 * los extremos de Z), Y = alto. Todo se deriva del colchón: interior = colchón + 10 mm.
 *
 * Cada cifra de seguridad sale de docs/referencia-tecnica.md §1 (EN 716-1 según la vista previa
 * del borrador FprEN 716-1:2015, resúmenes de CATAS y de la Comunidad de Madrid, AEP vía Consumer).
 * El generador garantiza por construcción, en todo el rango de parámetros:
 *  - hueco libre entre barrotes y entre barrote y poste/montante dentro de 45–65 mm (objetivo 47–63);
 *  - altura del borde superior ≥ 500 mm sobre la cara de arriba del colchón (y ≥ 600 mm sobre el somier)
 *    en la posición baja, y ≥ 200 mm sobre el colchón (y ≥ 300 mm sobre el somier) en la alta;
 *  - separación entre lamas ≤ 60 mm; holgura del colchón muy por debajo de 30 mm;
 *  - hueco somier–laterales de 3 mm (no pasa el cono de 25 mm);
 *  - uniones desmontables solo con perno métrico (nunca tornillo para madera).
 * Si alguna comprobación fallase, build() lanza un error en lugar de devolver una cuna insegura.
 */

// ---- límites tomados de la referencia (§1) ----
const HUECO_MIN = 45; // EN 716-1 4.4.2.1: huecos entre 45 y 65 mm (barrotes)
const HUECO_MAX = 65;
const HUECO_OBJ: [number, number] = [47, 63]; // margen de diseño de 2 mm para la tolerancia de taller
const LAMA_MAX = 60; // EN 716-1 4.4.2.5 / Comunidad de Madrid: 6 cm entre lamas
const HOLGURA_MAX = 30; // CATAS 6 l / Madrid: hueco colchón ≤ 30 mm
const SOMIER_CONO = 25; // EN 716-1 4.4.2.3: no debe pasar el cono de 25 mm
const ALTO_BAJO = 500; // CATAS / Madrid: ≥ 500 mm en posición baja
const ALTO_ALTO = 200; // ≥ 200 mm en posición alta
const AEP_BAJO = 600; // AEP (Consumer): 60 cm desde el punto más profundo
const AEP_ALTO = 300; // AEP: 30 cm desde el punto menos profundo
const AGUJERO_LIBRE = 6.5; // taladro de paso: por debajo de la franja prohibida 7–12 mm (4.4.2.2)

// ---- decisiones de diseño (no son norma) ----
const HOLG = 10; // interior = colchón + 10 mm en largo y en ancho
const H_INF = 80; // alto del travesaño inferior de cada panel
const H_SUP = 50; // alto del travesaño superior
const MONT = 45; // ancho del montante del cabecero (recibe los pernos del somier)
const SOM_GAP = 3; // holgura somier–laterales por lado
const LARG_T = 30, LARG_H = 60; // larguero del somier
const LAMA_W = 70, LAMA_T = 15; // lama del somier
const ENTRA_BARROTE = 12; // lo que entra cada extremo del barrote en su taladro
const ESPIGA_L = 30; // largo de espiga en caja y espiga
const TABLERO_T = 20, RANURA = 10; // cabecero liso: tablero en ranura
const RUEDA_H = 60;
const CAJON_T = 18, FONDO_T = 6;

type Union = 'tubillon' | 'espiga';
type Desm = 'inserto' | 'barril';

const SOURCES = [
  { label: 'EN 716-1 (vista previa del borrador FprEN 716-1:2015, publicada como SIST EN 716-1:2017)', url: 'https://cdn.standards.iteh.ai/samples/58462/aa3f912a994c4215ac1497d2d120751c/SIST-EN-716-1-2017.pdf' },
  { label: 'CATAS: requisitos e instrucciones de cunas (EN 716, edición 2017)', url: 'https://catas.com/uploads/media/tabella-istruzioni-culle-lettini-eng.pdf' },
  { label: 'CATAS: resumen de EN 716-1/-2', url: 'https://catas.com/uploads/media/lettinieng.pdf' },
  { label: 'Comunidad de Madrid: seguridad de cunas (cita UNE-EN 716-1:2018+AC:2019)', url: 'https://www.comunidad.madrid/node/73299' },
  { label: 'Consumer (recomendaciones de la AEP sobre cunas)', url: 'https://www.consumer.es/?p=95609' },
  { label: 'Fine Woodworking: tubillones (diámetro entre 1/3 y 1/2 del grosor)', url: 'https://www.finewoodworking.com/project-guides/joinery/james-krenovs-dowel-joint' },
  { label: 'USDA Wood Handbook, cap. 8 (taladro guía según diámetro de raíz)', url: 'https://research.fs.usda.gov/download/treesearch/37424.pdf' },
  { label: 'SPAX: longitud de tornillo orientativa (2,5 × grosor)', url: 'https://www.spax.com/pc-en/services-for-professionals/technical-lexicon.html' },
  { label: 'Osmo: Polyx-Oil Rapid, declaración EN 71-3 del fabricante', url: 'https://int.osmo.com/uk/finishes/interior-finishes/finishes-for-toys-made-of-wood/polyxr-oil-rapid' },
];

/** Reparte barrotes en un vano libre para que TODOS los huecos (también contra poste o montante) caigan en la banda. */
export function repartoBarrotes(vano: number, d: number): { n: number; hueco: number } {
  const obj = (HUECO_OBJ[0] + HUECO_OBJ[1]) / 2;
  let n = Math.max(1, Math.round((vano - obj) / (d + obj)));
  const g = (k: number) => (vano - k * d) / (k + 1);
  for (let i = 0; i < 50 && g(n) > HUECO_OBJ[1]; i++) n++;
  for (let i = 0; i < 50 && g(n) < HUECO_OBJ[0] && n > 1; i++) n--;
  const hueco = g(n);
  if (!(hueco >= HUECO_MIN && hueco <= HUECO_MAX)) throw new Error(`cuna: no se puede repartir ${vano} mm con barrotes de Ø${d} dentro de 45–65 mm`);
  return { n, hueco };
}

/** Taladro guía según la USDA: raíz ≈ 2/3 del vástago; 70 % de la raíz en blanda, 90 % en dura. */
const piloto = (d: number, dura: boolean) => Math.round(((d * 2) / 3) * (dura ? 0.9 : 0.7) * 2) / 2;
/** Tubillón: diámetro comercial más pequeño que llega a 1/3 del grosor (regla de Fine Woodworking). */
const diamTubillon = (t: number) => [6, 8, 10, 12, 14, 16].find((x) => x >= t / 3) ?? 16;
const r5 = (n: number) => Math.ceil(n / 5) * 5;

export const cuna: Generator = {
  id: 'cuna',
  title: 'Cuna',
  craft: 'carpinteria',
  difficulty: 3,
  description:
    'Cuna de madera maciza con barrotes redondos y somier de lamas, dimensionada a partir del colchón y con las separaciones y alturas publicadas de la norma EN 716-1. Laterales y somier desmontables con pernos métricos.',
  params: [
    {
      key: 'colchon', label: 'Colchón', type: 'select', default: '60x120', group: 'Medidas',
      help: 'Toda la cuna se calcula a partir del colchón: el interior mide 10 mm más en largo y en ancho.',
      options: [
        { value: '60x120', label: '60 × 120 cm', hint: 'El más habitual' },
        { value: '70x140', label: '70 × 140 cm', hint: 'Cuna grande / convertible' },
      ],
    },
    {
      key: 'grueso', label: 'Espesor máximo del colchón', type: 'number', min: 80, max: 150, step: 10, unit: 'mm', default: 120, group: 'Medidas',
      help: 'Las alturas de seguridad se miden desde la cara de arriba de un colchón de este espesor. No uses nunca uno más grueso.',
    },
    {
      key: 'bajo', label: 'Altura libre bajo la cuna', type: 'number', min: 100, max: 250, step: 10, unit: 'mm', default: 150, group: 'Medidas',
      help: 'Del suelo a la parte de abajo de los travesaños inferiores (largo de las patas).',
    },
    {
      key: 'cabecero', label: 'Cabeceros', type: 'select', default: 'barrotes', group: 'Forma',
      options: [
        { value: 'barrotes', label: 'De barrotes', hint: 'Más ventilación y visión' },
        { value: 'liso', label: 'De tablero liso', hint: 'Tablero en ranura, sin huecos' },
      ],
    },
    {
      key: 'barrote', label: 'Diámetro de barrote', type: 'select', default: '25', group: 'Forma',
      help: 'El número de barrotes se recalcula para que el hueco libre siga dentro de 45–65 mm.',
      options: [
        { value: '22', label: 'Ø 22 mm', hint: 'Ligero' },
        { value: '25', label: 'Ø 25 mm', hint: 'Equilibrado' },
        { value: '28', label: 'Ø 28 mm', hint: 'Robusto' },
      ],
    },
    {
      key: 'poste', label: 'Sección de los postes', type: 'select', default: '45', group: 'Forma',
      options: [
        { value: '45', label: '45 × 45 mm' },
        { value: '55', label: '55 × 55 mm', hint: 'Aspecto más macizo' },
      ],
    },
    {
      key: 'barandilla', label: 'Altura de barandilla', type: 'select', default: 'normal', group: 'Forma',
      options: [
        { value: 'normal', label: 'La mínima calculada', hint: 'Cumple las cifras de la norma y de la AEP' },
        { value: 'alta', label: '80 mm más alta', hint: 'Más margen cuando empiece a ponerse de pie' },
      ],
    },
    { key: 'dosAlturas', label: 'Somier a dos alturas', type: 'boolean', default: true, group: 'Detalles', help: 'Posición alta para los primeros meses y baja cuando el bebé ya se incorpora.' },
    {
      key: 'posicion', label: 'Somier montado en', type: 'select', default: 'baja', group: 'Detalles',
      visible: (v) => v.dosAlturas === true,
      options: [
        { value: 'baja', label: 'Posición baja', hint: 'La más segura' },
        { value: 'alta', label: 'Posición alta', hint: 'Solo mientras no se siente ni se incorpore' },
      ],
    },
    {
      key: 'lamas', label: 'Número de lamas', type: 'number', min: 10, max: 16, step: 1, unit: 'ud', default: 12, group: 'Detalles',
      help: 'Se corrige solo si hiciera falta para que no queden más de 60 mm entre lamas.',
    },
    { key: 'ruedas', label: 'Ruedas', type: 'boolean', default: false, group: 'Detalles', help: 'Cuatro ruedas, dos de ellas con freno (la configuración que admite la norma).' },
    {
      key: 'cajon', label: 'Cajón bajo la cuna', type: 'boolean', default: false, group: 'Detalles',
      help: 'Caja independiente que se desliza bajo el lateral. Necesita al menos 180 mm libres.',
      visible: (v) => Number(v.bajo) >= 180,
    },
    {
      key: 'madera', label: 'Madera', type: 'select', default: 'haya', group: 'Material',
      options: [
        { value: 'haya', label: 'Haya', hint: 'Dura, resiste los mordiscos' },
        { value: 'pino', label: 'Pino', hint: 'Más blanda y barata' },
      ],
    },
    {
      key: 'union', label: 'Uniones fijas (cabeceros)', type: 'select', default: 'tubillon', group: 'Uniones',
      options: [
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos, la más accesible' },
        { value: 'espiga', label: 'Caja y espiga', hint: 'Tradicional, sin tornillos' },
      ],
    },
    {
      key: 'desmontable', label: 'Uniones desmontables', type: 'select', default: 'inserto', group: 'Uniones',
      help: 'Laterales y somier se unen con perno métrico: la norma no admite tornillos para madera en piezas que se desmontan.',
      options: [
        { value: 'inserto', label: 'Perno + inserto roscado', hint: 'Nada a la vista por dentro' },
        { value: 'barril', label: 'Perno + tuerca de barril', hint: 'Muy resistente, taladro transversal' },
      ],
    },
  ],
  presets: [
    {
      id: 'clasica', name: 'Cuna clásica de haya', blurb: 'Colchón de 60 × 120, barrotes por los cuatro lados y somier a dos alturas.',
      values: { colchon: '60x120', grueso: 120, bajo: 150, cabecero: 'barrotes', barrote: '25', poste: '45', barandilla: 'normal', dosAlturas: true, posicion: 'baja', lamas: 12, ruedas: false, cajon: false, madera: 'haya', union: 'tubillon', desmontable: 'inserto' },
    },
    {
      id: 'grande', name: 'Cuna grande con cajón', blurb: 'Colchón de 70 × 140, cabeceros lisos, ruedas con freno y cajón debajo.',
      values: { colchon: '70x140', grueso: 120, bajo: 220, cabecero: 'liso', barrote: '25', poste: '55', barandilla: 'normal', dosAlturas: true, posicion: 'baja', lamas: 13, ruedas: true, cajon: true, madera: 'haya', union: 'espiga', desmontable: 'barril' },
    },
    {
      id: 'nordica', name: 'Cuna nórdica de pino', blurb: '60 × 120 con barrotes gruesos, barandilla alta y una sola altura de somier.',
      values: { colchon: '60x120', grueso: 100, bajo: 180, cabecero: 'barrotes', barrote: '28', poste: '55', barandilla: 'alta', dosAlturas: false, lamas: 11, ruedas: false, cajon: false, madera: 'pino', union: 'tubillon', desmontable: 'inserto' },
    },
  ],
  build,
};

function build(v: ParamValues) {
  const [cw, cl] = String(v.colchon).split('x').map((n) => Number(n) * 10); // ancho, largo del colchón
  const C = Number(v.grueso);
  const bajo = Number(v.bajo);
  const liso = v.cabecero === 'liso';
  const d = Number(v.barrote);
  const P = Number(v.poste);
  const alta = v.barandilla === 'alta';
  const dos = v.dosAlturas === true;
  const posAlta = dos && v.posicion === 'alta';
  const ruedas = v.ruedas === true;
  const cajon = v.cajon === true && bajo >= 180;
  const mat = v.madera === 'pino' ? 'pino' : 'haya';
  const dura = mat === 'haya';
  const union = v.union as Union;
  const desm = v.desmontable as Desm;
  const madera = mat === 'haya' ? 'haya' : 'pino';

  const tR = d + 10; // grueso de travesaños y montantes: el barrote queda centrado con 5 mm de pared
  const L = cl + HOLG; // interior a lo largo (entre cabeceros)
  const W = cw + HOLG; // interior a lo ancho (entre laterales)

  // ---- alturas ----
  const yB = bajo; // cara inferior de los travesaños inferiores
  const yS1 = yB + H_INF; // cara superior del somier en posición baja = cara superior del travesaño inferior
  const fondoBajo = Math.max(AEP_BAJO, ALTO_BAJO + C) + (alta ? 80 : 0);
  const yTop = yS1 + fondoBajo; // borde superior de laterales y cabeceros (postes a ras)
  const fondoAlto = Math.max(AEP_ALTO, ALTO_ALTO + C);
  const yS2 = yTop - fondoAlto; // somier en posición alta
  const yS = posAlta ? yS2 : yS1;
  const y0 = ruedas ? RUEDA_H : 0;
  const barH = yTop - H_SUP - (yB + H_INF); // tramo visto de barrote

  // ---- reparto de barrotes y lamas ----
  const lat = repartoBarrotes(L, d);
  const cab = liso ? null : repartoBarrotes(W - 2 * MONT, d);
  const nMinLamas = Math.ceil((L + LAMA_MAX) / (LAMA_W + LAMA_MAX));
  const nMaxLamas = Math.floor((L + 20) / (LAMA_W + 20)); // al menos 20 mm entre lamas para ventilar
  const nL = Math.min(nMaxLamas, Math.max(nMinLamas, Math.round(Number(v.lamas))));
  const gLama = (L - nL * LAMA_W) / (nL - 1);

  // comprobaciones duras (si algo falla, mejor no devolver la cuna)
  const insetBarrote = (tR - d) / 2;
  const insetCab = liso ? (tR - TABLERO_T) / 2 : insetBarrote;
  const holguraAncho = HOLG + insetBarrote; // colchón empujado contra un lateral
  const holguraLargo = HOLG + insetCab;
  const huecoSomier = SOM_GAP + insetBarrote; // en posición alta, frente a los barrotes
  if (gLama > LAMA_MAX) throw new Error('cuna: separación entre lamas > 60 mm');
  if (Math.max(holguraAncho, holguraLargo) > HOLGURA_MAX) throw new Error('cuna: holgura de colchón > 30 mm');
  if (huecoSomier >= SOMIER_CONO) throw new Error('cuna: hueco somier–lateral ≥ 25 mm');
  if (yS2 - (LAMA_T + LARG_H) < yS1 + 10) throw new Error('cuna: las dos posiciones de somier se pisan');

  const b = new Builder();
  const letters = new Map<string, string>();
  const R = (key: string) => {
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + letters.size));
    return letters.get(key)!;
  };
  const setCut = (id: string, largo: number, note: string) => {
    const p = b.parts.find((q) => q.id === id) as Part;
    p.cut = [largo, p.cut[1], p.cut[2]];
    p.note = note;
  };
  const espigaExtra = union === 'espiga' ? 2 * ESPIGA_L : 0;

  // ================= piezas =================
  const xCab = [P - tR, P + L]; // cara mínima de cada cabecero (X)
  const zLat = [P - tR, P + W]; // cara mínima de cada lateral (Z)
  const xPost = [0, P + L];
  const zPost = [0, P + W];

  // --- paneles de los cabeceros ---
  const cabPanel: string[] = [];
  const cabBars: { x: number; z: number }[] = [];
  for (const xc of xCab) {
    const sup = b.liston({ ref: R('cabSup'), name: 'Travesaño superior del cabecero', material: madera, section: [tR, H_SUP], length: W, axis: 'z', at: [xc, yTop - H_SUP, P] });
    const inf = b.liston({ ref: R('cabInf'), name: 'Travesaño inferior del cabecero', material: madera, section: [tR, H_INF], length: W, axis: 'z', at: [xc, yB, P] });
    if (union === 'espiga') {
      setCut(sup, W + espigaExtra, `Incluye ${ESPIGA_L} mm de espiga en cada extremo.`);
      setCut(inf, W + espigaExtra, `Incluye ${ESPIGA_L} mm de espiga en cada extremo.`);
    }
    cabPanel.push(sup, inf);
    for (const z of [P, P + W - MONT]) {
      const m = b.liston({ ref: R('montante'), name: 'Montante del cabecero', material: madera, section: [tR, MONT], length: barH, axis: 'y', at: [xc, yB + H_INF, z] });
      if (union === 'espiga') setCut(m, barH + 40, 'Incluye 20 mm de espiga en cada extremo.');
      cabPanel.push(m);
    }
    if (cab) {
      for (let i = 0; i < cab.n; i++) {
        const zc = P + MONT + cab.hueco * (i + 1) + d * i + d / 2;
        const id = b.redondo({ ref: R('barrote'), name: 'Barrote', material: madera, diameter: d, length: barH, axis: 'y', at: [xc + tR / 2 - d / 2, yB + H_INF, zc - d / 2] });
        setCut(id, barH + 2 * ENTRA_BARROTE, `Incluye ${ENTRA_BARROTE} mm que entran en cada travesaño.`);
        cabPanel.push(id);
        cabBars.push({ x: xc + tR / 2, z: zc });
      }
    } else {
      const id = b.panel({ ref: R('tablero'), name: 'Tablero del cabecero', material: madera, thickness: TABLERO_T, face: [barH, W - 2 * MONT], normal: 'x', at: [xc + (tR - TABLERO_T) / 2, yB + H_INF, P + MONT], grain: 'z' });
      const p = b.parts.find((q) => q.id === id) as Part;
      p.cut = [Math.max(W - 2 * MONT, barH) + 2 * RANURA, Math.min(W - 2 * MONT, barH) + 2 * RANURA, TABLERO_T];
      p.note = `Incluye ${RANURA} mm por cada lado que entran en la ranura. Va suelto, sin cola.`;
      cabPanel.push(id);
    }
  }

  // --- postes ---
  const postes: string[] = [];
  for (const x of xPost) for (const z of zPost) {
    postes.push(b.liston({ ref: R('poste'), name: 'Poste', material: madera, section: [P, P], length: yTop - y0, axis: 'y', at: [x, y0, z] }));
  }

  // --- laterales ---
  const latParts: string[] = [];
  const latBars: { x: number; z: number }[] = [];
  for (const zc of zLat) {
    latParts.push(b.liston({ ref: R('latSup'), name: 'Travesaño superior del lateral', material: madera, section: [H_SUP, tR], length: L, axis: 'x', at: [P, yTop - H_SUP, zc] }));
    latParts.push(b.liston({ ref: R('latInf'), name: 'Travesaño inferior del lateral', material: madera, section: [H_INF, tR], length: L, axis: 'x', at: [P, yB, zc] }));
    for (let i = 0; i < lat.n; i++) {
      const xcen = P + lat.hueco * (i + 1) + d * i + d / 2;
      const id = b.redondo({ ref: R('barrote'), name: 'Barrote', material: madera, diameter: d, length: barH, axis: 'y', at: [xcen - d / 2, yB + H_INF, zc + tR / 2 - d / 2] });
      setCut(id, barH + 2 * ENTRA_BARROTE, `Incluye ${ENTRA_BARROTE} mm que entran en cada travesaño.`);
      latParts.push(id);
      latBars.push({ x: xcen, z: zc + tR / 2 });
    }
  }

  // --- somier ---
  const somier: string[] = [];
  const zLarg = [P + SOM_GAP, P + W - SOM_GAP - LARG_T];
  for (const z of zLarg) {
    somier.push(b.liston({ ref: R('larguero'), name: 'Larguero del somier', material: madera, section: [LARG_H, LARG_T], length: L, axis: 'x', at: [P, yS - LAMA_T - LARG_H, z] }));
  }
  const xLamas = Array.from({ length: nL }, (_, i) => P + i * (LAMA_W + gLama));
  for (const x of xLamas) {
    somier.push(b.liston({ ref: R('lama'), name: 'Lama del somier', material: madera, section: [LAMA_W, LAMA_T], length: W - 2 * SOM_GAP, axis: 'z', at: [x, yS - LAMA_T, P + SOM_GAP] }));
  }

  // --- ruedas ---
  const wheels: string[] = [];
  if (ruedas) {
    let k = 0;
    for (const x of xPost) for (const z of zPost) {
      const freno = k === 0 || k === 3; // dos en diagonal con freno
      wheels.push(b.herraje({
        ref: R(freno ? 'ruedaF' : 'rueda'), name: freno ? 'Rueda con freno' : 'Rueda sin freno', size: [P, RUEDA_H, P], at: [x, 0, z],
        stock: freno ? `Rueda giratoria con freno y placa de montaje, ${RUEDA_H} mm de alto total` : `Rueda giratoria con placa de montaje, ${RUEDA_H} mm de alto total`,
      }));
      k++;
    }
  }

  // --- cajón ---
  const cajonParts: string[] = [];
  const hC = Math.min(200, yB - 20);
  const cx0 = P + 20, cx1 = P + L - 20, cz0 = P - tR, cz1 = P + W - 20;
  if (cajon) {
    const hW = hC - FONDO_T;
    cajonParts.push(b.panel({ ref: R('cajFondo'), name: 'Fondo del cajón', material: 'contrachapado', thickness: FONDO_T, face: [cx1 - cx0, cz1 - cz0], normal: 'y', at: [cx0, 0, cz0] }));
    for (const x of [cx0, cx1 - CAJON_T]) {
      cajonParts.push(b.panel({ ref: R('cajLado'), name: 'Costado del cajón', material: 'pino', thickness: CAJON_T, face: [hW, cz1 - cz0], normal: 'x', at: [x, FONDO_T, cz0] }));
    }
    for (const [z, n] of [[cz0, 'Frente del cajón'], [cz1 - CAJON_T, 'Trasera del cajón']] as const) {
      cajonParts.push(b.panel({ ref: R(n === 'Frente del cajón' ? 'cajFrente' : 'cajTrasera'), name: n, material: 'pino', thickness: CAJON_T, face: [cx1 - cx0 - 2 * CAJON_T, hW], normal: 'z', at: [cx0 + CAJON_T, FONDO_T, z] }));
    }
  }

  // ================= marcas =================
  const yBarBot = yB + H_INF, yBarTop = yTop - H_SUP;
  const marksCabBars: Mark[] = cabBars.flatMap((q) => espigas([[q.x, yBarBot, q.z], [q.x, yBarTop, q.z]], 'y'));
  const marksLatBars: Mark[] = latBars.flatMap((q) => espigas([[q.x, yBarBot, q.z], [q.x, yBarTop, q.z]], 'y'));
  const dt = diamTubillon(tR);
  // travesaños de cabecero contra poste
  const yRailMarks = union === 'tubillon'
    ? [yTop - H_SUP / 2 - 12, yTop - H_SUP / 2 + 12, yB + H_INF / 2 - 20, yB + H_INF / 2 + 20]
    : [yTop - H_SUP / 2, yB + H_INF / 2];
  const marksCabPost: Mark[] = xCab.flatMap((xc) => [P, P + W].flatMap((z) => espigas(yRailMarks.map((y): Vec3 => [xc + tR / 2, y, z]), 'z')));
  // montante contra poste (siempre tubillones a lo largo) y contra travesaños
  const yMont = [yBarBot + barH * 0.2, yBarBot + barH * 0.5, yBarBot + barH * 0.8];
  const marksMontPost: Mark[] = xCab.flatMap((xc) => [P, P + W].flatMap((z) => espigas(yMont.map((y): Vec3 => [xc + tR / 2, y, z]), 'z')));
  const marksMontRail: Mark[] = xCab.flatMap((xc) => [P + MONT / 2, P + W - MONT / 2].flatMap((z) => espigas([[xc + tR / 2, yBarBot, z], [xc + tR / 2, yBarTop, z]], 'y')));
  // pernos de los laterales: desde la cara exterior del poste
  const yPernosLat = [yTop - H_SUP / 2, yB + 20, yB + H_INF - 20];
  const marksLatPernos: Mark[] = [0, 2 * P + L].flatMap((x) => [P - tR / 2, P + W + tR / 2].flatMap((z) => tornillos(yPernosLat.map((y): Vec3 => [x, y, z]), 'x')));
  // pernos del somier: desde la cara exterior del cabecero
  const ySomPernos = (ys: number) => [ys - LAMA_T - LARG_H + 18, ys - LAMA_T - 18];
  const zSomPernos = zLarg.map((z) => z + LARG_T / 2);
  const marksSomPernos: Mark[] = [P - tR, P + L + tR].flatMap((x) => zSomPernos.flatMap((z) => tornillos(ySomPernos(yS).map((y): Vec3 => [x, y, z]), 'x')));
  // tornillos de las lamas (fijas, no se desmontan)
  const marksLamas: Mark[] = xLamas.flatMap((x) => zSomPernos.flatMap((z) => tornillos([[x + LAMA_W / 2 - 18, yS, z], [x + LAMA_W / 2 + 18, yS, z]], 'y')));

  // ================= textos =================
  const pernoLat = r5(P + 25 + (desm === 'barril' ? 10 : 0));
  const pernoSom = r5(tR + 25 + (desm === 'barril' ? 10 : 0));
  const tuercaTxt = desm === 'inserto' ? 'Inserto roscado para madera con rosca interior M6' : 'Tuerca de barril (tuerca cilíndrica transversal) M6';
  const nPernosLat = marksLatPernos.length;
  const nPernosSom = marksSomPernos.length;
  const pil4 = piloto(4, dura);
  const lamaScrew = Math.round((LAMA_T * 2.5) / 5) * 5; // regla orientativa de SPAX: 2,5 × grosor

  const tecFija = union === 'tubillon'
    ? {
        name: 'Tubillones encolados',
        why: `Una cuna no debe llevar tornillos a la vista en el interior, y los cabeceros no se desmontan: los tubillones encolados dan una unión fija, limpia y sin herrajes. Con travesaños de ${tR} mm, un tubillón de Ø${dt} mm queda entre un tercio y la mitad del grosor, como recomienda Fine Woodworking.`,
        how: [
          'Marca los centros en la testa del travesaño tomando siempre las medidas desde la cara interior, que es la de referencia.',
          `Taladra con guía y tope de profundidad a Ø${dt} mm, perfectamente a escuadra, y transfiere los centros al poste con marcadores.`,
          'Monta todo en seco. Después pon la cola dentro de los agujeros (no sobre el tubillón), cierra con sargentos y limpia el sobrante con un paño húmedo.',
        ],
      }
    : {
        name: 'Caja y espiga',
        why: `La espiga de ${ESPIGA_L} mm del travesaño entra en una caja del poste: mucha superficie de cola a hilo y gran resistencia al descuadre sin ningún herraje. Es la unión tradicional de cunas y sillas.`,
        how: [
          `Marca la caja con gramil centrada en el grueso del travesaño: ancho de espiga de un tercio del grueso (unos ${mm(Math.round(tR / 3))}).`,
          'Vacía la caja con taladro y formón, dejando algo de fondo extra para la cola.',
          'Corta las mejillas y los hombros de la espiga a partir de la caja real y ajústala hasta que entre a mano con presión firme.',
          'Monta en seco, comprueba la escuadra y encola.',
        ],
      };

  const tecDesm = {
    name: desm === 'inserto' ? 'Unión desmontable con perno e inserto roscado' : 'Unión desmontable con perno y tuerca de barril',
    why: 'La norma EN 716-1 (4.4.1.2) no permite tornillos autorroscantes (incluye los de madera y aglomerado) en las piezas que se desmontan para guardar o transportar la cuna: con cada montaje la rosca de la madera se gasta y la unión se afloja. Un perno métrico que rosca en metal se puede montar y desmontar sin perder agarre.',
    how: desm === 'inserto'
      ? [
          'Taladra el agujero del inserto en la testa del travesaño, centrado en su grueso y a escuadra (usa la broca que indique el fabricante del inserto).',
          'Rosca el inserto con una llave allen o un perno con contratuerca hasta que quede 1 mm por debajo de la testa.',
          `Taladra el paso del perno en la pieza que se atraviesa a Ø${AGUJERO_LIBRE} mm.`,
          'Aprieta el perno con la llave allen hasta que las piezas cierren sin holgura; no lo pases de par.',
        ]
      : [
          `Taladra el paso del perno a Ø${AGUJERO_LIBRE} mm a través de la pieza que se atraviesa y sigue en la testa de la que recibe, hasta unos ${mm(35)} de profundidad.`,
          'Taladra el alojamiento de la tuerca de barril de lado, por la cara que queda oculta, a unos 25 mm de la testa y cruzando el agujero del perno (usa la broca que indique el fabricante).',
          'Mete la tuerca con la ranura orientada hacia el perno y rosca el perno a mano hasta que entre; aprieta después con la llave allen.',
        ],
  };

  const hwPernos = (n: number, largo: number): HardwareLine[] => [
    hw(`Perno de cabeza plana abombada con hexágono interior M6 × ${largo} mm, con arandela`, n),
    hw(tuercaTxt, n),
  ];

  // ================= pasos =================
  b.step({
    kind: 'cortar',
    title: 'Corta, redondea y marca todas las piezas',
    summary: 'Cada pieza a su medida, con sus aristas redondeadas y su letra, antes de montar nada.',
    detail: [
      `El interior de la cuna mide ${mm(L)} × ${mm(W)}: 10 mm más que el colchón de ${cl / 10} × ${cw / 10} cm. Comprueba las medidas reales de tu colchón antes de cortar; si no coincide, ajusta el colchón elegido.`,
      `Corta los ${2 * lat.n + 2 * (cab?.n ?? 0)} barrotes a ${mm(barH + 2 * ENTRA_BARROTE)} con un tope: ${mm(barH)} vistos más ${mm(ENTRA_BARROTE)} en cada travesaño. Todos deben salir idénticos.`,
      ...(union === 'espiga' ? [`Con caja y espiga, los travesaños del cabecero llevan ${ESPIGA_L} mm de espiga en cada extremo y los montantes 20 mm (ya incluido en la lista de corte).`] : []),
      ...(liso ? [`El tablero del cabecero se corta ${RANURA * 2} mm más grande en cada sentido: entra ${RANURA} mm en una ranura de travesaños y montantes.`] : []),
      'Redondea todas las aristas que quedarán a la vista (un radio de unos 3 mm con lija o fresa de media caña es una decisión de diseño; la norma pide aristas redondeadas o achaflanadas, sin rebabas). Matar las aristas antes de montar es mucho más fácil que después.',
      'Escribe la letra de cada pieza en una cara que quede oculta y marca con una flecha la cara interior de travesaños y montantes: todas las medidas se toman desde ella.',
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz', 'Ingletadora o sierra con tope', 'Lija de grano 120 y taco', 'Fresadora con fresa de media caña (opcional)'],
    check: `Pon todos los barrotes de pie juntos sobre una superficie plana: ninguno debe sobresalir. Los dos travesaños de cada pareja deben medir exactamente lo mismo.`,
    tip: 'Elige para los barrotes y los travesaños superiores la madera más recta y sin nudos: son las piezas que más se ven y más se agarran.',
  });

  const pasoBarrotes = cab
    ? `Marca en los travesaños del cabecero los centros de los ${cab.n} barrotes: el primero a ${mm(cab.hueco + d / 2)} del montante y los demás cada ${mm(cab.hueco + d)}. Así cada hueco libre mide ${mm(cab.hueco)}.`
    : `Fresa en los travesaños y montantes una ranura de ${TABLERO_T} mm de ancho y ${RANURA} mm de fondo, centrada en el grueso, para alojar el tablero.`;
  b.step({
    kind: 'montar',
    title: 'Encola los paneles de los cabeceros',
    summary: liso ? 'Travesaños, montantes y tablero liso forman el panel de cada cabecero.' : 'Travesaños, montantes y barrotes forman el panel de cada cabecero.',
    detail: [
      pasoBarrotes,
      ...(cab ? [`Taladra los alojamientos de los barrotes a Ø${d} mm y ${ENTRA_BARROTE} mm de fondo con una broca de punta de centrar y tope, perpendicular a la cara (mejor con taladro de columna).`] : []),
      `Taladra ahora los pasos de los pernos del somier (Ø${AGUJERO_LIBRE} mm, de lado a lado): en el travesaño inferior a ${mm(ySomPernos(yS1)[0] - yB)} y ${mm(ySomPernos(yS1)[1] - yB)} de su cara de abajo${dos ? `, y en los montantes a ${mm(ySomPernos(yS2)[0] - yBarBot)} y ${mm(ySomPernos(yS2)[1] - yBarBot)} de su extremo inferior para la posición alta` : ''}, todos a ${mm(SOM_GAP + LARG_T / 2)} del extremo que toca el poste.`,
      ...(cab ? ['Encola los barrotes en el travesaño inferior, presenta encima el superior y ciérralo con sargentos repartiendo la presión con un listón.'] : ['Monta los montantes en los travesaños con el tablero dentro de la ranura, sin cola en el tablero: debe quedar suelto para poder moverse con la humedad.']),
      `Une los montantes a los travesaños (${union === 'tubillon' ? `un tubillón de Ø${dt} mm en cada extremo` : 'espiga de 20 mm en cada extremo'}) con cola.`,
    ],
    parts: cabPanel,
    marks: [...marksCabBars, ...marksMontRail],
    technique: {
      name: cab ? 'Barrotes encolados en taladro ciego' : 'Tablero flotante en ranura',
      why: cab
        ? 'Cada barrote entra en un taladro de su mismo diámetro: el travesaño lo sujeta por todo el contorno y el panel queda rígido sin un solo tornillo. La separación entre centros manda sobre la seguridad, por eso se marca con una plantilla.'
        : 'Un tablero macizo se mueve con la humedad. Encajado en una ranura y sin cola, puede moverse sin rajarse ni abrir huecos, y el cabecero queda liso, sin aberturas.',
      how: cab
        ? [
            `Haz una plantilla con un listón y dos tacos: un taco de ${mm(cab.hueco)} (el hueco) y otro de ${mm(cab.hueco + d)} (de centro a centro).`,
            'Pon la cola dentro de cada taladro con un palillo, no en el barrote: el taladro la rasparía.',
            'Encaja todos los barrotes en el travesaño de abajo, presenta el de arriba empezando por un extremo y cierra poco a poco.',
          ]
        : ['Fresa la ranura con fresadora y guía paralela, en dos pasadas.', 'Prueba el ajuste con un recorte del tablero.', 'Monta sin cola en el tablero; solo se encolan las uniones del marco.'],
    },
    hardware: [hw(`Tubillón estriado de haya Ø${dt} × 40 mm`, union === 'tubillon' ? marksMontRail.length : 0), hw('Cola blanca para madera (PVA)', 1, 'bote')].filter((h) => h.qty > 0),
    tools: ['Taladro de columna o guía de taladrar', `Broca de punta de centrar de ${cab ? d : TABLERO_T} mm con tope`, `Broca de ${AGUJERO_LIBRE} mm`, 'Sargentos', 'Escuadra'],
    check: cab ? `Mide con un taco de ${HUECO_MIN} mm y otro de ${HUECO_MAX} mm: el de ${HUECO_MIN} debe pasar entre todos los barrotes y el de ${HUECO_MAX} no debe pasar por ninguno, tampoco junto a los montantes.` : 'El tablero debe moverse un poco dentro de la ranura sin que se vea luz por ningún borde.',
  });

  b.step({
    kind: 'montar',
    title: 'Une los postes a cada cabecero',
    summary: 'Cada panel se encola entre dos postes y queda un cabecero rígido que ya no se desmonta.',
    detail: [
      `Tumba dos postes sobre el banco con la cara interior hacia arriba. El panel queda a ras de su cara interior, a ${mm(P - tR)} de la exterior.`,
      `Marca en los postes los travesaños: el superior a ras de la cabeza del poste y el inferior con su cara de abajo a ${mm(yB - y0)} del pie${ruedas ? ' (el poste apoya sobre la rueda)' : ''}.`,
      ...tecFija.how,
      `Encola también el canto del montante contra el poste, con ${yMont.length} tubillones de Ø${dt} mm a lo largo: el montante y el poste quedan como una sola pieza, sin rendija.`,
      `Taladra en los postes los pasos de los pernos de los laterales (Ø${AGUJERO_LIBRE} mm, en la dirección del largo de la cuna): a ${mm(yPernosLat[0] - y0)}, ${mm(yPernosLat[1] - y0)} y ${mm(yPernosLat[2] - y0)} del pie del poste, centrados a ${mm(P - tR / 2)} de su cara exterior.`,
    ],
    parts: postes,
    marks: [...marksCabPost, ...marksMontPost],
    technique: tecFija,
    hardware: [
      ...(union === 'tubillon' ? [hw(`Tubillón estriado de haya Ø${dt} × 40 mm`, marksCabPost.length + marksMontPost.length)] : [hw(`Tubillón estriado de haya Ø${dt} × 40 mm`, marksMontPost.length)]),
      hw('Cola blanca para madera (PVA)', 1, 'bote'),
    ],
    tools: union === 'tubillon'
      ? [`Broca de ${dt} mm con tope de profundidad`, `Marcadores de tubillón de ${dt} mm`, 'Sargentos largos', 'Escuadra']
      : ['Gramil de mortajar', 'Formones', 'Serrucho de costilla', 'Maza', 'Sargentos largos', 'Escuadra'],
    check: 'Mide las dos diagonales de cada cabecero: si coinciden, está a escuadra. Apoya el cabecero en el suelo: los dos postes deben tocar a la vez.',
    warning: 'No dejes secar la cola con el cabecero torcido: comprueba la escuadra antes de soltar los sargentos y deja curar la cola el tiempo que indique el bote.',
  });

  b.step({
    kind: 'montar',
    title: 'Monta los laterales y atorníllalos',
    summary: 'Encola los barrotes de los dos laterales y, cuando la cola cure, únelos a los cabeceros con pernos.',
    detail: [
      `Marca en los travesaños de los laterales los ${lat.n} barrotes: el primero a ${mm(lat.hueco + d / 2)} del extremo y los demás cada ${mm(lat.hueco + d)}. El hueco libre queda en ${mm(lat.hueco)}, también contra el poste.`,
      `Taladra los alojamientos a Ø${d} mm y ${ENTRA_BARROTE} mm de fondo, encola los barrotes y cierra cada lateral con sargentos. Deja curar la cola.`,
      desm === 'inserto'
        ? `Coloca un inserto M6 en cada testa de los travesaños: uno en el superior y dos en el inferior (a ${mm(20)} de cada canto), centrados en su grueso.`
        : `Prepara las tuercas de barril: taladra el paso del perno en la testa y el alojamiento de la tuerca por la cara exterior del travesaño, a unos 25 mm del extremo.`,
      `Presenta cada lateral entre los dos cabeceros, a ras de la cara interior de los postes, y aprieta los ${nPernosLat} pernos M6 × ${pernoLat} desde fuera.`,
    ],
    parts: latParts,
    marks: [...marksLatBars, ...marksLatPernos],
    technique: tecDesm,
    hardware: [...hwPernos(nPernosLat, pernoLat), hw('Cola blanca para madera (PVA)', 1, 'bote')],
    tools: ['Broca de punta de centrar con tope', `Broca de ${AGUJERO_LIBRE} mm`, 'Llave allen de 4 mm', 'Sargentos', 'Dos tacos de prueba de 45 y 65 mm'],
    check: `Comprueba con los tacos en todos los huecos de los laterales: el de ${HUECO_MIN} mm entra en todos y el de ${HUECO_MAX} mm en ninguno. Mide además las diagonales de la cuna en planta: deben ser iguales.`,
    warning: `No agrandes los pasos de los pernos: la norma prohíbe agujeros accesibles de 7 a 12 mm de diámetro (salvo de menos de 10 mm de fondo), y un taladro de Ø${AGUJERO_LIBRE} mm que quede libre al cambiar el somier de altura se queda por debajo de esa franja.`,
    tip: 'Monta la cuna por primera vez en la habitación donde va a estar: completa no suele pasar por una puerta.',
  });

  const posTxt = posAlta ? 'alta' : 'baja';
  b.step({
    kind: 'montar',
    title: 'Monta el somier y fíjalo',
    summary: `Las lamas se encolan y atornillan a los largueros, y el somier se atornilla a los cabeceros en la posición ${posTxt}.`,
    detail: [
      `Coloca los dos largueros de canto sobre el banco, a ${mm(W - 2 * SOM_GAP)} de fuera a fuera, y reparte las ${nL} lamas: la primera y la última a ras de los extremos y ${mm(gLama)} libres entre lamas.`,
      `Encola cada lama y fíjala con dos tornillos para madera de 4 × ${lamaScrew} mm por extremo, con taladro piloto de ${pil4} mm${dura ? ' (haya: madera dura)' : ''} y avellanado. Las lamas no se desmontan nunca, por eso aquí sí valen tornillos para madera.`,
      desm === 'inserto' ? 'Coloca un inserto M6 en cada testa de los largueros, a la altura de los taladros del cabecero.' : 'Prepara las tuercas de barril en los largueros: el alojamiento de la tuerca, por la cara interior (que queda bajo las lamas).',
      `Mete el somier entre los cabeceros con las lamas hacia arriba y atorníllalo con ${nPernosSom} pernos M6 × ${pernoSom} desde fuera, en la posición ${posTxt}: la cara de arriba de las lamas queda a ${mm(yS)} del suelo.`,
      ...(dos ? [`Para cambiar de posición: posición alta con las lamas a ${mm(yS2)} del suelo (${mm(fondoAlto)} hasta el borde), posición baja a ${mm(yS1)} (${mm(fondoBajo)} hasta el borde). Siempre con herramienta: la norma exige que bajar el somier no se pueda hacer sin ella.`] : []),
      `Escribe en la cara de abajo del somier «Espesor máximo del colchón: ${C} mm» (las etiquetas solo pueden ir por debajo del nivel del somier).`,
    ],
    parts: somier,
    marks: [...marksLamas, ...marksSomPernos],
    technique: {
      name: 'Taladro piloto y avellanado',
      why: `El taladro piloto evita que la lama se raje cerca de la testa. La USDA lo dimensiona en función del diámetro de raíz del tornillo (unos dos tercios del vástago): un 70 % de la raíz en madera blanda y un 90 % en dura, lo que da unos ${pil4} mm para un tornillo de 4 mm en ${mat}.`,
      how: ['Marca los dos puntos de cada extremo de la lama sobre el eje del larguero.', `Taladra a ${pil4} mm atravesando la lama y entrando en el larguero.`, 'Avellana para que la cabeza quede por debajo de la superficie: el colchón apoya encima.'],
    },
    hardware: [
      hw(`Tornillo para madera de cabeza avellanada 4 × ${lamaScrew} mm`, marksLamas.length),
      ...hwPernos(nPernosSom, pernoSom),
    ],
    tools: ['Taladro', `Broca de ${pil4} mm`, 'Avellanador', 'Llave allen de 4 mm', 'Flexómetro'],
    check: `Entre dos lamas no debe pasar un taco de ${LAMA_MAX} mm, y entre el somier y los laterales no debe caber un dedo de ${SOMIER_CONO} mm (quedan ${mm(SOM_GAP)} por lado). Mide desde las lamas hasta el borde superior: ${mm(yTop - yS)}.`,
    warning: 'Pon un solo colchón y nunca más grueso del indicado: cada centímetro de colchón resta altura de barandilla.',
  });

  if (ruedas) {
    b.step({
      kind: 'montar',
      title: 'Pon las ruedas',
      summary: 'Cuatro ruedas bajo los postes, dos de ellas con freno.',
      detail: [
        'Tumba la cuna de lado sobre una manta, con ayuda de otra persona.',
        `Centra la placa de cada rueda en el pie del poste (${P} × ${P} mm) y marca los agujeros.`,
        `Taladra pilotos de ${pil4} mm y atornilla la placa con tornillos para madera de 4 × 30 mm: las ruedas van fijas y no se desmontan.`,
        'Coloca las dos ruedas con freno en esquinas opuestas.',
      ],
      parts: wheels,
      marks: tornillos(xPost.flatMap((x) => zPost.flatMap((z): Vec3[] => [[x + 10, RUEDA_H, z + 10], [x + P - 10, RUEDA_H, z + 10], [x + 10, RUEDA_H, z + P - 10], [x + P - 10, RUEDA_H, z + P - 10]])), 'y'),
      hardware: [hw(`Rueda giratoria con placa de montaje (placa de ${P} × ${P} mm o menor), ${RUEDA_H} mm de alto, sin freno`, 2), hw(`Rueda giratoria con freno, misma medida`, 2), hw('Tornillo para madera de cabeza plana 4 × 30 mm', 16)],
      tools: ['Taladro', `Broca de ${pil4} mm`, 'Atornillador'],
      check: 'Con los dos frenos puestos, empuja la cuna: no debe desplazarse.',
      warning: 'La norma solo admite ruedas si hay al menos cuatro y dos se pueden bloquear (o dos ruedas y dos apoyos fijos). Mantén siempre los frenos puestos con el bebé dentro.',
    });
  }

  if (cajon) {
    const nScrewCorner = 2;
    const pilPino = piloto(4, false);
    b.step({
      kind: 'montar',
      title: 'Monta el cajón',
      summary: 'Una caja independiente que se desliza bajo el lateral, sin tocar la cuna.',
      detail: [
        `Une frente y trasera entre los dos costados con cola y ${nScrewCorner} tornillos de 4 × 45 mm por esquina, metidos desde la cara exterior de los costados (piloto de ${pilPino} mm).`,
        `Atornilla el fondo de contrachapado por debajo con tornillos de 3,5 × 16 mm cada 200 mm aproximadamente.`,
        `Haz un rebaje para los dedos en el canto superior del frente con sierra de calar y lija bien: el cajón no lleva tirador que sobresalga.`,
        `El cajón mide ${mm(hC)} de alto y deja ${mm(yB - hC)} libres bajo los travesaños.`,
      ],
      parts: cajonParts,
      marks: [
        ...tornillos([cx0, cx1].flatMap((x) => [cz0 + CAJON_T / 2, cz1 - CAJON_T / 2].flatMap((z): Vec3[] => [[x, FONDO_T + hC * 0.25, z], [x, FONDO_T + hC * 0.65, z]])), 'x'),
        ...tornillos([[cx0 + 9, 0, (cz0 + cz1) / 2], [cx1 - 9, 0, (cz0 + cz1) / 2], [(cx0 + cx1) / 2, 0, cz0 + 9], [(cx0 + cx1) / 2, 0, cz1 - 9]], 'y'),
      ],
      hardware: [
        hw('Tornillo para madera de cabeza avellanada 4 × 45 mm', 8),
        hw('Tornillo para madera de cabeza avellanada 3,5 × 16 mm', Math.max(8, Math.round((2 * (cx1 - cx0) + 2 * (cz1 - cz0)) / 200))),
        hw('Deslizador de fieltro adhesivo', 4),
      ],
      tools: ['Taladro', `Broca de ${pilPino} mm`, 'Avellanador', 'Sierra de calar', 'Sargentos'],
      tip: 'Pega los deslizadores de fieltro bajo las esquinas del fondo para que el cajón corra sin rayar el suelo.',
    });
  }

  b.step({
    kind: 'acabar',
    title: 'Lija, da el acabado y haz la revisión final',
    summary: 'Superficies suaves, un acabado apto para juguetes y una última revisión con la cuna montada.',
    detail: [
      'Repasa todas las aristas y cantos: nada de astillas, rebabas ni esquinas vivas, ni dentro ni fuera.',
      'Lija a favor de la veta pasando por granos cada vez más finos (80, 120, 180) y aspira el polvo.',
      'Usa solo un acabado cuyo fabricante declare conformidad con EN 71-3 (la norma de cunas exige que todas las partes accesibles la cumplan) y pide su ficha o informe de ensayo. Aplícalo siguiendo el bote y deja que cure del todo antes de usar la cuna.',
      `Revisión final: tacos de ${HUECO_MIN} y ${HUECO_MAX} mm en todos los huecos; ${mm(yTop - yS1)} del somier bajo al borde; pernos apretados; ninguna etiqueta por dentro por encima del somier.`,
      'Revisa y reaprieta los pernos periódicamente.',
    ],
    parts: [],
    hardware: [hw('Lija de grano 80, 120 y 180', 2, 'pliegos de cada'), hw('Aceite o barniz con declaración EN 71-3 del fabricante', 1, 'bote')],
    tools: ['Taco de lija o lijadora orbital', 'Aspirador', 'Brocha o paño de algodón', 'Mascarilla antipolvo'],
    warning: 'No pintes con restos de pintura de casa ni con productos sin ficha: el bebé va a chupar y morder los travesaños.',
    tip: 'Prueba el acabado en un recorte de la misma madera antes de aplicarlo a la cuna.',
  });

  const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
  return b.finish({
    id: 'cuna',
    title: 'Cuna',
    craft: 'carpinteria',
    summary: `Cuna de ${mat} para colchón de ${cl / 10} × ${cw / 10} cm, barrotes de Ø${d} mm con ${fmt1(lat.hueco)} mm libres y somier ${dos ? 'a dos alturas' : 'a una altura'}.`,
    difficulty: 3,
    hours: 18 + (union === 'espiga' ? 6 : 0) + (cajon ? 3 : 0) + (ruedas ? 1 : 0) + (liso ? 1 : 0),
    dims: [2 * P + L, yTop, 2 * P + W],
    safety: [
      'Esta cuna aplica las dimensiones publicadas de EN 716-1 y de los resúmenes españoles, pero una cuna hecha en casa NO está ensayada ni certificada: los ensayos de la norma (resistencia, estabilidad, durabilidad, enganches) no se pueden reproducir en un taller doméstico.',
      `Huecos entre barrotes: entre ${HUECO_MIN} y ${HUECO_MAX} mm (EN 716-1 4.4.2.1). Con este diseño quedan ${fmt1(lat.hueco)} mm en los laterales${cab ? ` y ${fmt1(cab.hueco)} mm en los cabeceros` : ''}. Comprueba cada hueco con tacos de 45 y 65 mm.`,
      'Usa un solo colchón, del tamaño indicado y sin superar el espesor máximo. La posición más baja del somier es la más segura; deja de usar la cuna cuando el niño pueda salir trepando (instrucciones que la norma pide incluir).',
      'Ninguna pieza desmontable se fija con tornillo para madera: laterales y somier van con pernos métricos (EN 716-1 4.4.1.2). Revisa que estén apretados.',
      'Nada de cordones, cintas, protectores atados ni objetos colgados en los barrotes.',
      'Gafas de protección al cortar y taladrar, y mascarilla antipolvo al lijar (el polvo de haya es de madera dura).',
    ],
    notes: [
      'Aviso honesto: este diseño se ha hecho con la vista previa del borrador FprEN 716-1:2015 y con resúmenes de laboratorios y organismos; la edición vigente en España (UNE-EN 716-1:2018+AC:2019) es de pago y no se ha podido consultar entera. Si la cuna se va a regalar o vender, debe ensayarse en un laboratorio acreditado.',
      `Altura en posición baja: ${mm(fondoBajo)} desde el somier, es decir ${mm(fondoBajo - C)} desde la cara de arriba de un colchón de ${C} mm (la norma pide ≥ 500 mm; la AEP, citada por Consumer, 60 cm desde el punto más profundo).`,
      ...(dos ? [`Altura en posición alta: ${mm(fondoAlto)} desde el somier, ${mm(fondoAlto - C)} desde el colchón (la norma pide ≥ 200 mm; la AEP, 30 cm).`] : ['Somier a una sola altura, en la posición baja.']),
      `Holgura del colchón: ${HOLG} mm en total en cada sentido (el interior mide 10 mm más que el colchón). Con el colchón empujado contra un lado quedan ${fmt1(holguraAncho)} mm hasta los barrotes; el límite es 30 mm (norma) y la AEP pide no más de 2 cm por lado.`,
      `Lamas: ${nL} de ${LAMA_W} mm con ${fmt1(gLama)} mm libres (máximo 60 mm).${nL !== Math.round(Number(v.lamas)) ? ` Se ha ajustado el número pedido (${Math.round(Number(v.lamas))}) para respetar ese máximo o dejar al menos 20 mm de ventilación.` : ''}`,
      `Los pasos de los pernos se taladran a Ø${AGUJERO_LIBRE} mm para que los que queden libres al cambiar el somier de altura no caigan en la franja prohibida de 7 a 12 mm.`,
      'Sin apoyos para el pie: el único travesaño horizontal del interior es el inferior, que queda a ras del somier en la posición baja. No añadas listones, repisas ni adornos en la cara interior.',
      'Los postes acaban a ras de los travesaños superiores: no les pongas remates ni pomos que sobresalgan.',
      ...(cajon ? ['El cajón es una caja independiente: no forma parte de la cuna ni la refuerza.'] : []),
    ],
    sources: SOURCES,
    spec: [
      { label: 'Colchón', value: `${cl / 10} × ${cw / 10} cm, espesor máximo ${C} mm` },
      { label: 'Interior', value: `${L} × ${W} mm` },
      { label: 'Medidas exteriores', value: `${2 * P + L} × ${2 * P + W} × ${yTop} mm (largo × ancho × alto)` },
      { label: 'Barrotes', value: `Ø${d} mm · ${lat.n} por lateral${cab ? `, ${cab.n} por cabecero` : ''}` },
      { label: 'Hueco libre entre barrotes', value: `${fmt1(lat.hueco)} mm laterales${cab ? ` · ${fmt1(cab.hueco)} mm cabeceros` : ''} (norma: 45–65 mm)` },
      { label: 'Altura sobre el somier', value: dos ? `${fondoBajo} mm baja · ${fondoAlto} mm alta` : `${fondoBajo} mm` },
      { label: 'Altura sobre el colchón', value: dos ? `${fondoBajo - C} mm baja · ${fondoAlto - C} mm alta (norma: ≥ 500 / ≥ 200)` : `${fondoBajo - C} mm (norma: ≥ 500)` },
      { label: 'Somier montado en', value: posAlta ? 'Posición alta' : 'Posición baja' },
      { label: 'Lamas', value: `${nL} lamas, ${fmt1(gLama)} mm entre ellas (máx. 60)` },
      { label: 'Holgura del colchón', value: `${fmt1(holguraAncho)} mm máx. contra un lado (máx. 30)` },
      { label: 'Cabeceros', value: liso ? 'Tablero liso en ranura' : 'De barrotes' },
      { label: 'Postes', value: `${P} × ${P} mm` },
      { label: 'Ruedas', value: ruedas ? '4, dos con freno' : 'No' },
      { label: 'Cajón', value: cajon ? `Sí, ${hC} mm de alto` : 'No' },
      { label: 'Madera', value: mat === 'haya' ? 'Haya' : 'Pino' },
      { label: 'Uniones', value: `${tecFija.name} (fijas) · ${tecDesm.name.replace('Unión desmontable con ', 'perno ')}` },
    ],
  });
}
