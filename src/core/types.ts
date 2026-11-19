/**
 * Modelo de datos de miTaller.
 *
 * Unidades: milímetros. Ejes: X = ancho (izquierda→derecha), Y = alto (suelo en y = 0),
 * Z = fondo (atrás→delante). Un proyecto es una lista de piezas colocadas en su posición
 * final y una lista de pasos que dicen qué piezas se añaden en cada momento.
 */
export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';

export type MaterialId =
  | 'pino' // listón / tablero de pino
  | 'haya' // madera dura clara (barrotes, tubillones)
  | 'contrachapado'
  | 'dm'
  | 'acero' // tubo / perfil / pletina de acero
  | 'malla' // malla electrosoldada (se dibuja como rejilla)
  | 'herraje'; // bisagras, cierres, ruedas…

export type Craft = 'carpinteria' | 'soldadura';

export interface Part {
  /** Identificador único de la pieza dentro del proyecto. */
  id: string;
  /** Letra de la lista de corte (A, B, C…). Piezas idénticas comparten letra. */
  ref: string;
  name: string;
  /**
   * 'box' y 'cyl' son las formas de corte normales. Las demás son elementos de forja decorativa:
   * 'cone' punta de lanza o pincho · 'voluta' espiral en C, en S o simple · 'aro' anillo ·
   * 'arco' barra curvada en arco · 'bola' esfera o macolla.
   */
  shape: 'box' | 'cyl' | 'cone' | 'voluta' | 'aro' | 'arco' | 'bola' | 'prisma' | 'rombo' | 'corazon' | 'retorcido';
  /**
   * Solo para 'prisma': contorno del polígono en mm, en el plano perpendicular a `polyNormal`,
   * medido desde la esquina mínima de la pieza. Ejes del plano: normal 'z' → (x, y); normal 'x' → (z, y);
   * normal 'y' → (x, z). El prisma se extruye todo el grueso de la pieza en la dirección de la normal.
   */
  poly?: [number, number][];
  polyNormal?: Axis;
  /** Caja envolvente final en mm [x, y, z]. Para 'cyl' el diámetro ocupa los dos ejes no longitudinales. */
  size: Vec3;
  /** Eje longitudinal (dirección del largo / de la veta). */
  axis: Axis;
  /** Centro de la pieza en mm. */
  pos: Vec3;
  /** Rotación opcional (radianes, orden XYZ) alrededor del centro. */
  rot?: Vec3;
  material: MaterialId;
  /** Material de partida tal y como se compra: «Listón de pino 44×44 mm». */
  stock: string;
  stockKind: 'lineal' | 'tablero' | 'malla' | 'unidad';
  /** Medidas de corte, de mayor a menor: [largo, ancho, grueso] en mm. */
  cut: Vec3;
  /** Espesor de pared, solo para tubo de acero. */
  wall?: number;
  /** Parámetros de las formas decorativas. */
  deco?: {
    /** Grueso de la barra con la que está hecha la voluta, el aro o el arco (mm). */
    bar?: number;
    curve?: 'C' | 'S' | 'espiral';
    /** Refleja la voluta en horizontal (la C abre hacia el otro lado). */
    mirror?: boolean;
    /** Nº de caras de la punta: 4 = lanza piramidal, 16 o más = cono. */
    sides?: number;
  };
  /** Paso de la rejilla en mm, solo para malla. */
  meshCell?: number;
  note?: string;
}

/** Marca dibujada en 3D para enseñar dónde va cada fijación. */
export interface Mark {
  type: 'tornillo' | 'soldadura' | 'espiga' | 'punto';
  at: Vec3;
  /** Extremo opuesto: convierte la marca en un cordón / línea (soldaduras). */
  to?: Vec3;
  /** Dirección en la que entra el tornillo o la espiga. */
  axis?: Axis;
}

export interface HardwareLine {
  /** Descripción completa y comprable: «Tornillo para madera 4×40 mm, cabeza avellanada». */
  item: string;
  qty: number;
  unit?: string; // 'ud' por defecto
}

export interface Technique {
  /** Nombre de la técnica: «Unión atornillada con taladro piloto». */
  name: string;
  /** Por qué es la mejor opción aquí. */
  why: string;
  /** Cómo se ejecuta, en frases cortas. */
  how: string[];
  /** id de un ensamble de `src/data/ensambles-3d.ts` para enseñarlo en 3D junto a la técnica. */
  joint?: string;
}

export interface Step {
  title: string;
  /** Una frase: qué se consigue en este paso. */
  summary: string;
  /** Instrucciones detalladas, en orden. */
  detail: string[];
  /** ids de las piezas que se colocan en este paso. */
  parts: string[];
  marks?: Mark[];
  technique?: Technique;
  hardware?: HardwareLine[];
  tools?: string[];
  /** Consejo de oficio. */
  tip?: string;
  /** Aviso de seguridad o error típico. */
  warning?: string;
  /** Comprobación antes de seguir: «Mide las diagonales: deben ser iguales». */
  check?: string;
  /** Tipo de paso, para el icono y el PDF. */
  kind?: 'preparar' | 'cortar' | 'montar' | 'soldar' | 'acabar';
}

export interface SourceRef {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  craft: Craft;
  summary: string;
  /** 1 = primer proyecto, 2 = con algo de práctica, 3 = exigente. */
  difficulty: 1 | 2 | 3;
  /** Horas de trabajo orientativas (sin secados). */
  hours: number;
  /** Medidas exteriores finales [ancho, alto, fondo] en mm. */
  dims: Vec3;
  parts: Part[];
  steps: Step[];
  /** Normas de seguridad específicas de este proyecto. */
  safety: string[];
  /** Notas de diseño: por qué estas medidas, límites de uso… */
  notes?: string[];
  sources?: SourceRef[];
  /** Tinte o pintura (hex) con el que se dibuja toda la madera. Sin valor, madera natural. */
  stain?: string;
  /** Color de pintura (hex) con el que se dibuja todo el acero: «#26282b» para negro forja. Sin valor, acero visto. */
  paint?: string;
  /** Resumen legible de las opciones elegidas. */
  spec: { label: string; value: string }[];
}

// ---------- Generadores paramétricos ----------

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  /** Agrupa los campos en el configurador: «Medidas», «Material», «Uniones»… */
  group: string;
  /** Mostrar solo si se cumple (p. ej. opciones que dependen de otra). */
  visible?: (v: ParamValues) => boolean;
}
export interface NumberParam extends ParamBase {
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit: string;
  default: number;
}
export interface SelectParam extends ParamBase {
  type: 'select';
  options: { value: string; label: string; hint?: string }[];
  default: string;
}
export interface BoolParam extends ParamBase {
  type: 'boolean';
  default: boolean;
}
/**
 * Patrón repetible: una secuencia de motivos elegidos de `options` (p. ej. forja: «C, aro, S»).
 * El valor es una cadena con los códigos separados por comas; el generador la repite cíclicamente.
 */
export interface PatternParam extends ParamBase {
  type: 'pattern';
  options: { value: string; label: string; hint?: string }[];
  /** Nº máximo de motivos de la secuencia. */
  max: number;
  default: string;
}
/**
 * Parámetro con editor propio (p. ej. la distribución de un mueble modular). El valor es una cadena
 * que el generador sabe leer; `editor` es el id de un componente registrado en `src/components/editors.tsx`.
 */
export interface CustomParam extends ParamBase {
  type: 'custom';
  editor: string;
  default: string;
}
export type ParamDef = NumberParam | SelectParam | BoolParam | PatternParam | CustomParam;

export interface Preset {
  id: string;
  name: string;
  /** Una línea para la tarjeta de la plantilla. */
  blurb: string;
  values: ParamValues;
}

export interface Generator {
  id: string;
  /** Nombre del tipo de elemento: «Mesa», «Conejera»… */
  title: string;
  craft: Craft;
  description: string;
  difficulty: 1 | 2 | 3;
  params: ParamDef[];
  presets: Preset[];
  /**
   * Parámetros numéricos que se pueden estirar arrastrando los tiradores del modelo, por eje.
   * Si falta, se deducen por el nombre de la clave (ancho/largo → x, alto → y, fondo → z).
   */
  dragAxes?: Partial<Record<Axis, string>>;
  build: (values: ParamValues) => Project;
}
