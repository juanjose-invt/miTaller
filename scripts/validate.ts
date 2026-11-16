/**
 * Valida todos los generadores: cada preset, los valores por defecto y los extremos
 * de cada parámetro. Comprueba geometría finita, piezas sobre el suelo, pasos coherentes
 * y solapes entre piezas (dos piezas no pueden ocupar el mismo volumen).
 *
 *   npm run validate            → todos
 *   npm run validate -- mesa    → solo uno
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaults, normalize } from '../src/core/params';
import type { Generator, ParamValues, Part, Project } from '../src/core/types';

const only = process.argv[2];
const dir = fileURLToPath(new URL('../src/generators/', import.meta.url));
const GENERATORS: Generator[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'index.ts').sort()) {
  const mod = (await import(dir + f)) as Record<string, unknown>;
  for (const v of Object.values(mod)) {
    if (v && typeof v === 'object' && typeof (v as Generator).build === 'function') GENERATORS.push(v as Generator);
  }
}
let errors = 0;
let warnings = 0;

function overlap(a: Part, b: Part): number {
  let vol = 1;
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(a.pos[i] - a.size[i] / 2, b.pos[i] - b.size[i] / 2);
    const hi = Math.min(a.pos[i] + a.size[i] / 2, b.pos[i] + b.size[i] / 2);
    if (hi - lo <= 0.5) return 0; // tolerancia de 0,5 mm
    vol *= hi - lo;
  }
  return vol;
}

function check(g: Generator, label: string, values: ParamValues): void {
  let p: Project;
  try {
    p = g.build(normalize(g, values));
  } catch (e) {
    errors++;
    console.error(`✗ ${g.id} [${label}] lanza: ${(e as Error).message}`);
    return;
  }
  const errs: string[] = [];
  const warns: string[] = [];
  if (!p.parts.length) errs.push('sin piezas');
  if (p.steps.length < 3) errs.push('menos de 3 pasos');
  for (const part of p.parts) {
    if ([...part.size, ...part.pos, ...part.cut].some((n) => !Number.isFinite(n))) errs.push(`${part.id}: valor no finito`);
    if (part.size.some((n) => n <= 0)) errs.push(`${part.id} (${part.name}): medida ≤ 0 → ${part.size.map((n) => n.toFixed(1)).join('×')}`);
    if (!part.rot && part.pos[1] - part.size[1] / 2 < -0.5) errs.push(`${part.id} (${part.name}): por debajo del suelo`);
  }
  const rigid = p.parts.filter((q) => !q.rot && q.material !== 'malla');
  for (let i = 0; i < rigid.length; i++) {
    for (let j = i + 1; j < rigid.length; j++) {
      const v = overlap(rigid[i], rigid[j]);
      if (v > 50) warns.push(`solape ${rigid[i].id} (${rigid[i].name}) ∩ ${rigid[j].id} (${rigid[j].name}): ${Math.round(v)} mm³`);
    }
  }
  const refs = new Map<string, string>();
  for (const part of p.parts) {
    const sig = `${part.stock}|${part.cut.map((n) => n.toFixed(1)).join('x')}`;
    const prev = refs.get(part.ref);
    if (prev && prev !== sig) errs.push(`la referencia ${part.ref} agrupa piezas distintas (${prev} ≠ ${sig})`);
    refs.set(part.ref, sig);
  }
  p.steps.forEach((s, i) => {
    if (!s.title || !s.summary || !s.detail.length) errs.push(`paso ${i + 1}: falta título, resumen o detalle`);
    for (const h of s.hardware ?? []) if (!(h.qty > 0)) errs.push(`paso ${i + 1}: cantidad de «${h.item}» no válida (${h.qty})`);
    for (const m of s.marks ?? []) if ([...m.at, ...(m.to ?? [])].some((n) => !Number.isFinite(n))) errs.push(`paso ${i + 1}: marca no finita`);
  });
  const b = { w: p.dims[0], h: p.dims[1], d: p.dims[2] };
  if (!(b.w > 0 && b.h > 0 && b.d > 0)) errs.push('dims no válidas');
  errors += errs.length;
  warnings += warns.length;
  const tag = errs.length ? '✗' : warns.length ? '!' : '✓';
  console.log(`${tag} ${g.id} [${label}] ${p.parts.length} piezas, ${p.steps.length} pasos`);
  errs.forEach((e) => console.error(`    ERROR ${e}`));
  warns.slice(0, 8).forEach((w) => console.warn(`    aviso ${w}`));
  if (warns.length > 8) console.warn(`    … y ${warns.length - 8} avisos más`);
}

for (const g of GENERATORS) {
  if (only && g.id !== only) continue;
  const d = defaults(g);
  check(g, 'por defecto', d);
  for (const pr of g.presets) check(g, `plantilla ${pr.id}`, { ...d, ...pr.values });
  for (const prm of g.params) {
    if (prm.type === 'number') {
      check(g, `${prm.key}=mín`, { ...d, [prm.key]: prm.min });
      check(g, `${prm.key}=máx`, { ...d, [prm.key]: prm.max });
    } else if (prm.type === 'select') {
      for (const o of prm.options) if (o.value !== prm.default) check(g, `${prm.key}=${o.value}`, { ...d, [prm.key]: o.value });
    } else {
      check(g, `${prm.key}=${!prm.default}`, { ...d, [prm.key]: !prm.default });
    }
  }
  // todo al mínimo y todo al máximo a la vez
  const lo: ParamValues = { ...d }, hi: ParamValues = { ...d };
  for (const prm of g.params) if (prm.type === 'number') { lo[prm.key] = prm.min; hi[prm.key] = prm.max; }
  check(g, 'todo mín', lo);
  check(g, 'todo máx', hi);
}
console.log(`\n${errors} errores, ${warnings} avisos de solape`);
process.exit(errors ? 1 : 0);
