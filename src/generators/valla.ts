import type { Generator, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, alturaArco, cordonPerimetral, hw, mm, punto, tornillos } from '../core/builder';
import { TEC_PUNTEO, infoProceso, pasoCordones, pasoCortar, pasoPreparar, pasoRepasar, pieza, type Proceso } from './taburete-acero';
import {
  ACABADOS, BARROTES, NOTA_PUNTAS, OPC_BARROTE, OPC_REMATE, PARAM_FORJA, PARAM_PROCESO, TUBOS, barrote, bolaSobre, cordJ, cordonAnillo,
  cordonesDeco, ends, filaVolutas, frisoAros, fuentesForja, herramientasDeco, letrasForja, medidaFrisoAros, paramAcabado, pasoPintarForja,
  ptsJ, puntaSobre, puntos, r1, reparto, seguridadForja, tecDecoracion, tuboQ, type Forja, type J, type ModoForja, type Remate,
} from './puerta-verja';

/**
 * VALLA (soldadura, cerrajería).
 * Tramos modulares entre postes que se comparten: barrotes verticales (con remate recto,
 * pasante, alterno u ondulado), lamas horizontales de tubo rectangular o marco con malla
 * electrosoldada. Detalles de forja: puntas o pinchos, volutas o friso de aros en la parte
 * baja, remate de postes y placas de anclaje o postes para empotrar.
 */

const PLACA_T = 8;
const ARRIBA = 40; // lo que sube el poste por encima del travesaño superior

export const valla: Generator = {
  id: 'valla',
  title: 'Valla',
  craft: 'soldadura',
  difficulty: 2,
  description:
    'Tramos de valla o cerramiento entre postes, repetibles: de barrotes, de lamas o de malla. Desde la valla lisa hasta la verja clásica con lanzas y volutas.',
  params: [
    { key: 'largo', label: 'Largo de cada tramo', type: 'number', min: 1000, max: 2500, step: 10, unit: 'mm', default: 2000, group: 'Medidas', help: 'Luz libre entre las caras de dos postes.' },
    { key: 'alto', label: 'Alto de los postes', type: 'number', min: 600, max: 2000, step: 10, unit: 'mm', default: 1200, group: 'Medidas', help: 'Desde el suelo, sin contar el remate del poste. Las lanzas y puntas suben por encima.' },
    { key: 'tramos', label: 'Nº de tramos', type: 'number', min: 1, max: 3, step: 1, unit: 'ud', default: 1, group: 'Medidas', help: 'Los tramos contiguos comparten poste.' },
    { key: 'hueco', label: 'Hueco máximo entre barrotes', type: 'number', min: 80, max: 160, step: 5, unit: 'mm', default: 110, group: 'Medidas', visible: (v) => v.forma === 'barrotes', help: 'Hueco libre entre barrotes; el nº de barrotes se recalcula para no pasar de él. Si hay niños pequeños cerca, uno estrecho evita que metan la cabeza; consulta la normativa de tu municipio.' },
    {
      key: 'forma', label: 'Tipo de valla', type: 'select', default: 'barrotes', group: 'Forma',
      options: [
        { value: 'barrotes', label: 'Barrotes verticales', hint: 'La verja clásica' },
        { value: 'lamas', label: 'Lamas horizontales', hint: 'Tubo rectangular, más opaca' },
        { value: 'malla', label: 'Marco con malla', hint: 'La más sencilla y barata' },
      ],
    },
    {
      key: 'remate', label: 'Remate de los barrotes', type: 'select', default: 'recto', group: 'Forma', visible: (v) => v.forma === 'barrotes',
      options: [
        { value: 'recto', label: 'Recto', hint: 'Acaban bajo el travesaño superior' },
        { value: 'pasante', label: 'Pasantes', hint: 'Sobrepasan el travesaño, todos iguales' },
        { value: 'alterno', label: 'Alternos', hint: 'Uno alto, uno bajo' },
        { value: 'arco', label: 'Ondulado en arco', hint: 'Más altos en el centro del tramo' },
        { value: 'concavo', label: 'Ondulado en festón', hint: 'Más bajos en el centro del tramo' },
      ],
    },
    { key: 'sobresale', label: 'Altura de los barrotes pasantes', type: 'number', min: 60, max: 300, step: 10, unit: 'mm', default: 150, group: 'Forma', help: 'Lo que sobresale el barrote más bajo por encima del travesaño.', visible: (v) => v.forma === 'barrotes' && v.remate !== 'recto' },
    { key: 'flecha', label: 'Ondulación', type: 'number', min: 50, max: 300, step: 10, unit: 'mm', default: 150, group: 'Forma', help: 'Diferencia entre el barrote más alto y el más bajo.', visible: (v) => v.forma === 'barrotes' && (v.remate === 'arco' || v.remate === 'concavo') },
    { key: 'huecoLamas', label: 'Separación entre lamas', type: 'number', min: 10, max: 80, step: 5, unit: 'mm', default: 25, group: 'Forma', visible: (v) => v.forma === 'lamas' },
    { key: 'suelo', label: 'Separación del suelo', type: 'number', min: 30, max: 200, step: 10, unit: 'mm', default: 80, group: 'Forma', help: 'Hueco bajo el travesaño inferior (o la primera lama).' },
    { key: 'puntas', label: 'Puntas', type: 'select', default: 'ninguno', group: 'Detalles', options: OPC_REMATE, visible: (v) => v.forma === 'barrotes', help: 'Centradas sobre cada barrote.' },
    {
      key: 'decoBaja', label: 'Decoración en la parte baja', type: 'select', default: 'no', group: 'Detalles', visible: (v) => v.forma === 'barrotes',
      options: [
        { value: 'no', label: 'Ninguna' },
        { value: 'volutas', label: 'Volutas entre barrotes' },
        { value: 'aros', label: 'Friso de aros' },
      ],
    },
    {
      key: 'tipoVoluta', label: 'Tipo de voluta', type: 'select', default: 'C', group: 'Detalles', visible: (v) => v.forma === 'barrotes' && v.decoBaja === 'volutas',
      options: [{ value: 'C', label: 'En C' }, { value: 'S', label: 'En S' }],
    },
    {
      key: 'remPoste', label: 'Remate de los postes', type: 'select', default: 'tapa', group: 'Detalles',
      options: [
        { value: 'tapon', label: 'Tapón de plástico' },
        { value: 'tapa', label: 'Tapa de pletina soldada' },
        { value: 'bola', label: 'Bola de forja' },
      ],
    },
    {
      key: 'anclaje', label: 'Fijación de los postes', type: 'select', default: 'placa', group: 'Detalles',
      options: [
        { value: 'placa', label: 'Placa de anclaje con taladros', hint: 'Sobre murete o solera de hormigón' },
        { value: 'empotrar', label: 'Postes para empotrar', hint: 'En dados de hormigón' },
      ],
    },
    {
      key: 'poste', label: 'Tubo de los postes', type: 'select', default: '60', group: 'Material',
      options: [{ value: '60', label: '60 × 60 × 2 mm' }, { value: '80', label: '80 × 80 × 2 mm', hint: 'Vallas altas o tramos largos' }],
    },
    {
      key: 'travesano', label: 'Tubo de los travesaños', type: 'select', default: '40', group: 'Material', visible: (v) => v.forma !== 'lamas',
      options: [{ value: '40', label: '40 × 40 × 1,5 mm' }, { value: '40g', label: '40 × 40 × 2 mm' }],
    },
    { key: 'barrote', label: 'Barrotes', type: 'select', default: 'cuad12', group: 'Material', options: OPC_BARROTE, visible: (v) => v.forma === 'barrotes' },
    {
      key: 'lama', label: 'Lamas', type: 'select', default: '60x20', group: 'Material', visible: (v) => v.forma === 'lamas',
      options: [{ value: '60x20', label: 'Tubo 60 × 20 × 1,5 mm' }, { value: '80x20', label: 'Tubo 80 × 20 × 1,5 mm' }],
    },
    {
      key: 'malla', label: 'Malla', type: 'select', default: '50', group: 'Material', visible: (v) => v.forma === 'malla',
      options: [{ value: '50', label: 'Cuadro de 50 mm, alambre de 4 mm' }, { value: '100', label: 'Cuadro de 100 mm, alambre de 4 mm' }],
    },
    paramAcabado('negro'),
    { ...PARAM_FORJA, visible: (v) => v.forma === 'barrotes' },
    PARAM_PROCESO,
  ],
  presets: [
    {
      id: 'lisa', name: 'Valla lisa de barrotes', blurb: 'Un tramo de 2 m × 1 m con barrotes rectos entre dos travesaños: la base de cualquier cerramiento.',
      values: { largo: 2000, alto: 1000, tramos: 1, hueco: 110, forma: 'barrotes', remate: 'recto', suelo: 80, puntas: 'ninguno', decoBaja: 'no', remPoste: 'tapa', anclaje: 'placa', poste: '60', travesano: '40', barrote: 'cuad16', acabado: 'antracita', forja: 'comprada', proceso: 'electrodo' },
    },
    {
      id: 'lamas', name: 'Valla de lamas', blurb: 'Dos tramos de 1,8 m con lamas de tubo 80 × 20: da intimidad y un aire moderno.',
      values: { largo: 1800, alto: 1400, tramos: 2, forma: 'lamas', huecoLamas: 25, suelo: 60, remPoste: 'tapa', anclaje: 'placa', poste: '60', lama: '80x20', acabado: 'antracita', proceso: 'hilo' },
    },
    {
      id: 'clasica', name: 'Verja clásica con lanzas y volutas', blurb: 'Barrotes ondulados en arco con puntas de lanza, volutas en C abajo y bolas en los postes.',
      values: { largo: 1800, alto: 1300, tramos: 2, hueco: 105, forma: 'barrotes', remate: 'arco', sobresale: 110, flecha: 170, suelo: 80, puntas: 'lanza', decoBaja: 'volutas', tipoVoluta: 'C', remPoste: 'bola', anclaje: 'placa', poste: '80', travesano: '40g', barrote: 'cuad12', acabado: 'negro', forja: 'comprada', proceso: 'electrodo' },
    },
  ],
  build,
};

function build(v: ParamValues) {
  const Lt = Number(v.largo), Hp = Number(v.alto), nT = Math.round(Number(v.tramos)), hmax = Number(v.hueco);
  const forma = String(v.forma) as 'barrotes' | 'lamas' | 'malla';
  const remSel = String(v.remate) as 'recto' | 'pasante' | 'alterno' | 'arco' | 'concavo';
  const Lsob = Number(v.sobresale), flecha = Number(v.flecha), gapL = Number(v.huecoLamas), suelo = Number(v.suelo);
  const puntasSel = (forma === 'barrotes' ? String(v.puntas) : 'ninguno') as Remate;
  let decoBaja = forma === 'barrotes' ? String(v.decoBaja) : 'no';
  const tipoVol = v.tipoVoluta === 'S' ? 'S' : 'C';
  const remPoste = String(v.remPoste);
  const placa = v.anclaje !== 'empotrar';
  const pt = TUBOS[String(v.poste)] ?? TUBOS['60'];
  const P = pt.s;
  const tr = TUBOS[String(v.travesano)] ?? TUBOS['40'];
  const s = tr.s, wall = tr.wall;
  const sp = BARROTES[String(v.barrote)] ?? BARROTES.cuad12;
  const d = sp.d;
  const lamaH = v.lama === '80x20' ? 80 : 60, lamaT = 20;
  const cell = v.malla === '100' ? 100 : 50;
  const acabado = String(v.acabado);
  const modo: ModoForja = v.forja === 'curvada' ? 'curvada' : 'comprada';
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);

  const b = new Builder();
  const f: Forja = { b, L: letrasForja(), modo };
  const zc = P / 2;
  const yP = placa ? PLACA_T : 0;
  const postTop = Hp;
  const yT = Hp - ARRIBA; // cara superior del travesaño superior
  const yB = suelo; // cara inferior del travesaño inferior
  const postX = Array.from({ length: nT + 1 }, (_, k) => k * (P + Lt));
  const W = nT * Lt + (nT + 1) * P;

  // --- postes ---
  const postes = postX.map((x) => {
    const id = tuboQ(f, P, pt.wall, 'Poste', postTop - yP, 'y', [x, yP, 0]);
    if (!placa) pieza(b, id).note = 'Medida vista sobre el suelo. Córtalo más largo: lo que se empotra lo decide quien haga el dado de hormigón, según el terreno y la altura de la valla.';
    return id;
  });

  // --- tramos ---
  const rails: string[] = [], jRails: J[] = [];
  const lamas: string[] = [], jLamas: J[] = [];
  const bars: string[] = [], jBars: J[] = [];
  const mallas: string[] = [];
  const mallaP: Mark[] = [];
  const deco: string[] = [];
  const decoC: Vec3[] = [];
  const remates: string[] = [], jRem: J[] = [];
  const puntasC: Mark[] = [];
  let nBar = 0, g = 0, nVol = 0, nAro = 0, nFriso = 0, nPuntas = 0, nLamas = 0, gapLr = 0;
  let friso = decoBaja === 'aros';
  const fA = medidaFrisoAros(Lt, Math.max(90, Math.min(150, hmax * 1.05)));
  if (friso && yT - s - (yB + s + fA.alto + s) < 200) { friso = false; decoBaja = 'no'; }
  const barBot = friso ? yB + s + fA.alto + s : yB + s;
  const barTop = yT - s;
  const regionH = barTop - barBot;
  const rise = Math.max(0, Math.min(flecha, Lt * 0.25));
  let maxSob = 0;

  for (let t = 0; t < nT; t++) {
    const xa = postX[t] + P, xb = postX[t + 1];
    if (forma === 'lamas') {
      const H = yT - yB;
      const n = Math.max(2, Math.floor((H + gapL) / (lamaH + gapL)));
      const gr = n > 1 ? (H - n * lamaH) / (n - 1) : 0;
      nLamas = n; gapLr = gr;
      for (let i = 0; i < n; i++) {
        const r = f.L(`lama|${lamaH}|${r1(Lt)}`, 'Lama');
        const id = b.tubo({ ref: r.ref, name: r.name, section: [lamaH, lamaT], wall: 1.5, length: Lt, axis: 'x', at: [xa, yB + i * (lamaH + gr), zc - lamaT / 2] });
        lamas.push(id); jLamas.push([id, 'min'], [id, 'max']);
      }
      continue;
    }
    const rail = (y: number) => {
      const id = tuboQ(f, s, wall, 'Travesaño', Lt, 'x', [xa, y, zc - s / 2]);
      rails.push(id); jRails.push([id, 'min'], [id, 'max']);
    };
    rail(yB); rail(yT - s);
    if (forma === 'malla') {
      const r = f.L(`malla|${cell}|${r1(Lt)}`, 'Paño de malla');
      const hM = yT - s - (yB + s);
      mallas.push(b.malla({ ref: r.ref, name: r.name, face: [Lt, hM], normal: 'z', cell, wire: 4, at: [xa, yB + s, zc - 2] }));
      const nx = Math.max(2, Math.round(Lt / 200)), ny = Math.max(2, Math.round(hM / 200));
      for (let i = 0; i <= nx; i++) mallaP.push(punto([xa + (Lt * i) / nx, yB + s, zc]), punto([xa + (Lt * i) / nx, yT - s, zc]));
      for (let j = 1; j < ny; j++) mallaP.push(punto([xa, yB + s + (hM * j) / ny, zc]), punto([xb, yB + s + (hM * j) / ny, zc]));
      continue;
    }
    // barrotes
    if (friso) rail(yB + s + fA.alto);
    const rp = reparto(xa, xb, d, hmax);
    nBar = rp.xs.length; g = rp.g;
    for (const x of rp.xs) {
      const id = barrote(f, sp, 'Barrote', regionH, x, barBot, zc);
      bars.push(id); jBars.push([id, 'min'], [id, 'max']);
    }
    if (friso) {
      const out = frisoAros(f, { xa, xb, y0: yB + s, n: fA.n, zc });
      deco.push(...out.ids); decoC.push(...out.contactos); nFriso += fA.n;
    }
    if (decoBaja === 'volutas') {
      const hv = Math.min(g * 2.6, regionH * 0.45);
      if (hv >= g * 0.8) {
        const out = filaVolutas(f, { xa, xb, xs: rp.xs, d, yRail: barBot, anchor: 'bottom', hv, tipo: tipoVol, zc });
        deco.push(...out.ids); decoC.push(...out.contactos); nVol += out.nVol; nAro += out.nAro;
      }
    }
    // remate
    const xcs = rp.xs.map((x) => x + d / 2);
    const nb = xcs.length;
    xcs.forEach((xc, i) => {
      let L = 0;
      if (remSel === 'pasante') L = Lsob;
      else if (remSel === 'alterno') L = (nb % 2 === 1 ? i % 2 === 0 : i % 2 === 1) ? Lsob : Math.round(Lsob * 0.6);
      else if (remSel === 'arco') L = Lsob + alturaArco(xc - xa, Lt, rise);
      else if (remSel === 'concavo') L = Lsob + rise - alturaArco(xc - xa, Lt, rise);
      L = r1(L);
      maxSob = Math.max(maxSob, L);
      if (L > 0) {
        const id = barrote(f, sp, 'Lanza', L, xc - d / 2, yT, zc);
        remates.push(id); jRem.push([id, 'min'], [id, 'max']);
      }
      if (puntasSel !== 'ninguno') {
        remates.push(puntaSobre(f, puntasSel, d, xc, yT + L, zc)); nPuntas++;
        if (L === 0) {
          const base = puntasSel === 'lanza' ? Math.max(24, d * 2) : d;
          puntasC.push(...cordonPerimetral([xc, yT, zc], 'y', base, base));
        }
      }
    });
  }

  // --- placas y remates de los postes ---
  const placas: string[] = [], caps: string[] = [];
  const capC: Mark[] = [];
  const jPlacas: J[] = [];
  const anclajes: Vec3[] = [];
  const PL = P + 140;
  postX.forEach((x, k) => {
    if (placa) {
      const r = f.L(`placa|${PL}`, 'Placa de anclaje');
      placas.push(b.pletina({ ref: r.ref, name: r.name, section: [PLACA_T, PL], length: PL, axis: 'x', at: [x + P / 2 - PL / 2, 0, zc - PL / 2] }));
      jPlacas.push([postes[k], 'min']);
      const o = PL / 2 - 25;
      for (const [dx, dz] of [[-o, -o], [o, -o], [-o, o], [o, o]]) anclajes.push([x + P / 2 + dx, PLACA_T, zc + dz]);
    }
    if (remPoste === 'bola') {
      caps.push(bolaSobre(f, P + 20, x + P / 2, postTop, zc, 'Bola de poste', `Bola de forja Ø${P + 20} mm (para tubo de ${P} mm)`));
      capC.push(...cordonAnillo([x + P / 2, postTop, zc], P * 0.85));
    } else if (remPoste === 'tapa') {
      const r = f.L(`tapa|${P}`, 'Tapa del poste');
      caps.push(b.pletina({ ref: r.ref, name: r.name, section: [4, P + 10], length: P + 10, axis: 'x', at: [x - 5, postTop, -5] }));
      capC.push(...cordonPerimetral([x + P / 2, postTop, zc], 'y', P, P));
    } else {
      const r = f.L(`tapon|${P}`, `Tapón para tubo ${P}×${P}`);
      caps.push(b.herraje({ ref: r.ref, name: r.name, size: [P, 3, P], at: [x, postTop, 0], stock: `Tapón de plástico con ala para tubo cuadrado ${P}×${P} mm` }));
    }
  });

  // --- pasos ---
  const totBar = bars.length;
  b.step(pasoCortar({
    proceso,
    lineas: [
      `Postes: ${postes.length} tubos ${pt.label} de ${mm(postTop - yP)}${placa ? '' : ' vistos (córtalos más largos lo que haya que empotrar)'}.`,
      ...(forma === 'lamas'
        ? [`Lamas: ${lamas.length} tubos ${lamaH} × ${lamaT} × 1,5 mm de ${mm(Lt)} (${nLamas} por tramo).`]
        : [`Travesaños: ${rails.length} tubos ${tr.label} de ${mm(Lt)}.`]),
      ...(forma === 'barrotes' ? [`Barrotes: ${totBar} de ${mm(regionH)} en ${sp.label.toLowerCase()} (${nBar} por tramo, hueco libre de ${mm(g)}).`] : []),
      ...(remates.some((id) => pieza(b, id).shape !== 'cone') ? [`Lanzas: trozos del mismo barrote que se sueldan a tope sobre el travesaño superior; ${remSel === 'pasante' ? `todos de ${mm(Lsob)}` : 'cada uno con su largo (míralo en la lista de piezas); numéralos según los cortes'}.`] : []),
      ...(forma === 'malla' ? [`Malla: ${mallas.length} paños de ${mm(Lt)} × ${mm(yT - s - yB - s)}. Córtala con cizalla o amoladora justo después de un alambre transversal.`] : []),
      ...(placa ? [`Placas: ${placas.length} cuadrados de ${PL} × ${PL} × ${PLACA_T} mm con un taladro en cada esquina a 25 mm de los bordes (del diámetro que pida el anclaje que vayas a usar).`] : []),
    ],
  }));
  b.step(pasoPreparar({ proceso, extra: ['Compra tubo y barra negros o decapados, no galvanizados: la valla irá pintada.'] }));

  const hayDeco = deco.length > 0;
  if (modo === 'curvada' && hayDeco) {
    b.step({
      kind: 'preparar',
      title: 'Curva las volutas y los aros',
      summary: 'Fabrica todas las piezas curvas iguales entre sí con una plantilla antes de soldar.',
      detail: [
        ...(nVol ? [`Dibuja a tamaño real la voluta con la medida exterior de la lista de piezas y fabrica su plantilla. Necesitas ${nVol}.`] : []),
        ...(nFriso + nAro ? [`Aros: ${nFriso + nAro}. Curva un muelle largo de pletina alrededor de un tubo que haga de mandril, córtalos uno a uno y ciérralos con un punto.`] : []),
        'Coloca cada pieza sobre el dibujo y corrígela antes de seguir.',
      ],
      parts: [],
      technique: tecDecoracion('curvada'),
      tools: herramientasDeco('curvada'),
      check: 'Apila las piezas iguales: deben coincidir.',
      warning: 'La barra puede saltar de la plantilla: gafas, guantes y plantilla bien sujeta.',
    });
  }

  const diag = Math.round(Math.hypot(Lt + 2 * P, Hp));
  if (forma === 'lamas') {
    const extremos = lamas.filter((_, i) => i % nLamas === 0 || i % nLamas === nLamas - 1);
    const resto = lamas.filter((id) => !extremos.includes(id));
    b.step({
      kind: 'soldar',
      title: 'Puntea los postes con la primera y la última lama',
      summary: 'Postes y lamas de los extremos forman un bastidor que se puntea tumbado y se escuadra.',
      detail: [
        'Tumba los postes en el suelo plano del taller, paralelos y calzados a la misma altura.',
        `Mete entre cada pareja la lama de abajo, a ${mm(yB - yP)} del pie del poste, y la de arriba, con su cara superior a ${mm(yT - yP)} del pie.`,
        ...TEC_PUNTEO.how.slice(0, 2),
      ],
      parts: [...postes, ...extremos],
      marks: ptsJ(b, ends(extremos), 'y'),
      technique: TEC_PUNTEO,
      tools: ['Suelo plano', 'Calzos', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', 'Flexómetro', info.equipo[0]],
      check: `Mide las diagonales de cada tramo (unos ${mm(diag)} de esquina a esquina de los postes): deben ser iguales.`,
      warning: 'Solo puntos: nada de cordones hasta que todo esté escuadrado.',
    });
    b.step({
      kind: 'soldar',
      title: 'Reparte y puntea el resto de lamas',
      summary: `${nLamas} lamas por tramo con ${mm(gapLr)} de separación, repartidas con galgas.`,
      detail: [
        `Corta dos galgas de ${mm(gapLr)} (tacos de madera o pletina) y ve colocando las lamas desde abajo: lama, galgas en los dos extremos, lama…`,
        'Puntea cada lama a los dos postes por arriba y por abajo, comprobando que queda paralela a la anterior.',
      ],
      parts: resto,
      marks: ptsJ(b, ends(resto), 'y'),
      technique: TEC_PUNTEO,
      tools: ['Galgas de separación', 'Escuadra', 'Nivel', info.equipo[0]],
      check: 'Mira el tramo desde un extremo: todas las lamas deben verse paralelas y con la misma separación.',
    });
  } else {
    b.step({
      kind: 'soldar',
      title: 'Puntea los postes y los travesaños en plano',
      summary: `Los ${postes.length} postes y los travesaños forman el bastidor de la valla, que se puntea tumbado comprobando las diagonales.`,
      detail: [
        'Tumba los postes en el suelo plano del taller, paralelos y calzados a la misma altura, con la separación del largo del tramo.',
        `Mete los travesaños a tope entre cada pareja de postes: el inferior a ${mm(yB - yP)} del pie del poste, el superior con su cara de arriba a ${mm(yT - yP)}${friso ? `, y el del friso ${mm(fA.alto)} por encima del inferior` : ''}. Todos centrados en el grueso del poste.`,
        ...TEC_PUNTEO.how.slice(0, 2),
        'Da la vuelta al bastidor y puntea las caras opuestas.',
      ],
      parts: [...postes, ...rails],
      marks: ptsJ(b, jRails),
      technique: TEC_PUNTEO,
      tools: ['Suelo plano', 'Calzos', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', 'Flexómetro', info.equipo[0]],
      check: `Mide las diagonales de cada tramo (unos ${mm(diag)} de esquina a esquina de los postes): deben ser iguales, y los postes, paralelos.`,
      warning: 'Solo puntos: nada de cordones hasta que todo esté escuadrado.',
    });
    if (forma === 'malla') {
      b.step({
        kind: 'soldar',
        title: 'Presenta y puntea la malla',
        summary: 'Cada paño de malla se centra en el hueco y se puntea a travesaños y postes.',
        detail: [
          'Presenta el paño centrado en el grueso del tubo, con un alambre transversal pegado a cada travesaño.',
          'Puntea primero las cuatro esquinas, tensa la malla tirando con unas tenazas y puntea el resto de alambres que tocan el tubo, saltando de un lado a otro.',
          'Apunta el arco al tubo y acércate al alambre solo al final: el alambre fino se funde enseguida.',
        ],
        parts: mallas,
        marks: mallaP,
        technique: TEC_PUNTEO,
        tools: ['Tenazas', 'Pinzas de presión', 'Cizalla o amoladora', info.equipo[0]],
        check: 'La malla debe quedar plana, sin bolsas, y sin alambres sueltos en los bordes.',
        warning: 'Los extremos de alambre cortado pinchan: guantes siempre y amóllalos después.',
      });
    } else {
      b.step({
        kind: 'soldar',
        title: 'Reparte y puntea los barrotes',
        summary: `${nBar} barrotes por tramo con un hueco libre de ${mm(g)}, repartidos con una galga.`,
        detail: [
          `Corta una galga de separación de ${mm(g)} exactos (un taco de madera o un trozo de pletina).`,
          'En cada tramo, reparte desde los postes hacia el centro: poste, galga, barrote, galga… y puntea cada barrote arriba y abajo por la cara delantera, a plomo.',
          'Da la vuelta al bastidor y puntea también la cara trasera de cada barrote.',
        ],
        parts: bars,
        marks: ptsJ(b, jBars),
        technique: TEC_PUNTEO,
        tools: ['Galga de separación', 'Escuadra de acero', 'Nivel', 'Pinzas de presión', info.equipo[0]],
        check: 'Mira cada tramo desde un extremo, a ras: todos los barrotes en fila, ninguno adelantado o torcido.',
        tip: 'Apunta el arco más al barrote macizo que a la pared fina del travesaño.',
      });
    }
  }

  const jFrame = forma === 'lamas' ? jLamas : [...jRails, ...jBars];
  b.step(pasoCordones({
    proceso,
    nUniones: jFrame.length,
    marks: [...cordJ(b, jFrame), ...(forma === 'malla' ? mallaP : [])],
    orden: [
      'Empieza por las uniones de los travesaños (o lamas) con los postes, cara delantera, saltando de un tramo a otro y de arriba abajo.',
      ...(forma === 'barrotes' ? ['Sigue con los barrotes alternando: uno de un extremo, otro del extremo contrario, otro del centro… nunca todos seguidos por el mismo lado.'] : []),
      ...(forma === 'malla' ? ['La malla no lleva cordones: basta repasar los puntos que hayan quedado flojos.'] : []),
      'Mantén el bastidor sujeto al suelo con pesos o sargentos mientras sueldas y hasta que se enfríe; después las caras de detrás.',
    ],
  }));

  if (hayDeco) {
    b.step({
      kind: 'soldar',
      title: 'Presenta y suelda las decoraciones',
      summary: `${[nVol && `${nVol} volutas en ${tipoVol}`, nAro && `${nAro} aros`, nFriso && `un friso de ${nFriso} aros`].filter(Boolean).join(' y ').replace(/^./, (c) => c.toUpperCase())}: cada pieza apoya en dos barrotes o en barrote y travesaño.`,
      detail: [
        ...(nVol ? [`Cada voluta ocupa un hueco de ${mm(g)} entre barrotes, apoyada sobre el travesaño de abajo. Las de la mitad izquierda de cada tramo van al revés que las de la derecha para que el dibujo sea simétrico${nAro ? '; el hueco central lleva un aro' : ''}.`] : []),
        ...(nFriso ? [`Friso: ${fA.n} aros de Ø${mm(fA.d)} por tramo; cada uno toca los dos travesaños del friso y a sus vecinos. Empieza por el centro del tramo.`] : []),
        'Puntea todas, mira la valla de pie desde unos metros y corrige lo que se vea desigual. Después, un cordón corto por delante y otro por detrás en cada contacto.',
      ],
      parts: deco,
      marks: [...puntos(decoC), ...cordonesDeco(decoC)],
      technique: tecDecoracion(modo),
      tools: [...herramientasDeco(modo), info.equipo[0]],
      check: 'Ninguna voluta debe atravesar un barrote ni quedar en el aire: todas tocan por al menos dos sitios.',
      warning: 'La barra de forja es fina: arco corto y el calor apuntado al barrote o al travesaño.',
    });
  }

  if (remates.length) {
    const jR = jRem;
    b.step({
      kind: 'soldar',
      title: jR.length ? (nPuntas ? 'Suelda las lanzas y sus puntas' : 'Suelda las lanzas') : 'Suelda las puntas',
      summary: jR.length
        ? `Los barrotes se prolongan por encima del travesaño${remSel === 'arco' || remSel === 'concavo' ? ' siguiendo una curva' : remSel === 'alterno' ? ', uno alto y uno bajo' : ''}${nPuntas ? ` y se rematan con ${nPuntas} ${puntasSel === 'lanza' ? 'puntas de lanza' : 'pinchos'}` : ''}.`
        : `${nPuntas} ${puntasSel === 'lanza' ? 'puntas de lanza' : 'pinchos'} centrados sobre el travesaño superior, en la vertical de cada barrote.`,
      detail: [
        ...(jR.length ? [
          'Suelda a tope cada trozo de barrote sobre el travesaño superior, en la vertical exacta del barrote de abajo: apoya una regla en el barrote para alinearlo.',
          ...(remSel === 'arco' || remSel === 'concavo' ? ['Para que la curva salga suave, tensa un listón flexible entre las lanzas de los extremos y la del centro y comprueba que todas las cabezas lo tocan antes de soldar las puntas.'] : []),
        ] : []),
        ...(nPuntas ? ['Presenta cada punta centrada (marca el centro de la testa con dos diagonales), compruébala a plomo por dos caras, puntéala y suelda la base con un cordón corto alrededor.'] : []),
        NOTA_PUNTAS,
      ],
      parts: remates,
      marks: [...ptsJ(b, jR), ...cordJ(b, jR), ...puntasC],
      tools: ['Regla de acero', 'Listón flexible', 'Nivel pequeño', 'Pinzas de presión', info.equipo[0]],
      check: 'Mira la fila de puntas desde un extremo: todas en línea y a plomo.',
      warning: nPuntas ? 'Las puntas pinchan y cortan: mueve la valla con guantes. Antes de instalarlas, consulta la normativa de tu ayuntamiento.' : undefined,
    });
  }

  b.step({
    kind: 'soldar',
    title: placa ? 'Suelda las placas y los remates de los postes' : 'Remata los postes',
    summary: `${placa ? 'Cada poste recibe su placa de anclaje y' : 'Cada poste recibe'} ${remPoste === 'bola' ? 'una bola de forja' : remPoste === 'tapa' ? 'una tapa de pletina' : 'su tapón'} arriba, para que no entre agua.`,
    detail: [
      ...(placa ? ['Con la valla tumbada, presenta cada placa centrada y a escuadra en el pie del poste y suéldala alrededor de todo el contorno.'] : ['Los postes para empotrar no llevan placa: la parte enterrada queda dentro del dado de hormigón.']),
      remPoste === 'bola' ? 'Asienta una bola de forja centrada sobre la boca de cada poste y suéldala alrededor.' : remPoste === 'tapa' ? 'Suelda una tapa de pletina sobre la boca de cada poste, alrededor del contorno; amola el sobrante después.' : 'Los tapones de plástico se ponen al final, después de pintar.',
    ],
    parts: [...placas, ...caps],
    marks: [...cordJ(b, jPlacas), ...capC],
    tools: ['Escuadra', 'Sargentos', info.equipo[0]],
    check: 'Pon la valla de pie: debe apoyar en todas las placas sin cojear y con los postes a plomo.',
  });

  b.step(pasoRepasar([
    'Repasa con el disco de láminas los cordones vistos de los travesaños.',
    ...(hayDeco ? ['En las volutas y aros no amoles: cepillo de alambre pequeño y repasa solo las gotas que sobresalgan.'] : []),
    ...(forma === 'malla' ? ['Amola las puntas de alambre que sobresalgan de los bordes de la malla.'] : []),
  ]));

  b.step(pasoPintarForja(acabado));

  b.step({
    kind: 'acabar',
    title: placa ? 'Ancla la valla' : 'Empotra los postes',
    summary: placa ? 'La valla se presenta a plomo sobre el murete o la solera y se atornilla con anclajes para hormigón.' : 'Los postes se aploman en sus dados de hormigón con la valla arriostrada hasta que fragüe.',
    detail: [
      ...(placa ? [
        'Presenta la valla en su sitio entre dos personas, calzada si el suelo no está nivelado, y aploma los postes en las dos direcciones.',
        `Marca los ${anclajes.length} taladros de las placas, aparta la valla, taladra con el diámetro y la profundidad que indique el fabricante del anclaje y fija las placas.`,
      ] : [
        'Haz los hoyos y los dados con las medidas que te indique quien conozca el terreno, mete los postes, aplómalos y arriostra la valla con listones hasta que fragüe.',
      ]),
      ...(remPoste === 'tapon' ? ['Mete a presión un tapón en la boca de cada poste.'] : []),
      'Retoca la pintura de los roces del montaje.',
    ],
    parts: [],
    marks: anclajes.length ? tornillos(anclajes, 'y') : undefined,
    hardware: [
      ...(placa ? [hw('Anclaje para hormigón (taco químico o de expansión) del diámetro que admitan los taladros de la placa; elige tipo y métrica con el fabricante según tu soporte', anclajes.length)] : [hw('Hormigón o mortero para los dados de los postes', postes.length, 'sacos (o lo que pida cada hoyo)')]),
      ...(remPoste === 'tapon' ? [hw(`Tapón de plástico con ala para tubo cuadrado ${P}×${P} mm`, postes.length)] : []),
      hw('Esmalte del mismo color para retoques', 1, 'bote pequeño'),
    ],
    tools: placa ? ['Taladro percutor con broca para hormigón', 'Nivel', 'Llave para los anclajes', 'Calzos'] : ['Pala', 'Nivel', 'Listones para arriostrar'],
    check: 'Empuja la valla por arriba en el centro de cada tramo: no debe moverse ni hacer ruido en las placas.',
    warning: 'Una valla alta o con tramos largos recibe mucho empuje del viento: si es tu caso, que un profesional dimensione postes y anclajes.',
  });

  // --- resumen ---
  const ac = ACABADOS[acabado] ?? ACABADOS.negro;
  const horas = 4 + 2 * nT + totBar * 0.15 + lamas.length * 0.25 + mallas.length * 1 + (nVol + nAro + nFriso) * (modo === 'curvada' ? 0.7 : 0.25)
    + remates.length * 0.08 + postes.length * 0.4;
  const remTxt = { recto: 'recto', pasante: 'pasantes', alterno: 'alternos', arco: 'ondulado en arco', concavo: 'ondulado en festón' }[remSel];
  return b.finish({
    id: 'valla',
    title: 'Valla',
    craft: 'soldadura',
    summary: `Valla de ${nT} tramo${nT > 1 ? 's' : ''} de ${(Lt / 1000).toFixed(2).replace('.', ',')} m y ${Math.round(Hp / 10)} cm de alto, ${forma === 'barrotes' ? `de barrotes (remate ${remTxt})` : forma === 'lamas' ? 'de lamas horizontales' : 'de malla'}${nPuntas ? ` con ${puntasSel === 'lanza' ? 'lanzas' : 'pinchos'}` : ''}${nVol ? ', volutas abajo' : ''}${nFriso ? ', friso de aros' : ''}. ${ac.label}.`,
    difficulty: modo === 'curvada' && hayDeco ? 3 : forma === 'malla' ? 1 : 2,
    hours: Math.round(horas * 2) / 2,
    paint: ac.hex,
    safety: [
      ...seguridadForja({ puntas: nPuntas > 0, escalable: true, curvada: modo === 'curvada' && hayDeco, proceso }),
      ...(forma === 'lamas' ? ['Las lamas horizontales forman una escalera: un niño puede trepar por ellas con facilidad. No es buena opción junto a una piscina o un desnivel.'] : []),
      'Los tramos son largos y pesados: muévelos y preséntalos entre dos personas.',
    ],
    notes: [
      ...(forma === 'barrotes' ? [`Barrotes repartidos para no pasar de ${mm(hmax)} de hueco libre: ${nBar} por tramo con ${mm(g)} reales. Si cambias el largo del tramo, el nº de barrotes y el tamaño de las volutas se recalculan.`] : []),
      ...(forma === 'lamas' ? [`${nLamas} lamas por tramo con ${mm(gapLr)} reales de separación (se ajusta para llenar el alto).`] : []),
      'Uniones a tope con cortes rectos: el travesaño (o la lama) apoya contra la cara del poste y el barrote contra la del travesaño.',
      ...(maxSob ? [`Las lanzas sobresalen hasta ${mm(maxSob)} por encima del travesaño superior.`] : []),
      ...(decoBaja !== String(v.decoBaja) && forma === 'barrotes' ? ['Con esta altura no cabe el friso de aros: se ha quitado.'] : []),
      NOTA_PUNTAS,
      'No se indica resistencia ni empuje admisible: depende de las soldaduras, del anclaje y del viento. Las secciones son decisiones de diseño; compruébalas en tu almacén de hierros.',
    ],
    sources: fuentesForja(proceso),
    spec: [
      { label: 'Medidas', value: `${nT} × ${Lt} mm entre postes, alto ${Hp} mm; largo total ${W} mm` },
      { label: 'Tipo', value: forma === 'barrotes' ? `Barrotes, remate ${remTxt}` : forma === 'lamas' ? `Lamas ${lamaH} × ${lamaT} mm` : `Malla de ${cell} mm` },
      ...(forma === 'barrotes' ? [{ label: 'Barrotes', value: `${nBar} por tramo, ${sp.label.toLowerCase()}, hueco ${Math.round(g)} mm` }] : []),
      { label: 'Puntas', value: nPuntas ? `${nPuntas} ${puntasSel === 'lanza' ? 'de lanza' : 'pinchos'}` : 'No' },
      { label: 'Parte baja', value: nVol ? `${nVol} volutas en ${tipoVol}` : nFriso ? `Friso de ${nFriso} aros` : 'Sin decoración' },
      { label: 'Postes', value: `${postes.length} de ${pt.label}, ${placa ? 'con placa de anclaje' : 'para empotrar'}, ${remPoste === 'bola' ? 'bola' : remPoste === 'tapa' ? 'tapa soldada' : 'tapón'}` },
      ...(forma === 'barrotes' ? [{ label: 'Decoración', value: modo === 'comprada' ? 'Elementos de forja comprados' : 'Curvados en frío por ti' }] : []),
      { label: 'Acabado', value: ac.label },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}

