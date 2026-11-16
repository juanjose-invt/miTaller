import type { Axis, HardwareLine, Mark, MaterialId, Part, Project, Step, Vec3 } from './types';
import { MATERIALS } from './materials';

const AX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

function center(at: Vec3, size: Vec3): Vec3 {
  return [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + size[2] / 2];
}

interface Common {
  /** Letra de la lista de corte. */
  ref: string;
  name: string;
  /** Esquina mínima de la pieza (x menor, y menor, z menor) en mm. */
  at: Vec3;
  note?: string;
  id?: string;
}

export interface LinealOpts extends Common {
  material?: MaterialId; // por defecto 'pino'
  /**
   * Sección [a, b] en mm. Cómo se orienta según el eje del largo:
   *  axis 'y' (vertical)  → ocupa a en X y b en Z
   *  axis 'x' (a lo ancho) → ocupa a en Y (canto vertical) y b en Z
   *  axis 'z' (a lo fondo) → ocupa a en X y b en Y
   */
  section: [number, number];
  length: number;
  axis: Axis;
}

export interface TuboOpts extends LinealOpts {
  /** Espesor de pared en mm. */
  wall: number;
}

export interface PanelOpts extends Common {
  material?: MaterialId; // por defecto 'pino'
  thickness: number;
  /**
   * Medidas de la cara [u, v] en mm. Según la normal:
   *  normal 'y' (horizontal: balda, tablero) → u en X, v en Z
   *  normal 'x' (lateral)                    → u en Y (alto), v en Z
   *  normal 'z' (trasera / frente)           → u en X, v en Y (alto)
   */
  face: [number, number];
  normal: Axis;
  /** Dirección de la veta; por defecto la dimensión mayor de la cara. */
  grain?: Axis;
}

export interface RedondoOpts extends Common {
  material?: MaterialId; // por defecto 'haya'
  diameter: number;
  length: number;
  axis: Axis;
}

export interface MallaOpts extends Common {
  /** Medidas de la cara [u, v] con el mismo criterio que PanelOpts. */
  face: [number, number];
  normal: Axis;
  /** Luz de malla en mm (p. ej. 13 o 25). */
  cell: number;
  /** Diámetro del alambre en mm. */
  wire?: number;
}

export interface HerrajeOpts extends Common {
  size: Vec3;
  /** Descripción comprable: «Bisagra de libro 50 mm». */
  stock: string;
}

/**
 * Constructor de proyectos. Coloca piezas por su esquina mínima y encadena pasos.
 * Las funciones devuelven el id de la pieza para usarlo en `step({ parts: [...] })`.
 */
export class Builder {
  parts: Part[] = [];
  steps: Step[] = [];
  private n = 0;

  private push(p: Omit<Part, 'id'>, id?: string): string {
    const pid = id ?? `${p.ref}${++this.n}`;
    if (this.parts.some((q) => q.id === pid)) throw new Error(`id de pieza repetido: ${pid}`);
    this.parts.push({ ...p, id: pid });
    return pid;
  }

  private linealSize(section: [number, number], length: number, axis: Axis): Vec3 {
    const [a, b] = section;
    if (axis === 'y') return [a, length, b];
    if (axis === 'x') return [length, a, b];
    return [a, b, length];
  }

  /** Listón o tabla de madera maciza que se compra por metros. */
  liston(o: LinealOpts): string {
    const material = o.material ?? 'pino';
    const size = this.linealSize(o.section, o.length, o.axis);
    const [s1, s2] = [...o.section].sort((x, y) => y - x);
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'box', size, axis: o.axis, pos: center(o.at, size), material,
        stock: `Listón de ${MATERIALS[material].label.toLowerCase()} cepillado ${fmt(s1)}×${fmt(s2)} mm`,
        stockKind: 'lineal', cut: [o.length, s1, s2], note: o.note,
      },
      o.id,
    );
  }

  /** Tubo estructural de acero cuadrado o rectangular. */
  tubo(o: TuboOpts): string {
    const size = this.linealSize(o.section, o.length, o.axis);
    const [s1, s2] = [...o.section].sort((x, y) => y - x);
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'box', size, axis: o.axis, pos: center(o.at, size), material: 'acero',
        stock: `Tubo de acero ${fmt(s1)}×${fmt(s2)}×${fmt(o.wall)} mm`,
        stockKind: 'lineal', cut: [o.length, s1, s2], wall: o.wall, note: o.note,
      },
      o.id,
    );
  }

  /** Pletina o llanta de acero (maciza): section = [ancho, grueso]. */
  pletina(o: LinealOpts): string {
    const size = this.linealSize(o.section, o.length, o.axis);
    const [s1, s2] = [...o.section].sort((x, y) => y - x);
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'box', size, axis: o.axis, pos: center(o.at, size), material: 'acero',
        stock: `Pletina de acero ${fmt(s1)}×${fmt(s2)} mm`,
        stockKind: 'lineal', cut: [o.length, s1, s2], note: o.note,
      },
      o.id,
    );
  }

  /** Tablero (alistonado de pino, contrachapado, DM): se compra por superficie. */
  panel(o: PanelOpts): string {
    const material = o.material ?? 'pino';
    const [u, v] = o.face;
    const t = o.thickness;
    const size: Vec3 = o.normal === 'y' ? [u, t, v] : o.normal === 'x' ? [t, u, v] : [u, v, t];
    const faceAxes: [Axis, Axis] = o.normal === 'y' ? ['x', 'z'] : o.normal === 'x' ? ['y', 'z'] : ['x', 'y'];
    const axis = o.grain ?? (u >= v ? faceAxes[0] : faceAxes[1]);
    const names: Record<string, string> = {
      pino: 'Tablero alistonado de pino', contrachapado: 'Tablero contrachapado', dm: 'Tablero de DM', haya: 'Tablero alistonado de haya',
    };
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'box', size, axis, pos: center(o.at, size), material,
        stock: `${names[material] ?? 'Tablero'} ${fmt(t)} mm`,
        stockKind: 'tablero', cut: [Math.max(u, v), Math.min(u, v), t], note: o.note,
      },
      o.id,
    );
  }

  /** Varilla o barrote redondo de madera (o de acero con material: 'acero'). */
  redondo(o: RedondoOpts): string {
    const material = o.material ?? 'haya';
    const d = o.diameter;
    const size: Vec3 = o.axis === 'y' ? [d, o.length, d] : o.axis === 'x' ? [o.length, d, d] : [d, d, o.length];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'cyl', size, axis: o.axis, pos: center(o.at, size), material,
        stock: material === 'acero' ? `Redondo de acero Ø${fmt(d)} mm` : `Varilla redonda de ${MATERIALS[material].label.toLowerCase()} Ø${fmt(d)} mm`,
        stockKind: 'lineal', cut: [o.length, d, d], note: o.note,
      },
      o.id,
    );
  }

  /** Paño de malla electrosoldada. */
  malla(o: MallaOpts): string {
    const [u, v] = o.face;
    const t = o.wire ?? 1.5;
    const size: Vec3 = o.normal === 'y' ? [u, t, v] : o.normal === 'x' ? [t, u, v] : [u, v, t];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'box', size, axis: o.normal === 'x' ? 'z' : 'x', pos: center(o.at, size), material: 'malla',
        stock: `Malla electrosoldada ${fmt(o.cell)}×${fmt(o.cell)} mm, alambre ${fmt(t)} mm`,
        stockKind: 'malla', cut: [Math.max(u, v), Math.min(u, v), t], meshCell: o.cell, note: o.note,
      },
      o.id,
    );
  }

  /** Herraje visible (bisagra, cierre, rueda): se dibuja como un bloque pequeño. */
  herraje(o: HerrajeOpts): string {
    const axis: Axis = o.size[0] >= o.size[1] && o.size[0] >= o.size[2] ? 'x' : o.size[1] >= o.size[2] ? 'y' : 'z';
    const cut = [...o.size].sort((a, b) => b - a) as Vec3;
    return this.push(
      { ref: o.ref, name: o.name, shape: 'box', size: o.size, axis, pos: center(o.at, o.size), material: 'herraje', stock: o.stock, stockKind: 'unidad', cut, note: o.note },
      o.id,
    );
  }

  // ---------- forja decorativa (soldadura) ----------

  /**
   * Punta de lanza o pincho que remata un barrote. La punta mira hacia +axis.
   * `base` es el ancho de la base; `sides` 4 = lanza piramidal (por defecto), 16 = cono.
   */
  punta(o: Common & { base: number; length: number; axis?: Axis; sides?: number; stock?: string }): string {
    const axis = o.axis ?? 'y';
    const size: Vec3 = axis === 'y' ? [o.base, o.length, o.base] : axis === 'x' ? [o.length, o.base, o.base] : [o.base, o.base, o.length];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'cone', size, axis, pos: center(o.at, size), material: 'acero',
        stock: o.stock ?? `Punta de lanza de forja, base ${fmt(o.base)} mm, alto ${fmt(o.length)} mm`,
        stockKind: 'unidad', cut: [o.length, o.base, o.base], deco: { sides: o.sides ?? 4 }, note: o.note,
      },
      o.id,
    );
  }

  /**
   * Voluta de forja (espiral plana) en C, en S o simple. `face` = [ancho, alto] de la caja que
   * ocupa, con el mismo criterio que PanelOpts; `bar` = grueso de la barra. En una C las dos
   * espirales se enrollan hacia el lado de menor coordenada (usa `mirror` para invertirla).
   */
  voluta(o: Common & { face: [number, number]; normal: Axis; bar: number; curve?: 'C' | 'S' | 'espiral'; mirror?: boolean; stock?: string }): string {
    const [u, v] = o.face;
    const t = o.bar;
    const curve = o.curve ?? 'C';
    const size: Vec3 = o.normal === 'y' ? [u, t, v] : o.normal === 'x' ? [t, u, v] : [u, v, t];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'voluta', size, axis: o.normal === 'x' ? 'y' : o.normal === 'y' ? 'x' : 'y', pos: center(o.at, size), material: 'acero',
        stock: o.stock ?? `Voluta de forja en ${curve === 'espiral' ? 'espiral' : curve}, ${fmt(Math.max(u, v))} × ${fmt(Math.min(u, v))} mm, barra de ${fmt(t)} mm`,
        stockKind: 'unidad', cut: [Math.max(u, v), Math.min(u, v), t], deco: { bar: t, curve, mirror: o.mirror }, note: o.note,
      },
      o.id,
    );
  }

  /** Aro (anillo) de barra, plano, perpendicular a `normal`. */
  aro(o: Common & { diameter: number; bar: number; normal: Axis; stock?: string }): string {
    const d = o.diameter, t = o.bar;
    const size: Vec3 = o.normal === 'y' ? [d, t, d] : o.normal === 'x' ? [t, d, d] : [d, d, t];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'aro', size, axis: o.normal === 'x' ? 'y' : 'x', pos: center(o.at, size), material: 'acero',
        stock: o.stock ?? `Aro de forja Ø${fmt(d)} mm, barra de ${fmt(t)} mm`,
        stockKind: 'unidad', cut: [d, d, t], deco: { bar: t }, note: o.note,
      },
      o.id,
    );
  }

  /**
   * Barra curvada en arco (remate superior de puertas y verjas). Vertical, en el plano
   * perpendicular a `normal` ('z' → el arco se abre a lo ancho, en X). Los extremos apoyan en
   * y = at[1] y la clave sube `rise`. `section` = [canto visto de frente, fondo].
   * Usa `alturaArco()` para calcular hasta dónde llega cada barrote bajo el arco.
   */
  arco(o: Common & { width: number; rise: number; section: [number, number]; normal?: 'x' | 'z'; stock?: string }): string {
    const normal = o.normal ?? 'z';
    const [a, bb] = o.section;
    const size: Vec3 = normal === 'z' ? [o.width, o.rise + a, bb] : [bb, o.rise + a, o.width];
    const [s1, s2] = [...o.section].sort((x, y) => y - x);
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'arco', size, axis: normal === 'z' ? 'x' : 'z', pos: center(o.at, size), material: 'acero',
        stock: o.stock ?? `Pletina de acero ${fmt(s1)}×${fmt(s2)} mm`,
        stockKind: 'lineal', cut: [Math.round(longitudArco(o.width, o.rise)), s1, s2], deco: { bar: a },
        note: o.note ?? 'Se curva en frío sobre una plantilla',
      },
      o.id,
    );
  }

  /** Bola o macolla decorativa. */
  bola(o: Common & { diameter: number; stock?: string }): string {
    const d = o.diameter;
    const size: Vec3 = [d, d, d];
    return this.push(
      {
        ref: o.ref, name: o.name, shape: 'bola', size, axis: 'y', pos: center(o.at, size), material: 'acero',
        stock: o.stock ?? `Bola de forja Ø${fmt(d)} mm`, stockKind: 'unidad', cut: [d, d, d], note: o.note,
      },
      o.id,
    );
  }

  /** Gira una pieza ya creada alrededor de su centro (radianes). Úsalo solo para riostras en diagonal. */
  rotate(id: string, rot: Vec3): void {
    const p = this.parts.find((q) => q.id === id);
    if (!p) throw new Error(`pieza desconocida: ${id}`);
    p.rot = rot;
  }

  step(s: Step): void {
    this.steps.push(s);
  }

  /** Cierra el proyecto: comprueba que cada pieza aparece exactamente en un paso. */
  finish(meta: Omit<Project, 'parts' | 'steps' | 'dims'> & { dims?: Vec3 }): Project {
    const seen = new Map<string, number>();
    this.steps.forEach((s, i) => s.parts.forEach((id) => {
      if (!this.parts.some((p) => p.id === id)) throw new Error(`paso ${i + 1}: pieza desconocida ${id}`);
      if (seen.has(id)) throw new Error(`pieza ${id} colocada en dos pasos (${seen.get(id)! + 1} y ${i + 1})`);
      seen.set(id, i);
    }));
    const missing = this.parts.filter((p) => !seen.has(p.id));
    if (missing.length) throw new Error(`piezas sin paso: ${missing.map((p) => p.id).join(', ')}`);
    const dims = meta.dims ?? boundsOf(this.parts).size;
    return { ...meta, dims, parts: this.parts, steps: this.steps };
  }
}

export function boundsOf(parts: Part[]): { min: Vec3; max: Vec3; size: Vec3; center: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.pos[i] - p.size[i] / 2);
      max[i] = Math.max(max[i], p.pos[i] + p.size[i] / 2);
    }
  }
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, center: [min[0] + size[0] / 2, min[1] + size[1] / 2, min[2] + size[2] / 2] };
}

// ---------- Geometría de arcos ----------

/** Radio del arco circular de luz `width` y flecha `rise`. */
export const radioArco = (width: number, rise: number) => (width * width) / (8 * rise) + rise / 2;

/** Longitud desarrollada del arco (para la lista de corte). */
export function longitudArco(width: number, rise: number): number {
  if (rise <= 0) return width;
  const r = radioArco(width, rise);
  return 2 * r * Math.asin(Math.min(1, width / (2 * r)));
}

/**
 * Altura del eje del arco sobre la línea de arranque, a una distancia `x` del extremo
 * izquierdo (0 ≤ x ≤ width). En los extremos vale 0 y en el centro vale `rise`.
 */
export function alturaArco(x: number, width: number, rise: number): number {
  if (rise <= 0) return 0;
  const r = radioArco(width, rise);
  const dx = x - width / 2;
  return Math.sqrt(Math.max(0, r * r - dx * dx)) - (r - rise);
}

// ---------- Ayudas para fijaciones ----------

export const hw = (item: string, qty: number, unit?: string): HardwareLine => ({ item, qty, unit });

/** Marcas de tornillo en los puntos dados, entrando según `axis`. */
export const tornillos = (points: Vec3[], axis: Axis): Mark[] => points.map((at) => ({ type: 'tornillo', at, axis }));
export const espigas = (points: Vec3[], axis: Axis): Mark[] => points.map((at) => ({ type: 'espiga', at, axis }));
/** Cordón de soldadura entre dos puntos. */
export const cordon = (at: Vec3, to: Vec3): Mark => ({ type: 'soldadura', at, to });
/** Punto de soldadura (punteado). */
export const punto = (at: Vec3): Mark => ({ type: 'punto', at });

/**
 * Cordones alrededor de una unión a tope de un tubo: dibuja el perímetro rectangular
 * de sección [w, h] centrado en `c`, en el plano perpendicular a `axis`.
 */
export function cordonPerimetral(c: Vec3, axis: Axis, w: number, h: number): Mark[] {
  const i = AX[axis];
  const [u, v] = ([0, 1, 2] as const).filter((k) => k !== i);
  const pt = (du: number, dv: number): Vec3 => {
    const p: Vec3 = [...c];
    p[u] += du; p[v] += dv;
    return p;
  };
  const a = pt(-w / 2, -h / 2), b = pt(w / 2, -h / 2), d = pt(w / 2, h / 2), e = pt(-w / 2, h / 2);
  return [cordon(a, b), cordon(b, d), cordon(d, e), cordon(e, a)];
}

/** Reparte `n` posiciones equidistantes entre a y b (incluidos los extremos si n ≥ 2). */
export function repartir(a: number, b: number, n: number): number[] {
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export const mm = (n: number) => `${fmt(Math.round(n * 10) / 10)} mm`;
export const cm = (n: number) => `${fmt(Math.round(n) / 10)} cm`;
