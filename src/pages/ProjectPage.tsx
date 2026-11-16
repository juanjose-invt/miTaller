import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CircleCheck, Clock, Download, Expand, Eye, Lightbulb, Loader, Paintbrush, RotateCcw,
  Scissors, Shield, SlidersHorizontal, Tag, TriangleAlert, Wrench, X, Zap, Hammer,
} from 'lucide-react';
import type { Project, Step } from '../core/types';
import { buildProject, fromQuery, getGenerator, toQuery } from '../generators';
import { cutList, fmtCut, hardwareList, stockList, toolList, type CutLine } from '../core/derive';
import { Viewer3D } from '../components/Viewer3D';
import { CraftChip, Level, dimsLabel, hoursLabel } from '../components/bits';

type Tab = 'pasos' | 'piezas' | 'compra' | 'seguridad';
const KIND_ICON = { preparar: Wrench, cortar: Scissors, montar: Hammer, soldar: Zap, acabar: Paintbrush } as const;
const KIND_LABEL = { preparar: 'Preparación', cortar: 'Corte', montar: 'Montaje', soldar: 'Soldadura', acabar: 'Acabado' } as const;

export function ProjectPage() {
  const { id = '' } = useParams();
  const [q, setQ] = useSearchParams();
  const g = getGenerator(id);
  const values = useMemo(() => (g ? fromQuery(g, q) : null), [g, q]);
  const project = useMemo(() => (g && values ? buildProject(g, values) : null), [g, values]);
  if (!g || !project || !values) {
    return <div className="wrap empty"><h1>No encontramos ese proyecto</h1><Link className="btn primary" to="/plantillas">Ver plantillas</Link></div>;
  }
  const preset = g.presets.find((p) => p.id === q.get('plantilla'));
  const stepParam = Number(q.get('paso') ?? '1');
  const step = Math.min(project.steps.length - 1, Math.max(0, (Number.isFinite(stepParam) ? stepParam : 1) - 1));
  const setStep = (i: number) => {
    const next = new URLSearchParams(q);
    next.set('paso', String(i + 1));
    setQ(next, { replace: true });
  };
  return <ProjectView key={g.id} project={project} title={preset?.name ?? project.title} step={step} setStep={setStep} editHref={`/crear/${g.id}?${toQuery(g, values)}`} />;
}

function ProjectView({ project, title, step, setStep, editHref }: { project: Project; title: string; step: number; setStep: (i: number) => void; editHref: string }) {
  const [tab, setTab] = useState<Tab>('pasos');
  const [explode, setExplode] = useState(false);
  const [guides, setGuides] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const cuts = useMemo(() => cutList(project), [project]);
  const stock = useMemo(() => stockList(project), [project]);
  const hardware = useMemo(() => hardwareList(project), [project]);
  const tools = useMemo(() => toolList(project), [project]);
  const total = project.steps.length;
  const s = project.steps[step];
  const selPart = project.parts.find((p) => p.id === selected);
  const selLine = selPart ? cuts.find((c) => c.ref === selPart.ref) : undefined;
  const ruleRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    ruleRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' && step < total - 1) setStep(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const download = async () => {
    setBusy(true);
    try {
      const { downloadManual } = await import('../pdf/manual');
      await downloadManual(project, title);
      setToast('Manual descargado. Búscalo en tu carpeta de descargas.');
    } catch (e) {
      console.error(e);
      setToast('No se ha podido generar el PDF. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <div className="proj-head">
        <nav className="crumbs" aria-label="Ruta"><Link to="/plantillas">Plantillas</Link><span>/</span><span>{title}</span></nav>
        <div className="row">
          <div style={{ display: 'grid', gap: 10 }}>
            <h1>{title}</h1>
            <div className="facts">
              <CraftChip craft={project.craft} />
              <span className="chip">{dimsLabel(project.dims)}</span>
              <span className="chip"><Clock size={13} aria-hidden />{hoursLabel(project.hours)}</span>
              <span className="chip">{project.parts.length} piezas</span>
              <span className="chip"><Level value={project.difficulty} /></span>
            </div>
          </div>
          <div className="actions">
            <Link className="btn" to={editHref}><SlidersHorizontal size={18} aria-hidden />Cambiar medidas</Link>
            <button className="btn primary" onClick={download} disabled={busy}>
              {busy ? <Loader size={18} aria-hidden className="spin" /> : <Download size={18} aria-hidden />}
              {busy ? 'Generando…' : 'Manual en PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="proj">
        <div className="proj-stage">
          <Viewer3D
            project={project} step={step} explode={explode ? 0.6 : 0} ghost={guides} labels={guides} selected={selected} resetKey={resetKey}
            onSelect={setSelected} label={`Modelo 3D de ${title}, paso ${step + 1} de ${total}: ${s.title}`}
          >
            <p className="viewer-hint">Arrastra para girar · rueda o pellizco para acercar · toca una pieza para identificarla</p>
            <div className="viewer-tools">
              <button className="btn small" aria-pressed={explode} onClick={() => setExplode((v) => !v)} title="Separar las piezas"><Expand size={16} aria-hidden />Despiece</button>
              <button className="btn small" aria-pressed={guides} onClick={() => setGuides((v) => !v)} title="Etiquetas, fijaciones y silueta final"><Eye size={16} aria-hidden />Guías</button>
              <button className="btn small" onClick={() => setResetKey((k) => k + 1)} title="Volver a la vista inicial"><RotateCcw size={16} aria-hidden /><span className="sr-only">Centrar vista</span></button>
            </div>
            {selPart && selLine && (
              <div className="piece-pop" role="status">
                <span className="ref">{selPart.ref}</span>
                <div><strong>{selPart.name}</strong><small>{fmtCut(selLine)} mm · {selPart.stock} · {selLine.qty} {selLine.qty === 1 ? 'unidad' : 'unidades'}</small></div>
                <button className="btn small ghost" onClick={() => setSelected(null)} aria-label="Cerrar"><X size={16} aria-hidden /></button>
              </div>
            )}
          </Viewer3D>
          <div className="stepnav">
            <button className="btn" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label="Paso anterior"><ArrowLeft size={18} aria-hidden /></button>
            <nav className="steprule" aria-label="Pasos del montaje">
              <ol ref={ruleRef}>
                {project.steps.map((st, i) => (
                  <li key={i}>
                    <button className={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => { setStep(i); setTab('pasos'); }} title={st.title} aria-label={`Paso ${i + 1}: ${st.title}`}>{i + 1}</button>
                  </li>
                ))}
              </ol>
            </nav>
            <button className="btn dark" onClick={() => setStep(step + 1)} disabled={step === total - 1} aria-label="Paso siguiente"><ArrowRight size={18} aria-hidden /></button>
          </div>
        </div>

        <div>
          <div className="tabs" role="tablist">
            {([['pasos', 'Paso a paso', total], ['piezas', 'Piezas y corte', cuts.length], ['compra', 'Lista de la compra', stock.length + hardware.length], ['seguridad', 'Seguridad y notas', null]] as const).map(([k, label, n]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}{n !== null && <span className="count">{n}</span>}</button>
            ))}
          </div>

          {tab === 'pasos' && <StepCard key={step} project={project} step={s} index={step} total={total} cuts={cuts} selected={selected} onSelect={setSelected} onPrev={() => setStep(step - 1)} onNext={() => setStep(step + 1)} onDownload={download} busy={busy} />}

          {tab === 'piezas' && (
            <div className="stack">
              <p className="muted">Toca una fila para localizar la pieza en el modelo. Las medidas son finales, en milímetros.</p>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Ref.</th><th>Pieza</th><th className="r">Cant.</th><th>Largo × ancho × grueso</th><th>Material</th></tr></thead>
                  <tbody>
                    {cuts.map((c) => {
                      const on = !!selPart && selPart.ref === c.ref;
                      return (
                        <tr key={c.ref} className={`pick ${on ? 'sel' : ''}`} onClick={() => setSelected(on ? null : c.partIds[0])}>
                          <td><span className="ref">{c.ref}</span></td>
                          <td><strong>{c.name}</strong>{c.note && <div className="muted" style={{ fontSize: '0.85rem' }}>{c.note}</div>}</td>
                          <td className="r dim">{c.qty}×</td>
                          <td className="dim">{fmtCut(c)}</td>
                          <td>{c.stock}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="note">Para ver una pieza que todavía no se ha montado, activa «Despiece» o avanza hasta su paso.</p>
            </div>
          )}

          {tab === 'compra' && (
            <div className="stack">
              <section className="stack">
                <h2 style={{ fontSize: '1.3rem' }}>Material</h2>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Material</th><th>Cantidad</th><th>Detalle</th></tr></thead>
                    <tbody>{stock.map((l) => <tr key={l.stock}><td><strong>{l.stock}</strong></td><td className="dim">{l.buy}</td><td className="muted">{l.detail}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="note">Las barras se calculan con largos habituales (2,4 m en listón, 6 m en tubo de acero) y contando la pérdida de cada corte. Comprueba el largo que vende tu almacén y añade un margen para errores.</p>
              </section>
              <section className="stack">
                <h2 style={{ fontSize: '1.3rem' }}>Tornillería y consumibles</h2>
                <Checklist id={`${project.id}-hw`} items={hardware.map((h) => `${h.qty} ${h.unit ?? 'ud'} · ${h.item}`)} />
              </section>
              <section className="stack">
                <h2 style={{ fontSize: '1.3rem' }}>Herramientas</h2>
                <Checklist id={`${project.id}-tools`} items={tools} />
              </section>
            </div>
          )}

          {tab === 'seguridad' && (
            <div className="stack">
              <div className="block warn"><h3><Shield size={18} aria-hidden />Antes de empezar</h3><ul className="dots">{project.safety.map((t) => <li key={t}>{t}</li>)}</ul></div>
              {!!project.notes?.length && <div className="block"><h3><Lightbulb size={18} aria-hidden />Notas de diseño</h3><ul className="dots">{project.notes.map((t) => <li key={t}>{t}</li>)}</ul></div>}
              <div className="block"><h3><Tag size={18} aria-hidden />Configuración</h3>
                <table className="data" style={{ minWidth: 0 }}><tbody>{project.spec.map((r) => <tr key={r.label}><td className="muted">{r.label}</td><td><strong>{r.value}</strong></td></tr>)}</tbody></table>
              </div>
              {!!project.sources?.length && <div className="block"><h3>Fuentes</h3><ul className="dots">{project.sources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.label}</a></li>)}</ul></div>}
              <p className="note">Más técnica y seguridad en <Link to={`/consejos/${project.craft}`}>los consejos de {project.craft === 'soldadura' ? 'soldadura' : 'carpintería'}</Link>.</p>
            </div>
          )}
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function StepCard({ project, step, index, total, cuts, selected, onSelect, onPrev, onNext, onDownload, busy }: {
  project: Project; step: Step; index: number; total: number; cuts: CutLine[]; selected: string | null;
  onSelect: (id: string | null) => void; onPrev: () => void; onNext: () => void; onDownload: () => void; busy: boolean;
}) {
  const kind = step.kind ?? 'montar';
  const Icon = KIND_ICON[kind];
  // piezas de este paso agrupadas por referencia: «4× A Pata»
  const groups = useMemo(() => {
    const m = new Map<string, { line: CutLine; ids: string[] }>();
    for (const id of step.parts) {
      const part = project.parts.find((p) => p.id === id)!;
      const line = cuts.find((c) => c.ref === part.ref)!;
      const g = m.get(part.ref) ?? { line, ids: [] };
      g.ids.push(id);
      m.set(part.ref, g);
    }
    return [...m.values()];
  }, [step, project, cuts]);
  return (
    <article className="step-card">
      <div className="step-kicker"><span className="num">Paso {index + 1} de {total}</span><span className="chip"><Icon size={13} aria-hidden />{KIND_LABEL[kind]}</span></div>
      <h2>{step.title}</h2>
      <p className="summary">{step.summary}</p>

      {groups.length > 0 && (
        <div className="pieces" aria-label="Piezas de este paso">
          {groups.map(({ line, ids }) => {
            const on = !!selected && ids.includes(selected);
            return (
              <button key={line.ref} className="piece-btn" aria-pressed={on} onClick={() => onSelect(on ? null : ids[0])}>
                <span className="ref">{line.ref}</span>
                <span><span className="x">{ids.length}×</span> {line.name} <span className="muted">· {fmtCut(line)}</span></span>
              </button>
            );
          })}
        </div>
      )}

      <ol className="todo">{step.detail.map((d, i) => <li key={i}><span>{d}</span></li>)}</ol>

      {step.technique && (
        <div className="block tech">
          <h3><Wrench size={18} aria-hidden />Técnica: {step.technique.name}</h3>
          <p>{step.technique.why}</p>
          <ul className="dots">{step.technique.how.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
      )}

      <div className="two">
        {!!step.hardware?.length && (
          <div className="block"><h3>Fijaciones y consumibles</h3>
            <ul className="hwlist">{step.hardware.map((h) => <li key={h.item}><span className="q">{h.qty}{h.unit ? '' : '×'}</span><span>{h.unit ? `${h.unit} · ` : ''}{h.item}</span></li>)}</ul>
          </div>
        )}
        {!!step.tools?.length && (
          <div className="block"><h3>Herramientas</h3><ul className="dots">{step.tools.map((t) => <li key={t}>{t}</li>)}</ul></div>
        )}
      </div>

      {step.check && <div className="block check"><h3><CircleCheck size={18} aria-hidden />Comprueba antes de seguir</h3><p>{step.check}</p></div>}
      {step.warning && <div className="block warn"><h3><TriangleAlert size={18} aria-hidden />Atención</h3><p>{step.warning}</p></div>}
      {step.tip && <div className="block tip"><h3><Lightbulb size={18} aria-hidden />Consejo de taller</h3><p>{step.tip}</p></div>}

      <div className="step-foot">
        <button className="btn" onClick={onPrev} disabled={index === 0}><ArrowLeft size={18} aria-hidden />Anterior</button>
        {index < total - 1
          ? <button className="btn dark" onClick={onNext}>Siguiente paso<ArrowRight size={18} aria-hidden /></button>
          : <button className="btn primary" onClick={onDownload} disabled={busy}><Download size={18} aria-hidden />{busy ? 'Generando…' : 'Descargar el manual en PDF'}</button>}
      </div>
    </article>
  );
}

/** Lista para ir marcando lo que ya tienes; se recuerda en este navegador. */
function Checklist({ id, items }: { id: string; items: string[] }) {
  const key = `mitaller:${id}`;
  const [done, setDone] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  });
  const toggle = (item: string) => {
    const next = done.includes(item) ? done.filter((d) => d !== item) : [...done, item];
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* almacenamiento no disponible */ }
  };
  return (
    <div className="block">
      <div className="checklist">
        {items.map((item) => (
          <label key={item}><input type="checkbox" checked={done.includes(item)} onChange={() => toggle(item)} /><span>{item}</span></label>
        ))}
      </div>
      <p className="note" style={{ marginTop: 4 }}>Marca lo que ya tienes: se guarda en este dispositivo.</p>
    </div>
  );
}
