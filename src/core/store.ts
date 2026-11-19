import { useCallback, useEffect, useState } from 'react';

/**
 * Datos de la persona guardados en su navegador (localStorage): diseños, herramientas que tiene,
 * precios de su almacén y progreso de cada proyecto. Todo es opcional: si el almacenamiento falla
 * (ventana privada, datos bloqueados) la web funciona igual, sin recordar.
 */
const PREFIX = 'mitaller:';
const EVENT = 'mitaller-store';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** Estado persistente y sincronizado entre componentes (y pestañas). */
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((old: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    setValue(load(key, fallback));
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === key || (e as StorageEvent).key === PREFIX + key) setValue(load(key, fallback));
    };
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T | ((old: T) => T)) => {
      const next = typeof v === 'function' ? (v as (old: T) => T)(load(key, fallback)) : v;
      save(key, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

// ---------- claves y formas ----------

export interface SavedDesign {
  id: string;
  name: string;
  /** id del generador, o 'libre' para un diseño del modo libre. */
  gen: string;
  /** Parámetros como query string (o el diseño libre serializado). */
  query: string;
  date: string;
}

export const KEYS = {
  /** SavedDesign[] */
  designs: 'disenos',
  /** string[]: herramientas que la persona ya tiene (texto tal cual aparece en los pasos). */
  tools: 'herramientas',
  /** Record<string, number>: precio por unidad de compra, indexado por el nombre del material o artículo. */
  prices: 'precios',
  /** number[]: índices de los pasos hechos. La clave completa es `progreso:<id del generador>?<query>`. */
  progress: (projectKey: string) => `progreso:${projectKey}`,
} as const;

/** Resumen del progreso de todos los proyectos empezados: { clave → pasos hechos }. */
export function allProgress(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + 'progreso:')) out[k.slice((PREFIX + 'progreso:').length)] = JSON.parse(localStorage.getItem(k) ?? '[]');
    }
  } catch {
    /* sin almacenamiento */
  }
  return out;
}
