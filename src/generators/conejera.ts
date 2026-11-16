import type { Generator, Mark, ParamValues, Part, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, tornillos } from '../core/builder';

/**
 * CONEJERA / CASETA DE MADERA Y MALLA.
 *
 * Ejes: X = largo (de izquierda a derecha), Z = fondo (trasera en z = 0, frente en z máx.), Y = alto.
 * Estructura de listón 45 × 45 con forro de contrachapado por fuera en trasera y costados,
 * suelo macizo de contrachapado, frente de puertas con malla y zona de nido cerrada.
 * Las medidas que da el usuario son las INTERIORES libres de cada nivel (entre caras de la estructura).
 *
 * Datos de bienestar: docs/referencia-tecnica.md §2 (RWAF, RSPCA, PDSA, RSPCA Australia, The Rabbit House).
 * La luz y el calibre de la malla NO están verificados en la referencia: son parámetros sin recomendación.
 */

const S = 45; // listón de estructura 45 × 45
const TC = 12; // contrachapado del forro
const TF = 15; // contrachapado de suelos, tabique y puerta del nido
const TR = 15; // contrachapado del tejado
const DF_W = 45, DF_T = 20; // listón de marcos de puerta 45 × 20
const GAP = 3; // holgura de puertas
const BAND_GAP = 47; // ranura bajo el umbral para la bandeja (frente de 45 + 2 de juego)
const BASE_T = 6; // fondo de la bandeja
const HUECO_W = 200, HUECO_H = 250; // hueco de paso del tabique (decisión de diseño)
const RAMPA_W = 160;
const PUERTA_MAX = 900; // ancho máximo de una puerta antes de añadir otra

const RWAF = { largo: 1800, fondo: 600, alto: 600 };

type Union = 'tornillo' | 'tubillon';

const SOURCES = [
  { label: 'RWAF: recomendaciones de espacio para conejos', url: 'https://rabbitwelfare.co.uk/welfare-need/space-recommendations/' },
  { label: 'RSPCA: entorno del conejo', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment' },
  { label: 'PDSA: el alojamiento ideal para tus conejos', url: 'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/creating-the-ideal-home-for-your-rabbits' },
  { label: 'RSPCA Australia: dónde tener a los conejos', url: 'https://kb.rspca.org.au/knowledge-base/where-should-i-keep-my-rabbits/' },
  { label: 'The Rabbit House: guía de tamaños', url: 'https://www.therabbithouse.com/guide_size.asp' },
  { label: 'The Rabbit House: protectores de madera (fuente secundaria)', url: 'https://www.therabbithouse.com/outdoor/petsafewoodstain.asp' },
  { label: 'USDA Wood Handbook, cap. 8 (taladro guía)', url: 'https://research.fs.usda.gov/download/treesearch/37424.pdf' },
  { label: 'SPAX: longitud de tornillo orientativa (2,5 × grosor)', url: 'https://www.spax.com/pc-en/services-for-professionals/technical-lexicon.html' },
  { label: 'Fine Woodworking: tubillones', url: 'https://www.finewoodworking.com/project-guides/joinery/james-krenovs-dowel-joint' },
];

/** Taladro guía según la USDA: raíz ≈ 2/3 del vástago; 70 % de la raíz en madera blanda. */
const piloto = (d: number) => Math.round(((d * 2) / 3) * 0.7 * 2) / 2;
const diamTubillon = (t: number) => [6, 8, 10, 12, 14, 16].find((x) => x >= t / 3) ?? 16;
const r10 = (n: number) => Math.round(n / 10) * 10;
/** Puntos repartidos a lo largo de un tramo, uno cada `cada` mm como máximo, sin los extremos. */
const cadaN = (a: number, b: number, cada: number, margen = 40): number[] => {
  const n = Math.max(2, Math.ceil((b - a - 2 * margen) / cada) + 1);
  return Array.from({ length: n }, (_, i) => a + margen + ((b - a - 2 * margen) * i) / (n - 1));
};

export const conejera: Generator = {
  id: 'conejera',
  title: 'Conejera',
  craft: 'carpinteria',
  difficulty: 2,
  description:
    'Caseta de madera para conejos con suelo macizo, zona de nido cerrada, puertas de malla y bandeja extraíble, elevada del suelo. Es el refugio: necesita un recinto de ejercicio mucho mayor unido a ella.',
  params: [
    { key: 'largo', label: 'Largo interior', type: 'number', min: 900, max: 2100, step: 50, unit: 'mm', default: 1800, group: 'Medidas', help: 'La RWAF pide al menos 1,8 m de largo para la caseta.' },
    { key: 'fondo', label: 'Fondo interior', type: 'number', min: 450, max: 900, step: 10, unit: 'mm', default: 600, group: 'Medidas', help: 'Al menos 600 mm (RWAF); 900 mm para razas grandes (The Rabbit House).' },
    { key: 'alto', label: 'Alto interior de cada nivel', type: 'number', min: 450, max: 900, step: 10, unit: 'mm', default: 600, group: 'Medidas', help: 'Debe poder ponerse de pie sobre las patas traseras sin tocar el techo con las orejas.' },
    {
      key: 'apoyo', label: 'Apoyo', type: 'select', default: 'patas', group: 'Forma',
      options: [
        { value: 'patas', label: 'Sobre patas', hint: 'Elevada del suelo' },
        { value: 'rastreles', label: 'Sobre rastreles', hint: 'Baja, para poner sobre una base firme' },
      ],
    },
    { key: 'altoPatas', label: 'Altura de las patas', type: 'number', min: 200, max: 700, step: 10, unit: 'mm', default: 400, group: 'Forma', help: 'Del terreno a la parte de abajo de la estructura.', visible: (v) => v.apoyo === 'patas' },
    {
      key: 'tejado', label: 'Tejado', type: 'select', default: 'inclinado', group: 'Forma',
      options: [
        { value: 'inclinado', label: 'Inclinado a un agua', hint: 'Desagua hacia atrás' },
        { value: 'plano', label: 'Plano', hint: 'Más sencillo; sirve de mesa' },
      ],
    },
    {
      key: 'niveles', label: 'Niveles', type: 'select', default: '1', group: 'Forma',
      help: 'El piso alto no cuenta como espacio de vida (RWAF). Necesita al menos 1,5 m de largo para que la rampa no quede empinada.',
      options: [
        { value: '1', label: 'Una planta' },
        { value: '2', label: 'Dos plantas con rampa' },
      ],
      visible: (v) => Number(v.largo) >= 1500,
    },
    { key: 'nido', label: 'Zona de nido cerrada', type: 'boolean', default: true, group: 'Detalles', help: 'Tabique con hueco de paso y puerta maciza: un refugio oscuro para dormir.' },
    {
      key: 'puertas', label: 'Puertas de malla por planta', type: 'select', default: '2', group: 'Detalles',
      options: [{ value: '1', label: 'Una' }, { value: '2', label: 'Dos' }],
    },
    { key: 'bandeja', label: 'Bandeja extraíble', type: 'boolean', default: true, group: 'Detalles', help: 'Sale por el frente, bajo las puertas, para limpiar sin meter la mano.' },
    { key: 'abatible', label: 'Tejado abatible', type: 'boolean', default: true, group: 'Detalles', help: 'Con bisagras atrás y cierres delante, para limpiar desde arriba.' },
    { key: 'vuelo', label: 'Vuelo del tejado', type: 'number', min: 0, max: 100, step: 10, unit: 'mm', default: 60, group: 'Detalles', help: 'Cuánto sobresale el tejado por delante y por los lados.' },
    {
      key: 'malla', label: 'Luz de malla', type: 'select', default: '13', group: 'Material',
      help: 'Las fuentes consultadas (RSPCA, PDSA) solo piden malla metálica de calibre grueso y fijaciones fuertes: no dan una luz concreta. Elige según tu caso y los depredadores de tu zona.',
      options: [
        { value: '13', label: '13 × 13 mm' },
        { value: '19', label: '19 × 19 mm' },
        { value: '25', label: '25 × 25 mm' },
      ],
    },
    {
      key: 'alambre', label: 'Grueso del alambre', type: 'select', default: '1.5', group: 'Material',
      help: 'Calibre sin cifra verificada en las fuentes: «de calibre grueso», según RSPCA.',
      options: [{ value: '1', label: '1 mm' }, { value: '1.5', label: '1,5 mm' }, { value: '2', label: '2 mm' }],
    },
    {
      key: 'union', label: 'Unión de la estructura', type: 'select', default: 'tornillo', group: 'Uniones',
      options: [
        { value: 'tornillo', label: 'Tornillo con taladro piloto', hint: 'Rápida y desmontable' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos en la estructura' },
      ],
    },
  ],
  presets: [
    {
      id: 'rwaf', name: 'Caseta RWAF 180 × 60 × 60', blurb: 'La caseta mínima que pide la RWAF, con nido, dos puertas de malla, bandeja y tejado a un agua.',
      values: { largo: 1800, fondo: 600, alto: 600, apoyo: 'patas', altoPatas: 400, tejado: 'inclinado', niveles: '1', nido: true, puertas: '2', bandeja: true, abatible: true, vuelo: 60, malla: '13', alambre: '1.5', union: 'tornillo' },
    },
    {
      id: 'dos-plantas', name: 'Caseta de dos plantas', blurb: '180 × 60 cm por planta, rampa con listones y nido en el piso alto.',
      values: { largo: 1800, fondo: 600, alto: 600, apoyo: 'patas', altoPatas: 300, tejado: 'plano', niveles: '2', nido: true, puertas: '2', bandeja: true, abatible: true, vuelo: 40, malla: '13', alambre: '1.5', union: 'tornillo' },
    },
    {
      id: 'grande', name: 'Caseta para razas grandes', blurb: '210 × 90 × 90 cm, sobre rastreles y con estructura de tubillones.',
      values: { largo: 2100, fondo: 900, alto: 900, apoyo: 'rastreles', tejado: 'inclinado', niveles: '1', nido: true, puertas: '2', bandeja: true, abatible: true, vuelo: 80, malla: '19', alambre: '2', union: 'tubillon' },
    },
  ],
  build,
};

interface Hueco { x0: number; x1: number; tipo: 'malla' | 'nido' }

function build(v: ParamValues) {
  const Li = Number(v.largo), Di = Number(v.fondo), Hi = Number(v.alto);
  const patas = v.apoyo === 'patas';
  const inclinado = v.tejado === 'inclinado';
  const dos = v.niveles === '2' && Li >= 1500;
  const nido = v.nido === true;
  const nPuertas = Number(v.puertas);
  const bandeja = v.bandeja === true;
  const abatible = v.abatible === true;
  const vu = Number(v.vuelo);
  const cell = Number(v.malla);
  const wire = Number(v.alambre);
  const union = v.union as Union;

  const b = new Builder();
  const letters = new Map<string, string>();
  const R = (key: string) => {
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + letters.size));
    return letters.get(key)!;
  };
  const part = (id: string) => b.parts.find((q) => q.id === id) as Part;
  /** Coloca una pieza ya creada con su centro en `c` y la gira (piezas inclinadas). */
  const place = (id: string, c: Vec3, rot: Vec3) => {
    part(id).pos = c;
    b.rotate(id, rot);
  };

  // ---------- cotas ----------
  const hp = patas ? Number(v.altoPatas) : S; // cara inferior de la estructura
  const yPost0 = patas ? 0 : S;
  const nNiv = dos ? 2 : 1;
  const yR: number[] = [hp]; // cara inferior de los largueros de cada suelo
  const floorTop: number[] = [];
  for (let k = 0; k < nNiv; k++) {
    floorTop.push(yR[k] + S + TF);
    yR.push(floorTop[k] + Hi);
  }
  const top = nNiv - 1;
  const topYb = floorTop[top] + Hi + S; // canto superior trasero
  const xI0 = TC + S, xI1 = TC + S + Li, Wext = 2 * TC + 2 * S + Li;
  const zI0 = TC + S, zF0 = TC + S + Di, zF1 = zF0 + S; // zF1 = cara delantera
  const rise = inclinado ? r10(zF1 * 0.18) : 0; // pendiente de diseño ≈ 10°
  const topYf = topYb + rise;
  const theta = Math.atan2(rise, zF1);
  const roofY = (z: number) => topYb + z * Math.tan(theta); // cara inferior del tejado
  const xPosts = [TC, xI1];

  // nido y bandeja en la planta de arriba
  const Ln = Math.min(700, Math.max(350, r10(Li * 0.33)));
  const xm = xI0 + Ln + S / 2; // eje del montante y del tabique del nido

  // rampa (dos plantas): junto a la trasera, sube hacia la derecha y desembarca a 300 mm del costado derecho
  const riseRampa = dos ? floorTop[1] - floorTop[0] : 0;
  const xTop = xI1 - 300; // canto derecho del hueco del piso alto (cabeza de la rampa)
  const runRampa = dos ? Math.min(riseRampa / Math.tan((40 * Math.PI) / 180), xTop - xI0 - 20) : 0;
  const xBot = xTop - runRampa;
  const LOP = 450; // largo del hueco del piso alto (decisión de diseño)
  const xOp0 = xTop - LOP;
  const zr = zI0 + 20; // cara trasera de la rampa
  const zOp1 = zr + RAMPA_W + 40; // borde delantero del hueco del piso alto

  // ================= piezas =================
  // --- testeros (postes + travesaños de los costados) ---
  const testeros: string[] = [];
  const postes: string[] = [];
  for (const x of xPosts) {
    postes.push(b.liston({ ref: R('posteT'), name: inclinado ? 'Poste trasero' : 'Poste', section: [S, S], length: topYb - yPost0, axis: 'y', at: [x, yPost0, TC] }));
    postes.push(b.liston({ ref: R(inclinado ? 'posteD' : 'posteT'), name: inclinado ? 'Poste delantero' : 'Poste', section: [S, S], length: topYf - yPost0, axis: 'y', at: [x, yPost0, zF0] }));
  }
  testeros.push(...postes);
  const travCostado: { x: number; y: number; yF?: number }[] = [];
  for (const x of xPosts) {
    for (let k = 0; k < nNiv; k++) {
      const y = yR[k] + TF;
      testeros.push(b.liston({ ref: R('travCostado'), name: 'Travesaño del costado', section: [S, S], length: Di, axis: 'z', at: [x, y, zI0] }));
      travCostado.push({ x, y: y + S / 2 });
    }
    if (!inclinado) {
      testeros.push(b.liston({ ref: R('travCostado'), name: 'Travesaño del costado', section: [S, S], length: Di, axis: 'z', at: [x, topYb - S, zI0] }));
      travCostado.push({ x, y: topYb - S / 2 });
    } else {
      const len = Math.hypot(Di, rise * (Di / zF1));
      const id = b.liston({ ref: R('travInclinado'), name: 'Travesaño inclinado del costado', section: [S, S], length: Math.round(len), axis: 'z', at: [x, topYb - S, zI0] });
      const zc = (zI0 + zF0) / 2;
      place(id, [x + S / 2, roofY(zc) - S / 2 / Math.cos(theta), zc], [-theta, 0, 0]);
      part(id).note = 'Corta los dos extremos a bisel siguiendo la pendiente del tejado.';
      testeros.push(id);
      travCostado.push({ x, y: topYb - S / 2, yF: topYf - S / 2 });
    }
    if (patas && hp >= 300) {
      testeros.push(b.liston({ ref: R('riostra'), name: 'Travesaño bajo entre patas', section: [S, S], length: Di, axis: 'z', at: [x, 120, zI0] }));
      travCostado.push({ x, y: 120 + S / 2 });
    }
  }

  // --- apoyo ---
  const apoyo: string[] = [];
  if (!patas) {
    for (const x of xPosts) apoyo.push(b.liston({ ref: R('rastrelApoyo'), name: 'Rastrel de apoyo', section: [S, S], length: zF1, axis: 'z', at: [x, 0, 0] }));
  }

  // --- largueros delanteros y traseros, viguetas ---
  const largos: string[] = [];
  const largoMarks: { y: number; z: number }[] = [];
  for (let k = 0; k <= nNiv; k++) {
    const yb = k < nNiv ? yR[k] : topYb - S;
    const yf = k < nNiv ? yR[k] : topYf - S;
    const nombre = k === 0 ? 'Larguero bajo' : k < nNiv ? 'Larguero del piso alto' : 'Larguero superior';
    largos.push(b.liston({ ref: R(`larg${k === 0 ? 0 : k < nNiv ? 1 : 2}`), name: nombre, section: [S, S], length: Li, axis: 'x', at: [xI0, yb, TC] }));
    largos.push(b.liston({ ref: R(`larg${k === 0 ? 0 : k < nNiv ? 1 : 2}`), name: nombre, section: [S, S], length: Li, axis: 'x', at: [xI0, yf, zF0] }));
    largoMarks.push({ y: yb + S / 2, z: TC + S / 2 }, { y: yf + S / 2, z: zF0 + S / 2 });
  }
  const viguetas: string[] = [];
  const vigMarks: { x: number; y: number; z0: number; z1: number }[] = [];
  const nVig = Math.ceil(Li / 600) + 1;
  for (let k = 0; k < nNiv; k++) {
    let xs = Array.from({ length: nVig }, (_, i) => xI0 + ((Li - S) * i) / (nVig - 1));
    if (k === 1) xs = xs.filter((x) => x === xI0 || x + S <= xOp0 - S - 50 || x >= xTop + S + 50).concat([xOp0 - S, xTop]).sort((a, c) => a - c);
    for (const x of xs) {
      viguetas.push(b.liston({ ref: R('vigueta'), name: 'Vigueta del suelo', section: [S, S], length: Di, axis: 'z', at: [x, yR[k], zI0] }));
      vigMarks.push({ x: x + S / 2, y: yR[k] + S / 2, z0: zI0, z1: zF0 });
    }
    if (k === 1) viguetas.push(b.liston({ ref: R('brochal'), name: 'Brochal del hueco de la rampa', section: [S, S], length: LOP, axis: 'x', at: [xOp0, yR[1], zOp1] }));
  }
  const montTrasero = nido
    ? [b.liston({ ref: R('montTrasero'), name: 'Montante trasero del nido', section: [S, S], length: topYb - S - floorTop[top], axis: 'y', at: [xm - S / 2, floorTop[top], TC] })]
    : [];

  // --- suelos ---
  const suelo0 = b.panel({ ref: R('suelo'), name: dos ? 'Suelo de la planta baja' : 'Suelo', material: 'contrachapado', thickness: TF, face: [Li, zF1 - TC], normal: 'y', at: [xI0, yR[0] + S, TC] });
  const suelosAltos: string[] = [];
  const rampa: string[] = [];
  let alpha = 0, lenRampa = 0;
  if (dos) {
    suelosAltos.push(b.panel({ ref: R('sueloAlto'), name: 'Suelo de la planta alta', material: 'contrachapado', thickness: TF, face: [xOp0 - xI0, zF1 - TC], normal: 'y', at: [xI0, yR[1] + S, TC] }));
    suelosAltos.push(b.panel({ ref: R('sueloAltoLado'), name: 'Suelo junto al hueco de la rampa', material: 'contrachapado', thickness: TF, face: [LOP, zF1 - zOp1], normal: 'y', at: [xOp0, yR[1] + S, zOp1] }));
    suelosAltos.push(b.panel({ ref: R('sueloAltoFin'), name: 'Suelo del desembarco de la rampa', material: 'contrachapado', thickness: TF, face: [xI1 - xTop, zF1 - TC], normal: 'y', at: [xTop, yR[1] + S, TC] }));
    // rampa: cara de arriba de A (cabeza, a la derecha) a B (pie, a la izquierda)
    const A: [number, number] = [xTop, floorTop[1]];
    const B: [number, number] = [xBot, floorTop[0] + TF];
    alpha = Math.atan2(A[1] - B[1], A[0] - B[0]);
    lenRampa = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const d: [number, number] = [-Math.cos(alpha), -Math.sin(alpha)]; // de la cabeza hacia el pie
    const n: [number, number] = [-Math.sin(alpha), Math.cos(alpha)];
    const id = b.panel({ ref: R('rampa'), name: 'Rampa', material: 'contrachapado', thickness: TF, face: [Math.round(lenRampa), RAMPA_W], normal: 'y', at: [0, 0, zr] });
    place(id, [(A[0] + B[0]) / 2 - (n[0] * TF) / 2, (A[1] + B[1]) / 2 - (n[1] * TF) / 2, zr + RAMPA_W / 2], [0, 0, alpha]);
    part(id).note = 'Corta los extremos a bisel para que apoyen planos en el suelo y contra el brochal.';
    rampa.push(id);
    for (let t = 100; t < lenRampa - 60; t += 100) {
      const c = b.liston({ ref: R('rampaListon'), name: 'Listón antideslizante de la rampa', section: [20, 10], length: RAMPA_W, axis: 'z', at: [0, 0, zr] });
      place(c, [A[0] + d[0] * t + n[0] * 5, A[1] + d[1] * t + n[1] * 5, zr + RAMPA_W / 2], [0, 0, alpha]);
      rampa.push(c);
    }
  }

  // --- frente: umbrales, montantes y zócalos ---
  const frente: string[] = [];
  const huecos: { k: number; y0: number; y1: number; list: Hueco[] }[] = [];
  const montMarks: Vec3[] = [];
  const tieneBandeja = (k: number) => bandeja && k === 0; // en dos plantas, abajo, delante de la rampa
  const zBand = dos ? zr + RAMPA_W + 10 : zI0 + 5; // borde trasero de la bandeja
  let bandejaX: [number, number] = [0, 0];
  for (let k = 0; k < nNiv; k++) {
    const gap = tieneBandeja(k) ? BAND_GAP : 0;
    const ySill = floorTop[k] + gap;
    frente.push(b.liston({ ref: R('umbral'), name: 'Umbral del frente', section: [S, S], length: Li, axis: 'x', at: [xI0, ySill, zF0] }));
    const yTopRail = k === top ? topYf - S : yR[k + 1];
    const y0 = ySill + S, y1 = yTopRail;
    const conNido = nido && k === top;
    const xOpen0 = conNido ? xm + S / 2 : xI0;
    const anchoAbierto = xI1 - xOpen0;
    const nP = Math.max(nPuertas, Math.ceil((anchoAbierto + S) / (PUERTA_MAX + S)));
    const list: Hueco[] = [];
    if (conNido) list.push({ x0: xI0, x1: xm - S / 2, tipo: 'nido' });
    const w = (anchoAbierto - (nP - 1) * S) / nP;
    for (let i = 0; i < nP; i++) list.push({ x0: xOpen0 + i * (w + S), x1: xOpen0 + i * (w + S) + w, tipo: 'malla' });
    for (let i = 0; i < list.length - 1; i++) {
      const mx = list[i].x1;
      frente.push(b.liston({ ref: R(`montanteF${Math.round(y1 - y0)}`), name: 'Montante del frente', section: [S, S], length: y1 - y0, axis: 'y', at: [mx, y0, zF0] }));
      montMarks.push([mx + S / 2, y0, zF1 - S / 2], [mx + S / 2, y1, zF1 - S / 2]);
    }
    huecos.push({ k, y0, y1, list });
    if (gap) {
      // la bandeja ocupa la zona abierta (sin pisar el hueco de la rampa); el resto de la ranura se cierra con zócalo
      const bx0 = xOpen0 + 2, bx1 = xI1 - 2;
      bandejaX = [bx0, bx1];
      if (xOpen0 > xI0) frente.push(b.liston({ ref: R('zocalo'), name: 'Zócalo fijo bajo el umbral', section: [S, S], length: xOpen0 - xI0, axis: 'x', at: [xI0, floorTop[k], zF0] }));
    }
  }

  // --- forro ---
  const forro: string[] = [];
  const forroMarks: Mark[] = [];
  const yForro = [hp, ...yR.slice(1, nNiv), topYb];
  for (let k = 0; k < nNiv; k++) {
    const ya = yForro[k], yb2 = yForro[k + 1];
    forro.push(b.panel({ ref: R(`forroT${k}`), name: nNiv > 1 ? `Forro trasero (planta ${k ? 'alta' : 'baja'})` : 'Forro trasero', material: 'contrachapado', thickness: TC, face: [Wext, yb2 - ya], normal: 'z', at: [0, ya, 0] }));
    for (const x of [0, Wext - TC]) {
      forro.push(b.panel({ ref: R(`forroC${k}`), name: nNiv > 1 ? `Forro del costado (planta ${k ? 'alta' : 'baja'})` : 'Forro del costado', material: 'contrachapado', thickness: TC, face: [yb2 - ya, zF1 - TC], normal: 'x', at: [x, ya, TC] }));
    }
  }
  // tornillos del forro: sobre postes y travesaños
  for (const x of xPosts) {
    forroMarks.push(...tornillos(cadaN(hp, topYb, 220).map((y): Vec3 => [x + S / 2, y, 0]), 'z'));
    const xo = x === TC ? 0 : Wext;
    for (const z of [TC + S / 2, zF0 + S / 2]) forroMarks.push(...tornillos(cadaN(hp, topYb, 220).map((y): Vec3 => [xo, y, z]), 'x'));
    for (const t of travCostado) if (t.x === x && t.yF === undefined) forroMarks.push(...tornillos(cadaN(zI0, zF0, 220, 30).map((z): Vec3 => [xo, t.y, z]), 'x'));
  }
  for (const lm of largoMarks.filter((q) => q.z < zI0)) forroMarks.push(...tornillos(cadaN(xI0, xI1, 250, 30).map((x): Vec3 => [x, lm.y, 0]), 'z'));
  if (montTrasero.length) forroMarks.push(...tornillos(cadaN(floorTop[top], topYb - S, 220).map((y): Vec3 => [xm, y, 0]), 'z'));
  // tabicas: cierran el triángulo bajo el tejado inclinado
  const tabicas: string[] = [];
  if (inclinado) {
    const h = (rise + 50) * Math.cos(theta);
    for (const x of [-TC, Wext]) {
      const id = b.panel({ ref: R('tabica'), name: 'Tabica inclinada del costado', material: 'contrachapado', thickness: TC, face: [Math.round(h), Math.round(zF1 / Math.cos(theta))], normal: 'x', at: [0, 0, 0] });
      const zc = zF1 / 2;
      place(id, [x + TC / 2, roofY(zc) - h / 2 / Math.cos(theta), zc], [-theta, 0, 0]);
      part(id).note = 'Tira de contrachapado que cierra por fuera el hueco triangular entre el forro y el tejado.';
      tabicas.push(id);
      forroMarks.push(...tornillos([0.25, 0.5, 0.75].map((f): Vec3 => [x === -TC ? -TC : Wext + TC, roofY(zF1 * f) - h / 2 / Math.cos(theta), zF1 * f]), 'x'));
    }
  }

  // --- tabique del nido ---
  const tabique: string[] = [];
  const ft = floorTop[top];
  if (nido) {
    tabique.push(b.panel({ ref: R('tabique'), name: 'Tabique del nido', material: 'contrachapado', thickness: TF, face: [topYb - ft, zF0 - zI0 - HUECO_W], normal: 'x', at: [xm - TF / 2, ft, zI0 + HUECO_W] }));
    tabique.push(b.panel({ ref: R('dintel'), name: 'Dintel del hueco de paso', material: 'contrachapado', thickness: TF, face: [topYb - ft - HUECO_H, HUECO_W], normal: 'x', at: [xm - TF / 2, ft + HUECO_H, zI0] }));
    tabique.push(b.liston({ ref: R('rastrel'), name: 'Rastrel de fijación del tabique', section: [DF_T, DF_W], length: topYb - S - ft, axis: 'y', at: [xm - TF / 2 - DF_T, ft, zF0 - DF_W] }));
    tabique.push(b.liston({ ref: R('rastrelCorto'), name: 'Rastrel corto del tabique', section: [DF_T, DF_W], length: topYb - S - ft - HUECO_H, axis: 'y', at: [xm - TF / 2 - DF_T, ft + HUECO_H, zI0] }));
  }

  // --- puertas ---
  const puertas: string[] = [];
  const puertaMarks: Mark[] = [];
  const herrajeMarks: Mark[] = [];
  let nBisagras = 0, nCierres = 0, nTornMalla = 0, nUnionesPuerta = 0;
  const zD = zF1 - DF_T; // cara trasera del marco de puerta
  for (const hq of huecos) {
    for (const h of hq.list) {
      const x0 = h.x0 + GAP, x1 = h.x1 - GAP, y0 = hq.y0 + GAP, y1 = hq.y1 - GAP;
      const W = x1 - x0, H = y1 - y0;
      if (h.tipo === 'nido') {
        puertas.push(b.panel({ ref: R('puertaNido'), name: 'Puerta maciza del nido', material: 'contrachapado', thickness: TF, face: [W, H], normal: 'z', at: [x0, y0, zF1 - TF] }));
      } else {
        puertas.push(b.malla({ ref: R(`malla${Math.round(W)}x${Math.round(H)}`), name: 'Malla de la puerta', face: [W, H], normal: 'z', cell, wire, at: [x0, y0, zD - wire] }));
        for (const x of [x0, x1 - DF_W]) puertas.push(b.liston({ ref: R(`larguero${Math.round(H)}`), name: 'Larguero de puerta', section: [DF_W, DF_T], length: H, axis: 'y', at: [x, y0, zD] }));
        for (const y of [y0, y1 - DF_W]) puertas.push(b.liston({ ref: R(`travPuerta${Math.round(W)}`), name: 'Travesaño de puerta', section: [DF_W, DF_T], length: W - 2 * DF_W, axis: 'x', at: [x0 + DF_W, y, zD] }));
        // uniones del marco (en el canto exterior del larguero, entrando hacia el travesaño)
        for (const [x, ax] of [[x0, 1], [x1, -1]] as const) for (const y of [y0 + DF_W / 2, y1 - DF_W / 2]) {
          const pts: Vec3[] = union === 'tubillon' ? [[x + ax * DF_W, y - 10, zF1 - DF_T / 2], [x + ax * DF_W, y + 10, zF1 - DF_T / 2]] : [[x, y, zF1 - DF_T / 2]];
          puertaMarks.push(...(union === 'tubillon' ? espigas(pts, 'x') : tornillos(pts, 'x')));
          nUnionesPuerta += pts.length;
        }
        const tm = [
          ...cadaN(x0, x1, 100, 20).flatMap((x): Vec3[] => [[x, y0 + DF_W / 2, zD], [x, y1 - DF_W / 2, zD]]),
          ...cadaN(y0, y1, 100, 60).flatMap((y): Vec3[] => [[x0 + DF_W / 2, y, zD], [x1 - DF_W / 2, y, zD]]),
        ];
        puertaMarks.push(...tornillos(tm, 'z'));
        nTornMalla += tm.length;
      }
      // bisagras a la izquierda, cierre a la derecha, en la cara delantera
      for (const yb of [y0 + H * 0.18, y1 - H * 0.18 - 60]) {
        puertas.push(b.herraje({ ref: R('bisagra'), name: 'Bisagra de la puerta', size: [50, 60, 3], at: [x0 - 25, yb, zF1], stock: 'Bisagra de libro de acero galvanizado de 60 mm' }));
        herrajeMarks.push(...tornillos([[x0 - 13, yb + 15, zF1 + 3], [x0 - 13, yb + 45, zF1 + 3], [x0 + 13, yb + 15, zF1 + 3], [x0 + 13, yb + 45, zF1 + 3]], 'z'));
        nBisagras++;
      }
      const yc = y0 + H / 2 - 12;
      puertas.push(b.herraje({ ref: R('cierre'), name: 'Pasador de la puerta', size: [60, 25, 10], at: [x1 - 35, yc, zF1], stock: 'Pasador de cerrojo de 60 mm con anilla para candado' }));
      herrajeMarks.push(...tornillos([[x1 - 25, yc + 12, zF1 + 10], [x1 - 10, yc + 12, zF1 + 10], [x1 + 10, yc + 12, zF1 + 10], [x1 + 20, yc + 12, zF1 + 10]], 'z'));
      nCierres++;
    }
  }

  // --- bandeja ---
  const bandejaParts: string[] = [];
  if (bandeja) {
    const [bx0, bx1] = bandejaX;
    const f = floorTop[0];
    bandejaParts.push(b.liston({ ref: R('bandFrente'), name: 'Frente de la bandeja', section: [S, S], length: bx1 - bx0, axis: 'x', at: [bx0, f, zF0] }));
    bandejaParts.push(b.panel({ ref: R('bandFondo'), name: 'Fondo de la bandeja', material: 'contrachapado', thickness: BASE_T, face: [bx1 - bx0, zF0 - zBand], normal: 'y', at: [bx0, f, zBand] }));
    bandejaParts.push(b.liston({ ref: R('bandBorde'), name: 'Borde trasero de la bandeja', section: [DF_T, DF_W], length: bx1 - bx0, axis: 'x', at: [bx0, f + BASE_T, zBand] }));
    for (const x of [bx0, bx1 - DF_W]) {
      bandejaParts.push(b.liston({ ref: R('bandLado'), name: 'Borde lateral de la bandeja', section: [DF_W, DF_T], length: zF0 - zBand - DF_W, axis: 'z', at: [x, f + BASE_T, zBand + DF_W] }));
    }
  }

  // --- tejado ---
  const tejado: string[] = [];
  const ext = inclinado ? TC : 0; // las tabicas sobresalen del forro
  const vb = abatible ? 0 : Math.min(vu, 20);
  const roofW = Wext + 2 * (vu + ext);
  const roofD = (zF1 + vu + vb) / Math.cos(theta);
  const roof = b.panel({ ref: R('tejado'), name: 'Tejado', material: 'contrachapado', thickness: TR, face: [roofW, Math.round(roofD)], normal: 'y', at: [-vu - ext, topYb, -vb] });
  if (inclinado) {
    const zc = (zF1 + vu - vb) / 2;
    place(roof, [Wext / 2, roofY(zc) + (TR / 2) * Math.cos(theta), zc - (TR / 2) * Math.sin(theta)], [-theta, 0, 0]);
  }
  tejado.push(roof);
  const nBisT = abatible ? (Wext > 1500 ? 3 : 2) : 0;
  const xsBis = nBisT === 3 ? [200, Wext / 2, Wext - 200] : [250, Wext - 250];
  const xsCierre = [TC + S + 60, Wext - TC - S - 120];
  if (abatible) {
    for (const x of xsBis) tejado.push(b.herraje({ ref: R('bisagraT'), name: 'Bisagra del tejado', size: [60, 60, 3], at: [x - 30, topYb - 60, -3], stock: 'Bisagra en T de acero galvanizado de 150 mm' }));
    for (const x of xsCierre) tejado.push(b.herraje({ ref: R('cierreT'), name: 'Cierre del tejado', size: [60, 30, 10], at: [x, topYf - 40, zF1], stock: 'Cierre de gancho (aldabilla) de 60 mm' }));
  }
  const roofMarks: Mark[] = abatible
    ? [
        ...tornillos(xsBis.flatMap((x): Vec3[] => [[x - 15, topYb - 40, -3], [x + 15, topYb - 40, -3], [x - 15, topYb - 15, -3], [x + 15, topYb - 15, -3]]), 'z'),
        ...tornillos(xsBis.flatMap((x) => [50, 120].map((z): Vec3 => [x, roofY(z) + TR / Math.cos(theta), z])), 'y'),
        ...tornillos(xsCierre.flatMap((x): Vec3[] => [[x + 12, topYf - 25, zF1 + 10], [x + 48, topYf - 25, zF1 + 10]]), 'z'),
      ]
    : tornillos([
        ...cadaN(xI0, xI1, 300, 30).flatMap((x): Vec3[] => [[x, roofY(TC + S / 2) + TR, TC + S / 2], [x, roofY(zF0 + S / 2) + TR, zF0 + S / 2]]),
      ], 'y');

  // ================= textos y cantidades =================
  const dt = diamTubillon(S);
  const pil5 = piloto(5), pil4 = piloto(4), pil35 = piloto(3.5);
  const isTub = union === 'tubillon';
  const fij = (pts: Vec3[], axis: 'x' | 'y' | 'z') => (isTub ? espigas(pts, axis) : tornillos(pts, axis));
  // marcas de la estructura
  const dy = 12;
  const marksTesteros: Mark[] = travCostado.flatMap((t) => [TC, zF1].flatMap((z) => {
    const y = z === zF1 && t.yF !== undefined ? t.yF : t.y;
    return fij([[t.x + S / 2, y - dy, z], [t.x + S / 2, y + dy, z]], 'z');
  }));
  const marksLargos: Mark[] = largoMarks.flatMap((l) => [TC, Wext - TC].flatMap((x) => fij([[x, l.y - dy, l.z], [x, l.y + dy, l.z]], 'x')));
  const marksVig: Mark[] = vigMarks.flatMap((q) => [q.z0 === zI0 ? TC : null, zF1].filter((z): z is number => z !== null).flatMap((z) => (z === TC || q.z1 === zF0 ? fij([[q.x, q.y, z]], 'z') : [])));
  if (dos) marksVig.push(...fij([[xOp0 - S, yR[1] + S / 2, zOp1 + S / 2], [xTop + S, yR[1] + S / 2, zOp1 + S / 2]], 'x'));
  const marksMontT: Mark[] = nido ? fij([[xm, ft, zI0 - S / 2], [xm, topYb - S, zI0 - S / 2]], 'y') : [];
  const marksApoyo: Mark[] = patas ? [] : tornillos(xPosts.flatMap((x) => [TC, zF0].flatMap((z): Vec3[] => [[x + S / 2, 0, z + 12], [x + S / 2, 0, z + S - 12]])), 'y');
  const nEstructura = marksTesteros.length + marksLargos.length + marksVig.length + marksMontT.length;
  const marksSuelo = (k: number): Mark[] => {
    const yT = floorTop[k];
    const xs = k === 0 ? [xI0, xI1] : [xI0, xOp0];
    const pts: Vec3[] = [
      ...cadaN(xs[0], xs[1], 250, 30).flatMap((x): Vec3[] => [[x, yT, TC + S / 2], [x, yT, zF0 + S / 2]]),
      ...vigMarks.filter((q) => Math.abs(q.y - (yR[k] + S / 2)) < 1 && q.z0 === zI0).flatMap((q) => cadaN(zI0, zF0, 250, 40).map((z): Vec3 => [q.x, yT, z])),
    ];
    if (k === 1) pts.push(
      ...cadaN(xOp0, xTop, 250, 30).flatMap((x): Vec3[] => [[x, yT, zF0 + S / 2], [x, yT, zOp1 + S / 2]]),
      ...cadaN(xTop, xI1, 250, 30).flatMap((x): Vec3[] => [[x, yT, TC + S / 2], [x, yT, zF0 + S / 2]]),
    );
    return tornillos(pts, 'y');
  };
  const mSuelo0 = marksSuelo(0);
  const mSuelo1 = dos ? marksSuelo(1) : [];
  const marksFrente: Mark[] = [
    ...huecos.flatMap((h) => [TC, Wext - TC].flatMap((x) => fij([[x, h.y0 - S / 2, zF0 + S / 2]], 'x'))),
    ...(isTub ? espigas(montMarks, 'y') : tornillos(montMarks, 'y')),
  ];
  const marksTabique: Mark[] = nido
    ? [
        ...tornillos(cadaN(ft, topYb - S, 200).map((y): Vec3 => [xm + TF / 2, y, zF0 - DF_W / 2]), 'x'),
        ...tornillos(cadaN(ft + HUECO_H, topYb - S, 200).map((y): Vec3 => [xm + TF / 2, y, zI0 + DF_W / 2]), 'x'),
        ...tornillos(cadaN(ft, topYb - S, 250).map((y): Vec3 => [xm - TF / 2 - DF_T / 2, y, zF1]), 'z'),
      ]
    : [];
  const rampaMarks: Mark[] = dos ? tornillos([[xTop + S, yR[1] + S / 2, zr + RAMPA_W * 0.3], [xTop + S, yR[1] + S / 2, zr + RAMPA_W * 0.7]], 'x') : [];

  const tecUnion = isTub
    ? {
        name: 'Tubillones encolados',
        why: `Dos tubillones de Ø${dt} mm por unión (entre un tercio y la mitad del grueso de 45 mm, como recomienda Fine Woodworking) alinean las piezas y dan superficie de cola sin dejar ninguna punta de tornillo que el conejo pueda roer o que se oxide.`,
        how: [
          'Marca los centros en la testa del travesaño tomando siempre la medida desde la cara de fuera.',
          `Taladra a Ø${dt} mm con tope de profundidad, transfiere los centros al poste con marcadores y taladra la pareja.`,
          'Monta en seco; después pon cola apta para exterior dentro de los agujeros, cierra con sargentos y limpia lo que rebose.',
        ],
      }
    : {
        name: 'Tornillo con taladro piloto',
        why: `En pino, un tornillo cerca de la testa raja la madera si no lleva piloto. La USDA dimensiona el taladro guía con el diámetro de raíz del tornillo (unos dos tercios del vástago) y, en madera blanda, en torno al 70 % de esa raíz: unos ${pil5} mm para un tornillo de 5 mm. En la pieza que se atraviesa, el taladro es del diámetro del vástago para que las piezas cierren.`,
        how: [
          'Sujeta las dos piezas con un sargento, a escuadra.',
          `Taladra de paso a 5 mm el poste y sigue con la broca de ${pil5} mm en la testa del travesaño.`,
          'Atornilla sin pasarte: en cuanto la cabeza asienta, para. Usa tornillo para exterior.',
        ],
      };
  const hwEstr = (n: number) => (isTub ? [hw(`Tubillón estriado de haya Ø${dt} × 60 mm`, n), hw('Cola para madera apta para exterior', 1, 'bote')] : [hw('Tornillo para madera de exterior, cabeza avellanada, 5 × 90 mm', n)]);
  const toolsEstr = isTub ? [`Broca de ${dt} mm con tope`, `Marcadores de tubillón de ${dt} mm`, 'Sargentos largos', 'Escuadra'] : ['Taladro', 'Broca de 5 mm', `Broca de ${pil5} mm`, 'Avellanador', 'Sargentos', 'Escuadra'];

  // ================= pasos =================
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: 'Deja cada pieza a su medida y con su letra antes de montar nada.',
    detail: [
      'Repasa la lista de corte y marca cada pieza a lápiz con escuadra. Corta los listones iguales a la vez o con un tope.',
      'Corta los tableros de contrachapado con la cara buena hacia abajo si usas sierra circular, para que no se astille.',
      ...(inclinado ? ['Las piezas inclinadas (travesaños de los costados y tabicas) se cortan a bisel: presenta cada una en su sitio y marca el ángulo antes de cortar.'] : []),
      'Matar todas las aristas que quedarán por dentro: el conejo las va a tocar y a roer.',
      'Escribe la letra de cada pieza en una cara que no se vaya a ver.',
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra', 'Lápiz', 'Sierra circular o de calar', 'Ingletadora (opcional)', 'Sargentos', 'Lija de grano 120'],
    check: 'Junta los postes por parejas sobre una superficie plana: los de cada pareja deben medir exactamente lo mismo.',
    tip: 'Elige los listones más rectos para los postes y los largueros: un listón torcido descuadra toda la caja.',
  });

  b.step({
    kind: 'montar',
    title: 'Arma los dos costados',
    summary: 'Cada costado es un marco de dos postes y sus travesaños; se monta tumbado en el banco.',
    detail: [
      `Tumba un poste trasero (${mm(topYb - yPost0)}) y uno delantero (${mm(topYf - yPost0)}) con ${mm(Di)} libres entre ellos.`,
      `Coloca los travesaños con la cara de arriba a ras del suelo de cada planta: el primero a ${mm(yR[0] + TF + S - yPost0)} del pie del poste${dos ? ` y el del piso alto a ${mm(yR[1] + TF + S - yPost0)}` : ''}.`,
      inclinado ? `El travesaño de arriba va inclinado, de la cabeza del poste trasero a la del delantero (${mm(rise)} de desnivel en todo el fondo).` : 'El travesaño de arriba va a ras de la cabeza de los postes.',
      ...(patas && hp >= 300 ? ['Añade el travesaño bajo entre las patas, a 120 mm del suelo: arriostra las patas largas.'] : []),
      ...(!patas ? ['Atornilla cada costado sobre su rastrel de apoyo, que corre bajo los dos postes (dos tornillos de 5 × 90 mm por poste, desde abajo).'] : []),
      ...tecUnion.how,
    ],
    parts: [...testeros, ...apoyo],
    marks: [...marksTesteros, ...marksApoyo],
    technique: tecUnion,
    hardware: [...hwEstr(marksTesteros.length), ...(marksApoyo.length ? [hw('Tornillo para madera de exterior, cabeza avellanada, 5 × 90 mm (rastreles)', marksApoyo.length)] : [])],
    tools: toolsEstr,
    check: 'Mide las diagonales de cada costado: deben ser iguales. Los dos costados deben quedar idénticos (ponlos uno encima del otro).',
  });

  b.step({
    kind: 'montar',
    title: 'Une los costados con los largueros',
    summary: 'Los largueros de delante y de detrás cierran la caja; las viguetas sostienen cada suelo.',
    detail: [
      'Pon los dos costados de pie y presenta los largueros bajos entre los postes, a ras por fuera.',
      `Fija primero los largueros bajos, después ${dos ? 'los del piso alto y ' : ''}los superiores, siempre alternando un extremo y el otro.`,
      `Coloca las viguetas del suelo cada ${mm(Li / (nVig - 1))} como mucho, a ras por arriba con los largueros, y fíjalas por los dos extremos.`,
      ...(dos ? [`En el piso alto deja el hueco de la rampa: ${mm(LOP)} de largo por ${mm(zOp1 - TC)} de fondo junto a la trasera, a ${mm(xI1 - xTop)} del costado derecho, con una vigueta a cada lado y un brochal delante.`] : []),
      ...(nido ? [`Pon el montante trasero del nido de pie contra la trasera, centrado a ${mm(xm)} del extremo izquierdo: recibirá el tabique.`] : []),
    ],
    parts: [...largos, ...viguetas, ...montTrasero],
    marks: [...marksLargos, ...marksVig, ...marksMontT],
    technique: tecUnion,
    hardware: hwEstr(marksLargos.length + marksVig.length + marksMontT.length),
    tools: [...toolsEstr, 'Nivel'],
    check: 'Mide las diagonales de la caja en planta y en el frente: deben ser iguales. Comprueba con el nivel que el suelo quedará horizontal.',
    warning: 'Monta la estructura sobre suelo plano. Si las patas cojean ahora, la caja quedará torcida.',
  });

  b.step({
    kind: 'montar',
    title: dos ? 'Atornilla el suelo de la planta baja' : 'Atornilla el suelo',
    summary: 'Un suelo macizo de contrachapado: nada de malla bajo las patas del conejo.',
    detail: [
      `Presenta el tablero de ${mm(Li)} × ${mm(zF1 - TC)} sobre largueros y viguetas, a ras de la trasera y de la cara delantera.`,
      `Taladra piloto de ${pil4} mm y atornilla cada ${mm(250)} aproximadamente sobre largueros y viguetas, con tornillo de 4 × 40 mm (2,5 veces el grueso del tablero, regla orientativa de SPAX).`,
      'Avellana para que ninguna cabeza sobresalga.',
    ],
    parts: [suelo0],
    marks: mSuelo0,
    hardware: [hw('Tornillo para madera de exterior, cabeza avellanada, 4 × 40 mm', mSuelo0.length)],
    tools: ['Taladro', `Broca de ${pil4} mm`, 'Avellanador', 'Atornillador'],
    warning: 'Suelo macizo siempre: la RSPCA advierte de que los suelos de alambre o de barrotes pueden dañar las patas y los corvejones.',
  });

  if (dos) {
    b.step({
      kind: 'montar',
      title: 'Coloca la rampa y el piso alto',
      summary: 'La rampa con listones une las dos plantas por el hueco del piso alto.',
      detail: [
        `Atornilla los ${rampa.length - 1} listones antideslizantes a la rampa cada ${mm(100)}, con cola y un tornillo de 3,5 × 20 mm por extremo.`,
        `Apoya el pie de la rampa en el suelo de abajo y su cabeza contra la vigueta del hueco: queda a unos ${Math.round((alpha * 180) / Math.PI)}° (decisión de diseño; si tu conejo duda, alarga la caseta).`,
        'Fija la cabeza de la rampa a la vigueta del hueco con dos tornillos de 5 × 70 mm metidos desde el otro lado de la vigueta.',
        `Atornilla los tres tableros del piso alto como el de abajo, dejando libre el hueco de ${mm(LOP)} × ${mm(zOp1 - TC)}.`,
      ],
      parts: [...rampa, ...suelosAltos],
      marks: [...rampaMarks, ...mSuelo1],
      hardware: [
        hw('Tornillo para madera de exterior, cabeza avellanada, 4 × 40 mm', mSuelo1.length),
        hw('Tornillo para madera de exterior, cabeza avellanada, 5 × 70 mm', rampaMarks.length),
        hw('Tornillo para madera de exterior, cabeza avellanada, 3,5 × 20 mm', 2 * (rampa.length - 1)),
      ],
      tools: ['Taladro', `Broca de ${pil4} mm`, `Broca de ${pil35} mm`, 'Avellanador'],
      check: 'Pisa la rampa con la mano: no debe moverse ni ceder. Los listones no deben tener aristas vivas.',
      tip: 'Mete la rampa antes de cerrar el piso alto: luego no cabe por el hueco con la inclinación buena.',
    });
  }

  b.step({
    kind: 'montar',
    title: 'Monta el frente',
    summary: 'Umbrales y montantes dejan los huecos de las puertas.',
    detail: [
      bandeja ? `En la planta ${dos ? 'baja ' : ''}el umbral va ${mm(BAND_GAP)} por encima del suelo: por esa ranura entra y sale la bandeja.` : 'Los umbrales apoyan sobre el suelo, a ras de la cara delantera: retienen la cama de heno.',
      `Coloca los montantes entre umbral y larguero: ${huecos.map((h) => h.list.map((q) => mm(q.x1 - q.x0)).join(' + ')).join(' / ')} de hueco libre.`,
      ...(bandeja ? ['Cierra con zócalos fijos la parte de la ranura que no ocupa la bandeja.'] : []),
      'Comprueba que cada hueco es un rectángulo: diagonales iguales.',
    ],
    parts: frente,
    marks: marksFrente,
    hardware: hwEstr(marksFrente.length),
    tools: toolsEstr,
    check: 'Mide la diagonal de cada hueco de puerta: si no son iguales, la puerta no cerrará bien.',
  });

  b.step({
    kind: 'montar',
    title: 'Forra la trasera y los costados',
    summary: 'El contrachapado cierra la caja y la arriostra.',
    detail: [
      `Atornilla primero los costados y después la trasera, que tapa sus cantos. Tornillo de 4 × 30 mm (2,5 veces el grueso de ${TC} mm) cada ${mm(220)} sobre postes y travesaños, con piloto de ${pil4} mm.`,
      ...(nNiv > 1 ? ['El forro va en dos alturas: la junta cae sobre el larguero del piso alto.'] : []),
      ...(inclinado ? ['Atornilla las tabicas inclinadas por fuera de los costados: cierran el hueco triangular que deja la pendiente bajo el tejado.'] : []),
      'Ninguna punta de tornillo debe asomar por dentro: el conejo se lastimaría.',
    ],
    parts: [...forro, ...tabicas],
    marks: forroMarks,
    hardware: [hw('Tornillo para madera de exterior, cabeza avellanada, 4 × 30 mm', forroMarks.length)],
    tools: ['Taladro', `Broca de ${pil4} mm`, 'Avellanador', 'Atornillador'],
    check: 'Con el forro puesto, la caja ya no debe descuadrarse al empujarla por una esquina.',
  });

  if (nido) {
    b.step({
      kind: 'montar',
      title: 'Pon el tabique del nido',
      summary: 'Un tabique con hueco de paso separa la zona oscura de dormir.',
      detail: [
        `El tabique va centrado en el montante del frente, a ${mm(Ln)} del costado izquierdo, y deja un hueco de paso de ${mm(HUECO_W)} × ${mm(HUECO_H)} junto a la trasera (medida de diseño: comprueba que tu conejo pasa holgado).`,
        'Atornilla los dos rastreles por el lado del nido al tabique y al dintel desde la zona abierta.',
        'Fija el rastrel largo al montante del frente desde fuera, y el corto contra el montante trasero.',
        'Lija bien los cantos del hueco de paso.',
      ],
      parts: tabique,
      marks: marksTabique,
      hardware: [hw('Tornillo para madera de exterior, cabeza avellanada, 4 × 30 mm', marksTabique.length - cadaN(ft, topYb - S, 250).length), hw('Tornillo para madera de exterior, cabeza avellanada, 5 × 70 mm', cadaN(ft, topYb - S, 250).length)],
      tools: ['Taladro', `Broca de ${pil4} mm`, `Broca de ${pil5} mm`, 'Sierra de calar', 'Lija'],
      tip: 'Deja el nido sin ventana: lo que el conejo busca ahí es oscuridad y resguardo.',
    });
  }

  b.step({
    kind: 'montar',
    title: 'Haz y cuelga las puertas',
    summary: 'Marcos de listón con malla por dentro y una puerta maciza para el nido.',
    detail: [
      `Arma cada marco con dos largueros y dos travesaños de ${DF_W} × ${DF_T} mm${isTub ? `, con dos tubillones de Ø8 mm por esquina` : `, con un tornillo de 4 × 70 mm por esquina metido por el canto del larguero (piloto de ${pil4} mm)`}.`,
      `Corta la malla a la medida del marco y fíjala por la cara de dentro con tornillo de 3,5 × 20 mm y arandela cada ${mm(100)}: que no quede ninguna punta de alambre hacia dentro.`,
      `Cuelga cada puerta con dos bisagras y deja ${mm(GAP)} de holgura alrededor. Pon un pasador en el lado contrario.`,
      'Lima las puntas de alambre que queden en los bordes de la malla.',
    ],
    parts: puertas,
    marks: [...puertaMarks, ...herrajeMarks],
    technique: {
      name: 'Malla fijada por dentro con arandela',
      why: 'La malla va en la cara interior del marco para que el conejo no alcance el canto del listón para roerlo, y la arandela reparte el apriete para que el alambre no se suelte con los empujones: las fuentes piden malla metálica gruesa y fijaciones fuertes.',
      how: ['Presenta la malla tensa y fija primero las cuatro esquinas.', 'Sigue por el centro de cada lado hacia las esquinas.', 'Corta el sobrante a ras con cizalla y lima las puntas.'],
    },
    hardware: [
      ...(nUnionesPuerta ? [isTub ? hw('Tubillón estriado de haya Ø8 × 40 mm', nUnionesPuerta) : hw('Tornillo para madera de exterior 4 × 70 mm', nUnionesPuerta)] : []),
      hw('Tornillo para madera de exterior 3,5 × 20 mm con arandela', nTornMalla),
      hw('Bisagra de libro de acero galvanizado de 60 mm', nBisagras),
      hw('Pasador de cerrojo de 60 mm con anilla para candado', nCierres),
      hw('Tornillo para madera 3,5 × 16 mm (para herrajes, 4 por herraje)', herrajeMarks.length),
    ],
    tools: ['Taladro', `Broca de ${pil35} mm`, 'Cizalla o alicate de corte', 'Lima', 'Guantes de trabajo', 'Atornillador'],
    warning: 'Usa guantes al cortar la malla: los alambres cortados pinchan y cortan.',
    check: 'Cada puerta debe cerrar sin rozar y el pasador entrar sin forzarlo. Empuja la malla desde dentro: no debe despegarse.',
  });

  if (bandeja) {
    const [bx0, bx1] = bandejaX;
    const f = floorTop[0];
    const marksBandeja: Mark[] = [
      ...tornillos([
        ...cadaN(bx0, bx1, 250, 30).map((x): Vec3 => [x, f, zBand + DF_W / 2]),
        ...[bx0 + DF_W / 2, bx1 - DF_W / 2].flatMap((x) => cadaN(zBand + DF_W, zF0, 250, 30).map((z): Vec3 => [x, f, z])),
      ], 'y'),
      ...tornillos([bx0 + DF_W / 2, bx1 - DF_W / 2].map((x): Vec3 => [x, f + BASE_T + DF_T / 2, zF1]), 'z'),
    ];
    b.step({
      kind: 'montar',
      title: 'Monta la bandeja extraíble',
      summary: 'Una bandeja de contrachapado con bordes bajos que sale por la ranura del frente.',
      detail: [
        `Encola los tres bordes sobre el fondo (${mm(bx1 - bx0)} × ${mm(zF0 - zBand)}) y atorníllalos desde abajo, con piloto de ${pil35} mm.`,
        'Atornilla el frente de la bandeja a los dos bordes laterales, desde delante.',
        `Los bordes son bajos (${mm(BASE_T + DF_T)} en total) para que pasen bajo el umbral al tirar de ella.`,
        'Méte la bandeja por la ranura del frente hasta que el frente quede a ras.',
      ],
      parts: bandejaParts,
      marks: marksBandeja,
      hardware: [hw('Tornillo para madera de exterior 3,5 × 30 mm', marksBandeja.length)],
      tools: ['Taladro', `Broca de ${pil35} mm`, 'Atornillador'],
      tip: 'Pon la cama de heno o paja sobre la bandeja: el contrachapado desnudo resbala.',
    });
  }

  b.step({
    kind: 'montar',
    title: abatible ? 'Pon el tejado abatible' : 'Fija el tejado',
    summary: abatible ? 'El tejado gira sobre bisagras traseras y se cierra con dos aldabillas delante.' : 'El tejado se atornilla a los largueros superiores.',
    detail: [
      `Presenta el tablero del tejado con ${mm(vu)} de vuelo por delante${inclinado ? ' y por los lados (más las tabicas)' : ' y por los lados'}.`,
      abatible ? `Atornilla ${nBisT} bisagras en T a la trasera y al tejado, con el eje a ras de la arista trasera.` : `Atornilla el tejado a los largueros superiores cada ${mm(300)}, con piloto de ${pil4} mm.`,
      ...(abatible ? ['Coloca las dos aldabillas en el larguero delantero para que el tejado no se pueda levantar desde fuera.'] : []),
      'Cubre el tejado con tela asfáltica, doblándola por los cantos y clavándola por debajo del vuelo.',
    ],
    parts: tejado,
    marks: roofMarks,
    hardware: [
      ...(abatible ? [hw('Bisagra en T de acero galvanizado de 150 mm', nBisT), hw('Cierre de gancho (aldabilla) de 60 mm', 2), hw('Tornillo para madera 3,5 × 16 mm (para herrajes)', roofMarks.length)] : [hw('Tornillo para madera de exterior, cabeza avellanada, 4 × 40 mm', roofMarks.length)]),
      hw('Tela asfáltica para tejado', Math.ceil(((roofW * roofD) / 1e6) * 1.2 * 10) / 10, 'm²'),
      hw('Clavo de cabeza ancha galvanizado para tela asfáltica', Math.ceil((2 * (roofW + roofD)) / 100), 'ud'),
    ],
    tools: ['Taladro', 'Atornillador', 'Cúter', 'Martillo'],
    warning: abatible ? 'Pide ayuda para presentar el tejado: es grande y pesa. Ciérralo siempre con las aldabillas.' : undefined,
  });

  b.step({
    kind: 'acabar',
    title: 'Protege la madera por fuera',
    summary: 'Un protector no tóxico solo en el exterior, y la caseta lista para su recinto.',
    detail: [
      'Lija las aristas y cantos interiores y quita cualquier astilla.',
      'Aplica un protector para exterior al agua, sin metales pesados, bajo en COV y nunca creosota, y solo por fuera: los fabricantes no garantizan que sea seguro si el conejo lo roe (The Rabbit House).',
      'Deja que el protector seque y se airee del todo, según el bote, antes de meter al conejo.',
      'Coloca la caseta en un sitio resguardado del sol directo y del viento, y únela a un recinto de ejercicio grande.',
    ],
    parts: [],
    hardware: [hw('Lija de grano 80 y 120', 2, 'pliegos de cada'), hw('Protector de madera para exterior al agua, sin creosota', 1, 'bote')],
    tools: ['Taco de lija o lijadora orbital', 'Brocha', 'Guantes', 'Mascarilla antipolvo'],
    warning: 'No trates el interior con barnices ni protectores: el conejo roe la madera. Sin creosota en ningún caso.',
  });

  const cumpleRWAF = Li >= RWAF.largo && Di >= RWAF.fondo && Hi >= RWAF.alto;
  return b.finish({
    id: 'conejera',
    title: 'Conejera',
    craft: 'carpinteria',
    summary: `Caseta de ${Li / 10} × ${Di / 10} × ${Hi / 10} cm interiores${dos ? ' por planta, en dos plantas' : ''}, ${inclinado ? 'con tejado a un agua' : 'con tejado plano'}${nido ? ', nido cerrado' : ''}${bandeja ? ' y bandeja extraíble' : ''}.`,
    difficulty: dos ? 3 : 2,
    hours: 12 + (dos ? 5 : 0) + (nido ? 1 : 0) + (bandeja ? 1 : 0) + (isTub ? 4 : 0) + (inclinado ? 1 : 0),
    dims: [Wext, topYf + TR, zF1],
    safety: [
      'Esta caseta es solo el refugio: la RWAF dice que una caseta nunca debe ser el alojamiento único ni principal. Necesita unida, con acceso libre las 24 horas, una zona de al menos 3 × 2 m y 1 m de alto para una pareja (RWAF, RSPCA, PDSA).',
      'Suelo macizo, sin malla: los suelos de alambre o de barrotes pueden dañar patas y corvejones (RSPCA).',
      'Ningún tornillo, grapa o alambre debe asomar por dentro. Revisa las mallas y los cierres a menudo: deben resistir a depredadores.',
      'Tratamientos no tóxicos y solo por fuera; nunca creosota.',
      'Gafas al cortar y taladrar, guantes al cortar malla y mascarilla al lijar.',
    ],
    notes: [
      `Medidas interiores: ${Li} × ${Di} × ${Hi} mm${dos ? ' por planta' : ''}. La RWAF pide para la zona de dormir al menos 1,8 × 0,6 × 0,6 m: ${cumpleRWAF ? 'esta caseta llega a ese mínimo.' : 'esta caseta NO llega a ese mínimo; úsala solo como refugio dentro de un recinto amplio.'}`,
      'Espacio total recomendado para dos conejos: no menos de 3 × 2 × 1 m (RSPCA, RWAF, PDSA), en un solo bloque y disponible siempre. El piso alto de una caseta de dos plantas, las plataformas y los túneles no cuentan (RWAF).',
      'Altura: el conejo debe poder ponerse de pie sobre las patas traseras sin tocar el techo con las orejas (RSPCA, PDSA). La RSPCA Australia da un mínimo de 45 cm para conejos de más de 12 semanas; The Rabbit House aconseja 60 cm para razas pequeñas y unos 90 cm para grandes, y 90 cm de ancho para razas grandes.',
      `La caseta queda elevada del terreno (${patas ? `${hp} mm sobre patas` : 'sobre rastreles: ponla sobre una base firme y seca, no sobre tierra húmeda'}), como piden RSPCA y PDSA frente a la humedad y los depredadores.`,
      `Malla: ${cell} × ${cell} mm con alambre de ${String(wire).replace('.', ',')} mm. Las fuentes consultadas no dan una luz ni un calibre verificados, solo «malla metálica de calibre grueso»: la elección es tuya.`,
      'Maderas o tableros tratados en autoclave y especies tóxicas: no hay una fuente oficial verificada; ante la duda, usa pino sin tratar por dentro.',
      ...(inclinado ? [`Pendiente del tejado de diseño: ${mm(rise)} de desnivel (unos ${Math.round((theta * 180) / Math.PI)}°), desaguando hacia atrás. Sobre el tabique del nido queda un hueco triangular de ventilación bajo el tejado.`] : ['El tejado plano lleva tela asfáltica: comprueba tras las lluvias que no se encharca.']),
      ...(dos ? [`Rampa de ${mm(lenRampa)} a unos ${Math.round((alpha * 180) / Math.PI)}° (decisión de diseño).`] : []),
      ...(v.niveles === '2' && !dos ? ['Con menos de 1,5 m de largo la rampa quedaría demasiado empinada: se ha hecho de una planta.'] : []),
    ],
    sources: SOURCES,
    spec: [
      { label: 'Interior por planta', value: `${Li} × ${Di} × ${Hi} mm` },
      { label: 'Mínimo de caseta RWAF (1,8 × 0,6 × 0,6 m)', value: cumpleRWAF ? 'Cumple' : 'No llega' },
      { label: 'Medidas exteriores', value: `${Math.round(Wext)} × ${Math.round(zF1)} × ${Math.round(topYf + TR)} mm` },
      { label: 'Plantas', value: dos ? 'Dos, con rampa' : 'Una' },
      { label: 'Tejado', value: `${inclinado ? 'Inclinado a un agua' : 'Plano'}${abatible ? ', abatible' : ', fijo'}, vuelo ${vu} mm` },
      { label: 'Apoyo', value: patas ? `Patas de ${hp} mm` : 'Rastreles' },
      { label: 'Nido cerrado', value: nido ? `Sí, ${Ln} mm de largo con hueco de ${HUECO_W} × ${HUECO_H} mm` : 'No' },
      { label: 'Puertas de malla', value: String(huecos.reduce((a, h) => a + h.list.filter((q) => q.tipo === 'malla').length, 0)) },
      { label: 'Bandeja extraíble', value: bandeja ? 'Sí' : 'No' },
      { label: 'Malla', value: `${cell} × ${cell} mm, alambre ${String(wire).replace('.', ',')} mm` },
      { label: 'Unión de la estructura', value: tecUnion.name },
      { label: 'Fijaciones de la estructura', value: `${nEstructura} ${isTub ? 'tubillones' : 'tornillos'}` },
    ],
  });
}
