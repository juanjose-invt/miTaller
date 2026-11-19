import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock } from 'lucide-react';
import type { Craft, Project } from '../core/types';
import { getGenerator } from '../generators';
import { buildProject, defaults } from '../core/params';
import { allProgress } from '../core/store';
import { Level, Thumb, hoursLabel } from '../components/bits';

/** Itinerario: orden recomendado de proyectos y qué se gana con cada uno. */
const PATH: Record<Craft, { gen: string; preset?: string; why: string }[]> = {
  carpinteria: [
    { gen: 'banco', preset: 'zapatero', why: 'Cortes rectos y tornillos. Lo justo para soltarte con la sierra, el taladro y la escuadra.' },
    { gen: 'estanteria', preset: 'baja', why: 'Tu primer mueble de tablero: aprender a montar a escuadra y a que no baile.' },
    { gen: 'mesa', preset: 'escritorio', why: 'Patas y faldones: la estructura que comparten casi todas las mesas.' },
    { gen: 'banco', preset: 'jardin', why: 'Más piezas y un respaldo: orden de montaje, repetición y piezas iguales entre sí.' },
    { gen: 'estanteria', preset: 'libreria', why: 'Un mueble alto: la precisión se acumula, aparece la trasera y hay que fijarlo a la pared.' },
    { gen: 'modular', why: 'Puertas y cajones: holguras, herrajes y frentes alineados.' },
    { gen: 'conejera', why: 'Bastidores, malla y bisagras en un proyecto largo, con varias fases.' },
    { gen: 'mesa', preset: 'auxiliar', why: 'Tu primer ensamble sin tornillos: caja y espiga.' },
    { gen: 'cuna', why: 'El más exigente: tolerancias de seguridad y uniones desmontables.' },
  ],
  soldadura: [
    { gen: 'taburete-acero', why: 'Pocas piezas y cordones cortos: puntear, comprobar la escuadra y soldar sin perforar.' },
    { gen: 'lenero', why: 'Bastidores planos repetidos: coger ritmo con el corte y el punteado.' },
    { gen: 'mesa-acero', why: 'Una estructura en tres dimensiones: controlar la deformación alternando cordones.' },
    { gen: 'estanteria-acero', why: 'Piezas largas y uniones atornilladas además de soldadas.' },
    { gen: 'reja', preset: 'sencilla', why: 'Tu primera cerrajería: repartir barrotes con una galga y mantener el marco plano.' },
    { gen: 'valla', preset: 'lisa', why: 'Tramos iguales y postes: trabajar en serie y anclar al suelo.' },
    { gen: 'jaula', why: 'Tubo fino, malla y puertas con holgura.' },
    { gen: 'puerta-verja', preset: 'lanzas', why: 'Una hoja que cuelga: pernios, cierre y que no se descuadre.' },
    { gen: 'puerta-verja', preset: 'forja', why: 'Forja decorativa: volutas, arco y remates.' },
  ],
};

interface Stop { href: string; key: string; title: string; why: string; project: Project; techniques: string[]; done: number }

function stops(craft: Craft, progress: Record<string, number[]>): Stop[] {
  const out: Stop[] = [];
  for (const s of PATH[craft]) {
    const g = getGenerator(s.gen);
    if (!g) continue;
    const preset = g.presets.find((p) => p.id === s.preset) ?? g.presets[0];
    const project = buildProject(g, { ...defaults(g), ...(preset?.values ?? {}) });
    const techniques = [...new Set(project.steps.map((st) => st.technique?.name).filter((t): t is string => !!t))];
    const done = Math.max(0, ...Object.entries(progress).filter(([k]) => k.startsWith(`${g.id}?`)).map(([, v]) => v.length));
    out.push({ href: `/proyecto/${g.id}?plantilla=${preset?.id ?? ''}`, key: `${g.id}-${preset?.id}`, title: preset?.name ?? g.title, why: s.why, project, techniques, done });
  }
  return out;
}

export function Learn() {
  const progress = useMemo(() => allProgress(), []);
  const data = useMemo(() => ({ carpinteria: stops('carpinteria', progress), soldadura: stops('soldadura', progress) }), [progress]);
  return (
    <div className="wrap" style={{ paddingBottom: 64 }}>
      <div className="page-head">
        <h1>Aprende construyendo</h1>
        <p>Dos itinerarios, de menos a más. Cada proyecto añade una técnica nueva sobre lo que ya sabes hacer; no hace falta seguir el orden, pero ayuda.</p>
      </div>
      <div className="paths">
        {(['carpinteria', 'soldadura'] as Craft[]).map((craft) => (
          <section key={craft} aria-labelledby={`p-${craft}`}>
            <h2 id={`p-${craft}`}>{craft === 'carpinteria' ? 'Carpintería' : 'Soldadura'}</h2>
            <ol className="path">
              {data[craft].map((s, i) => {
                const total = s.project.steps.length;
                const finished = s.done >= total;
                return (
                  <li key={s.key} className={finished ? 'finished' : ''}>
                    <span className="path-n">{finished ? <Check size={18} aria-label="Terminado" /> : i + 1}</span>
                    <Link to={s.href} className="path-card">
                      <span className="path-img"><Thumb id={s.key} make={() => s.project} alt="" /></span>
                      <span className="path-body">
                        <strong>{s.title}</strong>
                        <span>{s.why}</span>
                        {s.techniques.length > 0 && <span className="path-tech">Practicas: {s.techniques.slice(0, 3).join(' · ')}</span>}
                        <span className="tpl-meta"><Level value={s.project.difficulty} /><span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Clock size={14} aria-hidden />{hoursLabel(s.project.hours)}</span>{s.done > 0 && !finished && <span className="chip">{s.done} de {total} pasos</span>}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      <section className="section" style={{ paddingBottom: 0 }} aria-labelledby="h-ref">
        <div className="section-head"><div><h2 id="h-ref">Antes de encender nada</h2><p>Consejos contrastados con organismos de seguridad, fabricantes y publicaciones técnicas. Cada uno enlaza a su fuente.</p></div></div>
        <div className="split">
          <Link to="/consejos/soldadura" className="linkcard"><h3>Soldadura</h3><p>Protección, electrodos, preparación de la junta, técnica y defectos habituales.</p><span className="go">Ver consejos <ArrowRight size={16} aria-hidden /></span></Link>
          <Link to="/consejos/carpinteria" className="linkcard"><h3>Carpintería</h3><p>Madera, medir y marcar, corte, tornillería, encolado y acabado.</p><span className="go">Ver consejos <ArrowRight size={16} aria-hidden /></span></Link>
          <Link to="/consejos/ensambles" className="linkcard"><h3>Ensambles sin tornillos</h3><p>De la caja y espiga a los empalmes japoneses, en 3D: ábrelos y mira cómo encajan.</p><span className="go">Ver ensambles <ArrowRight size={16} aria-hidden /></span></Link>
        </div>
      </section>
    </div>
  );
}
