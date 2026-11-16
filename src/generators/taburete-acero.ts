import type { Axis, Generator, HardwareLine, Mark, ParamValues, Part, SourceRef, Step, Technique, Vec3 } from '../core/types';
import { Builder, cordon, cordonPerimetral, hw, mm, punto, tornillos } from '../core/builder';
import { fuentesSoldadura } from '../data/tips-soldadura';

/**
 * TABURETE DE TALLER (soldadura) — el primer proyecto de soldadura.
 * Cuatro patas de tubo cuadrado unidas por un aro de travesaños bajo el asiento y,
 * opcionalmente, un segundo aro como reposapiés. El asiento de madera se atornilla
 * desde abajo a través de orejetas de pletina soldadas por dentro del aro.
 *
 * Este archivo exporta además las ayudas de soldadura que usan mesa-acero y lenero
 * (marcas de cordón y punto sobre las uniones a tope, textos verificados y pasos comunes).
 */

// =====================================================================================
// Ayudas de soldadura compartidas (taburete-acero, mesa-acero, lenero)
// =====================================================================================

export type Proceso = 'electrodo' | 'hilo';
type End = 'min' | 'max';
const AXI: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const EPS = 0.01;

export function pieza(b: Builder, id: string): Part {
  const p = b.parts.find((q) => q.id === id);
  if (!p) throw new Error(`pieza desconocida: ${id}`);
  return p;
}

/** Cara de contacto en un extremo de una pieza lineal (tubo, pletina o redondo). */
function extremo(b: Builder, id: string, end: End) {
  const p = pieza(b, id);
  const i = AXI[p.axis];
  const c: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
  c[i] += (end === 'max' ? 1 : -1) * (p.size[i] / 2);
  const [u, v] = ([0, 1, 2] as const).filter((k) => k !== i);
  return { p, c, i, u, v };
}

/** Cordón circular (polígono de 12 lados) alrededor de un redondo que apoya a tope. */
function cordonCircular(c: Vec3, axis: Axis, d: number, n = 12): Mark[] {
  const i = AXI[axis];
  const [u, v] = ([0, 1, 2] as const).filter((k) => k !== i);
  const pt = (a: number): Vec3 => {
    const p: Vec3 = [c[0], c[1], c[2]];
    p[u] += (d / 2) * Math.cos(a);
    p[v] += (d / 2) * Math.sin(a);
    return p;
  };
  return Array.from({ length: n }, (_, k) => cordon(pt((2 * Math.PI * k) / n), pt((2 * Math.PI * (k + 1)) / n)));
}

/**
 * Cordones de una unión a tope: el contorno del extremo `end` de la pieza `id`
 * sobre la cara de la pieza contra la que apoya. `sinArriba` quita el lado superior
 * (orejetas enrasadas bajo un tablero, donde no se puede soldar).
 */
export function cordonesTope(b: Builder, id: string, end: End, sinArriba = false): Mark[] {
  const { p, c, u, v } = extremo(b, id, end);
  if (p.shape === 'cyl') return cordonCircular(c, p.axis, p.size[u]);
  let ms = cordonPerimetral(c, p.axis, p.size[u], p.size[v]);
  if (sinArriba) {
    const top = p.pos[1] + p.size[1] / 2;
    ms = ms.filter((m) => !(Math.abs(m.at[1] - top) < EPS && Math.abs((m.to ?? m.at)[1] - top) < EPS));
  }
  return ms;
}

/** Dos puntos de punteado en caras opuestas de una unión a tope (a lo largo del eje `lado`). */
export function puntosTope(b: Builder, id: string, end: End, lado: Axis): Mark[] {
  const { p, c, i } = extremo(b, id, end);
  const k = AXI[lado];
  if (k === i) throw new Error('el lado del punteado no puede ser el eje de la pieza');
  return [-1, 1].map((sg) => {
    const q: Vec3 = [c[0], c[1], c[2]];
    q[k] += (sg * p.size[k]) / 2;
    return punto(q);
  });
}

/** Un punto en el centro del borde inferior de una orejeta (pletina) que apoya a tope. */
export function puntoOrejeta(b: Builder, id: string, end: End): Mark[] {
  const { p, c } = extremo(b, id, end);
  return [punto([c[0], p.pos[1] - p.size[1] / 2, c[2]])];
}

/** Asigna letras de la lista de corte en orden de aparición; piezas idénticas comparten letra y nombre. */
export function letras() {
  const m = new Map<string, { ref: string; name: string }>();
  return (firma: string, name: string) => {
    if (!m.has(firma)) m.set(firma, { ref: String.fromCharCode(65 + m.size), name });
    return m.get(firma)!;
  };
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** Secciones de tubo cuadrado que ofrecen los generadores de soldadura (decisión de diseño, no catálogo). */
export const SECCIONES: Record<string, { s: number; wall: number; label: string }> = {
  '30': { s: 30, wall: 1.5, label: '30 × 30 × 1,5 mm' },
  '40': { s: 40, wall: 1.5, label: '40 × 40 × 1,5 mm' },
  '40g': { s: 40, wall: 2, label: '40 × 40 × 2 mm' },
};

// ---------- fuentes ----------
const src = (id: string): SourceRef => {
  const f = fuentesSoldadura.find((x) => x.id === id);
  if (!f) throw new Error(`fuente desconocida: ${id}`);
  return { label: `${f.org}: ${f.title}`, url: f.url };
};
export const LINCOLN_6013: SourceRef = { label: 'Lincoln Electric: ficha Fleetweld 37 (E6013)', url: 'https://cdn.shopify.com/s/files/1/2778/4524/files/c21019.pdf' };
export const LINCOLN_GUIA: SourceRef = { label: 'Lincoln Electric: Stick Electrode Welding Guide', url: 'https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f' };
export const HOBART_6013: SourceRef = { label: 'Hobart Brothers: ficha técnica 6013', url: 'https://hobartbrothers.com/wp-content/uploads/hobart-catalog/datasheets/6013.pdf' };
export const LINCOLN_INNERSHIELD: SourceRef = { label: 'Lincoln Electric: guía Innershield (FCAW-S), NR-211-MP', url: 'https://ch-delivery.lincolnelectric.com/api/public/content/5b1a00933782415e98e56639deb63f45?v=405651b4' };
export const UAL_PUESTO: SourceRef = { label: 'Universidad de Almería: evaluación del espacio de trabajo', url: 'https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf' };
export const WWJ_BANCO: SourceRef = { label: "Woodworker's Journal: What's the right height for a workbench?", url: 'https://www.woodworkersjournal.com/whats-right-height-work-bench/' };

export function fuentesSoldaduraProyecto(proceso: Proceso, extra: SourceRef[] = []): SourceRef[] {
  const base = ['osha-1910-252', 'insst-ntp494', 'insst-ntp6', 'insst-ropa', 'insst-guantes', 'hse-mild-fume', 'twi-fume-fever', 'twi-tack', 'twi-distortion', 'twi-slag', 'miller-clams', 'miller-electrodes', 'miller-mig-defects'].map(src);
  const proc = proceso === 'electrodo' ? [LINCOLN_6013, HOBART_6013, LINCOLN_GUIA] : [LINCOLN_INNERSHIELD, LINCOLN_GUIA];
  return [...base, ...proc, ...extra];
}

// ---------- textos según el proceso ----------
interface InfoProceso {
  nombre: string;
  consumible: HardwareLine;
  equipo: string[];
  careta: string;
  ajuste: string[];
}

export function infoProceso(p: Proceso): InfoProceso {
  if (p === 'electrodo') {
    return {
      nombre: 'Electrodo revestido de rutilo E6013 (MMA)',
      consumible: hw('Electrodos de rutilo E6013 de diámetro fino (Ø2,0 o Ø2,4 mm), envase cerrado', 1, 'paquete'),
      equipo: ['Inverter de electrodo revestido con pinza portaelectrodos y pinza de masa', 'Piqueta y cepillo de alambre'],
      careta:
        'Careta de soldar con filtro de sombra 10 (o automática ajustada a 10): es el número que da la tabla de OSHA para electrodo revestido de 1/16 a 5/32 de pulgada, que incluye los diámetros de 2,0 a 4,0 mm.',
      ajuste: [
        'Miller recomienda el E6013 para material fino: arco suave, poca proyección y escoria fácil de quitar. Úsalo sobre acero limpio y elige el diámetro más fino que tengas.',
        'Como referencia, la ficha del E6013 Lincoln Fleetweld 37 da 45–75 A en continua para Ø2,0 mm y 70–105 A para Ø2,4 mm; la de Hobart, 40–80 A para Ø2,4 mm. Manda el rango impreso en tu caja: en pared fina, empieza por la parte baja.',
        'Mira en el envase la polaridad que pide el fabricante y colócala con el equipo apagado.',
        'Prueba en un recorte del mismo tubo: si el electrodo se pega, sube 5 A; si el baño se hunde o perfora, baja 5 A (Miller propone ajustar en pasos de 5 a 10 A).',
      ],
    };
  }
  return {
    nombre: 'Hilo tubular sin gas (FCAW autoprotegido)',
    consumible: hw('Bobina de hilo tubular sin gas tipo E71T-11, Ø0,8 o 0,9 mm (el que admita tu máquina)', 1, 'bobina'),
    equipo: ['Soldadora de hilo con polaridad invertible, rodillo y tubo de contacto del diámetro del hilo', 'Piqueta y cepillo de alambre (el hilo tubular también deja escoria)'],
    careta:
      'Careta de soldar automática o con filtro fijo. La tabla de OSHA no recoge de forma expresa el hilo tubular: usa el número que indique el fabricante de la careta para ese proceso y esa intensidad, nunca uno más claro.',
    ajuste: [
      'Pon polaridad directa: pistola al negativo (DC−), como indican Lincoln y Miller para el hilo autoprotegido.',
      'La tabla de Lincoln para Innershield NR-211-MP de 0,8 mm va de 1,3 m/min de hilo y 13–14 V (unos 30 A) a 5,1 m/min y 14–15 V (unos 100 A). Son procedimientos típicos, no específicos: en pared fina empieza por abajo y ajusta en un recorte.',
      'Deja que el hilo sobresalga de la boquilla como mucho 1/2 pulgada (unos 12,7 mm) y suelda arrastrando la pistola, inclinada de 0 a 15° (Miller).',
      'Si salen muchas proyecciones, sube un poco la tensión; si perfora, baja tensión o velocidad de hilo y avanza más rápido.',
    ],
  };
}

export function seguridadSoldadura(p: Proceso, exterior = false): string[] {
  return [
    infoProceso(p).careta + ' Pon delante del filtro un cristal transparente y cámbialo cuando esté rayado. Mantén la cara al menos a 300 mm del arco (INSST).',
    'Ropa de algodón ignífugo o lana, manga larga, cuello cubierto y pantalón sin dobladillo; mandil y polainas de cuero y botas de seguridad. Cambia la ropa si está húmeda, sudada o manchada de grasa (INSST).',
    'Guantes de soldador de manga larga, tipo A para electrodo e hilo tubular, siempre secos. Cambia el electrodo con los guantes puestos y nunca sobre suelo mojado (INSST).',
    'No respires el humo: el HSE británico considera que la ventilación general no basta ni con acero dulce. En interior usa extracción localizada lo más cerca posible del cordón (el INSST propone una campana con al menos 0,5 m/s); en exterior, protección respiratoria adecuada. Colócate para que el humo no suba hacia tu careta.',
    'No sueldes tubo galvanizado tal cual: el zinc provoca la fiebre de los humos metálicos. Si no hay más remedio, elimina el recubrimiento a ambos lados de la junta, lo bastante lejos para que no humee, y trabaja con buena extracción (TWI, OSHA).',
    'Riesgo de incendio: aparta todo lo combustible (OSHA pide alejarlo unos 10,7 m cuando sea posible) o cúbrelo con material ignífugo, ten un extintor a mano y vigila la zona al menos 30 minutos después de terminar.',
    'Gafas de seguridad al cortar, amolar y picar la escoria (pica de forma que los trozos salgan hacia el lado contrario a ti). La amoladora, siempre con su protector y sujeta con las dos manos.',
    'El acero sigue quemando mucho rato después de soldar aunque no lo parezca: no lo toques sin guantes y avisa a quien entre en el taller.',
    'Al parar, saca el electrodo de la pinza (o suelta el gatillo y apaga) y desconecta el equipo de la red. Revisa el aislamiento de los cables antes de cada sesión.',
    ...(exterior ? ['Si lo vas a dejar a la intemperie, no caigas en la tentación de usar tubo galvanizado para soldarlo: protégelo con imprimación antioxidante y esmalte.'] : []),
  ];
}

// ---------- técnicas ----------
export const TEC_CORTE: Technique = {
  name: 'Corte recto a 90° para uniones a tope',
  why: 'En una unión a tope, uno de los tubos se corta más corto y su extremo apoya contra la cara del otro. Solo hace falta un corte recto, que es el más fácil de dejar a escuadra, y la holgura queda uniforme: según TWI, un ajuste uniforme hace la contracción más predecible y una holgura grande aumenta la deformación.',
  how: [
    'Marca la longitud con rayador o rotulador fino y traza la línea alrededor del tubo con una escuadra.',
    'Sujeta el tubo en un tornillo de banco o con sargentos; nunca con la mano.',
    'Corta un poco por fuera de la línea y acaba de dejarlo a medida con el disco de láminas.',
    'Comprueba la escuadra del corte apoyando la escuadra en dos caras contiguas del tubo.',
  ],
};

export const TEC_PUNTEO: Technique = {
  name: 'Punteado (soldadura de punteo)',
  why: 'Los puntos son soldaduras pequeñas y provisionales que mantienen la posición y la separación de las piezas y reducen la deformación (TWI). Si algo ha quedado mal, un punto se quita con la amoladora en un minuto; un cordón completo, no.',
  how: [
    'Mismo proceso que la soldadura final, pero con menos calor (TWI): un toque corto de arco en la esquina de la unión.',
    'Da un punto en cada unión, comprueba la escuadra y, solo si está bien, da el punto de la cara opuesta.',
    'Puntos pequeños: en pared fina, un punto excesivo perfora el tubo (TWI). Quita la escoria de cada punto con la piqueta.',
    'Si algo se ha movido, rompe el punto con la amoladora, corrige y vuelve a puntear.',
  ],
};

export const TEC_CORDON: Technique = {
  name: 'Cordones alternos en tubo de pared fina',
  why: 'Con 1,5 o 2 mm de pared hay muy poco metal para absorber el calor: Miller advierte que en material de menos de 1/8 de pulgada el exceso de calor perfora la pieza. Además, cada cordón encoge al enfriarse y tira del bastidor; TWI recomienda poco volumen de soldadura y un orden que equilibre las tensiones, así que se reparte el calor saltando de una unión a la opuesta.',
  how: [
    'Cordón recto, sin balanceo: Miller indica que en material de 1/4 de pulgada o menos basta un cordón recto, y aporta menos calor.',
    'Con electrodo, arco corto (no más largo que el alma del electrodo); con hilo, poco hilo fuera de la boquilla. Avance constante, con el arco en el tercio delantero del baño (Miller).',
    'Ajuste apretado: Lincoln supone en sus tablas de chapa un ajuste apretado y un punteado adecuado. Si queda un hueco, baja la corriente y aumenta el ángulo de arrastre.',
    'Suelda una cara de una unión, salta a la unión opuesta en diagonal, después a las otras dos, y vuelve para la cara siguiente cuando la primera ya no esté al rojo.',
    'Si se abre un agujero, para, deja enfriar y ciérralo con puntos cortos desde los bordes hacia el centro.',
  ],
};

// ---------- pasos comunes ----------
export function pasoCortar(o: { proceso: Proceso; lineas: string[]; madera?: string }): Step {
  return {
    kind: 'cortar',
    title: 'Corta los tubos y las piezas',
    summary: 'Deja cada tubo, pletina y tablero a su medida, con su letra, antes de soldar nada.',
    detail: [
      'Repasa la lista de corte: todas las medidas de tubo son finales y los cortes son rectos, a 90°.',
      ...o.lineas,
      'Corta las piezas iguales con un tope (un taco sujeto con sargento en la mesa de corte): lo importante es que midan exactamente lo mismo entre sí.',
      'Escribe la letra de cada pieza con rotulador de pintura y quita la rebaba de los cortes por dentro y por fuera con una lima o el disco de láminas.',
      ...(o.madera ? [o.madera] : []),
    ],
    parts: [],
    technique: TEC_CORTE,
    tools: ['Flexómetro', 'Escuadra de acero', 'Rayador o rotulador de pintura', 'Tronzadora de disco o amoladora con disco de corte para metal', 'Tornillo de banco o sargentos', 'Lima plana'],
    hardware: [hw('Disco de corte para metal para amoladora', 2), hw('Disco de láminas para metal, grano medio', 1)],
    check: 'Junta las piezas iguales de pie sobre una superficie plana: ninguna debe sobresalir. Comprueba la escuadra de cada corte.',
    tip: 'Las esquinas también se pueden cortar a inglete (45°): quedan más limpias, pero cada pareja de cortes tiene que sumar 90° exactos y el hueco que deje se nota mucho en pared fina. Para el primer proyecto, el corte recto a tope es mucho más indulgente; el modelo y la lista de corte están hechos a tope.',
    warning: 'El disco de corte lanza chispas y fragmentos: gafas, guantes y nada inflamable cerca. No uses un disco de corte para desbastar de lado.',
  };
}

export function pasoPreparar(o: { proceso: Proceso; extra?: string[] }): Step {
  const info = infoProceso(o.proceso);
  return {
    kind: 'preparar',
    title: 'Limpia los extremos y prepara el puesto',
    summary: 'El metal limpio y un equipo bien ajustado evitan casi todos los defectos de un primer cordón.',
    detail: [
      'Identifica el tubo: si es galvanizado (brillo plateado con aguas), no lo sueldes tal cual; elimina el zinc a ambos lados de la junta o cambia de tubo.',
      'Con el disco de láminas o un cepillo de alambre, deja brillante cada extremo y la zona de la cara donde apoya (un par de centímetros alrededor de cada unión), y también el punto donde irá la pinza de masa.',
      'Desengrasa justo antes de soldar (TWI): la grasa y la humedad provocan poros. No uses desengrasantes clorados cerca de la soldadura (INSST).',
      ...(o.extra ?? []),
      ...info.ajuste,
      'Despeja el puesto: nada combustible alrededor, extintor a mano, suelo seco y extracción de humos colocada junto a la mesa.',
    ],
    parts: [],
    hardware: [hw('Desengrasante no clorado o alcohol', 1, 'bote'), info.consumible],
    tools: ['Amoladora con disco de láminas o cepillo de alambre', ...info.equipo, 'Careta de soldar', 'Guantes de soldador', 'Extintor'],
    check: 'Haz dos o tres cordones de prueba en un recorte del mismo tubo hasta que el cordón moje los dos lados sin perforar.',
    tip: 'Sujeta la pinza de masa en una zona limpia de la mesa de soldar o de la propia pieza, lo más cerca posible de la unión.',
  };
}

export function pasoCordones(o: { proceso: Proceso; marks: Mark[]; orden: string[]; parts?: string[]; nUniones: number; extra?: string[] }): Step {
  const info = infoProceso(o.proceso);
  return {
    kind: 'soldar',
    title: 'Suelda los cordones definitivos alternando',
    summary: `Cierra las ${o.nUniones} uniones con cordones cortos, repartiendo el calor de una esquina a la opuesta.`,
    detail: [
      'Usa el ajuste con el que te salieron bien los cordones de prueba en el recorte y comprueba antes de empezar que la pinza de masa está bien sujeta en metal limpio.',
      ...o.orden,
      ...(o.extra ?? []),
      'Pica la escoria y cepilla cada cordón antes de soldar el siguiente tramo que lo toque: la escoria atrapada debilita la unión (TWI).',
    ],
    parts: o.parts ?? [],
    marks: o.marks,
    technique: TEC_CORDON,
    tools: [...info.equipo, 'Careta de soldar', 'Guantes de soldador', 'Escuadra de acero', 'Flexómetro'],
    check: 'A mitad del proceso y al terminar, vuelve a medir las diagonales y apoya la pieza en el suelo: si algo ha tirado, el siguiente cordón dalo en el lado contrario.',
    tip: 'Antes de soldar cada unión, colócate cómodo y apoya el antebrazo: un cordón corto y seguido sale mejor que uno largo con el pulso cansado.',
    warning: 'Si el baño se hunde y se abre un agujero, no insistas en el mismo sitio: deja enfriar y ciérralo con puntos desde los bordes.',
  };
}

export function pasoRepasar(extra: string[] = []): Step {
  return {
    kind: 'preparar',
    title: 'Limpia y repasa las soldaduras',
    summary: 'Quita la escoria, revisa cada cordón y deja planas las caras donde apoya la madera.',
    detail: [
      'Pica toda la escoria con la piqueta y cepilla los cordones: sin escoria puedes ver si el cordón ha fundido bien los dos lados (TWI).',
      'Busca poros, grietas o tramos donde el cordón no ha mojado el tubo. Si los hay, limpia con la amoladora y repasa con un cordón corto.',
      ...extra,
      'Si quieres un acabado limpio, repasa los cordones vistos con el disco de láminas sin comer el tubo: en pared fina, si amolas de más debilitas la unión.',
      'Lima o amola cualquier proyección o arista que pueda cortar.',
    ],
    parts: [],
    tools: ['Piqueta', 'Cepillo de alambre', 'Amoladora con disco de láminas', 'Gafas de seguridad'],
    hardware: [hw('Disco de láminas para metal, grano medio', 1)],
    check: 'Pasa la mano con guante por todas las aristas y uniones: nada debe engancharse.',
  };
}

export function pasoPintar(o: { exterior?: boolean; madera?: string } = {}): Step {
  return {
    kind: 'acabar',
    title: 'Imprima y pinta el acero',
    summary: 'Una imprimación antioxidante y una o dos manos de esmalte protegen el tubo del óxido.',
    detail: [
      'Quita por completo la escoria y el polvo de amolar antes de pintar: TWI lo cita como motivo para retirar la escoria, para dejar una superficie limpia.',
      'Desengrasa toda la pieza y deja que se seque.',
      'Aplica la imprimación antioxidante a brocha o pistola, insistiendo en los cordones y en las esquinas interiores.',
      `Da el esmalte respetando los tiempos de secado y repintado de la ficha técnica del fabricante${o.exterior ? '; a la intemperie, no te saltes la segunda mano' : ''}.`,
      ...(o.madera ? [o.madera] : []),
    ],
    parts: [],
    hardware: [hw('Imprimación antioxidante para metal', 1, 'bote'), hw(`Esmalte para metal${o.exterior ? ' apto para exterior' : ''}`, 1, 'bote')],
    tools: ['Brocha o pistola de pintura', 'Paños', 'Guantes de nitrilo', 'Mascarilla para vapores orgánicos si pintas a pistola'],
    tip: 'Cuelga o apoya la pieza sobre tacos para pintar también las caras de abajo de una vez.',
  };
}

// =====================================================================================
// Generador del taburete
// =====================================================================================

const T_ASIENTO = 28; // grueso del asiento (mm), decisión de diseño
const T_BALDA = 18;
const OREJA = { w: 30, t: 4, l: 40 }; // orejeta de pletina 30×4, 40 mm de largo

export const tabureteAcero: Generator = {
  id: 'taburete-acero',
  title: 'Taburete de taller',
  craft: 'soldadura',
  difficulty: 1,
  description:
    'Taburete de tubo cuadrado con asiento de madera atornillado. Pocas piezas y cordones cortos: es el primer proyecto ideal para aprender a puntear y soldar tubo fino.',
  params: [
    { key: 'alto', label: 'Alto del asiento', type: 'number', min: 380, max: 760, step: 10, unit: 'mm', default: 460, group: 'Medidas', help: 'Del suelo a la cara superior del asiento. Bajo para trabajar sentado en el suelo del taller; alto para usarlo junto a un banco de trabajo.' },
    { key: 'asiento', label: 'Tamaño del asiento', type: 'number', min: 300, max: 420, step: 10, unit: 'mm', default: 340, group: 'Medidas', help: 'Lado del asiento cuadrado o diámetro del redondo.' },
    {
      key: 'forma', label: 'Forma del asiento', type: 'select', default: 'cuadrado', group: 'Forma',
      options: [
        { value: 'cuadrado', label: 'Cuadrado', hint: 'El más fácil de cortar' },
        { value: 'redondo', label: 'Redondo', hint: 'Se corta con sierra de calar; la base queda inscrita' },
      ],
    },
    { key: 'vuelo', label: 'Vuelo del asiento', type: 'number', min: 0, max: 40, step: 5, unit: 'mm', default: 15, group: 'Forma', help: 'Cuánto sobresale el asiento de las patas.', visible: (v) => v.forma !== 'redondo' },
    {
      key: 'seccion', label: 'Sección del tubo', type: 'select', default: '30', group: 'Forma',
      options: [
        { value: '30', label: '30 × 30 × 1,5 mm', hint: 'Ligero, cordones cortos' },
        { value: '40', label: '40 × 40 × 1,5 mm', hint: 'Más robusto y estable' },
      ],
    },
    { key: 'reposapies', label: 'Reposapiés', type: 'boolean', default: true, group: 'Detalles', help: 'Un segundo aro de travesaños abajo: apoya los pies y rigidiza las patas.' },
    { key: 'altoReposapies', label: 'Altura del reposapiés', type: 'number', min: 120, max: 400, step: 10, unit: 'mm', default: 180, group: 'Detalles', help: 'Del suelo a la cara superior del travesaño.', visible: (v) => v.reposapies === true },
    { key: 'balda', label: 'Bandeja sobre el reposapiés', type: 'boolean', default: false, group: 'Detalles', help: 'Tablero pequeño para dejar herramientas, apoyado en el aro inferior.', visible: (v) => v.reposapies === true },
    {
      key: 'pies', label: 'Pies', type: 'select', default: 'tapon', group: 'Detalles',
      options: [
        { value: 'tapon', label: 'Tapones de plástico', hint: 'Cierran el tubo y protegen el suelo' },
        { value: 'nivelador', label: 'Pies niveladores', hint: 'Para suelos de taller irregulares' },
      ],
    },
    {
      key: 'estructura', label: 'Esquinas del aro superior', type: 'select', default: 'patas', group: 'Uniones',
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
    { id: 'bajo', name: 'Taburete bajo', blurb: 'Asiento a 45 cm, cuadrado y con reposapiés: el primero que deberías soldar.', values: { alto: 450, asiento: 340, forma: 'cuadrado', vuelo: 15, seccion: '30', reposapies: true, altoReposapies: 170, balda: false, pies: 'tapon', estructura: 'patas', proceso: 'electrodo' } },
    { id: 'banco', name: 'Taburete de banco', blurb: 'Alto (66 cm) para trabajar junto al banco, con bandeja y niveladores.', values: { alto: 660, asiento: 360, forma: 'cuadrado', vuelo: 20, seccion: '40', reposapies: true, altoReposapies: 280, balda: true, pies: 'nivelador', estructura: 'patas', proceso: 'electrodo' } },
    { id: 'redondo', name: 'Taburete redondo', blurb: 'Asiento redondo de 38 cm sobre un marco soldado, con hilo sin gas.', values: { alto: 600, asiento: 380, forma: 'redondo', seccion: '30', reposapies: true, altoReposapies: 240, balda: false, pies: 'tapon', estructura: 'marco', proceso: 'hilo' } },
  ],
  build: buildTaburete,
};

function buildTaburete(v: ParamValues) {
  const H = Number(v.alto), A = Number(v.asiento);
  const redondo = v.forma === 'redondo';
  const vu = redondo ? 0 : Number(v.vuelo);
  const sec = SECCIONES[String(v.seccion)] ?? SECCIONES['30'];
  const s = sec.s, wall = sec.wall;
  const repos = v.reposapies === true;
  const balda = repos && v.balda === true;
  const nivel = v.pies === 'nivelador';
  const marco = v.estructura === 'marco';
  const proceso: Proceso = v.proceso === 'hilo' ? 'hilo' : 'electrodo';
  const info = infoProceso(proceso);

  // lado del bastidor (exterior de las patas)
  const F = redondo ? Math.floor((A / 2 - 8) * Math.SQRT2) : A - 2 * vu;
  const o = (A - F) / 2; // desplazamiento para que el asiento empiece en 0
  const hPie = nivel ? 20 : 3;
  const legTop = H - T_ASIENTO; // cara inferior del asiento
  const yTopRail = legTop - s; // cara inferior del aro superior
  const legLen = (marco ? yTopRail : legTop) - hPie;
  const yR = Math.max(hPie + s + 60, Math.min(Number(v.altoReposapies ?? 180), yTopRail - 120)); // cara superior del reposapiés
  const Lc = F - 2 * s; // travesaño entre patas
  const x0 = o, x1 = o + F - s; // posiciones mínimas de las patas
  const L = letras();
  const b = new Builder();
  const tubo = (name: string, len: number, axis: Axis, at: Vec3) => {
    const r = L(`tubo|${s}|${wall}|${len}`, name);
    return b.tubo({ ref: r.ref, name: r.name, section: [s, s], wall, length: len, axis, at });
  };

  // --- piezas, en orden de montaje ---
  // aro superior
  const supX: string[] = []; // travesaños a lo ancho (frente y trasera)
  const supZ: string[] = []; // a lo fondo (laterales)
  let patas: string[] = [];
  const mkPatas = () =>
    [[x0, x0], [x1, x0], [x0, x1], [x1, x1]].map(([x, z]) => tubo('Pata', legLen, 'y', [x, hPie, z]));
  if (marco) {
    for (const z of [x0, x1]) supX.push(tubo('Larguero del marco', F, 'x', [o, yTopRail, z]));
    for (const x of [x0, x1]) supZ.push(tubo('Travesaño', Lc, 'z', [x, yTopRail, o + s]));
    patas = mkPatas();
  } else {
    patas = mkPatas();
    for (const z of [x0, x1]) supX.push(tubo('Travesaño', Lc, 'x', [o + s, yTopRail, z]));
    for (const x of [x0, x1]) supZ.push(tubo('Travesaño', Lc, 'z', [x, yTopRail, o + s]));
  }
  // reposapiés
  const infX = repos ? [x0, x1].map((z) => tubo('Travesaño', Lc, 'x', [o + s, yR - s, z])) : [];
  const infZ = repos ? [x0, x1].map((x) => tubo('Travesaño', Lc, 'z', [x, yR - s, o + s])) : [];

  // orejetas del asiento (y de la bandeja)
  const rOre = L(`pletina|${OREJA.w}x${OREJA.t}|${OREJA.l}`, 'Orejeta de fijación');
  const c = o + F / 2;
  const oreja = (side: 'f' | 't' | 'i' | 'd', yTop: number) => {
    const at: Vec3 =
      side === 'f' ? [c - OREJA.w / 2, yTop - OREJA.t, o + s]
      : side === 't' ? [c - OREJA.w / 2, yTop - OREJA.t, o + F - s - OREJA.l]
      : side === 'i' ? [o + s, yTop - OREJA.t, c - OREJA.w / 2]
      : [o + F - s - OREJA.l, yTop - OREJA.t, c - OREJA.w / 2];
    const axis: Axis = side === 'f' || side === 't' ? 'z' : 'x';
    const section: [number, number] = axis === 'z' ? [OREJA.w, OREJA.t] : [OREJA.t, OREJA.w];
    const id = b.pletina({ ref: rOre.ref, name: rOre.name, section, length: OREJA.l, axis, at });
    const end: End = side === 'f' || side === 'i' ? 'min' : 'max';
    // agujero a 25 mm de la cara del tubo
    const d = 25;
    const hole: Vec3 =
      side === 'f' ? [c, yTop, o + s + d] : side === 't' ? [c, yTop, o + F - s - d] : side === 'i' ? [o + s + d, yTop, c] : [o + F - s - d, yTop, c];
    return { id, end, hole };
  };
  const orejas = (['f', 't', 'i', 'd'] as const).map((sd) => oreja(sd, legTop));
  const orejasBalda = balda ? (['f', 't'] as const).map((sd) => oreja(sd, yR)) : [];

  // tapones de los extremos abiertos del marco
  const stockTapon = `Tapón de plástico con ala para tubo cuadrado ${s}×${s} mm (pared ${fmtNum(wall)} mm)`;
  const stockNivel = `Tapón roscado para tubo cuadrado ${s}×${s} mm con pie nivelador`;
  const tapon = (size: Vec3, at: Vec3) => {
    const r = L(`tapon|${s}`, `Tapón para tubo ${s}×${s}`);
    return b.herraje({ ref: r.ref, name: r.name, size, at, stock: stockTapon });
  };
  // pies
  const pies = [[x0, x0], [x1, x0], [x0, x1], [x1, x1]].map(([x, z]) => {
    if (!nivel) return tapon([s, hPie, s], [x, 0, z]);
    const r = L(`nivel|${s}`, 'Pie nivelador');
    return b.herraje({ ref: r.ref, name: r.name, size: [s - 4, hPie, s - 4], at: [x + 2, 0, z + 2], stock: stockNivel });
  });
  const taponesMarco = marco
    ? [x0, x1].flatMap((z) => [tapon([3, s, s], [o - 3, yTopRail, z]), tapon([3, s, s], [o + F, yTopRail, z])])
    : [];

  // asiento y bandeja
  const rAs = L(`asiento|${redondo}|${A}`, redondo ? 'Asiento redondo' : 'Asiento');
  let asiento: string;
  if (redondo) {
    asiento = b.redondo({ ref: rAs.ref, name: rAs.name, material: 'pino', diameter: A, length: T_ASIENTO, axis: 'y', at: [0, legTop, 0] });
    const p = pieza(b, asiento);
    p.stock = `Tablero alistonado de pino ${T_ASIENTO} mm`;
    p.stockKind = 'tablero';
    p.cut = [A, A, T_ASIENTO];
    p.note = `Círculo de Ø${A} mm cortado de un cuadrado de ${A} × ${A} mm.`;
  } else {
    asiento = b.panel({ ref: rAs.ref, name: rAs.name, thickness: T_ASIENTO, face: [A, A], normal: 'y', at: [0, legTop, 0] });
  }
  const bandeja: string[] = [];
  if (balda) {
    const r = L(`balda|${Lc}|${F}`, 'Bandeja');
    bandeja.push(b.panel({ ref: r.ref, name: r.name, thickness: T_BALDA, face: [Lc, F], normal: 'y', at: [o + s, yR, o] }));
  }

  // --- marcas ---
  // uniones a tope: [pieza, extremo]
  type J = [string, End];
  const ends = (ids: string[]): J[] => ids.flatMap((id) => [[id, 'min'], [id, 'max']] as J[]);
  const jSupX: J[] = marco ? [] : ends(supX);
  const jSupZ: J[] = ends(supZ);
  const jPatas: J[] = marco ? patas.map((id) => [id, 'max'] as J) : [];
  const jInf: J[] = [...ends(infX), ...ends(infZ)];
  const todasOre = [...orejas, ...orejasBalda];
  const cordonesOre = todasOre.flatMap((q) => cordonesTope(b, q.id, q.end, true));
  const puntosOre = todasOre.flatMap((q) => puntoOrejeta(b, q.id, q.end));
  const cord = (js: J[]) => js.flatMap(([id, e]) => cordonesTope(b, id, e));
  const nUniones = jSupX.length + jSupZ.length + jPatas.length + jInf.length;

  // --- pasos ---
  b.step(pasoCortar({
    proceso,
    lineas: [
      `Patas: ${patas.length} tubos de ${mm(legLen)}. Travesaños: ${supZ.length + (marco ? 0 : supX.length) + infX.length + infZ.length} tubos de ${mm(Lc)}${marco ? `, y 2 largueros del marco de ${mm(F)}` : ''}.`,
      `Orejetas: ${todasOre.length} trozos de pletina ${OREJA.w}×${OREJA.t} de ${mm(OREJA.l)}. Taladra en cada una, a 25 mm de un extremo y centrado, un agujero de paso un poco mayor que el tornillo del asiento.`,
    ],
    madera: redondo
      ? `Asiento: traza un círculo de Ø${A} mm en el tablero con un compás de varilla (un listón con un clavo y un lápiz) y córtalo con sierra de calar por fuera de la línea; acaba con lija.`
      : `Asiento: corta un cuadrado de ${A} × ${A} mm${balda ? ` y la bandeja de ${Lc} × ${F} mm` : ''}, y redondea ligeramente las esquinas.`,
  }));

  b.step(pasoPreparar({ proceso }));

  if (marco) {
    b.step({
      kind: 'soldar',
      title: 'Puntea el marco del asiento en plano',
      summary: 'Los cuatro tubos del aro superior forman un marco cuadrado que se puntea sobre una superficie plana.',
      detail: [
        'Apoya los dos largueros y los dos travesaños sobre la mesa de soldar o sobre una chapa gruesa bien plana, con la cara que irá arriba hacia abajo.',
        `Los travesaños van entre los largueros, a tope contra su cara interior; los extremos de los largueros quedan a ras de la cara exterior de los travesaños. El marco mide ${mm(F)} × ${mm(F)}.`,
        'Sujeta cada esquina con un imán de soldador o una escuadra y un sargento, comprobando que las caras de arriba quedan enrasadas.',
        ...TEC_PUNTEO.how.slice(0, 2),
        'Da la vuelta al marco y puntea las caras opuestas.',
      ],
      parts: [...supX, ...supZ],
      marks: jSupZ.flatMap(([id, e]) => puntosTope(b, id, e, 'y')),
      technique: TEC_PUNTEO,
      tools: ['Mesa de soldar o superficie plana de acero', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', ...info.equipo.slice(0, 1)],
      check: `Mide las dos diagonales del marco de esquina exterior a esquina exterior: deben ser iguales (unos ${mm(F * Math.SQRT2)}). Si no, afloja con un golpe de maza la esquina larga, o rompe el punto y vuelve a puntear.`,
      warning: 'Todavía no sueldes ningún cordón: solo puntos. Un marco soldado del todo antes de comprobarlo ya no se puede corregir.',
    });
  } else {
    b.step({
      kind: 'soldar',
      title: 'Puntea los bastidores delantero y trasero',
      summary: `Cada bastidor son dos patas unidas por su travesaño superior${repos ? ' y el del reposapiés' : ''}, punteados en plano.`,
      detail: [
        'Tumba dos patas sobre la mesa de soldar, paralelas, y mete entre ellas el travesaño superior a tope, enrasado con el extremo de las patas y con sus caras.',
        ...(repos ? [`Coloca el travesaño del reposapiés con su cara superior a ${mm(yR - hPie)} del extremo inferior de las patas (${mm(yR)} del suelo con los pies puestos).`] : []),
        'Sujeta con imanes de soldador o sargentos y comprueba la escuadra en cada esquina.',
        ...TEC_PUNTEO.how.slice(0, 2),
        'Da la vuelta al bastidor, puntea las caras opuestas y repite con el segundo bastidor, usando el primero como plantilla.',
      ],
      parts: [patas[0], patas[1], patas[2], patas[3], ...supX, ...infX],
      marks: [...jSupX, ...ends(infX)].flatMap(([id, e]) => puntosTope(b, id, e, 'z')),
      technique: TEC_PUNTEO,
      tools: ['Mesa de soldar o superficie plana de acero', 'Imanes de soldador a 90°', 'Escuadra de acero', 'Sargentos', ...info.equipo.slice(0, 1)],
      check: 'Mide las diagonales de cada bastidor (de esquina a esquina de las patas): deben ser iguales. Pon un bastidor encima del otro: deben coincidir.',
      warning: 'Solo puntos, todavía ningún cordón: un bastidor soldado del todo antes de comprobarlo ya no se puede corregir.',
    });
  }

  const conjuntoParts = marco ? [...patas, ...infX, ...infZ, ...todasOre.map((q) => q.id)] : [...supZ, ...infZ, ...todasOre.map((q) => q.id)];
  const puntosConjunto: Mark[] = marco
    ? [...jPatas.flatMap(([id, e]) => puntosTope(b, id, e, 'x')), ...ends(infX).flatMap(([id, e]) => puntosTope(b, id, e, 'z')), ...ends(infZ).flatMap(([id, e]) => puntosTope(b, id, e, 'x')), ...puntosOre]
    : [...jSupZ.flatMap(([id, e]) => puntosTope(b, id, e, 'x')), ...ends(infZ).flatMap(([id, e]) => puntosTope(b, id, e, 'x')), ...puntosOre];
  b.step({
    kind: 'soldar',
    title: marco ? 'Puntea las patas bajo el marco' : 'Une los bastidores con los travesaños laterales',
    summary: marco
      ? `Las cuatro patas apoyan a tope bajo las esquinas del marco${repos ? ' y el reposapiés las une abajo' : ''}; se añaden las orejetas.`
      : `Los travesaños laterales cierran el aro superior${repos ? ' y el reposapiés' : ''}; se añaden las orejetas del asiento.`,
    detail: marco
      ? [
          'Deja el marco boca abajo sobre la mesa y pon cada pata de pie sobre una esquina, a ras de las dos caras exteriores.',
          'Puntea cada pata por una cara, comprueba con la escuadra que está vertical en los dos sentidos y puntea la cara opuesta.',
          ...(repos ? [`Puntea los travesaños del reposapiés entre las patas, con su cara superior a ${mm(yR - hPie)} del extremo libre de las patas.`] : []),
          `Puntea las orejetas por debajo, enrasadas con la cara del tubo donde apoyará el asiento${balda ? ' (y las dos de la bandeja en el reposapiés)' : ''}, con el agujero hacia dentro.`,
        ]
      : [
          'Pon los dos bastidores de pie, boca abajo (patas hacia arriba) sobre la mesa plana, y presenta entre ellos los travesaños laterales.',
          'Puntea cada travesaño por una cara, comprueba la escuadra de la esquina y puntea la cara opuesta.',
          ...(repos ? ['Haz lo mismo con los travesaños laterales del reposapiés, a la misma altura que los de los bastidores.'] : []),
          `Puntea las orejetas por debajo, enrasadas con la cara del tubo donde apoyará el asiento${balda ? ' (y las dos de la bandeja en el reposapiés)' : ''}, con el agujero hacia dentro.`,
        ],
    parts: conjuntoParts,
    marks: puntosConjunto,
    technique: TEC_PUNTEO,
    tools: ['Escuadra de acero', 'Nivel', 'Imanes de soldador a 90°', 'Sargentos', ...info.equipo.slice(0, 1)],
    check: `Pon el taburete de pie sobre el suelo plano: las cuatro patas deben tocar sin cojear. Mide las diagonales del aro superior (deben ser iguales, unos ${mm(F * Math.SQRT2)}) y comprueba que las patas están a plomo.`,
    tip: 'Si cojea, no lo fuerces: rompe el punto de la pata que se levanta y vuelve a puntearla con el taburete apoyado en el suelo plano.',
  });

  b.step(pasoCordones({
    proceso,
    nUniones: nUniones + todasOre.length,
    marks: [...cord([...jSupX, ...jSupZ, ...jPatas, ...jInf]), ...cordonesOre],
    orden: [
      `Orden: empieza por la cara exterior de la esquina delantera izquierda del aro superior, salta a la trasera derecha (la diagonal), luego a la delantera derecha y a la trasera izquierda.`,
      'Repite la misma ronda con las caras interiores y después con las de abajo; las de arriba, donde apoyará el asiento, al final y con cordón fino, porque luego se amolan a ras.',
      ...(repos ? ['Haz lo mismo con el reposapiés, alternando de una esquina a la opuesta.'] : []),
      'Las orejetas se sueldan solo por debajo y por los cantos: arriba quedan enrasadas con el tubo y ahí apoya el asiento.',
    ],
  }));

  b.step(pasoRepasar(['Amola a ras los cordones de la cara de arriba del aro superior (y de las orejetas): el asiento tiene que apoyar plano.']));

  b.step(pasoPintar({ madera: 'Mientras seca la pintura, lija el asiento, matando las aristas, y dale aceite o barniz por las dos caras.' }));

  const tornAsiento = orejas.map((q) => q.hole);
  const tornBalda = orejasBalda.map((q) => q.hole);
  b.step({
    kind: 'montar',
    title: nivel ? 'Pon los niveladores y atornilla el asiento' : 'Pon los tapones y atornilla el asiento',
    summary: 'El asiento se atornilla desde abajo a través de las orejetas, sin que ningún tornillo asome por arriba.',
    detail: [
      nivel
        ? 'Mete a presión los tapones roscados en el extremo inferior de las patas (con un mazo de goma) y enrosca los niveladores hasta el fondo.'
        : `Mete a presión los tapones en el extremo inferior de las patas con un mazo de goma${marco ? ' y en los cuatro extremos abiertos de los largueros del marco' : ''}.`,
      ...(nivel && marco ? ['Pon también tapones en los cuatro extremos abiertos de los largueros del marco.'] : []),
      `Pon el asiento boca abajo sobre una manta y centra el taburete encima, también boca abajo${redondo ? '' : `, con el mismo vuelo en los cuatro lados (${mm(vu)})`}.`,
      `Marca los agujeros de las ${orejas.length} orejetas, haz un taladro piloto en la madera con tope de profundidad para no atravesarla y atornilla.`,
      `El tornillo de 25 mm pasa la orejeta de ${OREJA.t} mm y entra unos 21 mm en un asiento de ${T_ASIENTO} mm: no uses uno más largo.`,
      ...(balda ? ['Coloca la bandeja sobre el reposapiés y atorníllala desde abajo por sus dos orejetas con tornillos de 16 mm.'] : []),
    ],
    parts: [...pies, ...taponesMarco, asiento, ...bandeja],
    marks: [...tornillos(tornAsiento, 'y'), ...tornillos(tornBalda, 'y')],
    hardware: [
      hw('Tornillo para madera 4 × 25 mm, cabeza plana', orejas.length),
      ...(balda ? [hw('Tornillo para madera 3,5 × 16 mm, cabeza plana', orejasBalda.length)] : []),
      ...((nivel ? 0 : 4) + taponesMarco.length > 0 ? [hw(stockTapon, (nivel ? 0 : 4) + taponesMarco.length)] : []),
      ...(nivel ? [hw(stockNivel, 4)] : []),
    ],
    tools: ['Taladro atornillador', 'Broca para madera con tope de profundidad', 'Mazo de goma', 'Manta o cartón'],
    check: 'Siéntate y balancéate con cuidado: no debe crujir ni cojear. Si cojea, ajusta un nivelador (o revisa la pata corta).',
  });

  b.step({
    kind: 'acabar',
    title: 'Revisa y estrena',
    summary: 'Un último repaso de tornillos, cantos y pintura antes de darle uso.',
    detail: [
      'Repasa con pintura cualquier roce que haya quedado al montar.',
      'Comprueba que ninguna arista de tubo o pletina corta al pasar la mano.',
      'Vuelve a apretar los tornillos del asiento al cabo de unas semanas: la madera se asienta.',
      'No lo uses como escalera para subirte: es un asiento.',
    ],
    parts: [],
    tools: ['Destornillador', 'Pincel fino'],
    tip: 'Guarda un recorte de tubo con tus cordones de prueba: es la mejor referencia para el siguiente proyecto.',
  });

  return b.finish({
    id: 'taburete-acero',
    title: 'Taburete de taller',
    craft: 'soldadura',
    summary: `Taburete de tubo ${sec.label} con asiento ${redondo ? `redondo de Ø${A}` : `de ${A} × ${A}`} mm a ${Math.round(H / 10)} cm del suelo${repos ? ', con reposapiés' : ''}${balda ? ' y bandeja' : ''}.`,
    difficulty: 1,
    hours: 5 + (repos ? 1 : 0) + (marco ? 0.5 : 0) + (redondo ? 0.5 : 0),
    safety: seguridadSoldadura(proceso),
    notes: [
      'Todas las uniones son a tope con cortes rectos: el tubo más corto apoya contra la cara del otro. Es lo más sencillo de ajustar y de puntear para empezar.',
      `Los cordones del aro superior quedan enrasados bajo el asiento: amólalos a ras antes de pintar.`,
      'La altura de asiento de una silla de trabajo que recoge la Universidad de Almería va de 42 a 53 cm; un taburete para trabajar junto a un banco alto necesita más. Pruébala con tu banco antes de cortar las patas.',
      'Las secciones de tubo son una decisión de diseño; compruébalas en tu almacén de hierros.',
    ],
    sources: fuentesSoldaduraProyecto(proceso, [UAL_PUESTO]),
    spec: [
      { label: 'Medidas', value: redondo ? `Asiento Ø${A} mm, alto ${H} mm` : `${A} × ${A} mm, alto ${H} mm` },
      { label: 'Tubo', value: sec.label },
      { label: 'Base', value: `${F} × ${F} mm, patas rectas` },
      { label: 'Reposapiés', value: repos ? `Sí, a ${yR} mm del suelo` : 'No' },
      { label: 'Bandeja', value: balda ? 'Sí' : 'No' },
      { label: 'Pies', value: nivel ? 'Niveladores' : 'Tapones de plástico' },
      { label: 'Esquinas', value: marco ? 'Marco sobre patas, a tope' : 'Patas pasantes, a tope' },
      { label: 'Proceso', value: info.nombre },
    ],
  });
}
