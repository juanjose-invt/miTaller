import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { Joint, Source, Tip } from '../data/tips-types';
import { consejosSoldadura, fuentesSoldadura } from '../data/tips-soldadura';
import { consejosCarpinteria, fuentesCarpinteria } from '../data/tips-carpinteria';
import { ensambles, fuentesEnsambles } from '../data/ensambles';
import { Level } from '../components/bits';

type Area = 'soldadura' | 'carpinteria' | 'ensambles';
const AREAS: { id: Area; label: string; intro: string }[] = [
  { id: 'soldadura', label: 'Soldadura', intro: 'Lo que conviene saber antes de encender el arco: protección, equipo, preparación, técnica y cómo reconocer y corregir los defectos más habituales.' },
  { id: 'carpinteria', label: 'Carpintería', intro: 'Del tablón al mueble: cómo elegir la madera, medir, cortar, unir, encolar y acabar con seguridad.' },
  { id: 'ensambles', label: 'Ensambles sin tornillos', intro: 'Uniones que se sostienen por su propia geometría, con cola, cuñas o pasadores de madera: los ensambles clásicos de taller y los empalmes de la carpintería japonesa.' },
];

function Sources({ ids, all }: { ids: string[]; all: Source[] }) {
  const list = ids.map((id) => all.find((s) => s.id === id)).filter((s): s is Source => !!s);
  if (!list.length) return null;
  return (
    <p className="srcs">
      <span>Fuente{list.length > 1 ? 's' : ''}:</span>
      {list.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.title}>{s.org}{s.lang === 'en' ? ' (en inglés)' : ''}<ExternalLink size={12} aria-hidden /></a>
      ))}
    </p>
  );
}

function SourceList({ all }: { all: Source[] }) {
  return (
    <details className="sources">
      <summary>Todas las fuentes consultadas ({all.length})</summary>
      <ol>{all.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.org}</li>)}</ol>
    </details>
  );
}

function TipList({ tips, sources }: { tips: Tip[]; sources: Source[] }) {
  const cats = useMemo(() => [...new Set(tips.map((t) => t.category))], [tips]);
  const [cat, setCat] = useState<string>('');
  const shown = cats.filter((c) => !cat || c === cat);
  return (
    <div className="tips-layout">
      <div className="cats" role="group" aria-label="Categorías">
        <button aria-pressed={cat === ''} onClick={() => setCat('')}>Todo<span>{tips.length}</span></button>
        {cats.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}<span>{tips.filter((t) => t.category === c).length}</span></button>)}
      </div>
      <div>
        {shown.map((c) => (
          <section className="tip-group" key={c}>
            <h2>{c}</h2>
            {tips.filter((t) => t.category === c).map((t) => (
              <article className="tip" key={t.id}>
                <h3>{t.title}{t.level === 'intermedio' && <span className="chip">Nivel intermedio</span>}</h3>
                <p>{t.body}</p>
                <Sources ids={t.sourceIds} all={sources} />
              </article>
            ))}
          </section>
        ))}
        <SourceList all={sources} />
      </div>
    </div>
  );
}

function JointList({ joints, sources }: { joints: Joint[]; sources: Source[] }) {
  const [trad, setTrad] = useState<'' | Joint['tradition']>('');
  const groups: { id: Joint['tradition']; label: string }[] = [
    { id: 'occidental', label: 'Ensambles clásicos de taller' },
    { id: 'japonesa', label: 'Carpintería japonesa' },
  ];
  const GLUE = { si: 'Con cola', no: 'Sin cola', opcional: 'Cola opcional' } as const;
  return (
    <div className="tips-layout">
      <div className="cats" role="group" aria-label="Tradición">
        <button aria-pressed={trad === ''} onClick={() => setTrad('')}>Todos<span>{joints.length}</span></button>
        {groups.map((g) => <button key={g.id} aria-pressed={trad === g.id} onClick={() => setTrad(g.id)}>{g.label}<span>{joints.filter((j) => j.tradition === g.id).length}</span></button>)}
      </div>
      <div>
        {groups.filter((g) => !trad || trad === g.id).map((g) => (
          <section className="tip-group" key={g.id}>
            <h2>{g.label}</h2>
            {joints.filter((j) => j.tradition === g.id).map((j) => (
              <article className="joint" key={j.id}>
                <div className="joint-head">
                  <h3>{j.name}</h3>
                  {j.nameOriginal && <em lang="ja-Latn">{j.nameOriginal}</em>}
                  <span className="chip"><Level value={j.difficulty} /></span>
                  <span className="chip">{GLUE[j.glue]}</span>
                </div>
                <p>{j.description}</p>
                <div className="two">
                  <div className="block"><h3>Dónde usarlo</h3><ul className="dots">{j.uses.map((u) => <li key={u}>{u}</li>)}</ul></div>
                  <div className="block"><h3>Herramientas</h3><ul className="dots">{j.tools.map((u) => <li key={u}>{u}</li>)}</ul></div>
                </div>
                <div className="block"><h3>Cómo se hace</h3><ol className="todo">{j.how.map((h, i) => <li key={i}><span>{h}</span></li>)}</ol></div>
                <Sources ids={j.sourceIds} all={sources} />
              </article>
            ))}
          </section>
        ))}
        <SourceList all={sources} />
      </div>
    </div>
  );
}

export function Tips() {
  const { area: raw } = useParams();
  const nav = useNavigate();
  const area: Area = AREAS.some((a) => a.id === raw) ? (raw as Area) : 'soldadura';
  const info = AREAS.find((a) => a.id === area)!;
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Consejos de taller</h1>
        <div className="segmented" role="tablist" aria-label="Tema" style={{ justifySelf: 'start' }}>
          {AREAS.map((a) => <button key={a.id} role="tab" aria-selected={a.id === area} onClick={() => nav(`/consejos/${a.id}`)}>{a.label}</button>)}
        </div>
        <p>{info.intro}</p>
        <p className="note" style={{ margin: 0 }}>Cada consejo enlaza a la fuente de la que procede. Son una guía para empezar, no sustituyen al manual de tu herramienta ni a la formación presencial.</p>
      </div>
      {area === 'soldadura' && <TipList key="s" tips={consejosSoldadura} sources={fuentesSoldadura} />}
      {area === 'carpinteria' && <TipList key="c" tips={consejosCarpinteria} sources={fuentesCarpinteria} />}
      {area === 'ensambles' && <JointList joints={ensambles} sources={fuentesEnsambles} />}
    </div>
  );
}
