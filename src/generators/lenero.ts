import type { Axis, Generator, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, cordon, hw, mm, punto } from '../core/builder';
import {
  SECCIONES, TEC_PUNTEO, cordonesTope, fmtNum, fuentesSoldaduraProyecto, infoProceso, letras, pasoCordones, pasoCortar,
  pasoPintar, pasoPreparar, pasoRepasar, puntosTope, seguridadSoldadura, type Proceso,
} from './taburete-acero';

/**
 * LEÑERO (soldadura).
 * Dos bastidores laterales en U (dos postes y un travesaño abajo) unidos por largueros
 * de base sobre los que descansa la leña. Opcional: base elevada, respaldo de barras
 * redondas, estante superior de pletinas para astillas y pletinas de apoyo en los pies.
 */

const D_BARRA = 12; // redondo del respaldo (mm), decisión de diseño
const SLAT = { w: 40, t: 4 }; // pletina del estante superior
type End = 'min' | 'max';
type J = [string, End];

export const lenero: Generator = {
  id: 'lenero',
  title: 'Leñero',
  craft: 'soldadura',
  difficulty: 1,
  description:
    'Soporte de tubo para apilar leña: dos laterales en U unidos por largueros de base. Cordones cortos y repetitivos, perfecto para coger soltura.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 600, max: 2000, step: 10, unit: 'mm', default: 1000, group: 'Medidas', help: 'Largo de la pila de leña.' },
    { key: 'alto', label: 'Alto', type: 'number', min: 600, max: 1500, step: 10, unit: 'mm', default: 1000, group: 'Medidas' },
    { key: 'fondo', label: 'Fondo', type: 'number', min: 250, max: 600, step: 10, unit: 'mm', default: 400, group: 'Medidas', help: 'Algo menos que el largo de tus troncos, para que apoyen en los dos largueros.' },
    {
      key: 'base', label: 'Base', type: 'select', default: 'elevada', group: 'Forma',
      options: [
        { value: 'suelo', label: 'A ras de suelo', hint: 'Más capacidad' },
        { value: 'elevada', label: 'Elevada', hint: 'La leña no toca el suelo húmedo' },
      ],
    },
    { key: 'altoBase', label: 'Altura de la base', type: 'number', min: 100, max: 350, step: 10, unit: 'mm', default: 150, group: 'Forma', help: 'Del suelo a la cara superior de los largueros.', visible: (v) => v.base === 'elevada' },
    {
      key: 'respaldo', label: 'Trasera', type: 'select', default: 'abierto', group: 'Forma',
      options: [
        { value: 'abierto', label: 'Abierto', hint: 'Solo los dos laterales en U' },
        { value: 'barras', label: 'Respaldo de barras', hint: 'Larguero arriba y barras redondas: la pila no se cae hacia atrás' },
      ],
    },
    { key: 'estante', label: 'Estante superior para astillas', type: 'boolean', default: false, group: 'Detalles', help: 'Pletinas soldadas sobre dos largueros altos.' },
    { key: 'central', label: 'Larguero central en la base', type: 'boolean', default: true, group: 'Detalles', help: 'Un tercer apoyo para troncos cortos.' },
    { key: 'pletinas', label: 'Pies con pletina de apoyo', type: 'boolean', default: true, group: 'Detalles', help: 'Una placa bajo cada poste: reparte el peso y no se clava en la tierra.' },
    { key: 'tapones', label: 'Tapones en los extremos', type: 'boolean', default: true, group: 'Detalles', help: 'Cierran los tubos para que no entre agua.' },
    {
      key: 'seccion', label: 'Sección del tubo', type: 'select', default: '30', group: 'Material',
      options: [
        { value: '30', label: '30 × 30 × 1,5 mm', hint: 'Suficiente para leñeros pequeños' },
        { value: '40', label: '40 × 40 × 1,5 mm', hint: 'Más robusto para leñeros grandes' },
      ],
    },
    {
      key: 'proceso', label: 'Proceso de soldadura', type: 'select', default: 'electrodo', group: 'Uniones',
      options: [
        { value: 'electrodo', label: 'Electrodo revestido E6013', hint: 'Inverter MMA' },
        { value: 'hilo', label: 'Hilo tubular sin gas', hint: 'Soldadora de hilo, sin botella; bueno en exterior' },
      ],
    },
  ],
  presets: [
    { id: 'chimenea', name: 'Leñero de chimenea', blurb: 'Pequeño, 60 × 70 cm, con respaldo de barras para el salón.', values: { ancho: 600, alto: 700, fondo: 300, base: 'elevada', altoBase: 120, respaldo: 'barras', estante: false, central: false, pletinas: true, tapones: true, seccion: '30', proceso: 'electrodo' } },
    { id: 'porche', name: 'Leñero de porche', blurb: '100 × 100 cm con base elevada y estante para astillas.', values: { ancho: 1000, alto: 1000, fondo: 400, base: 'elevada', altoBase: 150, respaldo: 'barras', estante: true, central: true, pletinas: true, tapones: true, seccion: '30', proceso: 'electrodo' } },
    { id: 'exterior', name: 'Leñero de exterior', blurb: 'Grande, 180 × 120 cm, abierto y de tubo de 40 mm.', values: { ancho: 1800, alto: 1200, fondo: 450, base: 'elevada', altoBase: 200, respaldo: 'abierto', estante: false, central: true, pletinas: true, tapones: true, seccion: '40', proceso: 'hilo' } },
  ],
  build,
};

function build(v: ParamValues) {
  const W = Number(v.ancho), H = Number(v.alto), D = Number(v.fondo);
  const sec = SECCIONES[String(v.seccion)] ?? SECCIONES['30'];
  const s = sec.s, wall = sec.wall;
  const elevada = v.base === 'elevada';
  const barras = v.respaldo === 'barras';
  const estante = v.estante === true;
  const central = v.central === true;
  const conPlaca = v.pletinas === true;
  const tapones = v.tapones === true;
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);

  const PL = s + 30; // placa de apoyo
  const hBase = conPlaca ? 4 : tapones ? 3 : 0; // altura del arranque de los postes
  const Yt = H - (estante || tapones ? 4 : 0); // cara superior de los postes
  const yb = elevada ? Math.max(hBase + s + 60, Math.min(Number(v.altoBase), Yt - s - 250)) : hBase + s; // cara superior de la base
  const postLen = Yt - hBase;
  const Lz = D - 2 * s, Lx = W - 2 * s;
  const xs = [0, W - s], zs = [0, D - s];

  const L = letras();
  const b = new Builder();
  const tubo = (name: string, len: number, axis: Axis, at: Vec3) => {
    const r = L(`tubo|${s}|${wall}|${len}`, name);
    return b.tubo({ ref: r.ref, name: r.name, section: [s, s], wall, length: len, axis, at });
  };

  // --- piezas ---
  const postes: { id: string; x: number; z: number }[] = [];
  for (const x of xs) for (const z of zs) postes.push({ id: tubo('Poste', postLen, 'y', [x, hBase, z]), x, z });
  const travLat = xs.map((x) => tubo('Travesaño lateral', Lz, 'z', [x, yb - s, s]));
  const largBase = zs.map((z) => tubo('Larguero', Lx, 'x', [s, yb - s, z]));
  const largCentral = central ? [tubo('Larguero', Lx, 'x', [s, yb - s, D / 2 - s / 2])] : [];
  const largAltos: string[] = [];
  if (estante) largAltos.push(tubo('Larguero', Lx, 'x', [s, Yt - s, 0]));
  if (estante || barras) largAltos.push(tubo('Larguero', Lx, 'x', [s, Yt - s, D - s]));
  const barLen = Yt - s - yb;
  const nBar = barras ? Math.max(2, Math.ceil(Lx / 150) - 1) : 0;
  const barX = Array.from({ length: nBar }, (_, k) => s + (Lx * (k + 1)) / (nBar + 1));
  const barIds = barX.map((x) => {
    const r = L(`barra|${barLen}`, 'Barra del respaldo');
    return b.redondo({ ref: r.ref, name: r.name, material: 'acero', diameter: D_BARRA, length: barLen, axis: 'y', at: [x - D_BARRA / 2, yb, D - s / 2 - D_BARRA / 2] });
  });
  const nSlat = estante ? Math.max(3, Math.round((Lx - SLAT.w) / 75) + 1) : 0;
  const slatX = estante ? Array.from({ length: nSlat }, (_, k) => s + ((Lx - SLAT.w) * k) / (nSlat - 1)) : [];
  const slatIds = slatX.map((x) => {
    const r = L(`slat|${D}`, 'Pletina del estante');
    return b.pletina({ ref: r.ref, name: r.name, section: [SLAT.w, SLAT.t], length: D, axis: 'z', at: [x, Yt, 0] });
  });
  const placas = conPlaca
    ? postes.map((p) => {
        const r = L(`placa|${PL}`, 'Pletina de apoyo');
        return b.pletina({ ref: r.ref, name: r.name, section: [4, PL], length: PL, axis: 'x', at: [p.x - 15, 0, p.z - 15] });
      })
    : [];
  const stockTapon = `Tapón de plástico con ala para tubo cuadrado ${s}×${s} mm (pared ${fmtNum(wall)} mm)`;
  const tapon = (at: Vec3) => {
    const r = L(`tapon|${s}`, `Tapón para tubo ${s}×${s}`);
    return b.herraje({ ref: r.ref, name: r.name, size: [s, 3, s], at, stock: stockTapon });
  };
  const taponIds = tapones
    ? [...postes.map((p) => tapon([p.x, Yt, p.z])), ...(!conPlaca ? postes.map((p) => tapon([p.x, 0, p.z])) : [])]
    : [];

  // --- uniones ---
  const ends = (ids: string[]): J[] => ids.flatMap((id) => [[id, 'min'], [id, 'max']] as J[]);
  const jLat = ends(travLat), jBase = ends(largBase), jCen = ends(largCentral), jAlt = ends(largAltos), jBar = ends(barIds);
  const jPlaca: J[] = conPlaca ? postes.map((p) => [p.id, 'min'] as J) : [];
  const pts = (js: J[], lado: Axis): Mark[] => js.flatMap(([id, e]) => puntosTope(b, id, e, lado));
  const cord = (js: J[]): Mark[] => js.flatMap(([id, e]) => cordonesTope(b, id, e));
  // pletinas del estante: cordón en los dos cantos largos sobre cada larguero alto
  const slatCord: Mark[] = slatX.flatMap((x) => [0, D - s].flatMap((z) => [x, x + SLAT.w].map((xe) => cordon([xe, Yt, z], [xe, Yt, z + s]))));
  const slatPts: Mark[] = slatX.flatMap((x) => [0, D - s].map((z) => punto([x, Yt, z + s / 2])));
  const nUniones = jLat.length + jBase.length + jCen.length + jAlt.length + jBar.length + jPlaca.length + slatX.length * 2;

  // --- pasos ---
  b.step(pasoCortar({
    proceso,
    lineas: [
      `Postes: 4 tubos de ${mm(postLen)}. Travesaños laterales: 2 tubos de ${mm(Lz)}. Largueros: ${largBase.length + largCentral.length + largAltos.length} tubos de ${mm(Lx)}.`,
      ...(barras ? [`Respaldo: ${nBar} barras de redondo de Ø${D_BARRA} mm de ${mm(barLen)}.`] : []),
      ...(estante ? [`Estante: ${nSlat} pletinas de ${SLAT.w}×${SLAT.t} de ${mm(D)}.`] : []),
      ...(conPlaca ? [`Pies: 4 cuadrados de pletina de ${PL}×4 mm. Si vas a anclar el leñero, taladra ahora dos agujeros en cada uno.`] : []),
    ],
  }));

  b.step(pasoPreparar({ proceso, extra: ['Para exterior es tentador comprar tubo galvanizado: no lo hagas si vas a soldarlo. Compra tubo negro o decapado y protégelo luego con pintura.'] }));

  b.step({
    kind: 'soldar',
    title: 'Puntea los dos laterales en U',
    summary: 'Cada lateral son dos postes unidos abajo por un travesaño: se puntean tumbados sobre una superficie plana.',
    detail: [
      'Tumba dos postes sobre la mesa de soldar o un suelo plano y despejado, paralelos, y mete entre ellos el travesaño lateral a tope.',
      elevada
        ? `La cara superior del travesaño queda a ${mm(yb - hBase)} del extremo inferior de los postes (a ${mm(yb)} del suelo con los pies).`
        : `El travesaño va abajo del todo, enrasado con el extremo inferior de los postes.`,
      'Sujeta con imanes de soldador o sargentos y comprueba la escuadra de las dos esquinas.',
      ...TEC_PUNTEO.how.slice(0, 2),
      'Da la vuelta al lateral, puntea las caras opuestas y repite con el segundo usando el primero como plantilla.',
    ],
    parts: [...postes.map((p) => p.id), ...travLat],
    marks: pts(jLat, 'x'),
    technique: TEC_PUNTEO,
    tools: ['Superficie plana', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Flexómetro', 'Sargentos', info.equipo[0]],
    check: `Mide las dos diagonales de cada U (de la punta de un poste a la esquina inferior del otro): deben ser iguales. Los postes tienen que quedar paralelos: separación de ${mm(D)} por fuera arriba y abajo.`,
    warning: 'Una U es muy fácil de abrir o cerrar: si los postes no quedan paralelos, el leñero quedará en forma de abanico. Corrige antes de dar ningún cordón.',
  });

  const conjunto = [...largBase, ...largCentral, ...largAltos, ...barIds, ...slatIds, ...placas];
  b.step({
    kind: 'soldar',
    title: 'Une los laterales con los largueros',
    summary: `Los largueros de base unen las dos U${largAltos.length ? ' y los altos cierran la parte de arriba' : ''}; se añaden ${[barras && 'las barras', estante && 'las pletinas del estante', conPlaca && 'las pletinas de apoyo'].filter(Boolean).join(', ') || 'los últimos detalles'}.`,
    detail: [
      'Pon las dos U de pie, enfrentadas, sobre el suelo plano y presenta entre ellas los dos largueros de base, a ras de las caras exteriores de los postes.',
      'Puntea cada larguero por una cara, comprueba la escuadra entre larguero y poste y puntea la cara opuesta.',
      ...(central ? [`Puntea el larguero central entre los dos travesaños laterales, a ${mm(D / 2)} del frente (centro a centro).`] : []),
      ...(largAltos.length ? [`Puntea ${largAltos.length === 2 ? 'los dos largueros altos' : 'el larguero alto trasero'} entre los postes, enrasado${largAltos.length === 2 ? 's' : ''} con la punta de los postes.`] : []),
      ...(barras ? [`Reparte las ${nBar} barras del respaldo entre el larguero trasero de base y el alto, a unos ${mm(Lx / (nBar + 1))} entre ejes, centradas en el tubo, y puntea cada una arriba y abajo comprobando con el nivel que queda a plomo.`] : []),
      ...(estante ? [`Coloca las ${nSlat} pletinas del estante sobre los dos largueros altos, la primera y la última pegadas a los postes y el resto repartidas, y puntea cada una en los dos largueros.`] : []),
      ...(conPlaca ? ['Con el leñero boca abajo, puntea una pletina de apoyo centrada bajo cada poste.'] : []),
    ],
    parts: conjunto,
    marks: [...pts(jBase, 'z'), ...pts(jCen, 'y'), ...pts(jAlt, 'z'), ...pts(jBar, 'z'), ...slatPts, ...pts(jPlaca, 'x')],
    technique: TEC_PUNTEO,
    tools: ['Escuadra de acero', 'Nivel', 'Imanes de soldador a 90°', 'Sargentos', info.equipo[0]],
    check: `Pon el leñero de pie en el suelo plano: no debe cojear. Mide las diagonales en planta de la base (unos ${mm(Math.hypot(W, D))}) y comprueba que los postes están a plomo.`,
    tip: 'En las barras redondas, el punto se da en la línea donde la barra toca la cara del tubo; apunta el arco más al tubo que a la barra fina.',
  });

  b.step(pasoCordones({
    proceso,
    nUniones,
    marks: [...cord([...jLat, ...jBase, ...jCen, ...jAlt, ...jPlaca]), ...cord(jBar), ...slatCord],
    orden: [
      'Orden: empieza por las cuatro esquinas de la base (poste con travesaño y poste con larguero), cara exterior, saltando en diagonal de una esquina a la opuesta. Después las caras interiores y las de abajo con la misma ronda.',
      ...(largAltos.length ? ['Sigue con los largueros altos, alternando de un lateral al otro.'] : []),
      ...(barras ? ['Suelda las barras del respaldo alternando: una abajo, la del otro extremo arriba, y así sucesivamente; nunca todas seguidas por el mismo lado.'] : []),
      ...(estante ? ['En las pletinas del estante basta un cordón corto en cada canto sobre cada larguero; salta de una pletina a otra alejada para no calentar el larguero en un solo punto.'] : []),
      ...(conPlaca ? ['Por último, con el leñero boca abajo, suelda el contorno de cada poste sobre su pletina de apoyo.'] : []),
    ],
  }));

  b.step(pasoRepasar(estante ? ['Amola cualquier gota de soldadura que sobresalga por encima de las pletinas del estante.'] : []));

  b.step(pasoPintar({ exterior: true }));

  b.step({
    kind: 'montar',
    title: tapones ? 'Pon los tapones y coloca el leñero' : 'Coloca el leñero',
    summary: 'Cerrar los tubos y elegir bien el sitio alargan mucho la vida del leñero.',
    detail: [
      ...(tapones ? [`Mete a presión un tapón en la punta de cada poste${!conPlaca ? ' y otro en la base' : ''} con un mazo de goma.`] : ['Sin tapones, el agua entra por la punta de los postes y los oxida por dentro: tápalos de algún modo.']),
      'Colócalo sobre suelo firme y nivelado; si apoya en tierra, mejor sobre unas losas.',
      H > 1.8 * D ? 'Es alto para su fondo: ánclalo a la pared para que no vuelque al cargarlo o descargarlo de un lado.' : 'Si lo pones contra una pared, deja unos centímetros de separación para que corra el aire.',
      'Apila la leña empezando por los lados y sin pasar de la altura de los postes.',
    ],
    parts: taponIds,
    hardware: tapones ? [hw(stockTapon, taponIds.length)] : [],
    tools: ['Mazo de goma', 'Nivel'],
    check: 'Empuja el leñero vacío por arriba en todas direcciones: no debe moverse ni cojear.',
  });

  b.step({
    kind: 'acabar',
    title: 'Revisa la pintura cada temporada',
    summary: 'Un retoque a tiempo evita que el óxido se coma el tubo fino.',
    detail: [
      'Al vaciarlo, revisa los cordones y las esquinas: es donde antes salta la pintura.',
      'Lija los puntos de óxido hasta el metal, imprímalos y repinta.',
      'No quemes ni acerques al fuego el leñero: la pintura no está hecha para eso.',
    ],
    parts: [],
    tools: ['Cepillo de alambre', 'Pincel'],
    hardware: [hw('Imprimación antioxidante y esmalte para retoques', 1, 'bote')],
  });

  return b.finish({
    id: 'lenero',
    title: 'Leñero',
    craft: 'soldadura',
    summary: `Leñero de ${Math.round(W / 10)} × ${Math.round(H / 10)} cm y ${Math.round(D / 10)} cm de fondo, de tubo ${sec.label}${elevada ? ', con base elevada' : ''}${barras ? ', respaldo de barras' : ''}${estante ? ' y estante para astillas' : ''}.`,
    difficulty: 1,
    hours: 5 + (barras ? 1.5 : 0) + (estante ? 1.5 : 0) + (W > 1500 ? 0.5 : 0),
    dims: [W, H, D],
    safety: seguridadSoldadura(proceso, true),
    notes: [
      'Todas las uniones de tubo son a tope con cortes rectos: el tubo más corto apoya contra la cara del otro.',
      'Los troncos tienen que ser algo más largos que el fondo para apoyar en los dos largueros de base.',
      'No se indica carga admisible: depende de tus soldaduras. Carga la leña poco a poco y por igual a ambos lados.',
      'Las secciones de tubo y el diámetro de las barras son decisiones de diseño; compruébalos en tu almacén de hierros.',
    ],
    sources: fuentesSoldaduraProyecto(proceso),
    spec: [
      { label: 'Medidas', value: `${W} × ${H} × ${D} mm (ancho × alto × fondo)` },
      { label: 'Tubo', value: sec.label },
      { label: 'Base', value: elevada ? `Elevada, a ${yb} mm` : 'A ras de suelo' },
      { label: 'Trasera', value: barras ? `Respaldo de ${nBar} barras Ø${D_BARRA} mm` : 'Abierta' },
      { label: 'Estante superior', value: estante ? `Sí, ${nSlat} pletinas` : 'No' },
      { label: 'Larguero central', value: central ? 'Sí' : 'No' },
      { label: 'Pies', value: conPlaca ? `Pletina de apoyo ${PL} × ${PL} mm` : tapones ? 'Tapones' : 'Tubo directo' },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}
