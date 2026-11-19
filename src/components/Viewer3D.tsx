import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Axis, Project, Vec3 } from '../core/types';
import { Viewer, type DragPhase } from '../three/Viewer';

interface Props {
  project: Project;
  step?: number;
  explode?: number;
  ghost?: boolean;
  labels?: boolean;
  /** Cotas generales sobre el modelo. */
  dims?: boolean;
  /** Ejes con tirador de arrastre. */
  handles?: Axis[];
  /** Silueta de 1,70 m para dar escala. */
  figure?: boolean;
  /** La cámara se acerca a las piezas de cada paso. */
  focus?: boolean;
  /** Mantiene la cámara al cambiar de proyecto (configurador, modo libre). */
  keepView?: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onHandleDrag?: (axis: Axis, delta: number, phase: DragPhase) => void;
  /** Modo libre: arrastre de piezas. */
  partDrag?: boolean;
  dragVertical?: boolean;
  onPartDrag?: (id: string, pos: Vec3, phase: DragPhase) => void;
  snap?: (id: string, pos: Vec3) => Vec3;
  /** Incrementa este número para volver a la vista inicial. */
  resetKey?: number;
  className?: string;
  children?: ReactNode;
  label: string;
}

/** Envoltorio React del visor three.js. Mantiene una sola instancia por montaje. */
export function Viewer3D(p: Props) {
  const { project, step, explode = 0, ghost = true, labels = true, dims = false, handles, figure = false, focus = false, selected = null, resetKey = 0 } = p;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef(p);
  cb.current = p;
  const handleKey = (handles ?? []).join('');

  useEffect(() => {
    if (!canvas.current || !box.current) return;
    let v: Viewer;
    try {
      v = new Viewer(canvas.current);
    } catch {
      setFailed(true);
      return;
    }
    viewer.current = v;
    v.onSelect = (id) => cb.current.onSelect?.(id);
    v.onHandleDrag = (a, d, ph) => cb.current.onHandleDrag?.(a, d, ph);
    v.onPartDrag = (id, pos, ph) => cb.current.onPartDrag?.(id, pos, ph);
    v.snap = (id, pos) => cb.current.snap?.(id, pos) ?? pos;
    const el = box.current;
    const ro = new ResizeObserver(() => v.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    v.resize(el.clientWidth, el.clientHeight);
    return () => {
      ro.disconnect();
      v.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.setProject(project, { keepView: cb.current.keepView });
    v.setStep(step ?? project.steps.length - 1, false);
    v.select(cb.current.selected ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);
  useEffect(() => {
    if (step !== undefined) viewer.current?.setStep(step);
  }, [step]);
  useEffect(() => {
    viewer.current?.setExplode(explode);
  }, [explode]);
  useEffect(() => {
    viewer.current?.setGhost(ghost);
  }, [ghost]);
  useEffect(() => {
    viewer.current?.setLabels(labels);
  }, [labels]);
  useEffect(() => {
    viewer.current?.setDimensions(dims);
  }, [dims]);
  useEffect(() => {
    viewer.current?.setHandles((handles ?? []) as Axis[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleKey]);
  useEffect(() => {
    viewer.current?.setScaleFigure(figure);
  }, [figure]);
  useEffect(() => {
    viewer.current?.setAutoFocus(focus);
  }, [focus]);
  useEffect(() => {
    viewer.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    if (viewer.current) {
      viewer.current.partDrag = !!p.partDrag;
      viewer.current.dragVertical = !!p.dragVertical;
    }
  }, [p.partDrag, p.dragVertical]);
  useEffect(() => {
    if (resetKey) viewer.current?.resetView();
  }, [resetKey]);

  return (
    <div ref={box} className={`viewer ${p.className ?? ''}`}>
      {failed ? (
        <div className="viewer-fallback">
          <p>Tu navegador no ha podido iniciar la vista 3D (WebGL). El paso a paso, las listas y el PDF siguen disponibles.</p>
        </div>
      ) : (
        <canvas ref={canvas} role="img" aria-label={p.label} />
      )}
      {p.children}
    </div>
  );
}
