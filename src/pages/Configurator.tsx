import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bookmark, Check, Link2, List, ListOrdered, PencilRuler, Plus, Redo2, RotateCcw, Ruler, TriangleAlert, Undo2, User, Wrench, X,
} from 'lucide-react';
import type { Axis, Generator, NumberParam, ParamDef, ParamValues, PatternParam, Project, SelectParam } from '../core/types';
import { GENERATORS, getGenerator } from '../generators';
import { allParams, buildProject, defaults, dragKeys, fromQuery, normalize, toQuery } from '../core/params';
import { STAINS } from '../core/materials';
import { cost, euros, kilos, missingTools, signature, warnings, weight } from '../core/insights';
import { KEYS, useStored, type SavedDesign } from '../core/store';
import { Viewer3D } from '../components/Viewer3D';
import { EDITORS } from '../components/editors';
import { CraftChip, Level, Thumb, dimsLabel, hoursLabel } from '../components/bits';

export function ConfiguratorIndex() {
  const groups = [
    { craft: 'carpinteria', title: 'Carpintería' },
    { craft: 'soldadura', title: 'Soldadura' },
  ] as const;
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Diseña a medida</h1>
        <p>Elige qué quieres construir y dale forma: estira el modelo con el ratón o el dedo, cambia la distribución, los detalles, las uniones y el acabado. La lista de corte, la compra y el paso a paso se recalculan solos.</p>
      </div>
      <Link to="/libre" className="free-tile">
        <PencilRuler size={30} aria-hidden />
        <div>
          <h2>Modo libre</h2>
          <p>Empieza con el banco vacío: coloca listones, tableros y tubos a mano, con imanes, y la web saca la lista de corte y el manual.</p>
        </div>
        <span className="go">Abrir el modo libre <ArrowRight size={16} aria-hidden /></span>
      </Link>
      {groups.map(({ craft, title }) => (
        <section key={craft} className="type-section" aria-labelledby={`t-${craft}`}>
          <h2 id={`t-${craft}`}>{title}</h2>
          <div className="types">
            {GENERATORS.filter((g) => g.craft === craft).map((g) => (
              <Link key={g.id} to={`/crear/${g.id}`} className="tpl">
                <div className="tpl-img">
                  <Thumb id={`type-${g.id}`} make={() => buildProject(g, { ...defaults(g), ...(g.presets[0]?.values ?? {}) })} alt={`Vista 3D de ${g.title}`} />
                </div>
                <div className="tpl-body">
                  <h3>{g.title}</h3>
                  <p>{g.description}</p>
                  <div className="tpl-meta"><Level value={g.difficulty} /></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- campos ----------

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

function NumberField({ p, value, set, dragAxis }: { p: NumberParam; value: number; set: (v: number) => void; dragAxis?: Axis }) {
  const id = `f-${p.key}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{p.label}{dragAxis && <span className="drag-tag" title="También puedes arrastrar el tirador rojo del modelo">arrastrable</span>}</span>
        <span className="muted range">{p.min}–{p.max} {p.unit}</span>
      </label>
      <div className="numrow">
        <input className="ruler" type="range" min={p.min} max={p.max} step={p.step} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={`${p.label}, deslizador`} />
        <div className="numbox">
          <NumberBox id={id} value={value} min={p.min} max={p.max} step={p.step} onCommit={set} />
          <span>{p.unit}</span>
        </div>
      </div>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

/** Opciones de selección. Si cambian la geometría se enseñan con miniatura 3D; si no, como texto. */
function SelectField({ g, p, values, set }: { g: Generator; p: SelectParam; values: ParamValues; set: (v: string) => void }) {
  const id = `f-${p.key}`;
  const value = values[p.key];
  const built = useMemo(() => {
    if (p.key === 'tinte') return null;
    try {
      const list = p.options.map((o) => {
        const v = normalize(g, { ...values, [p.key]: o.value });
        const project = buildProject(g, v);
        return { o, project, key: `${g.id}?${toQuery(g, v)}`, sig: signature(project) };
      });
      return new Set(list.map((x) => x.sig)).size > 1 ? list : null;
    } catch {
      return null;
    }
  }, [g, p, values]);

  if (p.key === 'tinte') {
    return (
      <div className="field" role="radiogroup" aria-labelledby={`${id}-l`}>
        <span className="lab" id={`${id}-l`}>{p.label}<span className="muted range">{p.options.find((o) => o.value === value)?.label}</span></span>
        <div className="swatches">
          {STAINS.map((s) => (
            <label key={s.value} className="swatch" title={s.label}>
              <input type="radio" name={id} value={s.value} checked={value === s.value} onChange={() => set(s.value)} />
              <span style={{ background: s.hex ?? '#ecd3a6' }}><span className="sr-only">{s.label}</span></span>
            </label>
          ))}
        </div>
        {p.help && <p className="help">{p.help}</p>}
      </div>
    );
  }
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${id}-l`}>
      <span className="lab" id={`${id}-l`}>{p.label}</span>
      <div className={built ? 'options visual' : 'options'}>
        {p.options.map((o, i) => (
          <label key={o.value} className="option">
            <input type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => set(o.value)} />
            <span>
              {built && <span className="opt-img"><Thumb id={built[i].key} make={() => built[i].project} alt="" size={[280, 210]} /></span>}
              <b>{o.label}</b>
              {o.hint && <small>{o.hint}</small>}
            </span>
          </label>
        ))}
      </div>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

/** Patrón repetible de motivos (forja): se construye añadiendo y quitando fichas. */
function PatternField({ p, value, set }: { p: PatternParam; value: string; set: (v: string) => void }) {
  const codes = value ? value.split(',') : [];
  const label = (c: string) => p.options.find((o) => o.value === c)?.label ?? c;
  const full = codes.length >= p.max;
  return (
    <div className="field">
      <span className="lab">{p.label}<span className="muted range">{codes.length ? `${codes.length} de ${p.max}` : 'sin decoración'}</span></span>
      <ol className="pattern" aria-label={`Secuencia de ${p.label}`}>
        {codes.map((c, i) => (
          <li key={`${c}-${i}`}>
            <span className="num">{i + 1}</span>{label(c)}
            <button type="button" onClick={() => set(codes.filter((_, k) => k !== i).join(','))} aria-label={`Quitar ${label(c)} (posición ${i + 1})`}><X size={14} aria-hidden /></button>
          </li>
        ))}
        {!codes.length && <li className="empty-pat">Añade motivos: se repiten en orden a lo largo del paño.</li>}
      </ol>
      <div className="pattern-add" role="group" aria-label="Añadir motivo">
        {p.options.map((o) => (
          <button type="button" key={o.value} className="btn small" disabled={full} onClick={() => set([...codes, o.value].join(','))} title={o.hint}>
            <Plus size={14} aria-hidden />{o.label}
          </button>
        ))}
        {codes.length > 0 && <button type="button" className="btn small ghost" onClick={() => set('')}>Vaciar</button>}
      </div>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

function Field({ g, p, values, set, dragAxis }: { g: Generator; p: ParamDef; values: ParamValues; set: (v: ParamValues[string]) => void; dragAxis?: Axis }) {
  if (p.type === 'number') return <NumberField p={p} value={Number(values[p.key])} set={set} dragAxis={dragAxis} />;
  if (p.type === 'select') return <SelectField g={g} p={p} values={values} set={set} />;
  if (p.type === 'pattern') return <PatternField p={p} value={String(values[p.key] ?? '')} set={set} />;
  if (p.type === 'custom') {
    const Editor = EDITORS[p.editor];
    return (
      <div className="field">
        <span className="lab">{p.label}</span>
        {Editor ? <Editor param={p} value={String(values[p.key])} onChange={set} values={values} /> : <p className="help">Este editor no está disponible.</p>}
        {p.help && <p className="help">{p.help}</p>}
      </div>
    );
  }
  return (
    <div className="field">
      <label className="switch">
        <input type="checkbox" checked={values[p.key] === true} onChange={(e) => set(e.target.checked)} />
        <i aria-hidden />
        {p.label}
      </label>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

// ---------- configurador ----------

export function Configurator() {
  const { id = '' } = useParams();
  const g = getGenerator(id);
  if (!g) return <div className="wrap empty"><h1>No conocemos ese elemento</h1><Link className="btn primary" to="/crear">Ver el configurador</Link></div>;
  return <ConfiguratorForm key={g.id} g={g} />;
}

function ConfiguratorForm({ g }: { g: Generator }) {
  const [q, setQ] = useSearchParams();
  const nav = useNavigate();
  const [values, setValues] = useState<ParamValues>(() => fromQuery(g, q));
  const [resetKey, setResetKey] = useState(0);
  const [showDims, setShowDims] = useState(true);
  const [figure, setFigure] = useState(false);
  const [mode, setMode] = useStored<'guiado' | 'todo'>('conf-vista', 'guiado');
  const [stage, setStage] = useState(0);
  const [toast, setToast] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  const [prices] = useStored<Record<string, number>>(KEYS.prices, {});
  const [owned] = useStored<string[]>(KEYS.tools, []);
  const [, setDesigns] = useStored<SavedDesign[]>(KEYS.designs, []);

  // historial para deshacer y rehacer
  const hist = useRef<{ stack: ParamValues[]; i: number }>({ stack: [values], i: 0 });
  const [, bump] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (v: ParamValues) => {
    const h = hist.current;
    if (JSON.stringify(h.stack[h.i]) === JSON.stringify(v)) return;
    h.stack = [...h.stack.slice(0, h.i + 1), v].slice(-80);
    h.i = h.stack.length - 1;
    setQ(new URLSearchParams(toQuery(g, v)), { replace: true });
    bump((n) => n + 1);
  };
  const apply = (v: ParamValues, now = false) => {
    const n = normalize(g, v);
    setValues(n);
    if (timer.current) clearTimeout(timer.current);
    if (now) commit(n);
    else timer.current = setTimeout(() => commit(n), 450);
  };
  const set = (key: string, v: ParamValues[string]) => apply({ ...values, [key]: v });
  const step = (d: -1 | 1) => {
    const h = hist.current;
    const i = h.i + d;
    if (i < 0 || i >= h.stack.length) return;
    h.i = i;
    setValues(h.stack[i]);
    setQ(new URLSearchParams(toQuery(g, h.stack[i])), { replace: true });
    bump((n) => n + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input[type="text"], textarea')) return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); step(e.shiftKey ? 1 : -1); }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); step(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const project: Project = useMemo(() => buildProject(g, values), [g, values]);
  const params = useMemo(() => allParams(g), [g]);
  const groups = useMemo(() => {
    const m = new Map<string, ParamDef[]>();
    for (const p of params) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()].map(([name, list]) => ({ name, list }));
  }, [params]);
  const visible = groups.map((gr) => ({ ...gr, list: gr.list.filter((p) => !p.visible || p.visible(values)) })).filter((gr) => gr.list.length);
  const stages = ['Punto de partida', ...visible.map((v) => v.name)];
  const cur = Math.min(stage, stages.length - 1);
  const activePreset = g.presets.find((p) => Object.entries(p.values).every(([k, v]) => values[k] === v));

  // tiradores: arrastrar estira el parámetro de ese eje
  const keys = useMemo(() => dragKeys(g, values), [g, values]);
  const axisOf = (key: string) => (Object.entries(keys).find(([, k]) => k === key)?.[0] as Axis | undefined);
  const dragBase = useRef(0);
  const onHandleDrag = (axis: Axis, delta: number, phase: 'start' | 'move' | 'end') => {
    const key = keys[axis];
    const p = params.find((x) => x.key === key);
    if (!key || !p || p.type !== 'number') return;
    if (phase === 'start') {
      dragBase.current = Number(values[key]);
      return;
    }
    const v = Math.min(p.max, Math.max(p.min, Math.round((dragBase.current + delta) / p.step) * p.step));
    if (v !== values[key] || phase === 'end') apply({ ...values, [key]: v }, phase === 'end');
  };

  const kg = weight(project);
  const money = cost(project, prices);
  const warns = warnings(project);
  const missing = missingTools(project, owned);
  const query = toQuery(g, values);

  const saveDesign = (name: string) => {
    setDesigns((old) => [{ id: `${Date.now()}`, name: name.trim() || g.title, gen: g.id, query, date: new Date().toISOString() }, ...old]);
    setNaming(null);
    setToast('Diseño guardado en Mi taller.');
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/crear/${g.id}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Enlace copiado: quien lo abra verá este mismo diseño.');
    } catch {
      setToast('No se pudo copiar. Copia la dirección de la barra del navegador.');
    }
  };

  const renderGroup = (gr: { name: string; list: ParamDef[] }) => (
    <fieldset className="group" key={gr.name}>
      <legend>{gr.name}</legend>
      {gr.list.map((p) => <Field key={p.key} g={g} p={p} values={values} set={(v) => set(p.key, v)} dragAxis={axisOf(p.key)} />)}
    </fieldset>
  );
  const presetsBlock = (
    <fieldset className="group" key="inicio">
      <legend>Punto de partida</legend>
      <p className="help">Parte de una plantilla y cámbiala a tu gusto.</p>
      <div className="options visual presets-visual">
        {g.presets.map((p) => (
          <label key={p.id} className="option">
            <input type="radio" name="preset" checked={activePreset?.id === p.id} onChange={() => apply({ ...defaults(g), ...p.values }, true)} />
            <span>
              <span className="opt-img"><Thumb id={`${g.id}-${p.id}`} make={() => buildProject(g, { ...defaults(g), ...p.values })} alt="" /></span>
              <b>{p.name}</b>
              <small>{p.blurb}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="wrap">
      <div className="proj-head">
        <nav className="crumbs" aria-label="Ruta"><Link to="/crear">Diseñar</Link><span>/</span><span>{g.title}</span></nav>
        <div className="row">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1>{g.title} a medida</h1>
            <CraftChip craft={g.craft} />
          </div>
          <div className="actions">
            <button className="btn small" onClick={() => step(-1)} disabled={hist.current.i === 0} title="Deshacer (Ctrl+Z)"><Undo2 size={16} aria-hidden /><span className="lbl">Deshacer</span></button>
            <button className="btn small" onClick={() => step(1)} disabled={hist.current.i >= hist.current.stack.length - 1} title="Rehacer (Ctrl+Y)"><Redo2 size={16} aria-hidden /><span className="lbl">Rehacer</span></button>
            <button className="btn small" onClick={() => setNaming(`${activePreset?.name ?? g.title} · ${dimsLabel(project.dims)}`)}><Bookmark size={16} aria-hidden /><span className="lbl">Guardar</span></button>
            <button className="btn small" onClick={share}><Link2 size={16} aria-hidden /><span className="lbl">Compartir</span></button>
          </div>
        </div>
        {naming !== null && (
          <form className="save-bar" onSubmit={(e) => { e.preventDefault(); saveDesign(naming); }}>
            <label htmlFor="save-name">Nombre del diseño</label>
            <input id="save-name" autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} maxLength={60} />
            <button className="btn small dark" type="submit"><Check size={16} aria-hidden />Guardar</button>
            <button className="btn small ghost" type="button" onClick={() => setNaming(null)}>Cancelar</button>
          </form>
        )}
      </div>

      <div className="conf2">
        <div className="conf-stage">
          <Viewer3D
            project={project} labels={false} dims={showDims} figure={figure} keepView resetKey={resetKey}
            handles={Object.keys(keys) as Axis[]} onHandleDrag={onHandleDrag} label={`Vista previa 3D de ${g.title}`}
          >
            {Object.keys(keys).length > 0 && <p className="viewer-hint">Arrastra los tiradores rojos para estirar el modelo · gira arrastrando el fondo</p>}
            <div className="viewer-tools">
              <button type="button" className="btn small" aria-pressed={showDims} onClick={() => setShowDims((v) => !v)} title="Cotas en milímetros"><Ruler size={16} aria-hidden />Cotas</button>
              <button type="button" className="btn small" aria-pressed={figure} onClick={() => setFigure((v) => !v)} title="Persona de 1,70 m para comparar"><User size={16} aria-hidden />Escala</button>
              <button type="button" className="btn small" onClick={() => setResetKey((k) => k + 1)} title="Volver a la vista inicial"><RotateCcw size={16} aria-hidden /><span className="sr-only">Centrar</span></button>
            </div>
          </Viewer3D>
          <dl className="live">
            <div><dt>Medidas exteriores</dt><dd>{dimsLabel(project.dims)}</dd></div>
            <div><dt>Piezas</dt><dd>{project.parts.length}</dd></div>
            <div><dt>Tiempo</dt><dd>{hoursLabel(project.hours).replace(' de trabajo', '')}</dd></div>
            <div><dt>Peso aprox.</dt><dd>{kg > 0 ? kilos(kg) : '—'}</dd></div>
            <div>
              <dt>Coste del material</dt>
              <dd>{money.priced ? euros(money.total) : '—'}</dd>
              <small>{money.priced === 0 ? <Link to="/mi-taller/precios">Añade tus precios</Link> : money.priced < money.lines ? `${money.priced} de ${money.lines} artículos con precio` : 'con tus precios'}</small>
            </div>
            <div><dt>Nivel</dt><dd className="lvl"><Level value={project.difficulty} /></dd></div>
          </dl>
          {(warns.length > 0 || missing.length > 0) && (
            <div className="live-notes">
              {warns.map((w) => <p key={w} className="warn-line"><TriangleAlert size={16} aria-hidden />{w}</p>)}
              {missing.length > 0 && owned.length > 0 && (
                <p className="tool-line"><Wrench size={16} aria-hidden />Te faltan {missing.length} herramientas de tu lista: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? '…' : ''}</p>
              )}
            </div>
          )}
        </div>

        <form className="conf-panel" onSubmit={(e) => { e.preventDefault(); nav(`/proyecto/${g.id}?${query}`); }}>
          <div className="conf-mode">
            <div className="segmented" role="group" aria-label="Forma de configurar">
              <button type="button" aria-pressed={mode === 'guiado'} onClick={() => setMode('guiado')}><ListOrdered size={16} aria-hidden /> Paso a paso</button>
              <button type="button" aria-pressed={mode === 'todo'} onClick={() => setMode('todo')}><List size={16} aria-hidden /> Todo a la vista</button>
            </div>
          </div>
          {mode === 'guiado' ? (
            <>
              <ol className="wizard" aria-label="Apartados del diseño">
                {stages.map((s, i) => (
                  <li key={s}>
                    <button type="button" className={i < cur ? 'done' : ''} aria-current={i === cur ? 'step' : undefined} onClick={() => setStage(i)}>
                      <span className="n">{i + 1}</span>{s}
                    </button>
                  </li>
                ))}
              </ol>
              {cur === 0 ? presetsBlock : renderGroup(visible[cur - 1])}
              <div className="wizard-nav">
                <button type="button" className="btn" disabled={cur === 0} onClick={() => setStage(cur - 1)}><ArrowLeft size={18} aria-hidden />Anterior</button>
                {cur < stages.length - 1
                  ? <button type="button" className="btn dark" onClick={() => setStage(cur + 1)}>{stages[cur + 1]}<ArrowRight size={18} aria-hidden /></button>
                  : <button className="btn primary" type="submit">Generar el paso a paso<ArrowRight size={18} aria-hidden /></button>}
              </div>
            </>
          ) : (
            <>
              {presetsBlock}
              {visible.map(renderGroup)}
            </>
          )}
          <div className="conf-cta">
            <button className="btn primary" type="submit">Generar el paso a paso <ArrowRight size={18} aria-hidden /></button>
          </div>
        </form>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
