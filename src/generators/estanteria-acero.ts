import type { Axis, Generator, HardwareLine, Mark, ParamValues, Project, SourceRef, Vec3 } from '../core/types';
import { Builder, cordon, cordonPerimetral, hw, mm, punto, repartir, tornillos } from '../core/builder';

/**
 * ESTANTERÍA METÁLICA DE TALLER
 * Dos bastidores laterales tipo escalera (postes + travesaños de tubo soldado) unidos por
 * largueros delanteros y traseros a cada nivel; las baldas de tablero se apoyan sobre los
 * largueros. Los largueros pueden ir soldados o atornillados a orejas de pletina (desmontable).
 */

const SRC = {
  lincoln6013: { label: 'Lincoln Electric: Fleetweld 37 (E6013), ficha de producto', url: 'https://cdn.shopify.com/s/files/1/2778/4524/files/c21019.pdf' },
  lincolnGuia: { label: 'Lincoln Electric: Stick Electrode Welding Guide', url: 'https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f' },
  innershield: { label: 'Lincoln Electric: Innershield (FCAW-S) NR-211-MP, procedimientos típicos', url: 'https://ch-delivery.lincolnelectric.com/api/public/content/5b1a00933782415e98e56639deb63f45?v=405651b4' },
  osha: { label: 'OSHA 1910.252: Welding, cutting and brazing. General requirements', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.252' },
  ntp494: { label: 'INSST NTP 494: Soldadura eléctrica al arco. Normas de seguridad', url: 'https://www.insst.es/documentacion/colecciones-tecnicas/ntp-notas-tecnicas-de-prevencion/14-serie-ntp-numeros-471-a-505-ano-1999/ntp-494-soldadura-electrica-al-arco-normas-de-seguridad' },
  hse: { label: 'HSE: Change in enforcement expectations for mild steel welding fume', url: 'https://www.hse.gov.uk/safetybulletins/mild-steel-welding-fume.htm' },
  twiTack: { label: 'TWI: What is a tack weld?', url: 'https://www.twi-global.com/technical-knowledge/faqs/what-is-a-tack-weld' },
  twiDist: { label: 'TWI: What are the factors affecting distortion?', url: 'https://www.twi-global.com/technical-knowledge/faqs/faq-what-are-the-factors-affecting-distortion' },
  twiFiebre: { label: 'TWI: What is metal fume fever?', url: 'https://www.twi-global.com/technical-knowledge/faqs/faq-what-is-metal-fume-fever' },
  millerStick: { label: 'Miller: Five steps to improving your stick welding technique', url: 'https://millerwelds.com/resources/article-library/five-steps-to-improving-your-stick-welding-technique' },
  millerMig: { label: 'Miller: Tips for troubleshooting common MIG weld defects', url: 'https://www.millerwelds.com/resources/article-library/troubleshooting-weld-defects' },
  sagulator: { label: 'Fine Woodworking: Engineer shelves with the Sagulator', url: 'https://www.finewoodworking.com/2007/01/05/engineer-shelves-with-the-sagulator' },
  ikeaKallax: { label: 'IKEA KALLAX, instrucciones de montaje (aviso de vuelco y anclaje a pared)', url: 'https://www.ikea.com/es/es/assembly_instructions/kallax-estanteria-blanco__AA-2703431-1-2.pdf' },
} satisfies Record<string, SourceRef>;

const TUBOS: Record<string, { s: number; w: number; label: string }> = {
  '30x1.5': { s: 30, w: 1.5, label: '30 × 30 × 1,5 mm' },
  '30x2': { s: 30, w: 2, label: '30 × 30 × 2 mm' },
  '40x1.5': { s: 40, w: 1.5, label: '40 × 40 × 1,5 mm' },
  '40x2': { s: 40, w: 2, label: '40 × 40 × 2 mm' },
};

const T = 18; // grueso de las baldas (decisión de diseño)
const OREJA_L = 60; // lo que sobresale la oreja del poste
const OREJA_T = 4; // grueso de la oreja
const PIE_T = 5; // grueso de la placa de pie
const NIV_H = 30; // altura del nivelador dibujado
const RB_W = 50; // ancho de la pletina del reborde
const RB_T = 3;
const RB_SOBRE = 15; // lo que sobresale el reborde por encima de la balda
const CRUZ_W = 30; // ancho de la pletina de la cruz
const CRUZ_T = 3;

type Proceso = 'electrodo' | 'hilo';
const PROC: Record<Proceso, { name: string; ajuste: string; careta: string; tools: string[]; consumible: HardwareLine }> = {
  electrodo: {
    name: 'Electrodo revestido E6013 (MMA)',
    ajuste:
      'Usa E6013 de diámetro pequeño. Como orientación, la ficha Lincoln Fleetweld 37 (E6013) da para Ø2,0 mm 45–75 A en continua (50–80 A en alterna) y para Ø2,4 mm 70–105 A en continua (75–115 A en alterna). Empieza por la parte baja del rango impreso en la caja de tus electrodos y sube de 5 en 5 A tras probar en un recorte del mismo tubo.',
    careta: 'OSHA indica filtro de sombra 10 para electrodo revestido de 1/16 a 5/32 in; los de 2,0 y 2,4 mm están en ese rango.',
    tools: ['Equipo inverter de soldadura por electrodo (MMA)', 'Piqueta y cepillo de alambre'],
    consumible: hw('Electrodos de rutilo E6013 de Ø2,0 o Ø2,4 mm (paquete pequeño)', 1, 'paquete'),
  },
  hilo: {
    name: 'Hilo tubular sin gas (E71T-11)',
    ajuste:
      'Hilo tubular autoprotegido E71T-11 de 0,8 mm (0,030 in) con polaridad DC− (pinza al negativo). En la guía Lincoln Innershield NR-211-MP, los procedimientos típicos para ese hilo van de 13–14 V con 1,3 m/min (unos 30 A) a 14–15 V con 5,1 m/min (unos 100 A). En pared fina empieza por abajo y ajusta en un recorte. Suelda arrastrando y con el hilo sobresaliendo de la boquilla no más de 1/2 in (unos 12,7 mm), como indica Miller.',
    careta: 'La tabla de filtros de OSHA no menciona de forma expresa el hilo tubular: usa una careta con filtro certificado y el tono que indiquen el fabricante de la careta y el manual de tu equipo.',
    tools: ['Equipo de soldadura de hilo con polaridad reversible (hilo tubular sin gas)', 'Cepillo de alambre'],
    consumible: hw('Bobina de hilo tubular sin gas E71T-11 de 0,8 mm', 1, 'bobina'),
  },
};

const AXI: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;
const r1 = (n: number) => Math.round(n * 10) / 10;

function sectionOf(axis: Axis, size: Vec3): [number, number] {
  if (axis === 'y') return [size[0], size[2]];
  if (axis === 'x') return [size[1], size[2]];
  return [size[0], size[1]];
}

interface Joint { c: Vec3; axis: Axis; w: number; h: number; tack: Axis }
function endJoint(lo: Vec3, hi: Vec3, axis: Axis, end: 'min' | 'max', tack: Axis): Joint {
  const i = AXI[axis];
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  c[i] = end === 'min' ? lo[i] : hi[i];
  const [u, v] = ([0, 1, 2] as const).filter((k) => k !== i);
  return { c, axis, w: hi[u] - lo[u], h: hi[v] - lo[v], tack };
}
const bothEnds = (lo: Vec3, hi: Vec3, axis: Axis, tack: Axis) => [endJoint(lo, hi, axis, 'min', tack), endJoint(lo, hi, axis, 'max', tack)];
function tackMarks(js: Joint[]): Mark[] {
  return js.flatMap((j) => {
    const i = AXI[j.axis];
    const [u] = ([0, 1, 2] as const).filter((k) => k !== i);
    const k = AXI[j.tack];
    const half = k === u ? j.w / 2 : j.h / 2;
    const a: Vec3 = [...j.c], b: Vec3 = [...j.c];
    a[k] -= half; b[k] += half;
    return [punto(a), punto(b)];
  });
}
const weldMarks = (js: Joint[]): Mark[] => js.flatMap((j) => cordonPerimetral(j.c, j.axis, j.w, j.h));

/** Unión en línea (pletina sobre tubo): puntos en los extremos del cordón. */
interface Seam { a: Vec3; b: Vec3 }
const seamTacks = (ss: Seam[]): Mark[] => ss.flatMap((s) => [punto(s.a), punto(s.b)]);
const seamWelds = (ss: Seam[]): Mark[] => ss.map((s) => cordon(s.a, s.b));

export const estanteriaAcero: Generator = {
  id: 'estanteria-acero',
  title: 'Estantería metálica',
  craft: 'soldadura',
  difficulty: 2,
  description:
    'Estantería de taller o trastero: dos laterales tipo escalera de tubo soldado unidos por largueros, con baldas de tablero apoyadas. Largueros soldados o atornillados para poder desmontarla.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 600, max: 2000, step: 10, unit: 'mm', default: 1000, group: 'Medidas' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 300, max: 800, step: 10, unit: 'mm', default: 400, group: 'Medidas' },
    { key: 'alto', label: 'Alto total', type: 'number', min: 1000, max: 2400, step: 10, unit: 'mm', default: 1800, group: 'Medidas', help: 'Del suelo a la cara superior de la balda de arriba.' },
    { key: 'primera', label: 'Altura de la primera balda', type: 'number', min: 100, max: 500, step: 10, unit: 'mm', default: 150, group: 'Medidas', help: 'Cara superior de la balda más baja, medida desde el suelo.' },
    { key: 'niveles', label: 'Número de baldas', type: 'number', min: 2, max: 7, step: 1, unit: 'ud', default: 5, group: 'Forma', help: 'Se reparten a la misma distancia entre la primera y la de arriba.' },
    {
      key: 'tubo', label: 'Sección del tubo', type: 'select', default: '30x2', group: 'Forma',
      options: [
        { value: '30x1.5', label: '30 × 30 × 1,5 mm', hint: 'Ligera; pared fina, más fácil de perforar' },
        { value: '30x2', label: '30 × 30 × 2 mm', hint: 'Buena para empezar a soldar' },
        { value: '40x1.5', label: '40 × 40 × 1,5 mm' },
        { value: '40x2', label: '40 × 40 × 2 mm', hint: 'Más robusta y más pesada' },
      ],
    },
    { key: 'cruz', label: 'Cruz de arriostrado trasera', type: 'boolean', default: true, group: 'Detalles', help: 'Dos pletinas en diagonal detrás que impiden que la estantería se descuadre de lado.' },
    {
      key: 'pies', label: 'Pies', type: 'select', default: 'placa', group: 'Detalles',
      options: [
        { value: 'tapon', label: 'Tapón de plástico', hint: 'El tubo apoya directamente' },
        { value: 'placa', label: 'Placa de pletina soldada', hint: 'Reparte el apoyo y no marca el suelo' },
        { value: 'niveladores', label: 'Placa con nivelador roscado', hint: 'Para suelos que no están planos' },
      ],
    },
    { key: 'anclaje', label: 'Anclaje a pared', type: 'boolean', default: true, group: 'Detalles', help: 'Escuadras en la parte alta de los postes traseros para atornillarla a la pared y que no vuelque.' },
    { key: 'reborde', label: 'Reborde en las baldas', type: 'boolean', default: false, group: 'Detalles', help: 'Pletina soldada al larguero delantero que sobresale por encima de la balda y la retiene.' },
    {
      key: 'tablero', label: 'Baldas', type: 'select', default: 'contrachapado', group: 'Material',
      options: [
        { value: 'contrachapado', label: 'Contrachapado de 18 mm' },
        { value: 'dm', label: 'DM de 18 mm', hint: 'Evítalo si el trastero es húmedo' },
        { value: 'pino', label: 'Tablero alistonado de pino de 18 mm' },
      ],
    },
    {
      key: 'union', label: 'Largueros', type: 'select', default: 'soldados', group: 'Uniones',
      options: [
        { value: 'soldados', label: 'Soldados a los postes', hint: 'Más rígida, de una pieza' },
        { value: 'atornillados', label: 'Atornillados (desmontable)', hint: 'Orejas de pletina soldadas y tornillos M8 con tuerca' },
      ],
    },
    {
      key: 'proceso', label: 'Equipo de soldadura', type: 'select', default: 'electrodo', group: 'Uniones',
      options: [
        { value: 'electrodo', label: 'Electrodo revestido (inverter MMA)' },
        { value: 'hilo', label: 'Hilo tubular sin gas' },
      ],
    },
  ],
  presets: [
    {
      id: 'trastero', name: 'Estantería de trastero',
      blurb: '100 × 40 × 180 cm, cinco baldas, desmontable para la mudanza.',
      values: { ancho: 1000, fondo: 400, alto: 1800, primera: 150, niveles: 5, tubo: '30x2', cruz: true, pies: 'placa', anclaje: true, reborde: false, tablero: 'contrachapado', union: 'atornillados', proceso: 'electrodo' },
    },
    {
      id: 'taller', name: 'Estantería de taller',
      blurb: '150 × 60 × 200 cm en tubo de 40, con niveladores y reborde para que nada ruede.',
      values: { ancho: 1500, fondo: 600, alto: 2000, primera: 200, niveles: 5, tubo: '40x2', cruz: true, pies: 'niveladores', anclaje: true, reborde: true, tablero: 'contrachapado', union: 'soldados', proceso: 'hilo' },
    },
    {
      id: 'baja', name: 'Estantería baja',
      blurb: '80 × 30 × 100 cm con tres baldas: bajo una ventana o junto al banco.',
      values: { ancho: 800, fondo: 300, alto: 1000, primera: 120, niveles: 3, tubo: '30x1.5', cruz: false, pies: 'tapon', anclaje: true, reborde: false, tablero: 'pino', union: 'soldados', proceso: 'electrodo' },
    },
  ],
  build,
};

function build(v: ParamValues): Project {
  const b = new Builder();
  const refMap = new Map<string, string>();
  const R = (key: string) => {
    if (!refMap.has(key)) refMap.set(key, String.fromCharCode(65 + refMap.size));
    return refMap.get(key)!;
  };

  const W = Number(v.ancho), D = Number(v.fondo), H = Number(v.alto);
  const tubo = TUBOS[String(v.tubo)] ?? TUBOS['30x2'];
  const s = tubo.s, wall = tubo.w;
  const proc = PROC[(v.proceso as Proceso) ?? 'electrodo'];
  const bolted = v.union === 'atornillados';
  const pies = String(v.pies);
  const cruz = v.cruz === true;
  const anclaje = v.anclaje === true;
  const reborde = v.reborde === true;
  const mat = (v.tablero as 'contrachapado' | 'dm' | 'pino') ?? 'contrachapado';

  // --- alturas ---
  const footH = pies === 'niveladores' ? NIV_H + PIE_T : pies === 'placa' ? PIE_T : 0;
  const yTop = H - T; // cabeza de los postes
  const postLen = yTop - footH;
  const yTopL = yTop - s; // cara inferior del larguero de arriba
  let yL0 = Number(v.primera) - T - s;
  yL0 = Math.max(yL0, footH + (bolted ? s : 0));
  const minSp = s + T + 100 + (bolted ? s : 0);
  let n = Number(v.niveles);
  const notas: string[] = [];
  while (n > 2 && (yTopL - yL0) / (n - 1) < minSp) n--;
  if (n < Number(v.niveles)) notas.push(`Con este alto solo caben ${n} baldas con al menos ${mm(minSp - s - T)} de hueco entre ellas; se han quitado las que no caben.`);
  const levels = repartir(yL0, yTopL, n);
  const sp = n > 1 ? (yTopL - yL0) / (n - 1) : 0;
  const huecoLibre = sp - s - T;

  const tuboP = (name: string, axis: Axis, lo: Vec3, hi: Vec3) => {
    const size: Vec3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const length = r1(size[AXI[axis]]);
    const sec = sectionOf(axis, size).map(r1) as [number, number];
    return b.tubo({ ref: R(`tubo:${length}`), name, section: sec, length, axis, at: lo, wall });
  };

  // --- laterales ---
  const jLat: Joint[] = [];
  const seamLat: Seam[] = [];
  const latIds: string[] = [];
  const sides = [0, W - s];
  const postC: [number, number][] = [];
  for (const x0 of sides) {
    for (const z0 of [D - s, 0]) {
      latIds.push(tuboP('Poste', 'y', [x0, footH, z0], [x0 + s, yTop, z0 + s]));
      postC.push([x0 + s / 2, z0 + s / 2]);
    }
    for (const yl of levels) {
      const y = bolted ? yl - s : yl;
      const lo: Vec3 = [x0, y, s], hi: Vec3 = [x0 + s, y + s, D - s];
      latIds.push(tuboP('Travesaño lateral', 'z', lo, hi));
      jLat.push(...bothEnds(lo, hi, 'z', 'x'));
    }
  }
  // Orejas (largueros atornillados)
  const orejaIds: string[] = [];
  const boltPts: Vec3[] = [];
  if (bolted) {
    for (const yl of levels) {
      for (const [x0, left] of [[0, true], [W - s - OREJA_L, false]] as const) {
        for (const front of [true, false]) {
          const z0 = front ? D - s - OREJA_T : s;
          orejaIds.push(b.pletina({ ref: R('oreja'), name: 'Oreja del larguero', section: [s, OREJA_T], length: s + OREJA_L, axis: 'x', at: [x0, yl, z0] }));
          const zf = front ? D - s : s; // cara del poste donde apoya
          const xa = left ? 0 : W - s, xb = left ? s : W;
          seamLat.push({ a: [xa, yl + s, zf], b: [xb, yl + s, zf] }, { a: [xa, yl, zf], b: [xb, yl, zf] });
          const xs = left ? [s + 15, s + 45] : [W - s - 15, W - s - 45];
          for (const x of xs) boltPts.push([x, yl + s / 2, front ? D : 0]);
        }
      }
    }
  }
  // Pies
  const pieIds: string[] = [];
  const PW = s + 20;
  if (pies !== 'tapon') {
    for (const [cx, cz] of postC) {
      pieIds.push(b.pletina({ ref: R('placa'), name: 'Placa de pie', section: [PIE_T, PW], length: PW, axis: 'x', at: [cx - PW / 2, footH - PIE_T, cz - PW / 2] }));
      jLat.push(endJoint([cx - s / 2, footH, cz - s / 2], [cx + s / 2, yTop, cz + s / 2], 'y', 'min', 'z'));
    }
  }

  // --- largueros, rebordes y cruz ---
  const jSet: Joint[] = [];
  const seamSet: Seam[] = [];
  const largIds: string[] = [];
  for (const yl of levels) {
    for (const z0 of [D - s, 0]) {
      const lo: Vec3 = [s, yl, z0], hi: Vec3 = [W - s, yl + s, z0 + s];
      largIds.push(tuboP('Larguero', 'x', lo, hi));
      if (!bolted) jSet.push(...bothEnds(lo, hi, 'x', 'y'));
    }
  }
  const rbIds: string[] = [];
  const rbX0 = bolted ? s + 70 : s, rbX1 = bolted ? W - s - 70 : W - s;
  if (reborde) {
    for (const yl of levels) {
      const y0 = yl + s + T + RB_SOBRE - RB_W;
      rbIds.push(b.pletina({ ref: R(`reborde:${rbX1 - rbX0}`), name: 'Reborde de la balda', section: [RB_W, RB_T], length: rbX1 - rbX0, axis: 'x', at: [rbX0, y0, D] }));
      const nSt = Math.max(2, Math.round((rbX1 - rbX0) / 250));
      for (const xc of repartir(rbX0 + 30, rbX1 - 30, nSt)) seamSet.push({ a: [xc - 20, y0, D], b: [xc + 20, y0, D] });
    }
  }
  const cruzIds: string[] = [];
  const cruzBolts: Vec3[] = [];
  let cruzLen = 0, halfLen = 0;
  if (cruz) {
    const yA = yL0 + s + 30, yB = yTopL - (bolted ? s : 0) - 30;
    const xA = s / 2, xB = W - s / 2;
    const dx = xB - xA, dy = yB - yA;
    const L = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const C: Vec3 = [(xA + xB) / 2, (yA + yB) / 2, -CRUZ_T / 2];
    const gap = CRUZ_W / Math.max(0.2, Math.sin(2 * th));
    const hl = L / 2 - gap / 2;
    cruzLen = L; halfLen = hl;
    const full = b.pletina({ ref: R('cruz-entera'), name: 'Diagonal entera de la cruz', section: [CRUZ_W, CRUZ_T], length: r1(L), axis: 'x', at: [C[0] - L / 2, C[1] - CRUZ_W / 2, -CRUZ_T] });
    b.rotate(full, [0, 0, th]);
    cruzIds.push(full);
    const d2: [number, number] = [-Math.cos(th), Math.sin(th)];
    for (const sg of [1, -1]) {
      const cx = C[0] + sg * d2[0] * (gap / 2 + hl / 2), cy = C[1] + sg * d2[1] * (gap / 2 + hl / 2);
      const id = b.pletina({ ref: R('cruz-media'), name: 'Media diagonal de la cruz', section: [CRUZ_W, CRUZ_T], length: r1(hl), axis: 'x', at: [cx - hl / 2, cy - CRUZ_W / 2, -CRUZ_T] });
      b.rotate(id, [0, 0, -th]);
      cruzIds.push(id);
      // unión a tope de la media diagonal contra la entera (cara vista, z = -CRUZ_T)
      const ex = C[0] + sg * d2[0] * (gap / 2), ey = C[1] + sg * d2[1] * (gap / 2);
      const nx = -d2[1], ny = d2[0];
      seamSet.push({ a: [ex - (nx * CRUZ_W) / 2, ey - (ny * CRUZ_W) / 2, -CRUZ_T], b: [ex + (nx * CRUZ_W) / 2, ey + (ny * CRUZ_W) / 2, -CRUZ_T] });
    }
    // extremos sobre los postes traseros
    const ends: [number, number, number][] = [[xA, yA, th], [xB, yB, th], [xB, yA, -th], [xA, yB, -th]];
    for (const [ex, ey, ang] of ends) {
      if (bolted) cruzBolts.push([ex, ey, -CRUZ_T]);
      else {
        // borde del extremo, perpendicular a la diagonal, sobre la cara trasera del poste (z = 0)
        const px = -Math.sin(ang), py = Math.cos(ang);
        seamSet.push({ a: [ex - (px * CRUZ_W) / 2, ey - (py * CRUZ_W) / 2, 0], b: [ex + (px * CRUZ_W) / 2, ey + (py * CRUZ_W) / 2, 0] });
      }
    }
  }

  // --- baldas, pies, anclaje ---
  const baldaIds = levels.map((yl) => b.panel({ ref: R('balda'), name: 'Balda', material: mat, thickness: T, face: [W - 2 * s, D], normal: 'y', at: [s, yl + s, 0] }));
  const nivIds: string[] = [];
  if (pies === 'niveladores') {
    for (const [cx, cz] of postC) nivIds.push(b.herraje({ ref: R('nivelador'), name: 'Nivelador', size: [30, NIV_H, 30], at: [cx - 15, 0, cz - 15], stock: 'Pie nivelador con espárrago roscado M8 y base giratoria' }));
  }
  const ancIds: string[] = [];
  const ancPts: Vec3[] = [];
  if (anclaje) {
    for (const [x0, xm] of [[-3, -3], [W, W + 3]] as const) {
      ancIds.push(b.herraje({ ref: R('escuadra'), name: 'Escuadra de anclaje a pared', size: [3, 40, 50], at: [x0, yTop - 60, -10], stock: 'Escuadra de acero en L de 40 × 40 mm con taladros' }));
      ancPts.push([xm, yTop - 40, s / 2]);
    }
  }

  // ---------- textos ----------
  const boltL = ceil5(s + OREJA_T + 14);
  const cruzBoltL = ceil5(CRUZ_T + s + 14);
  const ancBoltL = ceil5(s + 3 + 14);
  const tecPunteo = {
    name: 'Punteado antes de soldar',
    why: 'Los puntos son soldaduras pequeñas y provisionales que fijan la posición antes de los cordones. Si algo queda torcido, un punto pequeño se quita con la amoladora y se rehace (TWI). En pared fina, un punto grande perfora el tubo.',
    how: [
      'Sujeta las piezas con sargentos o mordazas sobre una superficie plana, con la pinza de masa bien apretada.',
      'Da un punto corto en una cara de la unión, comprueba la escuadra y da el segundo en la cara opuesta.',
      'Usa algo menos de calor que para el cordón y quita la escoria de cada punto.',
    ],
  };
  const tecCordon = {
    name: `Cordones cortos alternando lados (${proc.name})`,
    why: 'Cada cordón encoge el acero al enfriarse y tira de la pieza. TWI recomienda poco volumen de soldadura y un orden que equilibre esas tensiones; repartir los cordones evita que un lateral se arquee. En tubo fino, Miller recomienda cordón recto sin balanceo.',
    how: [
      proc.ajuste,
      'Suelda un lado de una unión, pasa a la unión simétrica del otro poste o del otro lateral y vuelve: nunca cierres seguidos los cuatro lados de la misma unión.',
      'Si perforas, baja el amperaje (o la velocidad de hilo) y avanza algo más deprisa. Lincoln recomienda un respaldo de cobre detrás de la junta cuando sea posible.',
      'Pica la escoria y cepilla cada cordón antes de dar el siguiente.',
    ],
  };

  b.step({
    kind: 'cortar',
    title: 'Corta el tubo, las pletinas y las baldas',
    summary: 'Deja todas las piezas a medida y marcadas antes de soldar nada.',
    detail: [
      `Corta los cuatro postes de ${tubo.label} a ${mm(postLen)}, los ${levels.length * 2} travesaños laterales a ${mm(D - 2 * s)} y los ${levels.length * 2} largueros a ${mm(W - 2 * s)}.`,
      'Corta siempre con tope o marcando todas las piezas iguales a la vez: los postes tienen que salir idénticos.',
      'Quita la rebaba de cada corte con lima o disco de láminas para que las uniones cierren a tope.',
      ...(bolted ? [`Corta ${orejaIds.length} orejas de pletina de ${mm(s + OREJA_L)}.`] : []),
      ...(cruz ? [`Para la cruz, corta una diagonal entera de ${mm(cruzLen)} y dos medias de ${mm(halfLen)}; presenta las medias sobre la entera y marca el ángulo real del corte antes de cortarlas.`] : []),
      `Corta ${levels.length} baldas de ${mm(W - 2 * s)} × ${mm(D)}.`,
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de herrero', 'Rotulador de metal', 'Tronzadora o amoladora con disco de corte', 'Lima o disco de láminas', 'Sierra para el tablero'],
    check: 'Junta los cuatro postes de pie: ninguno debe sobresalir.',
    warning: 'Con la amoladora usa gafas o pantalla, guantes y protección auditiva, y sujeta el tubo en un tornillo de banco.',
  });

  b.step({
    kind: 'preparar',
    title: 'Limpia y marca los niveles',
    summary: 'Metal limpio y marcas de altura iguales en los cuatro postes.',
    detail: [
      'Desengrasa los extremos de cada tubo justo antes de soldar: TWI relaciona la grasa y la humedad con la porosidad.',
      'Quita la cascarilla o el óxido con cepillo o disco de láminas alrededor de cada unión. Si el tubo es galvanizado, retira el zinc de la zona (TWI).',
      `Junta los cuatro postes y marca a la vez, desde el extremo inferior, la cara baja de cada ${bolted ? 'oreja' : 'larguero'}: ${levels.map((y) => mm(y - footH)).join(', ')}.`,
      `Las baldas quedarán a ${mm(sp)} entre ejes, con ${mm(huecoLibre)} libres entre una balda y el larguero de encima.`,
    ],
    parts: [],
    tools: ['Cepillo de alambre o disco de láminas', 'Desengrasante no clorado', 'Escuadra', 'Rotulador de metal'],
    warning: 'No uses desengrasantes clorados cerca de la soldadura: el INSST advierte del riesgo de formación de fosgeno.',
  });

  b.step({
    kind: 'soldar',
    title: 'Puntea los dos laterales en plano',
    summary: `Cada lateral es una escalera: dos postes y ${levels.length} travesaños${bolted ? ', más sus orejas' : ''}${pies !== 'tapon' ? ' y sus placas de pie' : ''}.`,
    detail: [
      `Tumba dos postes sobre la mesa a ${mm(D - 2 * s)} entre caras interiores y coloca los travesaños ${bolted ? `con su cara superior en las marcas (justo debajo de cada oreja)` : 'en las marcas'}.`,
      'Puntea cada travesaño con un punto arriba y otro abajo, mide las diagonales, corrige y termina de puntear.',
      ...(bolted ? [`Puntea las orejas en la cara interior de cada poste (la que mira al otro poste del mismo frente), con su borde inferior en la marca y sobresaliendo ${mm(OREJA_L)} hacia el centro.`] : []),
      ...(pies === 'niveladores' ? ['Taladra cada placa en el centro, suelda encima una tuerca M8 centrada y puntea la placa bajo el poste.'] : pies === 'placa' ? ['Puntea una placa centrada bajo cada poste.'] : []),
      'Haz el segundo lateral encima del primero, como plantilla, para que salgan idénticos.',
    ],
    parts: [...latIds, ...orejaIds, ...pieIds],
    marks: [...tackMarks(jLat), ...seamTacks(seamLat)],
    technique: tecPunteo,
    hardware: [proc.consumible, ...(pies === 'niveladores' ? [hw('Tuerca hexagonal M8 (para soldar sobre la placa)', 4)] : [])],
    tools: [...proc.tools, 'Careta de soldar', 'Guantes de soldador', 'Sargentos o mordazas', 'Escuadra magnética', 'Flexómetro'],
    check: 'Las dos diagonales de cada lateral deben ser iguales, y los dos laterales deben coincidir al ponerlos uno encima de otro.',
    tip: 'Puntea en esquinas opuestas, no en la de al lado: así el lateral se cierra igual por los dos lados.',
    warning: proc.careta,
  });

  b.step({
    kind: bolted ? 'montar' : 'soldar',
    title: bolted ? 'Presenta y atornilla los largueros' : 'Puntea los largueros entre los laterales',
    summary: bolted ? 'Monta la estructura en seco para taladrar los largueros y orejas a la vez.' : 'Los dos laterales se unen con un larguero delante y otro detrás en cada nivel.',
    detail: [
      `Pon de pie los dos laterales a ${mm(W - 2 * s)} entre caras interiores, sujetos con sargentos y escuadras magnéticas.`,
      ...(bolted
        ? [
            'Apoya cada larguero contra sus orejas, a ras de la cara exterior del poste, y sujétalo con una mordaza.',
            `Taladra a la vez larguero y oreja, de lado a lado, en los ${boltPts.length} puntos marcados (a ${mm(15)} y ${mm(45)} del poste), con broca de paso para M8.`,
            `Mete un tornillo M8 × ${boltL} mm con arandela por fuera y tuerca autoblocante por dentro en cada agujero.`,
          ]
        : [
            'Coloca cada larguero en sus marcas, a ras de la cara exterior de los postes, y puntéalo arriba y abajo en los dos extremos.',
            'Empieza por el nivel de abajo y el de arriba: con esos cuatro largueros la estructura ya se sostiene.',
          ]),
      ...(reborde ? [`Puntea en cada larguero delantero su reborde: una pletina de ${RB_W} × ${RB_T} mm que sobresale ${mm(RB_SOBRE)} por encima de la balda${bolted ? ' y deja libres los tornillos' : ''}.`] : []),
      ...(cruz ? [`Presenta la cruz por detrás, apoyada en los postes traseros: ${bolted ? 'puntea las dos medias diagonales a la entera, taladra los cuatro extremos a la vez que el poste y atorníllalos' : 'puntea las dos medias diagonales a la entera y los cuatro extremos a los postes'}.`] : []),
    ],
    parts: [...largIds, ...rbIds, ...cruzIds],
    marks: [
      ...tackMarks(jSet),
      ...seamTacks(seamSet),
      ...(bolted ? tornillos(boltPts, 'z') : []),
      ...(cruzBolts.length ? tornillos(cruzBolts, 'z') : []),
    ],
    technique: bolted
      ? {
          name: 'Larguero atornillado a oreja soldada',
          why: 'Solo se suelda en los laterales, que se hacen en plano sobre la mesa; los largueros se atornillan y la estantería se desmonta en piezas manejables. Taladrar larguero y oreja a la vez garantiza que los agujeros coinciden.',
          how: ['Sujeta el larguero contra la oreja con una mordaza.', 'Taladra con una broca pequeña de guía y después con la de paso para M8.', 'Aprieta las tuercas autoblocantes en cruz, sin deformar el tubo.'],
        }
      : tecPunteo,
    hardware: bolted
      ? boltL === cruzBoltL
        ? [hw(`Tornillo hexagonal M8 × ${boltL} mm con tuerca autoblocante y dos arandelas`, boltPts.length + cruzBolts.length)]
        : [hw(`Tornillo hexagonal M8 × ${boltL} mm con tuerca autoblocante y dos arandelas`, boltPts.length), ...(cruzBolts.length ? [hw(`Tornillo hexagonal M8 × ${cruzBoltL} mm con tuerca autoblocante y dos arandelas`, cruzBolts.length)] : [])]
      : undefined,
    tools: bolted ? ['Taladro y brocas para metal', 'Llaves fijas de 13 mm', 'Mordazas', ...proc.tools, 'Careta de soldar'] : [...proc.tools, 'Careta de soldar', 'Sargentos', 'Escuadras magnéticas', 'Nivel'],
    check: 'Mide las diagonales del frente y de la trasera, y comprueba con el nivel que los postes están a plomo antes de dar ningún cordón.',
    tip: 'Pide ayuda: con los laterales de pie hacen falta cuatro manos para los primeros puntos.',
  });

  const allJ = [...jLat, ...jSet];
  const allSeams = [...seamLat, ...seamSet];
  b.step({
    kind: 'soldar',
    title: 'Da los cordones definitivos alternando lados',
    summary: 'Convierte cada punto en un cordón sin que la estructura se tuerza.',
    detail: [
      `Hay ${allJ.length} uniones a tope de tubo${allSeams.length ? ` y ${allSeams.length} cordones de pletina` : ''}.`,
      bolted
        ? 'Suelda primero los laterales tumbados: un lado de una unión y después la unión simétrica del otro poste. Las orejas, solo por arriba y por abajo.'
        : 'Alterna: un lado de una unión del lateral izquierdo, el mismo en el derecho, después delante y detrás. Gira la estructura para soldar siempre en plano o en vertical, nunca por encima de tu cabeza.',
      ...(reborde ? ['Suelda el reborde a cordones cortos repartidos, no corridos: una pletina fina larga se curva con el calor.'] : []),
      ...(cruz ? ['Suelda la cruz en el cruce por las dos caras' + (bolted ? '.' : ' y después sus cuatro extremos.')] : []),
      'Deja enfriar al aire, sin agua.',
    ],
    parts: [],
    marks: [...weldMarks(allJ), ...seamWelds(allSeams)],
    technique: tecCordon,
    tools: [...proc.tools, 'Careta de soldar', 'Guantes de soldador', 'Escuadra'],
    check: 'Vuelve a medir las diagonales y a mirar el plomo. Si algo se ha cerrado, da el siguiente cordón en el lado contrario.',
    warning: 'Aparta todo lo que pueda arder: OSHA pide alejar los combustibles unos 35 pies (unos 10,7 m) cuando sea posible. Ten un extintor a mano y vigila la zona un rato al acabar.',
  });

  b.step({
    kind: 'preparar',
    title: 'Amola, taladra y pinta',
    summary: 'Repasa los cordones, haz los taladros que faltan y protege el acero.',
    detail: [
      'Pica la escoria y repasa con disco de láminas los cordones que se vean o molesten; no te comas la pared del tubo.',
      ...(anclaje ? [`Taladra los postes traseros para las escuadras de anclaje, a ${mm(40)} de su cabeza.`] : []),
      ...(bolted ? ['Desmonta los largueros para pintar cada pieza por separado; marca antes cada larguero con su sitio.'] : []),
      'Limpia el polvo y la grasa y aplica imprimación y esmalte siguiendo la ficha técnica del fabricante.',
    ],
    parts: [],
    hardware: [hw('Imprimación para acero', 1, 'bote'), hw('Esmalte para metal', 1, 'bote'), hw('Disco de láminas para amoladora', 1)],
    tools: ['Amoladora con disco de láminas', 'Taladro y brocas para metal', 'Brocha o rodillo pequeño', 'Gafas de protección', 'Mascarilla'],
    tip: 'Taladra antes de pintar: así la pintura protege también el borde del agujero.',
    warning: 'Pica la escoria con gafas y golpeando hacia fuera de tu cuerpo (INSST).',
  });

  const montHw: HardwareLine[] = [
    ...(pies === 'tapon' ? [hw(`Tapón interior de plástico para tubo de ${s} × ${s} mm`, 8)] : [hw(`Tapón interior de plástico para tubo de ${s} × ${s} mm`, 4)]),
    ...(pies === 'niveladores' ? [hw('Pie nivelador con espárrago M8', 4)] : []),
    ...(anclaje ? [hw('Escuadra de acero en L con taladros', 2), hw(`Tornillo M6 × ${ancBoltL} mm con tuerca autoblocante y arandela`, 2), hw('Taco y tornillo para tu tipo de pared (pregunta en la ferretería: ladrillo, hormigón o placa de yeso)', 2, 'juegos')] : []),
  ];
  b.step({
    kind: 'montar',
    title: 'Coloca las baldas' + (pies === 'niveladores' ? ', los niveladores' : '') + (anclaje ? ' y ancla a la pared' : ''),
    summary: 'Las baldas se apoyan sobre los largueros; la estructura queda nivelada y sujeta.',
    detail: [
      ...(bolted ? ['Vuelve a montar los largueros en su sitio y aprieta los tornillos.'] : []),
      ...(pies === 'niveladores' ? ['Rosca un nivelador en la tuerca de cada pie y ajústalos con el nivel encima de una balda.'] : []),
      `Mete los tapones en la cabeza de los postes${pies === 'tapon' ? ' y en los pies' : ''}.`,
      `Apoya las ${levels.length} baldas sobre los largueros, encajadas entre los postes${reborde ? ' y contra el reborde' : ''}.`,
      ...(anclaje
        ? [
            'Atornilla una escuadra en el costado de cada poste trasero, arriba, y fíjala a la pared con el taco adecuado a tu pared.',
            'Ancla la estructura antes de cargar las baldas, no después.',
          ]
        : []),
    ],
    parts: [...nivIds, ...baldaIds, ...ancIds],
    marks: anclaje ? tornillos(ancPts, 'x') : undefined,
    hardware: montHw,
    tools: ['Nivel', 'Llaves fijas', 'Taladro con broca para pared', 'Destornillador'],
    check: 'Empuja la estantería de lado y de frente a la altura de la balda de arriba: no debe balancearse ni moverse de la pared.',
    warning: anclaje
      ? 'Una estantería alta cargada puede volcar hacia delante. Sujétala siempre a la pared, como piden los fabricantes de estanterías en sus instrucciones.'
      : 'Sin anclaje a la pared puede volcar hacia delante, sobre todo si cargas las baldas de arriba. Ánclala si vas a subir de una balda o si hay niños cerca.',
  });

  b.step({
    kind: 'acabar',
    title: 'Revisa y carga con cabeza',
    summary: 'Una última comprobación antes de llenarla.',
    detail: [
      'Repasa con la mano (con guante) aristas, cordones y tornillos que puedan cortar o enganchar.',
      bolted ? 'Comprueba que todas las tuercas están apretadas y vuelve a revisarlas al cabo de unas semanas.' : 'Revisa que no ha quedado ningún cordón con poro o grieta visibles.',
      'Pon lo pesado abajo y lo ligero arriba.',
      'Si una balda o un larguero se ven arqueados al cargarlos, descarga: es la señal de que te has pasado.',
    ],
    parts: [],
    tools: ['Guantes'],
    tip: 'Las baldas de madera se doblan mucho más cuanto más larga es la luz: según Fine Woodworking, duplicar la luz multiplica la flecha por 8.',
  });

  const safety = [
    'Careta de soldar con filtro certificado siempre que haya arco, también para puntear. ' + proc.careta,
    'Ropa de algodón ignífugo o lana, sin dobladillos ni bolsillos abiertos, mandil, polainas y botas de seguridad; guantes de soldador de tipo A, de manga larga y secos (INSST).',
    'El humo de soldadura no es seguro ni en acero dulce: el HSE pide extracción localizada en interior y protección respiratoria en exterior.',
    'No sueldes con el suelo mojado ni cambies el electrodo con guantes húmedos; revisa el aislamiento de los cables (INSST).',
    'Gafas o pantalla al amolar y al picar escoria; protección auditiva con la amoladora.',
    'Soldar acero galvanizado produce fiebre de los humos metálicos: retira el zinc de la zona o usa tubo sin galvanizar (TWI).',
    'Ancla la estantería a la pared: una estantería alta puede volcar si se carga arriba o si alguien trepa por ella.',
  ];
  const notes = [
    'No damos una carga máxima por balda: depende del tubo, de las soldaduras y del tablero, y no hay un dato verificado para esta construcción. Empieza con poco peso y observa.',
    'Las baldas solo apoyan en los largueros delantero y trasero: cuanto más ancha la estantería, más trabaja el larguero.',
    ...(mat === 'dm' ? ['El DM se hincha con la humedad; en un trastero o garaje húmedo es mejor el contrachapado.'] : []),
    ...(bolted ? ['Desmontable: los dos laterales soldados y los largueros sueltos se transportan por separado.'] : []),
    ...(cruz ? ['La cruz trasera evita que la estructura se descuadre de lado; si la estantería es estrecha y alta, no la quites.'] : ['Sin cruz trasera, la rigidez lateral depende solo de las soldaduras de los largueros y del anclaje a la pared.']),
    ...notas,
  ];
  const sources: SourceRef[] = [
    ...(v.proceso === 'hilo' ? [SRC.innershield, SRC.millerMig] : [SRC.lincoln6013, SRC.millerStick]),
    SRC.lincolnGuia, SRC.osha, SRC.ntp494, SRC.hse, SRC.twiTack, SRC.twiDist, SRC.twiFiebre, SRC.sagulator,
    ...(anclaje ? [SRC.ikeaKallax] : []),
  ];

  const hours = Math.round(6 + levels.length * (bolted ? 1 : 0.8) + (W + H) / 1500 + (cruz ? 1 : 0) + (reborde ? 1 : 0) + (pies === 'tapon' ? 0 : 0.5));

  return b.finish({
    id: 'estanteria-acero',
    title: 'Estantería metálica',
    craft: 'soldadura',
    summary: `Estantería de ${Math.round(W / 10)} × ${Math.round(D / 10)} × ${Math.round(H / 10)} cm con ${levels.length} baldas, tubo de ${tubo.label} y largueros ${bolted ? 'atornillados' : 'soldados'}.`,
    difficulty: 2,
    hours,
    dims: [W, H, D],
    safety,
    notes,
    sources,
    spec: [
      { label: 'Medidas', value: `${W} × ${D} × ${H} mm (ancho × fondo × alto)` },
      { label: 'Baldas', value: `${levels.length} de ${W - 2 * s} × ${D} × ${T} mm, ${mat === 'dm' ? 'DM' : mat === 'pino' ? 'pino alistonado' : 'contrachapado'}` },
      { label: 'Hueco entre baldas', value: `${Math.round(huecoLibre)} mm libres` },
      { label: 'Tubo', value: tubo.label },
      { label: 'Largueros', value: bolted ? 'Atornillados a orejas, M8 con tuerca' : 'Soldados' },
      { label: 'Detalles', value: [cruz ? 'cruz trasera' : '', pies === 'niveladores' ? 'niveladores' : pies === 'placa' ? 'placas de pie' : 'tapones', anclaje ? 'anclaje a pared' : '', reborde ? 'reborde' : ''].filter(Boolean).join(', ') },
      { label: 'Soldadura', value: proc.name },
    ],
  });
}
