/**
 * Modelos 3D de los ensambles de `ensambles.ts` (mismos `id`).
 *
 * Cada ensamble es un `Project` pequeño hecho con el `Builder`: las piezas a tamaño de listón real,
 * talladas con su geometría (espigas, cajas, colas de milano, cuñas, pasadores…). Una pieza con un
 * hueco tallado se descompone en varias piezas contiguas (cajas o prismas) que dejan el hueco, de modo
 * que el ensamble cerrado encaja sin solapes y abierto se ve por dentro.
 *
 * Además de la posición cerrada, cada pieza guarda cómo sale del ensamble (dirección real de montaje,
 * por etapas: primero cuñas y pasadores, luego la pieza macho). `openJoint()` aplica esa apertura.
 * Las medidas de diseño (secciones, largos, holguras) son decisiones de este modelo; las proporciones
 * que dan las fuentes (espiga de un tercio del grueso, cuñas de 5° o menos, colas de 15°, tubillón
 * entre un tercio y la mitad del grueso…) vienen de `ensambles.ts`.
 */
import { Builder } from '../core/builder';
import type { Axis, MaterialId, Project, Vec3 } from '../core/types';
import { ensambles } from './ensambles';

/** Tramo de apertura: desplazamiento `d` (mm) que la pieza recorre en la etapa `stage` (0 = primero en salir). */
interface Move {
  d: Vec3;
  stage: number;
}

const MOVES = new WeakMap<Project, Map<string, Move[]>>();

type Poly = [number, number][];

/** Pequeño ayudante sobre `Builder` para describir un ensamble. */
class J {
  b = new Builder();
  private mv = new Map<string, Move[]>();
  private n = 0;

  constructor(private id: string) {}

  private ref(): string {
    const i = this.n++;
    return i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);
  }

  /** Pieza prismática ortogonal dada por su esquina mínima y su tamaño [x, y, z]. */
  box(name: string, material: MaterialId, at: Vec3, size: Vec3): string {
    const [x, y, z] = size;
    const axis: Axis = x >= y && x >= z ? 'x' : y >= z ? 'y' : 'z';
    const o = axis === 'x' ? { length: x, section: [y, z] as [number, number] } : axis === 'y' ? { length: y, section: [x, z] as [number, number] } : { length: z, section: [x, y] as [number, number] };
    return this.b.liston({ ref: this.ref(), name, material, at, axis, ...o });
  }

  /** Polígono extruido (ver `Builder.prisma`). */
  prism(name: string, material: MaterialId, at: Vec3, normal: Axis, thickness: number, poly: Poly): string {
    return this.b.prisma({ ref: this.ref(), name, material, at, normal, thickness, poly, stockKind: 'lineal' });
  }

  /** Tubillón o clavija redonda. */
  dowel(name: string, at: Vec3, diameter: number, length: number, axis: Axis): string {
    return this.b.redondo({ ref: this.ref(), name, at, diameter, length, axis, material: 'haya' });
  }

  /** Las piezas `ids` forman un solo cuerpo que sale del ensamble con estos tramos. */
  move(ids: string[], ...moves: Move[]): void {
    for (const id of ids) this.mv.set(id, moves);
  }

  step(title: string, summary: string, parts: string[]): void {
    this.b.step({ title, summary, detail: [], parts, kind: 'montar' });
  }

  done(): Project {
    const j = ensambles.find((e) => e.id === this.id);
    const p = this.b.finish({
      id: `ensamble-${this.id}`,
      title: j?.name ?? this.id,
      craft: 'carpinteria',
      summary: j?.description ?? '',
      difficulty: j?.difficulty ?? 2,
      hours: 0,
      safety: [],
      spec: [],
    });
    MOVES.set(p, this.mv);
    return p;
  }
}

const mv = (d: Vec3, stage = 0): Move => ({ d, stage });

/**
 * Rectángulo w × h con muescas semicirculares (taladros partidos por la mitad) en un canto.
 * `side` 'max' → muescas en u = w; 'min' → en u = 0. `centers` en v, de menor a mayor.
 */
function notched(w: number, h: number, side: 'min' | 'max', centers: number[], r: number): Poly {
  const seg = 16;
  const arc = (c: number, down: boolean): Poly =>
    Array.from({ length: seg + 1 }, (_, k) => {
      const a = down ? Math.PI / 2 - (Math.PI * k) / seg : -Math.PI / 2 + (Math.PI * k) / seg;
      const du = r * Math.cos(a);
      return [side === 'max' ? w - du : du, c + r * Math.sin(a)] as [number, number];
    });
  if (side === 'max') return [[0, 0], [w, 0], ...centers.flatMap((c) => arc(c, false)), [w, h], [0, h]];
  return [[0, 0], [w, 0], [w, h], [0, h], ...[...centers].reverse().flatMap((c) => arc(c, true))];
}

// ---------------------------------------------------------------- Occidentales

/** Esquina de bastidor a media madera: listones de 70 × 20, cada uno rebajado la mitad del grueso. */
function mediaMadera(): Project {
  const j = new J('media-madera');
  const a = j.prism('Listón inferior (rebaje arriba)', 'pino', [0, 0, 190], 'z', 70, [[0, 0], [260, 0], [260, 10], [190, 10], [190, 20], [0, 20]]);
  const b = j.prism('Listón superior (rebaje abajo)', 'haya', [190, 0, 0], 'x', 70, [[0, 0], [190, 0], [190, 10], [260, 10], [260, 20], [0, 20]]);
  j.move([b], mv([0, 70, 0]));
  j.step('Listón inferior', 'El rebaje mira hacia arriba: se ha quitado la mitad del grueso en el ancho del otro listón.', [a]);
  j.step('Listón superior', 'Su rebaje mira hacia abajo y apoya sobre el del otro: juntos dan el grueso de un solo listón.', [b]);
  return j.done();
}

/** Pata 45 × 45 con caja ciega y travesaño 45 × 45 con espiga de 15 mm (un tercio) y cuatro hombros. */
function cajaEspigaCiega(): Project {
  const j = new J('caja-espiga-ciega');
  const p1 = j.box('Pata (bajo la caja)', 'pino', [0, 0, 0], [45, 132.5, 45]);
  const p2 = j.prism('Pata (tramo de la caja)', 'pino', [0, 132.5, 0], 'y', 35, [[0, 0], [45, 0], [45, 15], [13, 15], [13, 30], [45, 30], [45, 45], [0, 45]]);
  const p3 = j.box('Pata (sobre la caja)', 'pino', [0, 167.5, 0], [45, 132.5, 45]);
  const t1 = j.box('Travesaño', 'haya', [45, 127.5, 0], [260, 45, 45]);
  const t2 = j.box('Espiga del travesaño', 'haya', [15, 132.5, 15], [30, 35, 15]);
  j.move([t1, t2], mv([110, 0, 0]));
  j.step('Pata con la caja', 'La caja no atraviesa la pata: es 2 mm más honda que la espiga para que quepa la cola.', [p1, p2, p3]);
  j.step('Travesaño con la espiga', 'La espiga tiene un tercio del grueso y los hombros tapan la boca de la caja.', [t1, t2]);
  return j.done();
}

/** La espiga atraviesa la pata y asoma enrasada por la otra cara. */
function cajaEspigaPasante(): Project {
  const j = new J('caja-espiga-pasante');
  const p1 = j.box('Pata (bajo la caja)', 'pino', [0, 0, 260], [45, 132.5, 45]);
  const p2 = j.box('Pata (pared izquierda de la caja)', 'pino', [0, 132.5, 260], [15, 35, 45]);
  const p3 = j.box('Pata (pared derecha de la caja)', 'pino', [30, 132.5, 260], [15, 35, 45]);
  const p4 = j.box('Pata (sobre la caja)', 'pino', [0, 167.5, 260], [45, 132.5, 45]);
  const t1 = j.box('Travesaño', 'haya', [0, 127.5, 0], [45, 45, 260]);
  const t2 = j.box('Espiga pasante', 'haya', [15, 132.5, 260], [15, 35, 45]);
  j.move([t1, t2], mv([0, 0, -120]));
  j.step('Pata con la caja pasante', 'La caja atraviesa la pata de lado a lado.', [p1, p2, p3, p4]);
  j.step('Travesaño con la espiga', 'La espiga recorre todo el grueso de la pata y se ve, enrasada, por la otra cara.', [t1, t2]);
  return j.done();
}

/**
 * Espiga pasante con dos cuñas fijas en cortes de sierra de la testa. Las cuñas (unos 5°) abren la
 * espiga a lo largo de la veta de la pata, hacia los extremos de la caja, que se ensancha hacia la salida.
 */
function espigaAcunada(): Project {
  const j = new J('espiga-acunada');
  // pata: dos mejillas enteras y, entre ellas, la caja con la salida abocinada
  const p1 = j.box('Pata (mejilla izquierda)', 'pino', [0, 0, 260], [15, 300, 45]);
  const p2 = j.box('Pata (mejilla derecha)', 'pino', [30, 0, 260], [15, 300, 45]);
  const p3 = j.prism('Pata (bajo la caja)', 'pino', [15, 0, 260], 'x', 15, [[0, 0], [45, 0], [45, 129.9], [15, 132.5], [0, 132.5]]);
  const p4 = j.prism('Pata (sobre la caja)', 'pino', [15, 167.5, 260], 'x', 15, [[0, 0], [15, 0], [45, 2.6], [45, 132.5], [0, 132.5]]);
  const t1 = j.box('Travesaño', 'haya', [0, 127.5, 0], [45, 45, 260]);
  const t2 = j.prism('Espiga con dos cortes de sierra', 'haya', [15, 129.9, 260], 'x', 15, [
    [0, 2.6], [15, 2.6], [45, 0], [45, 8], [15, 10.6], [45, 10.6], [45, 29.6], [15, 29.6], [45, 32.2], [45, 40.2], [15, 37.6], [0, 37.6],
  ]);
  const c1 = j.prism('Cuña inferior', 'haya', [15, 137.9, 275], 'x', 15, [[0, 2.6], [30, 2.6], [30, 0]]);
  const c2 = j.prism('Cuña superior', 'haya', [15, 159.5, 275], 'x', 15, [[0, 0], [30, 0], [30, 2.6]]);
  j.move([c1, c2], mv([0, 0, 70], 0));
  j.move([t1, t2], mv([0, 0, -120], 1));
  j.step('Pata con la caja', 'Caja pasante, algo más larga por la cara de salida para que la espiga pueda abrirse.', [p1, p2, p3, p4]);
  j.step('Travesaño con la espiga', 'Espiga pasante con dos cortes de sierra en la testa, cerca de sus cantos.', [t1, t2]);
  j.step('Cuñas', 'Las cuñas entran en los cortes y abren la espiga a favor de la veta de la pata, nunca contra sus mejillas.', [c1, c2]);
  return j.done();
}

/** Esquina de caja con tablas de 90 × 20: dos colas a 15° y tres espigas (dos medias en los cantos). */
function colaMilanoPasante(): Project {
  const j = new J('cola-milano-pasante');
  const p0 = j.box('Tabla de espigas', 'pino', [220, 0, 0], [20, 90, 220]);
  const p1 = j.prism('Media espiga inferior', 'pino', [220, 0, 220], 'z', 20, [[0, 0], [20, 0], [20, 10], [0, 15.4]]);
  const p2 = j.prism('Espiga central', 'pino', [220, 34.6, 220], 'z', 20, [[0, 0], [20, 5.4], [20, 15.4], [0, 20.8]]);
  const p3 = j.prism('Media espiga superior', 'pino', [220, 74.6, 220], 'z', 20, [[0, 0], [20, 5.4], [20, 15.4], [0, 15.4]]);
  const t = j.prism('Tabla de colas', 'haya', [0, 0, 220], 'z', 20, [
    [0, 0], [220, 0], [220, 15.4], [240, 10], [240, 40], [220, 34.6], [220, 55.4], [240, 50], [240, 80], [220, 74.6], [220, 90], [0, 90],
  ]);
  j.move([t], mv([0, 0, 90]));
  j.step('Tabla de espigas', 'Las espigas se estrechan hacia la cara exterior.', [p0, p1, p2, p3]);
  j.step('Tabla de colas', 'Las colas se abren hacia la testa: solo entran en una dirección y no se pueden sacar tirando de la otra tabla.', [t]);
  return j.done();
}

/** Balda de 20 mm con lengüeta en cola de milano que se desliza por una ranura del costado. */
function colaMilanoDeslizante(): Project {
  const j = new J('cola-milano-deslizante');
  const s = j.prism('Costado con ranura en cola de milano', 'pino', [0, 0, 0], 'z', 90, [[0, 0], [20, 0], [20, 114], [12, 111.9], [12, 128.1], [20, 126], [20, 240], [0, 240]]);
  const h = j.prism('Balda con lengüeta en cola de milano', 'haya', [12, 110, 0], 'z', 90, [[8, 0], [228, 0], [228, 20], [8, 20], [8, 16], [0, 18.1], [0, 1.9], [8, 4]]);
  j.move([h], mv([0, 0, 130]));
  j.step('Costado con la ranura', 'La ranura es más ancha en el fondo que en la boca.', [s]);
  j.step('Balda', 'La lengüeta entra deslizando por un extremo de la ranura; no sale tirando de frente.', [h]);
  return j.done();
}

/** Travesaño de 70 × 45 contra pata de 45 × 45 con dos tubillones de Ø 16 (entre un tercio y la mitad de 45). */
function tubillones(): Project {
  const j = new J('tubillones');
  const r = 8.05; // taladro: el polígono queda por fuera del tubillón de Ø 16
  const holes = [18, 52];
  const p1 = j.box('Pata (bajo los taladros)', 'pino', [0, 0, 0], [45, 115, 45]);
  const p2 = j.box('Pata (fondo de los taladros)', 'pino', [0, 115, 0], [13, 70, 45]);
  const p3 = j.prism('Pata (taladros, mitad trasera)', 'pino', [13, 115, 0], 'x', 32, notched(22.5, 70, 'max', holes, r));
  const p4 = j.prism('Pata (taladros, mitad delantera)', 'pino', [13, 115, 22.5], 'x', 32, notched(22.5, 70, 'min', holes, r));
  const p5 = j.box('Pata (sobre los taladros)', 'pino', [0, 185, 0], [45, 115, 45]);
  const d1 = j.dowel('Tubillón Ø 16', [15, 125, 14.5], 16, 60, 'x');
  const d2 = j.dowel('Tubillón Ø 16', [15, 159, 14.5], 16, 60, 'x');
  const t1 = j.prism('Travesaño (taladros, mitad trasera)', 'haya', [45, 115, 0], 'x', 32, notched(22.5, 70, 'max', holes, r));
  const t2 = j.prism('Travesaño (taladros, mitad delantera)', 'haya', [45, 115, 22.5], 'x', 32, notched(22.5, 70, 'min', holes, r));
  const t3 = j.box('Travesaño', 'haya', [77, 115, 0], [228, 70, 45]);
  j.move([t1, t2, t3], mv([130, 0, 0], 0));
  j.move([d1, d2], mv([60, 0, 0], 1));
  j.step('Pata con los taladros', 'Dos taladros centrados en el grueso, algo más hondos que medio tubillón.', [p1, p2, p3, p4, p5]);
  j.step('Tubillones', 'Se encolan primero en una de las piezas.', [d1, d2]);
  j.step('Travesaño', 'Sus taladros, enfrentados con los de la pata, reciben la otra mitad de los tubillones.', [t1, t2, t3]);
  return j.done();
}

/** Dos tablas de 90 × 20 unidas por el canto: lengüeta centrada de 7 mm (un tercio del grueso). */
function ranuraLengueta(): Project {
  const j = new J('ranura-lengueta');
  const a = j.prism('Tabla con ranura', 'pino', [0, 0, 0], 'z', 240, [[0, 0], [90, 0], [90, 6.5], [80, 6.5], [80, 13.5], [90, 13.5], [90, 20], [0, 20]]);
  const b = j.prism('Tabla con lengüeta', 'haya', [80, 0, 0], 'z', 240, [[10, 0], [100, 0], [100, 20], [10, 20], [10, 13.5], [0, 13.5], [0, 6.5], [10, 6.5]]);
  j.move([b], mv([70, 0, 0]));
  j.step('Tabla con la ranura', 'Ranura centrada en el canto, a todo lo largo.', [a]);
  j.step('Tabla con la lengüeta', 'La lengüeta entra a presión suave en la ranura.', [b]);
  return j.done();
}

/** Costado de 20 mm con un galce de 10 × 10 a lo largo del canto que aloja una trasera de 10 mm. */
function rebaje(): Project {
  const j = new J('rebaje');
  const s = j.prism('Costado con galce', 'pino', [0, 0, 0], 'y', 240, [[0, 0], [20, 0], [20, 140], [10, 140], [10, 150], [0, 150]]);
  const f = j.box('Trasera', 'haya', [10, 0, 140], [190, 240, 10]);
  j.move([f], mv([0, 0, 70]));
  j.step('Costado con el galce', 'Escalón a lo largo del canto: un hombro de 10 mm y una lengüeta de 10 mm.', [s]);
  j.step('Trasera', 'La trasera apoya en el hombro y queda enrasada con el canto.', [f]);
  return j.done();
}

/** Esquina de bastidor con horquilla: listones de 45 × 45 y espiga abierta de 15 mm. */
function horquilla(): Project {
  const j = new J('horquilla');
  const a = j.prism('Montante con horquilla', 'pino', [0, 0, 0], 'x', 45, [[0, 0], [45, 0], [45, 260], [30, 260], [30, 215], [15, 215], [15, 260], [0, 260]]);
  const b = j.prism('Travesaño con espiga abierta', 'haya', [0, 215, 0], 'y', 45, [[0, 15], [45, 15], [45, 0], [260, 0], [260, 45], [45, 45], [45, 30], [0, 30]]);
  j.move([b], mv([0, 90, 0]));
  j.step('Montante con la horquilla', 'La abertura está abierta por arriba y por los dos lados.', [a]);
  j.step('Travesaño con la espiga abierta', 'La espiga se desliza dentro de la horquilla.', [b]);
  return j.done();
}

// ------------------------------------------------------------------- Japoneses (vigas de 60 × 60)

const ARI_A: Poly = [[0, 0], [240, 0], [240, 20], [200, 14], [200, 46], [240, 40], [240, 60], [0, 60]];
const ARI_B: Poly = [[40, 0], [280, 0], [280, 60], [40, 60], [40, 40], [0, 46], [0, 14], [40, 20]];

function ariTsugi(): Project {
  const j = new J('ari-tsugi');
  const a = j.prism('Pieza con la cavidad', 'pino', [0, 0, 0], 'y', 60, ARI_A);
  const b = j.prism('Pieza con el macho en cola de milano', 'haya', [200, 0, 0], 'y', 60, ARI_B);
  j.move([b], mv([0, 90, 0]));
  j.step('Pieza con la cavidad', 'Cavidad acampanada abierta en la testa.', [a]);
  j.step('Pieza con el macho', 'El macho baja desde arriba dentro de la cavidad.', [b]);
  return j.done();
}

function koshikakeTsugi(): Project {
  const j = new J('koshikake-tsugi');
  const a = j.prism('Pieza inferior (L)', 'pino', [0, 0, 0], 'z', 60, [[0, 0], [240, 0], [240, 30], [180, 30], [180, 60], [0, 60]]);
  const b = j.prism('Pieza superior (L invertida)', 'haya', [180, 0, 0], 'z', 60, [[0, 30], [60, 30], [60, 0], [240, 0], [240, 60], [0, 60]]);
  j.move([b], mv([0, 90, 0]));
  j.step('Pieza inferior', 'Se ha quitado una L de la mitad superior del extremo.', [a]);
  j.step('Pieza superior', 'Con la L invertida, se asienta sobre la otra.', [b]);
  return j.done();
}

function koshikakeAriTsugi(): Project {
  const j = new J('koshikake-ari-tsugi');
  const a1 = j.box('Pieza con la cavidad (escalón)', 'pino', [0, 0, 0], [240, 30, 60]);
  const a2 = j.prism('Pieza con la cavidad (cola de milano)', 'pino', [0, 30, 0], 'y', 30, ARI_A);
  const b1 = j.box('Pieza con el macho (mitad baja)', 'haya', [240, 0, 0], [240, 30, 60]);
  const b2 = j.prism('Pieza con el macho (cola de milano)', 'haya', [200, 30, 0], 'y', 30, ARI_B);
  j.move([b1, b2], mv([0, 90, 0]));
  j.step('Pieza con la cavidad', 'La cavidad ocupa la mitad del grueso y deja debajo un escalón.', [a1, a2]);
  j.step('Pieza con el macho', 'El macho cae en la cavidad y apoya en el escalón.', [b1, b2]);
  return j.done();
}

function kamaTsugi(): Project {
  const j = new J('kama-tsugi');
  const a = j.prism('Pieza con la caja', 'pino', [0, 0, 0], 'y', 60, [
    [0, 0], [240, 0], [240, 23], [195, 23], [185, 14], [160, 14], [160, 46], [185, 46], [195, 37], [240, 37], [240, 60], [0, 60],
  ]);
  const b = j.prism('Pieza con cuello y cabeza', 'haya', [160, 0, 0], 'y', 60, [
    [80, 0], [320, 0], [320, 60], [80, 60], [80, 37], [35, 37], [25, 46], [0, 46], [0, 14], [25, 14], [35, 23], [80, 23],
  ]);
  j.move([b], mv([0, 90, 0]));
  j.step('Pieza con la caja', 'Caja con la forma del cuello y la cabeza.', [a]);
  j.step('Pieza con la espiga', 'Cuello y cabeza de una sola pieza entran desde arriba.', [b]);
  return j.done();
}

/**
 * Kanawa-tsugi: empalme oblicuo con un diente en el centro y espigas ocultas en las puntas. Las dos
 * mitades son iguales (giradas media vuelta); se presentan desplazadas, se deslizan a lo largo hasta que
 * las espigas entran en sus cajas y el pasador (komisen) ocupa el hueco que queda entre los dientes.
 */
function kanawaTsugi(): Project {
  const j = new J('kanawa-tsugi');
  const a1 = j.box('Pieza izquierda', 'pino', [0, 0, 0], [186, 60, 60]);
  const a2 = j.prism('Pieza izquierda (corte oblicuo)', 'pino', [186, 0, 0], 'z', 60, [
    [0, 0], [206, 0], [206, 18], [128, 22], [128, 36], [116, 36], [116, 24], [92, 24], [92, 38], [14, 42], [14, 46], [0, 46],
  ]);
  const a3 = j.prism('Pieza izquierda (caja oculta)', 'pino', [186, 46, 0], 'y', 10, [[0, 0], [14, 0], [14, 20], [4, 20], [4, 40], [14, 40], [14, 60], [0, 60]]);
  const a4 = j.box('Pieza izquierda (sobre la caja)', 'pino', [186, 56, 0], [14, 4, 60]);
  const a5 = j.box('Espiga oculta de la pieza izquierda', 'pino', [392, 4, 20], [10, 10, 20]);
  const b1 = j.box('Pieza derecha', 'haya', [406, 0, 0], [186, 60, 60]);
  const b2 = j.prism('Pieza derecha (corte oblicuo)', 'haya', [200, 14, 0], 'z', 60, [
    [206, 46], [0, 46], [0, 28], [78, 24], [78, 10], [90, 10], [90, 22], [114, 22], [114, 8], [192, 4], [192, 0], [206, 0],
  ]);
  const b3 = j.prism('Pieza derecha (caja oculta)', 'haya', [392, 4, 0], 'y', 10, [[0, 0], [14, 0], [14, 60], [0, 60], [0, 40], [10, 40], [10, 20], [0, 20]]);
  const b4 = j.box('Pieza derecha (bajo la caja)', 'haya', [392, 0, 0], [14, 4, 60]);
  const b5 = j.box('Espiga oculta de la pieza derecha', 'haya', [190, 46, 20], [10, 10, 20]);
  const k = j.box('Pasador (komisen)', 'haya', [290, 24, -6], [12, 12, 72]);
  j.move([k], mv([0, 0, 110], 0));
  j.move([b1, b2, b3, b4, b5], mv([11, 0, 0], 1), mv([0, 90, 0], 2));
  j.step('Pieza izquierda', 'Corte oblicuo con un diente en el centro; espiga oculta en la punta y caja en el hombro.', [a1, a2, a3, a4, a5]);
  j.step('Pieza derecha', 'Igual que la otra, girada media vuelta. Se apoya desplazada y se desliza a lo largo hasta que las espigas entran en sus cajas.', [b1, b2, b3, b4, b5]);
  j.step('Pasador (komisen)', 'El pasador cuadrado llena el hueco entre los dientes y bloquea el deslizamiento.', [k]);
  return j.done();
}

/**
 * Shiribasami-tsugi: dos mitades iguales se juntan por sus caras planas. En el centro del ancho (no se
 * ve desde los lados) cada una lleva una espiga en T que se engancha en la caja de la otra al deslizar;
 * un pasador cuadrado en el agujero central las fija.
 */
function shiribasamiTsugi(): Project {
  const j = new J('shiribasami-tsugi');
  const a1 = j.box('Mitad inferior', 'pino', [0, 0, 0], [200, 60, 60]);
  const a2 = j.box('Mitad inferior (cara trasera)', 'pino', [200, 0, 0], [180, 30, 20]);
  const a3 = j.box('Mitad inferior (cara delantera)', 'pino', [200, 0, 40], [180, 30, 20]);
  const a4 = j.prism('Mitad inferior (caja en T)', 'pino', [200, 0, 20], 'z', 20, [[0, 0], [80, 0], [80, 30], [60, 30], [60, 14], [10, 14], [10, 22], [30, 22], [30, 30], [0, 30]]);
  const a5 = j.prism('Mitad inferior (espiga en T)', 'pino', [300, 0, 20], 'z', 20, [[0, 0], [80, 0], [80, 30], [50, 30], [50, 38], [70, 38], [70, 46], [40, 46], [40, 30], [0, 30]]);
  const b1 = j.box('Mitad superior', 'haya', [380, 0, 0], [200, 60, 60]);
  const b2 = j.box('Mitad superior (cara trasera)', 'haya', [200, 30, 0], [180, 30, 20]);
  const b3 = j.box('Mitad superior (cara delantera)', 'haya', [200, 30, 40], [180, 30, 20]);
  const b4 = j.prism('Mitad superior (espiga en T)', 'haya', [200, 14, 20], 'z', 20, [[80, 46], [0, 46], [0, 16], [30, 16], [30, 8], [10, 8], [10, 0], [40, 0], [40, 16], [80, 16]]);
  const b5 = j.prism('Mitad superior (caja en T)', 'haya', [300, 30, 20], 'z', 20, [[80, 30], [0, 30], [0, 0], [20, 0], [20, 16], [70, 16], [70, 8], [50, 8], [50, 0], [80, 0]]);
  const k = j.box('Pasador cuadrado', 'haya', [280, 0, 20], [20, 66, 20]);
  j.move([k], mv([0, 170, 0], 0));
  j.move([b1, b2, b3, b4, b5], mv([20, 0, 0], 1), mv([0, 90, 0], 2));
  j.step('Mitad inferior', 'Cara plana con una espiga en T y una caja en T, ocultas en el centro del ancho.', [a1, a2, a3, a4, a5]);
  j.step('Mitad superior', 'Idéntica y girada. Se apoya cara contra cara y se desliza hasta que las espigas quedan trabadas.', [b1, b2, b3, b4, b5]);
  j.step('Pasador cuadrado', 'Entra por el agujero central y fija las dos mitades.', [k]);
  return j.done();
}

/** Saoshachi-tsugi: espiga larga y delgada en una caja, trabada con dos llaves (shachi) que la cruzan. */
function saoshachiTsugi(): Project {
  const j = new J('saoshachi-tsugi');
  const lo: Poly = [[0, 0], [120, 0], [120, 30], [85, 30], [85, 18], [75, 18], [75, 30], [35, 30], [35, 18], [25, 18], [25, 30], [0, 30]];
  const up: Poly = [[0, 0], [25, 0], [25, 12], [35, 12], [35, 0], [75, 0], [75, 12], [85, 12], [85, 0], [120, 0], [120, 30], [0, 30]];
  const a1 = j.box('Pieza con la caja', 'pino', [0, 0, 0], [180, 60, 60]);
  const a2 = j.prism('Pieza con la caja (pared trasera, abajo)', 'pino', [180, 0, 0], 'z', 20, lo);
  const a3 = j.prism('Pieza con la caja (pared trasera, arriba)', 'pino', [180, 30, 0], 'z', 20, up);
  const a4 = j.prism('Pieza con la caja (pared delantera, abajo)', 'pino', [180, 0, 40], 'z', 20, lo);
  const a5 = j.prism('Pieza con la caja (pared delantera, arriba)', 'pino', [180, 30, 40], 'z', 20, up);
  const a6 = j.box('Pieza con la caja (fondo inferior)', 'pino', [180, 0, 20], [120, 10, 20]);
  const a7 = j.box('Pieza con la caja (techo superior)', 'pino', [180, 50, 20], [120, 10, 20]);
  const b1 = j.box('Pieza con la espiga larga', 'haya', [300, 0, 0], [200, 60, 60]);
  const b2 = j.prism('Espiga larga (mitad baja)', 'haya', [180, 10, 20], 'z', 20, [[0, 0], [120, 0], [120, 20], [85, 20], [85, 8], [75, 8], [75, 20], [35, 20], [35, 8], [25, 8], [25, 20], [0, 20]]);
  const b3 = j.prism('Espiga larga (mitad alta)', 'haya', [180, 30, 20], 'z', 20, [[0, 0], [25, 0], [25, 12], [35, 12], [35, 0], [75, 0], [75, 12], [85, 12], [85, 0], [120, 0], [120, 20], [0, 20]]);
  const k1 = j.box('Llave (shachi)', 'haya', [205, 18, 0], [10, 24, 70]);
  const k2 = j.box('Llave (shachi)', 'haya', [255, 18, 0], [10, 24, 70]);
  j.move([k1, k2], mv([0, 0, 110], 0));
  j.move([b1, b2, b3], mv([150, 0, 0], 1));
  j.step('Pieza con la caja', 'Caja larga y estrecha con dos ranuras que la cruzan de lado a lado.', [a1, a2, a3, a4, a5, a6, a7]);
  j.step('Pieza con la espiga larga', 'La espiga, larga y delgada, lleva las mismas ranuras.', [b1, b2, b3]);
  j.step('Llaves (shachi)', 'Las llaves de madera dura atraviesan las dos piezas por las ranuras y las traban.', [k1, k2]);
  return j.done();
}

/** Konozu zashi: dos vigas que se empalman dentro de un pilar, bloqueadas con dos llaves y un pasador cuadrado. */
function konozuZashi(): Project {
  const j = new J('konozu-zashi');
  const lo: Poly = [[0, 0], [75, 0], [75, 40], [63, 40], [63, 30], [51, 30], [51, 40], [44.5, 40], [44.5, 33], [30.5, 33], [30.5, 40], [24, 40], [24, 30], [12, 30], [12, 40], [0, 40]];
  const up: Poly = [[0, 0], [12, 0], [12, 10], [24, 10], [24, 0], [30.5, 0], [30.5, 7], [44.5, 7], [44.5, 0], [51, 0], [51, 10], [63, 10], [63, 0], [75, 0], [75, 40], [0, 40]];
  const p1 = j.box('Pilar', 'pino', [200, 0, 0], [75, 120, 75]);
  const p2 = j.prism('Pilar (pared trasera, abajo)', 'pino', [200, 120, 0], 'z', 22.5, lo);
  const p3 = j.prism('Pilar (pared trasera, arriba)', 'pino', [200, 160, 0], 'z', 22.5, up);
  const p4 = j.prism('Pilar (pared delantera, abajo)', 'pino', [200, 120, 52.5], 'z', 22.5, lo);
  const p5 = j.prism('Pilar (pared delantera, arriba)', 'pino', [200, 160, 52.5], 'z', 22.5, up);
  const p6 = j.box('Pilar (sobre la caja)', 'pino', [200, 200, 0], [75, 100, 75]);
  const a1 = j.box('Viga con espiga', 'haya', [0, 120, 12.5], [200, 80, 50]);
  const a2 = j.prism('Espiga de la viga', 'haya', [200, 120, 22.5], 'z', 30, lo);
  const b1 = j.box('Viga con caja', 'pino', [275, 120, 12.5], [200, 80, 50]);
  const b2 = j.prism('Viga con caja (lengüeta superior)', 'pino', [200, 160, 22.5], 'z', 30, up);
  const k1 = j.box('Llave', 'haya', [212, 150, 0], [12, 20, 83]);
  const k2 = j.box('Llave', 'haya', [251, 150, 0], [12, 20, 83]);
  const k3 = j.box('Pasador cuadrado', 'haya', [230.5, 153, 0], [14, 14, 83]);
  j.move([k1, k2, k3], mv([0, 0, 120], 0));
  j.move([b1, b2], mv([130, 0, 0], 1));
  j.move([a1, a2], mv([-130, 0, 0], 2));
  j.step('Pilar', 'Caja pasante a la altura de las vigas, con los alojamientos de las llaves.', [p1, p2, p3, p4, p5, p6]);
  j.step('Viga con espiga', 'Entra primero: su espiga ocupa la mitad baja de la caja del pilar.', [a1, a2]);
  j.step('Viga con caja', 'Se desliza después y monta sobre la espiga; los hombros resisten el cortante y la torsión.', [b1, b2]);
  j.step('Llaves y pasador', 'Las llaves y el pasador cuadrado cruzan el pilar y las dos vigas por las cajas comunes.', [k1, k2, k3]);
  return j.done();
}

/** Komisen: pasador cuadrado de madera dura que cruza un pilar y la espiga que entra en él. */
function komisenShachisen(): Project {
  const j = new J('komisen-shachisen');
  const lo: Poly = [[0, 0], [60, 0], [60, 22], [41, 22], [41, 16], [29, 16], [29, 22], [0, 22]];
  const up: Poly = [[0, 0], [29, 0], [29, 6], [41, 6], [41, 0], [60, 0], [60, 22], [0, 22]];
  const p1 = j.box('Pilar', 'pino', [0, 0, 0], [60, 128, 60]);
  const p2 = j.prism('Pilar (pared trasera, abajo)', 'pino', [0, 128, 0], 'z', 22.5, lo);
  const p3 = j.prism('Pilar (pared trasera, arriba)', 'pino', [0, 150, 0], 'z', 22.5, up);
  const p4 = j.prism('Pilar (pared delantera, abajo)', 'pino', [0, 128, 37.5], 'z', 22.5, lo);
  const p5 = j.prism('Pilar (pared delantera, arriba)', 'pino', [0, 150, 37.5], 'z', 22.5, up);
  const p6 = j.box('Pilar (fondo de la caja)', 'pino', [0, 128, 22.5], [8, 44, 15]);
  const p7 = j.box('Pilar (sobre la caja)', 'pino', [0, 172, 0], [60, 128, 60]);
  const v1 = j.box('Viga', 'haya', [60, 120, 7.5], [240, 60, 45]);
  const v2 = j.prism('Espiga (mitad baja)', 'haya', [10, 128, 22.5], 'z', 15, [[0, 0], [50, 0], [50, 22], [31, 22], [31, 16], [19, 16], [19, 22], [0, 22]]);
  const v3 = j.prism('Espiga (mitad alta)', 'haya', [10, 150, 22.5], 'z', 15, [[0, 0], [19, 0], [19, 6], [31, 6], [31, 0], [50, 0], [50, 22], [0, 22]]);
  const k = j.box('Pasador (komisen)', 'haya', [29, 144, 0], [12, 12, 66]);
  j.move([k], mv([0, 0, 100], 0));
  j.move([v1, v2, v3], mv([110, 0, 0], 1));
  j.step('Pilar con la caja', 'Caja ciega para la espiga y agujero cuadrado que cruza el pilar.', [p1, p2, p3, p4, p5, p6, p7]);
  j.step('Viga con la espiga', 'La espiga lleva el mismo agujero cuadrado.', [v1, v2, v3]);
  j.step('Pasador (komisen)', 'El pasador de madera dura se golpea hasta que aprieta la unión.', [k]);
  return j.done();
}

/** Cuadrícula de listones finos (6 × 18) que se cruzan a media madera. */
function kumiko(): Project {
  const j = new J('kumiko');
  const C = [50, 100, 150];
  const hPoly: Poly = [[0, 0], [200, 0], [200, 18]];
  for (const c of [...C].reverse()) hPoly.push([c + 3, 18], [c + 3, 9], [c - 3, 9], [c - 3, 18]);
  hPoly.push([0, 18]);
  const vPoly: Poly = [[0, 0], [18, 0], [18, 200], [0, 200]];
  for (const c of [...C].reverse()) vPoly.push([0, c + 3], [9, c + 3], [9, c - 3], [0, c - 3]);
  const hs = C.map((c) => j.prism('Listón horizontal', 'pino', [0, c - 3, 0], 'y', 6, hPoly));
  const vs = C.map((c) => j.prism('Listón vertical', 'haya', [c - 3, 0, 0], 'x', 6, vPoly));
  j.move(vs, mv([0, 0, 70]));
  j.step('Listones horizontales', 'Ranurados por delante hasta la mitad del fondo en cada cruce.', hs);
  j.step('Listones verticales', 'Ranurados por detrás: encajan en los horizontales y la presión los mantiene.', vs);
  return j.done();
}

/** Constructores de los modelos, por id de `ensambles.ts`. */
export const JOINTS_3D: Record<string, () => Project> = {
  'media-madera': mediaMadera,
  'caja-espiga-ciega': cajaEspigaCiega,
  'caja-espiga-pasante': cajaEspigaPasante,
  'espiga-acunada': espigaAcunada,
  'cola-milano-pasante': colaMilanoPasante,
  'cola-milano-deslizante': colaMilanoDeslizante,
  tubillones,
  'ranura-lengueta': ranuraLengueta,
  rebaje,
  horquilla,
  'ari-tsugi': ariTsugi,
  'koshikake-tsugi': koshikakeTsugi,
  'koshikake-ari-tsugi': koshikakeAriTsugi,
  'kama-tsugi': kamaTsugi,
  'kanawa-tsugi': kanawaTsugi,
  'shiribasami-tsugi': shiribasamiTsugi,
  'saoshachi-tsugi': saoshachiTsugi,
  'konozu-zashi': konozuZashi,
  'komisen-shachisen': komisenShachisen,
  kumiko,
};

/** Alias cómodos para enlazar desde otras páginas. */
const ALIAS: Record<string, string> = {
  'caja-espiga': 'caja-espiga-ciega',
  'cola-milano': 'cola-milano-pasante',
  tubillon: 'tubillones',
  galce: 'rebaje',
};

/** Id canónico de un ensamble 3D, o undefined si no existe. */
export function resolveJointId(id: string): string | undefined {
  const k = ALIAS[id] ?? id;
  return k in JOINTS_3D ? k : undefined;
}

const built = new Map<string, Project>();
/** Modelo cerrado de un ensamble (se construye una vez y se reutiliza). */
export function jointProject(id: string): Project | undefined {
  const k = resolveJointId(id);
  if (!k) return undefined;
  let p = built.get(k);
  if (!p) {
    p = JOINTS_3D[k]();
    built.set(k, p);
  }
  return p;
}

/**
 * Devuelve el ensamble abierto una fracción `t` (0 = cerrado, 1 = del todo abierto). Cada pieza se
 * aparta por su dirección real de montaje y por etapas: primero cuñas y pasadores, luego las piezas.
 * Con `only`, solo se abren esas piezas (con su propio `t`) y el resto queda según `t`.
 */
export function openJoint(p: Project, t: number, only?: { parts: string[]; t: number }): Project {
  const moves = MOVES.get(p);
  if (!moves || (t <= 0 && (!only || only.t <= 0))) return p;
  const stagesOf = (ids: Iterable<string>) => [...new Set([...ids].flatMap((id) => (moves.get(id) ?? []).map((m) => m.stage)))].sort((a, b) => a - b);
  const all = stagesOf(p.parts.map((q) => q.id));
  const sub = only ? stagesOf(only.parts) : all;
  const inOnly = new Set(only?.parts ?? []);
  const parts = p.parts.map((q) => {
    const ms = moves.get(q.id);
    if (!ms) return q;
    const focus = inOnly.has(q.id);
    const tt = focus ? only!.t : t;
    const st = focus ? sub : all;
    const n = st.length;
    const pos: Vec3 = [...q.pos];
    for (const m of ms) {
      const k = st.indexOf(m.stage);
      const f = Math.min(1, Math.max(0, tt * n - k));
      if (f > 0) for (let i = 0; i < 3; i++) pos[i] += m.d[i] * f;
    }
    return pos.every((v, i) => v === q.pos[i]) ? q : { ...q, pos };
  });
  return { ...p, parts };
}

/**
 * Id del ensamble 3D que corresponde a una técnica de un proyecto («Caja y espiga», «Tubillones
 * encolados», «Cruz a media madera»…), o undefined si no hay ninguno (uniones con tornillo, soldadas…).
 */
export function jointForTechnique(name: string): string | undefined {
  const s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/tornill|bolsillo|pocket|atornill|clavo|clavad|grapa|solda|puntea|herraje|escuadra metal|malla/.test(s)) return undefined;
  if (/kumiko/.test(s)) return 'kumiko';
  if (/konozu/.test(s)) return 'konozu-zashi';
  if (/saoshachi/.test(s)) return 'saoshachi-tsugi';
  if (/shiribasami|shippasami/.test(s)) return 'shiribasami-tsugi';
  if (/kanawa/.test(s)) return 'kanawa-tsugi';
  if (/komisen|shachisen/.test(s)) return 'komisen-shachisen';
  if (/kama[- ]?tsugi|cuello de ganso/.test(s)) return 'kama-tsugi';
  if (/koshikake[- ]?ari/.test(s)) return 'koshikake-ari-tsugi';
  if (/koshikake/.test(s)) return 'koshikake-tsugi';
  if (/ari[- ]?tsugi/.test(s)) return 'ari-tsugi';
  if (/cola de milano/.test(s)) return /deslizante|corredera|ranura/.test(s) ? 'cola-milano-deslizante' : 'cola-milano-pasante';
  if (/tubillon|espigas? redondas?|clavijas? de madera/.test(s)) return 'tubillones';
  if (/espiga/.test(s) && /acunad|\bcunas?\b/.test(s)) return 'espiga-acunada';
  if (/horquilla|ensamble abierto|espiga abierta/.test(s)) return 'horquilla';
  if (/caja y espiga|espiga y caja|mortaja|espiga (ciega|pasante)/.test(s)) return /pasante/.test(s) ? 'caja-espiga-pasante' : 'caja-espiga-ciega';
  if (/media madera/.test(s)) return 'media-madera';
  if (/lengueta|machihembr/.test(s)) return 'ranura-lengueta';
  if (/galce|rebaje|ranura/.test(s)) return 'rebaje';
  return undefined;
}

/** Nº de etapas de apertura (cuñas o pasadores, pieza macho…), para ajustar la duración de la animación. */
export function jointStageCount(p: Project): number {
  const moves = MOVES.get(p);
  if (!moves) return 1;
  return Math.max(1, new Set([...moves.values()].flatMap((ms) => ms.map((m) => m.stage))).size);
}
