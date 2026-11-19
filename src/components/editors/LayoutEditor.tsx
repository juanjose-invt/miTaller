import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { ArrowLeftToLine, ArrowRightToLine, Copy, FoldVertical, Info, SeparatorHorizontal, TriangleAlert, Trash2 } from 'lucide-react';
import type { EditorProps } from '../editors';
import { G, LIM, NOMBRE_TIPO, PUERTA_DOBLE, TIPOS, geometria, layoutReal, serializeLayout, type Cuerpo, type Geo, type Tipo } from '../../generators/modular';
import './layout-editor.css';

/**
 * Editor de la distribución del mueble modular: alzado frontal a escala donde se eligen cuerpos y huecos.
 * Trabaja siempre sobre las medidas REALES (las que resultan del alto total): lo que se ve es lo que se guarda.
 */
export const editorId = 'layout';

const ML = 14, MR = 26, MT = 14, MB = 76; // márgenes del dibujo en px (abajo: cotas de ancho y tiradores)
const TARGET = 40; // objetivo táctil mínimo en px
const clone = (c: Cuerpo[]): Cuerpo[] => c.map((b) => ({ w: b.w, huecos: b.huecos.map((h) => ({ ...h })) }));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;

type Msg = { text: string; tone: 'warn' | 'info' } | null;
type Drag = { kind: 'balda' | 'ancho'; b: number; j: number; start: number; base: Cuerpo[]; s: number; hit: boolean };

const TIPO_AYUDA: Record<Tipo, string> = {
  a: 'Balda vista',
  p: 'Con bisagras',
  c: 'Con guías',
  d: 'Parte en dos',
};

/** Icono dibujado de cada tipo de hueco (mismo lenguaje que el alzado). */
function TipoIcon({ t }: { t: Tipo }) {
  return (
    <svg className="le-ticon" viewBox="0 0 32 26" aria-hidden width="32" height="26">
      <rect x="1.5" y="1.5" width="29" height="23" rx="1.5" className={t === 'a' || t === 'd' ? 'i-hole' : 'i-front'} />
      {t === 'a' && <line x1="2" y1="16" x2="30" y2="16" className="i-line" />}
      {t === 'd' && <rect x="14.5" y="2" width="3" height="22" className="i-wood" />}
      {t === 'p' && (
        <>
          <line x1="24" y1="7" x2="24" y2="15" className="i-handle" />
          <circle cx="5.5" cy="6" r="1.3" className="i-dot" />
          <circle cx="5.5" cy="20" r="1.3" className="i-dot" />
        </>
      )}
      {t === 'c' && <line x1="11" y1="13" x2="21" y2="13" className="i-handle" />}
    </svg>
  );
}

/** Campo numérico que confirma al salir o con Intro (no reescribe el mueble a cada tecla). */
function NumInput({ id, value, min, max, onCommit, label }: { id: string; value: number; min: number; max: number; onCommit: (n: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (!Number.isFinite(n) || draft.trim() === '') { setDraft(String(value)); return; }
    if (Math.round(n) !== value) onCommit(Math.round(n));
    else setDraft(String(value));
  };
  return (
    <div className="le-num">
      <label htmlFor={id}>{label}</label>
      <div className="numbox">
        <input
          id={id} type="number" inputMode="numeric" min={min} max={max} step={10} value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        />
        <span>mm</span>
      </div>
    </div>
  );
}

export default function LayoutEditor({ param, value, onChange, values }: EditorProps) {
  const geo: Geo = useMemo(() => geometria({ ...values, distribucion: value }), [values, value]);
  const real = useMemo(() => layoutReal(geo), [geo]);
  const [sel, setSel] = useState({ b: 0, k: 0 });
  const sb = Math.min(sel.b, geo.cuerpos.length - 1);
  const sk = Math.min(sel.k, geo.cuerpos[sb].huecos.length - 1);
  const [msg, setMsg] = useState<Msg>(null);
  const [cw, setCw] = useState(380);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const last = useRef(value);
  last.current = value;
  const hRefs = useRef(new Map<string, SVGGElement>());
  const focusNext = useRef<string | null>(null);
  const uid = useRef(`le-${Math.random().toString(36).slice(2, 8)}`).current;

  // ancho disponible
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // los mensajes se borran solos
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  // foco tras moverse con flechas entre huecos
  useEffect(() => {
    if (focusNext.current) {
      hRefs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  const commit = useCallback((next: Cuerpo[]) => {
    const s = serializeLayout(next);
    if (s !== last.current) onChange(s);
  }, [onChange]);
  const warn = (text: string) => setMsg({ text, tone: 'warn' });

  // ---------- escala: a la medida del ancho, pero sin que un hueco o un cuerpo baje de 40 px ----------
  const { T, H, vu, yC, hb, base } = geo;
  const Wext = geo.W + 2 * vu;
  const minH = Math.min(...geo.cuerpos.flatMap((c) => c.huecos.map((h) => h.h)));
  const minW = Math.min(...geo.cuerpos.map((c) => c.w));
  const necesaria = Math.min(0.34, Math.max(TARGET / minH, (TARGET + 8) / minW));
  const ajuste = Math.min((cw - ML - MR) / Wext, 0.5, 620 / H);
  const s = frozen ?? Math.max(ajuste, necesaria);
  const svgW = Math.ceil(ML + Wext * s + MR);
  const svgH = Math.ceil(MT + H * s + MB);
  const X = (x: number) => ML + x * s;
  const Y = (y: number) => MT + (H - y) * s;
  const ys0 = base === 'patas' ? hb : 0;
  const yFloor = Y(0);
  const yCota = yFloor + 21;
  const yGrip = yFloor + 51;

  // ---------- operaciones ----------
  const setTipo = (t: Tipo) => {
    const n = clone(real);
    n[sb].huecos[sk].t = t;
    commit(n);
    const wI = real[sb].w - 2 * T;
    if (t === 'p' && wI > PUERTA_DOBLE) setMsg({ text: `Este hueco tiene ${wI} mm libres: lleva puertas dobles.`, tone: 'info' });
    else if (t === 'c' && geo.cuerpos[sb].huecos[sk].h > 450) setMsg({ text: 'Un cajón tan alto pesa mucho cargado: plantéate partir el hueco en dos.', tone: 'info' });
    else setMsg(null);
  };
  const partir = () => {
    const c = real[sb];
    if (c.huecos.length >= LIM.maxHuecos) return warn(`Como mucho ${LIM.maxHuecos} huecos por cuerpo.`);
    const h = c.huecos[sk];
    if (h.h < 2 * LIM.hMin + T) return warn(`Para partirlo, el hueco necesita al menos ${2 * LIM.hMin + T} mm (dos huecos de ${LIM.hMin} mm y la balda).`);
    const n = clone(real);
    const a = Math.round((h.h - T) / 2);
    n[sb].huecos.splice(sk, 1, { t: h.t, h: a }, { t: h.t, h: h.h - T - a });
    commit(n);
    setMsg({ text: 'Balda añadida: arrástrala para ajustar los altos.', tone: 'info' });
  };
  const unir = (dir: 1 | -1) => {
    const o = sk + dir;
    const c = real[sb];
    if (o < 0 || o >= c.huecos.length) return;
    const n = clone(real);
    const lo = Math.min(sk, o);
    n[sb].huecos.splice(lo, 2, { t: c.huecos[sk].t, h: c.huecos[sk].h + c.huecos[o].h + T });
    setSel({ b: sb, k: lo });
    commit(n);
    setMsg(null);
  };
  const setAltoHueco = (v: number) => {
    const c = real[sb];
    if (c.huecos.length === 1) return warn('Con un solo hueco, su alto lo marca el alto total del mueble.');
    const o = sk < c.huecos.length - 1 ? sk + 1 : sk - 1; // cede o toma alto del de arriba (o del de abajo si es el último)
    const sum = c.huecos[sk].h + c.huecos[o].h;
    const nv = clamp(v, LIM.hMin, sum - LIM.hMin);
    if (nv !== v) warn(`Ese hueco puede ir de ${LIM.hMin} a ${sum - LIM.hMin} mm: el ${o > sk ? 'de arriba' : 'de abajo'} no puede bajar de ${LIM.hMin} mm.`);
    const n = clone(real);
    n[sb].huecos[sk].h = nv;
    n[sb].huecos[o].h = sum - nv;
    commit(n);
  };
  const setAncho = (b: number, v: number) => {
    const nv = clamp(v, LIM.wMin, LIM.wMax);
    if (nv !== v) warn(`El ancho de un cuerpo va de ${LIM.wMin} a ${LIM.wMax} mm.`);
    const n = clone(real);
    n[b].w = nv;
    commit(n);
  };
  const addCuerpo = (lado: 'izq' | 'der') => {
    if (real.length >= LIM.maxCuerpos) return warn(`Como mucho ${LIM.maxCuerpos} cuerpos. Para un mueble más largo, haz dos muebles.`);
    const n = clone(real);
    const nuevo: Cuerpo = { w: Math.min(600, real[sb].w), huecos: real[sb].huecos.map((h) => ({ t: 'a' as Tipo, h: h.h })) };
    const at = lado === 'izq' ? sb : sb + 1;
    n.splice(at, 0, nuevo);
    setSel({ b: at, k: 0 });
    commit(n);
    setMsg({ text: `Cuerpo nuevo de ${nuevo.w} mm con las baldas a la misma altura. El mueble crece ${nuevo.w} mm.`, tone: 'info' });
  };
  const duplicar = () => {
    if (real.length >= LIM.maxCuerpos) return warn(`Como mucho ${LIM.maxCuerpos} cuerpos.`);
    const n = clone(real);
    n.splice(sb + 1, 0, clone([real[sb]])[0]);
    setSel({ b: sb + 1, k: sk });
    commit(n);
    setMsg({ text: `Cuerpo duplicado a la derecha. El mueble crece ${real[sb].w} mm.`, tone: 'info' });
  };
  const quitar = () => {
    if (real.length <= 1) return warn('El mueble necesita al menos un cuerpo.');
    const n = clone(real);
    n.splice(sb, 1);
    setSel({ b: Math.max(0, sb - 1), k: 0 });
    commit(n);
    setMsg(null);
  };

  /** Aplica un desplazamiento (en mm) a una balda o a un canto partiendo de `basis`. */
  const mover = (kind: 'balda' | 'ancho', b: number, j: number, delta: number, basis: Cuerpo[], paso: number): boolean => {
    const n = clone(basis);
    let tope = false;
    if (kind === 'balda') {
      const lo = n[b].huecos[j], up = n[b].huecos[j + 1];
      const sum = lo.h + up.h;
      const want = snap(lo.h + delta, paso);
      const v = clamp(want, LIM.hMin, sum - LIM.hMin);
      tope = v !== want;
      lo.h = v;
      up.h = sum - v;
    } else if (j < n.length - 1) {
      const a = n[j], c = n[j + 1];
      const sum = a.w + c.w;
      const want = snap(a.w + delta, paso);
      const v = clamp(want, Math.max(LIM.wMin, sum - LIM.wMax), Math.min(LIM.wMax, sum - LIM.wMin));
      tope = v !== want;
      a.w = v;
      c.w = sum - v;
    } else {
      const want = snap(n[j].w + delta, paso);
      n[j].w = clamp(want, LIM.wMin, LIM.wMax);
      tope = n[j].w !== want;
    }
    commit(n);
    return tope;
  };
  const avisoTope = (kind: 'balda' | 'ancho') =>
    warn(kind === 'balda' ? `Tope: ningún hueco baja de ${LIM.hMin} mm.` : `Tope: cada cuerpo mide entre ${LIM.wMin} y ${LIM.wMax} mm.`);

  // ---------- arrastre ----------
  const onDown = (e: RPointerEvent<SVGGElement>, kind: 'balda' | 'ancho', b: number, j: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { kind, b, j, start: kind === 'balda' ? e.clientY : e.clientX, base: clone(real), s, hit: false };
    setFrozen(s);
    setDragging(`${kind}-${b}-${j}`);
  };
  const raf = useRef(0);
  const onMove = (e: RPointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const px = d.kind === 'balda' ? -(e.clientY - d.start) : e.clientX - d.start;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const tope = mover(d.kind, d.b, d.j, px / d.s, d.base, d.kind === 'balda' ? 5 : 10);
      if (tope && !d.hit) avisoTope(d.kind);
      d.hit = tope;
    });
  };
  const onUp = (e: RPointerEvent<SVGGElement>) => {
    if (!drag.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setFrozen(null);
    setDragging(null);
  };
  const onGripKey = (e: KeyboardEvent<SVGGElement>, kind: 'balda' | 'ancho', b: number, j: number) => {
    const step = e.shiftKey ? 50 : 10;
    const map: Record<string, number> = kind === 'balda'
      ? { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: 100, PageDown: -100 }
      : { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 100, PageDown: -100 };
    const d = map[e.key];
    if (d === undefined) return;
    e.preventDefault();
    if (mover(kind, b, j, d, real, 1)) avisoTope(kind);
  };

  // ---------- teclado en los huecos (rejilla con foco itinerante) ----------
  const ir = (b: number, k: number) => {
    setSel({ b, k });
    focusNext.current = `${b}-${k}`;
  };
  const onHuecoKey = (e: KeyboardEvent<SVGGElement>, b: number, k: number) => {
    const c = geo.cuerpos[b];
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowUp' && k < c.huecos.length - 1) ir(b, k + 1);
    else if (e.key === 'ArrowDown' && k > 0) ir(b, k - 1);
    else if ((e.key === 'ArrowLeft' && b > 0) || (e.key === 'ArrowRight' && b < geo.cuerpos.length - 1)) {
      const nb = b + (e.key === 'ArrowLeft' ? -1 : 1);
      const yc = (c.huecos[k].y0 + c.huecos[k].y1) / 2;
      const hs = geo.cuerpos[nb].huecos;
      let best = 0;
      hs.forEach((h, i) => { if (Math.abs((h.y0 + h.y1) / 2 - yc) < Math.abs((hs[best].y0 + hs[best].y1) / 2 - yc)) best = i; });
      ir(nb, best);
    } else if (e.key === 'Enter' || e.key === ' ') setSel({ b, k });
    else if ((TIPOS as string[]).includes(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setSel({ b, k });
      const n = clone(real);
      n[b].huecos[k].t = key as Tipo;
      commit(n);
    } else return;
    e.preventDefault();
  };

  // ---------- dibujo ----------
  const cur = geo.cuerpos[sb];
  const huecoSel = cur.huecos[sk];
  const nCuerpos = geo.cuerpos.length;

  const frentes = (bi: number, k: number) => {
    const c = geo.cuerpos[bi];
    const h = c.huecos[k];
    const n = c.huecos.length;
    const y0 = k === 0 ? hb + (hb === 0 ? 5 : G / 2) : h.y0 - T / 2 + G / 2;
    const y1 = k === n - 1 ? yC - G / 2 : h.y1 + T / 2 - G / 2;
    return { x0: c.x + G / 2, x1: c.x + c.w - G / 2, y0, y1 };
  };

  const huecoNodes = geo.cuerpos.map((c, bi) =>
    c.huecos.map((h, k) => {
      const isSel = bi === sb && k === sk;
      const wI = c.w - 2 * T;
      const ix = X(c.x + T), iw = wI * s, iy = Y(h.y1), ih = h.h * s;
      const f = frentes(bi, k);
      const fx = X(f.x0), fw = (f.x1 - f.x0) * s, fy = Y(f.y1), fh = (f.y1 - f.y0) * s;
      const conFrente = h.t === 'p' || h.t === 'c';
      const label = `Cuerpo ${bi + 1}, hueco ${k + 1} de ${c.huecos.length} desde abajo: ${NOMBRE_TIPO[h.t].toLowerCase()}, ${h.h} mm de alto`;
      const doble = h.t === 'p' && wI > PUERTA_DOBLE;
      const hojaDer = bi === nCuerpos - 1 && nCuerpos > 1;
      const fs = ih < 34 ? 10 : 11.5;
      return (
        <g
          key={`${bi}-${k}`}
          ref={(el) => { if (el) hRefs.current.set(`${bi}-${k}`, el); else hRefs.current.delete(`${bi}-${k}`); }}
          className={`le-hueco t-${h.t}${isSel ? ' is-sel' : ''}`}
          role="button"
          tabIndex={isSel ? 0 : -1}
          aria-pressed={isSel}
          aria-label={label}
          onClick={() => setSel({ b: bi, k })}
          onKeyDown={(e) => onHuecoKey(e, bi, k)}
        >
          <rect className="le-hole" x={ix} y={iy} width={iw} height={ih} />
          {h.t === 'a' && <line className="le-shadow" x1={ix} y1={iy + 3} x2={ix + iw} y2={iy + 3} />}
          {h.t === 'd' && (
            <>
              <rect className="le-wood" x={X(c.x + c.w / 2 - T / 2)} y={iy} width={Math.max(1.5, T * s)} height={ih} />
            </>
          )}
          {conFrente && <rect className="le-front" x={fx} y={fy} width={fw} height={fh} rx={1} />}
          {h.t === 'c' && (
            <line className="le-handle" x1={fx + fw / 2 - Math.min(140, (f.x1 - f.x0) * 0.4) * s / 2} x2={fx + fw / 2 + Math.min(140, (f.x1 - f.x0) * 0.4) * s / 2} y1={fy + fh / 2} y2={fy + fh / 2} />
          )}
          {h.t === 'p' && (doble
            ? (
              <>
                <line className="le-split" x1={fx + fw / 2} x2={fx + fw / 2} y1={fy} y2={fy + fh} />
                <line className="le-handle" x1={fx + fw / 2 - 40 * s} x2={fx + fw / 2 - 40 * s} y1={fy + Math.min(fh * 0.12, 14)} y2={fy + Math.min(fh * 0.12, 14) + Math.min(fh * 0.4, 34)} />
                <line className="le-handle" x1={fx + fw / 2 + 40 * s} x2={fx + fw / 2 + 40 * s} y1={fy + Math.min(fh * 0.12, 14)} y2={fy + Math.min(fh * 0.12, 14) + Math.min(fh * 0.4, 34)} />
                {[fx + 4, fx + fw - 4].flatMap((cx) => [fy + Math.min(10, fh * 0.2), fy + fh - Math.min(10, fh * 0.2)].map((cy) => <circle key={`${cx}-${cy}`} className="le-hinge" cx={cx} cy={cy} r={1.8} />))}
              </>
            )
            : (
              <>
                <line className="le-handle" x1={hojaDer ? fx + 40 * s : fx + fw - 40 * s} x2={hojaDer ? fx + 40 * s : fx + fw - 40 * s} y1={fy + Math.min(fh * 0.12, 14)} y2={fy + Math.min(fh * 0.12, 14) + Math.min(fh * 0.4, 34)} />
                {[fy + Math.min(10, fh * 0.2), fy + fh - Math.min(10, fh * 0.2)].map((cy) => <circle key={cy} className="le-hinge" cx={hojaDer ? fx + fw - 4 : fx + 4} cy={cy} r={1.8} />)}
              </>
            ))}
          {/* cota del alto libre del hueco */}
          <text className="le-cota" x={ix + 6} y={iy + ih / 2 + fs / 3} fontSize={fs}>{h.h}</text>
          {/* el área de toque cubre el frente o el hueco */}
          <rect className="le-hit" x={conFrente ? fx : ix} y={conFrente ? fy : iy} width={conFrente ? fw : iw} height={conFrente ? fh : ih} />
          <rect className="le-ring" x={(conFrente ? fx : ix) + 1.5} y={(conFrente ? fy : iy) + 1.5} width={Math.max(0, (conFrente ? fw : iw) - 3)} height={Math.max(0, (conFrente ? fh : ih) - 3)} rx={2} />
        </g>
      );
    }),
  );

  // tiradores de las baldas del cuerpo elegido
  const gripsBalda = cur.baldas.map((yb, j) => {
    const lo = cur.huecos[j], up = cur.huecos[j + 1];
    const cx = X(cur.x + cur.w / 2) + (cur.w * s > 150 ? 22 : 0);
    const cy = Y(yb + T / 2);
    const id = `balda-${sb}-${j}`;
    return (
      <g
        key={id}
        className={`le-grip v${dragging === id ? ' is-drag' : ''}`}
        role="slider" tabIndex={0}
        aria-orientation="vertical"
        aria-label={`Balda ${j + 1} del cuerpo ${sb + 1}: alto del hueco de abajo`}
        aria-valuemin={LIM.hMin} aria-valuemax={lo.h + up.h - LIM.hMin} aria-valuenow={lo.h}
        aria-valuetext={`${lo.h} mm abajo, ${up.h} mm arriba`}
        onPointerDown={(e) => onDown(e, 'balda', sb, j)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => onGripKey(e, 'balda', sb, j)}
      >
        <line className="le-guide" x1={X(cur.x)} x2={X(cur.x + cur.w)} y1={cy} y2={cy} />
        <rect className="le-grip-hit" x={cx - 24} y={cy - 22} width={48} height={44} />
        <rect className="le-pill" x={cx - 19} y={cy - 9} width={38} height={18} rx={9} />
        <path className="le-pill-ico" d={`M${cx - 4} ${cy - 2.5} l4 -4 l4 4 M${cx - 4} ${cy + 2.5} l4 4 l4 -4`} />
      </g>
    );
  });

  // cantos entre cuerpos (y el exterior derecho)
  const gripsAncho = geo.cuerpos.map((c, i) => {
    const xe = X(c.x + c.w);
    const ext = i === nCuerpos - 1;
    const id = `ancho-0-${i}`;
    const label = ext
      ? `Canto derecho del cuerpo ${i + 1}: ancho del cuerpo`
      : `Canto entre el cuerpo ${i + 1} y el ${i + 2}: reparte el ancho entre los dos`;
    return (
      <g
        key={id}
        className={`le-grip h${dragging === id ? ' is-drag' : ''}`}
        role="slider" tabIndex={0}
        aria-orientation="horizontal" aria-label={label}
        aria-valuemin={LIM.wMin} aria-valuemax={ext ? LIM.wMax : Math.min(LIM.wMax, c.w + geo.cuerpos[i + 1].w - LIM.wMin)} aria-valuenow={c.w}
        aria-valuetext={ext ? `${c.w} mm` : `${c.w} mm a la izquierda, ${geo.cuerpos[i + 1].w} mm a la derecha`}
        onPointerDown={(e) => onDown(e, 'ancho', 0, i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => onGripKey(e, 'ancho', 0, i)}
      >
        <line className="le-guide" x1={xe} x2={xe} y1={Y(yC)} y2={yGrip - 14} />
        <rect className="le-grip-hit" x={xe - 22} y={yGrip - 21} width={44} height={42} />
        <rect className="le-pill" x={xe - 17} y={yGrip - 11} width={34} height={22} rx={11} />
        <path className="le-pill-ico" d={`M${xe - 3} ${yGrip - 4.5} l-4.5 4.5 l4.5 4.5 M${xe + 3} ${yGrip - 4.5} l4.5 4.5 l-4.5 4.5`} />
      </g>
    );
  });

  const nombreHueco = NOMBRE_TIPO[huecoSel.t].toLowerCase();
  const wISel = cur.w - 2 * T;
  const puedePartir = cur.huecos.length < LIM.maxHuecos && huecoSel.h >= 2 * LIM.hMin + T;

  return (
    <div className="le" aria-describedby={`${uid}-help`}>
      <div className="le-head">
        <p>
          <strong>{nCuerpos} {nCuerpos === 1 ? 'cuerpo' : 'cuerpos'}</strong>
          <span className="le-dim">{Wext} × {H} mm</span>
        </p>
        <p className="le-hint">Toca un hueco · arrastra baldas y cantos</p>
      </div>

      <div className={`le-canvas${svgW > cw + 1 ? ' scrolls' : ''}`} ref={box}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} role="group" aria-label={`Alzado frontal de ${param.label.toLowerCase()}, a escala`}>
          <line className="le-floor" x1={0} x2={svgW} y1={yFloor} y2={yFloor} />
          {/* base */}
          {base === 'zocalo' && geo.cuerpos.map((c, i) => <rect key={`z${i}`} className="le-plinth" x={X(c.x + T)} y={Y(hb)} width={(c.w - 2 * T) * s} height={hb * s} />)}
          {base === 'patas' && geo.cuerpos.flatMap((c, i) => [c.x, c.x + c.w - 45].map((x) => <rect key={`p${i}-${x}`} className="le-wood" x={X(x)} y={Y(hb)} width={45 * s} height={hb * s} />))}
          {/* cajas */}
          {geo.cuerpos.map((c, i) => (
            <rect key={`c${i}`} className={`le-carcass${i === sb ? ' is-body' : ''}`} x={X(c.x)} y={Y(yC)} width={c.w * s} height={(yC - ys0) * s} />
          ))}
          {geo.tapa && <rect className="le-wood le-top" x={X(0)} y={Y(H)} width={Wext * s} height={T * s} />}
          {huecoNodes}
          {gripsBalda}
          {/* cotas de ancho */}
          {geo.cuerpos.map((c, i) => {
            const x0 = X(c.x) + 2, x1 = X(c.x + c.w) - 2;
            return (
              <g key={`w${i}`} className={`le-wcota${i === sb ? ' is-body' : ''}`}>
                <line x1={x0} x2={x1} y1={yCota} y2={yCota} />
                <line x1={x0} x2={x0} y1={yCota - 5} y2={yCota + 5} />
                <line x1={x1} x2={x1} y1={yCota - 5} y2={yCota + 5} />
                <text x={(x0 + x1) / 2} y={yCota - 5} textAnchor="middle">{c.w}</text>
              </g>
            );
          })}
          {gripsAncho}
        </svg>
      </div>

      {geo.avisos.map((a) => (
        <p key={a} className="le-alert warn"><TriangleAlert size={16} aria-hidden />{a}</p>
      ))}
      <p className={`le-alert ${msg?.tone ?? ''}${msg ? '' : ' empty'}`} role="status" aria-live="polite">
        {msg && (msg.tone === 'warn' ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />)}
        {msg?.text}
      </p>

      <section className="le-panel" aria-labelledby={`${uid}-hh`}>
        <header>
          <h4 id={`${uid}-hh`}>Hueco {sk + 1} de {cur.huecos.length}</h4>
          <span>cuerpo {sb + 1} · {nombreHueco} · {wISel} × {huecoSel.h} mm libres</span>
        </header>
        <div className="le-types" role="group" aria-label="Qué lleva el hueco">
          {TIPOS.map((t) => (
            <button key={t} type="button" className="le-type" aria-pressed={huecoSel.t === t} onClick={() => setTipo(t)}>
              <TipoIcon t={t} />
              <span>{NOMBRE_TIPO[t]}</span>
              <small>{t === 'p' && wISel > PUERTA_DOBLE ? 'Dos hojas' : TIPO_AYUDA[t]}</small>
            </button>
          ))}
        </div>
        <div className="le-row">
          <NumInput id={`${uid}-h`} label="Alto libre" value={huecoSel.h} min={LIM.hMin} max={2400} onCommit={setAltoHueco} />
          <div className="le-actions">
            <button type="button" className="btn small" onClick={partir} aria-disabled={!puedePartir}>
              <SeparatorHorizontal size={16} aria-hidden />Partir en dos
            </button>
            <button type="button" className="btn small" onClick={() => unir(1)} disabled={sk >= cur.huecos.length - 1}>
              <FoldVertical size={16} aria-hidden />Unir con el de arriba
            </button>
            <button type="button" className="btn small" onClick={() => unir(-1)} disabled={sk === 0}>
              <FoldVertical size={16} aria-hidden />Unir con el de abajo
            </button>
          </div>
        </div>
      </section>

      <section className="le-panel" aria-labelledby={`${uid}-bh`}>
        <header>
          <h4 id={`${uid}-bh`}>Cuerpo {sb + 1} de {nCuerpos}</h4>
          <span>{cur.huecos.length} {cur.huecos.length === 1 ? 'hueco' : 'huecos'} · {wISel} mm libres por dentro</span>
        </header>
        <div className="le-row">
          <NumInput id={`${uid}-w`} label="Ancho" value={cur.w} min={LIM.wMin} max={LIM.wMax} onCommit={(v) => setAncho(sb, v)} />
          <div className="le-actions">
            <button type="button" className="btn small" onClick={() => addCuerpo('izq')} aria-disabled={nCuerpos >= LIM.maxCuerpos}>
              <ArrowLeftToLine size={16} aria-hidden />Cuerpo a la izquierda
            </button>
            <button type="button" className="btn small" onClick={() => addCuerpo('der')} aria-disabled={nCuerpos >= LIM.maxCuerpos}>
              <ArrowRightToLine size={16} aria-hidden />Cuerpo a la derecha
            </button>
            <button type="button" className="btn small" onClick={duplicar} aria-disabled={nCuerpos >= LIM.maxCuerpos}>
              <Copy size={16} aria-hidden />Duplicar
            </button>
            <button type="button" className="btn small le-danger" onClick={quitar} aria-disabled={nCuerpos <= 1}>
              <Trash2 size={16} aria-hidden />Quitar
            </button>
          </div>
        </div>
      </section>

      <div className="le-note" id={`${uid}-help`}>
        <Info size={16} aria-hidden />
        <div>
          <p>
            <strong>Cómo se reparte el alto.</strong> Los huecos de cada cuerpo se reparten el alto interior (alto total menos{' '}
            {base === 'ninguna' ? '' : base === 'patas' ? 'patas, ' : 'zócalo, '}base, techo{geo.tapa ? ', tapa' : ''} y baldas) en proporción a su alto: si cambias el alto
            total, todos crecen o encogen a la vez. Ningún hueco baja de {LIM.hMin} mm.
          </p>
          <p>
            <strong>Costados dobles.</strong> Cada cuerpo es una caja con sus dos costados: se monta y escuadra por separado y luego se atornillan
            entre sí por dentro. El ancho total es la suma de los cuerpos ({LIM.wMin}–{LIM.wMax} mm cada uno, hasta {LIM.maxCuerpos} cuerpos y {LIM.maxHuecos} huecos por cuerpo).
          </p>
          <p className="le-keys">Teclado: flechas para moverte entre huecos; A, P, C o D eligen abierto, puerta, cajón o divisor; en baldas y cantos, flechas (con Mayúsculas, de 50 en 50 mm).</p>
        </div>
      </div>
    </div>
  );
}
