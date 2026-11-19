import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, GraduationCap, LayoutGrid, PencilRuler, SlidersHorizontal } from 'lucide-react';
import type { Craft, Generator, Project } from '../core/types';
import { GENERATORS, getGenerator } from '../generators';
import { buildProject, defaults } from '../core/params';
import { allProgress } from '../core/store';
import { Viewer3D } from '../components/Viewer3D';
import { CraftChip, Level, Thumb, dimsLabel, hoursLabel } from '../components/bits';

type Filter = 'todo' | Craft;
/** Plantilla con la que se enseña cada elemento en la portada (por defecto, la primera). */
const SHOW: Record<string, string> = { 'puerta-verja': 'forja', valla: 'clasica', reja: 'forja', banco: 'jardin', estanteria: 'trastero' };
const presetOf = (g: Generator) => g.presets.find((p) => p.id === SHOW[g.id]) ?? g.presets[0];
const build = (g: Generator, presetId?: string) => buildProject(g, { ...defaults(g), ...((g.presets.find((p) => p.id === presetId) ?? presetOf(g))?.values ?? {}) });

/** Todas las plantillas, con filtro por oficio. */
export function Templates() {
  const [filter, setFilter] = useState<Filter>('todo');
  const items = useMemo(() => GENERATORS.flatMap((g) => g.presets.map((p) => ({ g, p, project: build(g, p.id) }))), []);
  const shown = items.filter((i) => filter === 'todo' || i.g.craft === filter);
  return (
    <section className="section wrap" aria-labelledby="h-plantillas">
      <div className="section-head">
        <div>
          <h1 id="h-plantillas" className="h-page">Plantillas</h1>
          <p>{items.length} proyectos completos con sus medidas, su lista de corte y su paso a paso en 3D. Ábrelos tal cual o cámbiales el diseño.</p>
        </div>
        <div className="segmented" role="group" aria-label="Filtrar por oficio">
          {(['todo', 'carpinteria', 'soldadura'] as Filter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'todo' ? 'Todo' : f === 'carpinteria' ? 'Carpintería' : 'Soldadura'}</button>
          ))}
        </div>
      </div>
      <div className="gallery">
        {shown.map(({ g, p, project }) => (
          <Link key={`${g.id}-${p.id}`} to={`/proyecto/${g.id}?plantilla=${p.id}`} className="tpl">
            <div className="tpl-img"><Thumb id={`${g.id}-${p.id}`} make={() => project} alt={`Vista 3D de ${p.name}`} /><CraftChip craft={g.craft} /></div>
            <div className="tpl-body">
              <h3>{p.name}</h3>
              <p>{p.blurb}</p>
              <div className="tpl-meta"><Level value={project.difficulty} /><span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Clock size={14} aria-hidden />{hoursLabel(project.hours)}</span><span>{dimsLabel(project.dims)}</span></div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Modelo que se monta solo, paso a paso. */
function Autoplay({ project, className, label, dark }: { project: Project; className: string; label: string; dark?: boolean }) {
  const playable = useMemo(() => project.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.parts.length > 0), [project]);
  const [k, setK] = useState(0);
  useEffect(() => {
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      setK(playable.length - 1);
      return;
    }
    const t = setInterval(() => setK((v) => (v + 1) % (playable.length + 2)), 2300);
    return () => clearInterval(t);
  }, [playable.length]);
  const idx = Math.min(k, playable.length - 1);
  const cur = playable[idx];
  return (
    <Viewer3D project={project} step={cur.i} ghost labels={false} className={className} label={label}>
      <div className={`hero-caption ${dark ? 'on-dark' : ''}`}><span className="n">{idx + 1}/{playable.length}</span><span>{cur.s.title}</span></div>
    </Viewer3D>
  );
}

function Continue() {
  const items = useMemo(() => {
    const out: { href: string; title: string; done: number; total: number }[] = [];
    for (const [key, done] of Object.entries(allProgress())) {
      const [gen, query = ''] = key.split('?');
      const g = getGenerator(gen);
      if (!g || !done.length) continue;
      try {
        const q = new URLSearchParams(query);
        const project = buildProject(g, { ...defaults(g), ...Object.fromEntries(q) });
        if (done.length >= project.steps.length) continue;
        const next = project.steps.findIndex((_, i) => !done.includes(i));
        q.set('paso', String(next + 1));
        out.push({ href: `/proyecto/${gen}?${q}`, title: project.title, done: done.length, total: project.steps.length });
      } catch { /* diseño que ya no se puede abrir */ }
    }
    return out.slice(0, 3);
  }, []);
  if (!items.length) return null;
  return (
    <section className="wrap continue" aria-labelledby="h-cont">
      <h2 id="h-cont">Sigue donde lo dejaste</h2>
      <div className="continue-list">
        {items.map((it) => (
          <Link key={it.href} to={it.href} className="continue-card">
            <strong>{it.title}</strong>
            <span className="progress"><i style={{ width: `${(it.done / it.total) * 100}%` }} /><span>{it.done} de {it.total} pasos</span></span>
            <span className="go">Continuar <ArrowRight size={16} aria-hidden /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Elements({ craft, title, lead }: { craft: Craft; title: string; lead: string }) {
  const list = GENERATORS.filter((g) => g.craft === craft);
  return (
    <section className="section wrap" aria-labelledby={`h-${craft}`}>
      <div className="section-head"><div><h2 id={`h-${craft}`}>{title}</h2><p>{lead}</p></div></div>
      <div className="elements">
        {list.map((g, i) => {
          const p = presetOf(g);
          return (
            <article key={g.id} className={`element ${i === 0 ? 'big' : ''}`}>
              <Link to={`/proyecto/${g.id}?plantilla=${p?.id ?? ''}`} className="element-img" aria-label={`${g.title}: abrir ${p?.name ?? 'el proyecto'}`}>
                <Thumb id={`el-${g.id}`} make={() => build(g)} alt="" size={i === 0 ? [960, 720] : [640, 480]} />
              </Link>
              <div className="element-body">
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <ul className="element-presets" aria-label={`Plantillas de ${g.title}`}>
                  {g.presets.map((pr) => <li key={pr.id}><Link to={`/proyecto/${g.id}?plantilla=${pr.id}`}>{pr.name}</Link></li>)}
                </ul>
                <Link className="go" to={`/crear/${g.id}`}>Diseñar a medida <ArrowRight size={16} aria-hidden /></Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Home() {
  const hero = useMemo(() => build(getGenerator('mesa') ?? GENERATORS[0], 'comedor'), []);
  const star = useMemo(() => { const g = getGenerator('puerta-verja'); return g ? build(g, 'forja') : null; }, []);
  return (
    <>
      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <h1>Constrúyelo tú, <em>pieza a pieza</em>.</h1>
            <p className="lead">Manuales de carpintería y soldadura para empezar desde cero: ves en 3D cada pieza, cada tornillo y cada cordón antes de cortar nada, y te llevas el manual en PDF al taller.</p>
            <div className="doors">
              <Link to="/plantillas" className="door main"><strong><LayoutGrid size={22} aria-hidden />Partir de una plantilla</strong><span>Mesas, estanterías, conejeras, cunas, verjas, vallas… listas para construir.</span></Link>
              <Link to="/crear" className="door"><strong><SlidersHorizontal size={22} aria-hidden />Diseñar a medida</strong><span>Estira el modelo, cambia la distribución, los detalles, las uniones y el acabado.</span></Link>
            </div>
            <div className="hero-links">
              <Link to="/libre"><PencilRuler size={18} aria-hidden />Modo libre: pieza a pieza, desde cero</Link>
              <Link to="/aprende"><GraduationCap size={18} aria-hidden />¿Por dónde empiezo?</Link>
            </div>
          </div>
          <Autoplay project={hero} className="hero-stage" label="Animación 3D: una mesa que se monta paso a paso" />
        </div>
      </section>

      <Continue />

      <Elements craft="carpinteria" title="Carpintería" lead="Muebles y construcciones de madera, con tornillos o con ensambles tradicionales." />

      {star && (
        <section className="feature" aria-labelledby="h-star">
          <div className="wrap feature-grid">
            <Autoplay project={star} className="feature-stage" label="Animación 3D: una puerta de forja que se suelda paso a paso" dark />
            <div>
              <h2 id="h-star">También forja: volutas, lanzas y arcos</h2>
              <p>Puertas, vallas y rejas con decoración que tú compones motivo a motivo. El modelo marca dónde va cada punto y cada cordón, y las plantillas de las volutas se imprimen a tamaño real.</p>
              <div className="feature-actions">
                <Link className="btn primary" to="/proyecto/puerta-verja?plantilla=forja">Ver la puerta paso a paso <ArrowRight size={18} aria-hidden /></Link>
                <Link className="btn on-dark" to="/crear/puerta-verja?plantilla=forja">Componer mi propia forja</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <Elements craft="soldadura" title="Soldadura" lead="Del primer taburete a una verja: tubo, pletina y forja, con el punteado y los cordones marcados." />

      <section className="section band" aria-labelledby="h-como">
        <div className="wrap">
          <div className="section-head"><h2 id="h-como">Del plano al taller</h2></div>
          <ol className="how">
            <li><h3>Elige y dale forma</h3><p>Parte de una plantilla, compón un mueble por módulos o empieza de cero. El modelo, el coste y el peso se recalculan con cada cambio.</p></li>
            <li><h3>Míralo montarse</h3><p>La cámara se acerca a cada unión: los tornillos entran, los cordones se dibujan y puedes abrir los ensambles para verlos por dentro.</p></li>
            <li><h3>Llévatelo al banco</h3><p>Manual en PDF, plan de corte para aprovechar cada barra y cada tablero, y tu avance guardado paso a paso.</p></li>
          </ol>
          <div className="band-links">
            <Link className="btn on-dark" to="/aprende"><GraduationCap size={18} aria-hidden />Itinerario para empezar</Link>
            <Link className="btn on-dark" to="/consejos/ensambles">Ensambles sin tornillos en 3D</Link>
            <Link className="btn on-dark" to="/consejos">Consejos con fuentes</Link>
          </div>
        </div>
      </section>
    </>
  );
}
