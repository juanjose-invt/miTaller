import type { Generator, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, espigas, hw, mm, tornillos } from '../core/builder';

/**
 * MESA DE MADERA — generador de referencia.
 * Estructura clásica: cuatro patas, cuatro faldones bajo el tablero y, opcionalmente,
 * balda inferior y travesaño central. El tipo de unión cambia la tornillería, las
 * marcas en 3D y el texto de los pasos.
 */

const FALDON_T = 20; // grueso del faldón y de los travesaños (mm)

type Union = 'bolsillo' | 'tubillon' | 'espiga';

export const mesa: Generator = {
  id: 'mesa',
  title: 'Mesa',
  craft: 'carpinteria',
  difficulty: 1,
  description:
    'Mesa de cuatro patas con faldones. Sirve como mesa de comedor, escritorio o mesa auxiliar cambiando las medidas.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 500, max: 2200, step: 10, unit: 'mm', default: 1400, group: 'Medidas' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 400, max: 1000, step: 10, unit: 'mm', default: 800, group: 'Medidas' },
    { key: 'alto', label: 'Alto total', type: 'number', min: 350, max: 1100, step: 5, unit: 'mm', default: 750, group: 'Medidas', help: 'Hasta la cara superior del tablero.' },
    {
      key: 'pata', label: 'Sección de la pata', type: 'select', default: '70', group: 'Forma',
      options: [
        { value: '45', label: '45 × 45 mm', hint: 'Ligera: mesas auxiliares' },
        { value: '70', label: '70 × 70 mm', hint: 'Equilibrada' },
        { value: '90', label: '90 × 90 mm', hint: 'Robusta, aspecto rústico' },
      ],
    },
    { key: 'vuelo', label: 'Vuelo del tablero', type: 'number', min: 0, max: 120, step: 5, unit: 'mm', default: 40, group: 'Forma', help: 'Cuánto sobresale el tablero respecto a las patas.' },
    {
      key: 'faldon', label: 'Alto del faldón', type: 'select', default: '95', group: 'Forma',
      options: [
        { value: '70', label: '70 mm', hint: 'Más hueco para las piernas' },
        { value: '95', label: '95 mm', hint: 'Recomendado' },
        { value: '120', label: '120 mm', hint: 'Más rigidez en mesas largas' },
      ],
    },
    {
      key: 'tablero', label: 'Grueso del tablero', type: 'select', default: '28', group: 'Forma',
      options: [
        { value: '18', label: '18 mm' },
        { value: '28', label: '28 mm' },
        { value: '40', label: '40 mm' },
      ],
    },
    { key: 'balda', label: 'Balda inferior', type: 'boolean', default: false, group: 'Detalles', help: 'Añade dos travesaños bajos y una balda entre las patas.' },
    {
      key: 'altoBalda', label: 'Altura de la balda', type: 'number', min: 80, max: 400, step: 10, unit: 'mm', default: 180, group: 'Detalles',
      visible: (v) => v.balda === true,
    },
    {
      key: 'union', label: 'Tipo de unión', type: 'select', default: 'bolsillo', group: 'Uniones',
      options: [
        { value: 'bolsillo', label: 'Tornillo en bolsillo', hint: 'La más rápida para empezar' },
        { value: 'tubillon', label: 'Tubillones encolados', hint: 'Sin tornillos a la vista' },
        { value: 'espiga', label: 'Caja y espiga', hint: 'Tradicional, sin tornillos' },
      ],
    },
  ],
  presets: [
    { id: 'comedor', name: 'Mesa de comedor', blurb: '140 × 80 cm para cuatro o seis personas.', values: { ancho: 1400, fondo: 800, alto: 750, pata: '70', vuelo: 40, faldon: '95', tablero: '28', balda: false, union: 'bolsillo' } },
    { id: 'escritorio', name: 'Escritorio', blurb: '120 × 60 cm, con balda para guardar.', values: { ancho: 1200, fondo: 600, alto: 740, pata: '45', vuelo: 20, faldon: '70', tablero: '18', balda: true, altoBalda: 160, union: 'bolsillo' } },
    { id: 'auxiliar', name: 'Mesa auxiliar', blurb: 'Mesa baja de 90 × 50 cm con ensamble de caja y espiga.', values: { ancho: 900, fondo: 500, alto: 450, pata: '45', vuelo: 30, faldon: '70', tablero: '18', balda: true, altoBalda: 120, union: 'espiga' } },
  ],
  build,
};

function build(v: ParamValues) {
  const W = Number(v.ancho), D = Number(v.fondo), H = Number(v.alto);
  const s = Number(v.pata), vu = Number(v.vuelo), fh = Number(v.faldon), t = Number(v.tablero);
  const union = v.union as Union;
  const balda = v.balda === true;
  const hb = Math.min(Number(v.altoBalda ?? 180), H - t - fh - 80);

  const b = new Builder();
  const legH = H - t;
  const x0 = vu, x1 = W - vu - s, z0 = vu, z1 = D - vu - s;
  const inset = (s - FALDON_T) / 2; // el faldón queda centrado en la pata
  const yF = legH - fh;
  const Lx = W - 2 * vu - 2 * s; // faldón largo
  const Lz = D - 2 * vu - 2 * s; // faldón corto

  // --- piezas ---
  const patas = [
    b.liston({ ref: 'A', name: 'Pata', section: [s, s], length: legH, axis: 'y', at: [x0, 0, z0] }),
    b.liston({ ref: 'A', name: 'Pata', section: [s, s], length: legH, axis: 'y', at: [x0, 0, z1] }),
    b.liston({ ref: 'A', name: 'Pata', section: [s, s], length: legH, axis: 'y', at: [x1, 0, z0] }),
    b.liston({ ref: 'A', name: 'Pata', section: [s, s], length: legH, axis: 'y', at: [x1, 0, z1] }),
  ];
  const cortos = [
    b.liston({ ref: 'C', name: 'Faldón corto', section: [FALDON_T, fh], length: Lz, axis: 'z', at: [x0 + inset, yF, z0 + s] }),
    b.liston({ ref: 'C', name: 'Faldón corto', section: [FALDON_T, fh], length: Lz, axis: 'z', at: [x1 + inset, yF, z0 + s] }),
  ];
  const largos = [
    b.liston({ ref: 'B', name: 'Faldón largo', section: [fh, FALDON_T], length: Lx, axis: 'x', at: [x0 + s, yF, z0 + inset] }),
    b.liston({ ref: 'B', name: 'Faldón largo', section: [fh, FALDON_T], length: Lx, axis: 'x', at: [x0 + s, yF, z1 + inset] }),
  ];
  const bajos = balda
    ? [
        b.liston({ ref: 'E', name: 'Travesaño bajo', section: [FALDON_T, 45], length: Lz, axis: 'z', at: [x0 + inset, hb - 45, z0 + s] }),
        b.liston({ ref: 'E', name: 'Travesaño bajo', section: [FALDON_T, 45], length: Lz, axis: 'z', at: [x1 + inset, hb - 45, z0 + s] }),
      ]
    : [];
  const central = W > 1500
    ? [b.liston({ ref: 'D', name: 'Travesaño central', section: [FALDON_T, fh], length: D - 2 * vu - 2 * inset - 2 * FALDON_T, axis: 'z', at: [W / 2 - FALDON_T / 2, yF, z0 + inset + FALDON_T] })]
    : [];
  const estante = balda
    ? [b.panel({ ref: 'F', name: 'Balda inferior', thickness: 18, face: [W - 2 * vu - 2 * inset, Lz], normal: 'y', at: [x0 + inset, hb, z0 + s] })]
    : [];
  const sobre = b.panel({ ref: 'T', name: 'Tablero', thickness: t, face: [W, D], normal: 'y', at: [0, legH, 0] });

  // --- marcas de fijación ---
  const yMid = yF + fh / 2;
  const fij = (pts: Vec3[], axis: 'x' | 'z'): Mark[] => (union === 'bolsillo' ? tornillos(pts, axis) : espigas(pts, axis));
  const dy = fh / 4;
  const zc = (z: number) => z + s / 2; // centro de pata en z
  const xc = (x: number) => x + s / 2;
  const marksLaterales: Mark[] = [x0, x1].flatMap((x) =>
    [z0 + s, z1].flatMap((z) => fij([[xc(x), yMid - dy, z], [xc(x), yMid + dy, z]], 'z')),
  );
  if (balda) marksLaterales.push(...[x0, x1].flatMap((x) => [z0 + s, z1].flatMap((z) => fij([[xc(x), hb - 22, z]], 'z'))));
  const marksLargos: Mark[] = [z0, z1].flatMap((z) =>
    [x0 + s, x1].flatMap((x) => fij([[x, yMid - dy, zc(z)], [x, yMid + dy, zc(z)]], 'x')),
  );
  const nTop = Math.max(2, Math.round(Lx / 350));
  const marksTablero: Mark[] = tornillos(
    [
      ...Array.from({ length: nTop }, (_, i): Vec3 => [x0 + s + (Lx * (i + 0.5)) / nTop, legH - 6, zc(z0)]),
      ...Array.from({ length: nTop }, (_, i): Vec3 => [x0 + s + (Lx * (i + 0.5)) / nTop, legH - 6, zc(z1)]),
      [xc(x0), legH - 6, D / 2], [xc(x1), legH - 6, D / 2],
    ],
    'y',
  );

  // --- textos según la unión ---
  const nUniones = 8 + (balda ? 4 : 0) + central.length * 2; // extremos de pieza que se unen
  const tec = {
    bolsillo: {
      name: 'Tornillo en bolsillo (pocket hole)',
      why: 'El tornillo entra en diagonal desde la cara interior del faldón y muerde en la pata a contrahílo: queda oculto, no hace falta escoplo y es la unión más indulgente para un primer mueble.',
      how: [
        'Sujeta el faldón en la plantilla de bolsillo y taladra dos bolsillos en cada extremo, por la cara que quedará hacia dentro.',
        'Encola la testa, alinea el faldón con las marcas de la pata y sujétalo con un sargento antes de atornillar.',
        'Atornilla sin pasarte de par: en cuanto la cabeza asienta en el fondo del bolsillo, para.',
      ],
    },
    tubillon: {
      name: 'Tubillones encolados',
      why: 'Dos tubillones por unión alinean las piezas y dan superficie de encolado en una junta a testa. No queda ningún tornillo a la vista.',
      how: [
        'Marca los centros en la testa del faldón y taládralos con tope de profundidad, perfectamente a escuadra.',
        'Transfiere los centros a la pata con marcadores de tubillón y taladra la pareja.',
        'Monta primero en seco. Después encola taladros y tubillones, cierra con sargentos y limpia la cola que rebose.',
      ],
    },
    espiga: {
      name: 'Caja y espiga',
      why: 'La espiga del faldón entra en una caja tallada en la pata. Es el ensamble tradicional de mesas y sillas: mucha superficie de encolado a hilo y resistencia al descuadre sin un solo tornillo.',
      how: [
        'Marca la caja en la pata con gramil y vacíala (taladro y formón) antes de cortar la espiga.',
        'Marca la espiga a partir de la caja real, sierra las mejillas y los hombros y ajústala con formón hasta que entre a mano con presión firme.',
        'Monta en seco, comprueba la escuadra y encola. Aprieta con sargentos hasta que los hombros cierren.',
      ],
    },
  }[union];

  const hwUnion = {
    bolsillo: [hw('Tornillo para bolsillo de rosca gruesa, cabeza de arandela, 4 × 50 mm', nUniones * 2), hw('Cola blanca para madera (PVA)', 1, 'bote')],
    tubillon: [hw('Tubillón estriado de haya Ø8 × 40 mm', nUniones * 2), hw('Cola blanca para madera (PVA)', 1, 'bote')],
    espiga: [hw('Cola blanca para madera (PVA)', 1, 'bote')],
  }[union];
  const split = (lines: typeof hwUnion, part: number, total: number) =>
    lines.map((l) => (l.unit === 'bote' ? l : { ...l, qty: Math.round((l.qty * part) / total) }));

  const toolsUnion = {
    bolsillo: ['Plantilla de taladro para bolsillos con su broca escalonada', 'Atornillador con punta larga'],
    tubillon: ['Broca para madera de 8 mm con tope de profundidad', 'Marcadores de tubillón de 8 mm'],
    espiga: ['Gramil', 'Formones afilados (10 y 20 mm)', 'Serrucho de costilla o sierra japonesa', 'Maza'],
  }[union];

  // la espiga alarga los faldones: se avisa en la nota de corte
  const notaEspiga = union === 'espiga'
    ? 'Con caja y espiga, corta faldones y travesaños 50 mm más largos que la medida de la lista: 25 mm de espiga por cada extremo.'
    : undefined;

  // --- pasos ---
  b.step({
    kind: 'cortar',
    title: 'Corta y marca todas las piezas',
    summary: 'Deja cada pieza a su medida y con su letra antes de montar nada.',
    detail: [
      'Repasa la lista de corte y marca cada pieza a lápiz con escuadra.',
      'Corta las cuatro patas a la vez o usando un tope: lo importante es que midan exactamente lo mismo entre sí.',
      'Escribe la letra de cada pieza en una cara que no se vaya a ver y marca qué cara irá hacia fuera.',
      ...(notaEspiga ? [notaEspiga] : []),
    ],
    parts: [],
    tools: ['Flexómetro', 'Escuadra de carpintero', 'Lápiz', 'Sierra de mano, circular o ingletadora', 'Sargentos'],
    check: 'Junta las cuatro patas de pie sobre una superficie plana: ninguna debe sobresalir.',
    tip: 'Elige para las patas los listones más rectos y sin nudos grandes cerca de los extremos.',
  });

  b.step({
    kind: 'montar',
    title: 'Monta los dos laterales',
    summary: `Une cada pareja de patas con su faldón corto${balda ? ' y su travesaño bajo' : ''}.`,
    detail: [
      `Tumba dos patas sobre el banco. Marca en ellas la posición del faldón: a ras por arriba y centrado en el grueso de la pata (${mm(inset)} desde cada cara).`,
      ...(balda ? [`Marca el travesaño bajo con su cara superior a ${mm(hb)} del suelo.`] : []),
      `Une cada faldón a sus dos patas con la técnica indicada abajo (${tec.name.toLowerCase()}): dos fijaciones por extremo.`,
      'Antes de que agarre la cola, comprueba con la escuadra que pata y faldón forman 90°.',
      'Repite con el otro lateral, usando el primero como plantilla para que salgan idénticos.',
    ],
    parts: [...patas, ...cortos, ...bajos],
    marks: marksLaterales,
    technique: { name: tec.name, why: tec.why, how: tec.how },
    hardware: split(hwUnion, 4 + (balda ? 4 : 0), nUniones),
    tools: [...toolsUnion, 'Sargentos', 'Escuadra de carpintero'],
    check: 'Mide las dos diagonales de cada lateral: si coinciden, está a escuadra.',
    warning: 'No dejes secar la cola con el lateral torcido: comprueba la escuadra antes de soltar los sargentos.',
  });

  b.step({
    kind: 'montar',
    title: 'Une los laterales con los faldones largos',
    summary: 'La estructura se pone de pie y queda cerrada por arriba.',
    detail: [
      'Coloca los dos laterales de pie, boca abajo sobre una superficie plana (con la parte de arriba de las patas apoyada).',
      'Presenta los faldones largos entre las patas, a ras con su extremo superior y centrados en el grueso.',
      union === 'bolsillo' ? 'Encola las testas, sujeta con sargentos y atornilla los bolsillos, alternando de un extremo a otro.' : 'Encola, cierra con sargentos largos y deja secar sin mover.',
      'Comprueba la escuadra en planta antes de que la cola agarre.',
    ],
    parts: largos,
    marks: marksLargos,
    technique: { name: tec.name, why: tec.why, how: tec.how },
    hardware: split(hwUnion, 4, nUniones),
    tools: [...toolsUnion, 'Sargentos largos'],
    check: 'Las diagonales de la estructura, medidas de pata a pata, deben ser iguales.',
  });

  if (central.length) {
    b.step({
      kind: 'montar',
      title: 'Añade el travesaño central',
      summary: 'Evita que los faldones largos se abran y da apoyo al tablero en mesas de más de 1,5 m.',
      detail: [
        'Marca el centro de los dos faldones largos.',
        'Encaja el travesaño entre ellos, a ras por arriba, y fíjalo por ambos extremos con el mismo tipo de unión.',
      ],
      parts: central,
      marks: fij([[W / 2, yMid, z0 + inset + FALDON_T], [W / 2, yMid, z1 + inset]], 'z'),
      hardware: split(hwUnion, 2, nUniones),
      tools: toolsUnion,
    });
  }

  if (balda) {
    b.step({
      kind: 'montar',
      title: 'Coloca la balda inferior',
      summary: 'La balda apoya sobre los dos travesaños bajos y arriostra las patas.',
      detail: [
        'Presenta la balda entre las patas, apoyada sobre los travesaños bajos.',
        'Taladra dos agujeros piloto avellanados en cada extremo, sobre el eje del travesaño.',
        'Atornilla desde arriba sin encolar: así podrás desmontarla.',
      ],
      parts: estante,
      marks: tornillos(
        [x0 + s / 2, x1 + s / 2].flatMap((x): Vec3[] => [[x, hb + 18, z0 + s + Lz * 0.25], [x, hb + 18, z0 + s + Lz * 0.75]]),
        'y',
      ),
      hardware: [hw('Tornillo para madera de cabeza avellanada 4 × 35 mm', 4)],
      tools: ['Taladro', 'Broca para madera de 3 mm', 'Avellanador'],
    });
  }

  b.step({
    kind: 'montar',
    title: 'Fija el tablero',
    summary: 'El tablero se atornilla desde abajo, dejándole libertad para moverse con la humedad.',
    detail: [
      'Pon el tablero boca abajo sobre una manta y centra la estructura encima, también boca abajo.',
      `Comprueba que el vuelo es el mismo en los cuatro lados (${mm(vu)}).`,
      'Fija una escuadra metálica con ranura por cada marca: un tornillo al faldón y otro, por la ranura, al tablero.',
      'No encoles el tablero a la estructura.',
    ],
    parts: [sobre],
    marks: marksTablero,
    technique: {
      name: 'Fijación flotante del tablero',
      why: 'Un tablero de madera maciza se hincha y encoge a lo ancho con los cambios de humedad. Si se encola o se atornilla rígido, acaba rajándose o combando la estructura; las escuadras con ranura lo sujetan y le dejan moverse.',
      how: [
        'Atornilla primero la escuadra al faldón.',
        'En el tablero, coloca el tornillo en el centro de la ranura y apriétalo solo hasta que asiente.',
      ],
    },
    hardware: [
      hw('Escuadra metálica con ranura (fijación de tableros) 30 × 30 mm', marksTablero.length),
      hw(`Tornillo para madera de cabeza redonda 4 × ${t >= 28 ? 20 : 15} mm`, marksTablero.length * 2),
    ],
    tools: ['Atornillador', 'Flexómetro'],
    warning: `El tornillo no puede atravesar el tablero: con ${t} mm de grueso, no uses tornillos de más de ${t - 5} mm de rosca dentro del tablero.`,
  });

  b.step({
    kind: 'acabar',
    title: 'Lija y protege la madera',
    summary: 'Un buen lijado y dos o tres manos de acabado son lo que separa un mueble casero de uno bien hecho.',
    detail: [
      'Mata todas las aristas con un taco de lija: una arista viva se astilla y se nota al tacto.',
      'Lija siempre a favor de la veta, pasando por granos cada vez más finos.',
      'Aspira el polvo y pasa un paño ligeramente húmedo antes de la primera mano.',
      'Aplica el acabado elegido (aceite, cera o barniz al agua) siguiendo los tiempos de secado del fabricante y lija suavemente entre manos.',
    ],
    parts: [],
    hardware: [hw('Lija de grano 80, 120 y 180', 2, 'pliegos de cada'), hw('Aceite, cera o barniz al agua para muebles', 1, 'bote')],
    tools: ['Taco de lija o lijadora orbital', 'Brocha o paño de algodón', 'Mascarilla antipolvo'],
    tip: 'Prueba el acabado en un recorte del mismo tablero antes de aplicarlo a la mesa.',
  });

  return b.finish({
    id: 'mesa',
    title: 'Mesa',
    craft: 'carpinteria',
    summary: `Mesa de ${Math.round(W / 10)} × ${Math.round(D / 10)} cm y ${Math.round(H / 10)} cm de alto${balda ? ', con balda inferior' : ''}.`,
    difficulty: union === 'espiga' ? 3 : union === 'tubillon' ? 2 : 1,
    hours: (union === 'espiga' ? 12 : union === 'tubillon' ? 7 : 5) + (balda ? 1 : 0),
    dims: [W, H, D],
    safety: [
      'Gafas de protección siempre que cortes, taladres o lijes.',
      'Mascarilla antipolvo al lijar y al cortar tablero.',
      'Sujeta la pieza con sargentos: nunca con la mano cerca de la línea de corte.',
      'Desenchufa la herramienta o quita la batería antes de cambiar la hoja o la broca.',
    ],
    notes: [
      'Las medidas de la lista de corte son finales. Compra el listón ya cepillado para no tener que regruesar.',
      ...(notaEspiga ? [notaEspiga] : []),
      ...(central.length ? ['Al superar 1,5 m de ancho se añade un travesaño central bajo el tablero.'] : []),
    ],
    spec: [
      { label: 'Medidas', value: `${W} × ${D} × ${H} mm` },
      { label: 'Pata', value: `${s} × ${s} mm` },
      { label: 'Faldón', value: `${fh} × ${FALDON_T} mm` },
      { label: 'Tablero', value: `${t} mm, vuelo de ${vu} mm` },
      { label: 'Balda inferior', value: balda ? `Sí, a ${hb} mm del suelo` : 'No' },
      { label: 'Unión', value: tec.name },
    ],
  });
}
