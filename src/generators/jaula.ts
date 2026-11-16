import type { Axis, Generator, HardwareLine, Mark, ParamValues, Project, SourceRef, Vec3 } from '../core/types';
import { Builder, cordon, cordonPerimetral, hw, mm, punto, repartir, tornillos } from '../core/builder';

/**
 * JAULA / VOLADERA DE TUBO SOLDADO
 * Bastidor de tubo cuadrado fino (dos bastidores planos, delantero y trasero, unidos por
 * travesaños de fondo), paños de malla electrosoldada por fuera del bastidor, puerta de marco
 * abisagrada y suelo o bandeja de tablero. La luz de malla y el tamaño mínimo salen de la
 * especie elegida (docs/referencia-tecnica.md §3, conversión de pulgadas a mm propia).
 */

// ---------- Datos verificados (docs/referencia-tecnica.md §3 y §5) ----------

const SRC = {
  merckTabla: { label: 'Merck Veterinary Manual: Minimum cage size and bar spacing recommendations', url: 'https://www.merckvetmanual.com/multimedia/table/minimum-and-bar-spacing-recommendations' },
  merckZinc: { label: 'Merck Veterinary Manual: Toxicoses of Pet Birds (fuentes de zinc)', url: 'https://www.merckvetmanual.com/exotic-and-laboratory-animals/pet-birds/toxicoses-of-pet-birds' },
  vca: { label: 'VCA Animal Hospitals: Zinc Poisoning (Toxicity) in Pets', url: 'https://vcahospitals.com/know-your-pet/zinc-poisoning-toxicity-in-pets' },
  afrma: { label: 'AFRMA: Rat cage bar spacing', url: 'https://afrma.org/bc_ratcagebarspc.htm' },
  mspca: { label: 'MSPCA-Angell: Suggestions for housing small animals', url: 'https://www.mspca.org/pet-resources/suggestions-for-housing-small-animals/' },
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
} satisfies Record<string, SourceRef>;

type Esp = 'periquito' | 'cotorra' | 'yaco' | 'guacamayo' | 'rata' | 'degu' | 'planeador' | 'otra';

interface Especie {
  label: string;
  ave: boolean;
  /** Luz/separación en pulgadas tal como da la fuente, y conversión propia a mm. */
  luzTxt: string;
  luzMm: number;
  /** Jaula mínima en mm (conversión propia) y cómo se compara. */
  min?: { mm: Vec3; txt: string; modo: 'lah' | 'ordenado' };
  aviso?: string;
  fuentes: SourceRef[];
}

const ESP: Record<Exclude<Esp, 'otra'>, Especie> = {
  periquito: {
    label: 'Periquito, ninfa, inseparable o parrotlet', ave: true,
    luzTxt: '0,5 in (12,7 mm, conversión propia)', luzMm: 12.7,
    min: { mm: [508, 508, 762], txt: '20 × 20 × 30 in (largo × ancho × alto) = 508 × 508 × 762 mm, conversión propia', modo: 'lah' },
    fuentes: [SRC.merckTabla],
  },
  cotorra: {
    label: 'Cotorra (conure), Poicephalus, caique o guacamayo miniatura', ave: true,
    luzTxt: '0,75 in (19 mm, conversión propia)', luzMm: 19,
    min: { mm: [914, 610, 1219], txt: '36 × 24 × 48 in (largo × ancho × alto) = 914 × 610 × 1219 mm, conversión propia', modo: 'lah' },
    fuentes: [SRC.merckTabla],
  },
  yaco: {
    label: 'Yaco (loro gris), amazona o cacatúa pequeña', ave: true,
    luzTxt: '0,75 in (19 mm, conversión propia)', luzMm: 19,
    min: { mm: [1016, 762, 1524], txt: '40 × 30 × 60 in (largo × ancho × alto) = 1016 × 762 × 1524 mm, conversión propia', modo: 'lah' },
    aviso: 'En la tabla de Merck la separación de este grupo aparece como «0,751» in, que parece una errata de 0,75 in. Aquí se usa 0,75 in (19 mm); confírmalo con un veterinario de exóticos antes de comprar la malla.',
    fuentes: [SRC.merckTabla],
  },
  guacamayo: {
    label: 'Guacamayo o cacatúa grande', ave: true,
    luzTxt: '1,5 in (38 mm, conversión propia)', luzMm: 38,
    min: { mm: [1219, 914, 1676], txt: '48 × 36 × 66 in (largo × ancho × alto) = 1219 × 914 × 1676 mm, conversión propia', modo: 'lah' },
    aviso: 'Los guacamayos y las cacatúas grandes tienen un pico muy fuerte: la referencia no tiene datos verificados sobre el grosor de alambre ni de tubo que resisten. Consúltalo con un veterinario de exóticos.',
    fuentes: [SRC.merckTabla],
  },
  rata: {
    label: 'Ratas', ave: false,
    luzTxt: '1/2 in (12,7 mm, conversión propia)', luzMm: 12.7,
    min: { mm: [610, 610, 610], txt: '24 × 24 × 24 in para 1–2 ratas, con varios niveles (MSPCA) = 610 × 610 × 610 mm, conversión propia', modo: 'ordenado' },
    aviso: 'AFRMA advierte que las jaulas de 3/4 in vendidas como aptas para ratas son inseguras: una rata adulta puede atascar la cabeza y las jóvenes se escapan. MSPCA pide además varios niveles, que este diseño no incluye.',
    fuentes: [SRC.afrma, SRC.mspca],
  },
  degu: {
    label: 'Degú', ave: false,
    luzTxt: 'como máximo 1/2 in (12,7 mm, conversión propia)', luzMm: 12.7,
    min: { mm: [610, 610, 914], txt: '24 × 24 × 36 in para 1–3 degús (MSPCA) = 610 × 610 × 914 mm, conversión propia', modo: 'ordenado' },
    fuentes: [SRC.mspca],
  },
  planeador: {
    label: 'Petauro del azúcar (planeador)', ave: false,
    luzTxt: 'malla de como máximo 1/2 in (12,7 mm, conversión propia)', luzMm: 12.7,
    aviso: 'MSPCA indica para el petauro barrotes a menos de 1/4 in y aberturas menores de 1 × 1 in, además de malla de 1/2 in como máximo. La referencia no tiene un tamaño mínimo de jaula verificado para esta especie.',
    fuentes: [SRC.mspca],
  },
};

const TUBOS: Record<string, { s: number; w: number; label: string }> = {
  '20x1.5': { s: 20, w: 1.5, label: '20 × 20 × 1,5 mm' },
  '25x1.5': { s: 25, w: 1.5, label: '25 × 25 × 1,5 mm' },
  '25x2': { s: 25, w: 2, label: '25 × 25 × 2 mm' },
  '30x2': { s: 30, w: 2, label: '30 × 30 × 2 mm' },
};

const TT = 12; // grueso del tablero de suelo, bandeja y techo (decisión de diseño)
const MT = 2; // grueso con el que se dibuja la malla
const G = 3; // holgura entre marco de puerta y hueco
const MINB = 60; // banda mínima de malla entre dos tubos (decisión de diseño)
const RH = 70; // altura de la rueda dibujada
const PLT = 5; // grueso de la placa de rueda
const PLW = 50; // lado de la placa de rueda
const CROSS_W = 30; // ancho de la pletina de suelo
const PASO_FIJ = 150; // separación máxima entre fijaciones de malla (decisión de diseño)

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

// ---------- Ayudas geométricas ----------

const AXI: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;
const r1 = (n: number) => Math.round(n * 10) / 10;

function sectionOf(axis: Axis, size: Vec3): [number, number] {
  if (axis === 'y') return [size[0], size[2]];
  if (axis === 'x') return [size[1], size[2]];
  return [size[0], size[1]];
}

interface Joint { c: Vec3; axis: Axis; w: number; h: number; tack: Axis }

/** Unión a tope en un extremo de una pieza lineal (lo..hi): perímetro de la sección en ese plano. */
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

/** Celdas libres de una cara: bandas entre tubos horizontales, partidas por el hueco de la puerta. */
function faceCells(U: number, bars: number[], s: number, door: { u0: number; u1: number; v0: number; v1: number } | null, skip: (v0: number) => boolean) {
  const cells: [number, number, number, number][] = [];
  for (let i = 0; i < bars.length - 1; i++) {
    const v0 = bars[i] + s, v1 = bars[i + 1];
    if (v1 - v0 < 1 || skip(v0)) continue;
    if (door && Math.abs(v0 - door.v0) < 0.01 && Math.abs(v1 - door.v1) < 0.01) {
      if (door.u0 > s + 0.01) cells.push([s, door.u0 - s, v0, v1]);
      if (door.u1 < U - s - 0.01) cells.push([door.u1 + s, U - s, v0, v1]);
    } else cells.push([s, U - s, v0, v1]);
  }
  return cells;
}

/** Puntos de fijación de un paño: a un cuarto de tubo hacia dentro de cada borde. */
function fixPoints(u0: number, u1: number, v0: number, v1: number, ins: number): [number, number][] {
  const nU = Math.max(2, Math.ceil((u1 - u0 - 2 * ins) / PASO_FIJ) + 1);
  const nV = Math.max(2, Math.ceil((v1 - v0 - 2 * ins) / PASO_FIJ) + 1);
  const pts: [number, number][] = [];
  for (const u of repartir(u0 + ins, u1 - ins, nU)) pts.push([u, v0 + ins], [u, v1 - ins]);
  for (const v of repartir(v0 + ins, v1 - ins, nV).slice(1, -1)) pts.push([u0 + ins, v], [u1 - ins, v]);
  return pts;
}

// ---------- Generador ----------

const tieneMin = (v: ParamValues) => v.especie !== 'otra' && v.especie !== 'planeador';

export const jaula: Generator = {
  id: 'jaula',
  title: 'Jaula',
  craft: 'soldadura',
  difficulty: 2,
  description:
    'Jaula o voladera de tubo cuadrado soldado con paños de malla, puerta abisagrada y bandeja. La luz de malla y el tamaño mínimo se ajustan a la especie con datos veterinarios citados.',
  params: [
    {
      key: 'especie', label: 'Especie', type: 'select', default: 'periquito', group: 'Medidas',
      help: 'Fija la luz de malla y, si la fuente lo da, el tamaño mínimo de la jaula. Solo aparecen las especies con dato verificado.',
      options: [
        { value: 'periquito', label: 'Periquito, ninfa, inseparable', hint: 'Malla de 12,7 mm (0,5 in, Merck)' },
        { value: 'cotorra', label: 'Cotorra, Poicephalus, caique', hint: 'Malla de 19 mm (0,75 in, Merck)' },
        { value: 'yaco', label: 'Yaco, amazona, cacatúa pequeña', hint: 'Malla de 19 mm (dato con posible errata en Merck)' },
        { value: 'guacamayo', label: 'Guacamayo, cacatúa grande', hint: 'Malla de 38 mm (1,5 in, Merck)' },
        { value: 'rata', label: 'Ratas', hint: 'Malla de 12,7 mm (1/2 in, AFRMA y MSPCA)' },
        { value: 'degu', label: 'Degú', hint: 'Malla de 12,7 mm como máximo (MSPCA)' },
        { value: 'planeador', label: 'Petauro del azúcar', hint: 'Malla de 12,7 mm como máximo (MSPCA)' },
        { value: 'otra', label: 'Otra: la indico yo', hint: 'Escribe tú la luz de malla' },
      ],
    },
    {
      key: 'luzLibre', label: 'Luz de malla', type: 'number', min: 6, max: 50, step: 0.5, unit: 'mm', default: 12.7, group: 'Medidas',
      help: 'Abertura de la malla. Pregúntale a un veterinario de exóticos cuál necesita tu animal.',
      visible: (v) => v.especie === 'otra',
    },
    { key: 'mayor', label: 'Lado mayor', type: 'number', min: 500, max: 2000, step: 10, unit: 'mm', default: 900, group: 'Medidas', help: 'Es el alto en la jaula vertical y el ancho en la horizontal. Se mide por fuera del bastidor.' },
    { key: 'menor', label: 'Lado menor', type: 'number', min: 400, max: 1500, step: 10, unit: 'mm', default: 600, group: 'Medidas', help: 'Es el ancho en la jaula vertical y el alto en la horizontal.' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 400, max: 1000, step: 10, unit: 'mm', default: 600, group: 'Medidas' },
    {
      key: 'alturaPatas', label: 'Altura del fondo sobre el suelo', type: 'number', min: 300, max: 900, step: 10, unit: 'mm', default: 600, group: 'Medidas',
      visible: (v) => v.soporte === 'patas',
    },
    {
      key: 'ajustarMinimo', label: 'Respetar el tamaño mínimo de la especie', type: 'boolean', default: true, group: 'Medidas',
      help: 'Agranda las medidas hasta el mínimo de la fuente, medido por dentro del bastidor. Si lo desactivas, el proyecto te avisará.',
      visible: tieneMin,
    },
    {
      key: 'proporcion', label: 'Proporción', type: 'select', default: 'vertical', group: 'Forma',
      options: [
        { value: 'vertical', label: 'Vertical', hint: 'Más alta que ancha' },
        { value: 'horizontal', label: 'Horizontal (voladera)', hint: 'Más ancha que alta, para volar de lado a lado' },
      ],
    },
    {
      key: 'soporte', label: 'Apoyo', type: 'select', default: 'patas', group: 'Forma',
      options: [
        { value: 'patas', label: 'Con patas', hint: 'Los postes bajan hasta el suelo' },
        { value: 'sobremesa', label: 'De sobremesa', hint: 'Se apoya en un mueble' },
      ],
    },
    {
      key: 'techo', label: 'Techo plano', type: 'select', default: 'malla', group: 'Forma',
      options: [
        { value: 'malla', label: 'De malla' },
        { value: 'tablero', label: 'Cerrado con tablero', hint: 'Da sombra si la jaula está en una terraza' },
      ],
    },
    { key: 'puertaAncho', label: 'Ancho del hueco de la puerta', type: 'number', min: 150, max: 800, step: 10, unit: 'mm', default: 300, group: 'Detalles' },
    { key: 'puertaAlto', label: 'Alto del hueco de la puerta', type: 'number', min: 150, max: 1200, step: 10, unit: 'mm', default: 350, group: 'Detalles' },
    {
      key: 'puertaPos', label: 'Posición de la puerta', type: 'select', default: 'centro', group: 'Detalles',
      options: [
        { value: 'izquierda', label: 'A la izquierda' },
        { value: 'centro', label: 'Centrada' },
        { value: 'derecha', label: 'A la derecha' },
      ],
    },
    {
      key: 'puertaAltura', label: 'Altura de la puerta', type: 'select', default: 'media', group: 'Detalles',
      options: [
        { value: 'abajo', label: 'A ras del fondo' },
        { value: 'media', label: 'A media altura' },
      ],
    },
    { key: 'bandeja', label: 'Bandeja extraíble', type: 'boolean', default: true, group: 'Detalles', help: 'El fondo es una bandeja de tablero que sale por una ranura del frente para limpiar.' },
    {
      key: 'perchas', label: 'Perchas de madera', type: 'select', default: '2', group: 'Detalles',
      options: [
        { value: '0', label: 'Ninguna' },
        { value: '1', label: 'Una' },
        { value: '2', label: 'Dos, a distinta altura' },
      ],
    },
    {
      key: 'perchaD', label: 'Diámetro de la percha', type: 'number', min: 12, max: 40, step: 1, unit: 'mm', default: 20, group: 'Detalles',
      help: 'Elígelo según la pata de tu animal: no hay un dato verificado, consúltalo con un veterinario de exóticos.',
      visible: (v) => v.perchas !== '0',
    },
    { key: 'ruedas', label: 'Ruedas', type: 'boolean', default: false, group: 'Detalles', visible: (v) => v.soporte === 'patas' },
    { key: 'servicio', label: 'Puerta de servicio lateral', type: 'boolean', default: false, group: 'Detalles', help: 'Portezuela pequeña en el lateral derecho para cambiar comederos sin abrir la puerta grande.' },
    {
      key: 'tubo', label: 'Tubo del bastidor', type: 'select', default: '25x1.5', group: 'Material',
      options: [
        { value: '20x1.5', label: '20 × 20 × 1,5 mm', hint: 'Ligero; la pared fina se perfora con facilidad' },
        { value: '25x1.5', label: '25 × 25 × 1,5 mm' },
        { value: '25x2', label: '25 × 25 × 2 mm', hint: 'Más fácil de soldar para empezar' },
        { value: '30x2', label: '30 × 30 × 2 mm', hint: 'Para jaulas grandes' },
      ],
    },
    {
      key: 'malla', label: 'Malla', type: 'select', default: 'sinzinc', group: 'Material',
      options: [
        { value: 'sinzinc', label: 'Sin recubrimiento de zinc', hint: 'El material concreto, consúltalo con un veterinario de exóticos' },
        { value: 'galvanizada', label: 'Galvanizada', hint: 'Fuente de zinc: desaconsejada para aves' },
      ],
    },
    {
      key: 'fijacion', label: 'Fijación de la malla', type: 'select', default: 'atornillada', group: 'Uniones',
      options: [
        { value: 'atornillada', label: 'Atornillada con arandela ancha', hint: 'Recomendada si empiezas' },
        { value: 'soldada', label: 'Soldada por puntos al bastidor', hint: 'Difícil: el alambre fino se funde enseguida' },
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
      id: 'periquitos', name: 'Jaula de periquitos',
      blurb: 'Vertical, de 60 × 60 × 90 cm sobre patas con ruedas, bandeja y dos perchas.',
      values: { especie: 'periquito', proporcion: 'vertical', mayor: 900, menor: 600, fondo: 600, soporte: 'patas', alturaPatas: 600, techo: 'malla', puertaAncho: 300, puertaAlto: 350, puertaPos: 'centro', puertaAltura: 'media', bandeja: true, perchas: '2', perchaD: 18, ruedas: true, servicio: false, tubo: '25x1.5', malla: 'sinzinc', fijacion: 'atornillada', proceso: 'electrodo' },
    },
    {
      id: 'voladera', name: 'Voladera de cotorras',
      blurb: 'Horizontal, de 1,6 m de ancho y 1,3 m de alto, con techo de tablero y puerta de servicio.',
      values: { especie: 'cotorra', proporcion: 'horizontal', mayor: 1600, menor: 1300, fondo: 800, soporte: 'patas', alturaPatas: 400, techo: 'tablero', puertaAncho: 450, puertaAlto: 700, puertaPos: 'izquierda', puertaAltura: 'media', bandeja: true, perchas: '2', perchaD: 25, ruedas: false, servicio: true, tubo: '30x2', malla: 'sinzinc', fijacion: 'atornillada', proceso: 'hilo' },
    },
    {
      id: 'ratas', name: 'Jaula de ratas de sobremesa',
      blurb: '80 × 70 × 70 cm, malla de 12,7 mm, fondo de tablero sin rejilla y bandeja para limpiar.',
      values: { especie: 'rata', proporcion: 'horizontal', mayor: 800, menor: 700, fondo: 700, soporte: 'sobremesa', techo: 'malla', puertaAncho: 350, puertaAlto: 300, puertaPos: 'derecha', puertaAltura: 'abajo', bandeja: true, perchas: '0', ruedas: false, servicio: true, tubo: '25x2', malla: 'sinzinc', fijacion: 'atornillada', proceso: 'electrodo' },
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

  const espKey = v.especie as Esp;
  const esp = espKey === 'otra' ? null : ESP[espKey];
  const ave = esp ? esp.ave : false;
  const luz = esp ? esp.luzMm : Number(v.luzLibre);
  const tubo = TUBOS[String(v.tubo)] ?? TUBOS['25x1.5'];
  const s = tubo.s, wall = tubo.w;
  const proc = PROC[(v.proceso as Proceso) ?? 'electrodo'];
  const soldada = v.fijacion === 'soldada';
  const galv = v.malla === 'galvanizada';
  const patas = v.soporte === 'patas';
  const ruedas = patas && v.ruedas === true;
  const bandeja = v.bandeja === true;
  const techoTablero = v.techo === 'tablero';
  const vertical = v.proporcion === 'vertical';

  // --- medidas exteriores del cuerpo ---
  const big = Math.max(Number(v.mayor), Number(v.menor));
  const small = Math.min(Number(v.mayor), Number(v.menor));
  let W = vertical ? small : big;
  let Hc = vertical ? big : small;
  let D = Number(v.fondo);
  const inner = (): Vec3 => [W - 2 * s, D - 2 * s, Hc - 2 * s - TT]; // ancho, fondo, alto útiles

  // --- tamaño mínimo de la especie ---
  const notasMin: string[] = [];
  let cumpleMin = true;
  let ajustado = false;
  if (esp?.min) {
    const [L, Wm, Hm] = esp.min.mm;
    const ok = () => {
      const [iw, id, ih] = inner();
      if (esp.min!.modo === 'lah') return Math.max(iw, id) >= L - 0.5 && Math.min(iw, id) >= Wm - 0.5 && ih >= Hm - 0.5;
      const a = [iw, id, ih].sort((x, y) => y - x), m = [L, Wm, Hm].sort((x, y) => y - x);
      return a.every((x, i) => x >= m[i] - 0.5);
    };
    if (!ok()) {
      if (v.ajustarMinimo !== false) {
        ajustado = true;
        if (esp.min.modo === 'lah') {
          const [iw, id] = inner();
          const [nw, nd] = iw >= id ? [L, Wm] : [Wm, L];
          W = Math.max(W, nw + 2 * s);
          D = Math.max(D, nd + 2 * s);
          Hc = Math.max(Hc, Hm + 2 * s + TT);
        } else {
          const cur = inner();
          const idx = [0, 1, 2].sort((a, c) => cur[c] - cur[a]);
          const m = [L, Wm, Hm].sort((x, y) => y - x);
          const need: Vec3 = [...cur];
          idx.forEach((k, i) => { need[k] = Math.max(cur[k], m[i]); });
          W = need[0] + 2 * s; D = need[1] + 2 * s; Hc = need[2] + 2 * s + TT;
        }
        W = Math.ceil(W / 10) * 10; D = Math.ceil(D / 10) * 10; Hc = Math.ceil(Hc / 10) * 10;
        notasMin.push(`Se han agrandado las medidas para respetar el tamaño mínimo de la fuente (${esp.min.txt}), medido por dentro del bastidor.`);
      } else {
        cumpleMin = false;
        notasMin.push(`ATENCIÓN: el interior (${inner().map((n) => Math.round(n)).join(' × ')} mm, ancho × fondo × alto) no llega al mínimo de la fuente para esta especie: ${esp.min.txt}. Agranda la jaula o activa «Respetar el tamaño mínimo».`);
      }
    }
  }

  // --- alturas ---
  const y0 = ruedas ? RH + PLT : 0; // arranque de los postes
  const vb = patas ? Number(v.alturaPatas) : 0; // cara inferior del bastidor de fondo
  const vt = vb + Hc; // cara superior del techo
  const maxTop = vt - s; // cara inferior del travesaño superior
  const SLOT = TT + 3; // ranura de la bandeja
  const trayBarY = vb + s + SLOT;
  const baseTop = bandeja ? trayBarY + s : vb + s;
  const floorTop = vb + s + TT;

  // --- puerta principal (cara delantera) ---
  const innerW = W - 2 * s;
  let dW = clamp(Number(v.puertaAncho), 150, innerW);
  let ox0: number, ox1: number;
  const pos = String(v.puertaPos);
  if (pos === 'centro') {
    if ((innerW - dW) / 2 < s + MINB) { ox0 = s; ox1 = W - s; } else { ox0 = s + (innerW - dW) / 2; ox1 = ox0 + dW; }
  } else if (pos === 'izquierda') {
    ox0 = s; ox1 = s + dW;
    if (W - s - ox1 < s + MINB) ox1 = W - s;
  } else {
    ox1 = W - s; ox0 = ox1 - dW;
    if (ox0 - s < s + MINB) ox0 = s;
  }
  dW = ox1 - ox0;
  const availH = maxTop - baseTop;
  let dH = clamp(Number(v.puertaAlto), 150, availH);
  let oy0 = baseTop;
  if (v.puertaAltura === 'media') {
    const off = (availH - dH) / 2;
    if (off >= s + MINB) oy0 = baseTop + off;
  }
  let oy1 = oy0 + dH;
  if (maxTop - oy1 < s + MINB) oy1 = maxTop;
  dH = oy1 - oy0;
  const hingeLeft = pos !== 'derecha';

  // --- puerta de servicio (cara derecha) ---
  const innerD = D - 2 * s;
  let servicio = v.servicio === true;
  const sW = Math.min(220, innerD - 2 * (s + MINB));
  const sBarLow = vb + s + MINB;
  const sy0 = sBarLow + s;
  const sH = Math.min(180, maxTop - sy0 - (s + MINB));
  const notasServ: string[] = [];
  if (servicio && (sW < 120 || sH < 120)) {
    servicio = false;
    notasServ.push('La puerta de servicio no cabe con estas medidas y se ha quitado.');
  }
  const sz0 = D / 2 - sW / 2, sz1 = D / 2 + sW / 2, sy1 = sy0 + sH;

  // --- perchas ---
  let np = Number(v.perchas);
  const pd = Number(v.perchaD);
  const pLow = servicio ? sy1 + s + MINB : floorTop + 150;
  const pHigh = maxTop - MINB - s;
  const notasPer: string[] = [];
  if (np === 2 && pHigh - pLow < s + MINB) np = 1;
  if (np >= 1 && pHigh < pLow) { notasPer.push('Con esta altura no caben perchas a una altura útil y se han quitado.'); np = 0; }
  const perchY = np === 2 ? [pLow + (pHigh - pLow) * 0.2, pLow + (pHigh - pLow) * 0.8] : np === 1 ? [(pLow + pHigh) / 2] : [];
  const perchBars = perchY.map((y) => Math.round(y));

  // --- piezas ---
  const tuboP = (name: string, axis: Axis, lo: Vec3, hi: Vec3) => {
    const size: Vec3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const length = size[AXI[axis]];
    return b.tubo({ ref: R(`tubo:${r1(length)}`), name, section: sectionOf(axis, size), length, axis, at: lo, wall });
  };
  const jFrame: Joint[] = []; // bastidores planos (paso de punteado 1)
  const jSet: Joint[] = []; // conjunto (paso de punteado 2)

  // Bastidor delantero
  const frontIds: string[] = [];
  const postsFront = [
    tuboP('Poste', 'y', [0, y0, D - s], [s, vt, D]),
    tuboP('Poste', 'y', [W - s, y0, D - s], [W, vt, D]),
  ];
  const postsBack = [
    tuboP('Poste', 'y', [0, y0, 0], [s, vt, s]),
    tuboP('Poste', 'y', [W - s, y0, 0], [W, vt, s]),
  ];
  const frontBars = [...new Set([vb, ...(bandeja ? [trayBarY] : []), ...(oy0 > baseTop + 0.01 ? [oy0 - s] : []), ...(oy1 < maxTop - 0.01 ? [oy1] : []), maxTop])].sort((a, c) => a - c);
  const barName = (y: number) => (y === vb ? 'Travesaño inferior' : y === maxTop ? 'Travesaño superior' : y === trayBarY && bandeja ? 'Travesaño de la ranura de la bandeja' : 'Travesaño de la puerta');
  frontIds.push(postsFront[0], postsFront[1]);
  for (const y of frontBars) {
    const lo: Vec3 = [s, y, D - s], hi: Vec3 = [W - s, y + s, D];
    frontIds.push(tuboP(barName(y), 'x', lo, hi));
    jFrame.push(...bothEnds(lo, hi, 'x', 'z'));
  }
  const jambs: [number, number][] = [];
  if (ox0 > s + 0.01) jambs.push([ox0 - s, ox0]);
  if (ox1 < W - s - 0.01) jambs.push([ox1, ox1 + s]);
  for (const [a, c] of jambs) {
    const lo: Vec3 = [a, oy0, D - s], hi: Vec3 = [c, oy1, D];
    frontIds.push(tuboP('Montante de la puerta', 'y', lo, hi));
    jFrame.push(...bothEnds(lo, hi, 'y', 'z'));
  }
  // Bastidor trasero
  const backIds: string[] = [postsBack[0], postsBack[1]];
  for (const y of [vb, maxTop]) {
    const lo: Vec3 = [s, y, 0], hi: Vec3 = [W - s, y + s, s];
    backIds.push(tuboP(barName(y), 'x', lo, hi));
    jFrame.push(...bothEnds(lo, hi, 'x', 'z'));
  }
  // Marco de la puerta principal
  const doorIds: string[] = [];
  const fx0 = ox0 + G, fx1 = ox1 - G, fy0 = oy0 + G, fy1 = oy1 - G;
  doorIds.push(tuboP('Larguero del marco de puerta', 'y', [fx0, fy0, D - s], [fx0 + s, fy1, D]));
  doorIds.push(tuboP('Larguero del marco de puerta', 'y', [fx1 - s, fy0, D - s], [fx1, fy1, D]));
  for (const y of [fy0, fy1 - s]) {
    const lo: Vec3 = [fx0 + s, y, D - s], hi: Vec3 = [fx1 - s, y + s, D];
    doorIds.push(tuboP('Travesaño del marco de puerta', 'x', lo, hi));
    jFrame.push(...bothEnds(lo, hi, 'x', 'z'));
  }
  // Marco de la puerta de servicio (plano en el lateral derecho)
  const servIds: string[] = [];
  const gz0 = sz0 + G, gz1 = sz1 - G, gy0 = sy0 + G, gy1 = sy1 - G;
  if (servicio) {
    servIds.push(tuboP('Larguero del marco de servicio', 'y', [W - s, gy0, gz0], [W, gy1, gz0 + s]));
    servIds.push(tuboP('Larguero del marco de servicio', 'y', [W - s, gy0, gz1 - s], [W, gy1, gz1]));
    for (const y of [gy0, gy1 - s]) {
      const lo: Vec3 = [W - s, y, gz0 + s], hi: Vec3 = [W, y + s, gz1 - s];
      servIds.push(tuboP('Travesaño del marco de servicio', 'z', lo, hi));
      jFrame.push(...bothEnds(lo, hi, 'z', 'x'));
    }
  }

  // Conjunto: travesaños de fondo (esquinas), de percha y de la puerta de servicio
  const setIds: string[] = [];
  const sideBarsL = [vb, ...perchBars, maxTop];
  const sideBarsR = [...new Set([vb, ...(servicio ? [sBarLow, sy1] : []), ...perchBars, maxTop])].sort((a, c) => a - c);
  const sideName = (y: number) => (y === vb ? 'Travesaño de fondo inferior' : y === maxTop ? 'Travesaño de fondo superior' : perchBars.includes(y) ? 'Travesaño de percha' : 'Travesaño de la puerta de servicio');
  for (const [x0s, bars] of [[0, sideBarsL], [W - s, sideBarsR]] as const) {
    for (const y of bars) {
      const lo: Vec3 = [x0s, y, s], hi: Vec3 = [x0s + s, y + s, D - s];
      setIds.push(tuboP(sideName(y), 'z', lo, hi));
      jSet.push(...bothEnds(lo, hi, 'z', 'y'));
    }
  }
  if (servicio) {
    for (const [a, c] of [[sz0 - s, sz0], [sz1, sz1 + s]]) {
      const lo: Vec3 = [W - s, sy0, a], hi: Vec3 = [W, sy1, c];
      setIds.push(tuboP('Montante de la puerta de servicio', 'y', lo, hi));
      jSet.push(...bothEnds(lo, hi, 'y', 'x'));
    }
  }
  // Pletinas de apoyo del suelo, entre los travesaños de fondo inferiores
  const nCross = innerD > 500 ? 3 : 2;
  const crossZ = repartir(s + 30, D - s - 30 - CROSS_W, nCross);
  const crossIds = crossZ.map((z) => {
    const lo: Vec3 = [s, vb + s - 3, z], hi: Vec3 = [W - s, vb + s, z + CROSS_W];
    jSet.push(...bothEnds(lo, hi, 'x', 'y'));
    return b.pletina({ ref: R(`pletina:30x3:${W - 2 * s}`), name: 'Pletina de apoyo del suelo', section: [3, CROSS_W], length: W - 2 * s, axis: 'x', at: lo });
  });
  setIds.push(...crossIds);
  // Placas de rueda
  const plateIds: string[] = [];
  const postCenters: [number, number][] = [[s / 2, D - s / 2], [W - s / 2, D - s / 2], [s / 2, s / 2], [W - s / 2, s / 2]];
  if (ruedas) {
    for (const [cx, cz] of postCenters) {
      plateIds.push(b.pletina({ ref: R('placa'), name: 'Placa de rueda', section: [PLT, PLW], length: PLW, axis: 'x', at: [cx - PLW / 2, RH, cz - PLW / 2] }));
      jSet.push(endJoint([cx - s / 2, y0, cz - s / 2], [cx + s / 2, vt, cz + s / 2], 'y', 'min', 'x'));
    }
  }

  // --- malla ---
  type FaceKey = 'front' | 'back' | 'left' | 'right' | 'top';
  const meshParts: string[] = [];
  const meshFix: Mark[] = [];
  const ins = s / 4;
  const addMesh = (face: FaceKey, name: string, u0: number, u1: number, v0: number, v1: number) => {
    const du = u1 - u0, dv = v1 - v0;
    const key = `malla:${r1(Math.max(du, dv))}x${r1(Math.min(du, dv))}`;
    const ref = R(key);
    let id: string;
    if (face === 'front' || face === 'back') id = b.malla({ ref, name, face: [du, dv], normal: 'z', cell: luz, wire: MT, at: [u0, v0, face === 'front' ? D : -MT] });
    else if (face === 'left' || face === 'right') id = b.malla({ ref, name, face: [dv, du], normal: 'x', cell: luz, wire: MT, at: [face === 'left' ? -MT : W, v0, u0] });
    else id = b.malla({ ref, name, face: [du, dv], normal: 'y', cell: luz, wire: MT, at: [u0, vt, v0] });
    const part = b.parts.find((p) => p.id === id)!;
    part.stock = `Malla electrosoldada ${galv ? 'galvanizada' : 'sin recubrimiento de zinc'}, luz ${String(r1(luz)).replace('.', ',')} × ${String(r1(luz)).replace('.', ',')} mm`;
    meshParts.push(id);
    const toW = (u: number, w: number): Vec3 =>
      face === 'front' ? [u, w, D + MT] : face === 'back' ? [u, w, -MT] : face === 'left' ? [-MT, w, u] : face === 'right' ? [W + MT, w, u] : [u, vt + MT, w];
    const ax: Axis = face === 'front' || face === 'back' ? 'z' : face === 'top' ? 'y' : 'x';
    const pts = fixPoints(u0, u1, v0, v1, ins).map(([u, w]) => toW(u, w));
    meshFix.push(...(soldada ? pts.map(punto) : tornillos(pts, ax)));
  };
  const h = s / 2;
  for (const [u0, u1, v0, v1] of faceCells(W, frontBars, s, { u0: ox0, u1: ox1, v0: oy0, v1: oy1 }, (y) => bandeja && Math.abs(y - (vb + s)) < 0.01)) addMesh('front', 'Paño de malla delantero', u0 - h, u1 + h, v0 - h, v1 + h);
  addMesh('front', 'Malla de la puerta', fx0 + h, fx1 - h, fy0 + h, fy1 - h);
  addMesh('back', 'Paño de malla trasero', h, W - h, vb + h, vt - h);
  for (const [u0, u1, v0, v1] of faceCells(D, sideBarsL, s, null, () => false)) addMesh('left', 'Paño de malla lateral', u0 - h, u1 + h, v0 - h, v1 + h);
  for (const [u0, u1, v0, v1] of faceCells(D, sideBarsR, s, servicio ? { u0: sz0, u1: sz1, v0: sy0, v1: sy1 } : null, () => false)) addMesh('right', 'Paño de malla lateral', u0 - h, u1 + h, v0 - h, v1 + h);
  if (servicio) addMesh('right', 'Malla de la puerta de servicio', gz0 + h, gz1 - h, gy0 + h, gy1 - h);
  if (!techoTablero) addMesh('top', 'Paño de malla del techo', h, W - h, h, D - h);

  // --- herrajes de puertas ---
  const doorHw: string[] = [];
  const doorMarks: Mark[] = [];
  const gx = hingeLeft ? ox0 + G / 2 : ox1 - G / 2;
  const lx = hingeLeft ? ox1 - G / 2 : ox0 + G / 2;
  for (const yh of [fy0 + (fy1 - fy0) * 0.15, fy1 - (fy1 - fy0) * 0.15 - 50]) {
    doorHw.push(b.herraje({ ref: R('pernio'), name: 'Pernio de la puerta', size: [12, 50, 12], at: [gx - 6, yh, D], stock: 'Pernio para soldar de 50 mm (bisagra de cilindro para rejas)' }));
    doorMarks.push(punto([gx - 6, yh + 25, D]), punto([gx + 6, yh + 25, D]), cordon([gx - 6, yh, D], [gx - 6, yh + 50, D]), cordon([gx + 6, yh, D], [gx + 6, yh + 50, D]));
  }
  const ly = (fy0 + fy1) / 2;
  doorHw.push(b.herraje({ ref: R('pasador'), name: 'Pasador de la puerta', size: [40, 15, 10], at: [lx - 20, ly - 7.5, D], stock: 'Pasador de resbalón para soldar, pequeño' }));
  doorMarks.push(cordon([lx - 20, ly - 7.5, D], [lx - 20, ly + 7.5, D]), cordon([lx + 20, ly - 7.5, D], [lx + 20, ly + 7.5, D]));
  if (servicio) {
    const gzz = sz0 + G / 2, lzz = sz1 - G / 2;
    for (const yh of [gy0 + 10, gy1 - 60]) {
      doorHw.push(b.herraje({ ref: R('pernio'), name: 'Pernio de la puerta de servicio', size: [12, 50, 12], at: [W, yh, gzz - 6], stock: 'Pernio para soldar de 50 mm (bisagra de cilindro para rejas)' }));
      doorMarks.push(punto([W, yh + 25, gzz - 6]), punto([W, yh + 25, gzz + 6]), cordon([W, yh, gzz - 6], [W, yh + 50, gzz - 6]), cordon([W, yh, gzz + 6], [W, yh + 50, gzz + 6]));
    }
    const lyy = (gy0 + gy1) / 2;
    doorHw.push(b.herraje({ ref: R('pasador'), name: 'Pasador de la puerta de servicio', size: [10, 15, 40], at: [W, lyy - 7.5, lzz - 20], stock: 'Pasador de resbalón para soldar, pequeño' }));
    doorMarks.push(cordon([W, lyy - 7.5, lzz - 20], [W, lyy + 7.5, lzz - 20]), cordon([W, lyy - 7.5, lzz + 20], [W, lyy + 7.5, lzz + 20]));
  }
  const nPernios = servicio ? 4 : 2, nPasadores = servicio ? 2 : 1;

  // --- interior: suelo o bandeja, perchas, ruedas, techo ---
  const interior: string[] = [];
  const intMarks: Mark[] = [];
  const intHw: HardwareLine[] = [];
  let floorBolts = 0;
  if (bandeja) {
    interior.push(b.panel({ ref: R('bandeja'), name: 'Bandeja extraíble', material: 'contrachapado', thickness: TT, face: [W - 2 * s - 4, D - s - 2], normal: 'y', at: [s + 2, vb + s, s + 2] }));
    interior.push(b.herraje({ ref: R('tirador'), name: 'Tirador de la bandeja', size: [24, 8, 15], at: [W / 2 - 12, vb + s + 2, D], stock: 'Pomo o tirador pequeño con tornillo para madera' }));
  } else {
    interior.push(b.panel({ ref: R('suelo'), name: 'Suelo de tablero', material: 'contrachapado', thickness: TT, face: [W - 2 * s, D - 2 * s], normal: 'y', at: [s, vb + s, s] }));
    const pts: Vec3[] = crossZ.flatMap((z): Vec3[] => [[s + 60, floorTop, z + CROSS_W / 2], [W - s - 60, floorTop, z + CROSS_W / 2]]);
    intMarks.push(...tornillos(pts, 'y'));
    floorBolts = pts.length;
    intHw.push(hw('Tornillo M5 × 25 mm de cabeza alomada con tuerca autoblocante y arandela', floorBolts));
  }
  const perchIds = perchBars.map((y) => b.redondo({ ref: R(`percha:${pd}`), name: 'Percha', diameter: pd, length: W - 2 * s, axis: 'x', at: [s, y + s / 2 - pd / 2, D / 2 - pd / 2] }));
  interior.push(...perchIds);
  const perchScrewL = ceil5(s + 25);
  if (perchIds.length) {
    intMarks.push(...tornillos(perchBars.flatMap((y): Vec3[] => [[0, y + s / 2, D / 2], [W, y + s / 2, D / 2]]), 'x'));
    intHw.push(hw(`Tornillo para madera de cabeza alomada 4 × ${perchScrewL} mm`, perchIds.length * 2));
  }
  if (ruedas) {
    for (const [i, [cx, cz]] of postCenters.entries()) {
      interior.push(b.herraje({ ref: R(i < 2 ? 'ruedaF' : 'ruedaS'), name: i < 2 ? 'Rueda giratoria con freno' : 'Rueda giratoria', size: [40, RH, 40], at: [cx - 20, 0, cz - 20], stock: i < 2 ? 'Rueda giratoria de placa con freno, altura total unos 70 mm' : 'Rueda giratoria de placa, altura total unos 70 mm' }));
      intMarks.push(...tornillos([[cx - 17, RH, cz - 17], [cx + 17, RH, cz - 17], [cx - 17, RH, cz + 17], [cx + 17, RH, cz + 17]], 'y'));
    }
    intHw.push(hw('Tornillo M6 × 16 mm con tuerca y arandela (comprueba el taladro de la placa de tus ruedas)', 16));
  }
  let roofBolts = 0;
  const roofBoltL = ceil5(TT + s + 8);
  if (techoTablero) {
    interior.push(b.panel({ ref: R('techo'), name: 'Techo de tablero', material: 'contrachapado', thickness: TT, face: [W, D], normal: 'y', at: [0, vt, 0] }));
    const nx = Math.max(2, Math.ceil((W - 2 * s - 120) / 400) + 1), nz = Math.max(1, Math.ceil((D - 2 * s - 120) / 400));
    const pts: Vec3[] = [
      ...repartir(s + 60, W - s - 60, nx).flatMap((x): Vec3[] => [[x, vt + TT, s / 2], [x, vt + TT, D - s / 2]]),
      ...repartir(s + 60, D - s - 60, nz).flatMap((z): Vec3[] => [[s / 2, vt + TT, z], [W - s / 2, vt + TT, z]]),
    ];
    intMarks.push(...tornillos(pts, 'y'));
    roofBolts = pts.length;
    intHw.push(hw(`Tornillo M5 × ${roofBoltL} mm de cabeza alomada con tuerca autoblocante y arandela`, roofBolts));
  }

  // ---------- textos ----------
  const luzTxt = esp ? esp.luzTxt : `${mm(luz)} (la has indicado tú)`;
  const nFix = meshFix.length;
  const screwL = 19;
  const tecPunteo = {
    name: 'Punteado antes de soldar',
    why: 'Los puntos son soldaduras pequeñas y provisionales que fijan la posición y la escuadra antes de dar los cordones. Si algo queda torcido, un punto pequeño se quita con la amoladora y se rehace (TWI). En pared fina, un punto grande perfora el tubo.',
    how: [
      'Sujeta las piezas con sargentos o mordazas sobre una superficie plana y metálica, con la pinza de masa bien apretada a la pieza o a la mesa.',
      'Da un punto corto en una cara de la unión, comprueba la escuadra y da el segundo en la cara opuesta.',
      'Usa algo menos de calor que para el cordón y limpia la escoria de cada punto antes de seguir.',
    ],
  };
  const tecCordon = {
    name: `Cordones cortos alternando lados (${proc.name})`,
    why: 'El calor de cada cordón encoge el acero al enfriarse y tira de la pieza. TWI recomienda poco volumen de soldadura y un orden que equilibre esas tensiones; repartir los cordones por el bastidor evita que el calor se acumule en una esquina y la deforme. En tubo fino, Miller recomienda cordón recto sin balanceo.',
    how: [
      proc.ajuste,
      'Suelda un lado de una unión, pasa a la unión opuesta en diagonal y vuelve: nunca termines todos los lados de una esquina seguidos.',
      'Si perforas, baja el amperaje (o la velocidad de hilo) y avanza algo más deprisa. Lincoln recomienda un respaldo de cobre detrás de la junta cuando sea posible.',
      'Pica la escoria y cepilla cada cordón antes de dar el siguiente sobre él.',
    ],
  };

  const zincAves = 'Merck incluye la malla y el alambre galvanizados entre las fuentes de zinc para aves, y VCA cita casos de envenenamiento por zinc en aves que mordían jaulas de alambre galvanizado.';

  // ---------- pasos ----------
  b.step({
    kind: 'cortar',
    title: 'Corta el tubo, la pletina, la malla y los tableros',
    summary: 'Deja todas las piezas a medida y marcadas con su letra antes de soldar nada.',
    detail: [
      `Corta el tubo de ${tubo.label} a escuadra con tronzadora o amoladora con disco de corte; los postes miden ${mm(vt - y0)} y los travesaños delanteros y traseros ${mm(W - 2 * s)}.`,
      'Quita la rebaba de cada corte con una lima o con disco de láminas: una rebaba impide que la unión cierre a tope.',
      `Corta los paños de malla a la medida de la lista con tenazas o cizalla, dejando el corte justo en la mitad de cada alambre de borde; la luz es de ${luzTxt}.`,
      `Corta la bandeja o el suelo de tablero de ${mm(TT)}${techoTablero ? ' y el tablero del techo' : ''} y marca en cada pieza su letra con rotulador.`,
      ...(esp?.aviso ? [esp.aviso] : []),
      ...(notasMin.length ? notasMin : []),
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de herrero', 'Rotulador de metal', 'Tronzadora o amoladora con disco de corte', 'Lima o disco de láminas', 'Tenazas o cizalla para malla', 'Sierra para el tablero'],
    check: 'Junta los cuatro postes de pie y comprueba que miden lo mismo; haz lo mismo con cada pareja de travesaños.',
    warning: 'Con la amoladora usa gafas o pantalla, guantes y protección auditiva, y sujeta el tubo en un tornillo de banco, nunca con la mano.',
  });

  b.step({
    kind: 'preparar',
    title: 'Limpia y prepara las juntas',
    summary: 'El metal limpio se suelda mejor y con menos poros.',
    detail: [
      'Desengrasa los extremos de cada tubo justo antes de soldar. TWI relaciona la grasa, el aceite y la humedad con la porosidad.',
      'Quita la cascarilla o el óxido con un cepillo o disco de láminas en una franja de unos dedos alrededor de cada unión.',
      'Comprueba que el tubo no es galvanizado. Si lo es, retira el zinc a ambos lados de la junta antes de soldar (TWI) o, mejor, compra tubo sin galvanizar para una jaula de animales.',
      `Prepara una superficie plana y metálica de al menos ${mm(Math.max(W, Hc + (vb - y0)) + 100)} para montar los bastidores, y un cubo de agua y un extintor a mano.`,
    ],
    parts: [],
    tools: ['Cepillo de alambre o disco de láminas', 'Desengrasante no clorado', 'Trapos'],
    warning: 'No uses desengrasantes clorados cerca de la soldadura: el INSST advierte del riesgo de formación de fosgeno.',
  });

  b.step({
    kind: 'soldar',
    title: 'Puntea los bastidores planos',
    summary: `Bastidor delantero, trasero y ${servicio ? 'los dos marcos de puerta' : 'el marco de la puerta'}, punteados en plano y a escuadra.`,
    detail: [
      `Tumba los dos postes delanteros sobre la mesa a ${mm(W - 2 * s)} entre caras interiores y coloca entre ellos los travesaños: el inferior con su cara baja a ${mm(vb - y0)} del extremo inferior del poste y el superior a ras de arriba.`,
      ...(bandeja ? [`El travesaño de la ranura deja ${mm(SLOT)} libres sobre el inferior: por ahí saldrá la bandeja de ${mm(TT)}.`] : []),
      `El hueco de la puerta mide ${mm(dW)} × ${mm(dH)} y su lado inferior queda a ${mm(oy0 - vb)} de la cara baja del bastidor.${jambs.length ? ` Coloca ${jambs.length === 1 ? 'el montante' : 'los dos montantes'} del hueco entre sus travesaños.` : ''}`,
      'Puntea cada unión con un punto en cada cara, mide las diagonales, corrige y repite con el bastidor trasero, que es igual sin la puerta.',
      `Arma el marco de la puerta (${mm(fx1 - fx0)} × ${mm(fy1 - fy0)}, ${mm(G)} menos de holgura por lado que el hueco)${servicio ? ` y el de la puerta de servicio (${mm(gz1 - gz0)} × ${mm(gy1 - gy0)})` : ''} de la misma manera.`,
    ],
    parts: [...frontIds, ...backIds, ...doorIds, ...servIds],
    marks: tackMarks(jFrame),
    technique: tecPunteo,
    hardware: [proc.consumible],
    tools: [...proc.tools, 'Careta de soldar', 'Guantes de soldador', 'Sargentos o mordazas de soldador', 'Escuadra magnética', 'Flexómetro'],
    check: 'Mide las dos diagonales de cada bastidor y de cada marco: deben ser iguales. Si no lo son, empuja la esquina larga antes de seguir punteando.',
    tip: 'Puntea siempre en esquinas opuestas, no en la de al lado: así el bastidor se cierra igual por los dos lados.',
    warning: proc.careta,
  });

  b.step({
    kind: 'soldar',
    title: 'Puntea el conjunto',
    summary: 'Une el bastidor delantero y el trasero con los travesaños de fondo, de percha y de suelo.',
    detail: [
      `Pon de pie los dos bastidores, uno frente al otro, a ${mm(D - 2 * s)} entre caras interiores, y sujétalos con sargentos y escuadras magnéticas.`,
      `Coloca los cuatro travesaños de fondo de esquina (${mm(D - 2 * s)}) a ras de las caras exteriores de los postes y puntéalos arriba y abajo.`,
      ...(perchBars.length ? [`Puntea en cada lateral ${perchBars.length === 1 ? 'el travesaño de percha' : 'los travesaños de percha'} a ${perchBars.map((y) => mm(y - vb)).join(' y ')} de la cara baja del bastidor.`] : []),
      ...(servicio ? [`En el lateral derecho, puntea los travesaños de la puerta de servicio y sus montantes: hueco de ${mm(sW)} × ${mm(sH)} centrado en el fondo.`] : []),
      `Puntea ${nCross} pletinas de apoyo del suelo entre los travesaños de fondo inferiores, a ras por arriba con ellos.`,
      ...(ruedas ? ['Da la vuelta a la jaula y puntea una placa de rueda centrada bajo cada poste.'] : []),
    ],
    parts: [...setIds, ...plateIds],
    marks: tackMarks(jSet),
    technique: tecPunteo,
    tools: [...proc.tools, 'Careta de soldar', 'Sargentos', 'Escuadras magnéticas', 'Nivel'],
    check: 'Mide las diagonales de cada cara lateral y del techo, y comprueba con el nivel que los postes están a plomo antes de dar ningún cordón.',
    tip: 'Pide ayuda para sostener los bastidores mientras das los primeros puntos.',
  });

  const allJ = [...jFrame, ...jSet];
  b.step({
    kind: 'soldar',
    title: 'Da los cordones definitivos alternando lados',
    summary: 'Convierte cada punto en un cordón completo sin dejar que el bastidor se tuerza.',
    detail: [
      `Hay ${allJ.length} uniones a tope; cada una lleva cordón en sus cuatro lados (en las pletinas de suelo, arriba y abajo).`,
      'Empieza por los bastidores: un lado de una unión, después el mismo lado de la unión opuesta en diagonal, y así hasta cerrar todas.',
      'Sigue por los travesaños de fondo con el mismo criterio: alterna delante y detrás, izquierda y derecha.',
      'Deja enfriar al aire; no enfríes con agua.',
      'Remata los marcos de puerta por separado y prueba que siguen entrando en su hueco con holgura.',
    ],
    parts: [],
    marks: weldMarks(allJ),
    technique: tecCordon,
    tools: [...proc.tools, 'Careta de soldar', 'Guantes de soldador', 'Escuadra'],
    check: 'Vuelve a medir las diagonales después de soldar. Si una cara se ha cerrado, el siguiente cordón dalo en el lado contrario.',
    warning: 'Aparta todo lo que pueda arder antes de soldar: OSHA pide alejar los combustibles unos 35 pies (unos 10,7 m) cuando sea posible. Ten un extintor a mano y vigila la zona un rato al acabar.',
  });

  b.step({
    kind: 'soldar',
    title: servicio ? 'Cuelga las dos puertas' : 'Cuelga la puerta',
    summary: 'Suelda los pernios y el pasador con la puerta calzada en su hueco.',
    detail: [
      `Calza el marco de la puerta en su hueco con chapitas de ${mm(G)} en los cuatro lados para que la holgura quede igual.`,
      `Coloca los dos pernios sobre la junta del lado ${hingeLeft ? 'izquierdo' : 'derecho'}, con el eje vertical y bien alineados entre sí.`,
      'Puntea cada pernio a los dos tubos, quita las calzas, abre y cierra, y solo entonces da un cordón corto a cada lado.',
      'Suelda el pasador en el lado contrario, a media altura del marco.',
      ...(servicio ? ['Repite lo mismo con la puerta de servicio en el lateral derecho.'] : []),
    ],
    parts: doorHw,
    marks: doorMarks,
    hardware: [
      hw('Pernio para soldar de 50 mm (bisagra de cilindro para rejas)', nPernios),
      hw('Pasador de resbalón pequeño para soldar', nPasadores),
      ...(ave ? [hw('Mosquetón pequeño para bloquear el pasador', nPasadores)] : []),
    ],
    tools: [...proc.tools, 'Careta de soldar', 'Calzas de chapa'],
    check: 'La puerta debe abrir y cerrar sin rozar y quedarse cerrada sola con el pasador echado.',
    tip: ave ? 'Muchos loros aprenden a abrir pasadores con el pico: pon un mosquetón en el pasador.' : 'Echa siempre el pasador: los roedores empujan las puertas hasta abrirlas.',
    warning: 'No te apoyes en la jaula mientras sueldas: la pieza está conectada a la masa.',
  });

  const fixHw: HardwareLine[] = soldada
    ? []
    : [
        hw(`Tornillo autotaladrante (punta broca) para chapa, cabeza hexagonal, 4,8 × ${screwL} mm`, nFix),
        hw('Arandela ancha (de carrocería) de agujero 5 mm', nFix),
      ];
  const mallaStep = () =>
    b.step({
      kind: soldada ? 'soldar' : 'montar',
      title: soldada ? 'Puntea la malla al bastidor' : 'Atornilla la malla por fuera',
      summary: `Fija los ${meshParts.length} paños de malla por la cara exterior del bastidor.`,
      detail: [
        'Cada paño cubre su hueco y llega hasta la mitad de los tubos que lo rodean; así el paño vecino apoya en la otra mitad.',
        'Presenta el paño, sujétalo con dos mordazas y comprueba que los alambres quedan paralelos al tubo.',
        ...(soldada
          ? [
              'Puntea en los cruces de alambre que apoyan sobre el tubo, a un cuarto del ancho del tubo desde el borde del paño, con el mínimo calor que haga prender el punto.',
              'Ceba el arco sobre el tubo y lleva el baño hacia el alambre: si apuntas al alambre, se funde antes de que el tubo se caliente.',
            ]
          : [
              `Atornilla un tornillo autotaladrante con arandela ancha cada ${mm(PASO_FIJ)} como máximo, a un cuarto del ancho del tubo desde el borde del paño: la arandela pisa los alambres contra el tubo.`,
              'Atornilla con el taladro a pocas vueltas y para en cuanto la arandela apriete: si te pasas, la rosca se come la pared del tubo.',
            ]),
        'Lima o dobla hacia fuera cualquier punta de alambre cortado: no puede quedar ninguna hacia el interior.',
        `Total: ${nFix} ${soldada ? 'puntos' : 'tornillos'}.`,
      ],
      parts: meshParts,
      marks: meshFix,
      technique: soldada
        ? {
            name: 'Malla soldada por puntos',
            why: 'Deja la malla fija para siempre y sin tornillos a la vista, pero el alambre de malla es mucho más fino que la pared del tubo y con electrodo o hilo se funde con facilidad. Solo merece la pena si ya dominas el punteado.',
            how: ['Practica antes en un recorte de malla y tubo.', 'Dirige el calor al tubo, no al alambre.', 'Si perforas o fundes un alambre, deja ese cruce y puntea el siguiente.'],
          }
        : {
            name: 'Malla atornillada con arandela ancha',
            why: 'Para quien suelda por primera vez es la opción realista: el alambre de malla es tan fino que con electrodo o hilo se funde antes de prender. Atornillada, se pinta el bastidor antes de montar la malla, el paño se cambia si se estropea y no hay que soldar cerca de un posible recubrimiento.',
            how: ['Presenta el paño y sujétalo con mordazas.', 'Atornilla primero las cuatro esquinas, después el centro de cada lado y luego el resto.', 'Comprueba con la mano que no queda ningún alambre suelto.'],
          },
      hardware: fixHw.length ? fixHw : undefined,
      tools: soldada ? [...proc.tools, 'Careta de soldar', 'Mordazas', 'Tenazas'] : ['Taladro atornillador con vaso hexagonal', 'Mordazas', 'Lima', 'Guantes'],
      check: 'Empuja cada paño con la mano por el centro y por los bordes: no debe moverse ni separarse del tubo.',
      warning: galv
        ? soldada
          ? 'La malla es galvanizada: al soldarla se desprende humo de zinc, que causa la fiebre de los humos metálicos (TWI). Si de verdad la sueldas, hazlo con extracción localizada.'
          : 'La malla es galvanizada. Para aves es una fuente de zinc documentada; revisa la nota de materiales antes de montarla.'
        : 'La tornillería cincada o galvanizada también tiene zinc: consulta con un veterinario de exóticos qué tornillos y arandelas usar, sobre todo si el animal puede alcanzarlos con el pico o los dientes.',
    });

  if (soldada) mallaStep();

  b.step({
    kind: 'preparar',
    title: 'Amola, taladra y pinta el bastidor',
    summary: 'Repasa los cordones, haz los taladros y protege el acero antes de montar lo demás.',
    detail: [
      'Pica la escoria de todos los cordones y repásalos con disco de láminas, sin comerte la pared del tubo.',
      `Taladra los agujeros que faltan: ${[
        ...(perchBars.length ? [`los de las perchas, de lado a lado de los travesaños de percha y centrados en el fondo (${mm(D / 2)})`] : []),
        ...(!bandeja ? ['los del suelo en las pletinas de apoyo'] : []),
        ...(techoTablero ? ['los del techo en los travesaños superiores'] : []),
        ...(ruedas ? ['los de las placas de rueda, según los taladros de tus ruedas'] : []),
      ].join('; ') || 'ninguno en esta configuración'}.`,
      'Limpia el polvo y el aceite y aplica imprimación y pintura siguiendo la ficha técnica del fabricante.',
      ave || espKey === 'rata' || espKey === 'degu' || espKey === 'planeador' || espKey === 'otra'
        ? 'Qué pintura es segura para un animal que muerde el metal no consta en la referencia: consúltalo con un veterinario de exóticos y deja curar la pintura el tiempo que indique el fabricante antes de meter al animal.'
        : 'Deja curar la pintura el tiempo que indique el fabricante.',
      ...(soldada ? ['No pintes la malla salvo que el veterinario te lo indique: protege los paños con cinta y papel.'] : []),
    ],
    parts: [],
    hardware: [hw('Imprimación para acero', 1, 'bote'), hw('Esmalte para metal', 1, 'bote'), hw('Disco de láminas para amoladora', 1)],
    tools: ['Amoladora con disco de láminas', 'Taladro y brocas para metal', 'Brocha o rodillo pequeño', 'Gafas de protección', 'Mascarilla'],
    tip: 'Taladra antes de pintar: así la pintura cubre también el borde del agujero.',
    warning: 'Pica la escoria con gafas y golpeando hacia fuera de tu cuerpo (INSST).',
  });

  if (!soldada) mallaStep();

  b.step({
    kind: 'montar',
    title: bandeja ? 'Mete la bandeja y monta el interior' : 'Atornilla el suelo y monta el interior',
    summary: [bandeja ? 'bandeja' : 'suelo', ...(perchIds.length ? ['perchas'] : []), ...(ruedas ? ['ruedas'] : []), ...(techoTablero ? ['techo'] : [])].join(', ').replace(/^./, (c) => c.toUpperCase()) + ' en su sitio.',
    detail: [
      bandeja
        ? `Mete la bandeja por la ranura delantera: apoya sobre las pletinas y sobre el travesaño inferior y sale del todo para limpiarla. Atornilla el tirador en el canto delantero.`
        : `Apoya el suelo de ${mm(TT)} sobre las pletinas y atorníllalo con ${floorBolts} tornillos M5 con tuerca autoblocante.`,
      'MSPCA prefiere el fondo macizo: no pongas suelo de malla, porque roza las patas y atrapa dedos y colas.',
      ...(perchIds.length ? [`Mete cada percha (${mm(W - 2 * s)}, Ø${mm(pd)}) entre los travesaños de percha y fíjala con un tornillo desde fuera en cada extremo, pasándolo por un hueco de la malla. Si la luz de malla no deja pasar el tornillo, coloca las perchas antes que la malla.`] : []),
      ...(ruedas ? ['Atornilla una rueda bajo cada placa, las dos con freno delante.'] : []),
      ...(techoTablero ? [`Atornilla el techo de tablero a los travesaños superiores con ${roofBolts} tornillos M5 × ${roofBoltL} mm.`] : []),
    ],
    parts: interior,
    marks: intMarks,
    hardware: intHw.length ? intHw : undefined,
    tools: ['Destornillador', 'Llave fija o de vaso de 8 mm', 'Taladro'],
    check: bandeja ? 'Saca y mete la bandeja: debe deslizar sin engancharse y no dejar hueco por el que quepa el animal.' : 'Golpea el suelo con la mano: no debe vibrar ni sonar suelto.',
  });

  b.step({
    kind: 'acabar',
    title: 'Revisa la jaula antes de estrenarla',
    summary: 'Una última pasada buscando puntas, holguras y piezas sueltas.',
    detail: [
      'Pasa la mano (con guante) por todo el interior buscando puntas de alambre, rebabas o tornillos que asomen.',
      'Comprueba que no hay ningún hueco mayor que la luz de malla: esquinas, ranura de la bandeja, holgura de las puertas.',
      'Abre y cierra las puertas varias veces con el pasador echado.',
      'Lava la jaula con agua y jabón neutro, aclara bien y deja airear antes de meter al animal.',
    ],
    parts: [],
    tools: ['Guantes', 'Cubo y esponja'],
    check: 'Si algo te da dudas sobre materiales o medidas para tu animal, consúltalo con un veterinario de exóticos antes de usarla.',
  });

  // ---------- meta ----------
  const outer: Vec3 = [W, vt, D];
  const safety = [
    'Careta de soldar con filtro certificado siempre que haya arco, también para puntear. ' + proc.careta,
    'Ropa de algodón ignífugo o lana, sin dobladillos ni bolsillos abiertos, mandil, polainas y botas de seguridad; guantes de soldador de tipo A, de manga larga y secos (INSST).',
    'El humo de soldadura no es seguro ni en acero dulce: el HSE pide extracción localizada en interior y protección respiratoria en exterior. No sueldes en un cuarto cerrado.',
    'No sueldes con el suelo mojado ni cambies el electrodo con guantes húmedos; revisa el aislamiento de los cables (INSST).',
    'Gafas o pantalla al amolar y al picar escoria; protección auditiva con la amoladora.',
    ...(ave ? [zincAves + (galv ? ' Has elegido malla galvanizada: no la recomendamos para aves.' : ' Evita mallas, cadenas y tornillería galvanizadas o cincadas al alcance del ave.')] : []),
    'Soldar acero galvanizado produce fiebre de los humos metálicos: retira el zinc de la zona o, mejor, usa tubo sin galvanizar (TWI).',
  ];
  const notes = [
    `Luz de malla: ${luzTxt}${esp ? ` para ${esp.label.toLowerCase()}` : ''}. No uses una luz mayor; si te ofrecen una menor, consulta con un veterinario de exóticos.`,
    ...(esp?.min ? [`Tamaño mínimo de la fuente: ${esp.min.txt}. Interior de esta jaula: ${inner().map((n) => Math.round(n)).join(' × ')} mm (ancho × fondo × alto útil).`] : []),
    ...notasMin,
    ...(esp?.aviso ? [esp.aviso] : []),
    ...(esp?.min?.modo === 'ordenado' ? ['La fuente no indica el orden de las tres medidas; se comprueba que cada medida interior, de mayor a menor, alcanza la correspondiente de la fuente.'] : []),
    ...(ave
      ? [
          `Zinc y aves: ${zincAves} La referencia no tiene verificado qué material alternativo es seguro: consulta con un veterinario de exóticos qué malla, tornillería y pintura usar.`,
        ]
      : ['La referencia solo documenta el riesgo del zinc en aves. Si tu animal roe el alambre, consulta con un veterinario de exóticos qué malla usar.']),
    'La malla va por fuera del bastidor: el animal no alcanza las arandelas ni las puntas de los tornillos, que quedan dentro del tubo.',
    'El diámetro de percha y el grosor de alambre adecuados para cada especie no constan en la referencia: consúltalos con un veterinario de exóticos.',
    'Fondo macizo de tablero con bandeja: MSPCA desaconseja los suelos de malla para pequeños animales. Si tu animal roe la madera, vigila el tablero y cámbialo cuando haga falta.',
    ...notasServ,
    ...notasPer,
    'Ninguna cifra de esta jaula es una carga admisible: no te subas ni cuelgues pesos de ella.',
  ];
  const sources: SourceRef[] = [
    ...(esp ? esp.fuentes : []),
    ...(ave ? [SRC.merckZinc, SRC.vca] : []),
    ...(esp && !esp.fuentes.includes(SRC.mspca) ? [SRC.mspca] : !esp ? [SRC.mspca] : []),
    ...(v.proceso === 'hilo' ? [SRC.innershield, SRC.millerMig] : [SRC.lincoln6013, SRC.millerStick]),
    SRC.lincolnGuia, SRC.osha, SRC.ntp494, SRC.hse, SRC.twiTack, SRC.twiDist, SRC.twiFiebre,
  ];

  const hours = Math.round(
    7 + (W + D + Hc) / 900 + (soldada ? 4 : 2) + (servicio ? 1.5 : 0) + (ruedas ? 0.5 : 0) + perchIds.length * 0.5 + (techoTablero ? 0.5 : 0),
  );

  return b.finish({
    id: 'jaula',
    title: 'Jaula',
    craft: 'soldadura',
    summary: `${vertical ? 'Jaula vertical' : 'Voladera horizontal'} de ${Math.round(W / 10)} × ${Math.round(D / 10)} × ${Math.round(Hc / 10)} cm${patas ? ' sobre patas' : ' de sobremesa'}${esp ? ` para ${esp.label.toLowerCase()}` : ''}, con malla de ${String(r1(luz)).replace('.', ',')} mm${!cumpleMin ? ' (POR DEBAJO del tamaño mínimo de la fuente)' : ''}.`,
    difficulty: soldada || servicio ? 3 : 2,
    hours,
    dims: [outer[0] + 2 * MT, outer[1] + (techoTablero ? TT : MT), outer[2] + 2 * MT],
    safety,
    notes,
    sources: [...new Map(sources.map((x) => [x.url, x])).values()],
    spec: [
      { label: 'Especie', value: esp ? esp.label : 'Otra (luz indicada por ti)' },
      { label: 'Luz de malla', value: luzTxt },
      { label: 'Cuerpo (exterior)', value: `${W} × ${D} × ${Hc} mm (ancho × fondo × alto)` },
      { label: 'Interior útil', value: `${inner().map((n) => Math.round(n)).join(' × ')} mm` },
      ...(esp?.min ? [{ label: 'Tamaño mínimo', value: cumpleMin ? (ajustado ? 'Cumple (medidas agrandadas)' : 'Cumple') : 'NO cumple: agranda la jaula' }] : []),
      { label: 'Forma', value: `${vertical ? 'Vertical' : 'Horizontal'}, ${patas ? `con patas (fondo a ${vb} mm del suelo)` : 'de sobremesa'}, techo ${techoTablero ? 'de tablero' : 'de malla'}` },
      { label: 'Tubo', value: tubo.label },
      { label: 'Malla', value: `${galv ? 'Galvanizada' : 'Sin recubrimiento de zinc'}, ${soldada ? 'soldada por puntos' : 'atornillada con arandela ancha'}` },
      { label: 'Puerta', value: `${dW} × ${dH} mm, ${pos}, ${v.puertaAltura === 'media' && oy0 > baseTop ? 'a media altura' : 'a ras del fondo'}` },
      { label: 'Detalles', value: [bandeja ? 'bandeja extraíble' : 'suelo fijo', perchIds.length ? `${perchIds.length} percha${perchIds.length > 1 ? 's' : ''} Ø${pd} mm` : '', ruedas ? 'ruedas' : '', servicio ? 'puerta de servicio' : ''].filter(Boolean).join(', ') },
      { label: 'Soldadura', value: proc.name },
    ],
  });
}
