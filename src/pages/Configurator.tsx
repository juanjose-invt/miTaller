import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import type { Generator, ParamDef, ParamValues } from '../core/types';
import { GENERATORS, buildProject, defaults, fromQuery, getGenerator, normalize, toQuery } from '../generators';
import { Viewer3D } from '../components/Viewer3D';
import { CraftChip, Level, Thumb, dimsLabel, hoursLabel } from '../components/bits';

export function ConfiguratorIndex() {
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Configurador</h1>
        <p>Elige qué quieres construir. Después podrás fijar las medidas, la forma, los detalles y el tipo de unión, y ver el resultado en 3D antes de generar el manual.</p>
      </div>
      <div className="types" style={{ paddingBottom: 56 }}>
        {GENERATORS.map((g) => (
          <Link key={g.id} to={`/crear/${g.id}`} className="tpl">
            <div className="tpl-img">
              <Thumb id={`type-${g.id}`} make={() => buildProject(g, defaults(g))} alt={`Vista 3D de ${g.title}`} />
              <CraftChip craft={g.craft} />
            </div>
            <div className="tpl-body">
              <h3>{g.title}</h3>
              <p>{g.description}</p>
              <div className="tpl-meta"><Level value={g.difficulty} /></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Field({ p, value, set }: { p: ParamDef; value: ParamValues[string]; set: (v: ParamValues[string]) => void }) {
  const id = `f-${p.key}`;
  if (p.type === 'number') {
    const v = Number(value);
    return (
      <div className="field">
        <label htmlFor={id}>{p.label}<span className="muted" style={{ fontWeight: 500, fontSize: '0.82rem' }}>{p.min}–{p.max} {p.unit}</span></label>
        <div className="numrow">
          <input className="ruler" type="range" min={p.min} max={p.max} step={p.step} value={v} onChange={(e) => set(Number(e.target.value))} aria-label={`${p.label}, deslizador`} />
          <div className="numbox">
            <NumberBox id={id} value={v} min={p.min} max={p.max} step={p.step} onCommit={set} />
            <span>{p.unit}</span>
          </div>
        </div>
        {p.help && <p className="help">{p.help}</p>}
      </div>
    );
  }
  if (p.type === 'boolean') {
    return (
      <div className="field">
        <label className="switch">
          <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
          <i aria-hidden />
          {p.label}
        </label>
        {p.help && <p className="help">{p.help}</p>}
      </div>
    );
  }
  if (p.type !== 'select') return null;
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${id}-l`}>
      <span className="lab" id={`${id}-l`}>{p.label}</span>
      <div className="options">
        {p.options.map((o) => (
          <label key={o.value} className="option">
            <input type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => set(o.value)} />
            <span>{o.label}{o.hint && <small>{o.hint}</small>}</span>
          </label>
        ))}
      </div>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

/** Caja numérica que deja escribir libremente y valida al salir. */
function NumberBox({ id, value, min, max, step, onCommit }: { id: string; value: number; min: number; max: number; step: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && draft.trim() !== '') onCommit(Math.min(max, Math.max(min, Math.round(n / step) * step)));
    setDraft(null);
  };
  return (
    <input
      id={id} type="text" inputMode="decimal" value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp') { e.preventDefault(); onCommit(Math.min(max, value + step)); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onCommit(Math.max(min, value - step)); }
      }}
    />
  );
}

export function Configurator() {
  const { id = '' } = useParams();
  const g = getGenerator(id);
  if (!g) return <div className="wrap empty"><h1>No conocemos ese elemento</h1><Link className="btn primary" to="/crear">Ver el configurador</Link></div>;
  return <ConfiguratorForm key={g.id} g={g} />;
}

function ConfiguratorForm({ g }: { g: Generator }) {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const [values, setValues] = useState<ParamValues>(() => fromQuery(g, q));
  const [resetKey, setResetKey] = useState(0);
  const project = useMemo(() => buildProject(g, values), [g, values]);
  const groups = useMemo(() => {
    const m = new Map<string, ParamDef[]>();
    for (const p of g.params) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [g]);
  const set = (key: string, v: ParamValues[string]) => setValues((old) => normalize(g, { ...old, [key]: v }));
  const activePreset = g.presets.find((p) => Object.entries(p.values).every(([k, v]) => values[k] === v));

  return (
    <div className="wrap">
      <div className="proj-head">
        <nav className="crumbs" aria-label="Ruta"><Link to="/crear">Configurador</Link><span>/</span><span>{g.title}</span></nav>
        <div className="row">
          <h1>{g.title} a medida</h1>
          <CraftChip craft={g.craft} />
        </div>
      </div>
      <div className="conf">
        <form onSubmit={(e) => { e.preventDefault(); nav(`/proyecto/${g.id}?${toQuery(g, values)}`); }}>
          <fieldset className="group">
            <legend>Punto de partida</legend>
            <div className="presets">
              {g.presets.map((p) => (
                <button type="button" key={p.id} className="btn small" aria-pressed={activePreset?.id === p.id} onClick={() => setValues(normalize(g, { ...defaults(g), ...p.values }))}>{p.name}</button>
              ))}
            </div>
          </fieldset>
          {groups.map(([name, params]) => {
            const vis = params.filter((p) => !p.visible || p.visible(values));
            if (!vis.length) return null;
            return (
              <fieldset className="group" key={name}>
                <legend>{name}</legend>
                {vis.map((p) => <Field key={p.key} p={p} value={values[p.key]} set={(v) => set(p.key, v)} />)}
              </fieldset>
            );
          })}
          <div className="group">
            <button className="btn primary" type="submit">Generar el paso a paso <ArrowRight size={18} aria-hidden /></button>
          </div>
        </form>
        <div className="conf-stage">
          <Viewer3D project={project} labels={false} resetKey={resetKey} label={`Vista previa 3D de ${g.title}`}>
            <div className="viewer-tools">
              <button type="button" className="btn small" onClick={() => setResetKey((k) => k + 1)}><RotateCcw size={16} aria-hidden />Centrar</button>
            </div>
          </Viewer3D>
          <div className="conf-summary">
            <dl>
              <div><dt>Medidas exteriores</dt><dd>{dimsLabel(project.dims)}</dd></div>
              <div><dt>Piezas</dt><dd>{project.parts.length}</dd></div>
              <div><dt>Pasos</dt><dd>{project.steps.length}</dd></div>
              <div><dt>Tiempo</dt><dd>{hoursLabel(project.hours).replace(' de trabajo', '')}</dd></div>
            </dl>
            <Level value={project.difficulty} />
          </div>
        </div>
      </div>
    </div>
  );
}
