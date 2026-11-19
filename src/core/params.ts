import type { Axis, Generator, ParamDef, ParamValues, Project, SelectParam } from './types';
import { STAINS } from './materials';

/** Parámetros comunes que añade la web a todos los generadores de un oficio. */
const TINTE: SelectParam = {
  key: 'tinte', label: 'Tinte o pintura', type: 'select', group: 'Acabado', default: 'natural',
  options: STAINS.map((s) => ({ value: s.value, label: s.label, hint: s.hint })),
  help: 'Color orientativo: el tono real depende del producto y de la madera. Pruébalo antes en un recorte.',
};

export function allParams(g: Generator): ParamDef[] {
  return g.craft === 'carpinteria' && !g.params.some((p) => p.key === 'tinte') ? [...g.params, TINTE] : g.params;
}

export function defaults(g: Generator): ParamValues {
  return Object.fromEntries(allParams(g).map((p) => [p.key, p.default]));
}

/** Completa con valores por defecto y recorta los números a su rango. */
export function normalize(g: Generator, values: ParamValues): ParamValues {
  const out: ParamValues = {};
  for (const p of allParams(g)) {
    const raw = values[p.key];
    if (p.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw);
      out[p.key] = Number.isFinite(n) && raw !== undefined && raw !== '' ? Math.min(p.max, Math.max(p.min, n)) : p.default;
    } else if (p.type === 'boolean') {
      out[p.key] = raw === undefined ? p.default : raw === true || raw === 'true' || raw === '1';
    } else if (p.type === 'pattern') {
      const ok = new Set(p.options.map((o) => o.value));
      const codes = typeof raw === 'string' ? raw.split(',').map((c) => c.trim()).filter((c) => ok.has(c)).slice(0, p.max) : null;
      out[p.key] = codes && (codes.length || raw === '') ? codes.join(',') : p.default;
    } else if (p.type === 'custom') {
      out[p.key] = typeof raw === 'string' && raw.length ? raw : p.default;
    } else {
      out[p.key] = p.options.some((o) => o.value === raw) ? (raw as string) : p.default;
    }
  }
  return out;
}

export function buildProject(g: Generator, values: ParamValues): Project {
  const v = normalize(g, values);
  const project = g.build(v);
  const stain = STAINS.find((s) => s.value === v.tinte);
  if (g.craft === 'carpinteria' && stain) {
    if (stain.hex) project.stain = stain.hex;
    project.spec = [...project.spec, { label: 'Acabado de la madera', value: stain.label }];
  }
  return project;
}

export function toQuery(g: Generator, values: ParamValues): string {
  const d = defaults(g);
  const q = new URLSearchParams();
  for (const p of allParams(g)) {
    const val = values[p.key];
    if (val !== undefined && val !== d[p.key]) q.set(p.key, String(val));
  }
  return q.toString();
}

export function fromQuery(g: Generator, q: URLSearchParams): ParamValues {
  const preset = g.presets.find((p) => p.id === q.get('plantilla'));
  const raw: ParamValues = { ...defaults(g), ...(preset?.values ?? {}) };
  for (const p of allParams(g)) {
    const s = q.get(p.key);
    if (s !== null) raw[p.key] = s;
  }
  return normalize(g, raw);
}

/** Clave del parámetro numérico que controla cada eje al arrastrar los tiradores del modelo. */
export function dragKeys(g: Generator, values: ParamValues): Partial<Record<Axis, string>> {
  const out: Partial<Record<Axis, string>> = {};
  const guess: Record<Axis, RegExp> = { x: /^(ancho|largo)$/i, y: /^(alto|altura)$/i, z: /^(fondo|profundidad)$/i };
  for (const axis of ['x', 'y', 'z'] as Axis[]) {
    const key = g.dragAxes?.[axis] ?? g.params.find((p) => p.type === 'number' && guess[axis].test(p.key))?.key;
    const p = g.params.find((q) => q.key === key);
    if (p && p.type === 'number' && (!p.visible || p.visible(values))) out[axis] = p.key;
  }
  return out;
}
