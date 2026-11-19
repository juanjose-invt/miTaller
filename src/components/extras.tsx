import { useState, type ComponentType } from 'react';
import { Download, Loader } from 'lucide-react';
import type { Project, Technique } from '../core/types';
import { CutPlan } from './CutPlan';

/**
 * Puntos de integración de los módulos opcionales: plan de corte y plantillas 1:1,
 * ensambles en 3D y modo libre. Los dos últimos se resuelven con `import.meta.glob`
 * para que la web siga compilando aunque falte alguno.
 */
const jointMods = import.meta.glob<{ JointViewer: ComponentType<{ id: string; compact?: boolean }> }>('./JointViewer.tsx', { eager: true });
const jointData = import.meta.glob<{ jointForTechnique: (name: string) => string | undefined }>('../data/ensambles-3d.ts', { eager: true });
const freeMods = import.meta.glob<{ parseDesign: (s: string) => unknown; toProject: (d: never) => Project }>('../core/free.ts', { eager: true });

const JointViewer = Object.values(jointMods)[0]?.JointViewer;
const jointFor = Object.values(jointData)[0]?.jointForTechnique;
const free = Object.values(freeMods)[0];

/** Pestaña «Plan de corte»: aprovechamiento de barras y tableros, y plantillas a tamaño real. */
export function ProjectExtras({ project, title, onToast }: { project: Project; title: string; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [has, setHas] = useState<boolean | null>(null);
  if (has === null) import('../pdf/extras').then((m) => setHas(m.hasTemplates(project))).catch(() => setHas(false));
  const templates = async () => {
    setBusy(true);
    try {
      const { downloadTemplates } = await import('../pdf/extras');
      if (await downloadTemplates(project, title)) onToast('Plantillas listas. Imprímelas al 100 %, sin ajustar a la página.');
    } catch (e) {
      console.error(e);
      onToast('No se han podido generar las plantillas. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      {has && (
        <div className="extras-bar">
          <p><strong>Plantillas a tamaño real</strong>Las piezas curvas de este proyecto (volutas, arcos…) en PDF a escala 1:1, para curvar encima o marcar el corte.</p>
          <button className="btn primary" onClick={templates} disabled={busy}>{busy ? <Loader size={18} aria-hidden className="spin" /> : <Download size={18} aria-hidden />}Plantillas 1:1 en PDF</button>
        </div>
      )}
      <CutPlan project={project} pdfTitle={title} headingLevel={2} />
    </div>
  );
}

/** Ensamble en 3D junto a la técnica de un paso, si existe modelo para ella. */
export function TechniqueJoint({ technique }: { technique: Technique }) {
  const id = technique.joint ?? jointFor?.(technique.name);
  if (!id || !JointViewer) return null;
  return <div className="tech-joint"><JointViewer id={id} compact /></div>;
}

/** Proyecto de un diseño del modo libre a partir de su texto serializado. */
export function resolveFree(serialized: string): { project: Project } | null {
  if (!free || !serialized) return null;
  try {
    const design = free.parseDesign(serialized);
    return design ? { project: free.toProject(design as never) } : null;
  } catch {
    return null;
  }
}
