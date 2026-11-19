import type { ComponentType } from 'react';
import type { CustomParam, ParamValues } from '../core/types';

/** Props que recibe el editor de un parámetro 'custom'. */
export interface EditorProps {
  param: CustomParam;
  value: string;
  onChange: (value: string) => void;
  /** Todos los valores actuales del configurador (solo lectura). */
  values: ParamValues;
}

/**
 * Registro de editores propios. Cada archivo de `./editors/` exporta `editorId` (el `editor` del
 * parámetro) y un componente por defecto que recibe EditorProps.
 */
const mods = import.meta.glob<{ editorId: string; default: ComponentType<EditorProps> }>('./editors/*.tsx', { eager: true });
export const EDITORS: Record<string, ComponentType<EditorProps>> = {};
for (const m of Object.values(mods)) if (m.editorId && m.default) EDITORS[m.editorId] = m.default;
