import type { Axis, Generator, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, hw, mm, tornillos } from '../core/builder';
import {
  SECCIONES, TEC_PUNTEO, UAL_PUESTO, WWJ_BANCO, cordonesTope, fmtNum, fuentesSoldaduraProyecto, infoProceso, letras,
  pasoCordones, pasoCortar, pasoPintar, pasoPreparar, pasoRepasar, puntoOrejeta, puntosTope, seguridadSoldadura,
  type Proceso,
} from './taburete-acero';

/**
 * MESA DE TRABAJO DE ACERO (soldadura).
 * Bastidor de tubo cuadrado con cuatro patas, aro superior y travesaños inferiores
 * (en H o perimetrales). El tablero de madera se atornilla desde abajo a través de
 * orejetas de pletina soldadas por dentro del aro superior.
 */

const OREJA = { w: 30, t: 4, l: 40 };
const T_BALDA = 18;
type End = 'min' | 'max';
type J = [string, End];

export const mesaAcero: Generator = {
  id: 'mesa-acero',
  title: 'Mesa de trabajo de acero',
  craft: 'soldadura',
  difficulty: 2,
  description:
    'Banco de trabajo con bastidor de tubo soldado y tablero de madera atornillado desde abajo. Con balda, ruedas o niveladores, y travesaños en H o perimetrales.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 800, max: 2000, step: 10, unit: 'mm', default: 1200, group: 'Medidas' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 500, max: 900, step: 10, unit: 'mm', default: 600, group: 'Medidas' },
    { key: 'alto', label: 'Alto total', type: 'number', min: 750, max: 1000, step: 5, unit: 'mm', default: 880, group: 'Medidas', help: 'Hasta la cara superior del tablero. Para trabajar de pie, prueba a la altura de tu codo o un poco por debajo.' },
    {
      key: 'seccion', label: 'Sección del tubo', type: 'select', default: '40', group: 'Forma',
      options: [
        { value: '30', label: '30 × 30 × 1,5 mm', hint: 'Mesas ligeras y cortas' },
        { value: '40', label: '40 × 40 × 1,5 mm', hint: 'Equilibrada' },
        { value: '40g', label: '40 × 40 × 2 mm', hint: 'Más pared: perdona más el exceso de calor' },
      ],
    },
    {
      key: 'inferiores', label: 'Travesaños inferiores', type: 'select', default: 'perimetral', group: 'Forma',
      options: [
        { value: 'perimetral', label: 'Perimetrales', hint: 'Aro completo: permite balda' },
        { value: 'h', label: 'En H', hint: 'Deja libre el frente para los pies' },
      ],
    },
    { key: 'altoInferior', label: 'Altura de los travesaños inferiores', type: 'number', min: 120, max: 400, step: 10, unit: 'mm', default: 200, group: 'Forma', help: 'Del suelo a la cara superior del travesaño.' },
    { key: 'vuelo', label: 'Vuelo del tablero', type: 'number', min: 0, max: 80, step: 5, unit: 'mm', default: 30, group: 'Detalles', help: 'Cuánto sobresale el tablero del bastidor: con vuelo puedes sujetar piezas con sargentos.' },
    { key: 'balda', label: 'Balda inferior', type: 'boolean', default: true, group: 'Detalles', help: 'Tablero apoyado sobre los travesaños inferiores.', visible: (v) => v.inferiores !== 'h' },
    { key: 'central', label: 'Travesaño central bajo el tablero', type: 'boolean', default: true, group: 'Detalles', help: 'Apoya el tablero en el centro y evita que se combe.' },
    {
      key: 'pies', label: 'Pies', type: 'select', default: 'nivelador', group: 'Detalles',
      options: [
        { value: 'tapon', label: 'Tapones de plástico' },
        { value: 'nivelador', label: 'Pies niveladores', hint: 'Para suelos irregulares' },
        { value: 'ruedas', label: 'Ruedas con freno', hint: 'Sobre placas de pletina soldadas' },
      ],
    },
    {
      key: 'tablero', label: 'Tablero', type: 'select', default: 'contrachapado', group: 'Material',
      options: [
        { value: 'contrachapado', label: 'Contrachapado de 18 mm', hint: 'Estable y económico' },
        { value: 'alistonado', label: 'Alistonado de pino de 30 mm', hint: 'Más pesado y macizo' },
      ],
    },
    {
      key: 'estructura', label: 'Esquinas del bastidor superior', type: 'select', default: 'patas', group: 'Uniones',
      options: [
        { value: 'patas', label: 'Patas pasantes (a tope)', hint: 'Los travesaños apoyan contra las patas' },
        { value: 'marco', label: 'Marco sobre patas (a tope)', hint: 'Primero un marco plano; las patas se sueldan debajo' },
      ],
    },
    {
      key: 'proceso', label: 'Proceso de soldadura', type: 'select', default: 'electrodo', group: 'Uniones',
      options: [
        { value: 'electrodo', label: 'Electrodo revestido E6013', hint: 'Inverter MMA' },
        { value: 'hilo', label: 'Hilo tubular sin gas', hint: 'Soldadora de hilo, sin botella' },
      ],
    },
  ],
  presets: [
    { id: 'taller', name: 'Banco de taller', blurb: '120 × 60 cm, 88 cm de alto, con balda y niveladores.', values: { ancho: 1200, fondo: 600, alto: 880, seccion: '40', inferiores: 'perimetral', altoInferior: 200, vuelo: 30, balda: true, central: true, pies: 'nivelador', tablero: 'contrachapado', estructura: 'patas', proceso: 'electrodo' } },
    { id: 'movil', name: 'Mesa móvil', blurb: 'Carro de trabajo de 90 × 55 cm con ruedas con freno y balda.', values: { ancho: 900, fondo: 550, alto: 850, seccion: '30', inferiores: 'perimetral', altoInferior: 260, vuelo: 20, balda: true, central: false, pies: 'ruedas', tablero: 'contrachapado', estructura: 'marco', proceso: 'hilo' } },
    { id: 'grande', name: 'Banco grande', blurb: '180 × 75 cm con tablero macizo de 30 mm y travesaños en H.', values: { ancho: 1800, fondo: 750, alto: 900, seccion: '40g', inferiores: 'h', altoInferior: 180, vuelo: 50, balda: false, central: true, pies: 'nivelador', tablero: 'alistonado', estructura: 'patas', proceso: 'electrodo' } },
  ],
  build,
};

function build(v: ParamValues) {
  const W = Number(v.ancho), D = Number(v.fondo), H = Number(v.alto);
  const sec = SECCIONES[String(v.seccion)] ?? SECCIONES['40'];
  const s = sec.s, wall = sec.wall;
  const enH = v.inferiores === 'h';
  const vu = Number(v.vuelo);
  const balda = !enH && v.balda === true;
  const central = v.central === true;
  const pies = (['tapon', 'nivelador', 'ruedas'].includes(String(v.pies)) ? v.pies : 'nivelador') as 'tapon' | 'nivelador' | 'ruedas';
  const alist = v.tablero === 'alistonado';
  const t = alist ? 30 : 18;
  const marco = v.estructura === 'marco';
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);

  const Wf = W - 2 * vu, Df = D - 2 * vu;
  const PLACA = s + 20; // placa de rueda (pletina) que sobresale 10 mm por cada lado de la pata
  const hRueda = 96; // altura de la rueda con su placa de montaje (orientativa)
  const hPie = pies === 'ruedas' ? hRueda + 4 : pies === 'nivelador' ? 20 : 3;
  const legTop = H - t;
  const yTop = legTop - s;
  const legLen = (marco ? yTop : legTop) - hPie;
  const yLow = Math.max(hPie + s + 60, Math.min(Number(v.altoInferior), yTop - 200));
  const Lx = Wf - 2 * s, Lz = Df - 2 * s;
  const x0 = vu, x1 = vu + Wf - s, z0 = vu, z1 = vu + Df - s;
  const xm = vu + Wf / 2 - s / 2, zm = vu + Df / 2 - s / 2;

  const L = letras();
  const b = new Builder();
  const tubo = (name: string, len: number, axis: Axis, at: Vec3) => {
    const r = L(`tubo|${s}|${wall}|${len}`, name);
    return b.tubo({ ref: r.ref, name: r.name, section: [s, s], wall, length: len, axis, at });
  };
  const nombreX = (len: number) => (len === Lz ? 'Travesaño corto' : 'Travesaño largo');

  // --- piezas en orden de montaje ---
  const supX: string[] = [], supZ: string[] = [], cenSup: string[] = [];
  const patas: { id: string; x: number; z: number }[] = [];
  const mkPatas = () => {
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) patas.push({ id: tubo('Pata', legLen, 'y', [x, hPie, z]), x, z });
  };
  const infZ: string[] = [], infX: string[] = [], cenInf: string[] = [];
  if (marco) {
    for (const z of [z0, z1]) supX.push(tubo('Larguero del marco', Wf, 'x', [vu, yTop, z]));
    for (const x of [x0, x1]) supZ.push(tubo('Travesaño corto', Lz, 'z', [x, yTop, vu + s]));
    if (central) cenSup.push(tubo('Travesaño corto', Lz, 'z', [xm, yTop, vu + s]));
    mkPatas();
    for (const x of [x0, x1]) infZ.push(tubo('Travesaño corto', Lz, 'z', [x, yLow - s, vu + s]));
  } else {
    mkPatas();
    for (const x of [x0, x1]) supZ.push(tubo('Travesaño corto', Lz, 'z', [x, yTop, vu + s]));
    for (const x of [x0, x1]) infZ.push(tubo('Travesaño corto', Lz, 'z', [x, yLow - s, vu + s]));
    for (const z of [z0, z1]) supX.push(tubo(nombreX(Lx), Lx, 'x', [vu + s, yTop, z]));
    if (central) cenSup.push(tubo('Travesaño corto', Lz, 'z', [xm, yTop, vu + s]));
  }
  if (enH) cenInf.push(tubo(nombreX(Lx), Lx, 'x', [vu + s, yLow - s, zm]));
  else for (const z of [z0, z1]) infX.push(tubo(nombreX(Lx), Lx, 'x', [vu + s, yLow - s, z]));

  // orejetas
  const oreja = (side: 'f' | 't' | 'i' | 'd', pos: number, yT: number) => {
    const r = L(`pletina|${OREJA.w}x${OREJA.t}|${OREJA.l}`, 'Orejeta de fijación');
    const axis: Axis = side === 'f' || side === 't' ? 'z' : 'x';
    const at: Vec3 =
      side === 'f' ? [pos - OREJA.w / 2, yT - OREJA.t, vu + s]
      : side === 't' ? [pos - OREJA.w / 2, yT - OREJA.t, vu + Df - s - OREJA.l]
      : side === 'i' ? [vu + s, yT - OREJA.t, pos - OREJA.w / 2]
      : [vu + Wf - s - OREJA.l, yT - OREJA.t, pos - OREJA.w / 2];
    const section: [number, number] = axis === 'z' ? [OREJA.w, OREJA.t] : [OREJA.t, OREJA.w];
    const id = b.pletina({ ref: r.ref, name: r.name, section, length: OREJA.l, axis, at });
    const d = 25;
    const hole: Vec3 =
      side === 'f' ? [pos, yT, vu + s + d] : side === 't' ? [pos, yT, vu + Df - s - d] : side === 'i' ? [vu + s + d, yT, pos] : [vu + Wf - s - d, yT, pos];
    return { id, end: (side === 'f' || side === 'i' ? 'min' : 'max') as End, hole };
  };
  const nX = 2 * Math.max(1, Math.round(Lx / 1000));
  const xsOre = Array.from({ length: nX }, (_, i) => vu + s + (Lx * (i + 0.5)) / nX);
  const zc = vu + Df / 2;
  const orejas = [
    ...xsOre.flatMap((x) => [oreja('f', x, legTop), oreja('t', x, legTop)]),
    oreja('i', zc, legTop), oreja('d', zc, legTop),
  ];
  const orejasBalda = balda ? [vu + s + Lx / 4, vu + s + (3 * Lx) / 4].flatMap((x) => [oreja('f', x, yLow), oreja('t', x, yLow)]) : [];

  // placas de rueda
  const placas = pies === 'ruedas'
    ? patas.map((p) => {
        const r = L(`placa|${PLACA}`, 'Placa de la rueda');
        return b.pletina({ ref: r.ref, name: r.name, section: [4, PLACA], length: PLACA, axis: 'x', at: [p.x - 10, hRueda, p.z - 10] });
      })
    : [];

  // pies y tapones (herrajes)
  const stockTapon = `Tapón de plástico con ala para tubo cuadrado ${s}×${s} mm (pared ${fmtNum(wall)} mm)`;
  const stockNivel = `Tapón roscado para tubo cuadrado ${s}×${s} mm con pie nivelador`;
  const stockRueda = 'Rueda giratoria con freno y placa de montaje, de unos 96 mm de altura total';
  const tapon = (size: Vec3, at: Vec3) => {
    const r = L(`tapon|${s}`, `Tapón para tubo ${s}×${s}`);
    return b.herraje({ ref: r.ref, name: r.name, size, at, stock: stockTapon });
  };
  const piesIds = patas.map((p) => {
    if (pies === 'tapon') return tapon([s, hPie, s], [p.x, 0, p.z]);
    if (pies === 'nivelador') {
      const r = L(`nivel|${s}`, 'Pie nivelador');
      return b.herraje({ ref: r.ref, name: r.name, size: [s - 4, hPie, s - 4], at: [p.x + 2, 0, p.z + 2], stock: stockNivel });
    }
    const r = L('rueda', 'Rueda con freno');
    return b.herraje({ ref: r.ref, name: r.name, size: [s, hRueda, s], at: [p.x, 0, p.z], stock: stockRueda });
  });
  const taponesMarco = marco ? [z0, z1].flatMap((z) => [tapon([3, s, s], [vu - 3, yTop, z]), tapon([3, s, s], [vu + Wf, yTop, z])]) : [];

  // tablero y balda
  const rT = L(`tablero|${t}`, 'Tablero');
  const tablero = b.panel({ ref: rT.ref, name: rT.name, material: alist ? 'pino' : 'contrachapado', thickness: t, face: [W, D], normal: 'y', at: [0, legTop, 0] });
  const baldaIds: string[] = [];
  if (balda) {
    const r = L('balda', 'Balda inferior');
    baldaIds.push(b.panel({ ref: r.ref, name: r.name, material: 'contrachapado', thickness: T_BALDA, face: [Lx, Df], normal: 'y', at: [vu + s, yLow, vu] }));
  }

  // --- uniones ---
  const ends = (ids: string[]): J[] => ids.flatMap((id) => [[id, 'min'], [id, 'max']] as J[]);
  const jSupX: J[] = marco ? [] : ends(supX);
  const jSupZ = ends(supZ), jCenSup = ends(cenSup), jInfZ = ends(infZ), jInfX = ends(infX), jCenInf = ends(cenInf);
  const jPatas: J[] = marco ? patas.map((p) => [p.id, 'max'] as J) : [];
  const jPlacas: J[] = placas.length ? patas.map((p) => [p.id, 'min'] as J) : [];
  const todasOre = [...orejas, ...orejasBalda];
  const pts = (js: J[], lado: Axis): Mark[] => js.flatMap(([id, e]) => puntosTope(b, id, e, lado));
  const cord = (js: J[]): Mark[] => js.flatMap(([id, e]) => cordonesTope(b, id, e));
  const nUniones = [jSupX, jSupZ, jCenSup, jInfZ, jInfX, jCenInf, jPatas, jPlacas].reduce((a, j) => a + j.length, 0);

  // --- pasos ---
  const nTravesanos = supZ.length + infZ.length + cenSup.length + infX.length + cenInf.length + (marco ? 0 : supX.length);
  b.step(pasoCortar({
    proceso,
    lineas: [
      `Patas: 4 tubos de ${mm(legLen)}.${marco ? ` Largueros del marco: 2 tubos de ${mm(Wf)}.` : ''} Travesaños: ${nTravesanos} tubos (${Lx === Lz ? `todos de ${mm(Lx)}` : `de ${mm(Lx)} los largos y ${mm(Lz)} los cortos`}).`,
      `Orejetas: ${todasOre.length} trozos de pletina ${OREJA.w}×${OREJA.t} de ${mm(OREJA.l)}. Taladra en cada una, a 25 mm de un extremo y centrado, un agujero de paso un poco mayor que el tornillo del tablero.`,
      ...(placas.length ? [`Placas de rueda: 4 cuadrados de pletina de ${PLACA}×4 mm. Presenta encima la placa de tu rueda, marca sus agujeros y taládralos ahora, antes de soldar.`] : []),
    ],
    madera: `Tablero: ${W} × ${D} mm${balda ? `; balda: ${Lx} × ${Df} mm` : ''}. Si no tienes sierra circular con guía, pide en el almacén que te lo corten a medida.`,
  }));

  b.step(pasoPreparar({ proceso }));

  if (marco) {
    b.step({
      kind: 'soldar',
      title: 'Puntea el marco superior en plano',
      summary: 'Los largueros y los travesaños del aro superior forman un marco plano que se puntea sobre la mesa de soldar o el suelo.',
      detail: [
        'Apoya el marco boca abajo sobre una superficie plana: mesa de soldar, chapa gruesa o un suelo de hormigón liso y despejado.',
        `Los travesaños cortos van entre los dos largueros, a tope contra su cara interior${central ? ', y el central en medio, a ' + mm(Wf / 2) + ' de cada extremo' : ''}. El marco mide ${mm(Wf)} × ${mm(Df)}.`,
        'Sujeta cada esquina con un imán de soldador o con escuadra y sargento, con las caras de arriba enrasadas.',
        ...TEC_PUNTEO.how.slice(0, 2),
        'Da la vuelta al marco y puntea las caras opuestas.',
      ],
      parts: [...supX, ...supZ, ...cenSup],
      marks: pts([...jSupZ, ...jCenSup], 'y'),
      technique: TEC_PUNTEO,
      tools: ['Superficie plana grande', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Flexómetro', 'Sargentos', info.equipo[0]],
      check: `Mide las dos diagonales del marco: deben ser iguales (unos ${mm(Math.hypot(Wf, Df))}). Si no, empuja la esquina larga o rompe un punto y vuelve a puntear.`,
      warning: 'Solo puntos: todavía ningún cordón. Un marco soldado del todo antes de comprobarlo ya no se puede corregir.',
    });
  } else {
    b.step({
      kind: 'soldar',
      title: 'Puntea los dos bastidores laterales en plano',
      summary: 'Cada lateral son dos patas unidas por un travesaño corto arriba y otro abajo, punteados tumbados sobre una superficie plana.',
      detail: [
        'Tumba dos patas sobre la mesa de soldar o el suelo plano, paralelas, y mete entre ellas el travesaño superior a tope, enrasado con el extremo de las patas y con sus caras.',
        `Coloca el travesaño inferior con su cara superior a ${mm(yLow - hPie)} del extremo inferior de las patas (quedará a ${mm(yLow)} del suelo con los pies puestos).`,
        'Sujeta con imanes de soldador o sargentos y comprueba la escuadra de cada esquina.',
        ...TEC_PUNTEO.how.slice(0, 2),
        'Da la vuelta al bastidor, puntea las caras opuestas y repite con el segundo lateral usando el primero como plantilla.',
      ],
      parts: [...patas.map((p) => p.id), ...supZ, ...infZ],
      marks: pts([...jSupZ, ...jInfZ], 'x'),
      technique: TEC_PUNTEO,
      tools: ['Superficie plana grande', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Flexómetro', 'Sargentos', info.equipo[0]],
      check: 'Mide las diagonales de cada lateral: deben ser iguales. Pon un lateral sobre el otro: deben coincidir.',
      warning: 'Solo puntos: todavía ningún cordón. Un bastidor soldado del todo antes de comprobarlo ya no se puede corregir.',
    });
  }

  const partsConjunto = marco
    ? [...patas.map((p) => p.id), ...infZ, ...infX, ...cenInf, ...placas, ...todasOre.map((q) => q.id)]
    : [...supX, ...cenSup, ...infX, ...cenInf, ...placas, ...todasOre.map((q) => q.id)];
  const marksConjunto: Mark[] = [
    ...(marco ? [...pts(jPatas, 'x'), ...pts(jInfZ, 'x')] : [...pts(jSupX, 'z'), ...pts(jCenSup, 'y')]),
    ...pts(jInfX, 'z'), ...pts(jCenInf, 'y'), ...pts(jPlacas, 'x'),
    ...todasOre.flatMap((q) => puntoOrejeta(b, q.id, q.end)),
  ];
  b.step({
    kind: 'soldar',
    title: marco ? 'Puntea las patas y los travesaños inferiores' : 'Une los laterales con los travesaños largos',
    summary: marco
      ? 'Las patas apoyan a tope bajo las esquinas del marco y los travesaños inferiores las atan abajo; se añaden las orejetas.'
      : 'Los travesaños largos cierran el aro superior y la parte baja; se añaden las orejetas del tablero.',
    detail: [
      ...(marco
        ? [
            'Deja el marco boca abajo sobre la superficie plana y pon cada pata de pie en una esquina, a ras de las dos caras exteriores.',
            'Puntea cada pata por una cara, comprueba con la escuadra que está a plomo en los dos sentidos y puntea la cara opuesta. Pide ayuda para sujetar las patas largas.',
            `Puntea los travesaños inferiores entre las patas, con su cara superior a ${mm(yLow - hPie)} del extremo libre de las patas.`,
          ]
        : [
            'Pon los dos laterales de pie, boca abajo (patas hacia arriba), sobre la superficie plana y presenta entre ellos los travesaños largos de arriba. Pide ayuda para sujetarlos.',
            'Puntea cada travesaño por una cara, comprueba la escuadra de la esquina y puntea la cara opuesta.',
            ...(central ? [`Puntea el travesaño central entre los dos largos, a ${mm(Wf / 2)} de cada extremo del bastidor.`] : []),
          ]),
      enH
        ? `Puntea el travesaño central inferior entre los dos travesaños bajos de los laterales, centrado en el fondo: forma la H.`
        : 'Puntea los travesaños largos inferiores entre las patas, a la misma altura que los de los laterales.',
      ...(placas.length ? ['Puntea cada placa de rueda bajo su pata, centrada (sobresale 10 mm por cada lado) y con los agujeros libres de la pata.'] : []),
      `Puntea las ${todasOre.length} orejetas por debajo, enrasadas con la cara del tubo donde apoya la madera, con el agujero hacia dentro.`,
    ],
    parts: partsConjunto,
    marks: marksConjunto,
    technique: TEC_PUNTEO,
    tools: ['Escuadra de acero', 'Nivel', 'Imanes de soldador a 90°', 'Sargentos', 'Un ayudante', info.equipo[0]],
    check: `Pon la mesa de pie sobre el suelo más plano que tengas: las cuatro patas deben apoyar sin cojear. Mide las diagonales del aro superior (unos ${mm(Math.hypot(Wf, Df))}) y comprueba que las patas están a plomo.`,
    tip: 'Si cojea, rompe el punto de la pata que se levanta y vuelve a puntearla con la mesa apoyada en el suelo plano. Los niveladores corrigen poco; las ruedas, nada.',
  });

  b.step(pasoCordones({
    proceso,
    nUniones: nUniones + todasOre.length,
    marks: [...cord([...jSupX, ...jSupZ, ...jCenSup, ...jPatas, ...jInfZ, ...jInfX, ...jCenInf, ...jPlacas]), ...todasOre.flatMap((q) => cordonesTope(b, q.id, q.end, true))],
    orden: [
      'Orden: suelda primero las cuatro esquinas del aro superior, cara exterior, saltando en diagonal (delantera izquierda, trasera derecha, delantera derecha, trasera izquierda). Después las caras interiores y las de abajo con la misma ronda.',
      'Las caras de arriba, donde apoyará el tablero, déjalas para el final y con cordón fino: luego se amolan a ras.',
      `Sigue con los travesaños inferiores${enH ? ' y la H' : ''}, también alternando de un lado de la mesa al otro${placas.length ? ', y por último las placas de las ruedas, con la mesa boca abajo' : ''}.`,
      'Las orejetas se sueldan solo por debajo y por los cantos: arriba quedan enrasadas con el tubo y ahí apoya la madera.',
    ],
  }));

  b.step(pasoRepasar(['Amola a ras los cordones de la cara de arriba del aro superior y de las orejetas: el tablero tiene que apoyar plano.']));

  b.step(pasoPintar({ madera: `Mientras seca, lija los cantos del tablero${balda ? ' y de la balda' : ''} y protégelos con aceite o barniz por las dos caras.` }));

  const piesHw = pies === 'tapon' ? [hw(stockTapon, 4 + taponesMarco.length)]
    : pies === 'nivelador' ? [hw(stockNivel, 4), ...(taponesMarco.length ? [hw(stockTapon, taponesMarco.length)] : [])]
    : [hw(stockRueda, 4), hw('Tornillo métrico con tuerca autoblocante y arandelas, del diámetro de los agujeros de la placa de la rueda', 16), ...(taponesMarco.length ? [hw(stockTapon, taponesMarco.length)] : [])];
  b.step({
    kind: 'montar',
    title: pies === 'ruedas' ? 'Atornilla las ruedas' : pies === 'nivelador' ? 'Pon los niveladores' : 'Pon los tapones',
    summary: pies === 'ruedas' ? 'Cada rueda se atornilla a su placa: así se puede cambiar sin cortar nada.' : 'Los pies cierran el tubo y protegen el suelo.',
    detail: [
      ...(pies === 'ruedas'
        ? [
            'Con la mesa boca abajo, presenta cada rueda bajo su placa y atorníllala con cuatro tornillos y tuercas autoblocantes.',
            'Monta las ruedas con freno donde vayas a poder pisarlos con comodidad (normalmente, las cuatro o las dos delanteras).',
          ]
        : pies === 'nivelador'
          ? ['Mete a presión los tapones roscados en el extremo inferior de las patas con un mazo de goma y enrosca los niveladores hasta el fondo.']
          : ['Mete a presión los tapones en el extremo inferior de las patas con un mazo de goma.']),
      ...(taponesMarco.length ? ['Pon también tapones en los cuatro extremos abiertos de los largueros del marco.'] : []),
      'Da la vuelta a la mesa entre dos personas.',
    ],
    parts: [...piesIds, ...taponesMarco],
    marks: pies === 'ruedas'
      ? tornillos(patas.flatMap((p) => [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [p.x + s / 2 + sx * (PLACA / 2 - 7), hRueda, p.z + s / 2 + sz * (PLACA / 2 - 7)]))), 'y')
      : undefined,
    hardware: piesHw,
    tools: ['Mazo de goma', ...(pies === 'ruedas' ? ['Llaves fijas o de vaso'] : [])],
    check: pies === 'ruedas' ? 'Con los frenos puestos, empuja la mesa con fuerza: no debe desplazarse.' : 'Apoya la mesa y comprueba con el nivel que el aro superior está horizontal; corrige con los niveladores si los tienes.',
    warning: 'Entre dos personas: la mesa ya pesa y las esquinas de tubo hacen daño.',
  });

  const screwLen = t >= 30 ? 25 : 16;
  b.step({
    kind: 'montar',
    title: balda ? 'Atornilla el tablero y la balda' : 'Atornilla el tablero',
    summary: 'El tablero se atornilla desde abajo a través de las orejetas: no queda ningún tornillo a la vista.',
    detail: [
      'Pon el tablero boca abajo sobre unas mantas y centra el bastidor encima, también boca abajo.',
      `Comprueba que el vuelo es el mismo en los cuatro lados (${mm(vu)}).`,
      `Marca los ${orejas.length} agujeros de las orejetas, haz un taladro piloto en la madera con tope de profundidad para no atravesarla y atornilla.`,
      `Con tornillos de ${screwLen} mm, el tornillo pasa los ${OREJA.t} mm de la orejeta y entra ${screwLen - OREJA.t} mm en un tablero de ${t} mm: no uses uno más largo.`,
      ...(balda ? [`Mete la balda entre las patas, apoyada sobre los travesaños largos inferiores, y atorníllala por debajo a través de sus ${orejasBalda.length} orejetas con tornillos de 16 mm.`] : []),
    ],
    parts: [tablero, ...baldaIds],
    marks: tornillos([...orejas.map((q) => q.hole), ...orejasBalda.map((q) => q.hole)], 'y'),
    hardware: [
      hw(`Tornillo para madera 4 × ${screwLen} mm, cabeza plana`, orejas.length),
      ...(balda ? [hw('Tornillo para madera 3,5 × 16 mm, cabeza plana', orejasBalda.length)] : []),
    ],
    tools: ['Taladro atornillador', 'Broca para madera con tope de profundidad', 'Mantas', 'Flexómetro'],
    tip: 'Con tornillos y no con cola, el tablero se puede dar la vuelta o cambiar cuando esté gastado.',
  });

  b.step({
    kind: 'acabar',
    title: 'Revisa y pon la mesa en uso',
    summary: 'Un último repaso de tornillos, cantos y pintura.',
    detail: [
      'Repasa con pintura los roces del montaje.',
      'Vuelve a apretar los tornillos del tablero al cabo de unas semanas: la madera se asienta.',
      'Reparte el peso sobre el tablero y no te subas a la mesa.',
      ...(pies === 'ruedas' ? ['Pon siempre los frenos antes de trabajar sobre la mesa.'] : []),
    ],
    parts: [],
    tools: ['Destornillador', 'Pincel fino'],
  });

  const pieLabel = { tapon: 'Tapones de plástico', nivelador: 'Pies niveladores', ruedas: 'Ruedas con freno sobre placas soldadas' }[pies];
  return b.finish({
    id: 'mesa-acero',
    title: 'Mesa de trabajo de acero',
    craft: 'soldadura',
    summary: `Mesa de trabajo de ${Math.round(W / 10)} × ${Math.round(D / 10)} cm y ${Math.round(H / 10)} cm de alto, de tubo ${sec.label}${balda ? ', con balda' : ''}${pies === 'ruedas' ? ' y ruedas' : ''}.`,
    difficulty: 2,
    hours: 8 + (balda ? 1 : 0) + (pies === 'ruedas' ? 1 : 0) + (central ? 0.5 : 0) + (W > 1500 ? 1 : 0),
    dims: [W, H, D],
    safety: [...seguridadSoldadura(proceso), 'Mueve y da la vuelta a la mesa entre dos personas.'],
    notes: [
      'Todas las uniones son a tope con cortes rectos: el tubo más corto apoya contra la cara del otro.',
      'Altura: la guía de la Universidad de Almería sitúa la superficie de trabajo según el codo (de 5 a 7 cm por encima si apoyas la mano, ligeramente por debajo si necesitas libertad de movimiento, y de 10 a 30 cm por debajo para materiales pesados). En Woodworker\'s Journal varios maestros parten de 34 pulgadas (unos 86 cm) o de justo por debajo del codo. Mide tu codo antes de cortar las patas.',
      ...(enH ? ['Los travesaños en H dejan libre el frente para meter los pies, pero no admiten balda.'] : []),
      ...(pies === 'ruedas' ? ['La altura de la rueda es orientativa: mide la tuya antes de cortar las patas y resta su altura más 4 mm de placa.'] : []),
      'No se indica carga admisible: depende de tus soldaduras. Pruébala poco a poco.',
      'Las secciones de tubo son una decisión de diseño; compruébalas en tu almacén de hierros.',
    ],
    sources: fuentesSoldaduraProyecto(proceso, [UAL_PUESTO, WWJ_BANCO]),
    spec: [
      { label: 'Medidas', value: `${W} × ${D} × ${H} mm` },
      { label: 'Tubo', value: sec.label },
      { label: 'Travesaños inferiores', value: enH ? `En H, a ${yLow} mm` : `Perimetrales, a ${yLow} mm` },
      { label: 'Tablero', value: `${alist ? 'Alistonado de pino' : 'Contrachapado'} de ${t} mm, vuelo de ${vu} mm` },
      { label: 'Balda inferior', value: balda ? 'Sí' : 'No' },
      { label: 'Travesaño central', value: central ? 'Sí' : 'No' },
      { label: 'Pies', value: pieLabel },
      { label: 'Esquinas', value: marco ? 'Marco sobre patas, a tope' : 'Patas pasantes, a tope' },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}
