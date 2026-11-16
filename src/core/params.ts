import type { Generator, ParamValues, Project } from './types';

export function defaults(g: Generator): ParamValues {
  return Object.fromEntries(g.params.map((p) => [p.key, p.default]));
}

/** Completa con valores por defecto y recorta los números a su rango. */
export function normalize(g: Generator, values: ParamValues): ParamValues {
  const out: ParamValues = {};
  for (const p of g.params) {
    const raw = values[p.key];
    if (p.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw);
      out[p.key] = Number.isFinite(n) && raw !== undefined && raw !== '' ? Math.min(p.max, Math.max(p.min, n)) : p.default;
    } else if (p.type === 'boolean') {
      out[p.key] = raw === undefined ? p.default : raw === true || raw === 'true' || raw === '1';
    } else {
      out[p.key] = p.options.some((o) => o.value === raw) ? (raw as string) : p.default;
    }
  }
  return out;
}

export function buildProject(g: Generator, values: ParamValues): Project {
  return g.build(normalize(g, values));
}

export function toQuery(g: Generator, values: ParamValues): string {
  const d = defaults(g);
  const q = new URLSearchParams();
  for (const p of g.params) {
    const val = values[p.key];
    if (val !== undefined && val !== d[p.key]) q.set(p.key, String(val));
  }
  return q.toString();
}

export function fromQuery(g: Generator, q: URLSearchParams): ParamValues {
  const preset = g.presets.find((p) => p.id === q.get('plantilla'));
  const raw: ParamValues = { ...defaults(g), ...(preset?.values ?? {}) };
  for (const p of g.params) {
    const s = q.get(p.key);
    if (s !== null) raw[p.key] = s;
  }
  return normalize(g, raw);
}
