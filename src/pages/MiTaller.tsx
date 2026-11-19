import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, GitCompareArrows, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Project } from '../core/types';
import { GENERATORS, getGenerator } from '../generators';
import { buildProject, defaults, fromQuery } from '../core/params';
import { toolList } from '../core/derive';
import { cost, euros, kilos, weight } from '../core/insights';
import { KEYS, useStored, type SavedDesign } from '../core/store';
import { Level, Thumb, dimsLabel, hoursLabel } from '../components/bits';
import { resolveFree } from '../components/extras';

type Tab = 'disenos' | 'herramientas' | 'precios';
const TABS: { id: Tab; label: string }[] = [
  { id: 'disenos', label: 'Mis diseños' },
  { id: 'herramientas', label: 'Mis herramientas' },
  { id: 'precios', label: 'Mis precios' },
];

function projectOf(d: SavedDesign): Project | null {
  try {
    if (d.gen === 'libre') return resolveFree(d.query.replace(/^d=/, ''))?.project ?? null;
    const g = getGenerator(d.gen);
    return g ? buildProject(g, fromQuery(g, new URLSearchParams(d.query))) : null;
  } catch {
    return null;
  }
}
const hrefOf = (d: SavedDesign) => (d.gen === 'libre' ? `/proyecto/libre?${d.query.startsWith('d=') ? d.query : `d=${encodeURIComponent(d.query)}`}` : `/proyecto/${d.gen}?${d.query}`);
const editOf = (d: SavedDesign) => (d.gen === 'libre' ? `/libre?${d.query.startsWith('d=') ? d.query : `d=${encodeURIComponent(d.query)}`}` : `/crear/${d.gen}?${d.query}`);

function Designs() {
  const [designs, setDesigns] = useStored<SavedDesign[]>(KEYS.designs, []);
  const [prices] = useStored<Record<string, number>>(KEYS.prices, {});
  const [pick, setPick] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const built = useMemo(() => designs.map((d) => ({ d, project: projectOf(d) })), [designs]);
  const cmp = built.filter((b) => pick.includes(b.d.id) && b.project);
  if (!designs.length) {
    return (
      <div className="empty">
        <h2>Todavía no has guardado ningún diseño</h2>
        <p>En el configurador y en cada proyecto tienes el botón «Guardar». Lo que guardes aparece aquí, en este dispositivo.</p>
        <Link className="btn primary" to="/crear">Diseñar algo <ArrowRight size={18} aria-hidden /></Link>
      </div>
    );
  }
  const rows: [string, (p: Project) => string][] = [
    ['Medidas', (p) => dimsLabel(p.dims)],
    ['Piezas', (p) => String(p.parts.length)],
    ['Pasos', (p) => String(p.steps.length)],
    ['Tiempo', (p) => hoursLabel(p.hours)],
    ['Peso aprox.', (p) => kilos(weight(p))],
    ['Coste con tus precios', (p) => { const c = cost(p, prices); return c.priced ? `${euros(c.total)}${c.priced < c.lines ? ' (parcial)' : ''}` : '—'; }],
  ];
  return (
    <div className="stack">
      <p className="muted">Marca dos diseños para compararlos lado a lado.</p>
      {cmp.length === 2 && (
        <div className="compare">
          <h2 className="h-sub"><GitCompareArrows size={20} aria-hidden /> Comparación</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th /><th>{cmp[0].d.name}</th><th>{cmp[1].d.name}</th></tr></thead>
              <tbody>
                <tr><td /><td><div className="cmp-img"><Thumb id={`saved-${cmp[0].d.id}`} make={() => cmp[0].project!} alt="" /></div></td><td><div className="cmp-img"><Thumb id={`saved-${cmp[1].d.id}`} make={() => cmp[1].project!} alt="" /></div></td></tr>
                {rows.map(([label, f]) => {
                  const a = f(cmp[0].project!), b = f(cmp[1].project!);
                  return <tr key={label}><td className="muted">{label}</td><td className={a !== b ? 'dim' : ''}>{a}</td><td className={a !== b ? 'dim' : ''}>{b}</td></tr>;
                })}
                <tr><td className="muted">Nivel</td><td><Level value={cmp[0].project!.difficulty} /></td><td><Level value={cmp[1].project!.difficulty} /></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ul className="saved">
        {built.map(({ d, project }) => (
          <li key={d.id}>
            <label className="saved-pick"><input type="checkbox" checked={pick.includes(d.id)} onChange={() => setPick((old) => (old.includes(d.id) ? old.filter((x) => x !== d.id) : [...old.slice(-1), d.id]))} /><span className="sr-only">Comparar {d.name}</span></label>
            <Link to={hrefOf(d)} className="saved-img">{project ? <Thumb id={`saved-${d.id}`} make={() => project} alt="" /> : <span className="muted">Sin vista</span>}</Link>
            <div className="saved-body">
              <h3><Link to={hrefOf(d)}>{d.name}</Link></h3>
              <p className="muted">{project ? `${dimsLabel(project.dims)} · ${project.parts.length} piezas · ${hoursLabel(project.hours)}` : 'Este diseño ya no se puede abrir.'}</p>
              <p className="muted small">Guardado el {new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="saved-actions">
              <Link className="btn small" to={editOf(d)}><SlidersHorizontal size={16} aria-hidden />Editar</Link>
              {confirm === d.id
                ? <><button className="btn small primary" onClick={() => { setDesigns((old) => old.filter((x) => x.id !== d.id)); setConfirm(null); }}>Sí, borrar</button><button className="btn small ghost" onClick={() => setConfirm(null)}>No</button></>
                : <button className="btn small ghost" onClick={() => setConfirm(d.id)} aria-label={`Borrar ${d.name}`}><Trash2 size={16} aria-hidden /></button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tools() {
  const [owned, setOwned] = useStored<string[]>(KEYS.tools, []);
  const all = useMemo(() => {
    const by: Record<string, Set<string>> = { carpinteria: new Set(), soldadura: new Set() };
    for (const g of GENERATORS) {
      for (const p of [undefined, ...g.presets]) {
        try {
          for (const t of toolList(buildProject(g, { ...defaults(g), ...(p?.values ?? {}) }))) by[g.craft].add(t);
        } catch { /* un generador que falla no rompe la lista */ }
      }
    }
    const shared = [...by.carpinteria].filter((t) => by.soldadura.has(t));
    return [
      { title: 'Para todo', list: shared.sort((a, b) => a.localeCompare(b, 'es')) },
      { title: 'Carpintería', list: [...by.carpinteria].filter((t) => !shared.includes(t)).sort((a, b) => a.localeCompare(b, 'es')) },
      { title: 'Soldadura', list: [...by.soldadura].filter((t) => !shared.includes(t)).sort((a, b) => a.localeCompare(b, 'es')) },
    ];
  }, []);
  const toggle = (t: string) => setOwned((old) => (old.includes(t) ? old.filter((x) => x !== t) : [...old, t]));
  return (
    <div className="stack">
      <p className="muted" style={{ maxWidth: '68ch' }}>Marca lo que ya tienes. En cada proyecto verás qué herramientas te faltan antes de empezar. Tienes {owned.length} marcadas.</p>
      {all.map((s) => (
        <section className="block" key={s.title}>
          <h3>{s.title}</h3>
          <div className="checklist cols">
            {s.list.map((t) => <label key={t}><input type="checkbox" checked={owned.includes(t)} onChange={() => toggle(t)} /><span>{t}</span></label>)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Prices() {
  const [prices, setPrices] = useStored<Record<string, number>>(KEYS.prices, {});
  const keys = Object.keys(prices).sort((a, b) => a.localeCompare(b, 'es'));
  const set = (key: string, raw: string) => {
    const n = Number(raw.replace(',', '.'));
    setPrices((old) => {
      const next = { ...old };
      if (!Number.isFinite(n) || n <= 0) delete next[key];
      else next[key] = n;
      return next;
    });
  };
  if (!keys.length) {
    return (
      <div className="empty">
        <h2>Aún no has apuntado ningún precio</h2>
        <p>Los precios se escriben en la pestaña «Compra» de cualquier proyecto, junto a cada material. Con ellos la web calcula lo que cuesta cada diseño. miTaller no trae precios: cambian según la tienda y la fecha.</p>
        <Link className="btn primary" to="/plantillas">Abrir un proyecto <ArrowRight size={18} aria-hidden /></Link>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="muted" style={{ maxWidth: '68ch' }}>Precio por unidad de compra (barra, m² o unidad), tal y como lo apuntaste. Vacía una casilla para borrarlo.</p>
      <div className="table-wrap">
        <table className="data shop">
          <thead><tr><th>Artículo</th><th className="r">Tu precio</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}><td><strong>{k}</strong></td><td className="r"><span className="price"><input type="text" inputMode="decimal" defaultValue={prices[k]} onBlur={(e) => set(k, e.target.value)} aria-label={`Precio de ${k}`} /><span>€</span></span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MiTaller() {
  const { tab: raw } = useParams();
  const nav = useNavigate();
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : 'disenos';
  return (
    <div className="wrap" style={{ paddingBottom: 56 }}>
      <div className="page-head">
        <h1>Mi taller</h1>
        <p>Tus diseños guardados, las herramientas que tienes y los precios de tu almacén. Todo se guarda solo en este dispositivo.</p>
        <div className="segmented" role="tablist" aria-label="Apartado" style={{ justifySelf: 'start' }}>
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={t.id === tab} onClick={() => nav(`/mi-taller/${t.id}`)}>{t.label}</button>)}
        </div>
      </div>
      {tab === 'disenos' && <Designs />}
      {tab === 'herramientas' && <Tools />}
      {tab === 'precios' && <Prices />}
    </div>
  );
}
