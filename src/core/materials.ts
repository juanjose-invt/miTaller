import type { MaterialId } from './types';

export interface MaterialInfo {
  label: string;
  /** Color base en 3D. */
  color: string;
  kind: 'madera' | 'metal' | 'malla' | 'herraje';
  roughness: number;
  metalness: number;
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  pino: { label: 'Pino', color: '#ecd3a6', kind: 'madera', roughness: 0.82, metalness: 0 },
  haya: { label: 'Haya', color: '#e6c08e', kind: 'madera', roughness: 0.78, metalness: 0 },
  contrachapado: { label: 'Contrachapado', color: '#e2c79b', kind: 'madera', roughness: 0.8, metalness: 0 },
  dm: { label: 'DM', color: '#c9ae8c', kind: 'madera', roughness: 0.9, metalness: 0 },
  acero: { label: 'Acero', color: '#77828a', kind: 'metal', roughness: 0.42, metalness: 0.75 },
  malla: { label: 'Malla electrosoldada', color: '#8b959c', kind: 'malla', roughness: 0.5, metalness: 0.6 },
  herraje: { label: 'Herraje', color: '#3b3f44', kind: 'herraje', roughness: 0.45, metalness: 0.7 },
};

/** Longitud comercial habitual de barra/listón en mm (orientativa: compruébala en tu almacén). */
export const BAR_LENGTH = { madera: 2400, acero: 6000 } as const;
/** Material que se pierde en cada corte (grosor del disco), en mm. */
export const KERF = { madera: 3, acero: 2 } as const;
