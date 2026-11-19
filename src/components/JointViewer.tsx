import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';
import { Box, Expand, Rotate3d, Shrink } from 'lucide-react';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Project } from '../core/types';
import { boundsOf } from '../core/builder';
import { jointProject, jointStageCount, openJoint, resolveJointId } from '../data/ensambles-3d';
import { snapshot } from '../three/snapshot';
import { Viewer3D } from './Viewer3D';
import './joint-viewer.css';

/*
 * Visor de ensambles. Hay muchos en una página y el navegador limita los contextos WebGL, así que:
 *  - solo hay MAX_LIVE visores vivos a la vez (los que están en pantalla; el más antiguo cede su sitio);
 *  - fuera de pantalla se enseña una imagen fija hecha con `snapshot()` (un único contexto compartido);
 *  - al salir de pantalla el visor se destruye y su contexto se libera a mano.
 * La apertura mueve cada pieza por su dirección real de montaje (`openJoint`), no en abanico.
 */

const MAX_LIVE = 3;
/** Proporción del visor y de su imagen fija (deben coincidir para que el relevo no salte). */
const POSTER_W = 720;
const POSTER_H = 504;
/** Las imágenes fijas enseñan el ensamble abierto, igual que el visor al arrancar. */
const START_T = 1;

// ---------- reparto de visores vivos ----------

let pool: string[] = [];
const poolSubs = new Set<() => void>();
const poolEmit = () => poolSubs.forEach((f) => f());
function claim(key: string): void {
  if (pool.includes(key)) return;
  pool = [...pool, key].slice(-MAX_LIVE);
  poolEmit();
}
function release(key: string): void {
  if (!pool.includes(key)) return;
  pool = pool.filter((k) => k !== key);
  poolEmit();
}
const poolSubscribe = (f: () => void) => {
  poolSubs.add(f);
  return () => {
    poolSubs.delete(f);
  };
};

// ---------- imágenes fijas ----------

const posters = new Map<string, string>();
const posterSubs = new Set<() => void>();
const queue: string[] = [];
let busy = false;
function pump(): void {
  if (busy) return;
  const id = queue.shift();
  if (!id) return;
  busy = true;
  setTimeout(() => {
    let url = '';
    try {
      const p = jointProject(id);
      if (p) url = snapshot(openJoint(p, START_T), { width: POSTER_W, height: POSTER_H, type: 'image/jpeg' });
    } catch {
      url = ''; // sin WebGL: se queda el hueco con el texto alternativo
    }
    posters.set(id, url);
    posterSubs.forEach((f) => f());
    busy = false;
    pump();
  }, 16);
}
function requestPoster(id: string): void {
  if (posters.has(id) || queue.includes(id)) return;
  queue.push(id);
  pump();
}
const posterSubscribe = (f: () => void) => {
  posterSubs.add(f);
  return () => {
    posterSubs.delete(f);
  };
};

/** Avisa cuando el elemento se acerca a la pantalla (y deja de vigilar). */
function useNear(ref: RefObject<HTMLElement | null>, margin = '600px 0px'): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}

/** Imagen fija del ensamble (data URL), o undefined mientras se genera; '' si no se pudo generar. */
export function useJointPoster(id: string | undefined, enabled: boolean): string | undefined {
  const url = useSyncExternalStore(posterSubscribe, () => (id ? posters.get(id) : undefined), () => undefined);
  useEffect(() => {
    if (id && enabled) requestPoster(id);
  }, [id, enabled]);
  return url;
}

/**
 * El visor encuadra la esfera que envuelve el modelo, y en piezas alargadas el ensamble queda pequeño.
 * Se calcula cuánto ocupa la caja envolvente del modelo abierto vista desde la cámara inicial del visor
 * (misma dirección, campo de 32° y distancia) y se amplía el lienzo para que llene el recuadro.
 */
const zooms = new Map<string, number>();
function fillZoom(id: string, p: Project): number {
  const z0 = zooms.get(id);
  if (z0) return z0;
  const b = boundsOf(openJoint(p, START_T).parts);
  const radius = Math.max(120, Math.hypot(...b.size) / 2);
  const cam = new PerspectiveCamera(32, POSTER_W / POSTER_H, 5, 200000);
  const c = new Vector3(...b.center);
  const dist = (radius / Math.sin((16 * Math.PI) / 180)) * 1.08;
  cam.position.copy(c).add(new Vector3(0.95, 0.62, 1.25).normalize().multiplyScalar(dist));
  cam.lookAt(c);
  cam.updateMatrixWorld();
  let m = 0;
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const zz of [b.min[2], b.max[2]]) {
    const v = new Vector3(x, y, zz).project(cam);
    m = Math.max(m, Math.abs(v.x), Math.abs(v.y) * 1.08);
  }
  const z = Math.min(1.6, Math.max(1, 0.84 / Math.max(m, 0.01)));
  zooms.set(id, z);
  return z;
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

interface Props {
  /** id de un ensamble de `src/data/ensambles-3d.ts` (admite alias como «caja-espiga»). */
  id: string;
  /** Versión reducida para incrustar junto a una técnica: solo el botón de abrir y cerrar. */
  compact?: boolean;
  className?: string;
}

/** Ensamble en 3D que se abre y se cierra, con montaje por pasos. No pinta nada si el id no existe. */
export function JointViewer({ id, compact = false, className = '' }: Props) {
  const jid = resolveJointId(id);
  if (!jid) return null;
  return <JointViewerInner key={jid} jid={jid} compact={compact} className={className} />;
}

function JointViewerInner({ jid, compact, className }: { jid: string; compact: boolean; className: string }) {
  const base = useMemo(() => jointProject(jid)!, [jid]);
  const last = base.steps.length - 1;
  const key = useId();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const near = useNear(root);
  const poster = useJointPoster(jid, near);
  const live = useSyncExternalStore(poolSubscribe, () => pool.includes(key), () => false);

  const [t, setT] = useState(START_T);
  const [step, setStep] = useState(last);
  const [focusT, setFocusT] = useState<number | null>(null);
  const [framed, setFramed] = useState(false);
  const [painted, setPainted] = useState(false);
  const raf = useRef(0);

  // visor vivo solo mientras está en pantalla
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting && e.intersectionRatio >= 0.2) claim(key);
          else if (!e.isIntersecting || e.intersectionRatio < 0.05) release(key);
        }
      },
      { threshold: [0, 0.05, 0.2, 0.5] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      release(key);
    };
  }, [key]);

  // el primer modelo que recibe el visor es el abierto: así el encuadre abarca todo el recorrido.
  // Al destruir el visor, su contexto WebGL se libera de inmediato (no esperamos al recolector).
  useEffect(() => {
    if (!live) {
      setFramed(false);
      setPainted(false);
      return;
    }
    setFramed(true);
    const canvas = stage.current?.querySelector('canvas');
    const id = window.setTimeout(() => setPainted(true), 160);
    return () => {
      window.clearTimeout(id);
      window.setTimeout(() => {
        try {
          const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as WebGLRenderingContext | null | undefined;
          gl?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
          /* el contexto ya no existe */
        }
      }, 0);
    };
  }, [live]);

  // la rueda del ratón desplaza la página; el zoom queda para el gesto de pellizco (ctrl + rueda)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const stages = useMemo(() => jointStageCount(base), [base]);

  function animate(from: number, to: number, ms: number, frame: (v: number) => void, done?: () => void): void {
    cancelAnimationFrame(raf.current);
    if (reducedMotion() || from === to) {
      frame(to);
      done?.();
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      frame(Math.round((from + (to - from) * ease(k)) * 500) / 500);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else done?.();
    };
    raf.current = requestAnimationFrame(tick);
  }

  const open = t > 0.5;
  function toggle(): void {
    claim(key);
    setStep(last);
    setFocusT(null);
    const to = open ? 0 : 1;
    animate(t, to, (500 + 380 * stages) * Math.max(0.35, Math.abs(to - t)), setT);
  }
  function goStep(i: number): void {
    claim(key);
    setStep(i);
    setT(0);
    if (i === 0) {
      cancelAnimationFrame(raf.current);
      setFocusT(null);
      return;
    }
    setFocusT(1);
    animate(1, 0, 1100, setFocusT, () => setFocusT(null));
  }
  function slide(v: number): void {
    cancelAnimationFrame(raf.current);
    setFocusT(null);
    setT(v);
  }

  const project: Project = useMemo(() => {
    if (!framed) return openJoint(base, 1);
    const only = focusT !== null ? { parts: base.steps[step].parts, t: focusT } : undefined;
    return openJoint(base, t, only);
  }, [base, framed, t, focusT, step]);

  const name = base.title;
  const zoom = useMemo(() => fillZoom(jid, base), [jid, base]);
  const showPoster = !live || !painted;

  return (
    <div ref={root} className={`jv ${compact ? 'jv-compact' : ''} ${className}`}>
      <div ref={stage} className="jv-stage" role="group" aria-label={`${name}: modelo 3D`} style={{ '--jv-zoom': zoom } as CSSProperties}>
        {live && (
          <Viewer3D project={project} step={step} explode={0} labels={false} ghost dims={false} keepView label={`${name}, modelo 3D ${open ? 'abierto' : 'cerrado'}. Arrastra para girarlo.`} className="jv-viewer" />
        )}
        {showPoster && (
          <button type="button" className="jv-poster" onClick={() => claim(key)} aria-label={`Ver ${name} en 3D`} tabIndex={live ? -1 : 0}>
            {poster ? <img src={poster} alt="" width={POSTER_W} height={POSTER_H} decoding="async" /> : poster === '' ? <span className="jv-nogl">Vista 3D no disponible en este navegador</span> : <span className="jv-wait" aria-hidden />}
            {!live && poster !== '' && (
              <span className="jv-badge"><Box size={15} aria-hidden />Ver en 3D</span>
            )}
          </button>
        )}
        {live && painted && (
          <span className="jv-hint" aria-hidden><Rotate3d size={14} />Arrastra para girar</span>
        )}
        {compact && (
          <button type="button" className="btn small jv-toggle-float" onClick={toggle}>
            {open ? <Shrink size={16} aria-hidden /> : <Expand size={16} aria-hidden />}
            {open ? 'Cerrar' : 'Abrir'}
          </button>
        )}
      </div>

      {!compact && (
        <div className="jv-controls">
          <div className="jv-row">
            <button type="button" className="btn small dark jv-toggle" onClick={toggle}>
              {open ? <Shrink size={16} aria-hidden /> : <Expand size={16} aria-hidden />}
              {open ? 'Cerrar' : 'Abrir'}
            </button>
            <label className="jv-range">
              <span>Cerrado</span>
              <input type="range" min={0} max={100} step={1} value={Math.round(t * 100)} onChange={(e) => slide(Number(e.target.value) / 100)} aria-label="Apertura del ensamble" aria-valuetext={`${Math.round(t * 100)} % abierto`} />
              <span>Abierto</span>
            </label>
          </div>
          <div className="jv-steps" role="group" aria-label="Montaje paso a paso">
            {base.steps.map((s, i) => (
              <button key={i} type="button" aria-pressed={step === i} onClick={() => goStep(i)} title={s.summary}>
                <b>{i + 1}</b>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
          <p className="jv-caption" aria-live="polite">{base.steps[step].summary}</p>
        </div>
      )}
    </div>
  );
}

/** Miniatura fija de un ensamble (para índices). */
export function JointThumb({ id }: { id: string }) {
  const jid = resolveJointId(id);
  const ref = useRef<HTMLSpanElement>(null);
  const near = useNear(ref, '300px 0px');
  const url = useJointPoster(jid, near);
  if (!jid) return null;
  return (
    <span ref={ref} className="jv-thumb" style={{ '--jv-zoom': fillZoom(jid, jointProject(jid)!) } as CSSProperties}>
      {url ? <img src={url} alt="" width={POSTER_W} height={POSTER_H} decoding="async" /> : <span className="jv-wait" aria-hidden />}
    </span>
  );
}
