import type { Generator, HardwareLine, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, repartir, tornillos } from '../core/builder';

/**
 * BANCO DE MADERA.
 * Dos caballetes (dos patas + travesaño de asiento) unidos por faldones delantero y trasero,
 * con asiento de lamas a lo largo. Formas: simple o con respaldo (patas traseras altas y
 * travesaños de respaldo). Detalles: reposabrazos, zapatero inferior de listones, arcón con
 * tapa abatible (en el banco simple), número y ancho de lamas.
 *
 * Se traza con el frente en z = 0 y al final se refleja en Z (en el modelo, Z crece hacia delante).
 */

const TL = 20; // grueso de las lamas
const G = 10; // separación entre lamas del asiento
const RH = 70; // alto de faldones y travesaños (listón 70 × 20)
const RT = 20; // grueso de faldones y travesaños
const TP = 18; // tablero del arcón
const HB = 160; // cara superior de los travesaños del zapatero
const LZ = 70; // ancho de los listones del zapatero
const ARM = 200; // altura del reposabrazos sobre el asiento (decisión de diseño)
const PANEL_Y0 = 100; // cara inferior de los paneles del arcón

type Union = 'bolsillo' | 'tubillon' | 'espiga';
interface Rect { x0: number; x1: number; z0: number; z1: number }

function letras() {
  const m = new Map<string, string>();
  return (k: string) => {
    if (!m.has(k)) m.set(k, String.fromCharCode(65 + m.size));
    return m.get(k)!;
  };
}

/** Puntos de fijación de una lama sobre un apoyo, en la cara de contacto. */
function fijacionesLama(lama: Rect, apoyo: Rect, y: number): Vec3[] {
  const x0 = Math.max(lama.x0, apoyo.x0), x1 = Math.min(lama.x1, apoyo.x1);
  const z0 = Math.max(lama.z0, apoyo.z0), z1 = Math.min(lama.z1, apoyo.z1);
  const dx = x1 - x0, dz = z1 - z0;
  if (dx < 15 || dz < 15) return [];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (dx > 150) {
    // apoyo a lo largo de la lama (faldón): un tornillo cada ~300 mm
    const n = Math.max(2, Math.round(dx / 300));
    return repartir(x0 + 50, x1 - 50, n).map((x): Vec3 => [x, y, cz]);
  }
  if (dz > 150) {
    const n = Math.max(2, Math.round(dz / 300));
    return repartir(z0 + 50, z1 - 50, n).map((z): Vec3 => [cx, y, z]);
  }
  if (dz >= 60) return [[cx, y, cz - dz / 4], [cx, y, cz + dz / 4]];
  if (dx >= 60) return [[cx - dx / 4, y, cz], [cx + dx / 4, y, cz]];
  return [[cx, y, cz]];
}

export const banco: Generator = {
  id: 'banco',
  title: 'Banco',
  craft: 'carpinteria',
  difficulty: 1,
  description:
    'Banco de lamas sobre dos caballetes, simple o con respaldo. Con reposabrazos, zapatero inferior o arcón con tapa abatible.',
  params: [
    { key: 'largo', label: 'Largo', type: 'number', min: 600, max: 1800, step: 10, unit: 'mm', default: 1200, group: 'Medidas' },
    { key: 'alto', label: 'Altura del asiento', type: 'number', min: 380, max: 520, step: 5, unit: 'mm', default: 450, group: 'Medidas', help: 'Hasta la cara superior de las lamas.' },
    {
      key: 'forma', label: 'Forma', type: 'select', default: 'simple', group: 'Forma',
      options: [
        { value: 'simple', label: 'Banco simple', hint: 'Asiento sobre dos caballetes' },
        { value: 'respaldo', label: 'Con respaldo', hint: 'Patas traseras altas con travesaños' },
      ],
    },
    {
      key: 'pata', label: 'Sección de la pata', type: 'select', default: '70', group: 'Forma',
      options: [
        { value: '45', label: '45 × 45 mm', hint: 'Ligero' },
        { value: '70', label: '70 × 70 mm', hint: 'Robusto, de jardín' },
      ],
    },
    {
      key: 'altoRespaldo', label: 'Alto del respaldo', type: 'number', min: 300, max: 500, step: 10, unit: 'mm', default: 400, group: 'Forma',
      help: 'Desde el asiento hasta el extremo de las patas traseras.', visible: (v) => v.forma === 'respaldo',
    },
    { key: 'lamas', label: 'Número de lamas del asiento', type: 'number', min: 4, max: 6, step: 1, unit: 'ud', default: 4, group: 'Detalles', help: 'Junto con el ancho, fija el fondo del asiento.' },
    {
      key: 'anchoLama', label: 'Ancho de lama', type: 'select', default: '95', group: 'Detalles',
      options: [
        { value: '70', label: '70 × 20 mm' },
        { value: '95', label: '95 × 20 mm' },
      ],
    },
    { key: 'reposabrazos', label: 'Reposabrazos', type: 'boolean', default: true, group: 'Detalles', visible: (v) => v.forma === 'respaldo' },
    { key: 'arcon', label: 'Arcón con tapa abatible', type: 'boolean', default: false, group: 'Detalles', help: 'El asiento se abre y debajo hay un cajón cerrado.', visible: (v) => v.forma !== 'respaldo' },
    { key: 'balda', label: 'Zapatero inferior', type: 'boolean', default: false, group: 'Detalles', help: `Listones a ${HB + TL} mm del suelo.`, visible: (v) => !(v.forma !== 'respaldo' && v.arcon === true) },
    {
      key: 'union', label: 'Tipo de unión', type: 'select', default: 'bolsillo', group: 'Uniones',
      options: [
        { value: 'bolsillo', label: 'Tornillo', hint: 'En bolsillo en la estructura, visto y avellanado en las lamas' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos' },
        { value: 'espiga', label: 'Caja y espiga', hint: 'Tradicional, sin tornillos' },
      ],
    },
  ],
  presets: [
    {
      id: 'entrada', name: 'Banco de entrada con arcón', blurb: 'Un metro de largo: te sientas a calzarte y guardas dentro bufandas y gorros.',
      values: { largo: 1000, alto: 450, forma: 'simple', pata: '45', lamas: 4, anchoLama: '95', arcon: true, balda: false, union: 'bolsillo' },
    },
    {
      id: 'jardin', name: 'Banco de jardín con respaldo', blurb: '1,4 m con respaldo y reposabrazos, patas de 70 × 70.',
      values: { largo: 1400, alto: 440, forma: 'respaldo', pata: '70', altoRespaldo: 420, lamas: 5, anchoLama: '70', reposabrazos: true, balda: false, union: 'tubillon' },
    },
    {
      id: 'zapatero', name: 'Banco zapatero', blurb: '80 cm de largo con listones abajo para los zapatos.',
      values: { largo: 800, alto: 450, forma: 'simple', pata: '45', lamas: 4, anchoLama: '95', arcon: false, balda: true, union: 'bolsillo' },
    },
  ],
  build,
};

function build(v: ParamValues) {
  const Lg = Number(v.largo), Hs = Number(v.alto);
  const resp = v.forma === 'respaldo';
  const s = Number(v.pata);
  const hR = Number(v.altoRespaldo);
  const n = Math.round(Number(v.lamas));
  const w = Number(v.anchoLama);
  const brazos = resp && v.reposabrazos === true;
  const arcon = !resp && v.arcon === true;
  const balda = !arcon && v.balda === true;
  const union = (v.union as Union) ?? 'bolsillo';

  const L = letras();
  const b = new Builder();

  // --- cotas (frente en z = 0) ---
  const Dz = n * w + (n - 1) * G; // fondo del asiento
  const ox = resp ? 0 : 60; // vuelo de las lamas por los extremos
  const oz = resp ? 0 : 20; // vuelo de las lamas por delante (y por detrás en el simple)
  const zr = resp ? Dz : Dz - oz - s; // cara delantera de la pata trasera
  const Dtot = resp ? Dz + s : Dz;
  const ySeat = Hs - TL; // cara superior de patas y travesaños de asiento
  const yR0 = ySeat - RH;
  const hFront = brazos ? Hs + ARM : ySeat;
  const hRear = resp ? Hs + hR : ySeat;
  const innerX = Lg - 2 * ox - 2 * s; // luz entre patas a lo largo
  const innerZ = zr - oz - s; // luz entre patas de delante a atrás
  const central = !arcon && innerX > 900;
  const divisor = arcon && innerX > 900;
  const ten = s === 45 ? 20 : 30; // largo de espiga en la pata
  const espiga = union === 'espiga';

  const xRailL = ox + (s - RT) / 2, xRailR = Lg - ox - s + (s - RT) / 2;
  const zFal = oz + (s - RT) / 2, zFalB = zr + (s - RT) / 2;

  // ===================== piezas =====================
  const nombrePata = (h: number, del: boolean) => (resp ? (del ? 'Pata delantera' : 'Pata trasera') : 'Pata');
  const pata = (x: number, z: number, h: number, del: boolean) =>
    b.liston({ ref: L(`pata${h}`), name: nombrePata(h, del), section: [s, s], length: h, axis: 'y', at: [x, 0, z] });
  const patasL = [pata(ox, oz, hFront, true), pata(ox, zr, hRear, false)];
  const patasR = [pata(Lg - ox - s, oz, hFront, true), pata(Lg - ox - s, zr, hRear, false)];

  // caballetes: travesaño de asiento o costado del arcón
  const travAs = arcon
    ? [ox + s - TP, Lg - ox - s].map((x) => b.panel({ ref: L('costadoArcon'), name: 'Costado del arcón', thickness: TP, face: [ySeat - PANEL_Y0, innerZ], normal: 'x', at: [x, PANEL_Y0, oz + s], grain: 'z' }))
    : [xRailL, xRailR].map((x) => b.liston({ ref: L('travAsiento'), name: 'Travesaño de asiento', section: [RT, RH], length: innerZ, axis: 'z', at: [x, yR0, oz + s] }));

  // faldones o paneles del arcón
  const panelH = ySeat - PANEL_Y0;
  const faldones = arcon
    ? [
        b.panel({ ref: L('frenteArcon'), name: 'Frente del arcón', thickness: TP, face: [innerX, panelH], normal: 'z', at: [ox + s, PANEL_Y0, oz + s - TP], grain: 'x' }),
        b.panel({ ref: L('frenteArcon'), name: 'Trasera del arcón', thickness: TP, face: [innerX, panelH], normal: 'z', at: [ox + s, PANEL_Y0, zr], grain: 'x' }),
      ]
    : [
        b.liston({ ref: L('faldon'), name: 'Faldón', section: [RH, RT], length: innerX, axis: 'x', at: [ox + s, yR0, zFal] }),
        b.liston({ ref: L('faldon'), name: 'Faldón', section: [RH, RT], length: innerX, axis: 'x', at: [ox + s, yR0, zFalB] }),
      ];
  const rastreles = arcon
    ? [
        b.liston({ ref: L('rastrel'), name: 'Rastrel del fondo', section: [45, RT], length: innerX, axis: 'x', at: [ox + s, PANEL_Y0, oz + s] }),
        b.liston({ ref: L('rastrel'), name: 'Rastrel del fondo', section: [45, RT], length: innerX, axis: 'x', at: [ox + s, PANEL_Y0, zr - RT] }),
      ]
    : [];
  const bajos = balda
    ? [zFal, zFalB].map((z) => b.liston({ ref: L('travBajo'), name: 'Travesaño del zapatero', section: [RH, RT], length: innerX, axis: 'x', at: [ox + s, HB - RH, z] }))
    : [];
  // travesaños del respaldo
  const nRes = resp ? Math.max(2, Math.floor((hR - 90 + 40) / (w + 40))) : 0;
  const yRes = resp ? repartir(Hs + 90, Hs + hR - w, nRes) : [];
  const respaldo = yRes.map((y) => b.liston({ ref: L('respaldo'), name: 'Travesaño del respaldo', section: [w, RT], length: innerX, axis: 'x', at: [ox + s, y, zr] }));

  const centralId = central
    ? b.liston({ ref: L('central'), name: 'Travesaño central', section: [RT, RH], length: zFalB - (zFal + RT), axis: 'z', at: [Lg / 2 - RT / 2, yR0, zFal + RT] })
    : '';
  const yFondo = PANEL_Y0 + 45;
  const fondo = arcon ? b.panel({ ref: L('fondoArcon'), name: 'Fondo del arcón', thickness: TP, face: [innerX, innerZ], normal: 'y', at: [ox + s, yFondo, oz + s] }) : '';
  const divId = divisor ? b.panel({ ref: L('divisor'), name: 'Separador central', thickness: TP, face: [ySeat - yFondo - TP, innerZ], normal: 'x', at: [Lg / 2 - TP / 2, yFondo + TP, oz + s], grain: 'y' }) : '';

  // lamas del asiento (o de la tapa)
  const lamasR: Rect[] = [];
  const lamas: string[] = [];
  for (let k = 0; k < n; k++) {
    const z0 = k * (w + G);
    const corta = brazos && k === 0; // la delantera queda entre las patas que suben al reposabrazos
    const x0 = corta ? ox + s : 0, x1 = corta ? Lg - ox - s : Lg;
    lamasR.push({ x0, x1, z0, z1: z0 + w });
    lamas.push(b.liston({ ref: L(corta ? 'lamaCorta' : 'lama'), name: corta ? 'Lama delantera' : arcon ? 'Lama de la tapa' : 'Lama del asiento', section: [TL, w], length: x1 - x0, axis: 'x', at: [x0, ySeat, z0] }));
  }
  // travesaños de la tapa del arcón (de canto, bajo las lamas)
  const xTapa = arcon ? [ox + s + 10, Lg - ox - s - 10 - RT] : [];
  const lTapa = innerZ - 10;
  const travTapa = xTapa.map((x) => b.liston({ ref: L('travTapa'), name: 'Travesaño de la tapa', section: [RT, 45], length: lTapa, axis: 'z', at: [x, ySeat - 45, oz + s + 5] }));
  // bisagras: ala en la cara trasera del panel trasero, nudillo en la arista superior
  const xBis = arcon ? (innerX > 1000 ? repartir(ox + s + innerX * 0.2, Lg - ox - s - innerX * 0.2, 3) : [ox + s + innerX * 0.25, Lg - ox - s - innerX * 0.25]) : [];
  const bisagras = xBis.map((x) => b.herraje({ ref: L('bisagra'), name: 'Bisagra', size: [50, 30, 3], at: [x - 25, ySeat - 30, zr + TP], stock: 'Bisagra de libro de acero 50 mm' }));

  // listones del zapatero (a lo fondo, sobre los dos travesaños bajos)
  const nZ = balda ? Math.max(2, Math.floor((innerX + 25) / (LZ + 25))) : 0;
  const gapZ = balda ? (innerX - nZ * LZ) / (nZ + 1) : 0;
  const zZ0 = zFal, zZ1 = zFalB + RT;
  const zapR: Rect[] = [];
  const zap = Array.from({ length: nZ }, (_, i) => {
    const x = ox + s + gapZ + i * (LZ + gapZ);
    zapR.push({ x0: x, x1: x + LZ, z0: zZ0, z1: zZ1 });
    return b.liston({ ref: L('zap'), name: 'Listón del zapatero', section: [LZ, TL], length: zZ1 - zZ0, axis: 'z', at: [x, HB, zZ0] });
  });

  // reposabrazos
  const brazosIds = brazos
    ? [ox, Lg - ox - 70].map((x) => b.liston({ ref: L('brazo'), name: 'Reposabrazos', section: [70, RT], length: zr, axis: 'z', at: [x, hFront, 0] }))
    : [];

  // medidas de corte con espiga
  if (espiga) {
    const alargar = (ids: string[], extra: number, nota: string) => {
      for (const id of ids) {
        const p = b.parts.find((q) => q.id === id)!;
        const c = [...p.cut] as Vec3;
        c[0] += extra;
        p.cut = c.sort((a, d) => d - a) as Vec3;
        p.note = nota;
      }
    };
    const nt = `Incluye ${ten} mm de espiga en cada extremo.`;
    if (!arcon) alargar([...travAs, ...faldones], 2 * ten, nt);
    alargar([...bajos, ...respaldo], 2 * ten, nt);
    if (arcon) alargar([...travAs, ...faldones], 20, 'Incluye 10 mm por extremo que entran en la ranura de la pata.');
    if (divisor) alargar([divId], 12, 'Incluye 6 mm por canto que entran en la ranura del frente y de la trasera.');
  }

  // ===================== marcas =====================
  const tipoMarca = union === 'bolsillo' ? 'tornillo' : 'espiga';
  const fij = (pts: Vec3[], axis: 'x' | 'y' | 'z'): Mark[] => pts.map((at) => ({ type: tipoMarca, at, axis }) as Mark);
  const yMid = yR0 + RH / 2, dy = RH / 4;
  // caballete: travesaño (o costado) contra la cara de las patas
  const marcasCaballete = (xc: number): Mark[] => {
    if (arcon) {
      if (espiga) return [];
      const ys = repartir(PANEL_Y0 + 40, ySeat - 40, 3);
      return fij([oz + s, zr].flatMap((z) => ys.map((y): Vec3 => [xc, y, z])), 'z');
    }
    if (espiga) return fij([oz + s, zr].map((z): Vec3 => [xc, yMid, z]), 'z');
    return fij([oz + s, zr].flatMap((z): Vec3[] => [[xc, yMid - dy, z], [xc, yMid + dy, z]]), 'z');
  };
  const mCabL = marcasCaballete(arcon ? ox + s - TP / 2 : xRailL + RT / 2);
  const mCabR = marcasCaballete(arcon ? Lg - ox - s + TP / 2 : xRailR + RT / 2);
  // piezas largas contra la cara de las patas
  const largoEnPata = (y0: number, h: number, zc: number): Mark[] =>
    espiga ? fij([ox + s, Lg - ox - s].map((x): Vec3 => [x, y0 + h / 2, zc]), 'x') : fij([ox + s, Lg - ox - s].flatMap((x): Vec3[] => [[x, y0 + h / 2 - h / 4, zc], [x, y0 + h / 2 + h / 4, zc]]), 'x');
  const mFaldones: Mark[] = arcon
    ? (espiga ? [] : [oz + s - TP / 2, zr + TP / 2].flatMap((zc) => fij([ox + s, Lg - ox - s].flatMap((x) => repartir(PANEL_Y0 + 40, ySeat - 40, 3).map((y): Vec3 => [x, y, zc])), 'x')))
    : [zFal + RT / 2, zFalB + RT / 2].flatMap((zc) => largoEnPata(yR0, RH, zc));
  const mBajos: Mark[] = balda ? [zFal + RT / 2, zFalB + RT / 2].flatMap((zc) => largoEnPata(HB - RH, RH, zc)) : [];
  const mRespaldo: Mark[] = yRes.flatMap((y) => largoEnPata(y, w, zr + RT / 2));
  // central: con tubillones también en la versión de caja y espiga (el faldón solo tiene 20 mm)
  const mCentral: Mark[] = central
    ? (union === 'bolsillo' ? tornillos : espigas)([zFal + RT, zFalB].flatMap((z): Vec3[] => [[Lg / 2, yMid - dy, z], [Lg / 2, yMid + dy, z]]), 'z')
    : [];
  const mDivisor: Mark[] = divisor && !espiga
    ? fij([oz + s, zr].flatMap((z) => repartir(yFondo + TP + 40, ySeat - 40, 2).map((y): Vec3 => [Lg / 2, y, z])), 'z')
    : [];
  const mRastreles: Mark[] = arcon && union === 'bolsillo'
    ? tornillos([oz + s, zr].flatMap((z) => repartir(ox + s + 60, Lg - ox - s - 60, Math.max(2, Math.round(innerX / 250))).map((x): Vec3 => [x, PANEL_Y0 + 22, z])), 'z')
    : [];
  // asiento: sobre travesaños, faldones y central (nunca en la testa de la pata)
  const apoyos: Rect[] = arcon
    ? []
    : [
        ...[xRailL, xRailR].map((x) => ({ x0: x, x1: x + RT, z0: oz + s, z1: zr })),
        { x0: ox + s, x1: Lg - ox - s, z0: zFal, z1: zFal + RT },
        { x0: ox + s, x1: Lg - ox - s, z0: zFalB, z1: zFalB + RT },
        ...(central ? [{ x0: Lg / 2 - RT / 2, x1: Lg / 2 + RT / 2, z0: zFal + RT, z1: zFalB }] : []),
      ];
  const lamaMark = (pts: Vec3[]): Mark[] => (union === 'bolsillo' ? tornillos(pts, 'y') : espigas(pts, 'y'));
  const mAsiento = lamaMark(lamasR.flatMap((r) => apoyos.flatMap((a) => fijacionesLama(r, a, ySeat))));
  const apoyosTapa: Rect[] = xTapa.map((x) => ({ x0: x, x1: x + RT, z0: oz + s + 5, z1: oz + s + 5 + lTapa }));
  const mTapa = lamaMark(lamasR.flatMap((r) => apoyosTapa.flatMap((a) => fijacionesLama(r, a, ySeat))));
  const apoyosZap: Rect[] = [zFal, zFalB].map((z) => ({ x0: ox + s, x1: Lg - ox - s, z0: z, z1: z + RT }));
  const mZap = lamaMark(zapR.flatMap((r) => apoyosZap.flatMap((a) => fijacionesLama(r, a, HB))));
  const mBisagra: Mark[] = tornillos(
    xBis.flatMap((x): Vec3[] => [-15, 0, 15].flatMap((d): Vec3[] => [[x + d, ySeat - 15, zr + TP], [x + d, ySeat, zr + TP + 12]])),
    'z',
  ).map((m, i) => (i % 2 ? { ...m, axis: 'y' as const } : m));
  const mBrazoDel: Mark[] = brazos ? (union === 'bolsillo' ? tornillos : espigas)([ox + s / 2, Lg - ox - s / 2].flatMap((x): Vec3[] => [[x, hFront, s / 2 - 10], [x, hFront, s / 2 + 10]]), 'y') : [];
  const mBrazoTras: Mark[] = brazos ? (union === 'bolsillo' ? tornillos : espigas)([ox + s / 2, Lg - ox - s / 2].flatMap((x): Vec3[] => [[x - 10, hFront + RT / 2, zr], [x + 10, hFront + RT / 2, zr]]), 'z') : [];

  // ===================== textos =====================
  let colaPuesta = false;
  const colaOnce = (): HardwareLine[] => (colaPuesta ? [] : ((colaPuesta = true), [hw('Cola blanca para madera (PVA)', 1, 'bote')]));
  const lineasEstructura = (k: number): HardwareLine[] => {
    if (union === 'bolsillo') return k ? [hw('Tornillo para bolsillo de rosca gruesa, cabeza de arandela, 32 mm', k)] : [];
    if (union === 'tubillon') return [...(k ? [hw('Tubillón estriado de haya Ø8 × 40 mm', k)] : []), ...colaOnce()];
    return colaOnce();
  };
  const lineasLama = (k: number): HardwareLine[] =>
    k === 0 ? [] : union === 'bolsillo' ? [hw('Tornillo para madera de cabeza avellanada 4 × 50 mm', k)] : [hw('Tubillón estriado de haya Ø8 × 30 mm', k), ...colaOnce()];

  const tec = {
    bolsillo: {
      name: 'Tornillo en bolsillo (pocket hole)',
      why: 'El tornillo entra en diagonal desde la cara interior del travesaño y muerde en la pata: queda oculto, no hace falta escoplo y es la unión más indulgente para un primer mueble.',
      how: [
        `Ajusta la plantilla y el tope de la broca al grueso de la pieza (${RT} mm en los travesaños${arcon ? `, ${TP} mm en los paneles` : ''}).`,
        'Taladra los bolsillos en cada extremo, por la cara que quedará hacia dentro y no se verá.',
        'Sujeta la pieza con un sargento contra la pata, en su línea, y atornilla. Kreg recomienda rosca gruesa en maderas blandas como el pino.',
        'Para en cuanto la cabeza asiente en el fondo del bolsillo.',
      ],
    },
    tubillon: {
      name: 'Tubillones encolados',
      why: 'Dos tubillones por unión alinean las piezas y dan superficie de encolado en una junta a testa. No queda ningún tornillo a la vista.',
      how: [
        'Marca los centros en la testa del travesaño, midiendo siempre desde la misma cara, y taládralos a escuadra con tope de profundidad (20 mm).',
        'Transfiere los centros a la pata con marcadores de tubillón y taladra la pareja.',
        'Monta en seco. Después pon la cola dentro de los agujeros (no en el tubillón), cierra con sargentos y limpia la cola que rebose.',
      ],
    },
    espiga: {
      name: 'Caja y espiga',
      why: 'La espiga del travesaño entra en una caja tallada en la pata. Es el ensamble tradicional de bancos y sillas: mucha superficie de encolado y resistencia al descuadre sin un solo tornillo.',
      how: [
        `Marca la caja en la pata con gramil de dos púas y vacíala con formón. Profundidad: ${mm(ten)} más un poco para la cola.`,
        `Espiga de un tercio del grueso del travesaño (unos 7 mm), centrada, de ${mm(ten)} de largo: sierra las mejillas y los hombros y ajústala con formón hasta que entre a mano con presión firme.`,
        'Donde dos espigas llegan a la misma pata desde caras distintas, corta sus puntas a inglete para que no choquen dentro.',
        'Monta en seco, comprueba la escuadra y encola. Aprieta con sargentos hasta que cierren los hombros.',
      ],
    },
  }[union];
  const toolsUnion = {
    bolsillo: ['Plantilla de taladro para bolsillos con su broca escalonada', 'Atornillador con punta larga', 'Sargentos'],
    tubillon: ['Taladro', 'Broca para madera de 8 mm con tope de profundidad', 'Marcadores de tubillón de 8 mm', 'Sargentos'],
    espiga: ['Gramil de dos púas', 'Formones afilados (6, 10 y 20 mm)', 'Serrucho de costilla o sierra japonesa', 'Maza', 'Sargentos'],
  }[union];
  const tecLama = union === 'bolsillo'
    ? {
        name: 'Tornillo visto con taladro piloto y avellanado',
        why: 'Las lamas se atornillan desde arriba al canto de los travesaños. Con taladro de paso en la lama, piloto en el travesaño y avellanado, la cabeza queda enrasada y la lama no se raja.',
        how: [
          'Taladro de paso de 4 mm en la lama, para que el tornillo la atraviese sin agarrar en ella.',
          'Piloto de unos 2 mm en el travesaño: en madera blanda la USDA recomienda en torno al 70 % del núcleo del tornillo (unos 2/3 del diámetro).',
          'Avellana la entrada y atornilla sin pasarte de par.',
        ],
      }
    : {
        name: 'Tubillones verticales',
        why: 'Cada lama se sujeta con tubillones encolados en el canto de los apoyos: el asiento queda limpio, sin una sola cabeza de tornillo.',
        how: [
          'Taladra los apoyos desde arriba a 18 mm, en el centro de su canto.',
          'Pon marcadores de tubillón, presenta la lama con sus separadores y presiona para marcarla.',
          'Taladra la lama por debajo a 12 mm como máximo: tiene 20 mm y no debe atravesarse.',
          'Encola los agujeros y asienta la lama con una maza y un taco.',
        ],
      };

  // ===================== pasos =====================
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: 'Deja cada pieza a su medida y con su letra antes de montar nada.',
    detail: [
      'Repasa la lista de corte y marca cada pieza a lápiz con escuadra.',
      resp
        ? `Corta las patas delanteras a ${mm(hFront)} y las traseras a ${mm(hRear)}, cada pareja con un tope para que salgan idénticas.`
        : `Corta las cuatro patas a ${mm(hFront)} con un tope: lo importante es que midan exactamente lo mismo.`,
      `Corta las ${n} lamas${brazos ? ' (la delantera, más corta, va entre las patas)' : ''} y elige para el asiento la cara más limpia.`,
      ...(espiga ? ['Con caja y espiga, la lista de corte ya incluye la espiga de cada travesaño.'] : []),
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz', 'Sierra de mano, circular o ingletadora', 'Sargentos'],
    check: 'Pon las patas de cada pareja de pie sobre una superficie plana: ninguna debe sobresalir.',
    tip: 'Elige para las patas los listones más rectos y sin nudos grandes cerca de los extremos.',
  });

  b.step({
    kind: 'preparar',
    title: 'Traza y prepara las uniones',
    summary: 'Todas las posiciones se trazan antes de montar, con las piezas juntas.',
    detail: [
      `Junta las cuatro patas con sargentos y traza a la vez la posición de los travesaños: cara superior a ${mm(ySeat)} del suelo${balda ? `, travesaños del zapatero con su cara superior a ${mm(HB)}` : ''}${arcon ? `, paneles del arcón desde ${mm(PANEL_Y0)}` : ''}.`,
      ...(resp ? [`En las patas traseras traza los travesaños del respaldo a ${yRes.map((y) => mm(y)).join(', ')} (cara inferior).`] : []),
      arcon
        ? `Los paneles del arcón van a ras de la cara interior de las patas.${espiga ? ' Abre en las patas una ranura de 10 mm de hondo y del grueso del panel.' : ''}`
        : `Los travesaños van centrados en el grueso de la pata: a ${mm((s - RT) / 2)} de cada cara.`,
      union === 'bolsillo' ? 'Taladra ya todos los bolsillos en las caras interiores de travesaños y faldones.' : union === 'tubillon' ? 'Taladra ya los tubillones en las testas de travesaños y faldones, y transfiere los centros a las patas.' : 'Talla ya las cajas en las patas y las espigas en los travesaños, y prueba cada unión en seco.',
    ],
    parts: [],
    technique: tec,
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz afilado o cuchilla de marcar', ...toolsUnion],
    tip: 'Numera cada unión (1-1, 2-2…) en las dos piezas: así cada espiga o tubillón vuelve a su sitio.',
  });

  const hwCab = lineasEstructura(mCabL.length + mCabR.length);
  b.step({
    kind: 'montar',
    title: 'Monta los dos caballetes',
    summary: arcon ? 'Cada costado del arcón une una pata delantera con una trasera.' : 'Cada pareja de patas se une con su travesaño de asiento.',
    detail: [
      'Tumba una pata delantera y una trasera sobre el banco de trabajo, con la cara trazada hacia arriba.',
      arcon
        ? `Presenta el costado del arcón entre ellas, a ras de la cara interior de las patas y con el canto superior a ${mm(ySeat)} del suelo.`
        : `Presenta el travesaño entre ellas, a ras por arriba (a ${mm(ySeat)} del suelo).`,
      ...tec.how.slice(-2),
      'Repite con el otro caballete usando el primero como plantilla.',
    ],
    parts: [...patasL, ...patasR, ...travAs],
    marks: [...mCabL, ...mCabR],
    hardware: hwCab,
    tools: [...toolsUnion, 'Escuadra de carpintero'],
    check: 'Mide las diagonales de cada caballete: si coinciden, está a escuadra.',
    warning: union === 'bolsillo' ? undefined : 'No dejes secar la cola con el caballete torcido: comprueba la escuadra antes de soltar los sargentos.',
  });

  const largos = [...faldones, ...rastreles, ...bajos, ...respaldo];
  const mLargos = [...mFaldones, ...mBajos, ...mRespaldo];
  b.step({
    kind: 'montar',
    title: 'Une los caballetes',
    summary: `${arcon ? 'El frente y la trasera del arcón' : 'Los faldones'}${bajos.length ? ', los travesaños del zapatero' : ''}${respaldo.length ? ' y los travesaños del respaldo' : ''} cierran la estructura.`,
    detail: [
      'Pon los dos caballetes de pie, enfrentados, sobre una superficie plana.',
      ...(arcon
        ? [
            `Antes de presentarlos, ${union === 'bolsillo' ? 'encola y atornilla' : 'encola'} a cada panel su rastrel por la cara interior, a ras del canto inferior: ahí apoyará el fondo.`,
            `Presenta el frente y la trasera del arcón entre las patas, a ras de su cara interior.`,
          ]
        : [`Presenta los faldones entre las patas, a ras por arriba y centrados en el grueso.`]),
      ...(bajos.length ? [`Los travesaños del zapatero, con su cara superior a ${mm(HB)}.`] : []),
      ...(respaldo.length ? [`Los travesaños del respaldo entre las patas traseras, a ras de su cara delantera.`] : []),
      union === 'bolsillo' ? 'Sujeta cada pieza con sargentos y atornilla los bolsillos, alternando de un extremo a otro.' : 'Encola todas las uniones a la vez, cierra con sargentos largos y deja secar sin mover.',
      'Comprueba la escuadra en planta antes de apretar del todo.',
    ],
    parts: largos,
    marks: [...mLargos, ...mRastreles],
    hardware: [...lineasEstructura(mLargos.length), ...(mRastreles.length ? [hw('Tornillo para madera de cabeza avellanada 3,5 × 30 mm', mRastreles.length)] : [])],
    tools: [...toolsUnion, 'Sargentos largos', 'Una segunda persona'],
    check: 'Las diagonales de la estructura, medidas en planta de pata a pata, deben ser iguales.',
  });

  if (central) {
    b.step({
      kind: 'montar',
      title: 'Añade el travesaño central',
      summary: `Con ${mm(innerX)} entre patas, las lamas necesitan un apoyo más en el centro.`,
      detail: [
        'Marca el centro de los dos faldones.',
        'Encaja el travesaño entre ellos, a ras por arriba.',
        union === 'bolsillo' ? 'Fíjalo con dos tornillos en bolsillo por extremo.' : `Fíjalo con dos tubillones encolados por extremo${espiga ? ': el faldón solo tiene 20 mm y no admite una caja' : ''}.`,
      ],
      parts: [centralId],
      marks: mCentral,
      hardware: union === 'bolsillo' ? lineasEstructura(mCentral.length) : [hw('Tubillón estriado de haya Ø8 × 30 mm', mCentral.length), ...colaOnce()],
      tools: union === 'bolsillo' ? toolsUnion : ['Taladro', 'Broca para madera de 8 mm con tope de profundidad', 'Marcadores de tubillón de 8 mm', 'Sargentos'],
    });
  }

  if (arcon) {
    b.step({
      kind: 'montar',
      title: divisor ? 'Coloca el fondo y el separador' : 'Coloca el fondo del arcón',
      summary: divisor ? 'El fondo apoya en los rastreles y el separador sostiene la tapa en el centro.' : 'El fondo apoya en los rastreles, sin fijar: se puede sacar para limpiar.',
      detail: [
        `Mete el fondo en inclinado y bájalo hasta que apoye en los dos rastreles (${mm(innerX)} × ${mm(innerZ)}).`,
        'No lo encoles ni lo atornilles: así puede moverse con la humedad y se saca para limpiar.',
        ...(divisor
          ? [
              `Pon el separador de pie sobre el fondo, en el centro (a ${mm(Lg / 2)} de un extremo). Su canto superior queda a ras de los paneles y sostiene la tapa.`,
              espiga ? 'Encájalo en sus ranuras del frente y la trasera, encolado.' : union === 'bolsillo' ? 'Atornilla el separador por dentro con bolsillos al frente y a la trasera.' : 'Fíjalo con tubillones encolados al frente y a la trasera.',
            ]
          : []),
      ],
      parts: [fondo, ...(divId ? [divId] : [])],
      marks: mDivisor,
      hardware: mDivisor.length ? lineasEstructura(mDivisor.length) : [],
      tools: divisor ? toolsUnion : ['Manos y paciencia'],
      tip: 'Taladra un par de agujeros de ventilación en el fondo si vas a guardar calzado.',
    });

    b.step({
      kind: 'montar',
      title: 'Monta la tapa de lamas',
      summary: 'Las lamas se unen con dos travesaños por debajo y forman la tapa-asiento.',
      detail: [
        'Pon las lamas boca abajo sobre el banco de trabajo, con separadores de 10 mm entre ellas y a ras por los extremos.',
        `Presenta los travesaños de canto, a ${mm(10)} de la cara interior de los costados: así la tapa encaja dentro del hueco al cerrarla.`,
        union === 'bolsillo' ? 'Atornilla desde arriba, por la cara del asiento, con paso, piloto y avellanado.' : 'Fija las lamas con tubillones encolados en el canto de los travesaños.',
        'Coloca la tapa sobre el arcón y comprueba que cierra sin rozar.',
      ],
      parts: [...lamas, ...travTapa],
      marks: mTapa,
      technique: tecLama,
      hardware: lineasLama(mTapa.length),
      tools: union === 'bolsillo' ? ['Taladro atornillador', 'Broca de 4 mm y de 2 mm', 'Broca de avellanar', 'Separadores de 10 mm'] : ['Taladro', 'Broca de 8 mm con tope', 'Marcadores de tubillón de 8 mm', 'Maza', 'Separadores de 10 mm'],
    });

    b.step({
      kind: 'montar',
      title: 'Pon las bisagras y el compás',
      summary: 'Las bisagras unen la tapa a la trasera del arcón y el compás la sujeta abierta.',
      detail: [
        `Atornilla un ala de cada bisagra en la cara trasera del panel trasero, con el nudillo a ras de su arista superior (${xBis.length} bisagras).`,
        'Cierra la tapa centrada y atornilla la otra ala bajo las lamas.',
        'Monta el compás de tapa con retención en un costado, siguiendo su plantilla: impide que la tapa caiga de golpe.',
        'Abre y cierra varias veces y ajusta antes de apretar del todo.',
      ],
      parts: bisagras,
      marks: mBisagra,
      hardware: [hw('Tornillo para madera de cabeza plana 3 × 12 mm', mBisagra.length), hw('Compás de tapa con retención (freno), con sus tornillos', 1)],
      tools: ['Atornillador', 'Broca de 2 mm', 'Punzón'],
      warning: 'Sin compás la tapa puede caer de golpe y pillar los dedos, sobre todo los de un niño. No lo omitas.',
    });
  } else {
    b.step({
      kind: 'montar',
      title: 'Coloca las lamas del asiento',
      summary: `${n} lamas de ${w} mm con ${mm(G)} de separación.`,
      detail: [
        `Empieza por la lama delantera, ${resp ? 'a ras del frente de las patas' : `con ${mm(oz)} de vuelo por delante`}${brazos ? ': va entre las dos patas delanteras, apoyada en el faldón' : ` y ${mm(ox)} por cada extremo`}.`,
        `Coloca las demás con separadores de ${mm(G)} entre lama y lama.`,
        ...tecLama.how.slice(0, 2),
        'Fija primero un extremo de cada lama, comprueba la separación en el otro y fíjalo.',
      ],
      parts: lamas,
      marks: mAsiento,
      technique: tecLama,
      hardware: lineasLama(mAsiento.length),
      tools: union === 'bolsillo' ? ['Taladro atornillador', 'Broca de 4 mm y de 2 mm', 'Broca de avellanar', 'Separadores de 10 mm'] : ['Taladro', 'Broca de 8 mm con tope', 'Marcadores de tubillón de 8 mm', 'Maza', 'Separadores de 10 mm'],
      tip: 'Las separaciones dejan escurrir el agua en un banco de exterior y permiten que la madera se mueva.',
    });
  }

  if (balda) {
    b.step({
      kind: 'montar',
      title: 'Coloca el zapatero',
      summary: `${nZ} listones de fondo sobre los travesaños bajos.`,
      detail: [
        `Reparte los listones entre las patas con ${mm(gapZ)} de separación.`,
        'Apóyalos sobre los dos travesaños bajos, a ras de su cara exterior.',
        union === 'bolsillo' ? 'Atornilla cada extremo con dos tornillos, con paso, piloto y avellanado.' : 'Fija cada extremo con dos tubillones encolados.',
      ],
      parts: zap,
      marks: mZap,
      hardware: lineasLama(mZap.length),
      tools: union === 'bolsillo' ? ['Taladro atornillador', 'Broca de 4 mm y de 2 mm', 'Broca de avellanar'] : ['Taladro', 'Broca de 8 mm con tope', 'Marcadores de tubillón de 8 mm', 'Maza'],
      tip: 'Corta un taco con el ancho de la separación y úsalo de galga entre listón y listón.',
    });
  }

  if (brazos) {
    b.step({
      kind: 'montar',
      title: 'Coloca los reposabrazos',
      summary: `Apoyan en la pata delantera, a ${mm(ARM)} sobre el asiento, y llegan hasta la pata trasera.`,
      detail: [
        'Apoya cada reposabrazos sobre la testa de la pata delantera, a ras por fuera y por delante.',
        'Su extremo trasero topa con la cara delantera de la pata trasera.',
        union === 'bolsillo'
          ? 'Delante, dos tornillos vistos avellanados en la testa de la pata. Detrás, dos tornillos en bolsillo desde la cara inferior del reposabrazos a la pata trasera.'
          : 'Delante, dos tubillones encolados en la testa de la pata; detrás, dos en la cara de la pata trasera.',
        'Redondea las aristas del reposabrazos: es donde más se apoyan las manos.',
      ],
      parts: brazosIds,
      marks: [...mBrazoDel, ...mBrazoTras],
      hardware: union === 'bolsillo'
        ? [hw('Tornillo para madera de cabeza avellanada 4 × 50 mm', mBrazoDel.length), hw('Tornillo para bolsillo de rosca gruesa, cabeza de arandela, 32 mm', mBrazoTras.length)]
        : [hw('Tubillón estriado de haya Ø8 × 30 mm', mBrazoDel.length + mBrazoTras.length), ...colaOnce()],
      tools: union === 'bolsillo' ? ['Taladro atornillador', 'Plantilla de taladro para bolsillos', 'Broca de avellanar'] : ['Taladro', 'Broca de 8 mm con tope', 'Marcadores de tubillón de 8 mm'],
    });
  }

  b.step({
    kind: 'acabar',
    title: 'Lija y protege la madera',
    summary: 'Un buen lijado y dos o tres manos de acabado son lo que separa un mueble casero de uno bien hecho.',
    detail: [
      'Mata todas las aristas con un taco de lija, sobre todo las del asiento: una arista viva se astilla y se nota al sentarse.',
      'Lija siempre a favor de la veta, pasando por granos cada vez más finos.',
      'Aspira el polvo y pasa un paño ligeramente húmedo antes de la primera mano.',
      resp
        ? 'Si el banco va a estar fuera, usa un acabado para exterior y repásalo cada temporada. La cola blanca normal no sirve a la intemperie: usa una apta para exterior.'
        : 'Aplica el acabado elegido (aceite, cera o barniz al agua) siguiendo los tiempos del fabricante y lija suave entre manos.',
    ],
    parts: [],
    hardware: [hw('Lija de grano 80, 120 y 180', 2, 'pliegos de cada'), hw(resp ? 'Aceite o lasur para madera de exterior' : 'Aceite, cera o barniz al agua para muebles', 1, 'bote')],
    tools: ['Taco de lija o lijadora orbital', 'Brocha o paño de algodón', 'Mascarilla antipolvo'],
    tip: 'Prueba el acabado en un recorte de la misma madera antes de aplicarlo al banco.',
  });

  // reflejo en Z: frente en z = Dtot
  for (const p of b.parts) p.pos[2] = Dtot - p.pos[2];
  for (const st of b.steps) for (const m of st.marks ?? []) {
    m.at = [m.at[0], m.at[1], Dtot - m.at[2]];
    if (m.to) m.to = [m.to[0], m.to[1], Dtot - m.to[2]];
  }

  const Htot = Math.max(Hs, hRear, brazos ? hFront + RT : 0);
  const formaTxt = resp ? `con respaldo${brazos ? ' y reposabrazos' : ''}` : arcon ? 'con arcón' : balda ? 'zapatero' : 'simple';
  return b.finish({
    id: 'banco',
    title: 'Banco',
    craft: 'carpinteria',
    summary: `Banco ${formaTxt} de ${Math.round(Lg / 10)} cm de largo y asiento a ${Math.round(Hs / 10)} cm.`,
    difficulty: union === 'espiga' ? 3 : union === 'tubillon' || resp || arcon ? 2 : 1,
    hours: Math.round((union === 'espiga' ? 12 : union === 'tubillon' ? 8 : 5) + (resp ? 2 : 0) + (brazos ? 1 : 0) + (arcon ? 3 : 0) + (balda ? 1.5 : 0)),
    dims: [Lg, Htot, Dtot],
    safety: [
      'Gafas de protección siempre que cortes, taladres o lijes; mascarilla al lijar.',
      'Sujeta la pieza con sargentos: nunca con la mano cerca de la línea de corte, de la broca o del formón.',
      'Con el formón, corta siempre alejando la herramienta del cuerpo y con la otra mano detrás del filo.',
      ...(arcon ? ['La tapa del arcón debe llevar compás con retención para que no caiga sobre los dedos.'] : []),
      'Desenchufa la herramienta o quita la batería antes de cambiar la broca o la hoja.',
    ],
    notes: [
      'Las medidas de la lista de corte son finales. Compra el listón ya cepillado.',
      `Fondo del asiento: ${n} lamas de ${w} mm con ${G} mm entre ellas = ${mm(Dz)}.`,
      'La altura de asiento de un banco no tiene una cifra verificada en nuestras fuentes. Como referencia, una guía de prevención de la Universidad de Almería da 42–53 cm para sillas de trabajo; pruébala sentándote en una silla que te resulte cómoda.',
      'No damos carga máxima: depende de la madera, de las uniones y del montaje.',
      ...(central ? [`Con más de ${mm(900)} entre patas se añade un travesaño central bajo las lamas.`] : []),
      ...(divisor ? [`Con más de ${mm(900)} entre patas, el arcón lleva un separador central que sostiene la tapa.`] : []),
      ...(arcon ? [`Hueco útil del arcón: ${mm(innerX)} × ${mm(innerZ)} y ${mm(ySeat - yFondo - TP - 45)} libres bajo los travesaños de la tapa.`] : []),
      ...(resp ? ['El respaldo es recto, como el de un banco de cocina. Inclinarlo exige cortar las patas traseras en ángulo, algo que este generador no hace.'] : []),
      `Los reposabrazos y la altura del respaldo son decisiones de diseño, no medidas normalizadas.`,
    ].filter((t) => brazos || !t.startsWith('Los reposabrazos')),
    sources: [
      { label: 'Universidad de Almería: espacio de trabajo (altura de asiento de silla de trabajo)', url: 'https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf' },
      { label: 'USDA Wood Handbook, cap. 8 «Fastenings» (taladro guía)', url: 'https://research.fs.usda.gov/download/treesearch/37424.pdf' },
      ...(union === 'bolsillo' ? [{ label: 'Kreg: How To Use a Kreg Pocket Hole Jig', url: 'https://learn.kregtool.com/learn/how-to-use-kreg-pocket-hole-jig/' }, { label: 'Popular Woodworking: Pilot Holes, Clearance Holes & Countersinks', url: 'https://www.popularwoodworking.com/editors-blog/pilot-holes-clearance-holes-countersinks/' }] : []),
      ...(union !== 'bolsillo' ? [{ label: 'Fine Woodworking: Make Strong, Simple Joints with Dowels', url: 'https://www.finewoodworking.com/2011/09/29/make-strong-simple-joints-with-dowels' }] : []),
      ...(union === 'espiga' ? [{ label: 'Fine Woodworking: How to Cut a Mortise and Tenon by Hand', url: 'https://www.finewoodworking.com/project-guides/joinery/cut-mortise-tenon-hand' }] : []),
      ...(arcon ? [{ label: 'IKEA PERJOHAN, banco con almacenaje (referencia de forma)', url: 'https://www.ikea.com/es/es/p/perjohan-banco-con-almacenaje-pino-60485339/' }] : []),
    ],
    spec: [
      { label: 'Medidas', value: `${Lg} × ${Dtot} mm, asiento a ${Hs} mm` },
      { label: 'Forma', value: resp ? `Con respaldo de ${hR} mm (${nRes} travesaños)` : 'Simple' },
      { label: 'Pata', value: `${s} × ${s} mm` },
      { label: 'Asiento', value: `${n} lamas de ${w} × ${TL} mm${arcon ? ' (tapa abatible)' : ''}` },
      ...(resp ? [{ label: 'Reposabrazos', value: brazos ? 'Sí' : 'No' }] : []),
      { label: 'Arcón', value: arcon ? `Sí, ${xBis.length} bisagras${divisor ? ' y separador central' : ''}` : 'No' },
      { label: 'Zapatero', value: balda ? `Sí, ${nZ} listones` : 'No' },
      { label: 'Unión', value: tec.name },
    ],
  });
}
