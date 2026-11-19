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
  acero: { label: 'Acero', color: '#aab4ba', kind: 'metal', roughness: 0.38, metalness: 0.85 },
  malla: { label: 'Malla electrosoldada', color: '#9aa4aa', kind: 'malla', roughness: 0.45, metalness: 0.7 },
  herraje: { label: 'Herraje', color: '#5a6066', kind: 'herraje', roughness: 0.4, metalness: 0.8 },
};

/** Longitud comercial habitual de barra/listón en mm (orientativa: compruébala en tu almacén). */
export const BAR_LENGTH = { madera: 2400, acero: 6000 } as const;
/** Material que se pierde en cada corte (grosor del disco), en mm. */
export const KERF = { madera: 3, acero: 2 } as const;

/** Densidades orientativas (kg/m³) para estimar el peso. El acero es un valor físico; las maderas varían mucho. */
export const DENSITY: Record<MaterialId, number> = { pino: 500, haya: 700, contrachapado: 600, dm: 750, acero: 7850, malla: 7850, herraje: 7850 };

/** Tintes y pinturas para madera (color de dibujo; el tono real depende del producto y de la madera). */
export const STAINS: { value: string; label: string; hex?: string; hint?: string }[] = [
  { value: 'natural', label: 'Natural', hint: 'Aceite o barniz incoloro' },
  { value: 'miel', label: 'Miel', hex: '#d39a4e' },
  { value: 'roble', label: 'Roble', hex: '#b08350' },
  { value: 'nogal', label: 'Nogal', hex: '#7c5538' },
  { value: 'wengue', label: 'Wengué', hex: '#473429' },
  { value: 'blanco', label: 'Blanco lavado', hex: '#efe7d8' },
  { value: 'gris', label: 'Gris piedra', hex: '#a39f96' },
  { value: 'salvia', label: 'Verde salvia', hex: '#8fa58b' },
  { value: 'petroleo', label: 'Azul petróleo', hex: '#3f6373' },
  { value: 'negro', label: 'Negro', hex: '#2b2927' },
];
