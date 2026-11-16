import { useEffect, useState } from 'react';
import type { Craft, Project } from '../core/types';
import { snapshot } from '../three/snapshot';

export const CRAFT_LABEL: Record<Craft, string> = { carpinteria: 'Carpintería', soldadura: 'Soldadura' };
const LEVEL = ['', 'Para empezar', 'Con algo de práctica', 'Exigente'];

export function CraftChip({ craft }: { craft: Craft }) {
  return <span className={`chip dot ${craft === 'carpinteria' ? 'wood' : 'steel'}`}>{CRAFT_LABEL[craft]}</span>;
}

export function Level({ value }: { value: 1 | 2 | 3 }) {
  return (
    <span className="level" title={LEVEL[value]}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= value ? 'on' : ''} />
      ))}
      <span style={{ marginLeft: 5 }}>{LEVEL[value]}</span>
    </span>
  );
}

const thumbs = new Map<string, string>();
const queue: (() => void)[] = [];
let running = false;
function pump() {
  if (running) return;
  running = true;
  const next = () => {
    const job = queue.shift();
    if (!job) {
      running = false;
      return;
    }
    job();
    setTimeout(next, 30); // cede el hilo entre miniaturas
  };
  setTimeout(next, 60);
}

/** Miniatura 3D generada en el navegador a partir del propio modelo. */
export function Thumb({ id, make, alt }: { id: string; make: () => Project; alt: string }) {
  const [src, setSrc] = useState(thumbs.get(id));
  useEffect(() => {
    if (thumbs.has(id)) {
      setSrc(thumbs.get(id));
      return;
    }
    let alive = true;
    queue.push(() => {
      if (!alive) return;
      try {
        const url = snapshot(make(), { width: 640, height: 480 });
        thumbs.set(id, url);
        setSrc(url);
      } catch {
        /* sin WebGL: se queda el marcador */
      }
    });
    pump();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="skeleton" style={{ width: '100%', height: '100%' }} aria-hidden />;
}

export const hoursLabel = (h: number) => (h < 1 ? 'Menos de 1 h' : `${h.toLocaleString('es-ES')} h de trabajo`);
export const dimsLabel = (d: [number, number, number]) => `${Math.round(d[0] / 10)} × ${Math.round(d[2] / 10)} × ${Math.round(d[1] / 10)} cm`;
