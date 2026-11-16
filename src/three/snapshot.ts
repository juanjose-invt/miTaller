import type { Project } from '../core/types';
import { Viewer } from './Viewer';

let shared: { viewer: Viewer; canvas: HTMLCanvasElement; project: Project | null } | null = null;

export interface SnapshotOptions {
  width: number;
  height: number;
  /** Paso a mostrar; por defecto el último (pieza terminada). */
  step?: number;
  labels?: boolean;
  ghost?: boolean;
  explode?: number;
  background?: string;
  type?: 'image/jpeg' | 'image/png';
}

/**
 * Renderiza un proyecto fuera de pantalla y devuelve la imagen como data URL.
 * Usa un único contexto WebGL compartido para miniaturas y para el PDF.
 */
export function snapshot(project: Project, o: SnapshotOptions): string {
  if (!shared) {
    const canvas = document.createElement('canvas');
    const viewer = new Viewer(canvas, { interactive: false, preserveDrawingBuffer: true, background: '#f6f1e7' });
    shared = { viewer, canvas, project: null };
  }
  const { viewer, canvas } = shared;
  viewer.resize(o.width, o.height, 1);
  if (shared.project !== project) {
    viewer.setProject(project);
    shared.project = project;
  } else {
    viewer.resetView();
  }
  viewer.setGhost(o.ghost ?? false);
  viewer.setLabels(o.labels ?? false);
  viewer.setExplode(o.explode ?? 0);
  viewer.setStep(o.step ?? project.steps.length - 1, false);
  viewer.renderNow();
  return canvas.toDataURL(o.type ?? 'image/jpeg', 0.9);
}
