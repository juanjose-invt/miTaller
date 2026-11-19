import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Copy, FilePlus, FolderOpen, Layers, Link as LinkIcon, Magnet, MoveHorizontal, MoveVertical, Plus, Redo2, RotateCcw, RotateCw,
  Ruler, Save, Trash2, TriangleAlert, Undo2, X,
} from 'lucide-react';
import type { Axis, Craft, Project, Vec3 } from '../core/types';
import {
  EXAMPLES, JOINT_LABEL, KIND_LABEL, KIND_MATERIALS, PRESETS, allowedJoints, asPreview, craftOf, designBounds, emptyDesign,
  findContacts, findOverlaps, newPart, nextId, normalizePart, parseDesign, partLabel, placeNew, refsOf, reorient,
  serializeDesign, sizeOf, snapDetailed, toProject, turnSection,
  type Contact, type FreeDesign, type FreeKind, type FreePart, type JointKind, type SnapHit,
} from '../core/free';
import { cutList, fmtCut, stockList } from '../core/derive';
import { MATERIALS } from '../core/materials';
import { KEYS, load, save, useStored, type SavedDesign } from '../core/store';
import { Viewer3D } from '../components/Viewer3D';
import { CRAFT_LABEL } from '../components/bits';
import '../styles/free.css';

/** Clave del autoguardado del diseño en curso (texto serializado). */
const AUTOSAVE = 'libre:actual';
const HISTORY = 120;

type Tab = 'anadir' | 'pieza' | 'uniones' | 'lista' | 'diseno';
const TABS: { id: Tab; label: string }[] = [
  { id: 'anadir', label: 'Añadir' },
  { id: 'pieza', label: 'Pieza' },
  { id: 'uniones', label: 'Uniones' },
  { id: 'lista', label: 'Lista' },
  { id: 'diseno', label: 'Diseño' },
];

interface History { past: FreeDesign[]; now: FreeDesign; future: FreeDesign[] }

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const AX_LABEL: Record<Axis, string> = { x: 'X', y: 'Y', z: 'Z' };
const ORIENT_LINEAL: Record<Axis, string> = { x: 'A lo ancho', y: 'Vertical', z: 'A lo fondo' };
const ORIENT_PANEL: Record<Axis, string> = { y: 'Tumbado', x: 'De canto, a lo fondo', z: 'De canto, a lo ancho' };
const MAT_LABEL = (m: FreePart['material']) => (m === 'pino' ? 'Pino' : m === 'haya' ? 'Haya' : MATERIALS[m].label);
const SNAP_LABEL: Record<SnapHit['kind'], string> = { cara: 'cara con cara', ras: 'a ras', centro: 'centrado', suelo: 'en el suelo', rejilla: 'rejilla' };

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function initialDesign(fromUrl: string | null): FreeDesign {
  return parseDesign(fromUrl) ?? parseDesign(load<string>(AUTOSAVE, '')) ?? emptyDesign();
}

/** Página del modo libre (ruta `/libre`, admite `?d=<diseño serializado>`). */
export function FreeMode() {
  const [q, setQ] = useSearchParams();
  const nav = useNavigate();
  const [hist, setHist] = useState<History>(() => ({ past: [], now: initialDesign(q.get('d')), future: [] }));
  const design = hist.now;
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<{ id: string; at: Vec3 } | null>(null);
  const [vertical, setVertical] = useState(false);
  const [magnet, setMagnet] = useState(true);
  const [grid, setGrid] = useState<5 | 10>(10);
  const [showDims, setShowDims] = useState(true);
  const [tab, setTab] = useState<Tab>(() => (initialDesign(q.get('d')).parts.length ? 'lista' : 'anadir'));
  const [resetKey, setResetKey] = useState(0);
  const [snapNote, setSnapNote] = useState('');
  const [toast, setToast] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useStored<SavedDesign[]>(KEYS.designs, []);
  const toastTimer = useRef(0);

  // el diseño de la URL pasa a ser el diseño en curso y la URL se limpia (si no, al recargar se perderían los cambios)
  useEffect(() => {
    if (q.get('d')) setQ({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serialized = useMemo(() => serializeDesign(design), [design]);
  useEffect(() => {
    const t = window.setTimeout(() => save(AUTOSAVE, serialized), 250);
    return () => window.clearTimeout(t);
  }, [serialized]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const commit = useCallback((fn: (d: FreeDesign) => FreeDesign) => {
    setHist((h) => {
      const next = fn(h.now);
      if (next === h.now) return h;
      return { past: [...h.past, h.now].slice(-HISTORY), now: next, future: [] };
    });
  }, []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h)), []);

  const updatePart = useCallback((id: string, fn: (p: FreePart) => FreePart) => {
    commit((d) => ({ ...d, parts: d.parts.map((p) => (p.id === id ? normalizePart(fn(p)) : p)) }));
  }, [commit]);

  const addPart = (draft: FreePart) => {
    const id = nextId(design);
    const p = normalizePart({ ...draft, id });
    p.at = placeNew(design, p);
    commit((d) => ({ ...d, parts: [...d.parts, p] }));
    setSelected(id);
    setTab('pieza');
    say(`Añadido: ${p.name}. Arrástralo en el modelo para colocarlo.`);
  };
  const duplicate = (id: string) => {
    const src = design.parts.find((p) => p.id === id);
    if (!src) return;
    const nid = nextId(design);
    const s = sizeOf(src);
    const copy: FreePart = { ...src, id: nid, at: [src.at[0] + s[0] + 50, src.at[1], src.at[2]] };
    commit((d) => ({ ...d, parts: [...d.parts, normalizePart(copy)] }));
    setSelected(nid);
    say(`Duplicado: ${src.name}`);
  };
  const remove = (id: string) => {
    const src = design.parts.find((p) => p.id === id);
    commit((d) => ({
      ...d,
      parts: d.parts.filter((p) => p.id !== id),
      joints: Object.fromEntries(Object.entries(d.joints ?? {}).filter(([k]) => !k.split('+').includes(id))),
    }));
    setSelected(null);
    if (src) say(`Eliminado: ${src.name}. Ctrl+Z lo recupera.`);
  };
  const nudge = (id: string, axis: Axis, delta: number) =>
    updatePart(id, (p) => {
      const at: Vec3 = [...p.at];
      at[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] += delta;
      if (at[1] < 0) at[1] = 0;
      return { ...p, at };
    });
  const setJoint = (key: string, j: JointKind | '') =>
    commit((d) => {
      const joints = { ...(d.joints ?? {}) };
      if (j) joints[key] = j;
      else delete joints[key];
      return { ...d, joints };
    });
  const replaceDesign = (d: FreeDesign, msg: string, id: string | null = null) => {
    commit(() => d);
    setSelected(null);
    setSavedId(id);
    setResetKey((k) => k + 1);
    setTab(d.parts.length ? 'lista' : 'anadir');
    say(msg);
  };

  // ---------- derivados ----------
  const full = useMemo<Project | null>(() => {
    if (!design.parts.length) return null;
    try {
      return toProject(design);
    } catch {
      return null;
    }
  }, [design]);
  const preview = useMemo(() => (full ? asPreview(full) : null), [full]);
  const refs = useMemo(() => refsOf(design), [design]);
  const contacts = useMemo(() => findContacts(design), [design]);
  const overlaps = useMemo(() => findOverlaps(design, live ?? undefined), [design, live]);
  const bounds = useMemo(() => designBounds(design), [design]);
  const sel = design.parts.find((p) => p.id === selected) ?? null;
  const byId = useMemo(() => new Map(design.parts.map((p) => [p.id, p])), [design]);
  const refName = (id: string) => `${refs.get(id) ?? '?'} · ${byId.get(id)?.name ?? ''}`;

  // ---------- visor: arrastre e imanes ----------
  const snapAxes: Axis[] = vertical ? ['y'] : ['x', 'z'];
  const onSnap = (id: string, pos: Vec3): Vec3 => {
    const p = byId.get(id);
    if (!p) return pos;
    const s = sizeOf(p);
    const at: Vec3 = [pos[0] - s[0] / 2, pos[1] - s[1] / 2, pos[2] - s[2] / 2];
    let out: Vec3;
    if (magnet) {
      const r = snapDetailed(design, id, at, { grid, axes: snapAxes });
      out = r.at;
      const notes = r.hits.filter((h) => h.kind !== 'rejilla').map((h) => `${SNAP_LABEL[h.kind]}${h.with ? ` (${refs.get(h.with)})` : ''} en ${AX_LABEL[h.axis]}`);
      setSnapNote(notes.length ? `Imán: ${notes.join(' · ')}` : `Rejilla de ${grid} mm`);
    } else {
      out = at.map((v) => Math.round(v)) as Vec3;
      if (out[1] < 0) out[1] = 0;
      setSnapNote('Imán apagado');
    }
    return [out[0] + s[0] / 2, out[1] + s[1] / 2, out[2] + s[2] / 2];
  };
  const onPartDrag = (id: string, pos: Vec3, phase: 'start' | 'move' | 'end') => {
    const p = byId.get(id);
    if (!p) return;
    const s = sizeOf(p);
    const at: Vec3 = [pos[0] - s[0] / 2, pos[1] - s[1] / 2, pos[2] - s[2] / 2].map((v) => Math.round(v * 10) / 10) as Vec3;
    if (phase === 'end') {
      setLive(null);
      setSnapNote('');
      if (at.some((v, i) => Math.abs(v - p.at[i]) > 0.05)) updatePart(id, (x) => ({ ...x, at }));
    } else {
      setLive({ id, at });
      setSelected(id);
    }
  };
  const onSelect = (id: string | null) => {
    setSelected(id);
    if (id) setTab('pieza');
  };

  // ---------- teclado ----------
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (!sel) return;
    if (mod && k === 'd') { e.preventDefault(); duplicate(sel.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel.id); return; }
    if (e.key === 'Escape') { setSelected(null); return; }
    const step = e.shiftKey ? 1 : 10;
    const moves: Record<string, [Axis, number]> = {
      ArrowLeft: ['x', -step], ArrowRight: ['x', step],
      ArrowUp: vertical ? ['y', step] : ['z', -step], ArrowDown: vertical ? ['y', -step] : ['z', step],
      PageUp: ['y', step], PageDown: ['y', -step],
    };
    const m = moves[e.key];
    if (m) { e.preventDefault(); nudge(sel.id, m[0], m[1]); }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // ---------- guardar, compartir, manual ----------
  const mine = saved.filter((s) => s.gen === 'libre');
  const doSave = () => {
    const name = design.name.trim() || 'Diseño libre';
    const date = new Date().toISOString();
    if (savedId && saved.some((s) => s.id === savedId)) {
      setSaved((old) => old.map((s) => (s.id === savedId ? { ...s, name, query: serialized, date } : s)));
    } else {
      const id = `libre-${Date.now().toString(36)}`;
      setSaved((old) => [{ id, name, gen: 'libre', query: serialized, date }, ...old]);
      setSavedId(id);
    }
    say(`Guardado en Mis diseños: ${name}`);
  };
  const shareUrl = `${location.origin}${location.pathname}#/libre?d=${serialized}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      say('Enlace copiado: quien lo abra verá este diseño.');
    } catch {
      say('No se ha podido copiar: selecciona el enlace y cópialo a mano.');
    }
  };
  const openManual = () => nav(`/proyecto/libre?d=${serialized}`);

  const dimsText = bounds ? `${fmt(bounds.size[0])} × ${fmt(bounds.size[2])} × ${fmt(bounds.size[1])} mm` : '—';
  const craft = craftOf(design);

  return (
    <div className="wrap free-page">
      <div className="free-head">
        <div className="free-title">
          <nav className="crumbs" aria-label="Ruta"><Link to="/">Inicio</Link><span>/</span><span>Modo libre</span></nav>
          <h1>{design.name.trim() || 'Modo libre'}</h1>
          <p className="muted">Coloca piezas a mano y la web saca la lista de corte, la compra y el paso a paso. {design.parts.length ? `${design.parts.length} ${design.parts.length === 1 ? 'pieza' : 'piezas'} · ${dimsText} · ${CRAFT_LABEL[craft]}` : 'Empieza añadiendo una pieza o abre un ejemplo.'}</p>
        </div>
        <div className="free-actions">
          <button type="button" className="btn" onClick={doSave} disabled={!design.parts.length}><Save size={18} aria-hidden />Guardar</button>
          <button type="button" className="btn primary" onClick={openManual} disabled={!full}>Ver paso a paso y PDF <ArrowRight size={18} aria-hidden /></button>
        </div>
      </div>

      <div className="free">
        <div className="free-stage">
          {preview ? (
            <Viewer3D
              project={preview} labels dims={showDims} keepView partDrag dragVertical={vertical}
              selected={selected} onSelect={onSelect} onPartDrag={onPartDrag} snap={onSnap} resetKey={resetKey}
              className="free-viewer" label="Modelo 3D del diseño libre: arrastra una pieza para moverla"
            >
              <div className="viewer-tools free-tools">
                <div className="free-toolrow">
                  <button type="button" className="btn small" onClick={undo} disabled={!hist.past.length} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)"><Undo2 size={18} aria-hidden /></button>
                  <button type="button" className="btn small" onClick={redo} disabled={!hist.future.length} aria-label="Rehacer (Ctrl+Y)" title="Rehacer (Ctrl+Y)"><Redo2 size={18} aria-hidden /></button>
                </div>
                <div className="segmented free-mode" role="group" aria-label="Cómo se mueve la pieza al arrastrar">
                  <button type="button" aria-pressed={!vertical} onClick={() => setVertical(false)}><MoveHorizontal size={16} aria-hidden />Suelo</button>
                  <button type="button" aria-pressed={vertical} onClick={() => setVertical(true)}><MoveVertical size={16} aria-hidden />Altura</button>
                </div>
                <div className="free-toolrow">
                  <button type="button" className="btn small" aria-pressed={magnet} onClick={() => setMagnet((m) => !m)} title="Imanes: pegan la pieza a las caras de las demás"><Magnet size={18} aria-hidden /><span className="free-hide-s">Imán</span></button>
                  <button type="button" className="btn small" aria-pressed={showDims} onClick={() => setShowDims((v) => !v)} title="Cotas generales"><Ruler size={18} aria-hidden /><span className="free-hide-s">Cotas</span></button>
                  <button type="button" className="btn small" onClick={() => setResetKey((k) => k + 1)} title="Centrar la vista"><RotateCcw size={18} aria-hidden /><span className="free-hide-s">Centrar</span></button>
                </div>
              </div>
              <div className="free-status" aria-live="polite">
                {snapNote ? <span className="free-pill">{snapNote}</span>
                  : overlaps.length > 0 ? (
                    <button type="button" className="free-pill warn" onClick={() => { setSelected(overlaps[0].a); setTab('pieza'); }}>
                      <TriangleAlert size={16} aria-hidden />{overlaps.length === 1 ? `Se solapan ${refs.get(overlaps[0].a)} y ${refs.get(overlaps[0].b)}` : `${overlaps.length} solapes entre piezas`}
                    </button>
                  ) : <span className="free-pill hint">{vertical ? 'Arrastra una pieza para subirla o bajarla' : 'Arrastra una pieza para moverla sobre el suelo'}</span>}
              </div>
            </Viewer3D>
          ) : (
            <div className="viewer free-empty">
              <div>
                <h2>Empieza tu diseño</h2>
                <p>Añade una primera pieza o parte de un ejemplo sencillo. Todo se guarda solo en este navegador mientras trabajas.</p>
                <div className="free-empty-actions">
                  <button type="button" className="btn primary" onClick={() => addPart(newPart('liston', 'n'))}><Plus size={18} aria-hidden />Añadir un listón</button>
                  <button type="button" className="btn" onClick={() => addPart(newPart('tubo', 'n'))}><Plus size={18} aria-hidden />Añadir un tubo</button>
                </div>
                <div className="free-empty-actions">
                  {EXAMPLES.map((ex) => (
                    <button key={ex.id} type="button" className="btn small ghost" onClick={() => replaceDesign(ex.make(), `Ejemplo abierto: ${ex.name}`)}><FolderOpen size={16} aria-hidden />{ex.name}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="free-side" aria-label="Paneles del modo libre">
          <div className="tabs free-tabs" role="tablist" aria-label="Paneles">
            {TABS.map((t) => (
              <button key={t.id} id={`ftab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`fpanel-${t.id}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === 'uniones' && contacts.length > 0 && <span className="count">{contacts.length}</span>}
                {t.id === 'lista' && design.parts.length > 0 && <span className="count">{design.parts.length}</span>}
              </button>
            ))}
          </div>
          <div className="free-panel" role="tabpanel" id={`fpanel-${tab}`} aria-labelledby={`ftab-${tab}`}>
            {tab === 'anadir' && <AddPanel onAdd={addPart} />}
            {tab === 'pieza' && (sel ? (
              <PartPanel
                key={sel.id} part={sel} liveAt={live?.id === sel.id ? live.at : null} refLetter={refs.get(sel.id) ?? ''}
                groups={[...new Set(design.parts.map((p) => p.group).filter((g): g is string => !!g))]}
                contacts={contacts.filter((c) => c.a === sel.id || c.b === sel.id)} joints={design.joints ?? {}} byId={byId} refName={refName}
                overlapsWith={overlaps.filter((o) => o.a === sel.id || o.b === sel.id).map((o) => (o.a === sel.id ? o.b : o.a))}
                update={(fn) => updatePart(sel.id, fn)} nudge={(a, dd) => nudge(sel.id, a, dd)} duplicate={() => duplicate(sel.id)} remove={() => remove(sel.id)}
                setJoint={setJoint} select={setSelected}
              />
            ) : (
              <div className="free-none">
                <p><strong>Ninguna pieza seleccionada.</strong> Toca una pieza en el modelo o en la lista para cambiar sus medidas, girarla o moverla.</p>
                {design.parts.length > 0 && (
                  <ul className="free-plist">
                    {design.parts.map((p) => (
                      <li key={p.id}><button type="button" onClick={() => setSelected(p.id)}><span className="ref">{refs.get(p.id)}</span><span>{p.name}<small>{partLabel(p)}</small></span></button></li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn small" onClick={() => setTab('anadir')}><Plus size={16} aria-hidden />Añadir pieza</button>
              </div>
            ))}
            {tab === 'uniones' && <JointsPanel contacts={contacts} byId={byId} joints={design.joints ?? {}} refName={refName} setJoint={setJoint} commit={commit} select={(id) => { setSelected(id); }} selected={selected} />}
            {tab === 'lista' && <ListPanel design={design} project={full} refs={refs} overlaps={overlaps} contacts={contacts.length} dimsText={dimsText} selected={selected} select={(id) => { setSelected(id); setTab('pieza'); }} refName={refName} />}
            {tab === 'diseno' && (
              <DesignPanel
                design={design} craft={craft} grid={grid} setGrid={setGrid} shareUrl={shareUrl} copyLink={copyLink} saved={mine} savedId={savedId}
                rename={(name) => commit((d) => (d.name === name ? d : { ...d, name }))}
                setCraft={(c) => commit((d) => ({ ...d, craft: c }))}
                onNew={() => {
                  if (design.parts.length && !window.confirm('¿Empezar un diseño en blanco? El actual se pierde si no lo has guardado (Ctrl+Z lo recupera mientras sigas en esta página).')) return;
                  replaceDesign(emptyDesign(), 'Diseño en blanco');
                }}
                onExample={(i) => {
                  if (design.parts.length && !window.confirm('¿Abrir el ejemplo? Sustituye al diseño actual (Ctrl+Z lo recupera).')) return;
                  replaceDesign(EXAMPLES[i].make(), `Ejemplo abierto: ${EXAMPLES[i].name}`);
                }}
                onOpen={(s) => {
                  const d = parseDesign(s.query);
                  if (!d) { say('No se ha podido leer ese diseño.'); return; }
                  replaceDesign(d, `Abierto: ${s.name}`, s.id);
                }}
                onDelete={(s) => {
                  if (!window.confirm(`¿Borrar «${s.name}» de Mis diseños?`)) return;
                  setSaved((old) => old.filter((x) => x.id !== s.id));
                  if (savedId === s.id) setSavedId(null);
                }}
                doSave={doSave}
              />
            )}
          </div>
        </aside>
      </div>
      <div className="free-toast" role="status" aria-live="polite">{toast && <span>{toast}</span>}</div>
    </div>
  );
}

// ---------- campos ----------

/** Caja numérica: deja escribir libremente (acepta coma) y aplica al salir o con Intro. Flechas ±1, Mayús ±10. */
function NumField({ label, value, onCommit, min = 1, unit = 'mm', id, hideLabel }: { label: string; value: number; onCommit: (n: number) => void; min?: number; unit?: string; id: string; hideLabel?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(',', '.').trim());
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(Math.max(min, Math.round(n * 10) / 10));
    setDraft(null);
  };
  return (
    <div className="free-num">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      <div className="numbox">
        <input
          id={id} type="text" inputMode="decimal" autoComplete="off" value={draft ?? fmt(value)}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit} onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const st = e.shiftKey ? 10 : 1;
              setDraft(null);
              onCommit(Math.max(min, value + (e.key === 'ArrowUp' ? st : -st)));
            }
          }}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

/** Texto que se aplica al salir del campo o con Intro (para no llenar el historial letra a letra). */
function TextField({ label, value, onCommit, id, placeholder, list }: { label: string; value: string; onCommit: (s: string) => void; id: string; placeholder?: string; list?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} className="free-text" type="text" value={draft ?? value} placeholder={placeholder} list={list} maxLength={80} autoComplete="off"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="free-sec">
      <div className="free-sec-head"><h3>{title}</h3>{aside}</div>
      {children}
    </section>
  );
}

/** Campos de medida de una pieza (comunes al panel de añadir y al de la pieza). */
function SizeFields({ p, set, idp }: { p: FreePart; set: (patch: Partial<FreePart>) => void; idp: string }) {
  return (
    <div className="free-sizes">
      {(p.kind === 'liston' || p.kind === 'tubo' || p.kind === 'pletina') && p.section && (
        <>
          <NumField id={`${idp}-sa`} label="Sección, lado 1" value={p.section[0]} onCommit={(n) => set({ section: [n, p.section![1]] })} />
          <NumField id={`${idp}-sb`} label="Sección, lado 2" value={p.section[1]} onCommit={(n) => set({ section: [p.section![0], n] })} />
        </>
      )}
      {p.kind === 'tubo' && <NumField id={`${idp}-w`} label="Pared" value={p.wall ?? 1.5} min={0.1} onCommit={(n) => set({ wall: n })} />}
      {p.kind === 'redondo' && <NumField id={`${idp}-d`} label="Diámetro" value={p.diameter ?? 12} onCommit={(n) => set({ diameter: n })} />}
      {p.kind === 'tablero' && (
        <>
          <NumField id={`${idp}-t`} label="Grueso" value={p.thickness ?? 18} onCommit={(n) => set({ thickness: n })} />
          <NumField id={`${idp}-wd`} label="Ancho" value={p.width ?? 400} onCommit={(n) => set({ width: n })} />
        </>
      )}
      <NumField id={`${idp}-l`} label="Largo" value={p.length} onCommit={(n) => set({ length: n })} />
    </div>
  );
}

function OrientField({ p, onAxis, idp }: { p: FreePart; onAxis: (a: Axis) => void; idp: string }) {
  const labels = p.kind === 'tablero' ? ORIENT_PANEL : ORIENT_LINEAL;
  const order: Axis[] = p.kind === 'tablero' ? ['y', 'x', 'z'] : ['y', 'x', 'z'];
  return (
    <div className="field">
      <span className="sr-only" id={`${idp}-or`}>Orientación</span>
      <div className="segmented free-seg" role="group" aria-labelledby={`${idp}-or`}>
        {order.map((a) => (
          <button key={a} type="button" aria-pressed={p.axis === a} onClick={() => onAxis(a)}>{labels[a]}<small>{AX_LABEL[a]}</small></button>
        ))}
      </div>
    </div>
  );
}

function MaterialField({ p, set, idp }: { p: FreePart; set: (m: FreePart['material']) => void; idp: string }) {
  const mats = KIND_MATERIALS[p.kind];
  if (mats.length < 2) return null;
  return (
    <div className="field">
      <label htmlFor={`${idp}-mat`}>Material</label>
      <select id={`${idp}-mat`} className="free-select" value={p.material} onChange={(e) => set(e.target.value as FreePart['material'])}>
        {mats.map((m) => <option key={m} value={m}>{p.kind === 'tablero' && m === 'pino' ? 'Pino alistonado' : MAT_LABEL(m)}</option>)}
      </select>
    </div>
  );
}

// ---------- panel: añadir ----------

const KINDS: FreeKind[] = ['liston', 'tablero', 'tubo', 'pletina', 'redondo'];

function AddPanel({ onAdd }: { onAdd: (p: FreePart) => void }) {
  const [draft, setDraft] = useState<FreePart>(() => newPart('liston', 'nuevo'));
  const set = (patch: Partial<FreePart>) => setDraft((d) => normalizePart({ ...d, ...patch }));
  const presets = PRESETS[draft.kind];
  const isPreset = (s: Partial<FreePart>) => Object.entries(s).every(([k, v]) => JSON.stringify(draft[k as keyof FreePart]) === JSON.stringify(v));
  return (
    <div className="free-stack">
      <Section title="Tipo de pieza">
        <div className="free-kinds" role="group" aria-label="Tipo de pieza">
          {KINDS.map((k) => (
            <button key={k} type="button" className="btn small" aria-pressed={draft.kind === k} onClick={() => setDraft(newPart(k, 'nuevo'))}>{KIND_LABEL[k]}</button>
          ))}
        </div>
      </Section>
      <Section title={draft.kind === 'tablero' ? 'Gruesos habituales' : 'Secciones habituales'}>
        <div className="presets">
          {presets.map((pr) => (
            <button key={pr.label} type="button" className="btn small" aria-pressed={isPreset(pr.set)} onClick={() => set(pr.set)}>{pr.label}</button>
          ))}
        </div>
        <p className="help">Medidas de partida habituales, no un catálogo: compruébalas en tu almacén y cámbialas con libertad.</p>
      </Section>
      <Section title="Medidas">
        <MaterialField p={draft} set={(m) => set({ material: m })} idp="add" />
        <SizeFields p={draft} set={set} idp="add" />
      </Section>
      <Section title="Orientación">
        <OrientField p={draft} onAxis={(a) => set({ axis: a })} idp="add" />
      </Section>
      <button type="button" className="btn primary free-wide" onClick={() => onAdd(draft)}><Plus size={18} aria-hidden />Añadir {KIND_LABEL[draft.kind].toLowerCase()} · {partLabel(draft).replace(`${KIND_LABEL[draft.kind]} `, '')}</button>
      <p className="help">Aparece sobre el suelo, a un lado de lo que ya tienes. Arrástrala en el modelo: el imán la pega a las caras de las demás piezas.</p>
    </div>
  );
}

// ---------- panel: pieza ----------

interface PartPanelProps {
  part: FreePart;
  liveAt: Vec3 | null;
  refLetter: string;
  groups: string[];
  contacts: Contact[];
  joints: Record<string, JointKind>;
  byId: Map<string, FreePart>;
  refName: (id: string) => string;
  overlapsWith: string[];
  update: (fn: (p: FreePart) => FreePart) => void;
  nudge: (a: Axis, d: number) => void;
  duplicate: () => void;
  remove: () => void;
  setJoint: (key: string, j: JointKind | '') => void;
  select: (id: string) => void;
}

function PartPanel(p: PartPanelProps) {
  const { part } = p;
  const at = p.liveAt ?? part.at;
  const set = (patch: Partial<FreePart>) => p.update((x) => ({ ...x, ...patch }));
  const idp = `pp-${part.id}`;
  return (
    <div className="free-stack">
      <div className="free-part-head">
        <span className="ref">{p.refLetter}</span>
        <div>
          <strong>{part.name}</strong>
          <small>{partLabel(part)} · {MAT_LABEL(part.material)}</small>
        </div>
      </div>
      {p.overlapsWith.length > 0 && (
        <div className="block warn free-warn" role="alert">
          <p><TriangleAlert size={16} aria-hidden /> Se solapa con {p.overlapsWith.map((id, i) => (
            <span key={id}>{i ? ', ' : ''}<button type="button" className="free-link" onClick={() => p.select(id)}>{p.refName(id)}</button></span>
          ))}. Dos piezas no pueden ocupar el mismo sitio: muévela o acórtala.</p>
        </div>
      )}
      <Section title="Pieza">
        <TextField id={`${idp}-name`} label="Nombre" value={part.name} onCommit={(name) => set({ name })} placeholder={KIND_LABEL[part.kind]} />
        <MaterialField p={part} set={(m) => set({ material: m })} idp={idp} />
        <SizeFields p={part} set={set} idp={idp} />
      </Section>
      <Section title="Orientación" aside={part.kind !== 'redondo' && (
        <button type="button" className="btn small ghost" onClick={() => p.update(turnSection)} title={part.kind === 'tablero' ? 'Intercambia largo y ancho' : 'Pone el listón de canto o tumbado'}><RotateCw size={16} aria-hidden />Girar 90°</button>
      )}>
        <OrientField p={part} onAxis={(a) => p.update((x) => reorient(x, a))} idp={idp} />
      </Section>
      <Section title="Posición" aside={<span className="help">esquina mínima</span>}>
        <div className="free-pos">
          {(['x', 'y', 'z'] as Axis[]).map((a, i) => (
            <div className="free-posrow" key={a}>
              <span className="free-axis" aria-hidden>{AX_LABEL[a]}</span>
              <button type="button" className="btn small" onClick={() => p.nudge(a, -10)} aria-label={`${AX_LABEL[a]} menos 10 mm`}>−10</button>
              <button type="button" className="btn small" onClick={() => p.nudge(a, -1)} aria-label={`${AX_LABEL[a]} menos 1 mm`}>−1</button>
              <NumField id={`${idp}-p${a}`} label={`Posición ${AX_LABEL[a]}${a === 'y' ? ' (altura)' : ''}`} hideLabel value={at[i]} min={a === 'y' ? 0 : -20000} onCommit={(n) => {
                const nat: Vec3 = [...part.at];
                nat[i] = n;
                set({ at: nat });
              }} />
              <button type="button" className="btn small" onClick={() => p.nudge(a, 1)} aria-label={`${AX_LABEL[a]} más 1 mm`}>+1</button>
              <button type="button" className="btn small" onClick={() => p.nudge(a, 10)} aria-label={`${AX_LABEL[a]} más 10 mm`}>+10</button>
            </div>
          ))}
        </div>
        <p className="help">X a lo ancho, Y en altura (0 = suelo), Z a lo fondo. Con la pieza seleccionada: flechas 10 mm, Mayús + flechas 1 mm, Re Pág / Av Pág en altura.</p>
      </Section>
      <Section title="Grupo de montaje">
        <TextField id={`${idp}-grp`} label="Se monta con el grupo" value={part.group ?? ''} onCommit={(g) => set({ group: g })} placeholder="Sin grupo (por alturas)" list={`${idp}-groups`} />
        <datalist id={`${idp}-groups`}>{p.groups.map((g) => <option key={g} value={g} />)}</datalist>
        {p.groups.length > 0 && (
          <div className="presets">
            {p.groups.map((g) => <button key={g} type="button" className="btn small" aria-pressed={part.group === g} onClick={() => set({ group: part.group === g ? undefined : g })}>{g}</button>)}
          </div>
        )}
        <p className="help">Cada grupo será un paso del manual, de abajo arriba. Sin grupos, el manual monta por alturas.</p>
      </Section>
      {p.contacts.length > 0 && (
        <Section title="Encuentros de esta pieza">
          <ul className="free-joints">
            {p.contacts.map((c) => {
              const other = c.a === part.id ? c.b : c.a;
              return <JointRow key={c.key} c={c} label={<>Con <button type="button" className="free-link" onClick={() => p.select(other)}>{p.refName(other)}</button></>} byId={p.byId} value={p.joints[c.key]} setJoint={p.setJoint} />;
            })}
          </ul>
        </Section>
      )}
      <div className="free-row">
        <button type="button" className="btn" onClick={p.duplicate}><Copy size={18} aria-hidden />Duplicar<kbd>Ctrl+D</kbd></button>
        <button type="button" className="btn free-danger" onClick={p.remove}><Trash2 size={18} aria-hidden />Eliminar<kbd>Supr</kbd></button>
      </div>
    </div>
  );
}

function JointRow({ c, label, byId, value, setJoint, onFocus }: { c: Contact; label: ReactNode; byId: Map<string, FreePart>; value?: JointKind; setJoint: (key: string, j: JointKind | '') => void; onFocus?: () => void }) {
  const a = byId.get(c.a), b = byId.get(c.b);
  if (!a || !b) return null;
  const allowed = allowedJoints(a, b);
  const v = value && allowed.includes(value) ? value : '';
  return (
    <li className={v ? '' : 'todo'}>
      <span className="free-jl">{label}</span>
      <select className="free-select small" value={v} onChange={(e) => setJoint(c.key, e.target.value as JointKind | '')} onFocus={onFocus} aria-label="Unión de este encuentro">
        <option value="">Por decidir</option>
        {allowed.map((j) => <option key={j} value={j}>{JOINT_LABEL[j]}</option>)}
      </select>
    </li>
  );
}

// ---------- panel: uniones ----------

function JointsPanel({ contacts, byId, joints, refName, setJoint, commit, select, selected }: {
  contacts: Contact[]; byId: Map<string, FreePart>; joints: Record<string, JointKind>; refName: (id: string) => string;
  setJoint: (key: string, j: JointKind | '') => void; commit: (fn: (d: FreeDesign) => FreeDesign) => void; select: (id: string) => void; selected: string | null;
}) {
  const pending = contacts.filter((c) => !joints[c.key]).length;
  const fillAll = (j: JointKind) => commit((d) => {
    const next = { ...(d.joints ?? {}) };
    for (const c of contacts) {
      const a = byId.get(c.a), b = byId.get(c.b);
      if (a && b && !next[c.key] && allowedJoints(a, b).includes(j)) next[c.key] = j;
    }
    return { ...d, joints: next };
  });
  if (!contacts.length) {
    return (
      <div className="free-none">
        <p><strong>Todavía no hay encuentros.</strong> Un encuentro es un sitio donde dos piezas se tocan cara con cara. Arrastra una pieza contra otra: el imán las deja juntas.</p>
      </div>
    );
  }
  return (
    <div className="free-stack">
      <p className="free-lead">El modo libre no elige las uniones por ti: decide cómo unir cada encuentro; mira <Link to="/consejos/carpinteria">Consejos</Link>. Lo que elijas aparece marcado en el modelo y en el manual, sin medidas inventadas.</p>
      <div className="free-row wrap">
        <span className="help">{pending ? `${pending} por decidir.` : 'Todos decididos.'} Rellenar los pendientes con:</span>
        {(['tornillo', 'tubillon', 'cola', 'soldadura'] as JointKind[]).map((j) => (
          <button key={j} type="button" className="btn small" disabled={!pending} onClick={() => fillAll(j)}>{JOINT_LABEL[j]}</button>
        ))}
      </div>
      <ul className="free-joints">
        {contacts.map((c) => (
          <JointRow key={c.key} c={c} byId={byId} value={joints[c.key]} setJoint={setJoint} onFocus={() => select(c.a)}
            label={<button type="button" className={`free-link${selected === c.a || selected === c.b ? ' on' : ''}`} onClick={() => select(c.a)}>{refName(c.a)} <span aria-hidden>↔</span><span className="sr-only">con</span> {refName(c.b)}</button>} />
        ))}
      </ul>
      <p className="help">Solo se ofrecen uniones que encajan con los materiales: soldadura entre aceros; tubillón y cola entre maderas; tornillo en todos.</p>
    </div>
  );
}

// ---------- panel: lista ----------

function ListPanel({ design, project, refs, overlaps, contacts, dimsText, selected, select, refName }: {
  design: FreeDesign; project: Project | null; refs: Map<string, string>; overlaps: { a: string; b: string }[]; contacts: number; dimsText: string;
  selected: string | null; select: (id: string) => void; refName: (id: string) => string;
}) {
  const cuts = useMemo(() => (project ? cutList(project) : []), [project]);
  const stock = useMemo(() => (project ? stockList(project) : []), [project]);
  if (!design.parts.length) return <div className="free-none"><p><strong>Aún no hay piezas.</strong> Añade la primera en la pestaña Añadir.</p></div>;
  const bad = new Set(overlaps.flatMap((o) => [o.a, o.b]));
  return (
    <div className="free-stack">
      <dl className="free-sum">
        <div><dt>Medidas totales</dt><dd>{dimsText}</dd></div>
        <div><dt>Piezas</dt><dd>{design.parts.length}</dd></div>
        <div><dt>Referencias</dt><dd>{cuts.length}</dd></div>
        <div><dt>Encuentros</dt><dd>{contacts}</dd></div>
      </dl>
      <p className="help">Ancho × fondo × alto.</p>
      {overlaps.length > 0 && (
        <div className="block warn" role="alert">
          <h3><TriangleAlert size={18} aria-hidden />{overlaps.length === 1 ? 'Hay un solape' : `Hay ${overlaps.length} solapes`}</h3>
          <ul className="dots">
            {overlaps.slice(0, 6).map((o) => <li key={`${o.a}-${o.b}`}><button type="button" className="free-link" onClick={() => select(o.a)}>{refName(o.a)}</button> y <button type="button" className="free-link" onClick={() => select(o.b)}>{refName(o.b)}</button></li>)}
          </ul>
        </div>
      )}
      <Section title="Piezas">
        <ul className="free-plist">
          {design.parts.map((p) => (
            <li key={p.id}>
              <button type="button" aria-pressed={selected === p.id} onClick={() => select(p.id)}>
                <span className="ref">{refs.get(p.id)}</span>
                <span>{p.name}{bad.has(p.id) && <TriangleAlert size={14} className="free-bad" aria-label="se solapa" />}<small>{partLabel(p)}{p.group ? ` · ${p.group}` : ''}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Lista de corte">
        <div className="table-wrap">
          <table className="data free-table">
            <thead><tr><th>Ref.</th><th>Pieza</th><th className="r">Ud</th><th>Medida (mm)</th></tr></thead>
            <tbody>
              {cuts.map((c) => (
                <tr key={c.ref} className={`pick${c.partIds.includes(selected ?? '') ? ' sel' : ''}`} onClick={() => select(c.partIds[0])}>
                  <td><span className="ref">{c.ref}</span></td>
                  <td>{c.name}<small className="free-stock">{c.stock}</small></td>
                  <td className="r">{c.qty}</td>
                  <td className="dim">{fmtCut(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Compra">
        <ul className="free-buy">
          {stock.map((s) => <li key={s.stock}><strong>{s.stock}</strong><span>{s.buy}</span><small>{s.detail}</small></li>)}
        </ul>
        <p className="help">Barras de largo habitual (orientativo) contando el corte del disco. Compruébalo en tu almacén.</p>
      </Section>
    </div>
  );
}

// ---------- panel: diseño ----------

function DesignPanel(p: {
  design: FreeDesign; craft: Craft; grid: 5 | 10; setGrid: (g: 5 | 10) => void; shareUrl: string; copyLink: () => void; saved: SavedDesign[]; savedId: string | null;
  rename: (n: string) => void; setCraft: (c: Craft | undefined) => void; onNew: () => void; onExample: (i: number) => void; onOpen: (s: SavedDesign) => void; onDelete: (s: SavedDesign) => void; doSave: () => void;
}) {
  return (
    <div className="free-stack">
      <Section title="Este diseño">
        <TextField id="fd-name" label="Nombre" value={p.design.name} onCommit={p.rename} placeholder="Diseño libre" />
        <div className="field">
          <span className="lab" id="fd-craft">Oficio</span>
          <div className="segmented" role="group" aria-labelledby="fd-craft">
            <button type="button" aria-pressed={!p.design.craft} onClick={() => p.setCraft(undefined)}>Según material</button>
            <button type="button" aria-pressed={p.design.craft === 'carpinteria'} onClick={() => p.setCraft('carpinteria')}>Carpintería</button>
            <button type="button" aria-pressed={p.design.craft === 'soldadura'} onClick={() => p.setCraft('soldadura')}>Soldadura</button>
          </div>
        </div>
        <div className="field">
          <span className="lab" id="fd-grid">Rejilla del imán</span>
          <div className="segmented" role="group" aria-labelledby="fd-grid">
            {([5, 10] as const).map((g) => <button key={g} type="button" aria-pressed={p.grid === g} onClick={() => p.setGrid(g)}>{g} mm</button>)}
          </div>
        </div>
        <div className="free-row wrap">
          <button type="button" className="btn" onClick={p.doSave} disabled={!p.design.parts.length}><Save size={18} aria-hidden />{p.savedId ? 'Guardar cambios' : 'Guardar en Mis diseños'}</button>
          <button type="button" className="btn" onClick={p.copyLink} disabled={!p.design.parts.length}><LinkIcon size={18} aria-hidden />Copiar enlace</button>
        </div>
        {p.design.parts.length > 0 && (
          <div className="field">
            <label htmlFor="fd-link">Enlace para compartir</label>
            <input id="fd-link" className="free-text mono" readOnly value={p.shareUrl} onFocus={(e) => e.target.select()} />
          </div>
        )}
        <p className="help">El diseño en curso se guarda solo en este navegador mientras trabajas.</p>
      </Section>
      <Section title="Empezar otro">
        <div className="free-starts">
          <button type="button" className="free-start" onClick={p.onNew}><FilePlus size={20} aria-hidden /><span><strong>Diseño en blanco</strong><small>Sin piezas</small></span></button>
          {EXAMPLES.map((ex, i) => (
            <button key={ex.id} type="button" className="free-start" onClick={() => p.onExample(i)}><Layers size={20} aria-hidden /><span><strong>{ex.name}</strong><small>{ex.blurb}</small></span></button>
          ))}
        </div>
      </Section>
      <Section title="Mis diseños libres">
        {p.saved.length ? (
          <ul className="free-saved">
            {p.saved.map((s) => (
              <li key={s.id} className={s.id === p.savedId ? 'on' : ''}>
                <button type="button" className="free-saved-open" onClick={() => p.onOpen(s)}>
                  <strong>{s.name}</strong>
                  <small>{new Date(s.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}{s.id === p.savedId ? ' · abierto' : ''}</small>
                </button>
                <button type="button" className="btn small ghost" onClick={() => p.onDelete(s)} aria-label={`Borrar ${s.name}`}><X size={18} aria-hidden /></button>
              </li>
            ))}
          </ul>
        ) : <p className="help">Aún no has guardado ningún diseño libre.</p>}
      </Section>
    </div>
  );
}
