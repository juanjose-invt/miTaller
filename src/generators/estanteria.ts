import type { Generator, HardwareLine, Mark, ParamValues, Step, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, repartir, tornillos } from '../core/builder';

/**
 * ESTANTERÍA DE PINO.
 * Dos formas:
 *  - «escalera»: dos escaleras de listón (montantes 45×45 + travesaños 45×45 atornillados por dentro)
 *    y baldas de tablero apoyadas sobre los travesaños, al estilo IVAR.
 *  - «costados»: cajón clásico de dos costados de tablero con las baldas entre ellos.
 * Detalles: trasera de contrachapado, cruz de arriostrado (escalera), zócalo (costados),
 * tapa superior con vuelo y escuadras antivuelco a la pared.
 */

const T = 18; // grueso del tablero de pino (costados, baldas, tapa, zócalo)
const P = 45; // sección de montante y travesaño (45 × 45)
const TB = 6; // grueso de la trasera de contrachapado
const CR = 20; // grueso de los listones de la cruz (45 × 20)
const ZOC = 100; // alto del zócalo
const BASE = 70; // cara inferior de la balda de abajo sin zócalo
const RANURA = 6; // profundidad de la ranura en el costado (1/3 de 18 mm)
const PASO_MIN = 180; // separación mínima entre baldas (de cara inferior a cara inferior)
const LUZ_FORO = 813; // 32 in (conv. propia), opinión de foro citada en la referencia

type Forma = 'escalera' | 'costados';
type Union = 'tornillo' | 'tubillon' | 'ranura';

/** Taladro piloto para madera blanda: ~70 % del núcleo (núcleo ≈ 2/3 del diámetro). Regla USDA. */
const piloto = (d: number) => Math.round(d * (2 / 3) * 0.7 * 2) / 2;
const fmtD = (d: number) => String(d).replace('.', ',');

/** Asigna letras A, B, C… en orden de aparición. */
function letras() {
  const m = new Map<string, string>();
  return (k: string) => {
    if (!m.has(k)) m.set(k, String.fromCharCode(65 + m.size));
    return m.get(k)!;
  };
}

export const estanteria: Generator = {
  id: 'estanteria',
  title: 'Estantería',
  craft: 'carpinteria',
  difficulty: 1,
  description:
    'Estantería de pino de montantes tipo escalera (estilo IVAR) o de costados de tablero. Con trasera, cruz, zócalo, tapa con vuelo y anclaje a la pared.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 400, max: 1000, step: 10, unit: 'mm', default: 800, group: 'Medidas', help: 'Medida exterior total, tapa incluida.' },
    { key: 'alto', label: 'Alto', type: 'number', min: 600, max: 2200, step: 10, unit: 'mm', default: 1800, group: 'Medidas' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 200, max: 500, step: 10, unit: 'mm', default: 300, group: 'Medidas', help: 'Incluye la trasera o la cruz.' },
    { key: 'baldas', label: 'Número de baldas', type: 'number', min: 2, max: 8, step: 1, unit: 'ud', default: 5, group: 'Medidas', help: 'Cuenta la de abajo y la de arriba (o la tapa). Si no caben, se reducen.' },
    {
      key: 'forma', label: 'Forma', type: 'select', default: 'costados', group: 'Forma',
      options: [
        { value: 'costados', label: 'Costados de tablero', hint: 'Cajón clásico de librería' },
        { value: 'escalera', label: 'Montantes tipo escalera', hint: 'Listón 45 × 45, estilo trastero' },
      ],
    },
    { key: 'trasera', label: 'Trasera de contrachapado', type: 'boolean', default: true, group: 'Detalles', help: 'Cierra el fondo y, sobre todo, impide que el mueble se descuadre.' },
    {
      key: 'cruz', label: 'Cruz de arriostrado', type: 'boolean', default: true, group: 'Detalles', help: 'Dos listones en aspa por detrás, en lugar de trasera.',
      visible: (v) => v.forma === 'escalera' && v.trasera !== true,
    },
    {
      key: 'zocalo', label: 'Zócalo', type: 'boolean', default: false, group: 'Detalles', help: `Frente de ${ZOC} mm bajo la balda inferior.`,
      visible: (v) => v.forma !== 'escalera',
    },
    { key: 'vuelo', label: 'Tapa superior con vuelo', type: 'boolean', default: false, group: 'Detalles', help: 'Tablero encima del mueble que sobresale por los lados y por delante.' },
    {
      key: 'vueloMm', label: 'Vuelo de la tapa', type: 'number', min: 10, max: 40, step: 5, unit: 'mm', default: 20, group: 'Detalles',
      visible: (v) => v.vuelo === true,
    },
    { key: 'antivuelco', label: 'Escuadras antivuelco', type: 'boolean', default: true, group: 'Detalles', help: 'Dos escuadras para atornillar el mueble a la pared.' },
    {
      key: 'unionEsc', label: 'Unión de los travesaños', type: 'select', default: 'tornillo', group: 'Uniones',
      visible: (v) => v.forma === 'escalera',
      options: [
        { value: 'tornillo', label: 'Tornillo visto avellanado', hint: 'Taladro piloto y avellanado' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos en la estructura' },
      ],
    },
    {
      key: 'unionCos', label: 'Unión de las baldas', type: 'select', default: 'tornillo', group: 'Uniones',
      visible: (v) => v.forma !== 'escalera',
      options: [
        { value: 'tornillo', label: 'Tornillo visto avellanado', hint: 'Desde fuera del costado' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos a la vista' },
        { value: 'ranura', label: 'Ranura en el costado', hint: 'La balda entra en una ranura encolada' },
      ],
    },
  ],
  presets: [
    {
      id: 'libreria', name: 'Librería alta', blurb: '80 × 180 cm de costados, con trasera, zócalo y tapa con vuelo.',
      values: { ancho: 800, alto: 1800, fondo: 300, baldas: 6, forma: 'costados', trasera: true, zocalo: true, vuelo: true, vueloMm: 20, antivuelco: true, unionCos: 'ranura' },
    },
    {
      id: 'baja', name: 'Estantería baja', blurb: 'Un metro de ancho y 80 cm de alto: aparador o mueble bajo ventana.',
      values: { ancho: 1000, alto: 800, fondo: 300, baldas: 3, forma: 'costados', trasera: true, zocalo: false, vuelo: true, vueloMm: 30, antivuelco: true, unionCos: 'tubillon' },
    },
    {
      id: 'trastero', name: 'Estantería de trastero', blurb: 'Escaleras de listón, 50 cm de fondo y cruz por detrás, como una IVAR.',
      values: { ancho: 900, alto: 1790, fondo: 500, baldas: 5, forma: 'escalera', trasera: false, cruz: true, vuelo: false, antivuelco: true, unionEsc: 'tornillo' },
    },
  ],
  build,
};

function build(v: ParamValues) {
  const W = Number(v.ancho), H = Number(v.alto), D = Number(v.fondo);
  const forma = (v.forma === 'escalera' ? 'escalera' : 'costados') as Forma;
  const esc = forma === 'escalera';
  const union: Union = esc ? (v.unionEsc === 'tubillon' ? 'tubillon' : 'tornillo') : ((v.unionCos as Union) ?? 'tornillo');
  const trasera = v.trasera === true;
  const cruz = esc && !trasera && v.cruz === true;
  const zocalo = !esc && v.zocalo === true;
  const vuelo = v.vuelo === true;
  const vu = vuelo ? Number(v.vueloMm) : 0;
  const anti = v.antivuelco === true;

  const L = letras();
  const b = new Builder();

  // --- cotas generales ---
  const x0 = vu, x1 = W - vu; // caras exteriores de la estructura
  const zf = vu; // frente de la estructura
  const zb = D - (trasera ? TB : cruz ? CR : 0); // cara trasera de la estructura
  const prof = zb - zf; // fondo de montantes / costados / baldas
  const Hs = vuelo ? H - T : H; // alto de montantes o costados
  const base = zocalo ? ZOC : BASE;
  const yTop = vuelo ? Hs : H - T; // cara inferior del nivel más alto (tapa o balda superior)
  const nPedidas = Math.round(Number(v.baldas));
  const nMax = Math.max(2, Math.floor((yTop - base) / PASO_MIN) + 1);
  const n = Math.min(nPedidas, nMax);
  const niveles = repartir(base, yTop, n); // cara inferior de cada nivel
  const nivelesBalda = vuelo ? niveles.slice(0, -1) : niveles; // los que son balda (no tapa)
  const paso = (yTop - base) / (n - 1);
  const ancho = x1 - x0; // ancho de la estructura
  const luz = esc ? ancho - 2 * P : ancho - 2 * T; // largo de balda entre apoyos
  const nz = prof >= 300 ? 3 : 2;
  const zs = (m: number, k: number) => repartir(zf + m, zb - m, k);

  const tornilloEsc = 5; // travesaño → montante
  const dTor = esc ? 4 : 3.5;

  // ===================== piezas =====================
  const mL: string[] = [], mR: string[] = [], tL: string[] = [], tR: string[] = [];
  let costL = '', costR = '', zoc = '';
  const baldas: string[] = [];
  if (esc) {
    for (const [arr, tarr, x, side] of [[mL, tL, x0, 'izq'], [mR, tR, x1 - P, 'der']] as const) {
      arr.push(b.liston({ ref: L('montante'), name: 'Montante', section: [P, P], length: Hs, axis: 'y', at: [x, 0, zf] }));
      arr.push(b.liston({ ref: L('montante'), name: 'Montante', section: [P, P], length: Hs, axis: 'y', at: [x, 0, zb - P] }));
      const xt = side === 'izq' ? x0 + P : x1 - 2 * P;
      for (const y of niveles) tarr.push(b.liston({ ref: L('travesano'), name: 'Travesaño', section: [P, P], length: prof, axis: 'z', at: [xt, y - P, zf] }));
    }
    for (const y of nivelesBalda) baldas.push(b.panel({ ref: L('balda'), name: 'Balda', thickness: T, face: [luz, prof], normal: 'y', at: [x0 + P, y, zf] }));
  } else {
    costL = b.panel({ ref: L('costado'), name: 'Costado', thickness: T, face: [Hs, prof], normal: 'x', at: [x0, 0, zf], grain: 'y' });
    for (const y of nivelesBalda) baldas.push(b.panel({ ref: L('balda'), name: 'Balda', thickness: T, face: [luz, prof], normal: 'y', at: [x0 + T, y, zf] }));
    if (zocalo) zoc = b.panel({ ref: L('zocalo'), name: 'Zócalo', thickness: T, face: [luz, ZOC], normal: 'z', at: [x0 + T, 0, zf], grain: 'x' });
    costR = b.panel({ ref: L('costado'), name: 'Costado', thickness: T, face: [Hs, prof], normal: 'x', at: [x1 - T, 0, zf], grain: 'y' });
  }
  // En la unión de ranura la balda es 2 × 6 mm más larga: corrige la medida de corte.
  if (!esc && union === 'ranura') {
    for (const id of baldas) {
      const p = b.parts.find((q) => q.id === id)!;
      p.cut = [luz + 2 * RANURA, prof, T].sort((a, c) => c - a) as Vec3;
      p.note = `Incluye ${RANURA} mm por cada extremo que entran en la ranura del costado.`;
    }
  }
  const tapa = vuelo ? b.panel({ ref: L('tapa'), name: 'Tapa superior', thickness: T, face: [W, D], normal: 'y', at: [0, Hs, 0], grain: 'x' }) : '';
  const tras = trasera ? b.panel({ ref: L('trasera'), name: 'Trasera', material: 'contrachapado', thickness: TB, face: [ancho, Hs], normal: 'z', at: [x0, 0, zb] }) : '';

  // cruz: dos listones en aspa por detrás de los montantes traseros, a media madera en el cruce
  const cxL = x0 + P / 2, cxR = x1 - P / 2, dx = cxR - cxL;
  const yHi = Hs - 60;
  const hCruz = Math.min(yHi - 120, 1.2 * dx);
  const yLo = yHi - hCruz;
  const ang = Math.atan2(hCruz, dx);
  const lDiag = Math.hypot(dx, hCruz);
  const lCorte = Math.ceil((lDiag + P) / 10) * 10;
  const cruzIds: string[] = [];
  if (cruz) {
    for (const s of [1, -1]) {
      const id = b.liston({
        ref: L('cruz'), name: 'Listón de la cruz', section: [P, CR], length: lCorte, axis: 'x',
        at: [(cxL + cxR) / 2 - lCorte / 2, (yLo + yHi) / 2 - P / 2, zb],
        note: 'Se corta largo y se recortan los extremos a ras del montante al presentarlo.',
      });
      b.rotate(id, [0, 0, s * ang]);
      cruzIds.push(id);
    }
  }

  // escuadras antivuelco bajo el nivel superior, pegadas a la cara trasera
  const ES = 40;
  const zEsc = zb - ES;
  const xEsc = esc ? [x0 + 2 * P + 10, x1 - 2 * P - 10 - ES] : [x0 + T, x1 - T - ES];
  const escuadras = anti
    ? xEsc.map((x) => b.herraje({ ref: L('escuadra'), name: 'Escuadra antivuelco', size: [ES, ES, ES], at: [x, yTop - ES, zEsc], stock: 'Escuadra de acero de 40 × 40 mm con agujeros' }))
    : [];

  // ===================== marcas =====================
  const fij = (pts: Vec3[], axis: 'x' | 'y' | 'z'): Mark[] => (union === 'tornillo' ? tornillos(pts, axis) : espigas(pts, axis));
  // travesaño → montante: dos fijaciones en diagonal por extremo, en la cara de contacto
  const marcasEscalera = (xInt: number): Mark[] =>
    niveles.flatMap((y) => [zf + P / 2, zb - P / 2].flatMap((zc): Vec3[] => [[xInt, y - P / 2 - 10, zc - 10], [xInt, y - P / 2 + 10, zc + 10]]))
      .map((at) => ({ type: union === 'tornillo' ? 'tornillo' : 'espiga', at, axis: 'x' }) as Mark);
  const marksEscL = esc ? marcasEscalera(x0 + P) : [];
  const marksEscR = esc ? marcasEscalera(x1 - P) : [];
  // balda → travesaño (escalera)
  const zBalda = prof >= 260 ? [zf + 60, zb - 60] : [zf + prof * 0.25, zb - prof * 0.25];
  const marcasBalda = (y: number): Mark[] => fij([x0 + 1.5 * P, x1 - 1.5 * P].flatMap((x) => zBalda.map((z): Vec3 => [x, y, z])), 'y');
  // costado → balda (costados)
  const marcasCostado = (xInt: number): Mark[] =>
    union === 'ranura' ? [] : fij(nivelesBalda.flatMap((y) => zs(35, nz).map((z): Vec3 => [xInt, y + T / 2, z])), 'x');
  const marcasZocalo = (xInt: number): Mark[] => (zocalo ? (union === 'tornillo' ? tornillos : espigas)([[xInt, 30, zf + T / 2], [xInt, ZOC - 30, zf + T / 2]], 'x') : []);
  const marksCosL = esc ? [] : [...marcasCostado(x0 + T), ...marcasZocalo(x0 + T)];
  const marksCosR = esc ? [] : [...marcasCostado(x1 - T), ...marcasZocalo(x1 - T)];
  // tapa con vuelo
  const marksTapa: Mark[] = vuelo
    ? (union === 'tornillo' ? tornillos : espigas)(
        (esc ? [x0 + 1.5 * P, x1 - 1.5 * P] : [x0 + T / 2, x1 - T / 2]).flatMap((x) => zs(40, 3).map((z): Vec3 => [x, Hs, z])),
        'y',
      )
    : [];
  // trasera
  const xsBorde = esc ? [x0 + P / 2, x1 - P / 2] : [x0 + T / 2, x1 - T / 2];
  const nV = Math.max(3, Math.round(Hs / 300) + 1);
  const ptsTrasBorde: Vec3[] = xsBorde.flatMap((x) => repartir(40, Hs - 40, nV).map((y): Vec3 => [x, y, zb]));
  const nH = Math.max(1, Math.round(luz / 280));
  const xsInt = Array.from({ length: nH }, (_, i) => xsBorde[0] + ((xsBorde[1] - xsBorde[0]) * (i + 1)) / (nH + 1));
  const ptsTrasBaldas: Vec3[] = nivelesBalda.flatMap((y) => xsInt.map((x): Vec3 => [x, y + T / 2, zb]));
  const marksTrasera = trasera ? tornillos([...ptsTrasBorde, ...ptsTrasBaldas], 'z') : [];
  // cruz: dos fijaciones por extremo, sobre el eje de la diagonal y dentro del montante
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const extremos: [number, number, number, number][] = [
    [cxL, yLo, ux, uy], [cxR, yHi, -ux, -uy], // diagonal 1 (abajo izq. → arriba der.)
    [cxL, yHi, ux, -uy], [cxR, yLo, -ux, uy], // diagonal 2 (arriba izq. → abajo der.)
  ];
  const marksCruz: Mark[] = cruz
    ? (union === 'tornillo' ? tornillos : espigas)(
        extremos.flatMap(([x, y, ix, iy]): Vec3[] => [[x - ix * 9, y - iy * 9, zb], [x + ix * 9, y + iy * 9, zb]]),
        'z',
      )
    : [];
  // escuadras
  const marksEscWood: Mark[] = anti ? tornillos(xEsc.flatMap((x): Vec3[] => [[x + 12, yTop, zEsc + 20], [x + 28, yTop, zEsc + 20]]), 'y') : [];
  const marksEscPared: Mark[] = anti ? tornillos(xEsc.map((x): Vec3 => [x + ES / 2, yTop - ES / 2, D]), 'z') : [];

  // ===================== textos =====================
  const pilot5 = piloto(tornilloEsc), pilotT = piloto(dTor), pilot3 = piloto(3);
  const tecTornillo = {
    name: 'Tornillo visto con taladro piloto y avellanado',
    why: esc
      ? 'El travesaño se atornilla de cara contra la cara del montante: madera contra madera a lo largo de la veta, con tornillos que se ven pero quedan enrasados. Es la unión más rápida, se puede desmontar y no necesita más herramienta que un taladro.'
      : 'El tornillo atraviesa el costado y muerde en la testa de la balda. Es la forma más directa de montar un cajón: no hace falta cola ni plantilla, y las cabezas quedan enrasadas gracias al avellanado.',
    how: [
      `Taladra primero la pieza que se atornilla con una broca de paso del diámetro del tornillo (${fmtD(esc ? tornilloEsc : dTor)} mm), para que la rosca solo agarre en la otra pieza.`,
      `En la pieza que recibe la punta haz un taladro piloto de unos ${fmtD(esc ? pilot5 : pilotT)} mm: en madera blanda la USDA recomienda en torno al 70 % del diámetro del núcleo del tornillo, que a su vez es unos 2/3 del diámetro.`,
      'Avellana la entrada con la broca de avellanar hasta que la cabeza quede enrasada, sin pasarte.',
      'Atornilla sin forzar: para en cuanto la cabeza asiente en el avellanado.',
    ],
  };
  const tecTubillon = {
    name: 'Tubillones encolados',
    why: esc
      ? 'Los tubillones alinean el travesaño con el montante y la cola une dos caras a hilo, que es como mejor pega. No queda ni un tornillo a la vista en las escaleras.'
      : 'Los tubillones alinean balda y costado y dan superficie de encolado. Por fuera el costado queda limpio, sin ninguna cabeza de tornillo.',
    how: [
      esc
        ? 'Marca los centros en el travesaño y taládralo con tope de profundidad a 20 mm, perfectamente perpendicular a la cara.'
        : 'Marca los centros en la testa de la balda, siempre midiendo desde el mismo canto (el delantero), y taládralos a 18 mm de profundidad.',
      'Pon marcadores de tubillón en los agujeros, presenta la pieza en su línea y aprieta: así quedan marcados los centros en la otra pieza.',
      esc ? 'Taladra el montante a 20 mm de profundidad.' : `Taladra el costado a 12 mm como máximo: con ${T} mm de grueso, más hondo lo atravesarías. Usa tope de profundidad.`,
      'Monta en seco. Luego pon la cola dentro de los agujeros (no sobre el tubillón), cierra con sargentos y limpia la cola que rebose con un paño húmedo.',
    ],
  };
  const tecRanura = {
    name: 'Ranura (galce) en el costado',
    why: 'Cada balda entra en una ranura abierta en la cara interior del costado. La ranura sostiene la balda en todo su fondo, la deja a escuadra sola al montar y no necesita ningún tornillo ni tubillón: solo cola.',
    how: [
      `Traza las ranuras en los dos costados a la vez, juntándolos con sargentos, para que salgan a la misma altura.`,
      `Ancho de la ranura: el grueso real de tu balda (mídelo, unos ${T} mm). Profundidad: ${RANURA} mm, un tercio del costado.`,
      'Ábrela con fresadora y regla guía, o con varias pasadas de sierra circular a la profundidad justa y limpiando el fondo con formón.',
      'Prueba primero en un recorte: la balda debe entrar a mano con un ajuste firme, sin tener que golpearla.',
    ],
  };
  const tec = union === 'tornillo' ? tecTornillo : union === 'tubillon' ? tecTubillon : tecRanura;
  let colaPuesta = false;
  /** La cola se compra una vez: solo la primera línea que la pide la añade a la lista. */
  const colaOnce = (): HardwareLine[] => (colaPuesta ? [] : ((colaPuesta = true), [hw('Cola blanca para madera (PVA)', 1, 'bote')]));
  const toolsUnion = union === 'tornillo'
    ? ['Taladro atornillador', `Broca para madera de ${fmtD(esc ? tornilloEsc : dTor)} mm (paso) y de ${fmtD(esc ? pilot5 : pilotT)} mm (piloto)`, 'Broca de avellanar']
    : union === 'tubillon'
      ? ['Taladro', 'Broca para madera de 8 mm con tope de profundidad', 'Marcadores de tubillón de 8 mm', 'Sargentos']
      : ['Fresadora con fresa recta de 18 mm o sierra circular', 'Regla guía y sargentos', 'Formón de 20 mm'];
  const lineasUnion = (k: number, tipo: 'travesano' | 'costado' | 'zocalo' | 'tapa' | 'balda'): HardwareLine[] => {
    if (k === 0) return [];
    if (union === 'tornillo') {
      if (tipo === 'travesano') return [hw(`Tornillo para madera de cabeza avellanada ${tornilloEsc} × 80 mm, rosca parcial`, k)];
      if (tipo === 'balda' || (tipo === 'tapa' && esc)) return [hw('Tornillo para madera de cabeza avellanada 4 × 50 mm', k)];
      return [hw('Tornillo para madera de cabeza avellanada 3,5 × 45 mm', k)];
    }
    const tub = tipo === 'travesano' ? 'Tubillón estriado de haya Ø8 × 40 mm' : 'Tubillón estriado de haya Ø8 × 30 mm';
    return [hw(tub, k), ...colaOnce()];
  };

  // costado: todas las marcas del costado (baldas + zócalo) usan la misma fijación de 18 mm
  const lineasCostado = (k: number, ranura: boolean): HardwareLine[] =>
    [...lineasUnion(k, 'costado'), ...(ranura ? colaOnce() : [])];

  const pared = 'Taco y tornillo adecuados a tu pared (ladrillo, hormigón o pladur): pregúntalo en la tienda llevando el dato de la pared';

  // ===================== pasos =====================
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: 'Deja cada pieza a su medida y con su letra antes de montar nada.',
    detail: [
      'Repasa la lista de corte y marca cada pieza a lápiz con la escuadra.',
      esc
        ? `Corta los cuatro montantes a ${mm(Hs)} usando un tope, para que salgan idénticos; los ${niveles.length * 2} travesaños, todos a ${mm(prof)}.`
        : `Corta los dos costados a ${mm(Hs)} × ${mm(prof)} y todas las baldas iguales${union === 'ranura' ? `, a ${mm(luz + 2 * RANURA)} de largo (incluye ${RANURA} mm por lado que entran en la ranura)` : `, a ${mm(luz)} de largo`}.`,
      'Escribe la letra de cada pieza en una cara que no se vaya a ver y marca qué canto va delante.',
      ...(cruz ? [`Los listones de la cruz córtalos a ${mm(lCorte)}: se recortan a su medida final al presentarlos.`] : []),
      ...(n < nPedidas ? [`Con ${mm(H)} de alto solo caben ${n} niveles con al menos ${mm(PASO_MIN)} entre baldas, así que se ha reducido el número.`] : []),
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz', 'Sierra de mano, circular o ingletadora', 'Sargentos'],
    check: esc ? 'Pon los cuatro montantes de pie sobre el suelo, juntos: ninguno debe sobresalir.' : 'Junta los dos costados cara con cara: deben coincidir en todo el contorno.',
    tip: 'Elige las piezas más rectas para los montantes o costados y las de veta más bonita para la tapa y el frente.',
  });

  const alturas = niveles.map((y) => mm(esc ? y - P : y)).join(', ');
  b.step({
    kind: 'preparar',
    title: esc ? 'Traza la altura de los travesaños' : union === 'ranura' ? 'Traza y abre las ranuras' : 'Traza la altura de las baldas',
    summary: esc ? 'Las dos escaleras tienen que salir idénticas: se trazan a la vez.' : 'Los dos costados se trazan juntos para que las baldas queden horizontales.',
    detail: [
      esc
        ? 'Junta los cuatro montantes con sargentos, a ras por abajo, con la cara interior hacia arriba.'
        : 'Pon los dos costados juntos, cara interior hacia arriba y a ras por abajo, y sujétalos con sargentos.',
      `Mide siempre desde el suelo (el extremo inferior) y traza con escuadra la cara inferior de cada ${esc ? 'travesaño' : 'balda'}: ${alturas}.`,
      `Quedan ${mm(paso - T)} libres entre baldas${esc ? ` (${mm(paso - T - P)} por debajo del travesaño)` : ''}.`,
      ...(union === 'ranura' ? tecRanura.how.slice(1) : []),
      ...(!esc && union === 'ranura' && !vuelo ? ['La de arriba queda abierta por el extremo del costado: es un galce, se abre igual.'] : []),
    ],
    parts: [],
    technique: union === 'ranura' ? tecRanura : undefined,
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz afilado o cuchilla de marcar', 'Sargentos', ...(union === 'ranura' ? toolsUnion : [])],
    tip: 'Haz una regla-plantilla con un listón y las alturas marcadas: es más fiable que medir cada vez con el flexómetro.',
    ...(union === 'ranura' ? { warning: 'Con la fresadora: pieza bien sujeta, gafas y protección auditiva, y avanza siempre contra el giro de la fresa.' } : {}),
  });

  if (esc) {
    const eschk = 'Mide las diagonales de la escalera, de esquina a esquina: si coinciden, está a escuadra.';
    b.step({
      kind: 'montar',
      title: 'Monta la primera escalera',
      summary: `Dos montantes y ${niveles.length} travesaños forman el lateral izquierdo.`,
      detail: [
        'Tumba dos montantes en el suelo, con la cara trazada hacia arriba y separados el fondo del mueble.',
        `Presenta cada travesaño sobre sus líneas, a ras con el canto delantero y el trasero de los montantes.`,
        ...tec.how.slice(0, 3),
        'Fija primero los dos travesaños de los extremos, comprueba la escuadra y después los demás.',
      ],
      parts: [...mL, ...tL],
      marks: marksEscL,
      technique: tec,
      hardware: lineasUnion(marksEscL.length, 'travesano'),
      tools: [...toolsUnion, 'Escuadra de carpintero'],
      check: eschk,
      warning: union === 'tubillon' ? 'Deja secar la cola con la escalera plana y a escuadra; no la levantes hasta que haya curado.' : undefined,
    });
    b.step({
      kind: 'montar',
      title: 'Monta la segunda escalera',
      summary: 'El lateral derecho es la imagen en espejo del primero.',
      detail: [
        'Coloca los montantes que quedan junto a la primera escalera y usa sus travesaños como referencia de altura.',
        'Recuerda que los travesaños van por dentro: en esta escalera, en la cara opuesta a la de la primera.',
        union === 'tornillo' ? 'Taladra, avellana y atornilla igual que antes.' : 'Taladra, encola y cierra con sargentos igual que antes.',
      ],
      parts: [...mR, ...tR],
      marks: marksEscR,
      hardware: lineasUnion(marksEscR.length, 'travesano'),
      tools: toolsUnion,
      check: 'Pon una escalera encima de la otra: los travesaños deben coincidir en altura.',
    });
    const primeras = nivelesBalda.length > 1 ? [baldas[0], baldas[baldas.length - 1]] : [baldas[0]];
    const yPrim = nivelesBalda.length > 1 ? [nivelesBalda[0], nivelesBalda[nivelesBalda.length - 1]] : [nivelesBalda[0]];
    const marksPrim = yPrim.flatMap(marcasBalda);
    b.step({
      kind: 'montar',
      title: 'Une las escaleras con las baldas',
      summary: 'La balda de abajo y la de arriba ponen el mueble de pie.',
      detail: [
        'Pon las dos escaleras de pie, con los travesaños hacia dentro; pide ayuda para sujetarlas.',
        `Apoya la balda de abajo sobre sus travesaños, centrada: entra justa entre los montantes (${mm(luz)}).`,
        ...(primeras.length > 1 ? ['Coloca la balda de arriba de la misma forma.'] : []),
        union === 'tornillo'
          ? `Fija cada extremo con dos tornillos de arriba abajo, sobre el eje del travesaño: paso de 4 mm en la balda, piloto de ${fmtD(piloto(4))} mm en el travesaño y avellanado.`
          : `Encola dos tubillones en cada travesaño (18 mm dentro) y taladra la balda por debajo a juego, a 12 mm como máximo para no atravesar sus ${T} mm. Sin cola en la balda: queda encajada y se puede levantar.`,
      ],
      parts: primeras,
      marks: marksPrim,
      hardware: lineasUnion(marksPrim.length, 'balda'),
      tools: [...toolsUnion.filter((t) => !t.startsWith('Sargentos')), 'Una segunda persona'],
      check: 'Mide las dos diagonales de la planta (de montante delantero a montante trasero opuesto): deben ser iguales.',
      warning: 'Hasta que no esté arriostrado, el mueble se puede abatir hacia un lado: no lo dejes de pie sin sujetar.',
    });
    const resto = baldas.filter((id) => !primeras.includes(id));
    if (resto.length) {
      const marksResto = nivelesBalda.filter((y) => !yPrim.includes(y)).flatMap(marcasBalda);
      b.step({
        kind: 'montar',
        title: 'Coloca las baldas intermedias',
        summary: `${resto.length} balda${resto.length > 1 ? 's' : ''} más, sobre sus travesaños.`,
        detail: [
          'Mete cada balda en inclinado entre las escaleras y bájala hasta que apoye en sus travesaños.',
          'Céntrala de delante a atrás y fíjala igual que las anteriores.',
        ],
        parts: resto,
        marks: marksResto,
        hardware: lineasUnion(marksResto.length, 'balda'),
        tools: toolsUnion.filter((t) => !t.startsWith('Sargentos')),
      });
    }
  } else {
    const ext = nivelesBalda.length;
    b.step({
      kind: 'montar',
      title: 'Une las baldas al primer costado',
      summary: `Con el costado tumbado, se colocan de pie las ${ext} baldas${zocalo ? ' y el zócalo' : ''}.`,
      detail: [
        'Tumba el costado izquierdo en el suelo sobre una manta, con la cara interior hacia arriba.',
        union === 'ranura'
          ? 'Pon cola en las ranuras y en la testa de cada balda, y encájalas de pie, con el canto delantero a ras del costado.'
          : union === 'tubillon'
            ? 'Encola los tubillones en las testas de las baldas y preséntalas de pie sobre sus agujeros del costado, sin cerrar del todo.'
            : `Pon las baldas de pie sobre sus líneas, a ras por delante. Taladra desde fuera del costado (paso de ${fmtD(dTor)} mm), avellana y atornilla en la testa de cada balda con piloto de ${fmtD(pilotT)} mm.`,
        ...(zocalo ? [`El zócalo va bajo la balda inferior, a ras por delante: ${mm(ZOC)} de alto.`] : []),
        'Mantén las baldas a escuadra con el costado usando una escuadra grande o un taco cuadrado.',
      ],
      parts: [costL, ...baldas, ...(zoc ? [zoc] : [])],
      marks: marksCosL,
      technique: tec,
      hardware: lineasCostado(marksCosL.length, union === 'ranura'),
      tools: [...toolsUnion, 'Escuadra de carpintero', 'Manta o cartón para proteger'],
      check: 'Todas las baldas deben quedar perpendiculares al costado y a ras por delante.',
    });
    b.step({
      kind: 'montar',
      title: 'Cierra con el segundo costado',
      summary: 'El costado derecho se apoya encima de las baldas y cierra el cajón.',
      detail: [
        union === 'ranura' ? 'Pon cola en las ranuras del segundo costado y en las testas libres.' : union === 'tubillon' ? 'Encola los tubillones que asoman de las baldas y los agujeros del segundo costado.' : 'Traza en la cara exterior del segundo costado la línea central de cada balda para saber dónde taladrar.',
        'Con ayuda, baja el costado encima de las baldas, encajando todo a la vez desde un extremo.',
        union === 'tornillo' ? 'Taladra, avellana y atornilla igual que en el primer costado.' : 'Cierra con sargentos largos a la altura de cada balda y limpia la cola que rebose.',
        'Antes de que agarre la cola, comprueba la escuadra.',
      ],
      parts: [costR],
      marks: marksCosR,
      hardware: lineasCostado(marksCosR.length, union === 'ranura'),
      tools: [...toolsUnion, 'Sargentos largos', 'Una segunda persona'],
      check: 'Mide las dos diagonales del frente del mueble: deben ser iguales.',
      warning: 'Monta el cajón tumbado y no lo levantes hasta que la cola haya curado si has encolado.',
    });
  }

  if (vuelo) {
    b.step({
      kind: 'montar',
      title: 'Coloca la tapa con vuelo',
      summary: `La tapa sobresale ${mm(vu)} por los lados y por delante.`,
      detail: [
        'Pon el mueble de pie y apoya la tapa encima, a ras por detrás.',
        `Comprueba que sobresale lo mismo por la izquierda y por la derecha (${mm(vu)}) y ${mm(vu)} por delante.`,
        union === 'tornillo'
          ? `Taladra desde arriba con paso, piloto y avellanado sobre el eje de ${esc ? 'cada travesaño superior' : 'cada costado'} y atornilla.`
          : `Fija la tapa con tubillones encolados en ${esc ? 'los travesaños superiores' : 'los cantos de los costados'}: márcalos con marcadores de tubillón.`,
      ],
      parts: [tapa],
      marks: marksTapa,
      hardware: lineasUnion(marksTapa.length, 'tapa'),
      tools: toolsUnion,
      tip: union === 'tornillo' ? 'Si no quieres ver las cabezas, avellana algo más hondo y tapa el agujero con un tapón de madera encolado.' : undefined,
    });
  }

  if (trasera) {
    b.step({
      kind: 'montar',
      title: 'Escuadra y fija la trasera',
      summary: 'La trasera bloquea el mueble a escuadra: es lo que le da rigidez de lado a lado.',
      detail: [
        'Tumba el mueble boca abajo sobre una manta.',
        'Mide las dos diagonales de la parte de atrás y empuja la esquina larga hasta que coincidan.',
        `Apoya la trasera a ras con los cantos exteriores y fíjala primero en dos esquinas opuestas; vuelve a medir y sigue: ${ptsTrasBorde.length} tornillos en ${esc ? 'los montantes' : 'los costados'} y ${ptsTrasBaldas.length} en los cantos de las baldas.`,
        `Haz taladros piloto de ${fmtD(pilot3)} mm: el canto de una balda de ${T} mm se raja con facilidad.`,
      ],
      parts: [tras],
      marks: marksTrasera,
      technique: {
        name: 'Trasera atornillada como arriostrado',
        why: 'Un tablero fino atornillado en todo su contorno forma un triángulo indeformable con cada esquina: el mueble ya no se puede descuadrar de lado. Por eso se escuadra el cuerpo justo antes de fijarla.',
        how: [
          'Escuadra midiendo diagonales.',
          'Fija dos esquinas opuestas, comprueba de nuevo y completa el perímetro y las baldas.',
          `Longitud del tornillo: Spax propone para uniones no estructurales unas 3 veces el grueso de la pieza que se sujeta (${TB} mm → unos 20 mm).`,
        ],
      },
      hardware: [hw('Tornillo para madera de cabeza plana 3 × 20 mm', marksTrasera.length)],
      tools: ['Atornillador', `Broca de ${fmtD(pilot3)} mm`, 'Flexómetro', 'Manta o cartón para proteger'],
      check: 'Las dos diagonales de la trasera deben ser iguales antes del primer tornillo.',
    });
  } else if (cruz) {
    b.step({
      kind: 'montar',
      title: 'Arriostra con la cruz trasera',
      summary: 'Dos listones en aspa por detrás impiden que el mueble se tumbe de lado.',
      detail: [
        'Tumba el mueble boca abajo sobre una manta y escuádralo midiendo las diagonales de la parte de atrás.',
        `Presenta los dos listones cruzados sobre los montantes traseros: un extremo a ${mm(yLo)} y el otro a ${mm(yHi)} del suelo, en el centro del montante.`,
        'Marca dónde se cruzan y dónde asoman de los montantes. Corta los extremos a ras del canto exterior del montante.',
        'En el cruce, rebaja cada listón la mitad de su grueso (10 mm) a lo ancho del otro: es una unión a media madera. Encólala.',
        union === 'tornillo' ? `Fija cada extremo con dos tornillos al montante, con paso, piloto de ${fmtD(piloto(4))} mm y avellanado.` : 'Fija cada extremo con dos tubillones encolados al montante.',
      ],
      parts: cruzIds,
      marks: marksCruz,
      technique: {
        name: 'Cruz a media madera',
        why: 'Un aspa forma triángulos que no se deforman: el mueble no puede hacer «paralelogramo». A media madera los dos listones quedan en el mismo plano, pegados a los montantes.',
        how: [
          'Marca en cada listón el ancho del otro y la mitad del grueso con gramil.',
          'Sierra los hombros hasta la línea de profundidad y vacía con formón.',
          'Prueba en seco y encola: sin cola, la media madera no se mantiene unida.',
        ],
      },
      hardware: [
        ...(union === 'tornillo' ? [hw('Tornillo para madera de cabeza avellanada 4 × 50 mm', marksCruz.length)] : [hw('Tubillón estriado de haya Ø8 × 30 mm', marksCruz.length)]),
        ...colaOnce(),
      ],
      tools: [...toolsUnion, 'Gramil', 'Serrucho de costilla', 'Formón de 20 mm', 'Falsa escuadra'],
      check: 'Antes de fijar, las diagonales de la parte de atrás deben ser iguales.',
    });
  } else {
    b.step({
      kind: 'montar',
      title: 'Pon de pie y comprueba la escuadra',
      summary: 'Sin trasera ni cruz, la escuadra solo depende de las uniones: revísala.',
      detail: [
        'Pon el mueble de pie en su sitio y mide las dos diagonales del frente.',
        'Si no coinciden, empuja en diagonal la esquina más larga hasta igualarlas.',
        'Comprueba con el nivel que las baldas quedan horizontales; si el suelo no es plano, calza la pata baja.',
      ],
      parts: [],
      tools: ['Flexómetro', 'Nivel de burbuja'],
      warning: 'Sin trasera ni cruz el mueble puede descuadrarse de lado con el uso. Si lo notas, añade una trasera.',
    });
  }

  if (anti) {
    b.step({
      kind: 'montar',
      title: 'Atornilla las escuadras antivuelco',
      summary: 'Dos escuadras bajo el nivel superior sujetarán el mueble a la pared.',
      detail: [
        `Atornilla cada escuadra bajo ${vuelo ? 'la tapa' : 'la balda superior'}, pegada a ${esc ? 'la parte de atrás, junto al travesaño' : 'la parte de atrás y al costado'}, con dos tornillos.`,
        'El ala vertical debe quedar a ras de la parte de atrás del mueble, contra la pared.',
        'No la fijes todavía a la pared: eso se hace al final, con el mueble acabado y en su sitio.',
        ...(cruz ? [`La cruz separa el mueble ${mm(CR)} de la pared: calza ese hueco con un taco de madera detrás de cada escuadra.`] : []),
      ],
      parts: escuadras,
      marks: marksEscWood,
      hardware: [hw('Tornillo para madera de cabeza plana 4 × 16 mm', marksEscWood.length)],
      tools: ['Atornillador', `Broca de ${fmtD(piloto(4))} mm`],
      warning: 'Una estantería alta, sobre todo cargada arriba o con un niño trepando, puede volcar. Ánclala siempre a la pared.',
    });
  }

  const acab: Step = {
    kind: 'acabar',
    title: 'Lija, protege y ancla a la pared',
    summary: 'Lija, da el acabado y, ya en su sitio, sujeta el mueble a la pared antes de cargarlo.',
    detail: [
      'Mata las aristas con un taco de lija y lija a favor de la veta, sin saltarte granos.',
      'Aspira el polvo y aplica el acabado (aceite, cera o barniz al agua) siguiendo el bote; lija suave entre manos.',
      anti
        ? 'Con el acabado seco, coloca el mueble en su sitio, marca en la pared el agujero de cada escuadra, taladra, pon el taco y atornilla.'
        : 'Has elegido no poner escuadras antivuelco: añádelas antes de cargarlo si el mueble es alto o hay niños en casa.',
      'Carga las baldas de abajo arriba y deja lo más pesado en las de abajo.',
    ],
    parts: [],
    marks: marksEscPared,
    hardware: [
      hw('Lija de grano 80, 120 y 180', 2, 'pliegos de cada'),
      hw('Aceite, cera o barniz al agua para muebles', 1, 'bote'),
      ...(anti ? [hw(pared, marksEscPared.length)] : []),
    ],
    tools: ['Taco de lija o lijadora orbital', 'Brocha o paño de algodón', 'Mascarilla antipolvo', ...(anti ? ['Taladro con broca adecuada a la pared', 'Detector de cables y tuberías'] : [])],
    warning: anti ? 'Antes de taladrar la pared, comprueba que no pasa ningún cable ni tubería por ese punto.' : 'Sin anclaje a la pared el mueble puede volcar.',
  };
  b.step(acab);

  // La geometría se ha trazado con el frente en z = 0; en el modelo Z crece de atrás hacia
  // delante, así que se refleja en Z para que la trasera quede detrás (z = 0) y el frente en z = D.
  for (const p of b.parts) p.pos[2] = D - p.pos[2];
  for (const s of b.steps) for (const m of s.marks ?? []) {
    m.at = [m.at[0], m.at[1], D - m.at[2]];
    if (m.to) m.to = [m.to[0], m.to[1], D - m.to[2]];
  }

  // ===================== proyecto =====================
  const unionName = tec.name;
  const nombreForma = esc ? 'de montantes tipo escalera' : 'de costados';
  return b.finish({
    id: 'estanteria',
    title: 'Estantería',
    craft: 'carpinteria',
    summary: `Estantería ${nombreForma} de ${Math.round(W / 10)} × ${Math.round(H / 10)} cm y ${Math.round(D / 10)} cm de fondo, con ${n} niveles${trasera ? ' y trasera' : cruz ? ' y cruz trasera' : ''}.`,
    difficulty: union === 'tornillo' && !cruz ? 1 : 2,
    hours: Math.round((esc ? 5 : 4) + n * 0.4 + (union === 'tubillon' ? 3 : union === 'ranura' ? 3 : 0) + (trasera ? 0.5 : 0) + (cruz ? 1.5 : 0) + (vuelo ? 0.5 : 0) + (zocalo ? 0.5 : 0)),
    dims: [W, H, D],
    safety: [
      'Ancla la estantería a la pared. Los manuales de IKEA abren con un aviso de vuelco y entregan el anclaje sin tacos ni tornillos de pared, porque dependen del tipo de pared: elige los tuyos según sea ladrillo, hormigón o pladur.',
      'Gafas de protección siempre que cortes, taladres o lijes; mascarilla al lijar.',
      'Sujeta la pieza con sargentos: nunca con la mano cerca de la línea de corte ni de la broca.',
      'Para levantar y mover el mueble, dos personas.',
      'No te subas a las baldas ni dejes que los niños trepen por ellas.',
    ],
    notes: [
      'Las medidas de la lista de corte son finales. Compra el listón y el tablero ya cepillados.',
      `Luz de cada balda: ${mm(luz)}. Según Fine Woodworking, duplicar la luz multiplica la flecha por 8 y duplicar el grueso la divide por 8; acortar la luz es lo que más rigidez da.`,
      ...(luz > LUZ_FORO
        ? [`En foros de carpintería se aconseja no pasar de unas 32 pulgadas (≈${LUZ_FORO} mm, conv. propia) en baldas de 3/4 in sin canto: con ${mm(luz)} de luz, si vas a cargar libros pega un listón de canto bajo el borde delantero de cada balda. Es una opinión de oficio, no una norma.`]
        : []),
      'No damos carga máxima por balda: depende de la madera concreta, de las uniones y de cómo se reparta el peso.',
      ...(n < nPedidas ? [`Se han dejado ${n} niveles en lugar de ${nPedidas} para que quede al menos ${mm(PASO_MIN)} entre baldas.`] : []),
      ...(!trasera && !cruz ? ['Sin trasera ni cruz el mueble depende solo de sus uniones para no descuadrarse: recomendamos añadir una de las dos.'] : []),
      ...(cruz ? ['La cruz se inspira en el soporte en X de la estantería IVAR de IKEA.'] : []),
    ],
    sources: [
      { label: 'USDA Wood Handbook, cap. 8 «Fastenings» (taladro guía)', url: 'https://research.fs.usda.gov/download/treesearch/37424.pdf' },
      { label: 'Popular Woodworking: Pilot Holes, Clearance Holes & Countersinks', url: 'https://www.popularwoodworking.com/editors-blog/pilot-holes-clearance-holes-countersinks/' },
      { label: 'Spax: customer service (regla de 3 veces el grueso)', url: 'https://spax.us/customer-service' },
      ...(union === 'tubillon' ? [{ label: 'Fine Woodworking: Make Strong, Simple Joints with Dowels', url: 'https://www.finewoodworking.com/2011/09/29/make-strong-simple-joints-with-dowels' }] : []),
      ...(union === 'ranura' ? [{ label: 'Fine Woodworking: Cutting rabbets two ways', url: 'https://www.finewoodworking.com/2022/12/13/cutting-rabbets-two-ways' }] : []),
      ...(cruz ? [{ label: 'Fine Woodworking: All About Lap Joints', url: 'https://www.finewoodworking.com/2005/09/12/all-about-lap-joints' }] : []),
      { label: 'Fine Woodworking: Engineer Shelves With The Sagulator', url: 'https://www.finewoodworking.com/2007/01/05/engineer-shelves-with-the-sagulator' },
      ...(luz > LUZ_FORO ? [{ label: 'WoodWeb: Free Span Limits of Cabinet Shelving', url: 'https://www.woodweb.com/knowledge_base/Free_Span_Limits_of_Cabinet_Shelving.html' }] : []),
      { label: 'IKEA: instrucciones de montaje KALLAX (aviso de vuelco)', url: 'https://www.ikea.com/es/es/assembly_instructions/kallax-estanteria-blanco__AA-2703431-1-2.pdf' },
      ...(esc ? [{ label: 'IKEA: estantería IVAR (referencia de medidas y soporte en X)', url: 'https://www.islas.ikea.es/tenerife/es/pd/ivar-estanteria-spr-89404578' }] : []),
    ],
    spec: [
      { label: 'Medidas', value: `${W} × ${H} × ${D} mm` },
      { label: 'Forma', value: esc ? `Escaleras de listón ${P} × ${P} mm` : `Costados de tablero de ${T} mm` },
      { label: 'Niveles', value: `${n} (${vuelo ? `${n - 1} baldas y tapa` : `${n} baldas`}), ${mm(paso - T)} libres entre ellas` },
      { label: 'Trasera', value: trasera ? `Contrachapado de ${TB} mm` : cruz ? 'Cruz de listón a media madera' : 'No' },
      ...(esc ? [] : [{ label: 'Zócalo', value: zocalo ? `Sí, ${ZOC} mm` : 'No' }]),
      { label: 'Tapa con vuelo', value: vuelo ? `Sí, ${vu} mm` : 'No' },
      { label: 'Antivuelco', value: anti ? '2 escuadras a la pared' : 'No' },
      { label: 'Unión', value: unionName },
    ],
  });
}
