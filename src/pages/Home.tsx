import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import type { Craft } from '../core/types';
import { GENERATORS, buildProject, defaults } from '../generators';
import { Viewer3D } from '../components/Viewer3D';
import { CraftChip, Level, Thumb, dimsLabel, hoursLabel } from '../components/bits';

type Filter = 'todo' | Craft;

function Templates() {
  const [filter, setFilter] = useState<Filter>('todo');
  const items = useMemo(
    () =>
      GENERATORS.flatMap((g) =>
        g.presets.map((p) => {
          const values = { ...defaults(g), ...p.values };
          const project = buildProject(g, values);
          return { g, p, project, values };
        }),
      ),
    [],
  );
  const shown = items.filter((i) => filter === 'todo' || i.g.craft === filter);
  return (
    <section className="section wrap" id="plantillas" aria-labelledby="h-plantillas">
      <div className="section-head">
        <div>
          <h2 id="h-plantillas">¿Qué quieres construir?</h2>
          <p>Cada plantilla es un proyecto completo con sus medidas, su lista de corte y su paso a paso en 3D. Ábrela tal cual o cámbiale las medidas.</p>
        </div>
        <div className="segmented" role="group" aria-label="Filtrar por oficio">
          {(['todo', 'carpinteria', 'soldadura'] as Filter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'todo' ? 'Todo' : f === 'carpinteria' ? 'Carpintería' : 'Soldadura'}
            </button>
          ))}
        </div>
      </div>
      <div className="gallery">
        {shown.map(({ g, p, project }) => (
          <Link key={`${g.id}-${p.id}`} to={`/proyecto/${g.id}?plantilla=${p.id}`} className="tpl">
            <div className="tpl-img">
              <Thumb id={`${g.id}-${p.id}`} make={() => project} alt={`Vista 3D de ${p.name}`} />
              <CraftChip craft={g.craft} />
            </div>
            <div className="tpl-body">
              <h3>{p.name}</h3>
              <p>{p.blurb}</p>
              <div className="tpl-meta">
                <Level value={project.difficulty} />
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Clock size={14} aria-hidden />{hoursLabel(project.hours)}</span>
                <span>{dimsLabel(project.dims)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroStage() {
  const project = useMemo(() => {
    const g = GENERATORS.find((x) => x.id === 'mesa') ?? GENERATORS[0];
    return buildProject(g, { ...defaults(g), ...g.presets[0].values });
  }, []);
  // se salta el paso de corte: la portada enseña el montaje
  const playable = useMemo(() => project.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.parts.length > 0), [project]);
  const [k, setK] = useState(0);
  useEffect(() => {
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      setK(playable.length - 1);
      return;
    }
    const t = setInterval(() => setK((v) => (v + 1) % (playable.length + 1)), 2400);
    return () => clearInterval(t);
  }, [playable.length]);
  const cur = playable[Math.min(k, playable.length - 1)];
  return (
    <Viewer3D project={project} step={cur.i} ghost labels={false} className="hero-stage" label="Animación 3D: una mesa que se monta paso a paso">
      <div className="hero-caption">
        <span className="n">{Math.min(k, playable.length - 1) + 1}/{playable.length}</span>
        <span>{cur.s.title}</span>
      </div>
    </Viewer3D>
  );
}

export function Home({ only }: { only?: 'plantillas' }) {
  if (only === 'plantillas') return <Templates />;
  return (
    <>
      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <h1>Constrúyelo tú, <em>pieza a pieza</em>.</h1>
            <p className="lead">
              Manuales de carpintería y soldadura para empezar desde cero: ves en 3D cada pieza, cada tornillo y cada cordón antes de cortar nada, y te llevas el manual en PDF al taller.
            </p>
            <div className="doors">
              <Link to="/plantillas" className="door main">
                <strong><LayoutGrid size={22} aria-hidden />Partir de una plantilla</strong>
                <span>Mesas, estanterías, conejeras, cunas, verjas, vallas… listas para construir.</span>
              </Link>
              <Link to="/crear" className="door">
                <strong><SlidersHorizontal size={22} aria-hidden />Diseñar a medida</strong>
                <span>Elige el elemento y ajusta medidas, forma, detalles y uniones.</span>
              </Link>
            </div>
          </div>
          <HeroStage />
        </div>
      </section>

      <Templates />

      <section className="section band" aria-labelledby="h-como">
        <div className="wrap">
          <div className="section-head"><h2 id="h-como">Del plano al taller</h2></div>
          <ol className="how">
            <li><h3>Elige y ajusta</h3><p>Parte de una plantilla o configura tu pieza. El modelo, la lista de corte y la tornillería se recalculan con cada cambio.</p></li>
            <li><h3>Míralo montarse</h3><p>Avanza paso a paso: las piezas nuevas se marcan en rojo, con la posición de cada tornillo, tubillón o cordón de soldadura.</p></li>
            <li><h3>Llévatelo en PDF</h3><p>Descarga el manual con la lista de la compra, el despiece y todos los pasos ilustrados para tenerlo junto al banco.</p></li>
          </ol>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="h-aprende">
        <div className="section-head">
          <div>
            <h2 id="h-aprende">Aprende el oficio</h2>
            <p>Consejos contrastados con organismos de seguridad, fabricantes y publicaciones técnicas. Cada uno enlaza a su fuente.</p>
          </div>
        </div>
        <div className="split">
          <Link to="/consejos/soldadura" className="linkcard"><h3>Soldadura</h3><p>Protección, electrodos, preparación de la junta, técnica y defectos habituales.</p><span className="go">Ver consejos <ArrowRight size={16} aria-hidden /></span></Link>
          <Link to="/consejos/carpinteria" className="linkcard"><h3>Carpintería</h3><p>Madera, medir y marcar, corte, tornillería, encolado y acabado.</p><span className="go">Ver consejos <ArrowRight size={16} aria-hidden /></span></Link>
          <Link to="/consejos/ensambles" className="linkcard"><h3>Ensambles sin tornillos</h3><p>De la caja y espiga a los empalmes japoneses: cómo trabajan y dónde usarlos.</p><span className="go">Ver ensambles <ArrowRight size={16} aria-hidden /></span></Link>
        </div>
      </section>
    </>
  );
}
