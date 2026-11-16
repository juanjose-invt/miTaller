import type { Generator } from '../core/types';

/**
 * Registro de generadores. Cualquier archivo de esta carpeta que exporte un objeto
 * Generator se registra solo; ORDER fija el orden de la galería.
 */
const ORDER = ['mesa', 'estanteria', 'banco', 'conejera', 'cuna', 'taburete-acero', 'lenero', 'mesa-acero', 'estanteria-acero', 'jaula'];

const mods = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });
const found: Generator[] = [];
for (const [path, mod] of Object.entries(mods)) {
  if (path === './index.ts') continue;
  for (const v of Object.values(mod)) {
    if (v && typeof v === 'object' && typeof (v as Generator).build === 'function' && Array.isArray((v as Generator).params)) found.push(v as Generator);
  }
}
const rank = (id: string) => (ORDER.indexOf(id) === -1 ? 999 : ORDER.indexOf(id));
export const GENERATORS: Generator[] = found.sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title, 'es'));

export const getGenerator = (id: string): Generator | undefined => GENERATORS.find((g) => g.id === id);

export { buildProject, defaults, fromQuery, normalize, toQuery } from '../core/params';
