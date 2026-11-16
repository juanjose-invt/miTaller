import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Project } from '../core/types';
import { Viewer } from '../three/Viewer';

interface Props {
  project: Project;
  step?: number;
  explode?: number;
  ghost?: boolean;
  labels?: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** Incrementa este número para volver a la vista inicial. */
  resetKey?: number;
  className?: string;
  children?: ReactNode;
  label: string;
}

/** Envoltorio React del visor three.js. Mantiene una sola instancia por montaje. */
export function Viewer3D({ project, step, explode = 0, ghost = true, labels = true, selected = null, onSelect, resetKey = 0, className, children, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [failed, setFailed] = useState(false);
  const onSel = useRef(onSelect);
  onSel.current = onSelect;

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
    v.onSelect = (id) => onSel.current?.(id);
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
    viewer.current?.setProject(project);
    if (step !== undefined) viewer.current?.setStep(step, false);
    else viewer.current?.setStep(project.steps.length - 1, false);
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
    viewer.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    if (resetKey) viewer.current?.resetView();
  }, [resetKey]);

  return (
    <div ref={box} className={`viewer ${className ?? ''}`}>
      {failed ? (
        <div className="viewer-fallback">
          <p>Tu navegador no ha podido iniciar la vista 3D (WebGL). El paso a paso, las listas y el PDF siguen disponibles.</p>
        </div>
      ) : (
        <canvas ref={canvas} role="img" aria-label={label} />
      )}
      {children}
    </div>
  );
}
