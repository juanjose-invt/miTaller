import type { Generator, Mark, ParamValues, Vec3 } from '../core/types';
import { Builder, alturaArco, cordonPerimetral, hw, mm, radioArco, tornillos } from '../core/builder';
import { TEC_PUNTEO, infoProceso, pasoCordones, pasoCortar, pasoPreparar, pasoRepasar, pieza, type Proceso } from './taburete-acero';
import {
  ACABADOS, BARROTES, NOTA_PUNTAS, OPC_REMATE, PARAM_FORJA, PARAM_PROCESO, barrote, cordJ, cordonesDeco, cosido,
  filaVolutas, frisoAros, fuentesForja, herramientasDeco, huecos, letrasForja, medidaFrisoAros, paramAcabado, pasoPintarForja, ptsJ,
  puntaSobre, puntos, r1, reparto, seguridadForja, tecDecoracion, volutaEn, aroEn, altoMinC, type Forja, type J, type ModoForja, type Remate,
} from './puerta-verja';

/**
 * REJA DE VENTANA (soldadura, cerrajería) — el proyecto de forja más asequible.
 * Marco de cuadradillo, tubo o pletina de canto con barrotes y, si se quiere, travesaño
 * intermedio, remate superior en arco, volutas en C o en S, friso de aros, macollas,
 * puntas y patillas para empotrar u orejetas para atornillar al muro.
 */

const MARCOS: Record<string, { F: number; D: number; kind: 'cuad' | 'tubo' | 'pletina'; label: string }> = {
  cuad20: { F: 20, D: 20, kind: 'cuad', label: 'Cuadradillo macizo 20 mm' },
  tubo30: { F: 30, D: 30, kind: 'tubo', label: 'Tubo 30 × 30 × 1,5 mm' },
  pletina: { F: 8, D: 40, kind: 'pletina', label: 'Pletina 40 × 8 mm de canto' },
};
const PAT = { l: 100, w: 30, t: 4 }; // patilla de anclaje
const ORE = { l: 70, w: 40, t: 4 }; // orejeta atornillada

export const reja: Generator = {
  id: 'reja',
  title: 'Reja de ventana',
  craft: 'soldadura',
  difficulty: 1,
  description:
    'Reja fija para ventana: un marco con barrotes y, si quieres, remate en arco, volutas, aros, macollas y puntas. Es el proyecto de forja más asequible para empezar a decorar.',
  params: [
    { key: 'ancho', label: 'Ancho', type: 'number', min: 400, max: 2000, step: 10, unit: 'mm', default: 1000, group: 'Medidas', help: 'Por fuera del marco. Para empotrar, el hueco de la ventana; para atornillar en fachada, algo más que el hueco.' },
    { key: 'alto', label: 'Alto', type: 'number', min: 400, max: 1800, step: 10, unit: 'mm', default: 1100, group: 'Medidas', help: 'Por fuera del marco, hasta la clave del arco si lo lleva.' },
    { key: 'hueco', label: 'Hueco máximo entre barrotes', type: 'number', min: 80, max: 150, step: 5, unit: 'mm', default: 110, group: 'Medidas', help: 'Hueco libre entre barrotes; el nº de barrotes se recalcula para no pasar de él.' },
    {
      key: 'forma', label: 'Forma', type: 'select', default: 'recta', group: 'Forma',
      options: [
        { value: 'recta', label: 'Recta', hint: 'Marco rectangular' },
        { value: 'arco', label: 'Remate en arco', hint: 'Arco sobre el marco, con abanico de volutas posible' },
      ],
    },
    { key: 'flecha', label: 'Flecha del arco', type: 'number', min: 60, max: 400, step: 10, unit: 'mm', default: 180, group: 'Forma', visible: (v) => v.forma === 'arco' },
    { key: 'intermedio', label: 'Travesaño intermedio', type: 'boolean', default: true, group: 'Forma', help: 'Rigidiza los barrotes en la parte baja.' },
    {
      key: 'volutas', label: 'Volutas entre barrotes', type: 'select', default: 'no', group: 'Detalles',
      options: [
        { value: 'no', label: 'Sin volutas' },
        { value: 'arriba', label: 'Arriba', hint: 'Bajo el travesaño superior o dentro del arco' },
        { value: 'abajo', label: 'Abajo' },
        { value: 'ambas', label: 'Arriba y abajo' },
      ],
    },
    {
      key: 'tipoVoluta', label: 'Tipo de voluta', type: 'select', default: 'C', group: 'Detalles', visible: (v) => v.volutas !== 'no',
      options: [{ value: 'C', label: 'En C' }, { value: 'S', label: 'En S' }],
    },
    { key: 'aros', label: 'Friso de aros', type: 'boolean', default: false, group: 'Detalles', help: 'Banda de aros sobre el travesaño intermedio.', visible: (v) => v.intermedio === true },
    { key: 'macollas', label: 'Macollas en los barrotes', type: 'boolean', default: false, group: 'Detalles', help: 'Abultamientos de forja que se enhebran en cada barrote.' },
    { key: 'puntas', label: 'Puntas', type: 'select', default: 'ninguno', group: 'Detalles', options: OPC_REMATE, help: 'Sobre el marco, en la vertical de cada barrote.' },
    {
      key: 'anclaje', label: 'Anclaje al muro', type: 'select', default: 'patillas', group: 'Detalles',
      options: [
        { value: 'patillas', label: 'Patillas para empotrar', hint: 'En las jambas, con mortero' },
        { value: 'orejetas', label: 'Orejetas atornilladas', hint: 'Sobre la fachada, con tacos' },
      ],
    },
    {
      key: 'marco', label: 'Marco', type: 'select', default: 'cuad20', group: 'Material',
      options: [
        { value: 'cuad20', label: 'Cuadradillo macizo 20 mm', hint: 'El clásico de reja' },
        { value: 'tubo30', label: 'Tubo 30 × 30 × 1,5 mm', hint: 'Más ligero' },
        { value: 'pletina', label: 'Pletina 40 × 8 mm de canto', hint: 'Fina vista de frente' },
      ],
    },
    {
      key: 'barrote', label: 'Barrotes', type: 'select', default: 'cuad12', group: 'Material',
      options: [
        { value: 'cuad12', label: 'Cuadradillo macizo 12 mm' },
        { value: 'cuad16', label: 'Cuadradillo macizo 16 mm' },
        { value: 'red16', label: 'Redondo macizo Ø16 mm' },
      ],
    },
    paramAcabado('negro'),
    PARAM_FORJA,
    PARAM_PROCESO,
  ],
  presets: [
    {
      id: 'sencilla', name: 'Reja sencilla', blurb: 'Marco de cuadradillo, barrotes rectos y travesaño bajo: 100 × 110 cm, lista en una tarde.',
      values: { ancho: 1000, alto: 1100, hueco: 110, forma: 'recta', intermedio: true, volutas: 'no', aros: false, macollas: false, puntas: 'ninguno', anclaje: 'patillas', marco: 'cuad20', barrote: 'cuad12', acabado: 'blanco', forja: 'comprada', proceso: 'electrodo' },
    },
    {
      id: 'forja', name: 'Reja de forja', blurb: 'Remate en arco con abanico de volutas, friso de aros, macollas y volutas abajo.',
      values: { ancho: 1000, alto: 1300, hueco: 105, forma: 'arco', flecha: 220, intermedio: true, volutas: 'ambas', tipoVoluta: 'C', aros: true, macollas: true, puntas: 'ninguno', anclaje: 'patillas', marco: 'cuad20', barrote: 'cuad12', acabado: 'negro', forja: 'comprada', proceso: 'electrodo' },
    },
  ],
  build,
};

function build(v: ParamValues) {
  const W = Number(v.ancho), H = Number(v.alto), hmax = Number(v.hueco);
  const arco = v.forma === 'arco';
  const inter = v.intermedio === true;
  const volSel = String(v.volutas);
  const tipoVol = v.tipoVoluta === 'S' ? 'S' : 'C';
  let aros = inter && v.aros === true;
  const macollas = v.macollas === true;
  const puntasSel = String(v.puntas) as Remate;
  const patillas = v.anclaje !== 'orejetas';
  const mc = MARCOS[String(v.marco)] ?? MARCOS.cuad20;
  const F = mc.F, Dp = mc.D;
  const sp = BARROTES[String(v.barrote)] ?? BARROTES.cuad12;
  const d = sp.d;
  const acabado = String(v.acabado);
  const modo: ModoForja = v.forja === 'curvada' ? 'curvada' : 'comprada';
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);

  const b = new Builder();
  const f: Forja = { b, L: letrasForja(), modo };
  const zc = Dp / 2;
  const span = W - 2 * F;
  const xa = F, xb = W - F;

  // marco
  const lineal = (name: string, len: number, axis: 'x' | 'y', at: Vec3): string => {
    const r = f.L(`marco|${mc.kind}|${r1(len)}`, name);
    if (mc.kind === 'tubo') return b.tubo({ ref: r.ref, name: r.name, section: [F, Dp], wall: 1.5, length: len, axis, at });
    const section: [number, number] = axis === 'y' ? [F, Dp] : [F, Dp];
    const id = b.pletina({ ref: r.ref, name: r.name, section, length: len, axis, at });
    if (mc.kind === 'cuad') pieza(b, id).stock = `Cuadradillo macizo de acero ${F} mm`;
    return id;
  };
  const rise = arco ? Math.max(40, Math.min(Number(v.flecha), 0.45 * W, 0.35 * H)) : 0;
  const yS = arco ? H - rise - F : H; // cara superior de los montantes (arranque del arco)
  const montantes = [lineal('Montante', yS, 'y', [0, 0, 0]), lineal('Montante', yS, 'y', [W - F, 0, 0])];
  const travesanos: string[] = [];
  const jMarco: J[] = [];
  const rail = (y: number, name = 'Travesaño') => {
    const id = lineal(name, span, 'x', [xa, y, 0]);
    travesanos.push(id); jMarco.push([id, 'min'], [id, 'max']);
  };
  const yTB = yS - F; // cara inferior del travesaño superior (o de arranque)
  rail(0); rail(yTB, arco ? 'Travesaño de arranque' : 'Travesaño');
  // travesaño intermedio y friso
  const fA = medidaFrisoAros(span, Math.max(85, Math.min(140, hmax)));
  let yM = Math.round(Math.max(F + 120, Math.min(H * 0.28, yTB - 250)));
  if (aros && yTB - (yM + F + fA.alto + F) < 200) aros = false;
  if (inter && yTB - (yM + F) < 150) yM = Math.max(F + 60, yTB - F - 150);
  if (inter) rail(yM);
  if (aros) rail(yM + F + fA.alto, 'Travesaño del friso');
  const upperBot = !inter ? F : aros ? yM + 2 * F + fA.alto : yM + F;

  // barrotes
  const { xs, g } = reparto(xa, xb, d, hmax);
  const barras: string[] = [];
  const jBarras: J[] = [];
  const regiones: [number, number][] = inter ? [[F, yM], [upperBot, yTB]] : [[F, yTB]];
  for (const [ya, yb] of regiones) {
    for (const x of xs) {
      const id = barrote(f, sp, ya < (inter ? yM : -1) ? 'Barrote inferior' : 'Barrote', r1(yb - ya), x, ya, zc);
      barras.push(id); jBarras.push([id, 'min'], [id, 'max']);
    }
  }
  const xcs = xs.map((x) => x + d / 2);

  // arco y barrotes bajo el arco
  const arcoIds: string[] = [];
  const bajoArco: string[] = [], jBajo: J[] = [];
  const arcoC: Vec3[] = [];
  const archUnder = (x: number) => {
    const hA = alturaArco(x, W, rise);
    const slope = (alturaArco(Math.min(W, x + 1), W, rise) - alturaArco(Math.max(0, x - 1), W, rise)) / 2;
    const half = (F / 2) * Math.sqrt(1 + slope * slope);
    return { under: yS + hA + F / 2 - half, over: yS + hA + F / 2 + half };
  };
  if (arco) {
    const r = f.L(`arco|${r1(W)}|${r1(rise)}|${mc.kind}`, 'Arco');
    const stock = mc.kind === 'cuad' ? `Cuadradillo macizo de acero ${F} mm` : mc.kind === 'tubo' ? 'Tubo de acero 30×30×1,5 mm' : 'Pletina de acero 40×8 mm';
    arcoIds.push(b.arco({ ref: r.ref, name: r.name, width: W, rise, section: [F, Dp], normal: 'z', at: [0, yS, 0], stock }));
    pieza(b, arcoIds[0]).note = `Arco de ${mm(W)} de luz y ${mm(rise)} de flecha (radio ${mm(radioArco(W, rise))}).`;
    arcoC.push([F / 2, yS, zc], [W - F / 2, yS, zc], [xa + 10, yS, zc], [xb - 10, yS, zc]);
    for (const xc of xcs) {
      const { under } = archUnder(xc);
      if (under - yS >= 15) {
        const id = barrote(f, sp, 'Barrote bajo el arco', r1(under - yS), xc - d / 2, yS, zc);
        bajoArco.push(id); jBajo.push([id, 'min'], [id, 'max']);
      }
    }
  }

  // decoración
  const deco: string[] = [];
  const decoC: Vec3[] = [];
  let nVol = 0, nAro = 0;
  const volArriba = volSel === 'arriba' || volSel === 'ambas';
  const volAbajo = volSel === 'abajo' || volSel === 'ambas';
  const upperH = yTB - upperBot;
  let hvArriba = 0, hvAbajo = 0;
  if (volArriba) {
    if (arco) {
      // abanico: volutas apoyadas sobre el travesaño de arranque, bajo el arco
      const mid = W / 2;
      for (const [g0, g1] of huecos(xa, xb, xs, d)) {
        const gc = (g0 + g1) / 2, gw = g1 - g0;
        const libre = Math.min(archUnder(g0).under, archUnder(g1).under) - yS;
        const hv = Math.min(tipoVol === 'C' ? altoMinC(gw) + 6 : gw * 1.9, libre - 2);
        if (Math.abs(gc - mid) < 1) {
          if (libre >= gw + 2) {
            const a = aroEn(f, { cx: gc, cy: yS + gw / 2, d: gw, zc, lados: ['l', 'r', 'b'], name: 'Aro central' });
            deco.push(a.id); decoC.push(...a.contactos); nAro++;
          }
          continue;
        }
        if (hv < gw * 0.8) continue;
        const vv = volutaEn(f, { x0: g0, x1: g1, y0: yS, y1: yS + hv, zc, curve: tipoVol, mirror: gc > mid, lados: ['l', 'r', 'b'] });
        deco.push(vv.id); decoC.push(...vv.contactos); nVol++;
      }
    } else {
      hvArriba = Math.min(tipoVol === 'C' ? altoMinC(g) + 6 : g * 1.9, upperH * (volAbajo && !inter ? 0.36 : 0.45));
      if (hvArriba >= g * 0.8) {
        const out = filaVolutas(f, { xa, xb, xs, d, yRail: yTB, anchor: 'top', hv: hvArriba, tipo: tipoVol, zc });
        deco.push(...out.ids); decoC.push(...out.contactos); nVol += out.nVol; nAro += out.nAro;
      } else hvArriba = 0;
    }
  }
  if (volAbajo) {
    const regH = inter ? yM - F : upperH;
    hvAbajo = Math.min(tipoVol === 'C' ? altoMinC(g) + 6 : g * 1.9, regH * (inter ? 0.7 : volArriba && !arco ? 0.36 : 0.45));
    if (hvAbajo >= g * 0.8) {
      const out = filaVolutas(f, { xa, xb, xs, d, yRail: F, anchor: 'bottom', hv: hvAbajo, tipo: tipoVol, zc });
      deco.push(...out.ids); decoC.push(...out.contactos); nVol += out.nVol; nAro += out.nAro;
    } else hvAbajo = 0;
  }
  let nFriso = 0;
  if (aros) {
    const out = frisoAros(f, { xa, xb, y0: yM + F, n: fA.n, zc });
    deco.push(...out.ids); decoC.push(...out.contactos); nFriso = fA.n;
  }

  // macollas (en el tramo principal, a media altura del hueco libre de volutas)
  const macIds: string[] = [];
  const DM = Math.round(d * 2.4);
  if (macollas) {
    const top = yTB - (!arco && volArriba ? hvArriba : 0);
    const bot = upperBot + (!inter && volAbajo ? hvAbajo : 0);
    const ym = (top + bot) / 2;
    for (const xc of xcs) {
      const r = f.L(`macolla|${d}|${DM}`, 'Macolla');
      macIds.push(b.bola({ ref: r.ref, name: r.name, diameter: DM, at: [xc - DM / 2, ym - DM / 2, zc - DM / 2], stock: `Macolla de forja para barrote de ${d} mm (Ø${DM} mm)` }));
    }
  }

  // puntas
  const puntasIds: string[] = [];
  const puntasC: Mark[] = [];
  if (puntasSel !== 'ninguno') {
    const base = puntasSel === 'lanza' ? Math.max(24, d * 2) : d;
    for (const xc of xcs) {
      const yb = arco ? r1(archUnder(xc).over) : H;
      puntasIds.push(puntaSobre(f, puntasSel, d, xc, yb, zc));
      puntasC.push(...cordonPerimetral([xc, yb, zc], 'y', base, base));
    }
  }

  // anclajes
  const anclaIds: string[] = [];
  const anclaC: Mark[] = [];
  const agujeros: Vec3[] = [];
  const nPorLado = H > 1000 ? 3 : 2;
  const ysA = Array.from({ length: nPorLado }, (_, i) => Math.round(Math.min(150, yS * 0.25) + ((yS - 2 * Math.min(150, yS * 0.25)) * i) / Math.max(1, nPorLado - 1)));
  for (const lado of [0, 1]) {
    for (const y of ysA) {
      if (patillas) {
        const r = f.L(`patilla|${PAT.l}`, 'Patilla de anclaje');
        const x = lado === 0 ? -PAT.l : W;
        anclaIds.push(b.pletina({ ref: r.ref, name: r.name, section: [PAT.w, PAT.t], length: PAT.l, axis: 'x', at: [x, y - PAT.w / 2, zc - PAT.t / 2] }));
        const xf = lado === 0 ? 0 : W;
        anclaC.push(...cosido([xf, y - PAT.w / 2 + 2, zc - PAT.t / 2], [xf, y + PAT.w / 2 - 2, zc - PAT.t / 2], 100, PAT.w - 4), ...cosido([xf, y - PAT.w / 2 + 2, zc + PAT.t / 2], [xf, y + PAT.w / 2 - 2, zc + PAT.t / 2], 100, PAT.w - 4));
      } else {
        const r = f.L(`orejeta|${ORE.l}`, 'Orejeta');
        const x = lado === 0 ? F - ORE.l : W - F;
        anclaIds.push(b.pletina({ ref: r.ref, name: r.name, section: [ORE.w, ORE.t], length: ORE.l, axis: 'x', at: [x, y - ORE.w / 2, Dp] }));
        const xe = lado === 0 ? 0 : W;
        anclaC.push(...cosido([xe, y - ORE.w / 2 + 2, Dp], [xe, y + ORE.w / 2 - 2, Dp], 100, ORE.w - 4));
        agujeros.push([lado === 0 ? F - ORE.l + 22 : W - F + ORE.l - 22, y, Dp + ORE.t]);
      }
    }
  }

  // --- pasos ---
  b.step(pasoCortar({
    proceso,
    lineas: [
      `Marco (${mc.label.toLowerCase()}): 2 montantes de ${mm(yS)} y ${travesanos.length} travesaños de ${mm(span)}.`,
      `Barrotes (${sp.label.toLowerCase()}): ${xs.length} por tramo con un hueco libre de ${mm(g)}${inter ? `: ${xs.length} de ${mm(yM - F)} abajo y ${xs.length} de ${mm(upperH)} arriba` : ` de ${mm(upperH)}`}.`,
      ...(arco ? [`Arco: ${mm(W)} de luz y ${mm(rise)} de flecha. Los barrotes bajo el arco tienen cada uno su largo: córtalos después de presentar el arco, midiendo en su sitio.`] : []),
      ...(patillas ? [`Patillas: ${anclaIds.length} trozos de pletina ${PAT.w}×${PAT.t} de ${mm(PAT.l)}; abre en cola de pez el extremo que irá al muro (rájalo con la radial y separa las dos mitades) para que agarre en el mortero.`] : [`Orejetas: ${anclaIds.length} trozos de pletina ${ORE.w}×${ORE.t} de ${mm(ORE.l)}, con un taladro cerca del extremo libre del diámetro que pida el tornillo que vayas a usar.`]),
    ],
  }));
  b.step(pasoPreparar({ proceso, extra: ['Compra barra y tubo negros o decapados, no galvanizados: la reja irá pintada.'] }));

  const hayDeco = deco.length > 0 || arco;
  if (modo === 'curvada' && hayDeco) {
    b.step({
      kind: 'preparar',
      title: arco ? 'Curva el arco, las volutas y los aros' : 'Curva las volutas y los aros',
      summary: 'Fabrica todas las piezas curvas iguales entre sí, con plantilla, antes de soldar.',
      detail: [
        ...(arco ? [`Traza en el suelo el arco de ${mm(W)} de luz y ${mm(rise)} de flecha (radio ${mm(radioArco(W, rise))}) con un compás de cordel y curva la barra poco a poco hasta que coincida. Si no te ves capaz, en muchos almacenes de hierros lo curvan por encargo.`] : []),
        ...(nVol ? [`Volutas: ${nVol}. Dibújalas a tamaño real con la medida exterior de la lista de piezas y hazles una plantilla.`] : []),
        ...(nAro + nFriso ? [`Aros: ${nAro + nFriso}. Curva un muelle de pletina alrededor de un tubo que haga de mandril, córtalos y ciérralos con un punto.`] : []),
      ],
      parts: [],
      technique: tecDecoracion('curvada'),
      tools: herramientasDeco('curvada'),
      check: 'Apila las piezas iguales: deben coincidir. Coloca el arco sobre el trazado del suelo.',
      warning: 'La barra puede saltar de la plantilla: gafas, guantes y plantilla bien sujeta.',
    });
  }

  b.step({
    kind: 'soldar',
    title: 'Puntea el marco en plano',
    summary: 'Montantes y travesaños se puntean tumbados sobre una superficie plana, comprobando las diagonales.',
    detail: [
      'Tumba los dos montantes sobre la mesa de soldar y mete entre ellos los travesaños a tope, enrasados por delante.',
      `Travesaño inferior abajo del todo; ${inter ? `el intermedio con su cara inferior a ${mm(yM)}; ` : ''}${aros ? `el del friso ${mm(fA.alto)} por encima del intermedio; ` : ''}el ${arco ? 'de arranque' : 'superior'} enrasado con la punta de los montantes.`,
      ...TEC_PUNTEO.how.slice(0, 2),
      'Da la vuelta al marco y puntea las caras opuestas.',
    ],
    parts: [...montantes, ...travesanos],
    marks: ptsJ(b, jMarco),
    technique: TEC_PUNTEO,
    tools: ['Mesa de soldar o superficie plana', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', 'Flexómetro', info.equipo[0]],
    check: `Mide las diagonales del marco (unos ${mm(Math.hypot(W, yS))}): deben ser iguales. Comprueba también que el marco cabe en el hueco de la ventana con holgura para el mortero o los tacos.`,
    warning: 'Solo puntos: un marco descuadrado no entra en el hueco de la ventana.',
  });

  b.step({
    kind: 'soldar',
    title: macollas ? 'Enhebra las macollas y puntea los barrotes' : 'Reparte y puntea los barrotes',
    summary: `${xs.length} barrotes por tramo con un hueco libre de ${mm(g)}, repartidos con una galga.`,
    detail: [
      `Corta una galga de separación de ${mm(g)} exactos (un taco de madera o pletina) y reparte desde los montantes hacia el centro.`,
      ...(macollas ? [`Antes de puntear cada barrote de arriba, enhébrale su macolla y súbela hasta ${mm((pieza(b, macIds[0]).pos[1]))} del pie de la reja; fíjala con un punto por detrás. Una macolla olvidada ya no se puede poner.`] : []),
      'Puntea cada barrote arriba y abajo por delante, centrado en el grueso del marco y a plomo; luego da la vuelta a la reja y puntea por detrás.',
    ],
    parts: [...barras, ...macIds],
    marks: ptsJ(b, jBarras),
    technique: TEC_PUNTEO,
    tools: ['Galga de separación', 'Escuadra de acero', 'Nivel', 'Pinzas de presión', info.equipo[0]],
    check: 'Mira la reja desde un extremo, a ras: todos los barrotes en fila. Vuelve a medir las diagonales.',
    tip: macollas ? 'Las macollas se compran con un agujero del tamaño del barrote: llévate un trozo de barrote a la tienda para probarlas.' : undefined,
  });

  b.step(pasoCordones({
    proceso,
    nUniones: jMarco.length + jBarras.length,
    marks: [...cordJ(b, jMarco), ...cordJ(b, jBarras)],
    orden: [
      'Empieza por las cuatro esquinas del marco saltando en diagonal, después el travesaño intermedio.',
      'Sigue con los barrotes alternando: uno de un extremo, otro del extremo contrario, otro del centro… para que la reja no se curve.',
      'Mantén la reja sujeta a la mesa con sargentos hasta que se enfríe.',
    ],
  }));

  if (hayDeco) {
    b.step({
      kind: 'soldar',
      title: 'Presenta y suelda las decoraciones',
      summary: `${[arco && 'El arco', nVol && `${nVol} volutas en ${tipoVol}`, nAro && `${nAro} aro${nAro > 1 ? 's' : ''} central${nAro > 1 ? 'es' : ''}`, nFriso && `un friso de ${nFriso} aros`].filter(Boolean).join(', ')}: cada pieza apoya en dos barrotes o en barrote y travesaño.`,
      detail: [
        ...(arco ? [
          'Presenta el arco sobre los montantes y el travesaño de arranque; puntéalo sobre cada montante.',
          ...(bajoArco.length ? [`Mide en su sitio cada barrote bajo el arco (de ${mm(Math.min(...bajoArco.map((id) => pieza(b, id).size[1])))} a ${mm(Math.max(...bajoArco.map((id) => pieza(b, id).size[1])))}), córtalo y puntéalo en la vertical del barrote de abajo.`] : []),
        ] : []),
        ...(nVol ? [`Volutas: cada una ocupa un hueco de ${mm(g)} entre barrotes y apoya en el travesaño${arco && volArriba ? '; las del arco forman un abanico sobre el travesaño de arranque y son más bajas cerca de los extremos' : ''}. Las de la mitad izquierda van al revés que las de la derecha.`] : []),
        ...(nFriso ? [`Friso: ${nFriso} aros de Ø${mm(fA.d)} en fila entre el travesaño intermedio y el del friso.`] : []),
        'Puntea todas, mira la reja de pie y corrige lo que se vea desigual. Después, un cordón corto por delante y otro por detrás en cada contacto.',
      ],
      parts: [...arcoIds, ...bajoArco, ...deco],
      marks: [...puntos(arcoC), ...cordonesDeco(arcoC, Dp), ...ptsJ(b, jBajo), ...cordJ(b, jBajo), ...puntos(decoC), ...cordonesDeco(decoC)],
      technique: tecDecoracion(modo),
      tools: [...herramientasDeco(modo), info.equipo[0]],
      check: 'Ninguna voluta debe atravesar un barrote ni quedar en el aire: todas tocan por al menos dos sitios.',
      warning: 'La barra de forja es fina: arco corto y el calor apuntado al barrote o al travesaño.',
    });
  }

  if (puntasIds.length) {
    b.step({
      kind: 'soldar',
      title: 'Suelda las puntas',
      summary: `${puntasIds.length} ${puntasSel === 'lanza' ? 'puntas de lanza' : 'pinchos'} sobre el ${arco ? 'arco' : 'marco'}, en la vertical de cada barrote.`,
      detail: [
        'Marca en el marco la vertical de cada barrote con una escuadra.',
        'Presenta cada punta centrada, a plomo por dos caras, puntéala y suelda la base con un cordón corto alrededor.',
        NOTA_PUNTAS,
      ],
      parts: puntasIds,
      marks: puntasC,
      tools: ['Escuadra', 'Nivel pequeño', 'Pinzas de presión', info.equipo[0]],
      warning: 'Las puntas pinchan: mueve la reja con guantes. Antes de instalarlas, consulta la normativa de tu ayuntamiento.',
    });
  }

  b.step({
    kind: 'soldar',
    title: patillas ? 'Suelda las patillas de anclaje' : 'Suelda las orejetas',
    summary: `${anclaIds.length} ${patillas ? 'patillas a los lados de los montantes, que se empotrarán en las jambas' : 'orejetas por detrás de los montantes, para atornillar a la fachada'}.`,
    detail: [
      `${nPorLado} por lado, a ${ysA.map((y) => mm(y)).join(', ')} del pie de la reja.`,
      patillas ? 'Cada patilla sale perpendicular a la cara exterior del montante, centrada en su grueso, con la cola de pez hacia fuera. Suéldala por las dos caras.' : 'Cada orejeta apoya por detrás en el montante y sobresale hacia fuera con el taladro libre. Suéldala por el canto que toca al montante.',
    ],
    parts: anclaIds,
    marks: anclaC,
    tools: ['Escuadra', 'Sargentos', info.equipo[0]],
    check: 'Presenta la reja en el hueco antes de pintar: las patillas deben caer en las jambas, no en el marco de la ventana ni en la persiana.',
  });

  b.step(pasoRepasar([
    'Repasa los cordones vistos del marco con el disco de láminas.',
    ...(hayDeco ? ['En volutas y aros no amoles: cepillo pequeño y repasa solo las gotas que sobresalgan.'] : []),
  ]));

  b.step(pasoPintarForja(acabado));

  b.step({
    kind: 'acabar',
    title: patillas ? 'Empotra la reja' : 'Atornilla la reja',
    summary: patillas ? 'Las patillas se recibieron con mortero en cajas abiertas en las jambas.' : 'La reja se fija a la fachada con tornillos y tacos adecuados al muro.',
    detail: patillas
      ? [
          'Presenta la reja en el hueco y marca en las jambas dónde cae cada patilla.',
          'Abre una caja en el muro para cada patilla con la profundidad de la patilla, limpia el polvo y humedece la caja.',
          'Coloca la reja calzada, aplómala y nivélala, y rellena las cajas con mortero. No la toques hasta que fragüe según el fabricante.',
          'Retoca la pintura.',
        ]
      : [
          'Presenta la reja, aplómala y marca los taladros de las orejetas.',
          'Taladra con la broca y la profundidad que indique el fabricante del taco para tu tipo de muro, pon los tacos y atornilla.',
          'Retoca la pintura.',
        ],
    parts: [],
    marks: agujeros.length ? tornillos(agujeros, 'z') : undefined,
    hardware: patillas
      ? [hw('Mortero de reparación o cemento rápido', 1, 'saco pequeño'), hw('Esmalte del mismo color para retoques', 1, 'bote pequeño')]
      : [hw('Tornillo y taco para fachada adecuados a tu muro (macizo o hueco); elige el tipo con el fabricante', agujeros.length), hw('Esmalte del mismo color para retoques', 1, 'bote pequeño')],
    tools: patillas ? ['Maceta y cincel', 'Paleta', 'Nivel', 'Calzos'] : ['Taladro percutor', 'Broca para el muro', 'Nivel', 'Llave'],
    check: 'Tira de la reja con fuerza en varios puntos: no debe moverse ni sonar.',
    warning: 'Una reja fija impide salir por esa ventana en una emergencia: piensa en otra vía de salida o en una reja practicable para dormitorios.',
  });

  // --- resumen ---
  const ac = ACABADOS[acabado] ?? ACABADOS.negro;
  const decor = nVol + nAro + nFriso;
  const horas = 4 + barras.length * 0.15 + (arco ? 1.5 : 0) + decor * (modo === 'curvada' ? 0.7 : 0.25) + macIds.length * 0.1 + puntasIds.length * 0.08;
  return b.finish({
    id: 'reja',
    title: 'Reja de ventana',
    craft: 'soldadura',
    summary: `Reja de ${Math.round(W / 10)} × ${Math.round(H / 10)} cm ${arco ? 'con remate en arco' : 'recta'}, marco de ${mc.label.toLowerCase()} y ${xs.length} barrotes${decor ? `, ${[nVol && `${nVol} volutas`, nFriso && 'friso de aros'].filter(Boolean).join(' y ')}` : ''}${macollas ? ', macollas' : ''}${puntasIds.length ? ', puntas' : ''}. ${ac.label}.`,
    difficulty: modo === 'curvada' && hayDeco ? 3 : hayDeco || macollas ? 2 : 1,
    hours: Math.round(horas * 2) / 2,
    paint: ac.hex,
    safety: [
      ...seguridadForja({ puntas: puntasIds.length > 0, escalable: true, curvada: modo === 'curvada' && hayDeco, proceso }),
      'Una reja fija bloquea la ventana como salida de emergencia: tenlo en cuenta en dormitorios.',
    ],
    notes: [
      `Barrotes repartidos para no pasar de ${mm(hmax)} de hueco libre: salen ${xs.length} con ${mm(g)} reales. Si cambias el ancho, el nº de barrotes y el tamaño de las volutas se recalculan.`,
      'Uniones a tope con cortes rectos: el barrote apoya contra la cara del travesaño.',
      ...(arco ? ['El arco apoya sobre los montantes y un travesaño de arranque recto: el marco sigue siendo rectangular y fácil de escuadrar.'] : []),
      ...(v.aros === true && inter && !aros ? ['Con esta altura no cabe el friso de aros: se ha quitado.'] : []),
      NOTA_PUNTAS,
      'Las secciones de marco y barrote son decisiones de diseño; compruébalas en tu almacén de hierros.',
    ],
    sources: fuentesForja(proceso),
    spec: [
      { label: 'Medidas', value: `${W} × ${H} mm${arco ? `, arco de ${Math.round(rise)} mm de flecha` : ''}` },
      { label: 'Marco', value: mc.label },
      { label: 'Barrotes', value: `${xs.length}, ${sp.label.toLowerCase()}, hueco ${Math.round(g)} mm` },
      { label: 'Travesaño intermedio', value: inter ? `Sí, a ${yM} mm` : 'No' },
      { label: 'Volutas', value: nVol ? `${nVol} en ${tipoVol}` : 'No' },
      { label: 'Friso de aros', value: nFriso ? `${nFriso} aros` : 'No' },
      { label: 'Macollas', value: macollas ? `${macIds.length}` : 'No' },
      { label: 'Puntas', value: puntasIds.length ? `${puntasIds.length} ${puntasSel === 'lanza' ? 'de lanza' : 'pinchos'}` : 'No' },
      { label: 'Anclaje', value: patillas ? `${anclaIds.length} patillas para empotrar` : `${anclaIds.length} orejetas atornilladas` },
      { label: 'Decoración', value: modo === 'comprada' ? 'Elementos de forja comprados' : 'Curvados en frío por ti' },
      { label: 'Acabado', value: ac.label },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}
